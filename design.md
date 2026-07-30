# PolicyLens — Design Doc

Covers two layers, kept deliberately separate: **look** (visual identity — palette, type, layout) and **feel** (interaction behavior — state, feedback, motion, accessibility, resilience). Both are binding for whoever builds the UI, human or AI agent.

---

## Part 1 — Visual Identity

### Grounding (revised)

The first pass of this design leaned on generic "calm fintech" cues — slate blue, humanist serif, soft cream — which is exactly the kind of AI-generated-SaaS-default look the frontend-design process is supposed to catch and reject. It read as competent but placeless: it could have been a US health-benefits app with the labels swapped.

Re-grounded properly: the actual object of trust here isn't "a clean dashboard," it's **the physical culture of Indian paperwork** — LIC policy bonds with their navy covers and gold lettering, bank passbooks, the rubber ink-stamp and signature that makes an Indian document feel *official*, the manila/kraft file that HR and insurance agents hand across a desk. That is what a policy document means to the person opening this app — not a Silicon Valley dashboard metaphor. The design should feel like it belongs next to that world, modernized, not imported from one.

**Rejecting templated defaults, explicitly:** no warm-cream-terracotta AI look, no near-black-acid-accent look, no broadsheet hairline-rule look, and — specific to this brief — no cliché tricolor/saffron-white-green treatment either (that reads as a government-scheme poster, not a trust product). The "Indian-ness" comes from **document culture and material reference**, not flag colors.

### Token System

**Color** (named, 6 hex values, sourced from real Indian document materials):
- `ledger-paper` `#FAF6EC` — background; the warm off-white of a bank passbook or old bond paper, not stark white
- `kraft` `#E4D8B4` — secondary surface / card backgrounds, section dividers; the tan of a policy file folder, used sparingly as texture and structure, never full-bleed
- `ledger-indigo` `#1E3A5F` — primary brand/action color; the deep navy-blue of LIC bond covers and passbook ink — this replaces the generic "trust blue" with something specifically drawn from Indian financial-document covers
- `sindoor` `#C1392B` — critical/red flags; a vermillion-red rather than a stock alert red, serious without being a screaming siren
- `turmeric` `#C68A1F` — medium-severity/caution flags; warm turmeric-gold
- `neem` `#42663B` — green/favorable flags; a deep neem-leaf green rather than a neon "success" green

**Type** (bilingual-first, 3 roles):
- Display/headline: **Noto Serif**, paired with **Noto Serif Devanagari** for the Hindi/regional toggle — used for the Policy Health Score number and section headers. Choosing a typeface with a matched Devanagari sibling (rather than swapping to a generic system font when the language toggles) is the actual functional payoff of this choice — the product should look equally considered in Hindi, not degrade to default fonts.
- Body/UI: **Noto Sans** (Latin) / **Noto Sans Devanagari** — same pairing logic, dense and legible for clause text and chat in either language
- Data/mono: tabular-figure font for rupee amounts, **formatted in Indian digit grouping** — ₹1,00,000 and ₹12,50,000, never ₹1,000,000-style international grouping. This one detail does more for "does this feel like it was built for me" than any color choice.

**Layout concept:** unchanged structurally from the original plan (sticky score card, vertical flag-card list, persistent chat panel) — that layout logic was sound. What changes is materiality: card backgrounds use the `kraft` tone with a very subtle paper-grain texture (barely-there, not a heavy skeuomorphic filter), and section dividers are thin rule lines rather than pure whitespace gaps, echoing a ledger page rather than a blank app canvas.

ASCII layout sketch (desktop) — unchanged:
```
┌─────────────┬──────────────────────────────┬───────────┐
│ Score card  │  Flag list (scrollable)       │  Chat     │
│ (sticky)    │  ▸ R02 Critical  cataract cap  │  panel    │
│ 62/100      │  ▸ R04 Critical  PED wait 4yr  │  "Ask..." │
│ [breakdown] │  ▸ G04 Restoration benefit     │           │
└─────────────┴──────────────────────────────┴───────────┘
```

**Signature element (revised): the verification stamp.** Instead of a generic checkmark or badge icon, every extracted flag that's been confidently verified against the source document carries a small circular **ink-stamp mark** — a serrated/circular stamp outline in `ledger-indigo` or `stamp-navy` (`#16283D`), set at a slight 2–4° rotation like a real rubber stamp struck by hand, reading the taxonomy ID (e.g. "R02 · VERIFIED"). Unverified/low-confidence flags conspicuously do *not* get a stamp — they get a dashed outline instead, so the presence or absence of the stamp itself communicates confidence at a glance. This is drawn directly from how Indian official documents signal authenticity, and it's the one element every screenshot should be recognized by — replacing the earlier "rupee-at-risk callout" as the primary signature (the rupee callout is kept, but as a supporting device, not the hero mark).

### Additional India-specific product touches (not just visual)

- **Rupee-at-risk and all currency figures use Indian numbering (lakh/crore grouping)** throughout — extraction, scoring, chat, and the report card.
- **Language toggle is a first-class, permanently visible control** (English / हिंदी / + regional), not a buried settings item — designed as a real segmented toggle, not a small flag icon, since for a large share of the target audience this determines whether the product is usable at all.
- **WhatsApp is a first-class share target**, not folded into a generic "share" icon — the shareable report card (Feature 12) should have an explicit WhatsApp-green share button, because that is the actual distribution channel this audience uses, not Twitter/X or generic link-copy.
- **Trust badge styling borrows from familiar Indian fintech patterns** — an "IRDAI reference data" badge styled the way Indian apps show "RBI regulated" or "NPCI" trust marks (small, monochrome, official-looking), rather than a generic padlock/SSL badge that means nothing to a non-technical user.
- **Avoid imported fintech visual tropes** — no Silicon-Valley gradient hero, no Robinhood-style candlestick-chart-adjacent styling. If it wouldn't look at home next to a passbook and a policy bond on a kitchen table, it's the wrong choice for this product.

### Copy Voice

Direct, second-person, concrete, in both English and Hindi renderings — never "the policyholder," always "you" / "आपको." Never restate legal language as the explanation — translate it. Errors and low-confidence states say exactly what's uncertain ("We couldn't confidently read this clause — check the original document, page {n}") rather than a generic failure message.

---

## Part 2 — Interaction & UX Behavior Spec

Applying the three-question test to every core interactive element below.

### Upload flow

- **First 100ms:** drag-over state highlights the dropzone immediately; file selection shows the filename and a determinate progress bar the instant the upload starts, never a bare spinner.
- **Wrong path:** invalid file type → inline message naming the accepted formats, file stays selectable to retry, no page reload. Upload failure (network) → retry button in place, original file re-attempts without re-selecting. Password-protected or scanned/image-only PDF → explicit message ("This looks like a scanned document — PolicyLens currently reads digital PDFs only") rather than a silent extraction failure.
- **Accessibility:** dropzone is a real `<button>`/`<label>` wrapping a file input, keyboard-focusable and operable with Enter/Space, not a div with an onClick.

### Processing state (extraction + flagging, ~20–30s)

- Never a bare spinner. Show a skeleton of the eventual flag-list layout with a short sequence of stage labels ("Reading document… Matching clauses… Calculating your risk…") so the wait has legible structure.
- If processing exceeds ~45s, show a reassurance message rather than letting the user wonder if it's stuck ("Complex policies take a little longer — still working.").

### Flag cards

- Default: collapsed, severity marker (color + icon + text label — never color alone) + one-line plain-English summary.
- Hover/focus: subtle lift/border, cursor signals expandability.
- Expanded (click or Enter/Space): shows source clause text (verbatim, quoted, clearly marked as document excerpt), rupee-at-risk figure if applicable, and severity rationale.
- Low-confidence extraction: card shows a distinct "unverified" state — muted styling, explicit label, link to the source page — never presented with the same visual confidence as a verified flag.

### Policy Health Score

- Loads as a skeleton number that resolves once calculation completes — never pops in with no transition (a short 200ms count-up or fade is enough; no theatrical animation).
- Score breakdown is one click away, never hidden behind more than one interaction — this is the number the whole product hinges on, it must never feel like a black box.

### Chat panel

- Sending a question: input disables just itself (not the whole page) while awaiting a response; a typing/thinking indicator appears within 100ms of send.
- Answer that can't be grounded in the document: explicit, distinct visual treatment ("Not covered in this document") — never silently answered from general knowledge, since that would break the core trust promise of the product.
- Chat history persists through the session; failed sends show inline retry, message text is preserved (never lost on failure).

### Cross-policy comparison

- Empty state before a second upload: clear call-to-action explaining what comparison unlocks, not a blank table.
- Table highlights *differences that matter* (materially different flags) rather than every cell — visually de-emphasize identical rows so the eye goes to what's different.

### Scenario simulator

- Each scenario is a real button with a clear label and icon, not a dropdown (dropdowns hide the options that are the actual value of this feature).
- Result renders as a short narrative walk-through, not just a number — "if you're hospitalized for dengue: room rent capped → you pay X, no PED issue since dengue isn't pre-existing → covered."

### Destructive/high-friction actions

- Deleting an uploaded policy: confirmation required (not one-click), since re-uploading and re-processing is costly to the user's time.
- Grievance-filing assist draft: never auto-submits anywhere — always presented as an editable draft the user copies or downloads, full stop. This is a legal/formal document; the user must review and act themselves.

### Responsive & motion

- Mobile: chat collapses to a bottom sheet accessible via a persistent floating action button; flag list becomes the primary full-width view; score card becomes a compact sticky header bar instead of a side card.
- All transitions 150–250ms for micro-interactions (card expand, button press), 250–400ms for panel-level transitions (chat sheet open). `prefers-reduced-motion` respected throughout — card expand becomes an instant state change with no slide/fade when set.

### Accessibility floor (non-negotiable per godlike-ui-ux)

- Full keyboard operability: upload, flag card expand/collapse, scenario buttons, chat send, comparison table navigation.
- Visible focus ring on every interactive element, never suppressed without an equally visible replacement.
- Severity communicated by icon + text label + color together, never color alone (colorblind-safe by construction).
- Touch targets ≥44×44px throughout, particularly on the mobile flag list and scenario buttons.
- WCAG AA contrast maintained for all text, including the amber-caution and muted "unverified" states.

### Self-critique checklist before demo

- [ ] Every flag card has a real expanded state, not just default
- [ ] Upload, extraction-failure, and low-confidence states are all implemented, not just the happy path
- [ ] Whole flow completable via keyboard alone
- [ ] Processing wait always explains itself
- [ ] No destructive action is a single accidental click with no recovery
- [ ] Chat's "not in document" fallback actually fires and is visually distinct
