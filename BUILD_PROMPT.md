# PolicyLens — Build Kickoff Prompt

Paste the block below into your AI coding agent (Claude Code, OpenCode, Antigravity, or
equivalent) as the **first message in a fresh session**, with this whole `PolicyLens/`
folder either already placed at the repo root or attached to the session. Do not skip
straight to a feature request — this kickoff message is what gets the agent to actually
read the spec instead of improvising.

---

```
You are building PolicyLens, a health-insurance policy analysis tool, inside this
repository. Before writing any code, do the following, in order, and show me your
output at each step:

1. Read SKILL.md in full. This is binding for the entire build, not just this message
   — treat it as still in effect in every later session and after every context reset.
2. Read AGENTS.md in full.
3. Read docs/PRD.md, docs/taxonomy.md (and data/taxonomy.json — the machine-readable
   version you'll actually implement against), docs/architecture.md, and docs/design.md,
   in that order.
4. Read IMPLEMENTATION_PLAN.md. This is the phase sequence you will follow. Do not
   reorder phases or skip verification gates.
5. Confirm back to me, in your own words and briefly: (a) the five hard rules from
   SKILL.md, (b) where the flag-matching engine lives and why it has zero LLM calls,
   and (c) what "verification gate" means for how you'll report progress to me from
   here on. I want to see you've actually internalized this before Phase 0 starts.

Then begin Phase 0 exactly as specified in IMPLEMENTATION_PLAN.md: scaffold the repo
tree, initialize frontend/backend/ai-service, set up Postgres + pgvector + Prisma using
the schema in docs/architecture.md §3, and load the two data files already provided
(data/taxonomy.json, data/settlement_ratios.json) — do not regenerate or re-derive
either of these from the markdown docs; they are the working spec.

Stop at the end of Phase 0 and show me the raw terminal output of the verification
gate (a curl call to POST /api/documents returning raw extracted text from a sample
PDF). I will confirm before you proceed to Phase 1. I will not accept a written summary
of what should work as proof — show me the actual output.

From here forward: every phase ends with its verification gate, shown as raw
terminal/log output, before you move to the next phase. If you hit an ambiguity in the
PRD, taxonomy, or design doc, stop and ask me rather than making a silent judgment
call — this applies especially to anything touching flag classification logic (red vs.
green) or how low-confidence/failed extraction is communicated in the UI.
```

---

## Notes on using this prompt

- **Attach the sample policy PDFs before Phase 0.** The agent needs 2–3 real,
  publicly available health insurance policy wordings in `samples/` to run the Phase 0
  and Phase 1 verification gates against. Public sample policy wordings from insurer
  websites work; do not use a real person's actual policy document.
- **Re-paste the "read SKILL.md" instruction if the agent's context resets** (new
  session, compaction, long conversation). SKILL.md is written to be re-loadable — if
  the agent starts inventing red/green logic in a prompt instead of the deterministic
  engine, that's the signal it dropped the skill from context; re-anchor it.
- **UI generation:** if using a separate AI UI tool (Stitch or similar) rather than
  having the coding agent build the frontend from scratch, use `docs/ui-prompt.md`
  as-is for that tool instead of this prompt — it's written for a different kind of
  agent (visual generation, not a coding agent with file/terminal access).
- **After Phase 0 passes:** just say "proceed to Phase 1" (etc.) once you've confirmed
  the gate output — the agent already has the full sequence from
  `IMPLEMENTATION_PLAN.md` and doesn't need the phase re-explained each time.
