# PolicyLens — Architecture

Companion to `PRD.md`, `phases.md`, `design.md`, and `rules.md`. This document defines the system's components, data flow, schema, and API surface so an AI coding agent can implement without inventing structure mid-build.

---

## 1. System Overview

```
┌────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│  Frontend   │◄────►│  Backend (Node)   │◄────►│  AI Service (Python)  │
│  React/Vite │      │  Express API      │      │  FastAPI              │
│  Tailwind   │      │  Auth, routing,   │      │  Extraction, flagging,│
│             │      │  orchestration    │      │  scoring, RAG chat    │
└────────────┘      └─────────┬─────────┘      └───────────┬───────────┘
                               │                             │
                     ┌─────────▼─────────┐        ┌──────────▼──────────┐
                     │  PostgreSQL        │        │  Gemini API          │
                     │  (Prisma ORM)      │        │  (extraction, chat,  │
                     │  + pgvector        │        │   plain-language gen)│
                     └─────────────────────┘        └──────────────────────┘
```

**Why this split:** the Node backend owns auth, request orchestration, and talking to Postgres — the same role it plays in AutoRecruit-Validator. The Python/FastAPI service owns everything Gemini-facing (extraction, RAG, generation) so LLM logic stays isolated and testable independent of the web API layer. The Node backend calls the AI service over HTTP; the frontend never calls the AI service directly.

## 2. Core Data Flow (Upload → Chat)

1. **Upload:** Frontend → `POST /api/documents` (Node) → file saved to disk → document row created (`status: uploaded`) → job dispatched to AI service.
2. **Extraction:** AI service pulls raw text from the PDF → Gemini structured extraction call (function-calling/JSON schema, per `rules.md` §5) → returns structured clause data → Node writes to `extracted_clauses` table → document `status: extracted`.
3. **Flagging (deterministic):** Node (or a shared module) runs the extracted clause data through the rule-matching engine against the taxonomy (see `PRD.md` reference to the taxonomy doc) → writes rows to `flags` table → document `status: flagged`.
4. **Explanation generation:** For each flag, AI service fills the taxonomy's plain-language template with extracted values (templated generation, not freeform) → stored on the flag row.
5. **Scoring:** Deterministic scoring function reads all flags for the document + static settlement-ratio table → writes `policy_health_score` row.
6. **Embedding (for chat):** AI service chunks the extracted document text → generates embeddings → stores in `document_chunks` (pgvector) → document `status: ready`.
7. **Chat:** Frontend → `POST /api/documents/:id/chat` → Node forwards to AI service → AI service retrieves top-k relevant chunks → Gemini answers grounded in retrieved context only → response includes clause citation or explicit "not found in document" flag.

Every stage writes an explicit status so the frontend can show accurate processing-stage labels (per `design.md`'s processing-state spec) rather than a generic spinner.

## 3. Database Schema (Prisma models, simplified)

```prisma
model Document {
  id                String   @id @default(uuid())
  userId            String?
  fileName          String
  status            String   // uploaded | extracting | extracted | flagged | ready | failed
  insurerName       String?
  sumInsured         Int?
  uploadedAt        DateTime @default(now())
  clauses           ExtractedClause[]
  flags             Flag[]
  score             PolicyHealthScore?
  chunks            DocumentChunk[]
  chatMessages      ChatMessage[]
}

model ExtractedClause {
  id           String   @id @default(uuid())
  documentId   String
  document     Document @relation(fields: [documentId], references: [id])
  clauseType   String   // waiting_period | sub_limit | exclusion | co_pay | room_rent | claim_process
  rawText      String   // verbatim excerpt from the PDF
  pageNumber   Int?
  fieldsJson   Json     // structured extracted values, schema depends on clauseType
  confidence   String   // high | medium | low
}

model Flag {
  id             String   @id @default(uuid())
  documentId     String
  document       Document @relation(fields: [documentId], references: [id])
  clauseId       String?
  taxonomyId     String   // e.g. "R02", "G04" — references rules.md / taxonomy doc
  colorType      String   // red | green
  severity       String   // critical | high | medium | low | null (green flags)
  explanation    String   // filled plain-language template
  rupeeAtRisk    Int?     // null if not quantifiable
  sourceExcerpt  String
  verified       Boolean  @default(true) // false = low-confidence, shown as "unverified"
}

model PolicyHealthScore {
  id           String   @id @default(uuid())
  documentId   String   @unique
  document     Document @relation(fields: [documentId], references: [id])
  score        Int      // 0-100
  breakdown    Json      // per-flag contribution, for the "see how this is calculated" view
  settlementRatio Float? // from static IRDAI table, matched by insurerName
}

model DocumentChunk {
  id           String   @id @default(uuid())
  documentId   String
  document     Document @relation(fields: [documentId], references: [id])
  chunkText    String
  embedding    Unsupported("vector(768)") // pgvector
}

model ChatMessage {
  id           String   @id @default(uuid())
  documentId   String
  document     Document @relation(fields: [documentId], references: [id])
  role         String   // user | assistant
  content      String
  groundedInDocument Boolean? // null for user messages
  citedClauseId String?
  createdAt    DateTime @default(now())
}
```

## 4. API Surface (Node backend)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/documents` | Upload a policy PDF, kicks off the pipeline |
| GET | `/api/documents/:id` | Poll document status + all results once ready |
| GET | `/api/documents/:id/flags` | Flag list (paginated if needed) |
| GET | `/api/documents/:id/score` | Policy Health Score + breakdown |
| POST | `/api/documents/:id/chat` | Ask a question, grounded RAG response |
| POST | `/api/documents/compare` | Body: `documentIds[]` → comparison table restricted to differing flags |
| POST | `/api/documents/:id/scenario` | Body: `scenarioId` → scenario simulator narrative result |
| POST | `/api/documents/:id/pitch-compare` | Body: `pitchText` → salesperson-pitch-vs-document contradiction highlights |
| GET | `/api/documents/:id/report-card` | Generates shareable image/PDF summary |
| POST | `/api/documents/:id/grievance-draft` | Generates editable grievance draft (never auto-submitted) |
| GET | `/api/insurers/settlement-ratios` | Static IRDAI reference table |

## 5. AI Service Surface (Python/FastAPI, internal — not exposed to frontend)

| Endpoint | Purpose |
|---|---|
| `POST /extract` | Raw PDF text → structured clause JSON (Gemini function-calling) |
| `POST /embed` | Document text → chunk + embed for pgvector storage |
| `POST /generate-explanation` | Taxonomy template + extracted values → filled plain-language sentence |
| `POST /chat` | Question + document ID → retrieval + grounded Gemini answer |
| `POST /pitch-compare` | Pitch text + extracted clauses → contradiction list |

## 6. Flag Engine (Deterministic — separate from any LLM call)

Lives as a standalone, unit-testable module (Node or Python, team's choice — but only one implementation, not duplicated across both, to avoid the divergent-implementation bug class seen in AutoRecruit-Validator).

```
function matchFlags(extractedClauses: ExtractedClause[]): Flag[]
  for each taxonomy rule (R01–R13, G01–G07):
    if extractedClauses satisfy rule.triggerCondition:
      emit Flag { taxonomyId, colorType, severity, sourceExcerpt, ...}
  return flags
```

This function contains zero LLM calls. Its inputs are structured data already extracted by Gemini; its output is deterministic given the same input. This is the function unit tests target (see `rules.md` §5).

## 7. Scoring Function

```
function calculateScore(flags: Flag[], settlementRatio: number | null): PolicyHealthScore
  base = 100
  for f in flags where f.colorType == 'red':
    base -= severityWeight[f.severity]   // critical:25, high:15, medium:8, low:3
  for f in flags where f.colorType == 'green':
    base += 5   // capped total green bonus, e.g. max +15
  base = clamp(base, 0, 100)
  // settlementRatio is shown alongside the score as context, not blended into
  // the numeric score itself, to keep the two signals (document risk vs.
  // insurer track record) legible and separately explainable
  return { score: base, breakdown: [...], settlementRatio }
```

Deliberately keeping settlement ratio as a *displayed companion signal* rather than folding it into the score arithmetic avoids a misleading single number that conflates "this document has risky clauses" with "this insurer generally pays out" — they're different facts and the UI should let a user reason about both.

## 8. Failure & Confidence Handling

- Any Gemini call failure (`/extract`, `/chat`, `/generate-explanation`) → document/flag status set to `failed`/`low_confidence` explicitly, never silently defaulted. Matches `rules.md` hard rule on never mislabeling failed calls as valid results.
- `ExtractedClause.confidence = 'low'` → corresponding flag gets `verified: false` → frontend renders the "unverified" card style per `design.md`.
- Chat responses without sufficient retrieved context → `groundedInDocument: false`, frontend shows explicit fallback copy, never a generated answer presented as document-sourced.

## 9. External Data

- **IRDAI settlement ratio table:** static seed data, `insurers` table or JSON fixture, keyed by insurer name, loaded at deploy time — not fetched live.
- **Taxonomy rules:** loaded from a structured version of the taxonomy doc (JSON/YAML derived from the red/green flag reference) — not re-derived by the LLM at runtime.

## 10. Deployment Notes (Hackathon Scope)

- Single-server deployment acceptable for the demo (Node + Python services on one host, Postgres managed or local).
- File storage: local disk under a gitignored uploads directory is sufficient; no S3 needed for the hackathon build.
- No auth/multi-tenancy required for the demo unless judged on production-readiness — if added, keep it minimal (single demo user session) rather than building a full auth system under time pressure.
