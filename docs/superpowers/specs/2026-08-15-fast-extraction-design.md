# Fast Extraction via Gemini-Primary Chain

**Date:** 2026-08-15
**Status:** Approved design

## Problem

Upload → analysis (PDF extraction + LLM clause extraction + flag engine) is too
slow. The extraction chain currently tries OpenRouter's `nemotron-3-super-120b`
first, a free-tier 120B model that takes ~60-120s (and up to 360s timeout) to
generate up to 8192 tokens of JSON over a full policy document. Gemini 2.0 Flash
— already wired in with native JSON-schema output — sits behind it and is far
faster. Success criteria: analysis completes in under a minute.

## Design

Four changes, all in the AI service (`ai-service/app/main.py`) plus a `.env`
comment fix.

### 1. Reorder extraction chain in `call_llm`

New extraction provider order:

1. **Gemini 2.0 Flash** (`GEMINI_MODEL`) — primary, JSON-schema output
2. **OpenRouter 120B** (`OPENROUTER_EXTRACTION_MODEL`) — fallback for large docs /
   Gemini quota exhaustion
3. **NVIDIA 49B** — unchanged
4. **Groq 8B chunked** — unchanged, last resort

The chat chain is unchanged (user only flagged extraction latency).

### 2. Fail fast on Gemini auth errors

Today a 401/invalid-key `Exception` in `call_gemini` enters the retry loop
(`time.sleep(2 ** attempt)`) up to 4 times — ~15s wasted before the fallback
chain moves on. Detect auth/authorization failures (`401`, `403`,
`PERMISSION_DENIED`, `UNAUTHENTICATED`, invalid-key messages) and return
immediately so the chain advances to OpenRouter without backoff.

### 3. Reuse HTTP connections

Replace the bare `requests.post` in `call_openai_compatible` with a
module-level shared `requests.Session()`. Each provider attempt currently opens
a fresh TCP+TLS connection; a session keeps connections alive across the
4-provider chain and its retries.

### 4. `.env` comment fixes

Update the stale comments that still describe OpenRouter as the "primary free
provider" (lines 16-19) and the extraction-timeout comment (lines 41-42). No
behavior change.

## Non-goals

- No change to extraction output shape (`_normalize_extraction`,
  `_build_clauses`, `EXTRACTION_SCHEMA` untouched) — flag logic is unaffected.
- No change to the chat chain.
- No provider race/concurrent extraction.
- No caching layer.

## Risks

- Gemini free-tier quota may 429; OpenRouter remains the fallback so this
  regresses to today's behavior rather than failing.
- Gemini must still handle the full 120K-char document in a single shot; it
  already did in the prior chain position for fallback, and JSON-schema mode is
  already exercised. Verified against all sample PDFs.

## Verification

- Re-run extraction against all sample PDFs in `samples/` and confirm elapsed
  time per document and unchanged clause output.
- Confirm the Gemini fail-fast path returns immediately on a bad key
  (unit-level check) and that the chain falls through to OpenRouter.
- Show raw elapsed-time output before/after per AGENTS.md §3.

### Measured end-to-end (Task 4, 2026-08-15)

AI service: `uvicorn app.main:app --port 8001`; PostgreSQL via `docker compose up -d postgres`.
All four samples extracted via `POST /extract-clauses` with their matching `tmp_extracts/*.txt`,
real `Document` rows (FK satisfied). 10 clauses each, `partial=False`.

**Before this branch's fixes (Gemini was fallback, deprecated `gemini-2.0-flash`):**
the deprecated model 404'd so extraction fell through to the slow OpenRouter 120B —
77–210s and multiple invalid-JSON/DB failures.

**After fixes (`gemini-2.5-flash`, `GEMINI_EXTRACTION_MAX_TOKENS=65536`, thinking disabled):**

| Sample | Elapsed | Clauses | Partial | Insurer |
|---|---|---|---|---|
| 20240325_Prospectus_IHIP.pdf | 34.2s | 10 | false | United India Insurance Company Limited |
| a370272f732749999e7c19e82e38ad7c.pdf | 44.4s | 10 | false | SBI General Insurance Company Limited |
| chi-prospectus.pdf | 36.1s | 10 | false | Universal Sompo General Insurance Company Limited |
| m4-5f.pdf | 18.7s | 10 | false | (null) |

All under the 60s success criterion. `sum_insured` varies run-to-run because the
prospectuses list multiple SI options (2–20 Lakhs) rather than a single schedule value;
that is pre-existing LLM variance, not a regression.

**Fixes surfaced by verification (all committed in this branch):**
1. `gemini-2.0-flash` is retired by Google (404 on API); moved to `gemini-2.5-flash` in
   `.env` and `main.py` defaults.
2. Extraction JSON can exceed 8192 output tokens → `finish_reason=MAX_TOKENS` → truncated
   invalid JSON. Added `GEMINI_EXTRACTION_MAX_TOKENS=65536`, applied only to the Gemini
   extraction path (`main.py:call_llm`).
3. Gemini 2.5 thinking mode added ~15–20s per call for no accuracy gain on schema-filling.
   Added `GEMINI_THINKING_BUDGET=0` (`main.py:call_gemini`), env-tunable.
