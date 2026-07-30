# PolicyLens — Red/Green Flag Taxonomy (Health Insurance)

This is the core IP of the product. The flag engine is deterministic: extracted clause data is matched against these rules. The LLM's role is limited to (a) extracting the raw clause values from PDF text into the fields below, and (b) filling the plain-language template with those extracted values — it does not decide red/green on its own.

Severity scale used in the Policy Health Score: **Critical / High / Medium / Low**.

## Red Flags

| ID | Clause pattern | Trigger condition | Severity | Plain-language template |
|---|---|---|---|---|
| R01 | Room rent capping | Room rent limited to a % of sum insured or a fixed ₹/day amount, with proportionate deduction clause | High | "Your room rent is capped at {cap_value}. If you choose a room above this, the insurer proportionately reduces your ENTIRE claim, not just the room charge — this can cut a large claim significantly." |
| R02 | Disease-specific sub-limit | A named procedure/condition has a payout cap below the overall sum insured | Critical | "Your policy advertises {sum_insured} cover, but {procedure} is capped at {sub_limit_value}. You would pay the difference out of pocket." |
| R03 | Co-payment clause | Fixed % of every claim borne by the policyholder, especially age-linked co-pay | High | "You pay {co_pay_pct}% of every approved claim yourself. On a ₹2,00,000 claim, that's ₹{calculated_amount} from your pocket." |
| R04 | Pre-existing disease (PED) waiting period | Waiting period before PED-related claims are covered, especially if >2 years | Critical | "Conditions you already have won't be covered for {waiting_period} from policy start. A claim related to {condition} during this period will be rejected." |
| R05 | Initial waiting period | Standard 30-day exclusion on all claims except accidents | Medium | "Almost no claim (except accidental injury) is payable in the first 30 days of this policy." |
| R06 | Specific disease/procedure waiting period | 1–2 year wait for named conditions (cataract, hernia, joint replacement, etc.) | High | "{procedure} isn't covered until {waiting_period} into the policy, even though it's not a pre-existing condition." |
| R07 | Material non-disclosure clause | Broad insurer right to reject/void policy for any non-disclosure, however minor | Critical | "If any information in your application is later found incomplete — even unintentionally — the insurer can reject your claim or cancel the policy entirely." |
| R08 | "Sole discretion" / undefined-term language | Vague discretionary language governing claim decisions ("reasonable and customary charges," "at the company's discretion") | Medium | "This clause lets the insurer decide what counts as a valid or 'reasonable' charge without a defined standard — a common source of claim disputes." |
| R09 | Sub-limit on ambulance/daycare/pre-post hospitalization | Caps on ancillary costs commonly assumed to be fully covered | Low | "Ambulance/daycare charges are capped at {value}, separate from your main hospitalization cover." |
| R10 | Non-network hospital reduced payout | Lower reimbursement rate for treatment outside the insurer's hospital network | Medium | "If you're treated at a hospital outside {insurer}'s network, your payout could be reduced or require full upfront payment and reimbursement instead of cashless." |
| R11 | Renewal non-guarantee / loading clause | Insurer can increase premium sharply or impose new conditions at renewal based on claims history | Medium | "Making a claim this year could lead to a higher premium or added conditions at renewal — this isn't guaranteed to stay the same." |
| R12 | Permanent exclusions list | Named conditions/treatments never covered under any circumstance (e.g. certain congenital conditions, specific therapies) | High (context-dependent) | "{condition/treatment} is permanently excluded from this policy — it will never be covered, regardless of waiting period." |
| R13 | Claim intimation deadline | Short mandatory window (e.g. 24–48 hours) to notify insurer of hospitalization, with rejection risk for late intimation | Medium | "You must inform the insurer within {timeframe} of hospitalization or risk claim rejection on procedural grounds, even if the treatment itself was valid." |

## Green Flags

| ID | Clause pattern | Trigger condition | Plain-language template |
|---|---|---|---|
| G01 | No room rent capping | Explicit "no capping on room rent" or single private room allowed at actual cost | "There's no cap on your room choice — you can pick any room category without a proportional claim cut." |
| G02 | No co-payment | Explicit absence of co-pay clause for the buyer's age band | "You don't pay any percentage of your claims yourself — the full approved amount is covered." |
| G03 | Short PED waiting period | PED waiting period at or below industry-favorable benchmark (e.g. ≤2 years, or reducing with declared conditions) | "Pre-existing conditions are covered after just {waiting_period} — shorter than many comparable policies." |
| G04 | Restoration/refill benefit | Sum insured automatically restored after being exhausted within the policy year | "If you exhaust your cover, it automatically refills — you're not left uncovered for the rest of the year." |
| G05 | No sub-limits on named procedures | Full sum insured available for major procedures with no disease-specific cap | "Major procedures like {examples} are covered up to your full sum insured, with no hidden sub-limit." |
| G06 | Cumulative bonus / no-claim bonus | Sum insured increases each claim-free year at no extra premium | "Your cover grows automatically for every year you don't claim, at no extra cost." |
| G07 | Wide hospital network with cashless | Large network hospital list with cashless claim settlement as the default | "You can get cashless treatment at a wide network of hospitals — no need to pay upfront and claim reimbursement later." |

## Notes for the Extraction/Flagging Pipeline

- A single clause can trigger multiple flags (e.g. a sub-limit on a named procedure is both R02 and, if the procedure also has a waiting period, R06).
- Absence of a red-flag clause is not automatically a green flag — green flags require the *explicit favorable clause* to be present in the document, not merely the absence of the unfavorable one. This avoids false-positive green flags from incomplete extraction.
- Severity feeds directly into the Policy Health Score weighting: Critical = -25, High = -15, Medium = -8, Low = -3 (baseline 100, floor 0); each green flag = +5, capped contribution.
- This taxonomy is intentionally scoped to individual/family floater health insurance. Group/corporate health policies, motor, term, and life insurance each need their own taxonomy pass before extending PolicyLens to those verticals.
