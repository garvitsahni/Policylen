# PolicyLens — Implementation Plan

**Build mode:** AI coding agent (OpenCode / Antigravity / equivalent) with human oversight via raw terminal output verification — no summarized agent reports accepted as proof of completion.
**Target:** Full 16-feature scope, sequenced so a working, demo-able core exists after every phase.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS | Fast iteration, matches your existing stack pattern |
| Backend | Node.js/Express | API orchestration, matches AutoRecruit-Validator pattern |
| AI service | Python/FastAPI | Extraction, flagging, RAG — isolated from the Node API layer |
| LLM | Google Gemini (structured/function-calling output) | Reuse of your Nyaay AI / AutoRecruit-Validator integration pattern |
| Database | PostgreSQL + Prisma | Structured storage for extracted clauses, flags, scores, chat history |
| Vector store | pgvector (or in-memory FAISS if time-constrained) | RAG over the uploaded document for the chat feature |
| File storage | Local disk (hackathon) → S3-compatible (post-hackathon) | Policy PDFs and generated report cards |
| WhatsApp integration | WhatsApp Cloud API (Meta) or Twilio WhatsApp API | Feature 11 |
| Voice | Web Speech API (browser-native) for input; Gemini/TTS for regional-language output | Feature 9 — avoid heavy infra, browser API is enough for a demo |

## Guiding Principle: Deterministic Where It Matters

Mirror the AutoRecruit-Validator lesson: **flag classification (red/green) must be deterministic and rule-driven against the taxonomy, not a free-floating LLM score.** The LLM's job is *extraction* (pulling structured clause data out of unstructured PDF text) and *language* (writing the plain-English explanation). The *decision* of whether a clause is red or green is made by matching extracted clause data against the hardcoded taxonomy rules in `03_RED_GREEN_FLAG_TAXONOMY.md`. This avoids the exact failure mode already identified in AutoRecruit-Validator: never let the model silently generate a verdict/score outside a deterministic engine.

---

## Phase 0 — Setup (Hour 0–2)

- Repo scaffold: `/frontend`, `/backend`, `/ai-service`, `/docs`
- Environment: Gemini API key, Postgres instance (local or hosted), Prisma schema init
- Load `AGENTS.md` and `03_RED_GREEN_FLAG_TAXONOMY.md` into the coding agent's context before any feature work begins
- Acquire 2–3 sample health insurance policy PDFs (public sample policy wordings from insurer websites) for testing throughout

**Verification gate:** Agent must show a running "hello world" round trip — PDF upload endpoint returns raw extracted text — before proceeding. Confirm via raw terminal output, not agent summary.

## Phase 1 — Core Extraction Pipeline (Hour 2–8)

- PDF upload → text extraction (digital PDF only; no OCR)
- Gemini structured extraction call: policy text → JSON schema (`sum_insured`, `waiting_periods[]`, `sub_limits[]`, `exclusions[]`, `co_pay`, `room_rent_clause`, `claim_process[]`)
- Store extracted structured data in Postgres against the uploaded document ID
- **Feature delivered:** 1 (extraction half), foundation for 2, 6, 7

**Verification gate:** Run extraction against all 2–3 sample PDFs. Agent must reproduce and show the raw JSON output for each, not a paraphrase. Spot-check at least one sub-limit and one exclusion manually against the source PDF text.

## Phase 2 — Flag Engine + Rupee-at-Risk (Hour 8–14)

- Deterministic rule engine: match extracted clause data against taxonomy → red/green classification
- Plain-language explanation generation (LLM call, constrained to the specific flagged clause + taxonomy template — not freeform)
- Rupee-at-risk calculator: given sum insured + relevant sub-limit/cap clause, compute concrete out-of-pocket exposure for a stated scenario amount
- **Feature delivered:** 1 (complete), 2, 6

**Verification gate:** For each red flag shown in the UI, the underlying source clause text must be retrievable and displayed. Agent must demonstrate this end-to-end, not just claim it works.

## Phase 3 — Policy Health Score + Reviews Layer (Hour 14–18)

- Composite scoring formula: weighted combination of flag severity counts + static IRDAI settlement ratio lookup
- Hardcode IRDAI settlement ratio table for 5–8 major health insurers
- Score displayed as hero visual (0–100, with a short rationale breakdown, never a bare number with no explanation)
- **Feature delivered:** 4, 7

## Phase 4 — Chat / RAG Q&A (Hour 18–24)

- Chunk + embed the uploaded document; store vectors
- Chat endpoint: user question → retrieve relevant chunks → Gemini answer grounded in retrieved text only, with clause citation
- Guardrail: if the question can't be answered from the document, the system says so explicitly rather than answering from general knowledge
- **Feature delivered:** 5

**Verification gate:** Ask at least 5 test questions per sample policy, including one the document doesn't answer. Confirm the "I can't find this in your policy" fallback actually fires — via raw output, not agent claim.

## Phase 5 — Scenario Simulator + Comparison (Hour 24–28)

- Scenario simulator: 4–5 pre-built scenarios (hospitalization, specific surgery, pre-existing condition claim, maternity) mapped against extracted clause data to project actual payout vs. claimed cover
- Cross-policy comparison: upload second/third document, run same pipeline, render side-by-side table restricted to material flags
- **Feature delivered:** 3, 8

## Phase 6 — Demo-Critical Differentiators (Hour 28–32)

Prioritize in this order if time is short — these are the features that make the hackathon pitch land:

1. **Salesperson pitch vs. document mode** (Feature 15) — text input for the verbal pitch, LLM comparison against extracted structured data, highlighted contradictions
2. **Shareable report card** (Feature 12) — auto-generated image/PDF summary of top flags + score, using the same rendering pipeline you used for BillionBrains-style static output
3. **"Explain like I'm new" toggle** (Feature 10) — cheap to build, high perceived polish

## Phase 7 — Reach Features (Hour 32–35, if time allows)

These are genuinely valuable but time-expensive; treat as stretch, not baseline:

- WhatsApp bot front-end (Feature 11) — only if the Cloud API sandbox is already set up; otherwise defer
- Voice input + regional language (Feature 9) — Web Speech API input, Gemini translation on output
- Grievance-filing assist (Feature 16) — template-based, low LLM dependency, fast to add
- Renewal watch / clause-change tracker (Feature 13) — needs two document versions; demo with two mock versions of the same policy
- Community clause database (Feature 14) — for hackathon, a static seed table with a "this flag was confirmed by N users" UI treatment is enough; live crowdsourcing infra is out of scope for 36 hours

## Phase 8 — Polish & Demo Rehearsal (Hour 35–36)

- Run the full godlike-UI-UX self-critique pass (see `04_DESIGN_DOC.md`) against the actual running app, not the mockup
- Rehearse the demo script: upload → 30s processing → flag dashboard → rupee-at-risk moment → chat question live → pitch-vs-document contrast → score + grievance-assist close
- Confirm all sample PDFs still work end-to-end after final commits (regression check)

---

## Verification Discipline Throughout

Applying your established AutoRecruit-Validator workflow to this build:

- Demand raw terminal/log output from the coding agent at every phase gate — never accept a prose summary as proof a feature works.
- Before accepting a bug fix, require the agent to first reproduce the failing case, then show the fix resolving it.
- Use git checkpoints after each phase so any phase can be rolled back without losing prior working state.
- Treat any Gemini call that silently fails or errors as a hard failure state in the UI, never mislabel it as a valid result (this was the exact bug class found in AutoRecruit-Validator's Gemini integration — do not reintroduce it here).
