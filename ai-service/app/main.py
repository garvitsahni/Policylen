from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
import json
import os
import requests

from . import retrieval, db

app = FastAPI(title="PolicyLens AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TAXONOMY_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'taxonomy.json')
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")

def load_taxonomy():
    with open(TAXONOMY_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def call_groq(system_prompt: str, user_prompt: str, model: str = None, max_tokens: int = 1024, temperature: float = 0.1, response_json: bool = False) -> dict:
    if not GROQ_API_KEY or GROQ_API_KEY == "your-groq-api-key-here":
        return {
            "answer": None,
            "grounded": False,
            "cited_clause_id": None,
            "raw_error": "API key not configured"
        }

    payload = {
        "model": model or GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if response_json:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(
        url="https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=60
    )

    if response.status_code != 200:
        return {
            "answer": None,
            "grounded": False,
            "cited_clause_id": None,
            "raw_error": f"Groq error {response.status_code}: {response.text[:200]}"
        }

    data = response.json()
    answer = data["choices"][0]["message"]["content"].strip()
    return {"answer": answer, "grounded": False, "cited_clause_id": None, "raw_error": None}

PAGE_MARKER_PATTERN = "--- PAGE"

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()

    try:
        text_parts = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- PAGE {i+1} ---\n{page_text}")

        full_text = "\n\n".join(text_parts)

        if not full_text.strip():
            raise HTTPException(
                status_code=400,
                detail="This looks like a scanned document — PolicyLens currently reads digital PDFs only"
            )

        return {
            "extractedText": full_text,
            "pageCount": len(pdf.pages) if 'pdf' in locals() else 0,
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
async def chat(body: dict):
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

        groq_result = call_groq(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=GROQ_CHAT_MODEL,
            max_tokens=1024,
        )
        db.store_chat_message(document_id, "user", question, grounded_in_document=False)

        if groq_result.get("raw_error"):
            fallback = "I'm sorry, I couldn't process this question right now."
            if "API key not configured" in groq_result["raw_error"]:
                fallback = "Chat is not configured yet. Please set up your API key to use this feature."
            db.store_chat_message(document_id, "assistant", fallback, grounded_in_document=False)
            return {
                "answer": fallback,
                "groundedInDocument": False,
                "citedClauseId": None,
                "error": groq_result["raw_error"]
            }

        answer = groq_result["answer"]

        # Determine grounding based on whether the answer contains the fallback phrase
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

EXTRACTION_SYSTEM_PROMPT = """You are an expert insurance analyst. Extract structured data from the health insurance policy document below.

Return ONLY a JSON object (no markdown, no explanation) with these fields:

{
  "insurer_name": "string or null",
  "sum_insured": "number or null (overall sum insured in rupees)",

  "room_rent_clause": {
    "cap_type": "percentage_of_sum_insured | fixed_amount_per_day | no_cap | null",
    "cap_value": "number or null (percentage or amount)",
    "has_proportionate_deduction": "boolean or null, true if choosing a higher room reduces the claim proportionately"
  },

  "co_pay": {
    "percentage": "number or null (co-pay percentage, e.g. 20 means 20%)",
    "explicitly_absent": "boolean or null, true if document explicitly says no co-payment",
    "age_linked": "boolean or null",
    "age_threshold": "number or null"
  },

  "ped_waiting_period_months": "number or null (pre-existing disease waiting period in months)",
  "ped_explicitly_stated": "boolean or null (true if PED waiting period is explicitly mentioned)",
  "initial_waiting_days": "number or null (initial 30-day waiting period in days)",

  "waiting_periods": [
    {
      "condition": "string",
      "period_months": "number",
      "period_type": "ped | specific_disease | initial",
      "source_excerpt": "verbatim text from document"
    }
  ],

  "sub_limits": [
    {
      "procedure": "string (procedure or condition name)",
      "cap_value": "number (max payable in rupees)",
      "cap_type": "fixed_amount | percentage",
      "source_excerpt": "verbatim text from document"
    }
  ],

  "exclusions": [
    {
      "condition": "string",
      "is_permanent": "boolean",
      "source_excerpt": "verbatim text from document"
    }
  ],

  "claim_process": [
    {
      "step_name": "string (e.g., intimation, cashless, reimbursement)",
      "timeframe_hours": "number or null (intimation deadline in hours)",
      "source_excerpt": "string or null"
    }
  ],

  "non_disclosure_clause_present": "boolean (true if policy has a clause about misrepresentation/non-disclosure)",
  "non_disclosure_scope": "string or null ('broad_any_non_disclosure' if ANY misrepresentation voids policy, or 'material' if only material facts)",

  "restoration_benefit": {
    "present": "boolean (true if sum insured is restored after exhaustion)"
  },

  "cumulative_bonus": {
    "present": "boolean (true if no-claim bonus / cumulative bonus exists)"
  },

  "network_clause": {
    "cashless_default": "boolean or null (true if cashless is default mode)",
    "network_size_stated": "boolean or null (true if number of network hospitals is stated)",
    "non_network_payout_reduced": "boolean or null (true if non-network payout is lower)"
  },

  "renewal_clause": {
    "claims_based_loading": "boolean or null (true if premium loading based on claims)",
    "guaranteed_renewal": "boolean or null (false if renewal is not guaranteed)"
  },

  "no_sub_limits_statement_present": "boolean (true if document says there are no sub-limits)",

  "discretionary_language_excerpt": "string or null (exact phrase if policy uses 'sole discretion', 'as determined by', etc.)",

  "overall_confidence": "high | medium | low"
}

Extract values carefully from the text. Use null when a field is not mentioned in the document. For source_excerpt fields within arrays, copy the exact sentence from the document."""


@app.post("/extract-clauses")
async def extract_clauses(body: dict):
    document_id = body.get("documentId")
    text = body.get("extractedText", "")

    if not document_id:
        raise HTTPException(status_code=400, detail="documentId is required")
    if not text:
        raise HTTPException(status_code=400, detail="extractedText is required")

    if not GROQ_API_KEY or GROQ_API_KEY == "your-groq-api-key-here":
        raise HTTPException(status_code=500, detail="API key not configured")

    try:
        truncated = text[:30000] if len(text) > 30000 else text
        user_prompt = f"Policy document text:\n\n{truncated}"

        groq_result = call_groq(
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
            response_json=True,
        )

        if groq_result.get("raw_error"):
            raise HTTPException(status_code=502, detail=f"AI extraction failed: {groq_result['raw_error']}")

        raw = groq_result["answer"]

        # Clean markdown code fence if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0]
            raw = raw.strip()

        extraction = json.loads(raw)

        # Build clauses from the extraction
        clauses = []
        clause_definitions = [
            ("room_rent", ["room_rent_clause"]),
            ("co_pay", ["co_pay"]),
            ("waiting_periods", ["ped_waiting_period_months", "ped_explicitly_stated", "initial_waiting_days", "waiting_periods"]),
            ("sub_limits_exclusions", ["sub_limits", "exclusions", "no_sub_limits_statement_present"]),
            ("claim_process", ["claim_process"]),
            ("disclosure", ["non_disclosure_clause_present", "non_disclosure_scope", "discretionary_language_excerpt"]),
            ("benefits", ["restoration_benefit", "cumulative_bonus"]),
            ("network", ["network_clause"]),
            ("renewal", ["renewal_clause"]),
        ]

        for clause_type, fields in clause_definitions:
            clause_json = {}
            for f in fields:
                if f in extraction:
                    clause_json[f] = extraction[f]

            clauses.append({
                "clauseType": clause_type,
                "rawText": "",
                "pageNumber": None,
                "fieldsJson": clause_json,
                "confidence": extraction.get("overall_confidence", "medium"),
            })

        top_level_fields = ["insurer_name", "sum_insured"]
        global_clause_json = {}
        for f in top_level_fields:
            if f in extraction:
                global_clause_json[f] = extraction[f]
        if global_clause_json:
            clauses.insert(0, {
                "clauseType": "policy_overview",
                "rawText": "",
                "pageNumber": None,
                "fieldsJson": global_clause_json,
                "confidence": extraction.get("overall_confidence", "medium"),
            })

        # Store clauses in DB
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