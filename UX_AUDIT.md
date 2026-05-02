# Vayrity UX/Product Audit (Onboarding + Budgeting)

Date: 2026-05-02
Scope reviewed: single-page onboarding and budgeting experience in `src/App.jsx`.
Audience: working-class and business-owner users (20–50), including financially non-literate users.

## Top 10 UX/Product Issues

### 1) Core terms are not defined clearly enough (Bills vs Budget Categories vs Expense Tracking)
**Why it matters**
Users can easily double-count or misclassify spending. In this app, users enter fixed bills, budget category amounts, and later track expenses; these can overlap conceptually if not explicitly explained.

**Practical fix (MVP)**
- Add one-line definitions directly above each section:
  - **Bills:** fixed recurring monthly commitments (rent, utilities, subscriptions).
  - **Budget categories:** planned variable spending (groceries, transport, etc.).
  - **Expense tracking:** actual transactions you log during the month.
- Add an inline warning: “Don’t enter the same cost in both Bills and Budget categories.”

---

### 2) Onboarding asks for too much detail before proving value
**Why it matters**
The flow requires users to complete many fields/cards before they see outcomes. For low-confidence users, this increases drop-off.

**Practical fix (MVP)**
- Add a “Quick Plan” mode with only: income, top 3 bills, total debt minimums, savings target.
- Show provisional results after minimal input, then prompt users to refine.

---

### 3) Step validation messages are generic and not anchored to fields
**Why it matters**
Messages like “Please fix your details” force users to search manually, especially on mobile with long forms.

**Practical fix (MVP)**
- Replace generic errors with field-specific list + auto-scroll/focus to first invalid field.
- Add inline messages below invalid inputs (not only top-level gate messages).

---

### 4) Income model for self-employed users is mathematically conservative but conceptually opaque
**Why it matters**
The logic uses lowest-income vs 75% of average, but users may not understand why “income used in plan” is lower than what they entered. This can reduce trust.

**Practical fix (MVP)**
- Show a visible “Planning income used” row with formula explanation in plain English.
- Add a toggle: Conservative / Standard planning assumptions.

---

### 5) Savings goal setup is mixed between emergency fund and custom goals in one block
**Why it matters**
Users may not grasp whether emergency fund is mandatory, optional, or separate from custom goals (car, holiday, etc.). This harms goal clarity.

**Practical fix (MVP)**
- Split into two mini-steps:
  1) Safety buffer (emergency fund target)
  2) Optional personal goal + timeframe
- Use helper copy: “First protect your essentials, then fund your personal goal.”

---

### 6) Technical language may overwhelm financially non-literate users
**Why it matters**
Terms like avalanche/snowball, deficit/surplus, minimum payment, APR are useful but intimidating without context.

**Practical fix (MVP)**
- Add “What this means” tooltip text for each term in plain language.
- Rename visible labels where possible:
  - “Deficit” -> “You’re short this month”
  - “Surplus” -> “Money left after essentials”

---

### 7) Visual density and uppercase-heavy microcopy reduce readability, especially mobile
**Why it matters**
Frequent ultra-small uppercase labels and many card sections can reduce scannability and accessibility for users under stress.

**Practical fix (MVP)**
- Increase minimum form label size and reduce all-caps usage.
- Group related inputs into shorter chunks with progressive disclosure.
- Keep one primary CTA visible per screen (“Continue”).

---

### 8) Bills and debt entry workflows are card-heavy and can feel laborious
**Why it matters**
Adding many liabilities through repeated expand/collapse cards increases interaction cost and form fatigue.

**Practical fix (MVP)**
- Offer compact table/list mode for bulk entry (name + amount + optional details).
- Keep preset chips, but add quick-add rows for faster data entry.

---

### 9) No clear confidence indicator on result quality
**Why it matters**
Users may trust weak plans based on incomplete data, or distrust useful output when inputs are sparse.

**Practical fix (MVP)**
- Show “Plan confidence: Low / Medium / High” based on completed critical fields.
- Provide one-click actions to improve confidence (“Add bill amounts”, “Complete debt APR”).

---

### 10) Onboarding doesn’t explicitly normalize irregular real-life cash patterns
**Why it matters**
Working-class and business-owner users often deal with seasonal income, cash jobs, overdue bills, and lumpy costs. If unsupported, they may feel the app is “not for me.”

**Practical fix (Later, but start small in MVP copy)**
- Add optional prompts:
  - “Any irregular monthly costs?”
  - “Any months where income is usually lower?”
- Add reminder-based coaching for low-income months.

## Prioritization: MVP vs Later

## MVP Priority (ship first)
1. Clarify Bills vs Budget vs Expense Tracking with explicit definitions and anti-double-counting hint.
2. Add Quick Plan mode to reduce onboarding friction and time-to-value.
3. Improve validation UX (field-level errors + auto-scroll/focus).
4. Make self-employed income assumptions transparent (“planning income used”).
5. Separate emergency buffer from personal savings goal in UI flow.
6. Reduce confusing terms with plain-language labels/tooltips.

## Later Improvements (post-MVP)
1. Alternative dense-entry layouts (table mode for debts/bills).
2. Confidence scoring + guided completeness checklist.
3. Deeper irregular-income and seasonality workflows.
4. Broader content/accessibility polish (type scale, reduced visual noise, localized terminology variants).

## Suggested rollout approach
- **Week 1–2:** copy and validation improvements (lowest engineering risk, highest clarity gain).
- **Week 2–3:** Quick Plan mode + split savings setup.
- **Week 3–4:** self-employed transparency and confidence indicator.
- **Post-MVP:** advanced entry modes and seasonal-income features.
