# PolicyLens — Health Insurance Policy Analyzer

Upload your health insurance policy. PolicyLens reads the fine print your agent didn't explain, tells you what it actually means in rupees, and answers your questions about it — in your language.

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Product Overview](#product-overview)
- [Architecture](#architecture)
- [Feature Map](#feature-map)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Design System](#design-system)
- [Testing](#testing)
- [Key Constraints](#key-constraints)
- [License](#license)

---

## Why This Exists

Indian insurance buyers overwhelmingly purchase policies based on a salesperson's verbal pitch, not the actual policy document. The document itself — dense, legalese-heavy, 20–40 pages — contains the terms that actually govern whether a claim gets paid: waiting periods, room-rent capping, disease-specific sub-limits, co-payment percentages, and permanent exclusions. Most policyholders discover these terms for the first time at the worst possible moment — when a claim is rejected or part-paid.

**PolicyLens solves this** by making the hidden terms visible, quantified, and explainable before purchase, all grounded in the actual document text with traceable source citations.

---

## Product Overview

| Aspect | Detail |
|--------|--------|
| **Category** | InsurTech / AI Document Intelligence |
| **Scope** | Health insurance only (motor, term, life out of scope) |
| **Target User** | Indian health insurance buyers ages 25–55, comfortable with a smartphone |
| **Core Promise** | Upload a policy PDF → get a 0–100 health score, red/green flags with rupee impact, and a chat Q&A grounded in your document |
| **Demo Narrative** | The "salesperson pitch vs. document" mode dramatizes the core problem in real time by highlighting contradictions between what an agent promised and what the policy actually says |

### What It Does

1. **Extracts structured data** from policy PDFs using Gemini (function-calling mode)
2. **Flags risky clauses** via a deterministic rule engine (R01–R13 red flags, G01–G07 green flags)
3. **Quantifies risk in rupees** — converts abstract clauses into concrete cost estimates
4. **Generates a Policy Health Score** (0–100) with a visible per-flag breakdown
5. **Answers questions** about your policy via RAG-grounded chat
6. **Compares policies** side-by-side highlighting materially differing flags
7. **Checks sales pitches** against the actual document for contradictions
8. **Generates shareable report cards** with score, stamps, and top findings
9. **Assists with grievance filing** — editable complaint drafts (never auto-submitted)
10. **Supports voice input** (Web Speech API) with regional-language translation
11. **Tracks renewal changes** — diffs policy versions at renewal time
12. **Browses community clause data** — common clause patterns confirmed by users

---

## Architecture

```
┌─────────────┐       ┌───────────────────┐       ┌──────────────────────┐
│  Frontend    │◄─────►│  Backend (Node)    │◄─────►│  AI Service (Python)  │
│  React/Vite  │       │  Express API       │       │  FastAPI              │
│  Tailwind    │       │  Auth, routing,    │       │  Extraction, RAG,    │
│  framer-motion│      │  orchestration     │       │  chat generation      │
└──────────────┘       └────────┬───────────┘       └──────────┬───────────┘
                                │                               │
                      ┌─────────▼──────────┐         ┌──────────▼──────────┐
                      │  PostgreSQL          │         │  Gemini API          │
                      │  (Prisma ORM)        │         │  (OpenRouter)        │
                      │  + pgvector          │         └─────────────────────┘
                      └──────────────────────┘
```

**Why this split:** The Node backend owns auth, request orchestration, and talking to Postgres. The Python/FastAPI service owns everything Gemini-facing (extraction, RAG, generation) so LLM logic stays isolated and testable independent of the web API layer. The Node backend calls the AI service over HTTP; the frontend never calls the AI service directly.

### Data Flow

1. **Upload** → `POST /api/documents` → file saved → document row created (`status: uploaded`)
2. **Extraction** → AI service extracts raw text → Gemini structured extraction (function-calling JSON schema) → Node writes `ExtractedClause` rows → `status: extracted`
3. **Flagging (deterministic)** → Node runs extracted data through the rule-matching engine against `data/taxonomy.json` → writes `Flag` rows → `status: flagged`
4. **Explanation** → AI service fills plain-language templates with extracted values → stored on the flag row
5. **Scoring** → Deterministic `calculateScore()` reads all flags + settlement ratio → writes `PolicyHealthScore` row → `status: scored`
6. **Embedding** → AI service chunks text → generates embeddings → stores in `DocumentChunk` (pgvector) → `status: ready`
7. **Chat** → `POST /api/documents/:id/chat` → AI service retrieves top-k chunks → Gemini answers grounded in retrieved context only → response includes clause citation or explicit "not found in document" flag

---

## Feature Map

### Core Analysis

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Clause extraction & flagging | PDF → structured clauses → red/green classification via deterministic rules | `backend/src/flag-engine/` + `ai-service/app/main.py` |
| Hidden terms detector | Hunts clauses that narrow headline coverage | Built into flag rules R02, R07, R08 |
| Cross-policy comparison | Side-by-side table of materially differing flags | `backend/src/routes/documents.ts` (`POST /compare`) |
| IRDAI reputation layer | Displays claim settlement ratio per insurer | `data/settlement_ratios.json` (static dataset) |
| RAG chat | Document-grounded Q&A with source citations | `ai-service/app/retrieval.py` + `backend/src/routes/chat.ts` |

### Quantification

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Rupee-at-risk calculator | Converts clauses to concrete cost estimates | `backend/src/flag-engine/rupee-at-risk.ts` |
| Policy Health Score | 0–100 composite score with per-flag breakdown | `backend/src/flag-engine/score.ts` |
| Scenario simulator | Walks through real-world scenarios and payout impact | `backend/src/scenario-simulator/` |

### Accessibility & Reach

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Voice input + translation | Web Speech API → OpenRouter Gemini translation | `frontend/src/components/VoiceInput.jsx` + `backend/src/translate/` |
| Explain like I'm new | Pattern-based sentence simplification | `backend/src/explain-simplify/` (18 rewrite rules) |
| WhatsApp bot | Deferred (requires Cloud API sandbox) | — |

### Trust & Distribution

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Report card | Printable score card with stamps + WhatsApp share | `backend/src/report-card/` + `frontend/src/components/ReportCard.jsx` |
| Renewal watch | Diffs policy versions at renewal | `backend/src/renewal-watch/` (mock data) |
| Community clause database | Seed clause table with confirmed-by-N UI | `backend/src/data/community-clauses.ts` |

### Demo-Critical

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Sales pitch vs. document | Highlights contradictions between verbal promises and policy text | `backend/src/pitch-compare/` (deterministic pattern matching) |
| Grievance filing assist | Editable complaint draft (never auto-submitted) | `backend/src/grievance/` + `frontend/src/components/GrievanceAssist.jsx` |

---

## Tech Stack

### Frontend (`frontend/`)
- **Framework:** React 19 + Vite 8
- **Styling:** Tailwind CSS 4 + custom design tokens
- **Animation:** framer-motion 12
- **Build:** Vite 8 (esbuild transpiler)
- **Lint:** oxlint

### Backend (`backend/`)
- **Runtime:** Node.js + Express 5
- **Language:** TypeScript 7
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Prisma 7
- **Test:** Vitest 4

### AI Service (`ai-service/`)
- **Runtime:** Python 3.13 + FastAPI
- **LLM:** Gemini Flash 1.5 via OpenRouter
- **PDF:** pdfplumber
- **Server:** uvicorn

### Infrastructure
- **Database:** pgvector/pgvector:pg16 (Docker)
- **Environment:** dotenv (.env configuration)

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.13+
- Docker Desktop (for PostgreSQL)
- A Gemini API key via OpenRouter (free tier available at https://openrouter.ai)

### 1. Clone & Install

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# AI Service
cd ../ai-service
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

### 2. Start PostgreSQL

```bash
cd ..
docker compose up -d
# Runs pgvector/pgvector:pg16 on port 5432
```

### 3. Configure Environment

Edit `.env` in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/policylens?schema=public"
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
PORT=3000
```

### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
```

### 5. Start All Services

```bash
# Terminal 1 — AI Service
cd ai-service
venv\Scripts\activate
uvicorn app.main:app --port 8001 --reload

# Terminal 2 — Backend
cd backend
npm run dev

# Terminal 3 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

---

## Project Structure

```
PolicyLens/
├── AGENTS.md                    # Build guardrails for AI coding agents
├── .env                         # Environment configuration
├── docker-compose.yml           # PostgreSQL + pgvector
├── taxonomy.md                  # Red/green flag rule specifications (R01–R13, G01–G07)
├── PRD.md                       # Product requirements document
├── IMPLEMENTATION_PLAN.md       # Build sequence and phase gates
├── design.md                    # Design doc (visual identity + interaction spec)
├── architecture.md              # System design, schema, data flow
│
├── data/                        # Static reference datasets
│   ├── taxonomy.json            # Machine-readable flag rules
│   └── settlement_ratios.json   # IRDAI claim settlement ratios by insurer
│
├── frontend/                    # React + Vite + Tailwind + framer-motion
│   └── src/
│       ├── App.jsx              # Main app (3-column layout)
│       ├── index.css            # Tailwind theme + premium utility classes
│       ├── components/
│       │   ├── ScoreCard.jsx    # Animated gauge, strength badge, digit roll
│       │   ├── FlagCard.jsx     # Expandable flag cards with framer-motion
│       │   ├── ChatPanel.jsx    # RAG chat with grounded/ungrounded badges
│       │   ├── UploadZone.jsx   # 6-state drag/drop zone
│       │   ├── ProcessingOverlay.jsx  # 5-stage progress with skeletons
│       │   ├── ReportCard.jsx   # Printable shareable score card
│       │   ├── PitchCompare.jsx # Sales pitch contradiction checker
│       │   ├── ScenarioSimulator.jsx  # Real-world scenario walkthroughs
│       │   ├── ComparisonView.jsx     # Side-by-side policy comparison
│       │   ├── VoiceInput.jsx   # Web Speech API + translation
│       │   ├── GrievanceAssist.jsx    # Editable complaint draft generator
│       │   ├── RenewalWatch.jsx # Renewal version diff
│       │   └── CommunityClauses.jsx   # Community clause database browser
│       └── components/ui/
│           ├── VerificationStamp.tsx   # Stamp icon (dashed for low confidence)
│           ├── SeverityBadge.tsx       # Severity pill indicator
│           ├── RupeeDisplay.tsx        # Indian-format currency display
│           └── LanguageToggle.tsx      # Hindi/English language switch
│
├── backend/                     # Node/Express + Prisma + TypeScript
│   └── src/
│       ├── index.ts             # Express server, route mounting
│       ├── flag-engine/         # Deterministic rule engine (zero LLM calls)
│       │   ├── index.ts         # matchFlags() — rule matching
│       │   ├── rupee-at-risk.ts # Out-of-pocket cost calculator
│       │   ├── score.ts         # Policy Health Score calculator
│       │   └── insurer-matcher.ts  # Fuzzy insurer name matching
│       ├── pitch-compare/       # Deterministic contradiction detection
│       ├── explain-simplify/    # 18 pattern-based sentence rewrite rules
│       ├── report-card/         # Score card generator with 8 stamp types
│       ├── grievance/           # Template-based grievance draft generator
│       ├── renewal-watch/       # Mock policy version diff engine
│       ├── scenario-simulator/  # 5 real-world scenario walkthroughs
│       ├── translate/           # OpenRouter Gemini translation (9 languages)
│       ├── data/                # Community clauses seed data
│       └── routes/              # Express route handlers
│
├── ai-service/                  # Python/FastAPI — Gemini-facing
│   └── app/
│       ├── main.py              # FastAPI server, extraction, chat endpoints
│       ├── extraction_schema.py # Gemini function-calling JSON schema
│       ├── retrieval.py         # RAG chunk retrieval
│       └── db.py                # Database helpers
│
└── samples/                     # Sample health insurance PDFs for testing
```

---

## API Reference

### Backend (Node/Express — port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents` | Upload a policy PDF |
| `POST` | `/api/documents/:id/chat` | Ask a question about a document |
| `POST` | `/api/documents/:id/simulate/:scenarioId` | Run a scenario simulation |
| `POST` | `/api/documents/compare` | Compare multiple policies |
| `POST` | `/api/pitch-compare` | Check sales pitch against document |
| `GET` | `/api/report-card/:documentId` | Get shareable report card |
| `POST` | `/api/explain-simplify` | Simplify insurance text |
| `POST` | `/api/translate` | Translate text to regional language |
| `POST` | `/api/grievance-draft` | Generate a grievance complaint draft |
| `GET` | `/api/renewal-watch/:id` | Get renewal version comparison |
| `GET` | `/api/community-clauses` | List community clause database |
| `GET` | `/health` | Health check |

### AI Service (Python/FastAPI — port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/extract` | Extract structured data from PDF text |
| `POST` | `/chat` | RAG-grounded chat answer |
| `POST` | `/explain` | Generate plain-language explanation |
| `POST` | `/translate` | Translate text via OpenRouter Gemini |
| `GET` | `/health` | Health check |

---

## Design System

### Visual Identity

PolicyLens draws its visual language from **Indian financial document culture** — LIC policy bonds, bank passbooks, rubber ink-stamps, manila file folders — rather than generic SaaS/startup templates.

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `ledger-paper` | `#FAF6EC` | Page background — warm off-white of bank passbook paper |
| `kraft` | `#E4D8B4` | Secondary surfaces, card backgrounds, section dividers |
| `ledger-indigo` | `#1E3A5F` | Primary brand/action color — deep navy of LIC bond covers |
| `sindoor` | `#C1392B` | Red flags, critical alerts — vermillion red |
| `turmeric` | `#C68A1F` | Medium-severity/caution — warm turmeric gold |
| `neem` | `#42663B` | Green/favorable flags — deep neem-leaf green |

### Typography

| Role | Latin | Devanagari |
|------|-------|------------|
| Display/Headline | Noto Serif | Noto Serif Devanagari |
| Body/UI | Noto Sans | Noto Sans Devanagari |
| Data/Mono | JetBrains Mono | — |

Rupee amounts use **Indian digit grouping** (`₹1,00,000` not `₹100,000`).

### Layout

3-column desktop layout (5-part grid):
- **Left (1/5):** Score card + Document info + Report Card + Voice Input (sticky)
- **Center (3/5):** Flags + Pitch Compare + Scenario Simulator + Comparison + Grievance + Renewal + Community Clauses
- **Right (1/5):** Chat panel (sticky)

---

## Testing

```bash
# Run all backend tests
cd backend
npx vitest run

# Expected output: 11 files passed, 137 tests passed
```

### Test Coverage by Module

| Module | Test File | Tests |
|--------|-----------|-------|
| Flag Engine | `flag-engine.test.ts` | 44 |
| Rupee-at-Risk | `rupee-at-risk.test.ts` | 8 |
| Score | `score.test.ts` | 18 |
| Scenarios | `scenarios.test.ts` | 12 |
| Pitch Compare | `pitch-compare.test.ts` | 10 |
| Report Card | `report-card.test.ts` | 11 |
| Explain Simplify | `explain-simplify.test.ts` | 18 |
| Grievance | `grievance.test.ts` | 4 |
| Renewal Watch | `renewal-watch.test.ts` | 4 |
| Community Clauses | `community-clauses.test.ts` | 5 |
| Translate | `translate.test.ts` | 3 |

### Verification Discipline

Per `AGENTS.md` §3:
- Raw terminal output required as proof of completion — no prose summaries
- Reproduce bugs before fixing them
- Git commit at every phase gate
- Any Gemini call failure is a hard failure state in the UI — never silently defaulted

---

## Key Constraints

These are **hard rules** — violating them breaks the product's core trust promise:

1. **No LLM decides red/green classification.** Classification is a deterministic rule match against `data/taxonomy.json`. The LLM only extracts structured field values from PDF text.

2. **No fabricated numbers.** Rupee-at-risk figures, settlement ratios, and score components must trace to either (a) values extracted from the uploaded document or (b) the static IRDAI reference dataset. Never have the LLM estimate or "fill in" plausible-sounding figures.

3. **No financial, legal, or insurance advice.** The chat, flag explanations, and scenario simulator explain what a clause means and what it could cost — they never tell the user what to do.

4. **Every flag must carry a traceable source citation.** A flag with no retrievable source is a bug.

5. **Chat answers must be grounded strictly in the uploaded document via RAG.** If retrieved context doesn't support an answer, the system says so explicitly.

6. **Never auto-submit grievance drafts.** They are always editable, user-reviewed drafts for download/copy — never sent by the system.

7. **No silent failures on AI calls.** If a Gemini extraction or chat call errors, times out, or returns malformed output, the UI must show an explicit error/retry state.

---

## License

Built for the hackathon. Not for production use without completing security review, database hardening, and IRDAI compliance assessment.