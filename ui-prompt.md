# PolicyLens — UI Generation Prompt (for Stitch or similar AI UI tools)

**v2 — revised after the first pass came back generic.** The original prompt produced a
default "calm fintech SaaS" look that could have been any country's insurance app with
the labels swapped. This version grounds the design in Indian document culture
specifically, so the output can't drift back to generic templates. Paste the whole block
below into Stitch.

---

```
Design a web app called PolicyLens — an AI tool that reads a user's health insurance
policy PDF and shows them, in plain language, what could go wrong when they try to
claim. Tone: a calm, competent expert reading the fine print with you.

DESIGN REFERENCE — READ THIS FIRST
Do NOT default to a generic fintech SaaS look (soft gradients, rounded pill buttons,
generic blue-and-white "trust" palette, Silicon Valley dashboard style). Instead, the
visual world for this app is the physical culture of Indian financial paperwork: LIC
policy bonds with navy covers and gold lettering, bank passbooks, the ink rubber-stamp
and signature that makes an Indian document feel official, the kraft/manila file folder
an agent hands across a desk. Modernize that world into a clean digital product — don't
literally skeuomorph it, but let it inform every material and color choice. Also avoid
the opposite cliché: do NOT use the Indian tricolor (saffron/white/green) or generic
"Digital India" government-poster styling — that reads as a scheme website, not a trust
product for individuals.

COLOR SYSTEM (use exactly these, no substitutions)
- Background: #FAF6EC (ledger-paper — warm off-white like a passbook page)
- Card/surface: #E4D8B4 (kraft — used sparingly for section backgrounds and dividers,
  like a policy file folder; never full-bleed as a page background)
- Primary/brand color: #1E3A5F (ledger-indigo — the navy of an LIC bond cover; use for
  primary buttons, links, the app's wordmark, and active states)
- Critical/red-flag color: #C1392B (sindoor — a vermillion-red, not a stock alert red)
- Caution/medium-flag color: #C68A1F (turmeric-gold)
- Favorable/green-flag color: #42663B (neem — deep leaf green, not neon)
- Stamp/verification mark color: #16283D (stamp-navy, slightly darker than the primary
  brand color, used only for the verification stamp element described below)

TYPOGRAPHY
- Headlines and the Policy Health Score number: Noto Serif (with Noto Serif Devanagari
  as the paired font when the interface is shown in Hindi — the two must look like the
  same typeface family, not a default-font fallback)
- Body text, UI labels, chat: Noto Sans / Noto Sans Devanagari, same pairing logic
- All rupee amounts: tabular/monospaced figures, formatted in INDIAN digit grouping —
  write ₹1,00,000 and ₹12,50,000, never ₹1,000,000-style international grouping. This
  detail must appear correctly everywhere a rupee figure is shown.

SIGNATURE ELEMENT — THE VERIFICATION STAMP
Every flag card that has been confidently matched to a real clause in the source
document carries a small circular ink-stamp graphic — a serrated or double-ring circular
border (like a real rubber stamp), rotated 2–4 degrees off-axis as if hand-stamped, in
stamp-navy (#16283D), containing small text like "R02 · VERIFIED". Low-confidence flags
must NOT have this stamp — instead give them a dashed card outline and a small "unable
to verify — check page {n}" note, so confidence is legible from the stamp's presence or
absence alone, without reading any text. This stamp is the single most important
recognizable visual element in the whole product — treat it with real craft, not as an
afterthought icon.

SCREENS TO DESIGN

1. UPLOAD SCREEN
   - Centered dropzone on the ledger-paper background, kraft-toned card, with copy:
     "Drop your policy PDF, or upload from your phone"
   - A prominent, permanently visible language toggle near the top: English / हिंदी
     (styled as a real segmented control, not a small flag icon)
   - Trust badge styled like familiar Indian fintech "RBI regulated" / "NPCI" trust
     marks — small, monochrome, official-looking — referencing IRDAI, NOT a generic
     padlock/SSL icon
   - Small reassurance line: "We never store your document without your permission"

2. PROCESSING STATE
   - Skeleton layout of the results screen with a shimmer effect
   - Rotating stage labels in the active language: "Reading your document…" /
     "दस्तावेज़ पढ़ रहे हैं…" → "Matching clauses…" → "Calculating your risk…"

3. MAIN RESULTS DASHBOARD (three-column desktop layout)
   - LEFT (sticky, ~280px): Policy Health Score card on a kraft surface — large Noto
     Serif number 0–100, one-line verdict below, a small "see how this is calculated"
     link, and the insurer's IRDAI-referenced settlement ratio shown as its own small
     official-looking badge underneath, separate from the score
   - CENTER (scrollable): vertical flag-card list on ledger-paper background — each
     card shows the verification stamp (or dashed unverified outline) in the top
     corner, a colored severity dot + text label (never color alone), one plain-English
     sentence, and — where applicable — a rupee-at-risk figure inline in tabular
     numerals with correct Indian digit grouping, in the flag's color. Clicking expands
     the card to show the quoted source clause and fuller explanation.
   - RIGHT (~320px desktop, bottom sheet with floating action button on mobile):
     persistent chat panel, "Ask about your policy" / "अपनी पॉलिसी के बारे में पूछें,"
     simple message bubbles, suggested example questions before the first message

4. SCENARIO SIMULATOR
   - Row of large tappable scenario buttons with icons: hospitalization, surgery,
     pre-existing condition claim, maternity
   - Selecting one shows a step-by-step narrative card of what would actually be paid,
     using the same flag color language and Indian rupee formatting

5. CROSS-POLICY COMPARISON
   - Side-by-side kraft-toned cards per policy, compact table below showing only
     flags that differ, identical rows visually muted

6. SHAREABLE REPORT CARD (export view)
   - Single vertical page designed to be screenshotted or downloaded: PolicyLens
     wordmark in ledger-indigo, the score, top 3 flags with their stamps, insurer
     settlement-ratio badge, and an explicit WhatsApp-green "Share on WhatsApp" button
     as the primary share action (not a generic share icon) — this is the actual
     channel this audience shares documents through

INTERACTION NOTES
- Every flag card needs a visible hover/focus state and keyboard-operable expand/collapse
- Severity is always color + icon + text label together, never color alone
- Design the mobile layout: single column, score becomes a compact sticky top bar with
  the stamp/badge still visible, chat becomes a floating action button opening a bottom
  sheet, language toggle stays visible in the top bar

Generate high-fidelity screens for all six views above, desktop and mobile, strictly
within this color and type system — do not introduce blues, gradients, or accent colors
outside the palette given above.
```

---

### Notes on using this v2 prompt

- If Stitch still drifts toward a generic look on the first pass, the two things to
  regenerate/insist on explicitly are: (1) the kraft/ledger-paper material palette
  instead of any default white-and-blue, and (2) the verification stamp — that's the
  element most likely to get quietly dropped or turned into a generic checkmark badge,
  and it's the one carrying the actual "Indian document trust" idea.
- Generate the **Upload** and **Main Results Dashboard** screens first, since those
  carry the most design risk and the most demo airtime.
- After generation, re-check against the accessibility/state-coverage checklist in
  `design.md` — stamp/unverified states, hover/focus, and the Hindi-language rendering
  are exactly the states an AI UI generator tends to skip on a first pass.
