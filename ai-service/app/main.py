import fastapi
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
import json
import os
import time
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
except Exception:
    pass

from . import retrieval, db

# Gemini SDK (primary provider). Optional import so the service still boots
# (falling back to Groq) if the package is ever missing.
try:
    from google import genai as genai_sdk
    from google.genai import types as genai_types
    GEMINI_AVAILABLE = True
except Exception:  # pragma: no cover
    genai_sdk = None
    genai_types = None
    GEMINI_AVAILABLE = False

app = FastAPI(title="PolicyLens AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TAXONOMY_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'taxonomy.json')

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_EXTRACTION_MODEL = os.getenv("GROQ_EXTRACTION_MODEL", "llama-3.3-70b-versatile")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")

GROQ_EXTRACTION_CHUNK_CHARS = int(os.getenv("GROQ_EXTRACTION_CHUNK_CHARS", "12000"))
GROQ_CHUNK_SLEEP_SECONDS = float(os.getenv("GROQ_CHUNK_SLEEP_SECONDS", "60"))
GROQ_EXTRACTION_MAX_TOKENS = int(os.getenv("GROQ_EXTRACTION_MAX_TOKENS", "3500"))

# OpenRouter (openrouter.ai) — OpenAI-compatible primary free provider.
# Free-tier :free models need no credit card; 20 req/min, 50 req/day
# (1,000/day after a one-time $10 credit). nemotron-3-super-120b handles the
# full policy single-shot (262K context) with reliable json_object output.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
OPENROUTER_EXTRACTION_MODEL = os.getenv("OPENROUTER_EXTRACTION_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
OPENROUTER_CHAT_MODEL = os.getenv("OPENROUTER_CHAT_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")

# NVIDIA NIM (build.nvidia.com) — OpenAI-compatible fallback provider.
# NOTE: NVIDIA's free tier terms prohibit personal data. Insurance policies are
# personal/health data — dev-only use, never for production.
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_EXTRACTION_MODEL = os.getenv("NVIDIA_EXTRACTION_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
NVIDIA_CHAT_MODEL = os.getenv("NVIDIA_CHAT_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1.5")

MAX_RETRIES = 4

_HTTP_SESSION = requests.Session()

def load_taxonomy():
    with open(TAXONOMY_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def _api_key_configured(value: str) -> bool:
    placeholders = [
        "your-groq-api-key-here",
        "your-gemini-api-key-here",
        "your-nvidia-api-key-here",
        "your-openrouter-api-key-here",
    ]
    return bool(value) and value not in placeholders


def call_openai_compatible(*, base_url: str, api_key: str, provider_label: str,
                           system_prompt: str, user_prompt: str, model: str,
                           max_tokens: int = 1024, temperature: float = 0.1,
                           response_json: bool = False, timeout: int = 120) -> dict:
    """Call any OpenAI-compatible /v1/chat/completions endpoint.

    Shared by Groq, NVIDIA NIM and OpenRouter. Tries response_format
    json_object when requested, then retries without it if the model rejects
    the format (hosted open models implement JSON mode inconsistently).
    """
    if not _api_key_configured(api_key):
        return {
            "answer": None,
            "grounded": False,
            "cited_clause_id": None,
            "raw_error": "API key not configured"
        }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    use_json_mode = response_json
    if use_json_mode:
        payload["response_format"] = {"type": "json_object"}

    for attempt in range(MAX_RETRIES):
        try:
            response = _HTTP_SESSION.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=timeout
            )
        except requests.RequestException as e:
            if attempt == MAX_RETRIES - 1:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"{provider_label} request failed: {str(e)}"
                }
            time.sleep(2 ** attempt)
            continue

        # Hosted open models may reject json_object mode. Retry without it —
        # the prompt already demands a single JSON object.
        if response.status_code == 400 and use_json_mode and "response_format" in payload:
            payload.pop("response_format", None)
            use_json_mode = False
            continue

        if response.status_code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES - 1:
            retry_after = None
            if response.status_code == 429 and "retry-after" in response.headers:
                try:
                    retry_after = int(response.headers["retry-after"])
                except ValueError:
                    retry_after = None
            delay = retry_after if retry_after else (2 ** (attempt + 1))
            time.sleep(delay)
            continue

        if response.status_code != 200:
            return {
                "answer": None,
                "grounded": False,
                "cited_clause_id": None,
                "raw_error": f"{provider_label} error {response.status_code}: {response.text[:600]}"
            }

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            # Some providers return HTTP 200 with an error body or an empty
            # choices array (e.g. OpenRouter :free on malformed upstream).
            # Surface it as a normal provider error so the fallback chain
            # moves on instead of raising an unhandled KeyError.
            return {
                "answer": None,
                "grounded": False,
                "cited_clause_id": None,
                "raw_error": f"{provider_label} returned no choices: {response.text[:300]}"
            }
        if not content or not content.strip():
            return {
                "answer": None,
                "grounded": False,
                "cited_clause_id": None,
                "raw_error": f"{provider_label} returned empty content: {response.text[:300]}"
            }
        answer = content.strip()
        return {"answer": answer, "grounded": False, "cited_clause_id": None, "raw_error": None}

    return {
        "answer": None,
        "grounded": False,
        "cited_clause_id": None,
        "raw_error": f"{provider_label} error: rate limited after {MAX_RETRIES} attempts"
    }


def call_groq(system_prompt: str, user_prompt: str, model: str = None, max_tokens: int = 1024, temperature: float = 0.1, response_json: bool = False) -> dict:
    return call_openai_compatible(
        base_url="https://api.groq.com/openai/v1",
        api_key=GROQ_API_KEY,
        provider_label="Groq",
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model or GROQ_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        response_json=response_json,
    )


def call_nvidia(system_prompt: str, user_prompt: str, *, model: str = None, max_tokens: int = 1024, temperature: float = 0.1, response_json: bool = False) -> dict:
    return call_openai_compatible(
        base_url=NVIDIA_BASE_URL,
        api_key=NVIDIA_API_KEY,
        provider_label="NVIDIA NIM",
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model or NVIDIA_EXTRACTION_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        response_json=response_json,
    )


def call_openrouter(system_prompt: str, user_prompt: str, model: str = None, max_tokens: int = 1024, temperature: float = 0.1, response_json: bool = False) -> dict:
    return call_openai_compatible(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
        provider_label="OpenRouter",
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model or OPENROUTER_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        response_json=response_json,
        timeout=240,
    )


_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    if not GEMINI_AVAILABLE or not _api_key_configured(GEMINI_API_KEY):
        return None
    _gemini_client = genai_sdk.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def call_gemini(system_prompt: str, user_prompt: str, *, model: str = None, max_tokens: int = 1024, temperature: float = 0.1, response_schema: dict = None) -> dict:
    client = _get_gemini_client()
    if client is None:
        return {
            "answer": None,
            "grounded": False,
            "cited_clause_id": None,
            "raw_error": "API key not configured"
        }

    config = {
        "system_instruction": system_prompt,
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }
    if response_schema is not None:
        config["response_mime_type"] = "application/json"
        config["response_schema"] = response_schema

    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=model or GEMINI_MODEL,
                contents=user_prompt,
                config=genai_types.GenerateContentConfig(**config),
            )
            text = response.text
            if text is None:
                feedback = getattr(response, "prompt_feedback", None)
                reason = getattr(feedback, "block_reason", None)
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini blocked (block_reason={reason})"
                }
            return {"answer": text.strip(), "grounded": False, "cited_clause_id": None, "raw_error": None}
        except Exception as e:
            error_str = str(e)
            lower = error_str.lower()
            # Fail fast on quota exhausted errors
            if "RESOURCE_EXHAUSTED" in error_str or "quota" in lower:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini quota exhausted: {error_str[:200]}"
                }
            # Fail fast on auth errors — a bad key will not heal on retry, and
            # each backoff cycle wastes seconds before the fallback chain moves on.
            if any(token in error_str for token in ("PERMISSION_DENIED", "UNAUTHENTICATED", "403", "401", "API key not valid")) or "invalid key" in lower:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini auth error: {error_str[:200]}"
                }
            if attempt == MAX_RETRIES - 1:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini error: {str(e)}"
                }
            time.sleep(2 ** attempt)

    return {
        "answer": None,
        "grounded": False,
        "cited_clause_id": None,
        "raw_error": "Gemini error: failed after retries"
    }


def call_llm(system_prompt: str, user_prompt: str, *, extraction: bool = False, chat: bool = False, max_tokens: int = 1024, temperature: float = 0.1, response_json: bool = False, response_schema: dict = None, fallback_prompt: str = None) -> dict:
    """Call the LLM with a purpose-specific fallback chain.

    Extraction chain: Gemini (JSON schema) -> OpenRouter (full-doc JSON) -> NVIDIA NIM -> Groq (chunked).
    Chat chain:       OpenRouter -> Groq -> NVIDIA NIM -> Gemini.

    Each provider is tried in order; the first success wins. If every provider
    fails, the combined error is surfaced (never a silent default).
    
    For extraction with Groq, the text is automatically chunked to respect TPM limits.
    """
    if extraction:
        chain = [
            ("gemini", call_gemini, {"model": GEMINI_MODEL, "response_schema": response_schema}),
            ("openrouter", call_openrouter, {"model": OPENROUTER_EXTRACTION_MODEL, "response_json": response_json}),
            ("nvidia", call_nvidia, {"model": NVIDIA_EXTRACTION_MODEL, "response_json": response_json}),
            ("groq", call_groq, {"model": GROQ_EXTRACTION_MODEL, "response_json": response_json}),
        ]
    else:
        chain = [
            ("openrouter", call_openrouter, {"model": OPENROUTER_CHAT_MODEL, "response_json": response_json}),
            ("groq", call_groq, {"model": GROQ_CHAT_MODEL, "response_json": response_json}),
            ("nvidia", call_nvidia, {"model": NVIDIA_CHAT_MODEL, "response_json": response_json}),
            ("gemini", call_gemini, {"model": GEMINI_CHAT_MODEL, "response_schema": None}),
        ]

    errors = []
    for name, fn, extra in chain:
        kwargs = dict(extra)
        if name == "gemini":
            result = fn(system_prompt, user_prompt, max_tokens=max_tokens, temperature=temperature, **kwargs)
        elif extraction and name == "groq":
            # For extraction with Groq, use chunked extraction to respect TPM limits.
            # Extract the text portion from user_prompt and use groq_extract_chunked.
            # The user_prompt format is: "Policy document text (pages marked --- PAGE N ---):\n\n{text}"
            # We need to extract just the text content.
            if "--- PAGE" in user_prompt:
                # Extract text after the prompt preamble
                text_start = user_prompt.find("--- PAGE")
                if text_start != -1:
                    text = user_prompt[text_start:]
                else:
                    text = user_prompt
            else:
                text = user_prompt
            result = groq_extract_chunked(system_prompt, text, model=kwargs.get("model"))
            # Normalize groq_extract_chunked response format to match call_llm expectations
            if result.get("answer"):
                result["grounded"] = False
                result["cited_clause_id"] = None
        else:
            prompt = fallback_prompt if name == "groq" and fallback_prompt else user_prompt
            result = fn(system_prompt, prompt, max_tokens=max_tokens, temperature=temperature, **kwargs)
        if not result.get("raw_error"):
            return result
        errors.append(f"{name}: {result['raw_error']}")

    return {
        "answer": None,
        "grounded": False,
        "cited_clause_id": None,
        "raw_error": "All providers failed. " + " | ".join(errors),
    }


PAGE_MARKER_PATTERN = "--- PAGE"


@app.get("/")
async def root():
    return {"status": "ok", "service": "policylens-ai-service"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract")
def extract_text(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = file.file.read()

    try:
        text_parts = []
        page_count = 0
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- PAGE {i+1} ---\n{page_text}")
                page_count += 1

        full_text = "\n\n".join(text_parts)

        if not full_text.strip():
            raise HTTPException(
                status_code=400,
                detail="This looks like a scanned document — PolicyLens currently reads digital PDFs only"
            )

        return {
            "extractedText": full_text,
            "pageCount": page_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/generate-explanation")
async def generate_explanation(body: dict):
    rule_id = body.get("ruleId")
    values = body.get("values", {})

    taxonomy = load_taxonomy()
    all_rules = taxonomy.get("redFlags", []) + taxonomy.get("greenFlags", [])
    rule = next((r for r in all_rules if r["id"] == rule_id), None)

    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")

    template = rule["template"]
    result = template

    replacements = {
        "{cap_value}": str(values.get("cap_value", "a certain amount")),
        "{sum_insured}": f"Rs.{int(values['sum_insured']):,}" if values.get("sum_insured") else "the sum insured",
        "{procedure}": values.get("procedure", "this procedure"),
        "{sub_limit_value}": f"Rs.{int(values['sub_limit_value']):,}" if values.get("sub_limit_value") else "a capped amount",
        "{co_pay_pct}": str(values.get("co_pay_pct", "a certain percentage")),
        "{calculated_amount}": f"Rs.{int(values.get('calculated_amount', 0)):,}",
        "{waiting_period}": str(values.get("waiting_period", "a certain period")),
        "{condition}": values.get("condition", "a pre-existing condition"),
        "{condition_or_treatment}": values.get("condition_or_treatment", "this condition"),
        "{timeframe}": values.get("timeframe", "the specified timeframe"),
        "{value}": f"Rs.{int(values['value']):,}" if values.get("value") else "a capped amount",
        "{insurer}": values.get("insurer", "the insurer"),
        "{examples}": "cataract, hernia, joint replacement",
    }

    for placeholder, replacement in replacements.items():
        result = result.replace(placeholder, replacement)

    return {"ruleId": rule_id, "explanation": result}


@app.post("/embed")
async def embed_document(body: dict):
    document_id = body.get("documentId")
    text = body.get("text", "")

    if not document_id:
        raise HTTPException(status_code=400, detail="documentId is required")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        chunks = retrieval.chunk_text(text, chunk_size=800, overlap=100)
        chunks_with_index = list(enumerate(chunks))
        chunk_ids = db.store_chunks(document_id, chunks_with_index)

        return {
            "documentId": document_id,
            "totalChunks": len(chunks),
            "chunkIds": chunk_ids,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@app.post("/chat")
def chat(body: dict):
    document_id = body.get("documentId")
    question = body.get("question", "").strip()
    history = body.get("history", [])

    if not document_id:
        raise HTTPException(status_code=400, detail="documentId is required")
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    try:
        chunks = db.get_chunks(document_id)

        if not chunks:
            db.store_chat_message(document_id, "user", question, grounded_in_document=False)
            fallback = "I haven't seen this document yet. Please make sure the document has been processed."
            db.store_chat_message(document_id, "assistant", fallback, grounded_in_document=False)
            return {
                "answer": fallback,
                "groundedInDocument": False,
                "citedClauseId": None
            }

        chunk_texts = [c[1] for c in chunks]
        chunk_ids = [c[2] for c in chunks]

        index = retrieval.build_bm25_index(chunk_texts)
        results = retrieval.retrieve(question, index, top_k=5)

        if not results:
            db.store_chat_message(document_id, "user", question, grounded_in_document=False)
            fallback = "I couldn't find information to answer this question in your policy document."
            db.store_chat_message(document_id, "assistant", fallback, grounded_in_document=False)
            return {
                "answer": fallback,
                "groundedInDocument": False,
                "citedClauseId": None
            }

        top_results = results[:5]
        top_chunk_ids = [chunk_ids[idx] for idx, _ in top_results]
        top_texts = [chunk_texts[idx] for idx, _ in top_results]

        context = "\n\n---\n\n".join(top_texts)

        system_prompt = (
            "You are a helpful assistant that answers questions about health insurance policy documents. "
            "You must ONLY answer based on the provided document excerpts below. "
            "If the document excerpts do not contain enough information to answer the question, "
            "say exactly: 'I couldn't find this information in your policy document.' "
            "Do NOT make up answers or use general knowledge. "
            "Do NOT give financial or insurance advice. "
            "Answer in clear, plain language. "
            "Use Indian numbering (lakhs, crores) for currency amounts."
        )

        user_prompt = (
            f"Document excerpts (relevant sections of the uploaded policy):\n\n"
            f"{context}\n\n"
            f"Question: {question}\n\n"
            f"Answer only from the excerpts above. If the answer is not there, say so."
        )

        llm_result = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            chat=True,
            max_tokens=1024,
        )
        db.store_chat_message(document_id, "user", question, grounded_in_document=False)

        if llm_result.get("raw_error"):
            fallback = "I'm sorry, I couldn't process this question right now."
            if "API key not configured" in llm_result["raw_error"]:
                fallback = "Chat is not configured yet. Please set up your API key to use this feature."
            db.store_chat_message(document_id, "assistant", fallback, grounded_in_document=False)
            return {
                "answer": fallback,
                "groundedInDocument": False,
                "citedClauseId": None,
                "error": llm_result["raw_error"]
            }

        answer = llm_result["answer"]

        grounded = True
        cited_clause_id = top_chunk_ids[0] if top_chunk_ids else None

        fallback_phrases = [
            "couldn't find this information",
            "not in your policy document",
            "does not contain",
            "not covered in this document",
            "i cannot find",
            "does not provide",
        ]

        answer_lower = answer.lower().strip()
        for phrase in fallback_phrases:
            if phrase in answer_lower:
                grounded = False
                cited_clause_id = None
                break

        db.store_chat_message(document_id, "assistant", answer,
                              grounded_in_document=grounded,
                              cited_clause_id=cited_clause_id)

        return {
            "answer": answer,
            "groundedInDocument": grounded,
            "citedClauseId": cited_clause_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ---------------------------------------------------------------------------
# Extraction: structured JSON schema for Gemini (primary) with text-prompt
# fallback for Groq. Every clause group carries a source_excerpt (verbatim
# sentence) and page_number so flags remain traceable (AGENTS.md hard rule).
# ---------------------------------------------------------------------------

STRING = "STRING"
INTEGER = "INTEGER"
NUMBER = "NUMBER"
BOOLEAN = "BOOLEAN"
ARRAY = "ARRAY"
OBJECT = "OBJECT"

EXCERPT_PROPS = {
    "source_excerpt": {"type": STRING, "description": "Verbatim sentence from the document, or null"},
    "page_number": {"type": INTEGER, "description": "Page number (1-based) where this appears, or null"},
}

EXTRACTION_SCHEMA = {
    "type": OBJECT,
    "properties": {
        "insurer_name": {"type": STRING},
        "sum_insured": {"type": INTEGER, "description": "Overall sum insured in rupees, or null"},
        "room_rent_clause": {
            "type": OBJECT,
            "properties": {
                "cap_type": {"type": STRING, "enum": ["percentage_of_sum_insured", "fixed_amount_per_day", "no_cap"]},
                "cap_value": {"type": NUMBER},
                "has_proportionate_deduction": {"type": BOOLEAN},
                **EXCERPT_PROPS,
            },
        },
        "co_pay": {
            "type": OBJECT,
            "properties": {
                "percentage": {"type": NUMBER},
                "explicitly_absent": {"type": BOOLEAN},
                "age_linked": {"type": BOOLEAN},
                "age_threshold": {"type": INTEGER},
                **EXCERPT_PROPS,
            },
        },
        "ped_waiting_period_months": {"type": INTEGER},
        "ped_explicitly_stated": {"type": BOOLEAN},
        "initial_waiting_days": {"type": INTEGER},
        "waiting_periods": {
            "type": ARRAY,
            "items": {
                "type": OBJECT,
                "properties": {
                    "condition": {"type": STRING},
                    "period_months": {"type": NUMBER},
                    "period_type": {"type": STRING, "enum": ["ped", "specific_disease", "initial"]},
                    **EXCERPT_PROPS,
                },
            },
        },
        "sub_limits": {
            "type": ARRAY,
            "items": {
                "type": OBJECT,
                "properties": {
                    "procedure": {"type": STRING},
                    "cap_value": {"type": NUMBER},
                    "cap_type": {"type": STRING, "enum": ["fixed_amount", "percentage"]},
                    **EXCERPT_PROPS,
                },
            },
        },
        "exclusions": {
            "type": ARRAY,
            "items": {
                "type": OBJECT,
                "properties": {
                    "condition": {"type": STRING},
                    "is_permanent": {"type": BOOLEAN},
                    **EXCERPT_PROPS,
                },
            },
        },
        "claim_process": {
            "type": ARRAY,
            "items": {
                "type": OBJECT,
                "properties": {
                    "step_name": {"type": STRING},
                    "timeframe_hours": {"type": NUMBER},
                    **EXCERPT_PROPS,
                },
            },
        },
        "non_disclosure_clause_present": {"type": BOOLEAN},
        "non_disclosure_scope": {"type": STRING},
        "non_disclosure_source_excerpt": {"type": STRING},
        "restoration_benefit": {
            "type": OBJECT,
            "properties": {"present": {"type": BOOLEAN}, **EXCERPT_PROPS},
        },
        "cumulative_bonus": {
            "type": OBJECT,
            "properties": {"present": {"type": BOOLEAN}, **EXCERPT_PROPS},
        },
        "network_clause": {
            "type": OBJECT,
            "properties": {
                "cashless_default": {"type": BOOLEAN},
                "network_size_stated": {"type": BOOLEAN},
                "non_network_payout_reduced": {"type": BOOLEAN},
                **EXCERPT_PROPS,
            },
        },
        "renewal_clause": {
            "type": OBJECT,
            "properties": {
                "claims_based_loading": {"type": BOOLEAN},
                "guaranteed_renewal": {"type": BOOLEAN},
                **EXCERPT_PROPS,
            },
        },
        "no_sub_limits_statement_present": {"type": BOOLEAN},
        "discretionary_language_excerpt": {"type": STRING},
        "overall_confidence": {"type": STRING, "enum": ["high", "medium", "low"]},
    },
}

EXTRACTION_SYSTEM_PROMPT = """You are an expert insurance analyst. Extract structured data from the health insurance policy document below.

The document text is divided into pages marked like: --- PAGE N ---

Rules:
- Set each field to null when the document does not mention it. Never guess or infer a value that is not stated.
- For every clause group, set source_excerpt to the exact, verbatim sentence(s) from the document that support the extracted values, and page_number to the page (from the --- PAGE N --- markers) where that sentence appears.
- sum_insured is in rupees. co_pay.percentage is a number where 20 means 20%.
- waiting_periods.period_type: 'ped' for pre-existing disease, 'specific_disease' for named procedures/diseases with their own waiting period, 'initial' for the initial 30/60/90-day waiting period.
- sub_limits[].cap_type: 'fixed_amount' (rupees) or 'percentage' (of sum insured).
- network_clause.cashless_default is true when cashless is the default settlement mode.
- overall_confidence: high when the document clearly states the values, medium when partly stated, low when mostly absent.

Extract values carefully. Use null when a field is not mentioned in the document.
Return your full response as a single valid JSON object — no markdown, no commentary outside the JSON."""


def _clean_excerpt(value) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _join_excerpts(*values) -> str:
    parts = []
    for value in values:
        cleaned = _clean_excerpt(value)
        if cleaned and cleaned not in parts:
            parts.append(cleaned)
    return "\n\n".join(parts)


def _min_page(*values) -> int | None:
    nums = [int(v) for v in values if isinstance(v, (int, float)) and v > 0]
    return min(nums) if nums else None


def _coerce_number(value) -> int | float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "").replace("Rs.", "").replace("₹", "")
        try:
            if cleaned.isdigit():
                return int(cleaned)
            return float(cleaned)
        except ValueError:
            return None
    return None


def _normalize_extraction(extraction: dict) -> dict:
    """Coerce LLM extraction output into the canonical schema the flag engine expects.

    The Gemini path enforces the JSON schema via function calling, but fallback
    providers (Groq, NVIDIA) return free-text JSON that often drifts from the
    schema (e.g. ``duration`` instead of ``period_months``, ``amount`` instead of
    ``cap_value``). This normalizer maps known deviations onto the canonical keys
    so the deterministic flag engine sees a consistent structure.
    """
    e = dict(extraction)

    wp = e.get("waiting_periods")
    if isinstance(wp, list):
        for entry in wp:
            if not isinstance(entry, dict):
                continue
            if entry.get("period_months") is None:
                entry["period_months"] = _coerce_number(entry.get("duration"))
            entry["period_months"] = _coerce_number(entry.get("period_months"))
            entry.setdefault("condition", None)
        for entry in wp:
            if not isinstance(entry, dict):
                continue
            if e.get("initial_waiting_days") is None and entry.get("period_type") == "initial":
                days = _coerce_number(entry.get("duration"))
                if days is None:
                    days = _coerce_number(entry.get("period_months"))
                if days is not None:
                    e["initial_waiting_days"] = int(days)
            if e.get("ped_waiting_period_months") is None and entry.get("period_type") == "ped":
                months = _coerce_number(entry.get("period_months"))
                if months is not None:
                    e["ped_waiting_period_months"] = int(months)

    sub = e.get("sub_limits")
    if isinstance(sub, list):
        for entry in sub:
            if not isinstance(entry, dict):
                continue
            if entry.get("cap_value") is None:
                entry["cap_value"] = _coerce_number(entry.get("amount"))
            entry["cap_value"] = _coerce_number(entry.get("cap_value"))
            if "procedure" not in entry and entry.get("treatment"):
                entry["procedure"] = entry.get("treatment")
            entry.setdefault("cap_type", None)

    excl = e.get("exclusions")
    if isinstance(excl, list):
        e["exclusions"] = [entry for entry in excl if isinstance(entry, dict)]
        for entry in e["exclusions"]:
            entry.setdefault("is_permanent", False)

    cp = e.get("co_pay")
    if isinstance(cp, dict):
        cp["percentage"] = _coerce_number(cp.get("percentage"))

    rr = e.get("room_rent_clause")
    if isinstance(rr, dict):
        rr["cap_value"] = _coerce_number(rr.get("cap_value"))
        rr.setdefault("has_proportionate_deduction", False)

    for key in ("ped_waiting_period_months", "initial_waiting_days", "ped_explicitly_stated",
                "non_disclosure_clause_present", "non_disclosure_scope",
                "discretionary_language_excerpt", "no_sub_limits_statement_present",
                "insurer_name", "sum_insured", "overall_confidence"):
        if key not in e:
            e[key] = None

    for key in ("room_rent_clause", "co_pay", "restoration_benefit",
                "cumulative_bonus", "network_clause", "renewal_clause"):
        if not isinstance(e.get(key), dict):
            e[key] = {}

    for key in ("waiting_periods", "sub_limits", "exclusions", "claim_process"):
        if not isinstance(e.get(key), list):
            e[key] = []
        else:
            # LLM output often mixes in non-object entries (bare strings).
            # Drop them so downstream clause building can safely call .get().
            e[key] = [entry for entry in e[key] if isinstance(entry, dict)]

    return e


def _build_clauses(extraction: dict) -> list:
    clauses = []

    rr = extraction.get("room_rent_clause") or {}
    cp = extraction.get("co_pay") or {}
    rb = extraction.get("restoration_benefit") or {}
    cb = extraction.get("cumulative_bonus") or {}
    nc = extraction.get("network_clause") or {}
    rc = extraction.get("renewal_clause") or {}

    wp_entries = extraction.get("waiting_periods") or []
    sub_entries = extraction.get("sub_limits") or []
    excl_entries = extraction.get("exclusions") or []
    cp_entries = extraction.get("claim_process") or []

    wp_excerpt = _join_excerpts(*[w.get("source_excerpt") for w in wp_entries])
    wp_page = _min_page(*[w.get("page_number") for w in wp_entries])
    sub_excerpt = _join_excerpts(*[s.get("source_excerpt") for s in sub_entries],
                                 *[e.get("source_excerpt") for e in excl_entries])
    sub_page = _min_page(*[s.get("page_number") for s in sub_entries],
                         *[e.get("page_number") for e in excl_entries])
    cp_excerpt = _join_excerpts(*[c.get("source_excerpt") for c in cp_entries])
    cp_page = _min_page(*[c.get("page_number") for c in cp_entries])
    disclosure_excerpt = _join_excerpts(extraction.get("non_disclosure_source_excerpt"),
                                        extraction.get("discretionary_language_excerpt"))
    benefits_excerpt = _join_excerpts(rb.get("source_excerpt"), cb.get("source_excerpt"))
    benefits_page = _min_page(rb.get("page_number"), cb.get("page_number"))

    clause_definitions = [
        ("room_rent", ["room_rent_clause"], _join_excerpts(rr.get("source_excerpt")), _min_page(rr.get("page_number"))),
        ("co_pay", ["co_pay"], _join_excerpts(cp.get("source_excerpt")), _min_page(cp.get("page_number"))),
        ("waiting_periods", ["ped_waiting_period_months", "ped_explicitly_stated", "initial_waiting_days", "waiting_periods"], wp_excerpt, wp_page),
        ("sub_limits_exclusions", ["sub_limits", "exclusions", "no_sub_limits_statement_present"], sub_excerpt, sub_page),
        ("claim_process", ["claim_process"], cp_excerpt, cp_page),
        ("disclosure", ["non_disclosure_clause_present", "non_disclosure_scope", "discretionary_language_excerpt"], disclosure_excerpt, None),
        ("benefits", ["restoration_benefit", "cumulative_bonus"], benefits_excerpt, benefits_page),
        ("network", ["network_clause"], _join_excerpts(nc.get("source_excerpt")), _min_page(nc.get("page_number"))),
        ("renewal", ["renewal_clause"], _join_excerpts(rc.get("source_excerpt")), _min_page(rc.get("page_number"))),
    ]

    for clause_type, fields, raw_text, page_number in clause_definitions:
        clause_json = {f: extraction[f] for f in fields if f in extraction}
        clauses.append({
            "clauseType": clause_type,
            "rawText": raw_text or "",
            "pageNumber": page_number,
            "fieldsJson": clause_json,
            "confidence": extraction.get("overall_confidence") or "medium",
        })

    top_level_fields = ["insurer_name", "sum_insured"]
    global_clause_json = {f: extraction[f] for f in top_level_fields if f in extraction}
    if global_clause_json:
        clauses.insert(0, {
            "clauseType": "policy_overview",
            "rawText": "",
            "pageNumber": None,
            "fieldsJson": global_clause_json,
            "confidence": extraction.get("overall_confidence") or "medium",
        })

    return clauses


def _split_document_chunks(text: str, max_chars: int) -> list:
    """Split document text into page-aligned chunks within a char budget."""
    pages = text.split(PAGE_MARKER_PATTERN)
    chunks = []
    current = ""
    for page in pages:
        if not page.strip():
            continue
        piece = (PAGE_MARKER_PATTERN + page).strip()
        if len(current) + len(piece) <= max_chars:
            current = current + "\n\n" + piece if current else piece
        else:
            if current:
                chunks.append(current)
            if len(piece) > max_chars:
                chunks.append(piece)
                current = ""
            else:
                current = piece
    if current:
        chunks.append(current)
    return chunks


def _merge_extraction(target: dict, incoming: dict) -> dict:
    """Merge a per-chunk extraction into the accumulated result.

    Scalar fields take the first non-null value; arrays are concatenated
    (lists are merged across chunks so every part of the document is kept);
    nested objects are merged field-by-field.
    """
    for key, value in incoming.items():
        if value is None:
            continue
        if key not in target or target[key] is None:
            target[key] = value
            continue
        if isinstance(value, list) and isinstance(target[key], list):
            for item in value:
                if item not in target[key]:
                    target[key].append(item)
        elif isinstance(value, dict) and isinstance(target[key], dict):
            _merge_extraction(target[key], value)


def groq_extract_chunked(system_prompt: str, text: str, model: str = None) -> dict:
    """Run extraction on Groq in TPM-bounded chunks, then merge.

    Free-tier Groq caps tokens-per-minute, so a full policy document cannot
    be sent in one request. This processes every page in sequence (within the
    per-minute window) and merges the per-chunk results so no clause is
    silently dropped.
    """
    if not _api_key_configured(GROQ_API_KEY):
        return {
            "answer": None,
            "raw_error": "API key not configured",
        }

    chunks = _split_document_chunks(text, GROQ_EXTRACTION_CHUNK_CHARS)
    merged = {}
    failures = []

    for i, chunk in enumerate(chunks):
        user_prompt = (
            f"Policy document text (pages marked --- PAGE N ---):\n\n{chunk}\n\n"
            "Return a JSON structure conforming EXACTLY to this schema "
            "(use null when a field is not stated in the text):\n"
            f"{json.dumps(EXTRACTION_SCHEMA, ensure_ascii=False)}\n"
        )
        result = call_groq(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=model or GROQ_EXTRACTION_MODEL,
            max_tokens=GROQ_EXTRACTION_MAX_TOKENS,
            temperature=0.1,
            response_json=True,
        )

        if result.get("raw_error"):
            failures.append(f"chunk {i+1}/{len(chunks)}: {result['raw_error']}")
            continue

        raw = result["answer"]
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0]
            raw = raw.strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            failures.append(f"chunk {i+1}/{len(chunks)}: invalid JSON")
            continue

        _merge_extraction(merged, parsed)

        # Pause between chunks to stay within Groq's per-minute TPM window.
        # Configurable so operators can tune to their plan's rate limits; the
        # backend timeout must be raised above total chunk latency.
        if i < len(chunks) - 1 and GROQ_CHUNK_SLEEP_SECONDS > 0:
            time.sleep(GROQ_CHUNK_SLEEP_SECONDS)

    if not merged:
        detail = "; ".join(failures) if failures else "no chunks produced output"
        return {
            "answer": None,
            "raw_error": detail,
        }

    if failures:
        return {
            "answer": json.dumps(merged),
            "partial": True,
            "partial_failures": failures,
            "raw_error": None,
        }

    return {
        "answer": json.dumps(merged),
        "raw_error": None,
    }


@app.post("/extract-clauses")
def extract_clauses(body: dict):
    document_id = body.get("documentId")
    text = body.get("extractedText", "")

    if not document_id:
        raise HTTPException(status_code=400, detail="documentId is required")
    if not text:
        raise HTTPException(status_code=400, detail="extractedText is required")

    if not (_api_key_configured(GEMINI_API_KEY) or _api_key_configured(GROQ_API_KEY) or _api_key_configured(NVIDIA_API_KEY)):
        raise HTTPException(status_code=500, detail="API key not configured")

    try:
        user_prompt = f"Policy document text (pages marked --- PAGE N ---):\n\n{text[:120000]}"

        # Use call_llm with extraction=True to get proper fallback chain:
        # Gemini → NVIDIA → Groq
        llm_result = call_llm(
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            extraction=True,
            max_tokens=8192,
            temperature=0.1,
            response_schema=EXTRACTION_SCHEMA,
            response_json=True,
        )

        if llm_result.get("raw_error"):
            raise HTTPException(status_code=502, detail=llm_result['raw_error'])

        raw = llm_result["answer"]

        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0]
            raw = raw.strip()

        extraction = _normalize_extraction(json.loads(raw))

        clauses = _build_clauses(extraction)

        conn = db.get_connection()
        cursor = conn.cursor()
        clause_ids = []
        for clause in clauses:
            cursor.execute(
                """
                INSERT INTO "ExtractedClause" (id, "documentId", "clauseType", "rawText", "pageNumber", "fieldsJson", confidence)
                VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s::jsonb, %s)
                RETURNING id
                """,
                (
                    document_id,
                    clause["clauseType"],
                    clause["rawText"],
                    clause["pageNumber"],
                    json.dumps(clause["fieldsJson"]),
                    clause["confidence"],
                )
            )
            clause_ids.append(cursor.fetchone()[0])
        cursor.close()

        return {
            "documentId": document_id,
            "extraction": extraction,
            "clauses": clauses,
            "clauseIds": clause_ids,
            "partial": bool(llm_result.get("partial")),
            "partialFailures": llm_result.get("partial_failures") or [],
        }

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clause extraction failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
