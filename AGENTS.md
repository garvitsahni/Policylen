# AGENTS.md — PolicyLens Build Guardrails

This file governs any AI coding agent (OpenCode, Antigravity, Claude Code, etc.) working on this repository. Read this in full before writing any code. These rules are hard constraints, not suggestions — violating them produces a product that misleads users about their insurance coverage, which is the one failure mode this project cannot tolerate.

## 1. Required reading order

Before implementing any feature, read in this order:
1. `01_PRD.md` — what we're building and why
2. `03_RED_GREEN_FLAG_TAXONOMY.md` — the actual decision logic for flags
3. `02_IMPLEMENTATION_PLAN.md` — build sequence and phase gates
4. `04_DESIGN_DOC.md` — UI/UX behavior spec

Do not start writing extraction, flagging, or scoring code without having read the taxonomy file. It is the specification, not a reference document.

## 2. Hard rules — never violate

- **Never let the LLM decide red/green classification directly.** Classification is a deterministic rule match against `03_RED_GREEN_FLAG_TAXONOMY.md`. The LLM extracts structured field values (e.g. `co_pay_pct`, `ped_waiting_period_months`) from document text; a separate, non-LLM function matches those values against the taxonomy's trigger conditions. If you find yourself writing a prompt that asks "is this clause good or bad," stop — that logic belongs in code, not in a prompt.
- **Never fabricate numbers.** Rupee-at-risk figures, settlement ratios, and score components must trace to either (a) values extracted from the uploaded document or (b) the static IRDAI reference dataset. Never have the LLM estimate or "fill in" a plausible-sounding figure when the document doesn't state one — the correct behavior is to show the flag without a rupee figure and mark the field as not stated in the document.
- **Never generate financial, legal, or insurance advice.** The chat, flag explanations, and scenario simulator explain what a clause means and what it could cost — they never tell the user what to do ("switch insurers," "you should not buy this policy," "file a claim now"). If a user asks the chat for a recommendation, the correct response is to explain the relevant facts and explicitly note that PolicyLens doesn't give advice, not to refuse silently or comply anyway.
- **Never mislabel a failed AI call as a valid result.** If a Gemini extraction or chat call errors, times out, or returns malformed output, the UI must show an explicit error/retry state. Do not catch the exception and fall back to a default or empty result that looks like a successful, confident answer — this exact bug class (silent failures mislabeled as valid semi-eligible verdicts) was previously found and fixed in AutoRecruit-Validator; do not reintroduce the pattern here.
- **Every flag shown in the UI must carry a traceable source citation** (document page/section or verbatim excerpt). A flag with no retrievable source is a bug, not a minor gap.
- **Chat answers must be grounded strictly in the uploaded document via RAG.** If retrieved context doesn't support an answer, the system says so explicitly. Never let the chat answer general insurance questions from the model's training data and present it as if it came from the user's policy — this breaks the core trust promise of the product.
- **Never auto-submit the grievance-filing draft anywhere.** It is always an editable, user-reviewed draft for download/copy — never sent, filed, or posted by the system itself.

## 3. Verification discipline (applies to every phase)

- Show raw terminal/log output as proof of completion — a prose summary claiming a feature "works" is not acceptable evidence.
- Before fixing a bug, first reproduce the failing case and show it failing, then show the fix resolving it.
- Commit at each phase gate defined in `02_IMPLEMENTATION_PLAN.md` so any phase can be rolled back independently.
- Test extraction and flagging against all sample policy PDFs after any change to the extraction prompt or taxonomy matching logic — a change that fixes one policy's extraction can silently break another's.

## 4. Scope discipline

- Health insurance only for this build. Do not generalize the taxonomy or extraction schema to motor/term/life "while you're at it" — that requires its own taxonomy pass and is explicitly out of scope (see `01_PRD.md` §5).
- Digital-text PDFs only. Do not add OCR/scanned-document handling unless explicitly asked — if a scanned PDF is uploaded, detect it and show the "digital PDFs only" message from `04_DESIGN_DOC.md` rather than attempting extraction on it.
- Do not add live scraping of complaint forums or review sites for the reviews layer — use only the static, hardcoded IRDAI settlement ratio table.

## 5. Code conventions

- Match the existing stack pattern: Node/Express for the API layer, Python/FastAPI for the AI service, React/Vite/Tailwind for the frontend, PostgreSQL/Prisma for storage — consistent with prior projects in this workspace.
- Keep the flag-matching engine in its own module with unit tests per taxonomy rule (R01–R13, G01–G07) — each rule should have at least one test case with sample extracted values that should trigger it and one that shouldn't.
- Structured Gemini outputs should use function-calling/JSON schema mode, not free-text parsing with regex — free-text parsing of LLM output is fragile and was a known failure source in prior projects.

## 6. When in doubt

If a requirement in the PRD, taxonomy, or design doc is ambiguous or conflicts with something discovered during implementation, stop and flag it explicitly rather than making a silent judgment call — especially for anything touching flag classification logic or how confidence/uncertainty is communicated to the user.
