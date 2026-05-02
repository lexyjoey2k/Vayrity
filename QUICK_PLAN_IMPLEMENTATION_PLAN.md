# Quick Plan Implementation Plan (Vayrity React App)

Date: 2026-05-02  
Scope: Add a new Quick Plan onboarding mode into the existing `src/App.jsx` flow with minimal engineering complexity.

## Guiding constraints
- Reuse current `state` shape and calculations.
- Keep the existing full onboarding path available.
- Make Quick Plan the default path for new users.
- Avoid broad refactors before proving product value.

---

## 1) Recommended Component Structure

Use a **thin mode wrapper** around existing onboarding logic rather than a rewrite.

## A. Keep `App` as orchestrator (MVP)
Inside `App`, introduce:
- `onboardingMode` state: `'quick' | 'full'`
- `quickStep` state for Quick Plan step index
- existing `step` state remains for full flow

## B. Add lightweight view components
Create a small onboarding folder (or keep in `App.jsx` initially for speed):
- `QuickPlanWelcomeStep`
- `QuickPlanIncomeStep`
- `QuickPlanBillsStep`
- `QuickPlanFlexibleStep`
- `QuickPlanDebtStep`
- `QuickPlanSavingsStep`
- `QuickPlanResultsGate` (button/card to run existing results)

These should be simple presentational wrappers using existing input patterns.

## C. Shared primitives (reuse existing where possible)
- Reuse `InputField`, `MetricCard`, button styles, and existing preset chips style patterns.
- Reuse existing validation helpers (`isFilled`, `toNumber`, `isNegative`).

---

## 2) Existing Components/State to Reuse

## State/data model to reuse as-is
- `state.income`
- `state.incomeType`
- `state.lowestIncome`
- `state.bills`
- `state.budgetCategories`
- `state.debts`
- `state.savings`
- `incomePeriod`

## Calculation logic to reuse as-is
- `totals` memo (income normalization + monthly totals)
- `calculateMonthlyPlan(...)`
- `calculateTrimSuggestions(...)`
- `buildResultActions(...)`
- savings projection and payoff helpers

## Reuse rule
Quick Plan should **only** change how data is collected, not how plans are calculated.

---

## 3) Onboarding Sections to Make Optional/Hidden in Quick Plan

## Hidden during Quick Plan initial pass
- Expense tracking UI
- Weekly check-ins
- Monthly reviews
- PDF/export affordances
- Deep debt strategy comparison UI (avalanche/snowball toggle)

## Optional in Quick Plan
- Debt APR (can be entered later)
- Detailed budget category breakdown
- Bill-by-bill detail (allow “total bills” shortcut)
- Personal goal timeframe detail

## Kept required in Quick Plan
- Income + period
- Bills (at least total)
- Flexible spending (at least total)
- Debt snapshot (or explicit no debt)
- Emergency/safety target (pre-filled default is acceptable)

---

## 4) Suggested Routing / Step Management Approach

Use **single-route conditional stepper** for MVP.

## Why
- Lowest complexity: no new router dependencies or deep navigation rewrites.
- Keeps local state behavior, existing persistence, and validation patterns intact.

## Suggested approach
1. Add onboarding entry selector screen (very small):
   - default button: “Start Quick Plan”
   - secondary link: “Use full setup instead”
2. If mode=`quick`, render Quick Plan steps based on `quickStep`.
3. If mode=`full`, use existing `step` flow unchanged.
4. On Quick Plan completion, set the existing results step (`setStep(5)` or equivalent display flag).

## Persistence behavior
- Save `onboardingMode` + `quickStep` in localStorage with existing payload.
- If partially complete Quick Plan exists, resume where user left off.

---

## 5) Data-Flow Recommendations

## A. Write directly into existing state
Quick Plan inputs should call existing `setState` mutations and handlers where possible.

## B. Minimal adapter for flexible spending total
When user provides one “flexible total” number:
- Store it in a dedicated existing category (e.g., `Other` non-essential or new `Flexible Spending` category) to avoid calculation changes.
- Mark that category with a lightweight flag if needed (e.g., metadata field) but avoid changing calculation contracts.

## C. Minimal adapter for “total bills only”
If user enters a single total:
- Store as one bill row (`name: 'Total Bills'`, `amount: X`) so existing bill sums work unchanged.

## D. Debt without APR
If APR omitted:
- keep APR as empty/0 in state and show “estimate confidence” note in UI.
- Do not block results generation if balance + min payment exist.

---

## 6) Recommended Implementation Order (MVP)

## Phase 1: Foundation (lowest risk)
1. Add `onboardingMode` + `quickStep` states.
2. Add onboarding entry selector (Quick default, Full secondary).
3. Add simple Quick Plan step shell with Back/Continue controls.

## Phase 2: Quick Plan data capture
4. Implement Income step (including variable income optional lowest month).
5. Implement Bills step with row entry + total shortcut.
6. Implement Flexible spending single total step.
7. Implement Debt snapshot step.
8. Implement Savings step (emergency target + optional personal goal).

## Phase 3: Validation + results handoff
9. Add lightweight Quick validation per step (only required fields).
10. Wire completion to existing results generation path.
11. Add “Improve accuracy” prompts linking to full sections.

## Phase 4: Polish
12. Mobile UX tweaks (sticky CTA, numeric keypad, progress text).
13. Resume behavior + autosave checks.

---

## 7) What NOT to Refactor Yet

To keep complexity low, avoid these during MVP:
- Do not split all logic in `App.jsx` into a new architecture yet.
- Do not replace existing calculation engine.
- Do not redesign debt payoff strategy internals.
- Do not migrate to multi-route wizard architecture now.
- Do not introduce a new global state library.
- Do not rebuild expense tracking/check-in/review features.

These can follow once Quick Plan conversion impact is validated.

---

## 8) Risks / Edge Cases to Watch

## Data correctness
- Double counting risk between bills and flexible total; include clear copy guardrails.
- “Total bills” placeholder row might coexist with detailed bills later; need merge/replace behavior.

## Validation gaps
- Empty debt arrays should require explicit “I have no debt” confirmation.
- Variable income users may skip lowest month and get optimistic plans; keep conservative fallback visible.

## UX consistency
- Switching between quick and full mode mid-onboarding can create confusing partial data states.
- Step resume from localStorage must handle stale schema safely.

## Calculation compatibility
- Flexible-total mapping into categories must remain compatible with existing essential/non-essential totals.
- Missing APR should not break payoff rendering paths.

## Recommended mitigations
- Add a small “Quick Plan assumptions” summary before results.
- Add post-result “Improve accuracy” checklist (APR, category split, bill details).
- Add one migration guard for old saved onboarding payloads.

---

## MVP Success Criteria
- New users reach first usable plan in under ~3 minutes.
- No regression in existing results calculations.
- Full onboarding remains accessible.
- Quick Plan completion-to-results conversion improves vs current baseline.
