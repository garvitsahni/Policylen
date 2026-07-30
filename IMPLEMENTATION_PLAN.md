# PolicyLens — Implementation Plan (Execution Version)

This expands `docs/architecture.md` (system design) and the original phase outline into
a checklist an AI coding agent can execute directly, phase by phase, without inventing
structure mid-build. It assumes the agent has already read `SKILL.md` and `AGENTS.md`.

**Do not skip the verification gates.** Each gate requires raw terminal/log output, not
a prose summary. If a gate fails, fix it before starting the next phase.

---

## Repo Scaffold (create this exact structure in Phase 0)

```
policylens/
├── AGENTS.md                      # guardrails — agent reads this first, always
├── SKILL.md                       # build skill — see below
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── design.md
│   ├── taxonomy.md
│   └── ui-prompt.md
├── data/
│   ├── taxonomy.json              # machine-readable flag rules — the flag engine reads THIS, not taxonomy.md
│   └── settlement_ratios.json     # static IRDAI reference dataset
├── frontend/                      # React + Vite + Tailwind
│   └── (scaffolded via `npm create vite@latest`)
├── backend/                       # Node/Express — auth, orchestration, Postgres
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── flag-engine/           # deterministic module — see below, unit-tested in isolation
│   │   └── prisma/
│   │       └── schema.prisma
│   └── package.json
├── ai-service/                    # Python/FastAPI — Gemini-facing only
│   ├── app/
│   │   ├── main.py
│   │   ├── extract.py
│   │   ├── embed.py
│   │   ├── chat.py
│   │   └── pitch_compare.py
│   └── requirements.txt
├── samples/                       # 2–3 sample policy PDFs for testing (Phase 0)
├── .env.example
└── README.md
```

**Flag engine placement:** per `docs/architecture.md` §6, this is ONE implementation,
not duplicated in both Node and Python. Recommended: keep it in
`backend/src/flag-engine/` since it's pure deterministic logic with no LLM calls, and
Node already owns orchestration. It reads `data/taxonomy.json` directly.

---

## Phase 0 — Setup (Hour 0–2)

- [ ] Scaffold the repo tree above
- [ ] `frontend`: `npm create vite@latest frontend -- --template react`, add Tailwind
- [ ] `backend`: `npm init`, install `express`, `prisma`, `@prisma/client`, `multer` (file upload), `dotenv`
- [ ] `ai-service`: Python venv, install `fastapi`, `uvicorn`, `google-genai` (or current Gemini SDK), `pypdf`/`pdfplumber`, `psycopg2`/`asyncpg` if writing directly, `pgvector` client
- [ ] Copy `data/taxonomy.json` and `data/settlement_ratios.json` into the repo (already provided — do not re-derive from `docs/taxonomy.md` at runtime)
- [ ] `.env` from `.env.example`: `GEMINI_API_KEY`, `DATABASE_URL`
- [ ] Initialize Postgres + `pgvector` extension (`CREATE EXTENSION IF NOT EXISTS vector;`)
- [ ] `prisma init`, paste schema from `docs/architecture.md` §3, `prisma migrate dev`
- [ ] Acquire 2–3 real, publicly available sample health insurance policy wordings (PDF) from insurer websites → `samples/`

**Verification gate:** `POST /api/documents` with a sample PDF returns raw extracted
text in the response body. Show the actual curl output, not a description of it.

---

## Phase 1 — Core Extraction Pipeline (Hour 2–8)

- [ ] PDF → text (digital-text only; detect and reject scanned/image-only PDFs per `docs/design.md` upload-flow spec)
- [ ] `ai-service` `POST /extract`: Gemini function-calling call against a fixed JSON schema — `sum_insured`, `waiting_periods[]`, `sub_limits[]`, `exclusions[]`, `co_pay`, `room_rent_clause`, `claim_process[]`, each field carrying a per-field `confidence: high|medium|low`
- [ ] Node persists `ExtractedClause` rows per `docs/architecture.md` §3 schema
- [ ] Document status transitions: `uploaded → extracting → extracted`

**Verification gate:** Run extraction against all sample PDFs. Show raw JSON output for
each (not paraphrased). Manually spot-check one sub-limit and one exclusion against the
literal PDF text.

---

## Phase 2 — Flag Engine + Rupee-at-Risk (Hour 8–14)

- [ ] Build `matchFlags(extractedClauses)` in `backend/src/flag-engine/` reading `data/taxonomy.json` — pure function, zero LLM calls, zero network calls
- [ ] Unit test file with **one positive and one negative case per rule** (R01–R13, G01–G07 = minimum 40 test cases)
- [ ] `POST /generate-explanation` (ai-service): fills the taxonomy template with extracted values — templated, not freeform generation
- [ ] Rupee-at-risk calculator: pure function, given `sum_insured` + relevant cap/sub-limit + a stated scenario cost, computes out-of-pocket exposure; returns `null` (never a guessed number) if the document doesn't state a required value
- [ ] Every `Flag` row stores `sourceExcerpt` traceable to `ExtractedClause.rawText`

**Verification gate:** `npm test` (or `pytest`) output showing all taxonomy rule tests
passing. For a red flag rendered in the UI, click through and confirm the source clause
text displays — screenshot or DOM output, not a claim it works.

---

## Phase 3 — Policy Health Score + Reviews Layer (Hour 14–18)

- [ ] `calculateScore(flags, settlementRatio)` per `docs/architecture.md` §7 — deterministic, settlement ratio displayed alongside, never blended into the numeric score
- [ ] Load `data/settlement_ratios.json`, fuzzy-match `Document.insurerName` against `insurerName` (strip legal suffixes, case-fold) — no match → `settlementRatio: null`, UI shows "reference data not available," never a guessed/averaged figure presented as insurer-specific
- [ ] Score rendered with visible breakdown (per-flag contribution), never a bare number

**Verification gate:** For 2 sample policies, show the score breakdown JSON summing
correctly to the displayed score.

---

## Phase 4 — Chat / RAG Q&A (Hour 18–24)

- [ ] `POST /embed` (ai-service): chunk extracted text, embed, store in `DocumentChunk` (pgvector)
- [ ] `POST /chat`: retrieve top-k chunks → Gemini answers grounded ONLY in retrieved context → `groundedInDocument: true/false` + `citedClauseId` where applicable
- [ ] Ungrounded/insufficient-context answers must return the explicit fallback, never a general-knowledge answer presented as document-sourced

**Verification gate:** Ask 5+ questions per sample policy including at least one the
document does not answer. Show raw chat responses confirming the "not found in your
policy" fallback actually fires for that one.

---

## Phase 5 — Scenario Simulator + Comparison (Hour 24–28)

- [ ] 4–5 hardcoded scenarios (hospitalization, named surgery, PED claim, maternity) mapped against extracted clause data → narrative walkthrough, not just a number
- [ ] `POST /api/documents/compare`: run pipeline on 2nd/3rd document, table restricted to *materially differing* flags (identical rows visually de-emphasized per `docs/design.md`)

---

## Phase 6 — Demo-Critical Differentiators (Hour 28–32)

Priority order if time is short:
1. [ ] Salesperson pitch vs. document mode (`POST /pitch-compare`) — text input, LLM contradiction highlighting against extracted structured data (still cites source clause per hard rule)
2. [ ] Shareable report card (`GET /report-card`) — image/PDF, score + top 3 flags + stamps, WhatsApp-green share button as primary action
3. [ ] "Explain like I'm new to insurance" toggle — simplification pass on existing explanation text

---

## Phase 7 — Reach Features (Hour 32–35, stretch)

- [ ] WhatsApp bot front-end (only if Cloud API sandbox already provisioned — otherwise defer)
- [ ] Voice input (Web Speech API) + regional-language output (Gemini translation)
- [ ] Grievance-filing assist — template-based draft, never auto-submitted anywhere
- [ ] Renewal watch — demo with two mock versions of one sample policy
- [ ] Community clause database — static seed table with "confirmed by N users" UI treatment only

---

## Phase 8 — Polish & Demo Rehearsal (Hour 35–36)

- [ ] Run the full accessibility/state-coverage self-critique checklist from `docs/design.md` Part 2 against the *running app*, not a mockup
- [ ] Rehearse: upload → processing → dashboard → rupee-at-risk moment → live chat question → pitch-vs-document contrast → score + grievance-assist close
- [ ] Regression check: all sample PDFs still work end-to-end after final commits

---

## Verification Discipline (applies throughout — see `AGENTS.md` §3)

- Raw terminal/log output only, at every gate — no prose summaries accepted as proof.
- Reproduce a bug before fixing it; show the fix resolving the reproduced case.
- Git commit at every phase gate so any phase is independently revertible.
- Any Gemini call failure is a hard failure state in the UI — never silently defaulted or mislabeled as a valid result.
