# PolicyLens Backend

Node.js + Express 5 + TypeScript API for PolicyLens, a health insurance policy analyzer. The backend owns auth, request orchestration, database access, and the deterministic red/green flag engine. All Gemini-facing logic (extraction, RAG, generation) lives in the separate [Python/FastAPI AI service](../ai-service/).

```
Frontend (React/Vite/Tailwind) ←→ Backend (Node/Express/Prisma) ←→ AI Service (Python/FastAPI)
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16 with pgvector (run via `docker compose up -d` from the repo root — host port **5434**)
- An LLM API key (Groq and/or Gemini) — see the root [README](../README.md#quick-start)

## Setup

```bash
npm install

# Create .env in the repo root (copied from .env.example):
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5434/policylens?schema=public"
#   GROQ_API_KEY=...
#   GEMINI_API_KEY=...
#   PORT=3000

npx prisma migrate dev
```

## Run

```bash
npm run dev        # tsx src/index.ts — serves on http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`node dist/index.js`) |
| `npm test` | Run the Vitest suite |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Run `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio |

## Module Map

| Module | Purpose |
|--------|---------|
| `src/flag-engine/` | Deterministic rule engine (R01–R13 red, G01–G07 green) — zero LLM calls |
| `src/routes/` | Express route handlers (documents, chat, scenarios, etc.) |
| `src/pitch-compare/` | Deterministic sales-pitch contradiction detection |
| `src/explain-simplify/` | 18 pattern-based sentence rewrite rules |
| `src/report-card/` | Score card generator with 8 stamp types |
| `src/grievance/` | Template-based grievance draft generator |
| `src/renewal-watch/` | Mock policy version diff engine |
| `src/scenario-simulator/` | Real-world scenario walkthroughs |
| `src/translate/` | OpenRouter Gemini translation (9 languages) |
| `src/data/` | Community clauses seed data |

## Tests

```bash
npm test     # 11 files, 137 tests
```

## Key Design Decisions

1. **Deterministic flag classification** — no LLM influence in flag determination; all logic in code against `data/taxonomy.json`
2. **Architecture separation** — LLM logic isolated in the Python AI service, API orchestration in Node
3. **No advice generation** — explanations only, never financial/legal guidance
4. **RAG-only chat** — chat answers grounded strictly in uploaded documents
5. **No silent AI failures** — any Gemini/Groq call failure surfaces as an explicit error state, never a default

See `../README.md` for the full API reference and environment variable documentation.
