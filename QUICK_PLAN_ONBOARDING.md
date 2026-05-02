# Vayrity Quick Plan Onboarding (MVP Design)

Date: 2026-05-02  
Goal: Generate a useful debt + savings plan in under 2–3 minutes with minimal cognitive load.

## 1) Recommended Onboarding Step Flow

## Step 0 — Welcome + expectation setting (10–15 sec)
**Purpose:** reduce anxiety and prime user for short flow.

- Headline: **“Get a money plan in under 3 minutes.”**
- Subtext: “You only need a few numbers now. You can add detail later.”
- CTA: **Start Quick Plan**
- Secondary text button: “I want full setup” (optional; can be hidden in MVP)

---

## Step 1 — Income (30–45 sec)
**Purpose:** capture safe planning income for regular + variable earners.

1) Income type
- Options:
  - Regular pay
  - Self-employed / variable pay

2) Income amount + period
- Input: amount
- Segmented period: monthly / weekly / every 2 weeks / yearly

3) If variable income selected, show one additional field:
- “Lowest month income (optional but recommended)” with helper text.

**Immediate output shown on this step:**
- “We’ll plan using: £X/month” (or selected currency), with plain-language explanation.

---

## Step 2 — Bills (35–45 sec)
**Purpose:** capture fixed essentials separately from flexible spending.

- Prompt: “Add your fixed monthly bills (rent, utilities, phone, insurance).”
- Input mode: **quick rows** (name + amount), not nested cards.
- Preset chips for common bills (Rent, Energy, Water, Internet, Phone).
- Optional shortcut: “Enter total bills only” toggle if user is in a hurry.

**Definition shown inline:**
- “Bills = fixed monthly commitments.”

---

## Step 3 — Flexible spending (25–35 sec)
**Purpose:** keep a simple variable spending estimate without category overload.

- Default mode (MVP): single field
  - “Flexible spending total per month”
- Optional expand link:
  - “Break this into categories” (Groceries, Transport, Eating out, etc.)

**Definition shown inline:**
- “Flexible spending = day-to-day spending that changes month to month.”

---

## Step 4 — Debt snapshot (30–45 sec)
**Purpose:** preserve debt planning with minimum viable detail.

For each debt (quick add rows):
- Debt name (e.g., credit card)
- Balance
- Minimum monthly payment
- APR (optional in Quick Plan, required later for advanced payoff accuracy)

If APR missing:
- Show neutral note: “We can still estimate your plan. Add APR later for more accurate payoff timing.”

---

## Step 5 — Savings goal (20–30 sec)
**Purpose:** clearly separate safety buffer from personal goal.

Two mini blocks on one screen:
1) **Safety buffer (recommended)**
- “Emergency buffer target” (pre-filled smart default)

2) **Personal goal (optional)**
- Goal type (car / holiday / business / other)
- Target amount (optional)
- Target timeframe months (optional)

---

## Step 6 — Quick Plan results (instant)
**Purpose:** give value early; reduce abandonment.

Show only 4 primary cards first:
1) Monthly money left / short
2) Recommended debt payment focus
3) Recommended monthly savings amount
4) One “next best action”

Secondary CTA:
- “Improve plan accuracy” -> opens advanced details flow.

---

## 2) Required vs Optional Fields

## Required (Quick Plan MVP)
- Income type (regular vs variable)
- Income amount + period
- Bills total or at least one bill entry
- Flexible spending total
- At least one debt row **OR** explicit “I have no debt” selection
- Emergency buffer target (pre-filled default can count as completed if unchanged)

## Optional (Quick Plan MVP)
- Lowest month income (for variable users)
- Bill-by-bill detail (if total provided)
- Flexible spending categories breakdown
- Debt APR
- Personal savings goal amount + timeframe

## Deferred to full setup (not required pre-result)
- Expense tracking logs
- Weekly check-ins
- Monthly review journal
- Detailed debt strategy comparison UI

## 3) Suggested UX Copy for Each Step

## Step 0
- Title: **“Build your plan in under 3 minutes”**
- Body: “Start simple now. You can add more detail later.”
- CTA: **“Start Quick Plan”**

## Step 1
- Title: **“What income can you safely plan with?”**
- Helper (regular): “Use your usual take-home pay.”
- Helper (variable): “Use an average month. If income changes, add your lowest month too.”
- Confirmation text: “Your plan will use **£X/month** so it works in tougher months.”

## Step 2
- Title: **“Add fixed monthly bills”**
- Definition: “Bills are costs that stay mostly the same each month.”
- Warning copy: “Don’t include groceries or day-to-day spending here.”

## Step 3
- Title: **“Estimate day-to-day spending”**
- Definition: “Flexible spending changes month to month (food, transport, personal spending).”
- Hint: “A rough number is okay — you can refine later.”

## Step 4
- Title: **“Add your debt snapshot”**
- Helper: “Just the basics for now: balance + minimum payment.”
- APR helper: “APR improves accuracy but is optional for Quick Plan.”

## Step 5
- Title: **“Set your savings direction”**
- Buffer copy: “First, protect yourself with a safety buffer.”
- Personal goal copy: “Then choose an optional goal to work toward.”

## Step 6
- Title: **“Here’s your starter plan”**
- Body: “This is your best next move based on the numbers you entered.”
- CTA 1: **“Use this plan”**
- CTA 2: **“Improve accuracy”**

## 4) Mobile UX Recommendations

- Keep each step to **one primary question** with progressive reveal.
- Use sticky bottom CTA (“Continue”) with disabled state + short inline reason.
- Prefer segmented controls and preset chips over dropdown-heavy UI.
- Replace complex cards with compact rows in Quick Plan screens.
- Keep label font sizes readable; reduce all-caps and dense microcopy.
- Keep estimated completion status visible (e.g., “Step 2 of 6 • ~1:45 left”).
- Auto-focus first input and use numeric keypad for money fields.
- Auto-save each step and allow resume.

## 5) MVP Implementation Recommendation

## A. Add a Quick Plan mode toggle at onboarding start
- Route users by default into Quick Plan.
- Keep existing full onboarding as advanced path.

## B. Reuse existing data model; simplify collection UI
- Continue writing into existing `state` structure (`income`, `incomeType`, `lowestIncome`, `bills`, `budgetCategories`, `debts`, `savings`).
- In Quick Plan, collect fewer fields and store safe defaults for missing optional details.

## C. Gate complexity behind “Improve accuracy”
- After results, prompt users to add:
  - APR for each debt
  - category-level flexible spending
  - detailed bill line items

## D. Validation strategy for MVP
- Block only on truly required fields.
- For optional-but-useful fields, show nudges not blockers.
- Show field-level errors + auto-scroll to first invalid field.

## E. Suggested delivery slices (startup-friendly)
1. **Sprint 1:** Quick Plan stepper, minimal fields, starter results.
2. **Sprint 2:** improved validation + copy + mobile polish.
3. **Sprint 3:** post-result “Improve accuracy” prompts and progressive detail capture.

## 6) Existing Onboarding Sections: Collapse / Hide / Delay / Remove

Based on current onboarding structure in `src/App.jsx`:

## Collapse in Quick Plan
- Detailed budget category editing UI (keep as optional expand from flexible total).
- Debt strategy comparison controls (avalanche vs snowball) during onboarding.

## Hide during initial Quick Plan (show post-result)
- Expense tracking entry UI.
- Weekly check-in forms.
- Monthly review forms.
- Print/export controls.

## Delay until after first result
- Full debt card expansion fields beyond balance/min payment (APR can remain optional).
- Detailed savings timeframe tuning (show only if user opts into personal goal).

## Remove from initial path (MVP Quick Plan)
- Any non-essential educational text that increases scroll length without helping completion.
- Duplicate explanatory copy when the same concept is already defined in step header/helper text.

## Keep visible in Quick Plan MVP (must-have)
- Separate sections for: Income, Bills, Flexible Spending, Debt, Savings.
- Plain-language definitions for Bills vs Flexible Spending.
- Clear “You can add detail later” reassurance on every step.
