import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Wallet,
  PenLine,
  Info,
  PiggyBank,
  CalendarClock,
  Target,
} from 'lucide-react';

// --- Constants ---
const STORAGE_KEY = 'vayrity_app_data_v13';
const LEGACY_STORAGE_KEYS = ['vayrity_app_data_v12'];

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'NGN', symbol: '₦' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

const BILL_PRESETS = [
  'Rent',
  'Council Tax',
  'Energy',
  'Water',
  'Internet',
  'Phone',
  'Gym',
  'Streaming',
];

const DEBT_PRESETS = [
  'Credit Card',
  'Loan',
  'Overdraft',
  'Car Finance',
  'Buy Now Pay Later',
];

const BUDGET_CATEGORY_PRESETS = [
  { name: 'Groceries', type: 'essential' },
  { name: 'Transport', type: 'essential' },
  { name: 'Eating Out', type: 'non-essential' },
  { name: 'Childcare', type: 'essential' },
  { name: 'Personal Care', type: 'essential' },
  { name: 'Entertainment', type: 'non-essential' },
  { name: 'Shopping', type: 'non-essential' },
  { name: 'Other', type: 'essential' },
];

const DEFAULT_EMERGENCY_FUND_FLOOR = 500;
const PAYOFF_STRATEGIES = {
  avalanche: 'avalanche',
  snowball: 'snowball',
};

const PAYOFF_TARGET_MONTHS = [6, 12, 24];

const createBudgetCategory = (name = '', type = 'essential') => ({
  id: crypto.randomUUID(),
  name: name || 'New Category',
  amount: '',
  type,
});

const createDebt = (name = '') => ({
  id: crypto.randomUUID(),
  name: name || 'New Debt',
  balance: '',
  interest: '',
  minPayment: '',
});

const createBill = (name = '') => ({
  id: crypto.randomUUID(),
  name: name || 'New Bill',
  amount: '',
});

// --- Helpers ---
const isFilled = (value) =>
  value !== '' && value !== null && value !== undefined;

const toNumber = (value) => {
  if (!isFilled(value)) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNegative = (value) => isFilled(value) && toNumber(value) < 0;

const roundMoney = (value) => Math.round((toNumber(value) || 0) * 100) / 100;

const ceilMoney = (value) => Math.ceil(toNumber(value) || 0);

const clamp = (value, min, max) =>
  Math.min(Math.max(toNumber(value), min), max);

const formatMonthsLabel = (months) => {
  if (!Number.isFinite(months) || months <= 0) return '0 months';
  return `${months} month${months === 1 ? '' : 's'}`;
};

const getMonthsFromNowLabel = (months) => {
  if (!Number.isFinite(months) || months <= 0) return 'now';
  if (months < 12) return `in ${formatMonthsLabel(months)}`;

  const years = Math.floor(months / 12);
  const remainder = months % 12;

  if (remainder === 0) {
    return `in ${years} year${years === 1 ? '' : 's'}`;
  }

  return `in ${years} year${years === 1 ? '' : 's'} ${remainder} month${
    remainder === 1 ? '' : 's'
  }`;
};

const sumBy = (items, selector) =>
  items.reduce((sum, item) => sum + toNumber(selector(item)), 0);

const sortDebtsByStrategy = (debts, strategy = PAYOFF_STRATEGIES.avalanche) => {
  const activeDebts = debts.filter((d) => toNumber(d.balance) > 0.01);

  if (strategy === PAYOFF_STRATEGIES.snowball) {
    return [...activeDebts].sort((a, b) => {
      const balanceDiff = toNumber(a.balance) - toNumber(b.balance);
      if (balanceDiff !== 0) return balanceDiff;

      const interestDiff = toNumber(b.interest) - toNumber(a.interest);
      if (interestDiff !== 0) return interestDiff;

      return (a.name || '').localeCompare(b.name || '');
    });
  }

  return [...activeDebts].sort((a, b) => {
    const aprDiff = toNumber(b.interest) - toNumber(a.interest);
    if (aprDiff !== 0) return aprDiff;

    const balanceDiff = toNumber(a.balance) - toNumber(b.balance);
    if (balanceDiff !== 0) return balanceDiff;

    return (a.name || '').localeCompare(b.name || '');
  });
};

const getRecommendedEmergencyTarget = (state) => {
  const billsTotal = sumBy(state.bills || [], (bill) => bill.amount);
  const essentialBudgetTotal = sumBy(
    (state.budgetCategories || []).filter((category) => category.type === 'essential'),
    (category) => category.amount
  );
  const minimumDebtTotal = sumBy(state.debts || [], (debt) => debt.minPayment);

  const baseMonthlyEssentials = billsTotal + essentialBudgetTotal + minimumDebtTotal;

  if (baseMonthlyEssentials <= 0) {
    return DEFAULT_EMERGENCY_FUND_FLOOR;
  }

  return Math.max(
    DEFAULT_EMERGENCY_FUND_FLOOR,
    Math.round(baseMonthlyEssentials)
  );
};

const normalizeLoadedState = (parsed) => {
  const fallbackBudgetCategories = [
    createBudgetCategory('Groceries', 'essential'),
    createBudgetCategory('Transport', 'essential'),
    createBudgetCategory('Eating Out', 'non-essential'),
    createBudgetCategory('Other', 'essential'),
  ];

  let migratedBudgetCategories = parsed?.budgetCategories;

  if (
    (!Array.isArray(parsed?.budgetCategories) ||
      parsed?.budgetCategories?.length === 0) &&
    isFilled(parsed?.everydaySpending)
  ) {
    migratedBudgetCategories = [
      {
        id: crypto.randomUUID(),
        name: 'General Spending',
        amount: parsed.everydaySpending,
        type: 'essential',
      },
    ];
  }

  if (
    !Array.isArray(migratedBudgetCategories) ||
    migratedBudgetCategories.length === 0
  ) {
    migratedBudgetCategories = fallbackBudgetCategories;
  }

  const normalizedBudgetCategories = migratedBudgetCategories.map((category) => ({
    id: category.id || crypto.randomUUID(),
    name: category.name || 'New Category',
    amount: category.amount ?? '',
    type: category.type === 'non-essential' ? 'non-essential' : 'essential',
  }));

  const normalizedDebts = Array.isArray(parsed?.debts)
    ? parsed.debts.map((debt) => ({
        id: debt.id || crypto.randomUUID(),
        name: debt.name || 'New Debt',
        balance: debt.balance ?? '',
        interest: debt.interest ?? '',
        minPayment: debt.minPayment ?? '',
      }))
    : [];

  const normalizedBills = Array.isArray(parsed?.bills)
    ? parsed.bills.map((bill) => ({
        id: bill.id || crypto.randomUUID(),
        name: bill.name || 'New Bill',
        amount: bill.amount ?? '',
      }))
    : [];

  return {
    currency: parsed?.currency || 'GBP',
    income: parsed?.income ?? '',
    budgetCategories: normalizedBudgetCategories,
    debts: normalizedDebts,
    bills: normalizedBills,
    savings: {
      current: parsed?.savings?.current ?? '',
      emergencyTarget:
        parsed?.savings?.emergencyTarget ?? DEFAULT_EMERGENCY_FUND_FLOOR,
    },
  };
};

const loadSavedState = () => {
  const possibleKeys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];

  for (const key of possibleKeys) {
    const saved = localStorage.getItem(key);
    if (!saved) continue;

    try {
      const parsed = JSON.parse(saved);
      return normalizeLoadedState(parsed);
    } catch (error) {
      console.error('Failed to load saved state', error);
    }
  }

  return null;
};

const calculateDebtPayoff = (balance, apr, monthlyPayment) => {
  const principal = toNumber(balance);
  const annualRate = toNumber(apr);
  const payment = toNumber(monthlyPayment);

  if (principal <= 0 || payment <= 0) {
    return { valid: false, reason: 'missing_values' };
  }

  const monthlyRate = annualRate / 100 / 12;
  let remainingBalance = principal;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600;

  while (remainingBalance > 0.01 && months < maxMonths) {
    const interestForMonth = remainingBalance * monthlyRate;

    if (payment <= interestForMonth && monthlyRate > 0) {
      return { valid: false, reason: 'payment_too_low' };
    }

    remainingBalance += interestForMonth;
    totalInterest += interestForMonth;

    const actualPayment = Math.min(payment, remainingBalance);
    remainingBalance -= actualPayment;
    months += 1;
  }

  if (months >= maxMonths) {
    return { valid: false, reason: 'too_long' };
  }

  return {
    valid: true,
    months,
    totalInterest: roundMoney(totalInterest),
  };
};

const calculateMinimumPaymentToReduce = (balance, apr) => {
  const principal = toNumber(balance);
  const annualRate = toNumber(apr);

  if (principal <= 0 || annualRate <= 0) return null;

  const monthlyRate = annualRate / 100 / 12;
  return ceilMoney(principal * monthlyRate);
};

const calculateRequiredMonthlyPayment = (balance, apr, targetMonths) => {
  const principal = toNumber(balance);
  const annualRate = toNumber(apr);
  const monthsTarget = toNumber(targetMonths);

  if (principal <= 0 || monthsTarget <= 0) {
    return { valid: false, reason: 'missing_values' };
  }

  let low = 0;
  let high = Math.max(principal * 0.25, 1);

  let safety = 0;
  while (safety < 60) {
    const test = calculateDebtPayoff(principal, annualRate, high);
    if (test.valid && test.months <= monthsTarget) break;
    high *= 2;
    safety += 1;
  }

  if (safety >= 60) {
    return { valid: false, reason: 'too_long' };
  }

  for (let i = 0; i < 70; i += 1) {
    const mid = (low + high) / 2;
    const result = calculateDebtPayoff(principal, annualRate, mid);

    if (!result.valid || result.months > monthsTarget) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const requiredPayment = ceilMoney(high);
  const finalEstimate = calculateDebtPayoff(principal, annualRate, requiredPayment);

  return {
    valid: finalEstimate.valid,
    monthlyPayment: requiredPayment,
    months: finalEstimate.valid ? finalEstimate.months : null,
    totalInterest: finalEstimate.valid ? finalEstimate.totalInterest : null,
  };
};

const calculatePortfolioPayoff = (
  debts,
  extraMonthly = 0,
  strategy = PAYOFF_STRATEGIES.avalanche
) => {
  const cleanedDebts = debts
    .map((debt) => ({
      id: debt.id,
      name: debt.name || 'Debt',
      balance: roundMoney(debt.balance),
      interest: toNumber(debt.interest),
      minPayment: roundMoney(debt.minPayment),
    }))
    .filter((debt) => debt.balance > 0);

  if (cleanedDebts.length === 0) {
    return {
      valid: true,
      months: 0,
      totalInterest: 0,
      payoffOrder: [],
      payoffMoments: [],
      monthlySnapshots: [],
      strategy,
    };
  }

  if (
    cleanedDebts.some(
      (debt) =>
        debt.balance < 0 || debt.interest < 0 || debt.minPayment < 0
    )
  ) {
    return { valid: false, reason: 'invalid_values' };
  }

  let debtsState = cleanedDebts.map((debt) => ({ ...debt }));
  let months = 0;
  let totalInterest = 0;
  let freedPaymentPool = 0;
  const payoffOrder = [];
  const payoffMoments = [];
  const monthlySnapshots = [];
  const maxMonths = 600;

  while (debtsState.some((debt) => debt.balance > 0.01) && months < maxMonths) {
    months += 1;

    for (const debt of debtsState) {
      if (debt.balance <= 0.01) continue;

      const monthlyRate = debt.interest / 100 / 12;
      const interestForMonth = debt.balance * monthlyRate;

      if (monthlyRate > 0 && debt.minPayment <= interestForMonth) {
        return { valid: false, reason: 'payment_too_low' };
      }

      debt.balance = roundMoney(debt.balance + interestForMonth);
      totalInterest += interestForMonth;
    }

    const activeDebts = debtsState.filter((debt) => debt.balance > 0.01);
    const totalAvailableExtra = roundMoney(toNumber(extraMonthly) + freedPaymentPool);

    for (const debt of activeDebts) {
      const payment = Math.min(debt.minPayment, debt.balance);
      debt.balance = roundMoney(debt.balance - payment);
    }

    let remainingExtra = totalAvailableExtra;

    while (remainingExtra > 0.01) {
      const sortedActive = sortDebtsByStrategy(debtsState, strategy);
      const targetDebt = sortedActive[0];
      if (!targetDebt) break;

      const payment = Math.min(remainingExtra, targetDebt.balance);
      targetDebt.balance = roundMoney(targetDebt.balance - payment);
      remainingExtra = roundMoney(remainingExtra - payment);
    }

    for (const debt of debtsState) {
      if (debt.balance <= 0.01 && !payoffOrder.includes(debt.id)) {
        debt.balance = 0;
        payoffOrder.push(debt.id);
        freedPaymentPool = roundMoney(freedPaymentPool + debt.minPayment);
        payoffMoments.push({
          id: debt.id,
          name: debt.name,
          month: months,
          freedPayment: debt.minPayment,
        });
      }
    }

    monthlySnapshots.push({
      month: months,
      totalBalance: roundMoney(sumBy(debtsState, (debt) => debt.balance)),
      activeDebts: debtsState.filter((debt) => debt.balance > 0.01).length,
      snowballPool: roundMoney(freedPaymentPool + toNumber(extraMonthly)),
    });
  }

  if (months >= maxMonths) {
    return { valid: false, reason: 'too_long' };
  }

  return {
    valid: true,
    strategy,
    months,
    totalInterest: roundMoney(totalInterest),
    payoffOrder,
    payoffMoments,
    monthlySnapshots,
  };
};

const calculateSavingsDebtBlend = (state, totals) => {
  const currentSavings = toNumber(state.savings?.current);
  const userEmergencyTarget = toNumber(state.savings?.emergencyTarget);
  const recommendedEmergencyTarget = getRecommendedEmergencyTarget(state);
  const emergencyTarget = Math.max(
    userEmergencyTarget || DEFAULT_EMERGENCY_FUND_FLOOR,
    DEFAULT_EMERGENCY_FUND_FLOOR
  );

  const effectiveEmergencyTarget = Math.max(
    emergencyTarget,
    Math.min(recommendedEmergencyTarget, emergencyTarget * 3 || recommendedEmergencyTarget)
  );

  const emergencyGap = Math.max(0, effectiveEmergencyTarget - currentSavings);
  const remaining = toNumber(totals.remaining);
  const validDebts = (state.debts || []).filter((debt) => toNumber(debt.balance) > 0);

  return {
    currentSavings,
    emergencyTarget,
    effectiveEmergencyTarget,
    recommendedEmergencyTarget,
    emergencyGap,
    remaining,
    validDebts,
    hasDebt: validDebts.length > 0,
  };
};

const calculateMonthlyPlan = (
  state,
  totals,
  strategy = PAYOFF_STRATEGIES.avalanche
) => {
  const {
    currentSavings,
    emergencyTarget,
    effectiveEmergencyTarget,
    recommendedEmergencyTarget,
    emergencyGap,
    remaining,
    validDebts,
    hasDebt,
  } = calculateSavingsDebtBlend(state, totals);

  if (remaining <= 0) {
    return {
      type: 'deficit',
      strategy,
      surplus: remaining,
      currentSavings,
      emergencyTarget,
      effectiveEmergencyTarget,
      recommendedEmergencyTarget,
      emergencyGap,
      savingsAllocation: 0,
      debtAllocation: 0,
      debtPlan: [],
      debtTimeline: null,
      debtTimelineWithoutExtra: hasDebt
        ? calculatePortfolioPayoff(state.debts, 0, strategy)
        : null,
      emergencyFundMonths: null,
      actionHeadline: 'Stabilise your monthly cash flow first',
      explanation:
        'Focus first on reducing flexible spending or increasing income before accelerating debt payments.',
      actions: [
        'Keep all minimum debt payments current.',
        'Reduce flexible spending to remove the monthly shortfall.',
        'Once you are back to break-even, redirect freed cash into savings and debt payoff.',
      ],
    };
  }

  let savingsAllocation = 0;
  let debtAllocation = 0;

  if (!hasDebt) {
    savingsAllocation = roundMoney(remaining);
    debtAllocation = 0;
  } else if (emergencyGap > 0) {
    const bufferWeight =
      currentSavings < DEFAULT_EMERGENCY_FUND_FLOOR
        ? 0.65
        : currentSavings < effectiveEmergencyTarget * 0.5
        ? 0.45
        : 0.25;

    savingsAllocation = Math.min(
      roundMoney(Math.max(25, remaining * bufferWeight)),
      emergencyGap
    );

    debtAllocation = Math.max(0, roundMoney(remaining - savingsAllocation));
  } else {
    savingsAllocation = roundMoney(Math.min(Math.max(remaining * 0.15, 25), remaining * 0.3));
    debtAllocation = Math.max(0, roundMoney(remaining - savingsAllocation));
  }

  if (hasDebt && debtAllocation <= 0 && remaining > 0) {
    debtAllocation = Math.min(roundMoney(remaining), 1);
    savingsAllocation = Math.max(0, roundMoney(remaining - debtAllocation));
  }

  const sortedDebts = sortDebtsByStrategy(validDebts, strategy);
  const targetDebtId = sortedDebts[0]?.id;

  const debtPlan = sortedDebts.map((debt) => {
    const minPayment = toNumber(debt.minPayment);
    const extraPayment = debt.id === targetDebtId ? roundMoney(debtAllocation) : 0;
    const totalPlanned = roundMoney(minPayment + extraPayment);
    const standalonePayoff = calculateDebtPayoff(
      debt.balance,
      debt.interest,
      totalPlanned
    );

    return {
      id: debt.id,
      name: debt.name || 'Debt',
      balance: toNumber(debt.balance),
      interest: toNumber(debt.interest),
      minPayment,
      extraPayment,
      totalPlanned,
      payoffEstimate: standalonePayoff,
      isPriority: debt.id === targetDebtId,
    };
  });

  const debtTimeline = hasDebt
    ? calculatePortfolioPayoff(state.debts, debtAllocation, strategy)
    : {
        valid: true,
        months: 0,
        totalInterest: 0,
        payoffOrder: [],
        payoffMoments: [],
        monthlySnapshots: [],
        strategy,
      };

  const debtTimelineWithoutExtra = hasDebt
    ? calculatePortfolioPayoff(state.debts, 0, strategy)
    : {
        valid: true,
        months: 0,
        totalInterest: 0,
        payoffOrder: [],
        payoffMoments: [],
        monthlySnapshots: [],
        strategy,
      };

  const interestSavedVsMinimums =
    debtTimeline.valid && debtTimelineWithoutExtra.valid
      ? Math.max(
          0,
          roundMoney(
            toNumber(debtTimelineWithoutExtra.totalInterest) -
              toNumber(debtTimeline.totalInterest)
          )
        )
      : 0;

  const monthsSavedVsMinimums =
    debtTimeline.valid && debtTimelineWithoutExtra.valid
      ? Math.max(
          0,
          toNumber(debtTimelineWithoutExtra.months) - toNumber(debtTimeline.months)
        )
      : 0;

  const emergencyFundMonths =
    emergencyGap > 0 && savingsAllocation > 0
      ? Math.ceil(emergencyGap / savingsAllocation)
      : emergencyGap <= 0
      ? 0
      : null;

  const firstPayoffMoment = debtTimeline?.payoffMoments?.[0] || null;
  const actionHeadline =
    emergencyGap > 0
      ? 'Build a safety buffer while still speeding up debt payoff'
      : 'Keep savings alive while pushing surplus into debt payoff';

  const explanation =
    emergencyGap > 0
      ? 'This plan protects momentum in two ways: it builds your emergency buffer so you are less likely to borrow again, while still targeting your most efficient debt payoff path.'
      : 'This plan keeps a smaller savings habit in place while directing most of your spare cash to the debt strategy that clears interest fastest.';

  const actions = [];

  if (savingsAllocation > 0) {
    actions.push(
      emergencyGap > 0
        ? `Move ${savingsAllocation} per month into savings until your buffer reaches ${effectiveEmergencyTarget}.`
        : `Keep setting aside ${savingsAllocation} per month so savings continue to grow.`
    );
  }

  if (debtPlan.length > 0) {
    const focusDebt = debtPlan.find((debt) => debt.isPriority);
    if (focusDebt) {
      actions.push(
        `Pay all debt minimums, then send the extra ${debtAllocation} to ${focusDebt.name}.`
      );
    }
  }

  if (firstPayoffMoment) {
    actions.push(
      `Your first likely payoff is ${firstPayoffMoment.name} ${getMonthsFromNowLabel(
        firstPayoffMoment.month
      )}. Roll that freed payment into the next debt automatically.`
    );
  }

  return {
    type: 'surplus',
    strategy,
    surplus: remaining,
    currentSavings,
    emergencyTarget,
    effectiveEmergencyTarget,
    recommendedEmergencyTarget,
    emergencyGap,
    savingsAllocation,
    debtAllocation,
    debtPlan,
    debtTimeline,
    debtTimelineWithoutExtra,
    emergencyFundMonths,
    interestSavedVsMinimums,
    monthsSavedVsMinimums,
    actionHeadline,
    explanation,
    actions,
  };
};

const calculateTrimSuggestions = (totals, categories) => {
  const deficit = Math.abs(Math.min(0, toNumber(totals.remaining)));
  const flexibleCategories = [...categories]
    .filter(
      (category) =>
        category.type === 'non-essential' && toNumber(category.amount) > 0
    )
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));

  if (deficit <= 0 || flexibleCategories.length === 0) {
    return {
      deficit: 0,
      suggestions: [],
      totalSuggested: 0,
      covered: true,
      remainingGap: 0,
      quickWin: null,
    };
  }

  let remainingGap = deficit;

  const suggestions = flexibleCategories.map((category) => {
    const currentAmount = toNumber(category.amount);

    const suggestedTrim =
      remainingGap > 0
        ? Math.min(
            currentAmount,
            Math.max(
              Math.ceil(currentAmount * 0.15),
              Math.min(remainingGap, Math.ceil(currentAmount * 0.35))
            )
          )
        : 0;

    remainingGap = Math.max(0, roundMoney(remainingGap - suggestedTrim));

    return {
      id: category.id,
      name: category.name,
      currentAmount,
      suggestedTrim,
      newAmount: Math.max(0, roundMoney(currentAmount - suggestedTrim)),
      percentTrim:
        currentAmount > 0 ? Math.round((suggestedTrim / currentAmount) * 100) : 0,
    };
  });

  const filteredSuggestions = suggestions.filter((item) => item.suggestedTrim > 0);
  const totalSuggested = roundMoney(
    sumBy(filteredSuggestions, (item) => item.suggestedTrim)
  );

  return {
    deficit,
    suggestions: filteredSuggestions,
    totalSuggested,
    covered: remainingGap === 0,
    remainingGap: roundMoney(remainingGap),
    quickWin: filteredSuggestions[0] || null,
  };
};

const buildResultActions = ({ totals, monthlyPlan, trimPlan, state }) => {
  const actions = [];

  if (monthlyPlan.type === 'deficit') {
    if (trimPlan.quickWin) {
      actions.push({
        title: `Trim ${trimPlan.quickWin.name}`,
        detail: `Reducing it by ${trimPlan.quickWin.suggestedTrim} would be your fastest first move.`,
        tone: 'warning',
      });
    }

    actions.push({
      title: 'Hold extra debt overpayments for now',
      detail:
        'Until your monthly plan is back above zero, stabilising cash flow matters more than aggressive overpayments.',
      tone: 'warning',
    });

    actions.push({
      title: 'Protect minimum debt payments',
      detail:
        'Keep every minimum covered to avoid fees and further pressure.',
      tone: 'neutral',
    });

    return actions;
  }

  if (monthlyPlan.savingsAllocation > 0) {
    actions.push({
      title: 'Automate savings first',
      detail: `Move ${monthlyPlan.savingsAllocation} each month into savings right after income arrives.`,
      tone: 'success',
    });
  }

  if (monthlyPlan.debtAllocation > 0 && monthlyPlan.debtPlan.length > 0) {
    const focusDebt = monthlyPlan.debtPlan.find((debt) => debt.isPriority);
    if (focusDebt) {
      actions.push({
        title: `Target ${focusDebt.name}`,
        detail: `Keep all minimums going, then send the extra ${monthlyPlan.debtAllocation} here every month.`,
        tone: 'success',
      });
    }
  }

  if (monthlyPlan.monthsSavedVsMinimums > 0) {
    actions.push({
      title: 'Accelerated payoff is working',
      detail: `This plan could shorten payoff by about ${monthlyPlan.monthsSavedVsMinimums} months versus minimum payments only.`,
      tone: 'success',
    });
  }

  const nonEssentialTotal = sumBy(
    (state.budgetCategories || []).filter((category) => category.type === 'non-essential'),
    (category) => category.amount
  );

  if (nonEssentialTotal > 0) {
    actions.push({
      title: 'Review flexible spending monthly',
      detail: `You currently have ${roundMoney(
        nonEssentialTotal
      )} in non-essential budget categories, which is your fastest source of extra payoff money.`,
      tone: 'neutral',
    });
  }

  if (totals.priorityDebt && toNumber(totals.priorityDebt.interest) > 0) {
    actions.push({
      title: 'Avoid adding to high-interest balances',
      detail: `Every new charge on ${totals.priorityDebt.name} slows the payoff plan.`,
      tone: 'neutral',
    });
  }

  return actions;
};

// --- App ---
export default function App() {
  const [step, setStep] = useState(0);
  const [expandedDebtId, setExpandedDebtId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTrimApplied, setShowTrimApplied] = useState(false);
  const [preTrimBudgetSnapshot, setPreTrimBudgetSnapshot] = useState(null);
  const [payoffStrategy, setPayoffStrategy] = useState(
    PAYOFF_STRATEGIES.avalanche
  );

  const [state, setState] = useState({
    currency: 'GBP',
    income: '',
    budgetCategories: [
      createBudgetCategory('Groceries', 'essential'),
      createBudgetCategory('Transport', 'essential'),
      createBudgetCategory('Eating Out', 'non-essential'),
      createBudgetCategory('Other', 'essential'),
    ],
    debts: [],
    bills: [],
    savings: {
      current: '',
      emergencyTarget: DEFAULT_EMERGENCY_FUND_FLOOR,
    },
  });

  useEffect(() => {
    const loaded = loadSavedState();
    if (loaded) {
      setState((prev) => ({
        ...prev,
        ...loaded,
      }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!lastDeleted) return;

    const timer = setTimeout(() => {
      setLastDeleted(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [lastDeleted]);

  useEffect(() => {
    if (!showTrimApplied) return;

    const timer = setTimeout(() => {
      setShowTrimApplied(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [showTrimApplied]);

  const getCurrencySymbol = () =>
    CURRENCIES.find((currency) => currency.code === state.currency)?.symbol || '£';

  const formatValue = (value) => {
    const num = toNumber(value);

    return `${num < 0 ? '-' : ''}${getCurrencySymbol()}${Math.abs(
      num
    ).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const totalBudgetSpending = useMemo(
    () => sumBy(state.budgetCategories, (category) => category.amount),
    [state.budgetCategories]
  );

  const essentialBudgetTotal = useMemo(
    () =>
      sumBy(
        state.budgetCategories.filter((category) => category.type === 'essential'),
        (category) => category.amount
      ),
    [state.budgetCategories]
  );

  const nonEssentialBudgetTotal = useMemo(
    () =>
      sumBy(
        state.budgetCategories.filter(
          (category) => category.type === 'non-essential'
        ),
        (category) => category.amount
      ),
    [state.budgetCategories]
  );

  const nonEssentialCategoriesSorted = useMemo(
    () =>
      [...state.budgetCategories]
        .filter(
          (category) =>
            category.type === 'non-essential' && toNumber(category.amount) > 0
        )
        .sort((a, b) => toNumber(b.amount) - toNumber(a.amount)),
    [state.budgetCategories]
  );

  const topTrimCategory = nonEssentialCategoriesSorted[0] || null;

  const hasBudgetCategoryAmount = state.budgetCategories.some((category) =>
    isFilled(category.amount)
  );

  const hasInvalidBudgetCategories = state.budgetCategories.some(
    (category) =>
      isNegative(category.amount) ||
      !String(category.name || '').trim() ||
      !['essential', 'non-essential'].includes(category.type)
  );

  const hasInvalidDebts = state.debts.some(
    (debt) =>
      isNegative(debt.balance) ||
      isNegative(debt.interest) ||
      isNegative(debt.minPayment)
  );

  const hasInvalidBills = state.bills.some((bill) => isNegative(bill.amount));

  const hasInvalidSavings =
    isNegative(state.savings?.current) ||
    isNegative(state.savings?.emergencyTarget);

  const incomeMissing = step === 2 && !isFilled(state.income);
  const budgetMissing = step === 2 && !hasBudgetCategoryAmount;
  const getDebtStatus = (debt) => {
    const hasName = Boolean(debt.name && debt.name.trim());
    const hasBalance = isFilled(debt.balance);
    const hasInterest = isFilled(debt.interest);
    const hasMinPayment = isFilled(debt.minPayment);

    const hasInvalidValues =
      isNegative(debt.balance) ||
      isNegative(debt.interest) ||
      isNegative(debt.minPayment);

    if (hasInvalidValues) {
      return {
        label: 'Invalid',
        text: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-100',
        dot: 'bg-red-500',
      };
    }

    const isComplete = hasName && hasBalance && hasInterest && hasMinPayment;

    if (isComplete) {
      return {
        label: 'Complete',
        text: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        dot: 'bg-emerald-500',
      };
    }

    return {
      label: 'Needs details',
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      dot: 'bg-amber-500',
    };
  };

  const getBillStatus = (bill) => {
    const hasName = Boolean(bill.name && bill.name.trim());
    const hasAmount = isFilled(bill.amount);

    if (isNegative(bill.amount)) {
      return {
        label: 'Invalid',
        text: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-100',
        dot: 'bg-red-500',
      };
    }

    const isComplete = hasName && hasAmount;

    if (isComplete) {
      return {
        label: 'Complete',
        text: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        dot: 'bg-emerald-500',
      };
    }

    return {
      label: 'Needs details',
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      dot: 'bg-amber-500',
    };
  };

  const stepValidation = useMemo(() => {
    if (step === 2) {
      const incomeFilled = isFilled(state.income);

      if (!incomeFilled || !hasBudgetCategoryAmount) {
        return {
          canProceed: false,
          message:
            'Please fill in Monthly Income and at least one budget category before continuing.',
        };
      }

      if (hasInvalidBudgetCategories) {
        return {
          canProceed: false,
          message:
            'Please fix your budget category names or amounts before continuing.',
        };
      }

      if (hasInvalidSavings) {
        return {
          canProceed: false,
          message: 'Please fix your savings values before continuing.',
        };
      }
    }

    if (step === 3 && hasInvalidDebts) {
      return {
        canProceed: false,
        message: 'Please fix invalid debt values before continuing.',
      };
    }

    if (step === 4 && (hasInvalidDebts || hasInvalidBills)) {
      return {
        canProceed: false,
        message: hasInvalidBills
          ? 'Please fix invalid bill amounts before getting results.'
          : 'Please fix invalid debt values before getting results.',
      };
    }

    return {
      canProceed: true,
      message: '',
    };
  }, [
    step,
    state.income,
    hasBudgetCategoryAmount,
    hasInvalidBudgetCategories,
    hasInvalidDebts,
    hasInvalidBills,
    hasInvalidSavings,
  ]);

  const totals = useMemo(() => {
    const income = toNumber(state.income);
    const monthlyDebtRepayment = sumBy(state.debts, (debt) => debt.minPayment);
    const monthlyBills = sumBy(state.bills, (bill) => bill.amount);
    const budgetSpending = sumBy(state.budgetCategories, (category) => category.amount);
    const totalOut = roundMoney(monthlyDebtRepayment + monthlyBills + budgetSpending);
    const remaining = roundMoney(income - totalOut);
    const totalDebtBalance = sumBy(state.debts, (debt) => debt.balance);

    const debtsSortedByApr = sortDebtsByStrategy(
      state.debts.filter((debt) => toNumber(debt.balance) > 0),
      PAYOFF_STRATEGIES.avalanche
    );

    const priorityDebt = debtsSortedByApr[0] || null;
    const payoffEstimate = priorityDebt
      ? calculateDebtPayoff(
          priorityDebt.balance,
          priorityDebt.interest,
          priorityDebt.minPayment
        )
      : null;

    const targetPaymentOptions = priorityDebt
      ? PAYOFF_TARGET_MONTHS.map((months) => ({
          label: `Clear in ${months} months`,
          months,
          result: calculateRequiredMonthlyPayment(
            priorityDebt.balance,
            priorityDebt.interest,
            months
          ),
        }))
      : [];

    let tier = {
      level: 5,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      heading: 'Meaningful breathing room',
      label: 'Monthly Surplus',
    };

    if (remaining < -300) {
      tier = {
        level: 1,
        color: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-100',
        heading: 'Under serious pressure',
        label: 'Monthly Deficit',
      };
    } else if (remaining < 0) {
      tier = {
        level: 2,
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        heading: 'Needs immediate attention',
        label: 'Monthly Deficit',
      };
    } else if (remaining <= 100) {
      tier = {
        level: 3,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        heading: 'Things are very tight',
        label: 'Monthly Margin',
      };
    } else if (remaining <= 300) {
      tier = {
        level: 4,
        color: 'text-teal-500',
        bg: 'bg-teal-50',
        border: 'border-teal-100',
        heading: 'Some room to work with',
        label: 'Monthly Surplus',
      };
    }

    return {
      income,
      monthlyDebtRepayment,
      monthlyBills,
      budgetSpending,
      essentialBudgetTotal,
      nonEssentialBudgetTotal,
      totalOut,
      remaining,
      totalDebtBalance,
      priorityDebt,
      payoffEstimate,
      targetPaymentOptions,
      tier,
    };
  }, [state, essentialBudgetTotal, nonEssentialBudgetTotal]);

  const recommendedEmergencyTarget = useMemo(
    () => getRecommendedEmergencyTarget(state),
    [state]
  );

  const monthlyPlan = useMemo(
    () => calculateMonthlyPlan(state, totals, payoffStrategy),
    [state, totals, payoffStrategy]
  );

  const comparisonPlan = useMemo(() => {
    const alternateStrategy =
      payoffStrategy === PAYOFF_STRATEGIES.avalanche
        ? PAYOFF_STRATEGIES.snowball
        : PAYOFF_STRATEGIES.avalanche;

    return calculateMonthlyPlan(state, totals, alternateStrategy);
  }, [state, totals, payoffStrategy]);

  const trimPlan = useMemo(
    () => calculateTrimSuggestions(totals, state.budgetCategories),
    [totals, state.budgetCategories]
  );

  const resultActions = useMemo(
    () => buildResultActions({ totals, monthlyPlan, trimPlan, state }),
    [totals, monthlyPlan, trimPlan, state]
  );

  const applyTrimPlan = () => {
    if (!trimPlan.suggestions.length) return;

    setPreTrimBudgetSnapshot(state.budgetCategories);

    const suggestionMap = new Map(
      trimPlan.suggestions.map((suggestion) => [
        suggestion.id,
        suggestion.newAmount,
      ])
    );

    setState((prev) => ({
      ...prev,
      budgetCategories: prev.budgetCategories.map((category) =>
        suggestionMap.has(category.id)
          ? {
              ...category,
              amount: String(suggestionMap.get(category.id)),
            }
          : category
      ),
    }));

    setShowTrimApplied(true);
  };

  const undoAppliedTrimPlan = () => {
    if (!preTrimBudgetSnapshot) return;

    setState((prev) => ({
      ...prev,
      budgetCategories: preTrimBudgetSnapshot,
    }));

    setPreTrimBudgetSnapshot(null);
    setShowTrimApplied(false);
  };

  const nextStep = () => {
    if (!stepValidation.canProceed) return;
    setStep((current) => Math.min(current + 1, 5));
  };

  const prevStep = () => setStep((current) => Math.max(current - 1, 0));

  const resetApp = () => {
    setState({
      currency: 'GBP',
      income: '',
      budgetCategories: [
        createBudgetCategory('Groceries', 'essential'),
        createBudgetCategory('Transport', 'essential'),
        createBudgetCategory('Eating Out', 'non-essential'),
        createBudgetCategory('Other', 'essential'),
      ],
      debts: [],
      bills: [],
      savings: {
        current: '',
        emergencyTarget: DEFAULT_EMERGENCY_FUND_FLOOR,
      },
    });
    setPayoffStrategy(PAYOFF_STRATEGIES.avalanche);
    setExpandedDebtId(null);
    setExpandedBillId(null);
    setLastDeleted(null);
    setShowResetConfirm(false);
    setShowTrimApplied(false);
    setPreTrimBudgetSnapshot(null);
    setStep(0);
  };

  const addBudgetCategory = (name = '', type = 'essential') => {
    setState((prev) => ({
      ...prev,
      budgetCategories: [createBudgetCategory(name, type), ...prev.budgetCategories],
    }));
  };

  const updateBudgetCategory = (id, key, value) => {
    setState((prev) => ({
      ...prev,
      budgetCategories: prev.budgetCategories.map((category) =>
        category.id === id ? { ...category, [key]: value } : category
      ),
    }));
  };

  const removeBudgetCategory = (id) => {
    setState((prev) => ({
      ...prev,
      budgetCategories: prev.budgetCategories.filter(
        (category) => category.id !== id
      ),
    }));
  };

  const addDebt = (name = '') => {
    const debt = createDebt(name);

    setState((prev) => ({
      ...prev,
      debts: [debt, ...prev.debts],
    }));

    setExpandedDebtId(debt.id);
  };

  const updateDebt = (id, key, value) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((debt) =>
        debt.id === id ? { ...debt, [key]: value } : debt
      ),
    }));
  };

  const removeDebt = (id) => {
    const deletedItem = state.debts.find((debt) => debt.id === id);
    const deletedIndex = state.debts.findIndex((debt) => debt.id === id);

    if (!deletedItem) return;

    setLastDeleted({
      type: 'debt',
      item: deletedItem,
      index: deletedIndex,
    });

    setState((prev) => ({
      ...prev,
      debts: prev.debts.filter((debt) => debt.id !== id),
    }));

    setExpandedDebtId((current) => (current === id ? null : current));
  };

  const toggleDebt = (id) => {
    setExpandedDebtId((current) => (current === id ? null : id));
  };

  const addBill = (name = '') => {
    const bill = createBill(name);

    setState((prev) => ({
      ...prev,
      bills: [bill, ...prev.bills],
    }));

    setExpandedBillId(bill.id);
  };

  const updateBill = (id, key, value) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) =>
        bill.id === id ? { ...bill, [key]: value } : bill
      ),
    }));
  };

  const removeBill = (id) => {
    const deletedItem = state.bills.find((bill) => bill.id === id);
    const deletedIndex = state.bills.findIndex((bill) => bill.id === id);

    if (!deletedItem) return;

    setLastDeleted({
      type: 'bill',
      item: deletedItem,
      index: deletedIndex,
    });

    setState((prev) => ({
      ...prev,
      bills: prev.bills.filter((bill) => bill.id !== id),
    }));

    setExpandedBillId((current) => (current === id ? null : current));
  };

  const toggleBill = (id) => {
    setExpandedBillId((current) => (current === id ? null : id));
  };

  const undoDelete = () => {
    if (!lastDeleted) return;

    if (lastDeleted.type === 'debt') {
      setState((prev) => {
        const nextDebts = [...prev.debts];
        const insertAt = Math.min(
          Math.max(lastDeleted.index ?? 0, 0),
          nextDebts.length
        );
        nextDebts.splice(insertAt, 0, lastDeleted.item);

        return { ...prev, debts: nextDebts };
      });

      setExpandedDebtId(lastDeleted.item.id);
    }

    if (lastDeleted.type === 'bill') {
      setState((prev) => {
        const nextBills = [...prev.bills];
        const insertAt = Math.min(
          Math.max(lastDeleted.index ?? 0, 0),
          nextBills.length
        );
        nextBills.splice(insertAt, 0, lastDeleted.item);

        return { ...prev, bills: nextBills };
      });

      setExpandedBillId(lastDeleted.item.id);
    }

    setLastDeleted(null);
  };

  const WelcomeView = () => (
    <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-20 shadow-2xl border border-slate-100 text-center max-w-4xl mx-auto animate-in w-full">
      <div className="flex flex-col items-center mb-10">
        <img
          src="/vayrity-logo.png"
          alt="Vayrity logo"
          className="h-16 md:h-20 object-contain mb-8 max-w-full"
        />

        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[#1B2B4B] mb-3 break-words">
          VAYRITY
        </h1>

        <p className="text-xs md:text-sm font-bold tracking-[0.5em] text-[#1EB1BB] uppercase text-center">
          Clear Truth. Real Freedom.
        </p>
      </div>

      <h2 className="text-3xl md:text-5xl font-extrabold mt-6 mb-8 text-slate-800 leading-tight max-w-2xl mx-auto">
        See where your money is going and what to do next.
      </h2>

      <p className="text-slate-500 mb-12 text-lg md:text-xl leading-relaxed max-w-md mx-auto font-medium">
        Debt and monthly bills can be overwhelming. We help you list everything
        in one place and turn it into a more actionable plan.
      </p>

      <div className="flex justify-center mt-6">
        <button
          onClick={nextStep}
          className="w-full max-w-sm mx-auto bg-[#1B2B4B] text-white py-6 px-6 rounded-2xl font-black text-xl hover:bg-slate-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-4 group"
        >
          Get started
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );

  const PrepView = () => (
    <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-16 shadow-2xl border border-slate-100 max-w-3xl mx-auto animate-in w-full">
      <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-6 text-center">
        Before you start
      </h2>

      <p className="text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto text-center mb-10">
        To get the most accurate result, it helps to have a few things ready.
      </p>

      <div className="bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-100">
        <ul className="space-y-4 text-slate-700">
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0"></span>
            <span>Your latest bank statement</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0"></span>
            <span>Credit card balances</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0"></span>
            <span>Loan and overdraft details</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0"></span>
            <span>Monthly bills and direct debits</span>
          </li>
        </ul>
      </div>

      <div className="flex justify-center mt-10">
        <button
          onClick={nextStep}
          className="w-full max-w-sm mx-auto bg-[#1B2B4B] text-white py-5 px-6 rounded-2xl font-black text-lg hover:bg-slate-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-wider"
        >
          Continue
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const BasicsView = () => {
    const savingsCurrentInvalid = isNegative(state.savings?.current);
    const savingsTargetInvalid = isNegative(state.savings?.emergencyTarget);

    return (
      <div className="space-y-12 max-w-5xl mx-auto animate-in w-full">
        <section>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
            1. Select Currency
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {CURRENCIES.map((currency) => (
              <button
                key={currency.code}
                onClick={() =>
                  setState((prev) => ({ ...prev, currency: currency.code }))
                }
                className={`py-4 px-3 rounded-xl border-2 font-black transition-all text-sm min-w-0 ${
                  state.currency === currency.code
                    ? 'border-[#1EB1BB] bg-cyan-50 text-[#1B2B4B]'
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                {currency.symbol} {currency.code}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="min-w-0">
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              2. Monthly Income (After Tax)
            </label>
            <p className="text-xs text-slate-400 mt-1">
              Enter your total monthly income (salary + other income combined)
            </p>

            <div className="relative group mt-3">
              <span
                className={`absolute left-6 top-1/2 -translate-y-1/2 font-black text-2xl transition-colors ${
                  incomeMissing
                    ? 'text-red-300 group-focus-within:text-red-500'
                    : 'text-slate-300 group-focus-within:text-[#1EB1BB]'
                }`}
              >
                {getCurrencySymbol()}
              </span>

              <input
                type="number"
                min="0"
                value={state.income}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, income: e.target.value }))
                }
                placeholder="0.00"
                className={`w-full min-w-0 pl-16 pr-6 py-6 rounded-3xl border-2 focus:ring-8 focus:outline-none text-3xl font-black transition-all ${
                  incomeMissing
                    ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-50'
                    : 'border-slate-100 focus:border-[#1EB1BB] focus:ring-cyan-50'
                }`}
              />
            </div>

            {incomeMissing && (
              <p className="text-xs text-red-500 font-bold mt-2">
                Monthly Income is required.
              </p>
            )}
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm min-w-0 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  3. Budget Categories
                </label>
                <p className="text-xs text-slate-400">
                  Add your usual monthly spending.
                </p>
              </div>

              <button
                onClick={() => addBudgetCategory()}
                className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-4 py-2 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2 shrink-0"
              >
                <Plus className="w-3 h-3" /> Custom
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
              {BUDGET_CATEGORY_PRESETS.map((preset) => (
                <button
                  key={`${preset.name}-${preset.type}`}
                  onClick={() => addBudgetCategory(preset.name, preset.type)}
                  className="whitespace-nowrap px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-500 hover:border-[#1EB1BB] hover:bg-cyan-50 transition-all shrink-0"
                >
                  + {preset.name}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {state.budgetCategories.map((category) => {
                const amountInvalid = isNegative(category.amount);
                const nameInvalid = !String(category.name || '').trim();

                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,140px)_56px] gap-3 items-start min-w-0"
                  >
                    <div className="min-w-0">
                      <input
                        value={category.name}
                        onChange={(e) =>
                          updateBudgetCategory(category.id, 'name', e.target.value)
                        }
                        placeholder="Category name"
                        className={`w-full min-w-0 p-4 rounded-xl text-sm font-black focus:outline-none ${
                          nameInvalid
                            ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                            : 'bg-slate-50 text-[#1B2B4B] focus:ring-2 focus:ring-[#1EB1BB]'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="relative">
                        <span
                          className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${
                            amountInvalid ? 'text-red-300' : 'text-slate-300'
                          }`}
                        >
                          {getCurrencySymbol()}
                        </span>

                        <input
                          type="number"
                          min="0"
                          value={category.amount}
                          onChange={(e) =>
                            updateBudgetCategory(category.id, 'amount', e.target.value)
                          }
                          placeholder="0"
                          className={`w-full min-w-0 pl-9 pr-4 py-4 rounded-xl text-sm font-black text-right focus:outline-none ${
                            amountInvalid
                              ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                              : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBudgetCategory(category.id)}
                      className="h-[52px] w-[52px] rounded-xl bg-slate-50 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center sm:justify-self-end"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="sm:col-span-3 flex flex-wrap gap-2 -mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateBudgetCategory(category.id, 'type', 'essential')
                        }
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                          category.type === 'essential'
                            ? 'bg-[#1B2B4B] text-white border-[#1B2B4B]'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        Essential
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateBudgetCategory(
                            category.id,
                            'type',
                            'non-essential'
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                          category.type === 'non-essential'
                            ? 'bg-[#1EB1BB] text-white border-[#1EB1BB]'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        Non-essential
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {budgetMissing && (
              <p className="text-xs text-red-500 font-bold mt-3">
                Add at least one budget category amount.
              </p>
            )}

            {hasInvalidBudgetCategories && !budgetMissing && (
              <p className="text-xs text-red-500 font-bold mt-3">
                Budget categories must have a name and cannot have negative amounts.
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-3 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 min-w-0">
                  Total Budget
                </span>
                <span className="text-lg font-black text-slate-800 shrink-0">
                  {formatValue(totalBudgetSpending)}
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-3 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 min-w-0">
                  Essential
                </span>
                <span className="text-lg font-black text-slate-800 shrink-0">
                  {formatValue(essentialBudgetTotal)}
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-3 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 min-w-0">
                  Flexible
                </span>
                <span className="text-lg font-black text-slate-800 shrink-0">
                  {formatValue(nonEssentialBudgetTotal)}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-sm overflow-hidden">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[#1EB1BB] flex items-center justify-center shrink-0">
              <PiggyBank className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <h3 className="text-2xl font-black text-slate-800">Savings Setup</h3>
              <p className="text-sm text-slate-400 mt-1">
                This helps Vayrity balance short-term safety with debt progress.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                Current Savings
              </label>

              <div className="relative">
                <span
                  className={`absolute left-5 top-1/2 -translate-y-1/2 font-black text-xl ${
                    savingsCurrentInvalid ? 'text-red-300' : 'text-slate-300'
                  }`}
                >
                  {getCurrencySymbol()}
                </span>

                <input
                  type="number"
                  min="0"
                  value={state.savings?.current ?? ''}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      savings: {
                        ...prev.savings,
                        current: e.target.value,
                      },
                    }))
                  }
                  placeholder="0"
                  className={`w-full min-w-0 pl-14 pr-5 py-5 rounded-2xl text-xl font-black focus:outline-none ${
                    savingsCurrentInvalid
                      ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                      : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                  }`}
                />
              </div>

              {savingsCurrentInvalid && (
                <p className="text-[10px] text-red-500 font-bold mt-2">
                  Current savings cannot be negative.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                Emergency Fund Target
              </label>

              <div className="relative">
                <span
                  className={`absolute left-5 top-1/2 -translate-y-1/2 font-black text-xl ${
                    savingsTargetInvalid ? 'text-red-300' : 'text-slate-300'
                  }`}
                >
                  {getCurrencySymbol()}
                </span>

                <input
                  type="number"
                  min="0"
                  value={state.savings?.emergencyTarget ?? DEFAULT_EMERGENCY_FUND_FLOOR}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      savings: {
                        ...prev.savings,
                        emergencyTarget: e.target.value,
                      },
                    }))
                  }
                  placeholder={String(DEFAULT_EMERGENCY_FUND_FLOOR)}
                  className={`w-full min-w-0 pl-14 pr-5 py-5 rounded-2xl text-xl font-black focus:outline-none ${
                    savingsTargetInvalid
                      ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                      : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                  }`}
                />
              </div>

              {savingsTargetInvalid ? (
                <p className="text-[10px] text-red-500 font-bold mt-2">
                  Emergency fund target cannot be negative.
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-2">
                  Recommended based on your essentials: {formatValue(recommendedEmergencyTarget)}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  };

  const DebtsView = () => (
    <div className="space-y-8 max-w-4xl mx-auto animate-in w-full">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 px-2">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-slate-800">Your Debts</h3>
            <p className="text-sm text-slate-400 mt-2">
              You can add more than one of the same debt type, for example multiple
              credit cards or loans.
            </p>
          </div>

          <button
            onClick={() => addDebt()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {DEBT_PRESETS.map((type) => (
            <button
              key={type}
              onClick={() => addDebt(type)}
              className="whitespace-nowrap px-6 py-3 bg-white border border-slate-100 rounded-full text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm hover:shadow-md active:bg-cyan-50 transition-all hover:border-[#1EB1BB] shrink-0"
            >
              + {type}
            </button>
          ))}
        </div>

        {state.debts.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 md:p-6 mx-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Automated Payoff Strategy
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Choose how extra debt money should be routed once minimums are covered.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPayoffStrategy(PAYOFF_STRATEGIES.avalanche)}
                  className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                    payoffStrategy === PAYOFF_STRATEGIES.avalanche
                      ? 'bg-[#1B2B4B] text-white border-[#1B2B4B]'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Avalanche
                </button>

                <button
                  type="button"
                  onClick={() => setPayoffStrategy(PAYOFF_STRATEGIES.snowball)}
                  className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                    payoffStrategy === PAYOFF_STRATEGIES.snowball
                      ? 'bg-[#1EB1BB] text-white border-[#1EB1BB]'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Snowball
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Avalanche
                </p>
                <p className="text-sm text-slate-600">
                  Sends extra money to the highest APR debt first to reduce total interest faster.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Snowball
                </p>
                <p className="text-sm text-slate-600">
                  Clears the smallest balance first to create quicker wins and free payments sooner.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {state.debts.length === 0 ? (
          <div className="bg-slate-50 rounded-[2.5rem] p-16 text-center border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
            No debts added yet. Use the presets above to start.
          </div>
        ) : (
          state.debts.map((debt) => {
            const isOpen = expandedDebtId === debt.id;
            const status = getDebtStatus(debt);

            const balanceInvalid = isNegative(debt.balance);
            const interestInvalid = isNegative(debt.interest);
            const minPaymentInvalid = isNegative(debt.minPayment);

            const minimumNeededToReduce = calculateMinimumPaymentToReduce(
              debt.balance,
              debt.interest
            );

            const currentPayoff = calculateDebtPayoff(
              debt.balance,
              debt.interest,
              debt.minPayment
            );

            return (
              <div
                key={debt.id}
                className={`bg-white rounded-[2rem] border shadow-sm transition-all overflow-hidden min-w-0 ${
                  isOpen
                    ? 'border-[#1EB1BB] shadow-lg'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleDebt(debt.id)}
                  className="w-full text-left p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <p className="text-lg md:text-xl font-black text-[#1B2B4B] truncate min-w-0">
                          {debt.name || 'New Debt'}
                        </p>

                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shrink-0 ${status.bg} ${status.text} ${status.border}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs md:text-sm text-slate-500">
                        <span>Balance: {formatValue(debt.balance)}</span>
                        <span>APR: {toNumber(debt.interest)}%</span>
                        <span>Min Pay: {formatValue(debt.minPayment)}/month</span>
                      </div>

                      {currentPayoff.valid && (
                        <p className="mt-3 text-xs font-bold text-[#1EB1BB]">
                          Estimated payoff at current payment: {formatMonthsLabel(currentPayoff.months)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDebt(debt.id);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <div
                        className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 md:px-6 pb-6 animate-in border-t border-slate-100 overflow-hidden">
                    <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                      <div className="space-y-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Debt Name
                        </label>
                        <input
                          value={debt.name}
                          onChange={(e) =>
                            updateDebt(debt.id, 'name', e.target.value)
                          }
                          className="w-full min-w-0 bg-slate-50 p-4 rounded-xl text-sm font-black text-[#1B2B4B] focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none"
                          placeholder="Debt Name"
                        />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Balance
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={debt.balance}
                          onChange={(e) =>
                            updateDebt(debt.id, 'balance', e.target.value)
                          }
                          className={`w-full min-w-0 p-4 rounded-xl text-sm font-black focus:outline-none ${
                            balanceInvalid
                              ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                              : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                          }`}
                          placeholder="0"
                        />
                        {balanceInvalid && (
                          <p className="text-[10px] text-red-500 font-bold">
                            Balance cannot be negative.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          APR %
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={debt.interest}
                          onChange={(e) =>
                            updateDebt(debt.id, 'interest', e.target.value)
                          }
                          className={`w-full min-w-0 p-4 rounded-xl text-sm font-black focus:outline-none ${
                            interestInvalid
                              ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                              : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                          }`}
                          placeholder="0"
                        />
                        {interestInvalid ? (
                          <p className="text-[10px] text-red-500 font-bold">
                            APR cannot be negative.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            Annual interest rate (APR %)
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 md:col-span-3 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Minimum Monthly Payment
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={debt.minPayment}
                          onChange={(e) =>
                            updateDebt(debt.id, 'minPayment', e.target.value)
                          }
                          className={`w-full min-w-0 p-4 rounded-xl text-sm font-black focus:outline-none ${
                            minPaymentInvalid
                              ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                              : 'bg-slate-50 text-[#1EB1BB] focus:ring-2 focus:ring-[#1EB1BB]'
                          }`}
                          placeholder="0"
                        />
                        {minPaymentInvalid && (
                          <p className="text-[10px] text-red-500 font-bold">
                            Minimum payment cannot be negative.
                          </p>
                        )}
                      </div>
                    </div>

                    {minimumNeededToReduce && !minPaymentInvalid && !interestInvalid && (
                      <div className="mt-5 bg-slate-50 rounded-2xl border border-slate-100 p-4">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Debt health check
                        </p>

                        {toNumber(debt.minPayment) < minimumNeededToReduce ? (
                          <p className="text-sm text-red-600 font-bold">
                            Current payment looks too low to reduce this balance. Aim for at least{' '}
                            {formatValue(minimumNeededToReduce)}/month to start bringing it down.
                          </p>
                        ) : currentPayoff.valid ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-white rounded-xl border border-slate-100 p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Payoff time
                              </p>
                              <p className="text-lg font-black text-slate-800">
                                {formatMonthsLabel(currentPayoff.months)}
                              </p>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-100 p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Interest left
                              </p>
                              <p className="text-lg font-black text-slate-800">
                                {formatValue(currentPayoff.totalInterest)}
                              </p>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-100 p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Better use of extra cash
                              </p>
                              <p className="text-sm font-bold text-slate-700">
                                {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                                  ? 'Highest APR gets extra first'
                                  : 'Smallest balance gets extra first'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Add a clearer payment amount to estimate payoff timing.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const BillsView = () => (
    <div className="space-y-8 max-w-4xl mx-auto animate-in w-full">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 px-2">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-slate-800">Regular Bills</h3>
            <p className="text-sm text-slate-400 mt-2">
              You can add more than one of the same bill type if needed.
            </p>
          </div>

          <button
            onClick={() => addBill()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {BILL_PRESETS.map((type) => (
            <button
              key={type}
              onClick={() => addBill(type)}
              className="whitespace-nowrap px-6 py-3 bg-white border border-slate-100 rounded-full text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm hover:shadow-md active:bg-cyan-50 transition-all hover:border-[#1EB1BB] shrink-0"
            >
              + {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {state.bills.length === 0 ? (
          <div className="bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
            No bills added yet.
          </div>
        ) : (
          state.bills.map((bill) => {
            const isOpen = expandedBillId === bill.id;
            const status = getBillStatus(bill);
            const amountInvalid = isNegative(bill.amount);

            return (
              <div
                key={bill.id}
                className={`bg-white rounded-[2rem] border shadow-sm transition-all overflow-hidden min-w-0 ${
                  isOpen
                    ? 'border-[#1EB1BB] shadow-lg'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleBill(bill.id)}
                  className="w-full text-left p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <p className="text-base md:text-lg font-black text-[#1B2B4B] truncate min-w-0">
                          {bill.name || 'New Bill'}
                        </p>

                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shrink-0 ${status.bg} ${status.text} ${status.border}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                          {status.label}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-500">
                        Amount: {formatValue(bill.amount)}/month
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBill(bill.id);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div
                        className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 md:px-6 pb-6 animate-in border-t border-slate-100 overflow-hidden">
                    <div className="pt-6 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)] gap-4 items-end min-w-0">
                      <div className="space-y-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Bill Name
                        </label>
                        <input
                          value={bill.name}
                          onChange={(e) => updateBill(bill.id, 'name', e.target.value)}
                          className="w-full min-w-0 bg-slate-50 p-4 rounded-xl text-sm font-black text-[#1B2B4B] focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none"
                          placeholder="Bill Name"
                        />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Monthly Amount
                        </label>
                        <div className="relative w-full min-w-0">
                          <span
                            className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${
                              amountInvalid ? 'text-red-300' : 'text-slate-300'
                            }`}
                          >
                            {getCurrencySymbol()}
                          </span>

                          <input
                            type="number"
                            min="0"
                            value={bill.amount}
                            onChange={(e) => updateBill(bill.id, 'amount', e.target.value)}
                            className={`w-full min-w-0 pl-10 pr-4 py-4 rounded-xl text-sm font-black text-right focus:outline-none ${
                              amountInvalid
                                ? 'bg-red-50 border border-red-300 text-red-600 focus:ring-2 focus:ring-red-200'
                                : 'bg-slate-50 focus:ring-2 focus:ring-[#1EB1BB]'
                            }`}
                            placeholder="0"
                          />
                        </div>

                        {amountInvalid && (
                          <p className="text-[10px] text-red-500 font-bold">
                            Monthly amount cannot be negative.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const ResultsView = () => {
    const savingsProgress =
      monthlyPlan.effectiveEmergencyTarget > 0
        ? Math.min(
            100,
            (toNumber(monthlyPlan.currentSavings) /
              Math.max(1, toNumber(monthlyPlan.effectiveEmergencyTarget))) *
              100
          )
        : 0;

    const topBudgetCategories = [...state.budgetCategories]
      .filter((category) => toNumber(category.amount) > 0)
      .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
      .slice(0, 4);

    const firstPayoffMoment = monthlyPlan.debtTimeline?.payoffMoments?.[0] || null;
    const comparisonInterestDelta =
      comparisonPlan?.debtTimeline?.valid && monthlyPlan?.debtTimeline?.valid
        ? roundMoney(
            toNumber(comparisonPlan.debtTimeline.totalInterest) -
              toNumber(monthlyPlan.debtTimeline.totalInterest)
          )
        : 0;

    return (
      <div className="space-y-10 max-w-5xl mx-auto pb-16 animate-in w-full">
        <section className="bg-[#1B2B4B] text-white p-8 md:p-20 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-[100px]"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 min-w-0">
            <div className="flex-1 space-y-6 text-center md:text-left min-w-0">
              <h2 className="text-3xl md:text-5xl font-black leading-tight break-words">
                {totals.tier.heading}
              </h2>

              <p className="text-white/70 text-lg md:text-xl font-medium max-w-xl">
                Based on your figures, you have {formatValue(Math.abs(totals.remaining))}
                {totals.remaining < 0
                  ? ' missing each month after your listed costs.'
                  : ' left each month after your listed costs.'}
              </p>

              {monthlyPlan.type === 'surplus' && (
                <p className="text-sm md:text-base text-white/70 max-w-2xl">
                  {monthlyPlan.actionHeadline}
                </p>
              )}
            </div>

            <div className="w-full md:w-auto max-w-full">
              <div className="bg-white/10 backdrop-blur-xl p-8 md:p-12 rounded-[2rem] border border-white/10 w-full md:min-w-[280px] text-center transform hover:scale-105 transition-transform duration-300 max-w-full">
                <p className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-3">
                  {totals.tier.label}
                </p>
                <p
                  className={`text-4xl md:text-6xl font-black break-words ${
                    totals.remaining < 0 ? 'text-rose-400' : 'text-[#1EB1BB]'
                  }`}
                >
                  {formatValue(totals.remaining)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center min-w-0">
            <div className="flex justify-center mb-4 text-slate-300">
              <Wallet className="w-8 h-8" />
            </div>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
              Total Debt Balance
            </p>
            <p className="text-3xl font-black text-slate-800 break-words">
              {formatValue(totals.totalDebtBalance)}
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center min-w-0">
            <div className="flex justify-center mb-4 text-slate-300">
              <Wallet className="w-8 h-8" />
            </div>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
              Budget Spending
            </p>
            <p className="text-3xl font-black text-slate-800 break-words">
              {formatValue(totals.budgetSpending)}
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center min-w-0">
            <div className="flex justify-center mb-4 text-slate-300">
              <PiggyBank className="w-8 h-8" />
            </div>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
              Current Savings
            </p>
            <p className="text-3xl font-black text-slate-800 break-words">
              {formatValue(state.savings?.current || 0)}
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center min-w-0">
            <div className="flex justify-center mb-4 text-slate-300">
              <Target className="w-8 h-8" />
            </div>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
              Emergency Target
            </p>
            <p className="text-3xl font-black text-slate-800 break-words">
              {formatValue(monthlyPlan.effectiveEmergencyTarget || 0)}
            </p>
          </div>
        </div>

        {topBudgetCategories.length > 0 && (
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" /> Budget Breakdown
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topBudgetCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between gap-4 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 break-words">
                      {category.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {category.type === 'essential'
                        ? 'Essential spending'
                        : 'Flexible spending'}
                    </p>
                  </div>

                  <p className="text-xl font-black text-slate-800 shrink-0">
                    {formatValue(category.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-4 min-w-0">
            <div className="space-y-2 min-w-0">
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider">
                Priority Focus
              </p>
              <p className="text-xl font-black text-slate-800 break-words">
                {totals.priorityDebt ? totals.priorityDebt.name : 'No debt added'}
              </p>
              <p className="text-sm text-slate-600 break-words">
                Balance:{' '}
                {totals.priorityDebt
                  ? formatValue(totals.priorityDebt.balance)
                  : formatValue(0)}
              </p>
              <p className="text-sm text-slate-600 break-words">
                Minimum payment:{' '}
                {totals.priorityDebt
                  ? `${formatValue(totals.priorityDebt.minPayment)}/month`
                  : `${formatValue(0)}/month`}
              </p>
              <p className="text-xs text-[#1EB1BB] font-bold break-words">
                {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                  ? `Highest interest focus: ${totals.priorityDebt?.interest || 0}% APR`
                  : `Smallest balance focus within your debt strategy`}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center text-[#1EB1BB]">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            This card highlights the debt your current strategy is most likely to
            target first.
          </p>
        </div>

        <section className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-start gap-4 mb-8 min-w-0">
            <div className="w-14 h-14 rounded-[1.25rem] bg-cyan-50 text-[#1EB1BB] flex items-center justify-center flex-shrink-0">
              <Target className="w-7 h-7" />
            </div>

            <div className="min-w-0">
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">
                Your Monthly Plan
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight break-words">
                Based on your current numbers, this is how to move forward.
              </h3>
              <p className="text-slate-500 mt-2 break-words">
                {monthlyPlan.type === 'deficit'
                  ? `You’re currently ${formatValue(Math.abs(monthlyPlan.surplus))} short each month.`
                  : `You have ${formatValue(monthlyPlan.surplus)} available each month.`}
              </p>
            </div>
          </div>

          {monthlyPlan.type === 'deficit' ? (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 md:p-8">
                <p className="text-xl font-black text-slate-800 mb-3">
                  Focus first on stabilising your monthly cash flow.
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Your listed costs are currently higher than your income. Before
                  adding extra debt payments, aim to reduce spending, review bills,
                  or increase income where possible.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white rounded-2xl border border-rose-100 p-5 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Immediate priority
                    </p>
                    <p className="text-slate-700">
                      Bring your monthly budget back to zero or above.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-rose-100 p-5 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Budget spending
                    </p>
                    <p className="text-slate-700 break-words">
                      You currently have {formatValue(totals.budgetSpending)} in monthly budget categories.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-rose-100 p-5 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Best place to review
                    </p>
                    <p className="text-slate-700 break-words">
                      {topBudgetCategories[0]
                        ? `${topBudgetCategories[0].name} at ${formatValue(
                            topBudgetCategories[0].amount
                          )}`
                        : 'Review your largest category first.'}
                    </p>
                  </div>
                </div>
              </div>

              {trimPlan.suggestions.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Suggested Budget Trims
                      </p>
                      <h4 className="text-xl font-black text-slate-800 mt-2">
                        Vayrity can rebalance your flexible categories for you.
                      </h4>
                    </div>

                    <button
                      onClick={applyTrimPlan}
                      className="px-5 py-3 rounded-2xl bg-[#1B2B4B] text-white font-black text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors"
                    >
                      Apply Suggested Trims
                    </button>
                  </div>

                  <div className="space-y-3">
                    {trimPlan.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-black text-slate-800">{suggestion.name}</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Cut by {formatValue(suggestion.suggestedTrim)} ({suggestion.percentTrim}%)
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-sm text-slate-500">
                            {formatValue(suggestion.currentAmount)} →{' '}
                            <span className="font-black text-slate-800">
                              {formatValue(suggestion.newAmount)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Deficit
                      </p>
                      <p className="text-2xl font-black text-slate-800">
                        {formatValue(trimPlan.deficit)}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Suggested trim total
                      </p>
                      <p className="text-2xl font-black text-slate-800">
                        {formatValue(trimPlan.totalSuggested)}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Gap after trims
                      </p>
                      <p className="text-2xl font-black text-slate-800">
                        {formatValue(trimPlan.remainingGap)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 min-w-0">
                  <div className="flex items-center gap-3 mb-5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Pay Towards Your Debts
                      </p>
                      <p className="text-sm text-slate-500">
                        Minimums stay covered. Extra routes automatically using your chosen strategy.
                      </p>
                    </div>
                  </div>

                  {monthlyPlan.debtPlan.length > 0 ? (
                    <div className="space-y-4">
                      {monthlyPlan.debtPlan.map((debt) => (
                        <div
                          key={debt.id}
                          className={`rounded-2xl border p-4 min-w-0 ${
                            debt.isPriority
                              ? 'bg-cyan-50 border-cyan-100'
                              : 'bg-white border-slate-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4 min-w-0">
                            <div className="min-w-0">
                              <p className="font-black text-slate-800 break-words">
                                {debt.name}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {debt.interest}% APR
                              </p>
                              {debt.isPriority && (
                                <p className="text-[11px] font-black uppercase tracking-wider text-[#1EB1BB] mt-2">
                                  Current target debt
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-sm text-slate-500">
                                {formatValue(debt.minPayment)} minimum
                              </p>
                              {debt.extraPayment > 0 && (
                                <p className="text-sm font-black text-[#1EB1BB] mt-1">
                                  + {formatValue(debt.extraPayment)} extra
                                </p>
                              )}
                              <p className="text-base font-black text-slate-800 mt-1">
                                {formatValue(debt.totalPlanned)}/month
                              </p>
                            </div>
                          </div>

                          {debt.payoffEstimate.valid && (
                            <p className="text-xs text-slate-500 mt-3">
                              At this payment, this debt alone would take about{' '}
                              {formatMonthsLabel(debt.payoffEstimate.months)} to clear.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                      <p className="text-slate-600">
                        No debt added, so your available money can go fully into savings.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 min-w-0">
                  <div className="flex items-center gap-3 mb-5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-[#1EB1BB] flex items-center justify-center shrink-0">
                      <PiggyBank className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Build Your Emergency Fund
                      </p>
                      <p className="text-sm text-slate-500">
                        A small buffer reduces the chance of borrowing again.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                    <p className="text-3xl font-black text-slate-800 break-words">
                      {formatValue(monthlyPlan.savingsAllocation)}/month
                    </p>

                    <p className="text-sm text-slate-500 mt-2 break-words">
                      Working target: {formatValue(monthlyPlan.effectiveEmergencyTarget)}
                    </p>
                    <p className="text-sm text-slate-500 break-words">
                      Current savings: {formatValue(monthlyPlan.currentSavings)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 break-words">
                      Your own target: {formatValue(monthlyPlan.emergencyTarget)} · Recommended based on essentials:{' '}
                      {formatValue(monthlyPlan.recommendedEmergencyTarget)}
                    </p>

                    <div className="mt-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        <span>Progress</span>
                        <span className="break-words">
                          {formatValue(monthlyPlan.currentSavings)} /{' '}
                          {formatValue(monthlyPlan.effectiveEmergencyTarget)}
                        </span>
                      </div>

                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1EB1BB] rounded-full transition-all duration-500"
                          style={{ width: `${clamp(savingsProgress, 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 min-w-0">
                  <div className="flex items-center gap-3 mb-5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <CalendarClock className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Your Progress Timeline
                      </p>
                      <p className="text-sm text-slate-500">
                        A clearer view of what this plan could lead to.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Debt-free estimate
                      </p>
                      <p className="text-2xl font-black text-slate-800 break-words">
                        {monthlyPlan.debtTimeline?.valid
                          ? monthlyPlan.debtTimeline.months === 0
                            ? 'No active debt'
                            : formatMonthsLabel(monthlyPlan.debtTimeline.months)
                          : 'Needs clearer debt details'}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Emergency fund estimate
                      </p>
                      <p className="text-2xl font-black text-slate-800 break-words">
                        {monthlyPlan.emergencyFundMonths === 0
                          ? 'Already funded'
                          : monthlyPlan.emergencyFundMonths
                          ? formatMonthsLabel(monthlyPlan.emergencyFundMonths)
                          : monthlyPlan.savingsAllocation > 0
                          ? 'In progress'
                          : 'Not funded yet'}
                      </p>
                    </div>

                    {firstPayoffMoment && (
                      <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          First likely payoff
                        </p>
                        <p className="text-lg font-black text-slate-800 break-words">
                          {firstPayoffMoment.name}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                          Expected {getMonthsFromNowLabel(firstPayoffMoment.month)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 min-w-0">
                  <div className="flex items-center gap-3 mb-5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Info className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Spending Summary
                      </p>
                      <p className="text-sm text-slate-500">
                        Your total monthly category budget at a glance.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Budget total
                      </p>
                      <p className="text-2xl font-black text-slate-800 break-words">
                        {formatValue(totals.budgetSpending)}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Flexible spending
                      </p>
                      <p className="text-2xl font-black text-slate-800 break-words">
                        {formatValue(totals.nonEssentialBudgetTotal)}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        This is your fastest source of extra debt payoff capacity.
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Largest category
                      </p>
                      <p className="text-2xl font-black text-slate-800 break-words">
                        {topBudgetCategories[0]?.name || 'None added'}
                      </p>
                      {topBudgetCategories[0] && (
                        <p className="text-sm text-slate-500 mt-2">
                          {formatValue(topBudgetCategories[0].amount)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 min-w-0">
                  <div className="flex items-center gap-3 mb-5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Info className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Why This Plan Works
                      </p>
                      <p className="text-sm text-slate-500">
                        Clear, practical, and built from your current numbers.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-5 min-w-0">
                    <p className="text-slate-700 leading-relaxed break-words">
                      {monthlyPlan.explanation}
                    </p>

                    {monthlyPlan.interestSavedVsMinimums > 0 && (
                      <p className="text-sm font-bold text-[#1EB1BB] mt-4">
                        This plan could save about {formatValue(monthlyPlan.interestSavedVsMinimums)} in interest
                        compared with making minimum payments only.
                      </p>
                    )}

                    {topBudgetCategories[0] && (
                      <p className="text-sm text-slate-500 mt-4 break-words">
                        If you want faster progress, first review{' '}
                        <span className="font-bold text-slate-800">
                          {topBudgetCategories[0].name}
                        </span>{' '}
                        at {formatValue(topBudgetCategories[0].amount)}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Action Steps
                    </p>
                    <h4 className="text-2xl font-black text-slate-800 mt-2">
                      What to do next each month
                    </h4>
                  </div>

                  <div className="shrink-0">
                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-50 text-[#1EB1BB] text-[11px] font-black uppercase tracking-wider">
                      {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                        ? 'Avalanche active'
                        : 'Snowball active'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resultActions.map((action, index) => (
                    <div
                      key={`${action.title}-${index}`}
                      className={`rounded-2xl border p-5 ${
                        action.tone === 'success'
                          ? 'bg-cyan-50 border-cyan-100'
                          : action.tone === 'warning'
                          ? 'bg-rose-50 border-rose-100'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <p className="text-sm font-black text-slate-800">
                        {index + 1}. {action.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        {action.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {monthlyPlan.actions?.length > 0 && (
                  <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl p-5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                      Automated plan logic
                    </p>
                    <ul className="space-y-2 text-slate-700">
                      {monthlyPlan.actions.map((action, index) => (
                        <li key={`${action}-${index}`}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {comparisonPlan?.debtTimeline?.valid &&
                monthlyPlan?.debtTimeline?.valid &&
                monthlyPlan.debtPlan.length > 1 && (
                  <div className="mt-6 bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Strategy Comparison
                    </p>
                    <h4 className="text-2xl font-black text-slate-800 mt-2">
                      {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                        ? 'Avalanche vs snowball'
                        : 'Snowball vs avalanche'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Current strategy
                        </p>
                        <p className="text-xl font-black text-slate-800">
                          {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                            ? 'Avalanche'
                            : 'Snowball'}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                          {formatMonthsLabel(monthlyPlan.debtTimeline.months)} ·{' '}
                          {formatValue(monthlyPlan.debtTimeline.totalInterest)} interest
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Other strategy
                        </p>
                        <p className="text-xl font-black text-slate-800">
                          {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                            ? 'Snowball'
                            : 'Avalanche'}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                          {formatMonthsLabel(comparisonPlan.debtTimeline.months)} ·{' '}
                          {formatValue(comparisonPlan.debtTimeline.totalInterest)} interest
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Difference
                        </p>
                        <p className="text-xl font-black text-slate-800">
                          {comparisonInterestDelta === 0
                            ? 'Very similar'
                            : comparisonInterestDelta > 0
                            ? `${formatValue(comparisonInterestDelta)} less interest`
                            : `${formatValue(Math.abs(comparisonInterestDelta))} more interest`}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                          Useful if you want to balance motivation against total cost.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
        </section>

        {totals.priorityDebt && totals.payoffEstimate && (
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2 min-w-0">
              <Info className="w-4 h-4 shrink-0" /> Estimated payoff for{' '}
              {totals.priorityDebt.name || 'your priority debt'}
            </h3>

            {totals.payoffEstimate.valid ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Estimated payoff time
                    </p>
                    <p className="text-2xl font-black text-slate-800 break-words">
                      {formatMonthsLabel(totals.payoffEstimate.months)}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 break-words">
                      At your current payment of {formatValue(totals.priorityDebt.minPayment)} per month,
                      {` ${totals.priorityDebt.name || 'this debt'} `}
                      could be cleared in about {formatMonthsLabel(totals.payoffEstimate.months)}.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Estimated interest paid
                    </p>
                    <p className="text-2xl font-black text-slate-800 break-words">
                      {formatValue(totals.payoffEstimate.totalInterest)}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 break-words">
                      If you keep paying the same amount, you may pay about{' '}
                      {formatValue(totals.payoffEstimate.totalInterest)} in interest on{' '}
                      {totals.priorityDebt.name || 'this debt'} over that time.
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Current monthly payment
                  </p>
                  <p className="text-2xl font-black text-slate-800 break-words">
                    {formatValue(totals.priorityDebt.minPayment)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Based on what you entered, this is the monthly amount currently being used to
                    estimate the payoff time above for this debt.
                  </p>
                </div>

                <div className="mt-6">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4">
                    Suggested monthly payments for this debt
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {totals.targetPaymentOptions.map((option) => (
                      <div
                        key={option.months}
                        className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0"
                      >
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          {option.label}
                        </p>

                        {option.result.valid ? (
                          <>
                            <p className="text-2xl font-black text-slate-800 break-words">
                              {formatValue(option.result.monthlyPayment)}/month
                            </p>
                            <p className="text-sm text-slate-500 mt-1 break-words">
                              To aim for repayment in about {option.months} months, you may need to
                              pay around {formatValue(option.result.monthlyPayment)} each month on
                              this debt.
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Add clearer balance, APR, and payment details to estimate this target.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="text-slate-700">
                  {totals.payoffEstimate.reason === 'missing_values' && (
                    <p>
                      Add balance, APR, and minimum payment to see an estimate for this debt.
                    </p>
                  )}

                  {totals.payoffEstimate.reason === 'payment_too_low' && (
                    <>
                      <p>
                        Your current payment may be too low to bring this debt down. Based on the
                        balance and APR entered, the interest added each month may be higher than
                        your monthly payment.
                      </p>

                      {(() => {
                        const minNeeded = calculateMinimumPaymentToReduce(
                          totals.priorityDebt.balance,
                          totals.priorityDebt.interest
                        );

                        return minNeeded ? (
                          <p className="text-sm text-[#1EB1BB] font-bold mt-2">
                            You may need to pay at least {formatValue(minNeeded)} per month for this
                            debt to start reducing.
                          </p>
                        ) : null;
                      })()}

                      <p className="text-sm text-slate-500 mt-2">
                        Try increasing your monthly payment or check your latest statement to confirm
                        the required repayment.
                      </p>
                    </>
                  )}

                  {totals.payoffEstimate.reason === 'too_long' && (
                    <p>
                      At this payment level, this debt may take a very long time to clear.
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-4">
              Estimates assume the interest rate stays the same and no new borrowing is added.
            </p>
          </div>
        )}

        <div
          className={`bg-white p-8 md:p-16 rounded-[3rem] border-2 shadow-xl ${totals.tier.border} max-w-3xl mx-auto w-full relative overflow-hidden`}
        >
          <div
            className={`absolute -top-6 left-8 md:left-12 p-4 rounded-2xl ${totals.tier.bg} ${totals.tier.color} shadow-lg`}
          >
            {totals.remaining < 0 ? (
              <AlertCircle className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>

          <div className="mt-8">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" /> Strategic Recommendation
            </h3>

            <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
              {totals.remaining < 0 ? (
                <>
                  <p className="font-bold text-slate-800 text-xl">
                    Your current position is under pressure.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        What this means
                      </p>
                      <p className="text-slate-700 leading-relaxed">
                        Your listed monthly costs are currently higher than your income. This may
                        explain why things feel difficult to manage right now.
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        What to focus on
                      </p>
                      <ul className="space-y-2 text-slate-700">
                        <li>• Review your largest budget categories first</li>
                        <li>• Check which debt is costing the most in interest</li>
                        <li>• Keep essential bills and spending realistic</li>
                      </ul>
                    </div>
                  </div>

                  {topTrimCategory && (
                    <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-100 mt-2 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#1EB1BB] mb-2">
                        Best place to start reviewing
                      </p>
                      <p className="text-slate-800 font-bold break-words">
                        {topTrimCategory.name} — currently {formatValue(topTrimCategory.amount)}
                      </p>
                      <p className="text-slate-600 text-sm mt-2">
                        This is your largest flexible budget category and the first place to assess
                        for possible reductions.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-800 text-xl">
                    You have some room to make progress.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        What this means
                      </p>
                      <p className="text-slate-700 leading-relaxed">
                        You currently have money left after your listed obligations. That gives you
                        room to automate savings and speed up debt payoff.
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        What to focus on
                      </p>
                      <ul className="space-y-2 text-slate-700">
                        <li>• Follow the monthly plan consistently</li>
                        <li>• Keep up minimum payments on every debt</li>
                        <li>• Review your biggest spending categories regularly</li>
                      </ul>
                    </div>
                  </div>

                  {topBudgetCategories[0] && (
                    <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-100 mt-2 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#1EB1BB] mb-2">
                        If you want faster progress
                      </p>
                      <p className="text-slate-800 font-bold break-words">
                        Review {topBudgetCategories[0].name} first
                      </p>
                      <p className="text-slate-600 text-sm mt-2 break-words">
                        It is your largest category at {formatValue(topBudgetCategories[0].amount)}.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setStep(2)}
            className="text-slate-400 font-black text-[11px] uppercase tracking-[0.3em] hover:text-[#1EB1BB] transition-colors flex items-center gap-3 mx-auto p-6 max-w-full"
          >
            <PenLine className="w-4 h-4 shrink-0" /> Refine Your Figures
          </button>
        </div>
      </div>
    );
  };

  const progressSteps = [2, 3, 4];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-cyan-100 selection:text-[#1EB1BB] overflow-x-hidden">
      {step > 0 && (
        <header className="p-4 md:p-8 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100">
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto gap-4 min-w-0">
            <div
              className="flex items-center cursor-pointer active:scale-95 transition-transform min-w-0"
              onClick={() => setStep(0)}
            >
              <img
                src="/vayrity-logo.png"
                alt="Vayrity logo"
                className="h-10 md:h-12 w-auto object-contain max-w-full"
              />
            </div>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2 uppercase tracking-widest px-3 md:px-4 py-2 shrink-0"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </header>
      )}

      {step > 1 && step < 5 && (
        <div className="pt-8 px-4 sm:px-6 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between min-w-0">
            {progressSteps.map((progressStep, index) => (
              <React.Fragment key={progressStep}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 shrink-0 ${
                    step >= progressStep
                      ? 'bg-[#1EB1BB] text-white shadow-lg shadow-cyan-200'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>

                {index < progressSteps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 min-w-0 ${
                      step > progressStep ? 'bg-[#1EB1BB]' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-in overflow-x-hidden">
        {step === 0 && WelcomeView()}
        {step === 1 && PrepView()}
        {step === 2 && BasicsView()}
        {step === 3 && DebtsView()}
        {step === 4 && BillsView()}
        {step === 5 && ResultsView()}
      </main>

      {step > 1 && step < 5 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 z-40">
          <div className="w-full max-w-2xl mx-auto">
            {!stepValidation.canProceed && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="min-w-0 break-words">{stepValidation.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={prevStep}
                className="flex-1 flex items-center justify-center gap-2 py-4 md:py-5 px-4 rounded-2xl font-black text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors text-sm uppercase tracking-widest min-w-0"
              >
                <ChevronLeft className="w-5 h-5 shrink-0" /> Back
              </button>

              <button
                onClick={nextStep}
                disabled={!stepValidation.canProceed}
                className={`flex-[2] py-4 md:py-5 px-4 rounded-2xl font-black text-base md:text-lg transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-wider min-w-0 ${
                  stepValidation.canProceed
                    ? 'bg-[#1B2B4B] text-white hover:bg-slate-800 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <span className="truncate">{step === 4 ? 'Get Results' : 'Continue'}</span>
                <ChevronRight className="w-6 h-6 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {lastDeleted && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-[#1B2B4B] text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <p className="font-black text-sm">
                {lastDeleted.type === 'debt' ? 'Debt deleted' : 'Bill deleted'}
              </p>
              <p className="text-xs text-white/70 truncate">
                {lastDeleted.item?.name || 'Item'}
              </p>
            </div>

            <button
              onClick={undoDelete}
              className="text-[#1EB1BB] font-black text-sm uppercase tracking-wider whitespace-nowrap shrink-0"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {showTrimApplied && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-[#1B2B4B] text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <p className="font-black text-sm">Trim targets applied</p>
              <p className="text-xs text-white/70">
                Your budget category targets have been updated.
              </p>
            </div>

            {preTrimBudgetSnapshot ? (
              <button
                onClick={undoAppliedTrimPlan}
                className="text-[#1EB1BB] font-black text-sm uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                Undo
              </button>
            ) : (
              <button
                onClick={() => setShowTrimApplied(false)}
                className="text-[#1EB1BB] font-black text-sm uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                Okay
              </button>
            )}
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 md:p-8 overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 mb-3">
              Reset everything?
            </h3>

            <p className="text-slate-500 leading-relaxed mb-6">
              This will clear your income, budget categories, debts, bills, savings setup, and
              saved progress. This action cannot be undone.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 rounded-2xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors uppercase tracking-wider text-sm"
              >
                Cancel
              </button>

              <button
                onClick={resetApp}
                className="flex-1 py-4 rounded-2xl font-black text-white bg-red-500 hover:bg-red-600 transition-colors uppercase tracking-wider text-sm"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        html, body, #root {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .animate-in {
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type=number] {
          -moz-appearance: textfield;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
