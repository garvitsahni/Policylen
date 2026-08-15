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
