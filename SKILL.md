---
name: policylens-build
description: Use this skill whenever writing, editing, reviewing, or planning any code in the PolicyLens repository — a hackathon health-insurance policy analysis tool. Trigger on any task touching PDF extraction, the red/green flag engine, the Policy Health Score, the RAG chat, the scenario simulator, comparison, pitch-vs-document mode, the grievance draft, or the frontend UI for any of these. This skill is the build's non-negotiable guardrails and must be loaded before writing any feature code, not just referenced once at the start.
---

# PolicyLens Build Skill

PolicyLens tells someone what their health insurance policy actually means for their
claims — in rupees, grounded in the document, never a guess. The one failure mode this
project cannot tolerate is **confidently telling a user something false about their own
coverage**. Every rule below exists to prevent that specific failure mode. When a
shortcut would risk it, take the slower, correct path.

## Required reading order (before writing any feature code)

1. `docs/PRD.md` — what and why
2. `docs/taxonomy.md` + `data/taxonomy.json` — the actual decision logic; this is the spec, not background reading
3. `IMPLEMENTATION_PLAN.md` — build sequence and phase gates
4. `docs/architecture.md` — schema, API surface, data flow
5. `docs/design.md` — UI/UX behavior spec, including every failure/empty/low-confidence state

## The five hard rules

1. **The LLM never decides red/green.** Classification is a deterministic match against
   `data/taxonomy.json`, run by a plain function with zero LLM calls
   (`matchFlags()` — see `docs/architecture.md` §6). The LLM's only two jobs are (a)
   extracting structured field values from PDF text, and (b) filling a fixed
   plain-language template with those values. If you're about to write a prompt that
   asks "is this clause good or bad" or "how severe is this," stop — that decision
   belongs in code.

2. **Never fabricate a number.** Rupee-at-risk figures, settlement ratios, and score
   components must trace to (a) a value extracted from the uploaded document or (b)
   `data/settlement_ratios.json`. If a required value isn't stated in the document,
   show the flag with the figure omitted and an explicit "not stated in this document"
   — never let the model estimate a plausible-sounding number and present it as fact.

3. **Never generate advice.** Flag explanations, chat answers, and the scenario
   simulator explain what a clause means and what it could cost. They never tell the
   user what to do (no "switch insurers," "don't buy this," "file a claim now"). If a
   user asks the chat directly for a recommendation, the correct response states the
   relevant facts and explicitly says PolicyLens doesn't give advice — not a silent
   refusal, not silent compliance either.

4. **A failed AI call is a failure state, never a disguised success.** If a Gemini
   call to `/extract`, `/chat`, or `/generate-explanation` errors, times out, or
   returns malformed output, the corresponding document/flag/message status is set to
   an explicit failed/low-confidence state and the UI shows it as such. Never catch the
   exception and quietly fall back to an empty or default result that renders with the
   same visual confidence as a real answer.

5. **Every flag needs a traceable source.** A `Flag` row with no `sourceExcerpt` that
   maps back to an `ExtractedClause` is a bug, not a minor gap — do not ship a flag
   card with nothing to expand into.

Two more that are easy to forget mid-build:

- **Chat is RAG-grounded, full stop.** If retrieved chunks don't support an answer,
  say so explicitly (`groundedInDocument: false` + distinct UI treatment). Never let
  the model answer a general insurance question from training data and present it as
  if it came from the user's policy.
- **The grievance draft never auto-submits anywhere.** It's an editable download/copy
  target only, always.

## Scope discipline

- Health insurance only. Do not generalize the taxonomy/extraction schema to motor,
  term, or life insurance "while you're at it" — each needs its own taxonomy pass.
- Digital-text PDFs only. A scanned/image-only PDF gets the explicit "digital PDFs
  only" message from `docs/design.md`, not an extraction attempt.
- Reviews/reputation layer uses only `data/settlement_ratios.json` — no live scraping
  of review or complaint sites.

## Code conventions

- Node/Express (API + orchestration + Postgres/Prisma) · Python/FastAPI (all
  Gemini-facing logic) · React/Vite/Tailwind (frontend) — don't introduce a different
  stack mid-build.
- Structured Gemini output uses function-calling/JSON schema mode. Never regex-parse
  free-text LLM output.
- The flag-matching engine lives in exactly one place (`backend/src/flag-engine/`,
  per `IMPLEMENTATION_PLAN.md`) with a unit test per taxonomy rule — one case that
  should trigger it, one that shouldn't. Do not create a second implementation in the
  Python service "for convenience."

## Verification discipline (every phase gate)

- Raw terminal/log output is the only acceptable proof of a working feature. A prose
  summary of what should work is not evidence.
- Before fixing a reported bug, reproduce it and show it failing, then show the fix
  resolving that same reproduced case.
- Git commit at each `IMPLEMENTATION_PLAN.md` phase gate so any phase can be rolled
  back independently.
- After any change to the extraction prompt or `data/taxonomy.json`, re-test against
  *all* sample PDFs in `samples/` — a fix for one policy can silently break another's
  extraction.

## When something is ambiguous

If a requirement in the PRD, taxonomy, or design doc is unclear, or conflicts with
something discovered mid-build, stop and surface it explicitly rather than making a
silent judgment call — especially anything touching flag classification or how
uncertainty is shown to the user. A wrong guess here is the exact failure mode this
skill exists to prevent.
