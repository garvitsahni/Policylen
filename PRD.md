# PolicyLens — Product Requirements Document

**Version:** 1.0 (Hackathon Build)
**Category:** InsurTech / AI Document Intelligence
**One-liner:** Upload your insurance policy. PolicyLens reads the fine print your agent didn't, tells you what it actually means in rupees, and answers your questions about it — in your language.

---

## 1. Problem Statement

Indian insurance buyers overwhelmingly purchase policies based on a salesperson's verbal pitch, not the actual policy document. The document itself — dense, legalese-heavy, 20–40 pages — contains the terms that actually govern whether a claim gets paid: waiting periods, room-rent capping, disease-specific sub-limits, co-payment percentages, and permanent exclusions. Most policyholders discover these terms for the first time at the worst possible moment: when a claim is filed and rejected or part-paid.

This is not a fringe issue. IRDAI's own annual reports consistently list claim repudiation, partial settlement, and mis-selling among the top categories of consumer grievances in health insurance. The information asymmetry is structural: insurers write the document, agents are commission-incentivized to close the sale, and the buyer has no independent, document-grounded way to check what they're actually agreeing to — until the claim is on the line.

## 2. Target User

**Primary:** First-time or repeat individual health insurance buyers in India, urban and semi-urban, comfortable with a smartphone, not necessarily comfortable with legal/insurance terminology. Age skews 25–55 (self-purchasers and people buying/reviewing family floater policies for parents).

**Secondary (B2B, post-hackathon):** Independent insurance advisors/brokers who want a trust-building tool to differentiate from commission-driven aggregators; corporate HR teams reviewing group health policies for employees.

## 3. Product Scope (Hackathon Build — Health Insurance Only)

Motor, term, and life insurance are explicitly out of scope for this build. Health insurance is chosen because it has the most acute pain (claim-time crisis), the most standardized clause taxonomy across insurers, and the most emotionally resonant demo.

## 4. Full Feature Set

### 4.1 Core Analysis Engine

| # | Feature | Description |
|---|---|---|
| 1 | Clause extraction & red/green flagging | PDF policy is parsed into structured sections: coverage, exclusions, waiting periods, sub-limits, claim process. Each clause is classified red (commonly causes claim rejection/reduction) or green (genuinely favorable), with a plain-language "what this means for you" explanation attached to every flag. |
| 2 | Hidden terms detector | Specifically hunts for clauses that narrow or contradict the headline coverage number (e.g. policy markets "₹5 lakh cover" but caps cataract surgery at ₹40,000 via a sub-limit). Also flags vague/discretionary insurer language ("at the company's sole discretion," undefined terms) that is commonly used to deny claims. |
| 3 | Cross-policy comparison | User uploads 2–3 policies; system produces a side-by-side table restricted to the flags that materially affect claim outcomes — not marketing feature lists. |
| 4 | Reviews/reputation layer | Displays IRDAI-published claim settlement ratio per insurer (static, hardcoded dataset for hackathon) alongside the policy analysis, so a document-level flag can be read against the insurer's real-world payout track record. |
| 5 | "Ask about your policy" chat | RAG-powered Q&A grounded strictly in the uploaded document. User asks natural-language questions ("Is my father's diabetes covered from day one?"); answers cite the specific clause. |

### 4.2 Quantification & Impact Layer

| # | Feature | Description |
|---|---|---|
| 6 | Rupee-at-risk calculator | Converts abstract clauses into concrete numbers. E.g. a room-rent cap of 1% of sum insured against a stated ₹10,000/day hospital room is translated to "you could pay ₹4,000/day out of pocket." |
| 7 | Claim rejection probability score | A single composite 0–100 "Policy Health Score" built from flag severity + insurer settlement ratio. Acts as the hero visual — one number a non-expert instantly understands. |
| 8 | Scenario simulator | User selects a real-world scenario (dengue hospitalization, knee surgery, diabetes diagnosed in year 2) and the tool walks through which clauses would trigger and what would actually be paid out. |

### 4.3 Accessibility & Reach

| # | Feature | Description |
|---|---|---|
| 9 | Voice input + regional language support | User can speak a question in Hindi or another regional language and receive an answer in the same language. |
| 10 | "Explain like I'm new to insurance" toggle | Simplifies flag language further for first-time buyers; a denser mode surfaces clause-level detail for advanced users. |
| 11 | WhatsApp bot front-end | Same analysis engine, accessible via WhatsApp document upload — meets users where they already are. |

### 4.4 Trust & Distribution Mechanics

| # | Feature | Description |
|---|---|---|
| 12 | Shareable red-flag report card | Auto-generated one-page visual summary (image/PDF) — "I found 3 hidden traps in my policy" — built for sharing with family or on social, doubling as organic distribution. |
| 13 | Renewal watch / clause-change tracker | On re-upload at renewal, diffs the new policy wording against the previous version and flags anything that quietly got worse. |
| 14 | Community clause database | Crowdsourced signal: confirmed claim-rejection patterns reported by users feed back into the red-flag taxonomy over time. |

### 4.5 Judge/Demo-Facing Features

| # | Feature | Description |
|---|---|---|
| 15 | "Salesperson pitch vs. actual policy" mode | User pastes/records what the agent verbally promised; tool highlights every place the pitch oversold what the document guarantees. Strongest live-demo moment — dramatizes the core problem in real time. |
| 16 | Grievance-filing assist | If a claim is rejected, tool auto-drafts a structured complaint to the insurance ombudsman/IRDAI grievance portal, citing the specific clause and policy section. |

## 5. Non-Goals (Explicit Exclusions)

- PolicyLens does not sell insurance, recommend specific insurers, or act as a broker. It is strictly an information/analysis tool. This boundary is deliberate: IRDAI licenses insurance advisory/sales activity, and PolicyLens must stay on the "information" side of that line to avoid regulatory exposure.
- No live scraping of user complaint forums in v1 (defamation/data-quality risk) — reputation layer uses only the static, published IRDAI settlement-ratio dataset.
- No claims-payment processing, no policy issuance, no KYC/payment handling.

## 6. Success Metrics (Demo Framing)

- **Technical:** End-to-end pipeline (upload → extraction → flags → score → chat) completes in under 30 seconds for a standard policy PDF.
- **Product:** A judge with zero insurance background can look at the Policy Health Score + top 3 red flags and correctly explain, in their own words, one concrete risk in the policy within 60 seconds of seeing the output.
- **Narrative:** The "salesperson pitch vs. document" mode produces at least one visibly striking contradiction on the sample policy used in the demo.

## 7. Data Sources

- **User-uploaded:** Policy PDF (digital-text PDF assumed for hackathon scope; scanned/OCR input is a stated future extension).
- **Static reference dataset:** IRDAI Annual Report claim settlement ratio by insurer (publicly published, updated yearly) — hardcoded as a lookup table for the hackathon build.
- **Seed taxonomy:** Hand-curated set of 12–15 health-insurance red/green flag patterns (see `03_RED_GREEN_FLAG_TAXONOMY.md`) — this taxonomy is the core defensible IP of the product.

## 8. Constraints & Principles

- **Never generate financial or legal advice.** The system flags and explains; it never tells a user what to do ("you should switch policies") — only what a clause means and what it could cost.
- **Every flag must cite its source clause.** No flag is shown without a traceable reference to the exact text/section it was derived from.
- **No fabricated numbers.** Settlement ratios and rupee-at-risk figures must derive from either the uploaded document or the static reference dataset — never model-generated estimates presented as fact.
- **Graceful degradation on low-confidence extraction.** If the model's confidence in parsing a clause is low, the UI must say so explicitly rather than silently guessing.
