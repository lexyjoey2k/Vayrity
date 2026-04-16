import React, { useState, useEffect, useMemo, useRef } from 'react';
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
const STORAGE_KEY = 'vayrity_app_data_v14';
const LEGACY_STORAGE_KEYS = ['vayrity_app_data_v13', 'vayrity_app_data_v12'];

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

const INCOME_PERIODS = [
  { key: 'monthly',   label: 'Monthly',       multiplier: 1 },
  { key: 'weekly',    label: 'Weekly',         multiplier: 52 / 12 },
  { key: 'biweekly',  label: 'Every 2 weeks',  multiplier: 26 / 12 },
  { key: 'annual',    label: 'Yearly',         multiplier: 1 / 12 },
];

const PAYOFF_TARGET_MONTHS = [6, 12, 24];

// --- Factories ---
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

const createExpense = (categoryId = '') => ({
  id: crypto.randomUUID(),
  categoryId,
  amount: '',
  note: '',
  date: new Date().toISOString().slice(0, 10),
});

const createWeeklyCheckIn = () => ({
  id: crypto.randomUUID(),
  weekKey: '',
  wins: '',
  blockers: '',
  nextStep: '',
});

const createMonthlyReview = () => ({
  id: crypto.randomUUID(),
  monthKey: '',
  summary: '',
  whatWorked: '',
  whatNeedsAttention: '',
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

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

const ceilMoney = (value) => Math.ceil(toNumber(value) || 0);

const clamp = (value, min, max) =>
  Math.min(Math.max(toNumber(value), min), max);

const sumBy = (items, selector) =>
  items.reduce((sum, item) => sum + toNumber(selector(item)), 0);

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

const getMonthKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getWeekKey = (date = new Date()) => {
  const d = new Date(date);
  const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey) => {
  if (!monthKey) return 'this month';
  const [year, month] = String(monthKey).split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const getWeekLabel = (weekKey) => {
  if (!weekKey) return 'this week';
  return weekKey.replace('-W', ' week ');
};

const sortDebtsByStrategy = (debts, strategy = PAYOFF_STRATEGIES.avalanche) => {
  const activeDebts = debts.filter((debt) => toNumber(debt.balance) > 0.01);

  if (strategy === PAYOFF_STRATEGIES.snowball) {
    return [...activeDebts].sort((a, b) => {
      const balanceDiff = toNumber(a.balance) - toNumber(b.balance);
      if (balanceDiff !== 0) return balanceDiff;

      const aprDiff = toNumber(b.interest) - toNumber(a.interest);
      if (aprDiff !== 0) return aprDiff;

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
    (state.budgetCategories || []).filter(
      (category) => category.type === 'essential'
    ),
    (category) => category.amount
  );
  const minimumDebtTotal = sumBy(state.debts || [], (debt) => debt.minPayment);

  const baseMonthlyEssentials =
    billsTotal + essentialBudgetTotal + minimumDebtTotal;

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

  const normalizedBudgetCategories = migratedBudgetCategories.map(
    (category) => ({
      id: category.id || crypto.randomUUID(),
      name: category.name || 'New Category',
      amount: category.amount ?? '',
      type: category.type === 'non-essential' ? 'non-essential' : 'essential',
    })
  );

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
    tracking: {
      expenses: Array.isArray(parsed?.tracking?.expenses)
        ? parsed.tracking.expenses.map((expense) => ({
            id: expense.id || crypto.randomUUID(),
            categoryId: expense.categoryId || '',
            amount: expense.amount ?? '',
            note: expense.note || '',
            date: expense.date || new Date().toISOString().slice(0, 10),
          }))
        : [],
      weeklyCheckIns: Array.isArray(parsed?.tracking?.weeklyCheckIns)
        ? parsed.tracking.weeklyCheckIns.map((checkIn) => ({
            id: checkIn.id || crypto.randomUUID(),
            weekKey: checkIn.weekKey || '',
            wins: checkIn.wins || '',
            blockers: checkIn.blockers || '',
            nextStep: checkIn.nextStep || '',
          }))
        : [],
      monthlyReviews: Array.isArray(parsed?.tracking?.monthlyReviews)
        ? parsed.tracking.monthlyReviews.map((review) => ({
            id: review.id || crypto.randomUUID(),
            monthKey: review.monthKey || '',
            summary: review.summary || '',
            whatWorked: review.whatWorked || '',
            whatNeedsAttention: review.whatNeedsAttention || '',
          }))
        : [],
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
  const finalEstimate = calculateDebtPayoff(
    principal,
    annualRate,
    requiredPayment
  );

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
    const totalAvailableExtra = roundMoney(
      toNumber(extraMonthly) + freedPaymentPool
    );

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
    Math.min(
      recommendedEmergencyTarget,
      emergencyTarget * 3 || recommendedEmergencyTarget
    )
  );

  const emergencyGap = Math.max(0, effectiveEmergencyTarget - currentSavings);
  const remaining = toNumber(totals.remaining);
  const validDebts = (state.debts || []).filter(
    (debt) => toNumber(debt.balance) > 0
  );

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

const buildSavingsProjection = ({
  currentSavings = 0,
  savingsAllocation = 0,
  emergencyTarget = 0,
}) => {
  const safeCurrent = Math.max(0, roundMoney(currentSavings));
  const safeTarget = Math.max(0, roundMoney(emergencyTarget));
  const monthlyContribution = Math.max(0, roundMoney(savingsAllocation));
  const remainingToGoal = Math.max(0, roundMoney(safeTarget - safeCurrent));
  const progressPercent =
    safeTarget > 0 ? clamp((safeCurrent / safeTarget) * 100, 0, 100) : 0;

  const monthsToGoal =
    remainingToGoal <= 0
      ? 0
      : monthlyContribution > 0
      ? Math.ceil(remainingToGoal / monthlyContribution)
      : null;

  const milestoneRatios = [0.25, 0.5, 0.75, 1];
  const milestones = milestoneRatios.map((ratio) => {
    const milestoneAmount = roundMoney(safeTarget * ratio);
    const amountRemaining = Math.max(0, roundMoney(milestoneAmount - safeCurrent));
    const monthsAway =
      amountRemaining <= 0
        ? 0
        : monthlyContribution > 0
        ? Math.ceil(amountRemaining / monthlyContribution)
        : null;

    return {
      key: String(ratio),
      label: `${Math.round(ratio * 100)}% milestone`,
      amount: milestoneAmount,
      monthsAway,
      achieved: safeCurrent >= milestoneAmount,
    };
  });

  const nextMilestone = milestones.find((item) => !item.achieved) || milestones[milestones.length - 1] || null;

  const status =
    remainingToGoal <= 0
      ? 'Goal funded'
      : monthlyContribution > 0
      ? `On track to reach your savings target ${getMonthsFromNowLabel(monthsToGoal)}`
      : 'Add a monthly savings contribution to start reaching your target';

  return {
    monthlyContribution,
    remainingToGoal,
    progressPercent,
    monthsToGoal,
    milestones,
    nextMilestone,
    status,
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
    const shortfall = Math.abs(remaining);

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
      savingsProjection: buildSavingsProjection({
        currentSavings,
        savingsAllocation: 0,
        emergencyTarget: effectiveEmergencyTarget,
      }),
      actionHeadline: 'Fix the monthly gap first',
      explanation:
        'You are currently running a monthly shortfall. The most important move is to get back to zero before trying to speed up debt payoff.',
      actions: [
        `Close the monthly gap of ${shortfall} first.`,
        'Keep every debt at least at its minimum payment.',
        'Reduce flexible spending before changing essential costs where possible.',
        'Once your monthly balance reaches zero or above, restart accelerated debt payoff.',
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
    savingsAllocation = roundMoney(
      Math.min(Math.max(remaining * 0.15, 25), remaining * 0.3)
    );
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
        strategy,
        months: 0,
        totalInterest: 0,
        payoffOrder: [],
        payoffMoments: [],
        monthlySnapshots: [],
      };

  const debtTimelineWithoutExtra = hasDebt
    ? calculatePortfolioPayoff(state.debts, 0, strategy)
    : {
        valid: true,
        strategy,
        months: 0,
        totalInterest: 0,
        payoffOrder: [],
        payoffMoments: [],
        monthlySnapshots: [],
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
          toNumber(debtTimelineWithoutExtra.months) -
            toNumber(debtTimeline.months)
        )
      : 0;

  const emergencyFundMonths =
    emergencyGap > 0 && savingsAllocation > 0
      ? Math.ceil(emergencyGap / savingsAllocation)
      : emergencyGap <= 0
      ? 0
      : null;

  const savingsProjection = buildSavingsProjection({
    currentSavings,
    savingsAllocation,
    emergencyTarget: effectiveEmergencyTarget,
  });

  const firstPayoffMoment = debtTimeline?.payoffMoments?.[0] || null;
  const focusDebt = debtPlan.find((debt) => debt.isPriority) || null;

  const actionHeadline = !hasDebt
    ? 'Turn your surplus into steady savings growth'
    : emergencyGap > 0
      ? 'Build your buffer while reducing debt'
      : 'Keep saving while pushing harder on debt';

  const explanation = !hasDebt
    ? 'You do not have active debt, so your plan can focus on building savings deliberately each month instead of treating savings like leftover money.'
    : emergencyGap > 0
      ? 'This plan splits your spare cash between building a safety buffer and reducing debt. That lowers the risk of borrowing again while still moving you forward.'
      : 'This plan keeps your savings habit going while sending most of your surplus toward faster debt payoff.';

  const actions = [];

  if (savingsAllocation > 0) {
    if (emergencyGap > 0) {
      actions.push(
        `Send ${savingsAllocation} per month to savings until you reach about ${effectiveEmergencyTarget}.`
      );
    } else {
      actions.push(
        `Keep adding ${savingsAllocation} per month to savings so your buffer keeps growing.`
      );
    }
  }

  if (hasDebt && focusDebt) {
    actions.push(
      `Keep all minimum payments in place, then send the extra ${debtAllocation} to ${focusDebt.name}.`
    );
  }

  if (firstPayoffMoment) {
    actions.push(
      `${firstPayoffMoment.name} is your first likely payoff ${getMonthsFromNowLabel(
        firstPayoffMoment.month
      )}.`
    );
    actions.push(
      'When that debt is cleared, roll its payment into the next debt automatically.'
    );
  }

  if (monthsSavedVsMinimums > 0) {
    actions.push(
      `This plan could make you debt-free about ${monthsSavedVsMinimums} months sooner than minimum payments only.`
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
    savingsProjection,
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

const buildResultActions = ({ totals, monthlyPlan, trimPlan, state, formatValue }) => {
  const actions = [];
  const nonEssentialTotal = sumBy(
    (state.budgetCategories || []).filter(
      (category) => category.type === 'non-essential'
    ),
    (category) => category.amount
  );

  const focusDebt =
    monthlyPlan?.debtPlan?.find((debt) => debt.isPriority) ||
    totals.priorityDebt ||
    null;

  if (monthlyPlan.type === 'deficit') {
    if (trimPlan.quickWin) {
      actions.push({
        title: `Reduce ${trimPlan.quickWin.name} by ${formatValue(trimPlan.quickWin.suggestedTrim)}`,
        detail: trimPlan.covered
          ? `Cutting ${formatValue(trimPlan.quickWin.suggestedTrim)} from this category is enough to get back to zero.`
          : `This is the biggest single trim available, but your ${formatValue(trimPlan.deficit)} gap needs cuts across multiple categories. Total cuts needed: ${formatValue(trimPlan.deficit)}.`,
        tone: 'warning',
      });
    }

    actions.push({
      title: 'Get back to zero first',
      detail: `Your first target is to remove the ${formatValue(
        Math.abs(monthlyPlan.surplus)
      )} monthly gap before accelerating debt payoff.`,
      tone: 'warning',
    });

    if (trimPlan.covered) {
      actions.push({
        title: 'Apply the trim plan',
        detail: `Applying all suggested cuts would move your monthly balance to about ${formatValue(
          toNumber(totals.remaining) + toNumber(trimPlan.totalSuggested)
        )}.`,
        tone: 'success',
      });
    } else if (trimPlan.totalSuggested > 0) {
      actions.push({
        title: `Suggested cuts cover ${formatValue(trimPlan.totalSuggested)} of the ${formatValue(trimPlan.deficit)} gap`,
        detail: `You still need ${formatValue(trimPlan.remainingGap)} more in reductions — review essential costs or look for additional income.`,
        tone: 'warning',
      });
    }

    if (focusDebt) {
      actions.push({
        title: `Keep ${focusDebt.name} current`,
        detail: 'Keep all minimum debt payments current while you stabilise your budget.',
        tone: 'neutral',
      });
    }

    return actions;
  }

  if (monthlyPlan.savingsAllocation > 0) {
    actions.push({
      title: 'Automate savings',
      detail: `Move ${formatValue(
        monthlyPlan.savingsAllocation
      )} into savings each month to keep building your buffer.`,
      tone: 'success',
    });
  }

  if (monthlyPlan.debtAllocation > 0 && focusDebt) {
    actions.push({
      title: `Target ${focusDebt.name}`,
      detail: `Keep all minimums going, then send the extra ${formatValue(
        monthlyPlan.debtAllocation
      )} here each month.`,
      tone: 'success',
    });
  } else if (!focusDebt && monthlyPlan.surplus > 0) {
    actions.push({
      title: 'Build savings faster',
      detail: 'With no active debt to target, direct your monthly surplus into savings and cash buffer growth.',
      tone: 'success',
    });
  }

  if (monthlyPlan.monthsSavedVsMinimums > 0) {
    actions.push({
      title: 'Speed up payoff',
      detail: `This plan could shorten your total debt payoff by about ${monthlyPlan.monthsSavedVsMinimums} months versus minimum payments only.`,
      tone: 'success',
    });
  }

  if (monthlyPlan.interestSavedVsMinimums > 0) {
    actions.push({
      title: 'Reduce interest',
      detail: `Following this plan could save about ${formatValue(
        monthlyPlan.interestSavedVsMinimums
      )} in interest versus minimum payments only.`,
      tone: 'neutral',
    });
  }

  if (nonEssentialTotal > 0) {
    actions.push({
      title: 'Review flexible spending',
      detail: `You currently have ${formatValue(
        nonEssentialTotal
      )} in non-essential categories, which is your quickest source of extra progress.`,
      tone: 'neutral',
    });
  }

  if (focusDebt && toNumber(focusDebt.interest) > 0) {
    actions.push({
      title: 'Avoid new borrowing on the target debt',
      detail: `New spending on ${focusDebt.name} will slow the payoff plan and increase interest costs.`,
      tone: 'neutral',
    });
  }

  return actions;
};
const InsightCard = ({
  eyebrow,
  title,
  description,
  value,
  valueClassName = 'text-xl md:text-2xl font-black text-slate-800',
  children,
  tone = 'default',
  compact = false,
}) => {
  const toneClasses =
    tone === 'success'
      ? 'bg-cyan-50 border-cyan-100'
      : tone === 'warning'
      ? 'bg-rose-50 border-rose-100'
      : tone === 'highlight'
      ? 'bg-amber-50 border-amber-100'
      : 'bg-white border-slate-100';

  return (
    <div
      className={`rounded-2xl border min-w-0 ${toneClasses} ${
        compact ? 'p-4' : 'p-4 md:p-5'
      }`}
    >
      {eyebrow && (
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
          {eyebrow}
        </p>
      )}

      {title && (
        <p className="text-base md:text-lg font-black text-slate-800 break-words">
          {title}
        </p>
      )}

      {value !== undefined && value !== null && (
        <p className={`break-words ${title ? 'mt-2' : ''} ${valueClassName}`}>
          {value}
        </p>
      )}

      {description && (
        <p className="text-sm text-slate-500 mt-2 break-words">{description}</p>
      )}

      {children ? <div className={description ? 'mt-3' : ''}>{children}</div> : null}
    </div>
  );
};

const SectionIntro = ({
  icon,
  eyebrow,
  title,
  description,
  iconTone = 'default',
}) => {
  const iconClasses =
    iconTone === 'success'
      ? 'bg-cyan-50 text-[#1EB1BB]'
      : iconTone === 'warning'
      ? 'bg-rose-50 text-rose-500'
      : 'bg-slate-50 text-slate-500';

  return (
    <div className="flex items-start gap-3 md:gap-4 mb-6 md:mb-8 min-w-0">
      <div
        className={`w-12 h-12 md:w-14 md:h-14 rounded-[1rem] md:rounded-[1.25rem] flex items-center justify-center flex-shrink-0 ${iconClasses}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        {eyebrow && (
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="text-xl md:text-3xl font-black text-slate-800 leading-tight break-words">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-slate-500 mt-2 break-words">{description}</p>
        )}
      </div>
    </div>
  );
};

const PrintSummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-200">
    <span className="text-sm font-bold text-slate-500">{label}</span>
    <span className="text-sm font-black text-slate-900 text-right">{value}</span>
  </div>
);

const DisclaimerCard = () => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 text-center max-w-3xl mx-auto">
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
      Important
    </p>
    <p className="text-sm text-slate-600 leading-relaxed">
      This tool provides general guidance and illustrative calculations only.
      It does not constitute financial advice. Always consider your personal
      circumstances and, if needed, seek advice from a qualified financial
      professional.
    </p>
  </div>
);

const PrintSummary = ({
  generatedDate,
  totals,
  monthlyPlan,
  trimPlan,
  nextFocusDebt,
  formatValue,
  printPrimaryAction,
}) => (
  <div className="print-summary hidden">
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <img
            src="/vayrity-logo.png"
            alt="Vayrity logo"
            className="h-10 w-auto object-contain mb-4"
          />
          <h1 className="text-3xl font-black text-[#1B2B4B]">
            Vayrity Plan Summary
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Generated on {generatedDate}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Monthly Position
          </p>
          <p
            className={`text-3xl font-black ${
              totals.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatValue(totals.remaining)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section>
          <h2 className="text-lg font-black text-slate-900 mb-4">
            Financial Snapshot
          </h2>
          <div className="rounded-2xl border border-slate-200 p-4">
            <PrintSummaryRow
              label="Monthly position"
              value={formatValue(totals.remaining)}
            />
            <PrintSummaryRow
              label="Total debt"
              value={formatValue(totals.totalDebtBalance)}
            />
            <PrintSummaryRow
              label="Current savings"
              value={formatValue(monthlyPlan.currentSavings)}
            />
            <PrintSummaryRow
              label="Emergency target"
              value={formatValue(monthlyPlan.effectiveEmergencyTarget)}
            />
            <PrintSummaryRow
              label="Budget spending"
              value={formatValue(totals.budgetSpending)}
            />
            <PrintSummaryRow
              label="Flexible spending"
              value={formatValue(totals.nonEssentialBudgetTotal)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black text-slate-900 mb-4">
            Primary Action
          </h2>
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-base font-black text-slate-900">
              {printPrimaryAction}
            </p>
            <p className="text-sm text-slate-600 mt-2">
              {monthlyPlan.explanation}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black text-slate-900 mb-4">
            Monthly Plan
          </h2>
          <div className="rounded-2xl border border-slate-200 p-4">
            {monthlyPlan.type === 'deficit' ? (
              <>
                <PrintSummaryRow
                  label="Current monthly gap"
                  value={formatValue(Math.abs(monthlyPlan.surplus))}
                />
                <PrintSummaryRow
                  label="Suggested trim total"
                  value={formatValue(trimPlan.totalSuggested)}
                />
                <PrintSummaryRow
                  label="Balance after suggested trims"
                  value={formatValue(
                    roundMoney(
                      toNumber(totals.remaining) +
                        toNumber(trimPlan.totalSuggested)
                    )
                  )}
                />
              </>
            ) : (
              <>
                <PrintSummaryRow
                  label="Monthly to savings"
                  value={formatValue(monthlyPlan.savingsAllocation)}
                />
                <PrintSummaryRow
                  label="Monthly extra to debt"
                  value={formatValue(monthlyPlan.debtAllocation)}
                />
                <PrintSummaryRow
                  label="Debt-free estimate"
                  value={
                    monthlyPlan.debtTimeline?.valid
                      ? monthlyPlan.debtTimeline.months === 0
                        ? 'No active debt'
                        : formatMonthsLabel(monthlyPlan.debtTimeline.months)
                      : 'Needs clearer debt details'
                  }
                />
                <PrintSummaryRow
                  label="Emergency fund estimate"
                  value={
                    monthlyPlan.emergencyFundMonths === 0
                      ? 'Already funded'
                      : monthlyPlan.emergencyFundMonths
                      ? formatMonthsLabel(monthlyPlan.emergencyFundMonths)
                      : 'In progress'
                  }
                />
              </>
            )}
          </div>
        </section>

        {nextFocusDebt && (
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-4">
              Priority Debt
            </h2>
            <div className="rounded-2xl border border-slate-200 p-4">
              <PrintSummaryRow label="Debt" value={nextFocusDebt.name} />
              <PrintSummaryRow
                label="Balance"
                value={formatValue(nextFocusDebt.balance)}
              />
              <PrintSummaryRow
                label="APR"
                value={`${toNumber(nextFocusDebt.interest)}%`}
              />
              <PrintSummaryRow
                label="Minimum payment"
                value={`${formatValue(
                  nextFocusDebt.minPayment || 0
                )}/month`}
              />
            </div>
          </section>
        )}

        {monthlyPlan.actions?.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-4">
              Action Checklist
            </h2>
            <div className="rounded-2xl border border-slate-200 p-5">
              <ul className="space-y-2 text-sm text-slate-700">
                {monthlyPlan.actions.slice(0, 5).map((action, index) => (
                  <li key={`${action}-${index}`}>• {action}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-black text-slate-900 mb-4">
            Recommendation
          </h2>
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-sm text-slate-700 leading-relaxed">
              {monthlyPlan.type === 'deficit'
                ? trimPlan.quickWin
                  ? `Best move: reduce ${trimPlan.quickWin.name} by ${formatValue(
                      trimPlan.quickWin.suggestedTrim
                    )} to get back to zero.`
                  : 'Best move: reduce spending until your monthly balance reaches zero or above.'
                : nextFocusDebt
                ? `Best move: follow the plan consistently and protect the extra payment going to ${nextFocusDebt.name}.`
                : 'Best move: keep building savings consistently with your monthly surplus.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
);

export default function App() {
  const [step, setStep] = useState(0);
  const [expandedDebtId, setExpandedDebtId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [expandedBudgetCategoryId, setExpandedBudgetCategoryId] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTrimApplied, setShowTrimApplied] = useState(false);
  const [highlightTrimUpdate, setHighlightTrimUpdate] = useState(false);
  const [preTrimBudgetSnapshot, setPreTrimBudgetSnapshot] = useState(null);
  const [payoffStrategy, setPayoffStrategy] = useState(
    PAYOFF_STRATEGIES.avalanche
  );
  const [selectedComparisonStrategy, setSelectedComparisonStrategy] = useState(
    PAYOFF_STRATEGIES.avalanche
  );
  const [incomePeriod, setIncomePeriod] = useState('monthly');

  const resultsTopRef = useRef(null);
  const trimUpdatedRef = useRef(null);
  const debtPresetScrollRef = useRef(null);
  const billPresetScrollRef = useRef(null);

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
    tracking: {
      expenses: [],
      weeklyCheckIns: [],
      monthlyReviews: [],
    },
  });

  const [expenseDraft, setExpenseDraft] = useState(() => createExpense());
  const [weeklyCheckInDraft, setWeeklyCheckInDraft] = useState(() => ({
    ...createWeeklyCheckIn(),
    weekKey: getWeekKey(),
  }));
  const [monthlyReviewDraft, setMonthlyReviewDraft] = useState(() => ({
    ...createMonthlyReview(),
    monthKey: getMonthKey(),
  }));

  useEffect(() => {
    const loaded = loadSavedState();

    if (loaded) {
      setState((prev) => ({
        ...prev,
        ...loaded,
      }));

      if (loaded?.budgetCategories?.length) {
        setExpandedBudgetCategoryId(loaded.budgetCategories[0].id);
      }
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
    setSelectedComparisonStrategy(payoffStrategy);
  }, [payoffStrategy]);

  useEffect(() => {
    if (!showTrimApplied) return;

    const timer = setTimeout(() => {
      setShowTrimApplied(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [showTrimApplied]);

  useEffect(() => {
    if (!highlightTrimUpdate) return;

    const timer = setTimeout(() => {
      setHighlightTrimUpdate(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [highlightTrimUpdate]);

  useEffect(() => {
    if (!state.budgetCategories.length) {
      setExpandedBudgetCategoryId(null);
      return;
    }

    const stillExists = state.budgetCategories.some(
      (category) => category.id === expandedBudgetCategoryId
    );

    if (!expandedBudgetCategoryId || !stillExists) {
      setExpandedBudgetCategoryId(state.budgetCategories[0].id);
    }
  }, [state.budgetCategories, expandedBudgetCategoryId]);

  useEffect(() => {
    setExpenseDraft((prev) => {
      if (prev.categoryId) {
        const exists = state.budgetCategories.some(
          (category) => category.id === prev.categoryId
        );
        if (exists) return prev;
      }

      return createExpense(state.budgetCategories[0]?.id || '');
    });
  }, [state.budgetCategories]);

  useEffect(() => {
    if (step !== 5) return;

    requestAnimationFrame(() => {
      resultsTopRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [step]);

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

  const exportResultsAsPdf = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
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
    const periodMultiplier = INCOME_PERIODS.find((p) => p.key === incomePeriod)?.multiplier ?? 1;
    const income = roundMoney(toNumber(state.income) * periodMultiplier);
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
      heading: 'You have room to make progress',
      label: 'Monthly Surplus',
      tone: 'surplus',
      summary: 'You have enough monthly space to build savings and accelerate debt payoff.',
      shortLabel: 'Progress room',
    };

    if (remaining < -300) {
      tier = {
        level: 1,
        color: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-100',
        heading: 'Your budget is under heavy pressure',
        label: 'Monthly Deficit',
        tone: 'deficit',
        summary:
          'Your listed monthly costs are significantly higher than your income, so stabilising cash flow should come before faster debt payoff.',
        shortLabel: 'Heavy pressure',
      };
    } else if (remaining < 0) {
      tier = {
        level: 2,
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        heading: 'You are slightly overspending',
        label: 'Monthly Deficit',
        tone: 'deficit',
        summary:
          'This looks fixable, but you need to remove the monthly shortfall before putting extra money toward debt.',
        shortLabel: 'Overspending',
      };
    } else if (remaining <= 100) {
      tier = {
        level: 3,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        heading: 'You are close to break-even',
        label: 'Monthly Margin',
        tone: 'tight',
        summary:
          'You are not far from stability, but your plan still has very little room for surprises.',
        shortLabel: 'Very tight',
      };
    } else if (remaining <= 300) {
      tier = {
        level: 4,
        color: 'text-teal-500',
        bg: 'bg-teal-50',
        border: 'border-teal-100',
        heading: 'You have a small monthly cushion',
        label: 'Monthly Surplus',
        tone: 'surplus',
        summary:
          'You have some room to build momentum, but consistent follow-through still matters.',
        shortLabel: 'Small cushion',
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
  }, [state, essentialBudgetTotal, nonEssentialBudgetTotal, incomePeriod]);

  const currentMonthKey = useMemo(() => getMonthKey(), []);
  const currentWeekKey = useMemo(() => getWeekKey(), []);

  const currentMonthExpenses = useMemo(
    () =>
      (state.tracking?.expenses || []).filter(
        (expense) => String(expense.date || '').slice(0, 7) === currentMonthKey
      ),
    [state.tracking, currentMonthKey]
  );

  const actualSpendingThisMonth = useMemo(
    () => sumBy(currentMonthExpenses, (expense) => expense.amount),
    [currentMonthExpenses]
  );

  const categoryActuals = useMemo(
    () =>
      state.budgetCategories.map((category) => {
        const actual = sumBy(
          currentMonthExpenses.filter((expense) => expense.categoryId === category.id),
          (expense) => expense.amount
        );

        return {
          id: category.id,
          name: category.name || 'Category',
          planned: toNumber(category.amount),
          actual: roundMoney(actual),
          variance: roundMoney(toNumber(category.amount) - actual),
          overspent: actual > toNumber(category.amount) && toNumber(category.amount) > 0,
        };
      }),
    [state.budgetCategories, currentMonthExpenses]
  );

  const currentWeekCheckIn = useMemo(
    () =>
      (state.tracking?.weeklyCheckIns || []).find(
        (checkIn) => checkIn.weekKey === currentWeekKey
      ) || null,
    [state.tracking, currentWeekKey]
  );

  const currentMonthReview = useMemo(
    () =>
      (state.tracking?.monthlyReviews || []).find(
        (review) => review.monthKey === currentMonthKey
      ) || null,
    [state.tracking, currentMonthKey]
  );

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
    () => buildResultActions({ totals, monthlyPlan, trimPlan, state, formatValue }),
    [totals, monthlyPlan, trimPlan, state]
  );

  const generatedDate = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const nextFocusDebt =
    monthlyPlan.debtPlan?.find((debt) => debt.isPriority) ||
    totals.priorityDebt ||
    null;

  const printPrimaryAction =
    monthlyPlan.type === 'deficit'
      ? trimPlan.quickWin
        ? trimPlan.covered
          ? `Reduce ${trimPlan.quickWin.name} by ${formatValue(trimPlan.quickWin.suggestedTrim)}`
          : `Close the ${formatValue(trimPlan.deficit)} monthly gap — start with ${trimPlan.quickWin.name}`
        : 'Reduce spending until monthly balance reaches zero'
      : nextFocusDebt
      ? `Send extra monthly cash to ${nextFocusDebt.name}`
      : 'Build savings with your monthly surplus';

  const addExpense = () => {
    if (!expenseDraft.categoryId || !isFilled(expenseDraft.amount) || isNegative(expenseDraft.amount)) {
      return;
    }

    const nextExpense = {
      ...expenseDraft,
      id: crypto.randomUUID(),
    };

    setState((prev) => ({
      ...prev,
      tracking: {
        ...(prev.tracking || {}),
        expenses: [nextExpense, ...(prev.tracking?.expenses || [])],
      },
    }));

    setExpenseDraft(createExpense(expenseDraft.categoryId));
  };

  const removeExpense = (expenseId) => {
    setState((prev) => ({
      ...prev,
      tracking: {
        ...(prev.tracking || {}),
        expenses: (prev.tracking?.expenses || []).filter(
          (expense) => expense.id !== expenseId
        ),
      },
    }));
  };

  const saveWeeklyCheckIn = () => {
    setState((prev) => ({
      ...prev,
      tracking: {
        ...(prev.tracking || {}),
        weeklyCheckIns: [
          { ...weeklyCheckInDraft, id: crypto.randomUUID() },
          ...(prev.tracking?.weeklyCheckIns || []).filter(
            (item) => item.weekKey !== weeklyCheckInDraft.weekKey
          ),
        ],
      },
    }));
  };

  const saveMonthlyReview = () => {
    setState((prev) => ({
      ...prev,
      tracking: {
        ...(prev.tracking || {}),
        monthlyReviews: [
          { ...monthlyReviewDraft, id: crypto.randomUUID() },
          ...(prev.tracking?.monthlyReviews || []).filter(
            (item) => item.monthKey !== monthlyReviewDraft.monthKey
          ),
        ],
      },
    }));
  };

  const openBudgetCategory = (id) => {
    setExpandedBudgetCategoryId(id);

    setState((prev) => {
      const index = prev.budgetCategories.findIndex((category) => category.id === id);
      if (index <= 0) return prev;

      const selected = prev.budgetCategories[index];
      const remaining = prev.budgetCategories.filter((category) => category.id !== id);

      return {
        ...prev,
        budgetCategories: [selected, ...remaining],
      };
    });
  };

  const toggleBudgetCategory = (id) => {
    if (expandedBudgetCategoryId === id) {
      setExpandedBudgetCategoryId(null);
      return;
    }

    openBudgetCategory(id);
  };

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
    setHighlightTrimUpdate(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        trimUpdatedRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  };

  const undoAppliedTrimPlan = () => {
    if (!preTrimBudgetSnapshot) return;

    setState((prev) => ({
      ...prev,
      budgetCategories: preTrimBudgetSnapshot,
    }));

    setPreTrimBudgetSnapshot(null);
    setShowTrimApplied(false);
    setHighlightTrimUpdate(false);
  };

  const nextStep = () => {
    if (!stepValidation.canProceed) return;
    setStep((current) => Math.min(current + 1, 5));
  };

  const prevStep = () => setStep((current) => Math.max(current - 1, 0));

  const resetApp = () => {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

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
      tracking: {
        expenses: [],
        weeklyCheckIns: [],
        monthlyReviews: [],
      },
    });
    setExpenseDraft(createExpense());
    setWeeklyCheckInDraft({ ...createWeeklyCheckIn(), weekKey: getWeekKey() });
    setMonthlyReviewDraft({ ...createMonthlyReview(), monthKey: getMonthKey() });
    setPayoffStrategy(PAYOFF_STRATEGIES.avalanche);
    setIncomePeriod('monthly');
    setExpandedDebtId(null);
    setExpandedBillId(null);
    setExpandedBudgetCategoryId(null);
    setLastDeleted(null);
    setShowResetConfirm(false);
    setShowTrimApplied(false);
    setHighlightTrimUpdate(false);
    setPreTrimBudgetSnapshot(null);
    setStep(0);
  };

  const addBudgetCategory = (name = '', type = 'essential') => {
    const newCategory = createBudgetCategory(name, type);

    setState((prev) => ({
      ...prev,
      budgetCategories: [newCategory, ...prev.budgetCategories],
    }));

    setExpandedBudgetCategoryId(newCategory.id);
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
    const deletedItem = state.budgetCategories.find((category) => category.id === id);
    const deletedIndex = state.budgetCategories.findIndex(
      (category) => category.id === id
    );

    if (!deletedItem) return;

    setLastDeleted({
      type: 'budget',
      item: deletedItem,
      index: deletedIndex,
    });

    setState((prev) => ({
      ...prev,
      budgetCategories: prev.budgetCategories.filter(
        (category) => category.id !== id
      ),
    }));

    setExpandedBudgetCategoryId((prev) => (prev === id ? null : prev));
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

    if (lastDeleted.type === 'budget') {
      setState((prev) => {
        const nextBudgetCategories = [...prev.budgetCategories];
        const insertAt = Math.min(
          Math.max(lastDeleted.index ?? 0, 0),
          nextBudgetCategories.length
        );
        nextBudgetCategories.splice(insertAt, 0, lastDeleted.item);

        return { ...prev, budgetCategories: nextBudgetCategories };
      });

      setExpandedBudgetCategoryId(lastDeleted.item.id);
    }

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
              2. Take-Home Pay (After Tax)
            </label>

            <div className="flex gap-2 flex-wrap mb-3">
              {INCOME_PERIODS.map((period) => (
                <button
                  key={period.key}
                  type="button"
                  onClick={() => {
                    if (isFilled(state.income)) {
                      const currentMonthly = toNumber(state.income) *
                        (INCOME_PERIODS.find((p) => p.key === incomePeriod)?.multiplier ?? 1);
                      const newDisplayValue = currentMonthly / period.multiplier;
                      setState((prev) => ({ ...prev, income: String(Math.round(newDisplayValue)) }));
                    }
                    setIncomePeriod(period.key);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    incomePeriod === period.key
                      ? 'bg-[#1B2B4B] text-white border-[#1B2B4B]'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            <div className="relative group">
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
                inputMode="decimal"
                min="0"
                value={state.income}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, income: e.target.value }))
                }
                placeholder="0"
                className={`w-full min-w-0 pl-16 pr-6 py-6 rounded-3xl border-2 focus:ring-8 focus:outline-none text-3xl font-black transition-all ${
                  incomeMissing
                    ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-50'
                    : 'border-slate-100 focus:border-[#1EB1BB] focus:ring-cyan-50'
                }`}
              />
            </div>

            {incomePeriod !== 'monthly' && isFilled(state.income) && (
              <p className="text-xs text-[#1EB1BB] font-bold mt-2">
                ≈ {getCurrencySymbol()}{Math.round(
                  toNumber(state.income) *
                  (INCOME_PERIODS.find((p) => p.key === incomePeriod)?.multiplier ?? 1)
                ).toLocaleString()} per month
              </p>
            )}

            {incomeMissing && (
              <p className="text-xs text-red-500 font-bold mt-2">
                Take-home pay is required.
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Categories
                </p>
                <p className="text-lg font-black text-slate-800">
                  {state.budgetCategories.length}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Total Budget
                </p>
                <p className="text-lg font-black text-slate-800">
                  {formatValue(totalBudgetSpending)}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Flexible Spend
                </p>
                <p className="text-lg font-black text-slate-800">
                  {formatValue(nonEssentialBudgetTotal)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {state.budgetCategories.map((category, index) => {
                const amountInvalid = isNegative(category.amount);
                const nameInvalid = !String(category.name || '').trim();
                const isOpen = expandedBudgetCategoryId === category.id;
                const hasAmount = isFilled(category.amount);

                return (
                  <div
                    key={category.id}
                    className={`rounded-[1.5rem] border transition-all overflow-hidden ${
                      isOpen
                        ? 'border-[#1EB1BB] bg-white shadow-md'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="w-full text-left p-5">
                      <div className="flex items-center justify-between gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleBudgetCategory(category.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-wrap">
                              <p className="text-lg font-black text-[#1B2B4B] truncate min-w-0">
                                {category.name || 'New Category'}
                              </p>

                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  category.type === 'essential'
                                    ? 'bg-[#1B2B4B] text-white border-[#1B2B4B]'
                                    : 'bg-cyan-50 text-[#1EB1BB] border-cyan-100'
                                }`}
                              >
                                {category.type === 'essential'
                                  ? 'Essential'
                                  : 'Non-essential'}
                              </span>

                              {!hasAmount && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-100">
                                  Incomplete
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 flex-wrap">
                              <span>
                                Amount:{' '}
                                <span className="font-black text-slate-700">
                                  {hasAmount
                                    ? formatValue(category.amount)
                                    : `${getCurrencySymbol()}0`}
                                </span>
                              </span>
                              <span>#{index + 1}</span>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => removeBudgetCategory(category.id)}
                            className="h-10 w-10 rounded-xl bg-slate-50 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleBudgetCategory(category.id)}
                            className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform ${
                              isOpen ? 'rotate-90' : ''
                            }`}
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-slate-100 animate-in">
                        <div className="pt-5 space-y-4">
                          <div className="min-w-0">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                              Category Name
                            </label>
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
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                              Monthly Amount
                            </label>
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
                                inputMode="decimal"
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

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                              Category Type
                            </label>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  updateBudgetCategory(category.id, 'type', 'essential')
                                }
                                className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
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
                                className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
                                  category.type === 'non-essential'
                                    ? 'bg-[#1EB1BB] text-white border-[#1EB1BB]'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                              >
                                Non-essential
                              </button>
                            </div>
                          </div>

                          {(nameInvalid || amountInvalid) && (
                            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
                              {nameInvalid
                                ? 'Category name is required.'
                                : 'Amount cannot be negative.'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
                  inputMode="decimal"
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
                Savings Target
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
                  inputMode="decimal"
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
                  Savings target cannot be negative.
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

  const scrollPresetRow = (ref, direction = 'right') => {
    if (!ref?.current) return;
    const amount = Math.max(180, ref.current.clientWidth * 0.75);
    ref.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const PresetScroller = ({ items, onAdd, scrollRef, ariaLabel }) => (
    <div className="flex items-center gap-2 px-2">
      <button
        type="button"
        onClick={() => scrollPresetRow(scrollRef, 'left')}
        aria-label={`${ariaLabel} scroll left`}
        className="shrink-0 w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 flex items-center justify-center shadow-sm hover:border-[#1EB1BB] hover:text-[#1EB1BB] transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div ref={scrollRef} className="flex-1 flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((type) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="whitespace-nowrap px-6 py-3 bg-white border border-slate-100 rounded-full text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm hover:shadow-md active:bg-cyan-50 transition-all hover:border-[#1EB1BB] shrink-0"
          >
            + {type}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollPresetRow(scrollRef, 'right')}
        aria-label={`${ariaLabel} scroll right`}
        className="shrink-0 w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 flex items-center justify-center shadow-sm hover:border-[#1EB1BB] hover:text-[#1EB1BB] transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

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

        <PresetScroller
          items={DEBT_PRESETS}
          onAdd={addDebt}
          scrollRef={debtPresetScrollRef}
          ariaLabel="Debt preset buttons"
        />

        {state.debts.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 md:p-6 mx-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Payoff Strategy
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Once minimum payments are covered, where should extra money go first?
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
              <div className={`rounded-2xl border p-4 transition-all ${payoffStrategy === PAYOFF_STRATEGIES.avalanche ? 'bg-[#1B2B4B] border-[#1B2B4B]' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${payoffStrategy === PAYOFF_STRATEGIES.avalanche ? 'text-[#1EB1BB]' : 'text-slate-400'}`}>
                  Avalanche — saves the most money
                </p>
                <p className={`text-sm ${payoffStrategy === PAYOFF_STRATEGIES.avalanche ? 'text-white/80' : 'text-slate-600'}`}>
                  Extra cash goes to the highest interest debt first. Pays less total interest. Best if you want to save the most money long-term.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 transition-all ${payoffStrategy === PAYOFF_STRATEGIES.snowball ? 'bg-[#1EB1BB] border-[#1EB1BB]' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${payoffStrategy === PAYOFF_STRATEGIES.snowball ? 'text-white' : 'text-slate-400'}`}>
                  Snowball — builds momentum faster
                </p>
                <p className={`text-sm ${payoffStrategy === PAYOFF_STRATEGIES.snowball ? 'text-white/80' : 'text-slate-600'}`}>
                  Extra cash clears the smallest debt first. You get quick wins and free up payments sooner. Best if motivation is the challenge.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              Not sure? <span className="font-black text-slate-500">Avalanche</span> is the default — it typically saves more in interest. Switch to <span className="font-black text-slate-500">Snowball</span> if you need quick wins to stay on track.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {state.debts.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-10 text-center border border-slate-100 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-[#1EB1BB] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-2">No debt? Great start.</h4>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              If you have no debts, skip this step. Your surplus will go straight toward building savings. If you do have debts, use the presets above to add them.
            </p>
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
                <div className="w-full text-left p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleDebt(debt.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="min-w-0">
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
                    </button>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => removeDebt(debt.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleDebt(debt.id)}
                        className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

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
                          inputMode="decimal"
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
                          inputMode="decimal"
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
                          inputMode="decimal"
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

        <PresetScroller
          items={BILL_PRESETS}
          onAdd={addBill}
          scrollRef={billPresetScrollRef}
          ariaLabel="Bill preset buttons"
        />
      </div>

      <div className="space-y-4">
        {state.bills.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-10 text-center border border-slate-100 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-2">No regular bills yet.</h4>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              Add your fixed monthly bills — rent, utilities, subscriptions — so your plan includes everything leaving your account.
            </p>
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
                <div className="w-full text-left p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleBill(bill.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="min-w-0">
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
                    </button>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => removeBill(bill.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleBill(bill.id)}
                        className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

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
                            inputMode="decimal"
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
    const savingsProjection = monthlyPlan.savingsProjection || {
      monthlyContribution: 0,
      remainingToGoal: Math.max(
        0,
        roundMoney(
          toNumber(monthlyPlan.effectiveEmergencyTarget) -
            toNumber(monthlyPlan.currentSavings)
        )
      ),
      progressPercent: 0,
      monthsToGoal: null,
      milestones: [],
      nextMilestone: null,
      status: 'Add a monthly savings contribution to start reaching your target',
    };

    const savingsProgress = savingsProjection.progressPercent;
    const nextSavingsMilestone = savingsProjection.nextMilestone;
    const savingsFeedback =
      monthlyPlan.type === 'deficit'
        ? 'Stabilise your monthly budget first, then restart steady savings automation.'
        : savingsProjection.monthsToGoal === 0
        ? 'You have already funded this savings goal. Keep contributing to stay resilient.'
        : savingsProjection.monthsToGoal
        ? `At ${formatValue(savingsProjection.monthlyContribution)}/month, you are on track to hit your target ${getMonthsFromNowLabel(
            savingsProjection.monthsToGoal
          )}.`
        : 'Your target is set, but you need monthly surplus before the app can project a savings finish date.';

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

    const postTrimBalance = roundMoney(
      toNumber(totals.remaining) + toNumber(trimPlan.totalSuggested)
    );

    const trimAppliedDelta = preTrimBudgetSnapshot
      ? roundMoney(
          sumBy(preTrimBudgetSnapshot, (category) => category.amount) -
            sumBy(state.budgetCategories, (category) => category.amount)
        )
      : 0;

    const currentBudgetTotal = roundMoney(
      sumBy(state.budgetCategories, (category) => category.amount)
    );

    const previousBudgetTotal = preTrimBudgetSnapshot
      ? roundMoney(sumBy(preTrimBudgetSnapshot, (category) => category.amount))
      : currentBudgetTotal;

    const balanceAfterAppliedTrim = preTrimBudgetSnapshot
      ? roundMoney(toNumber(totals.remaining) + trimAppliedDelta)
      : null;

    const trimWasApplied = Boolean(preTrimBudgetSnapshot && trimAppliedDelta > 0);

    const appliedTrimChanges = preTrimBudgetSnapshot
      ? preTrimBudgetSnapshot
          .map((previousCategory) => {
            const updatedCategory = state.budgetCategories.find(
              (category) => category.id === previousCategory.id
            );

            const beforeAmount = toNumber(previousCategory.amount);
            const afterAmount = toNumber(updatedCategory?.amount);

            const difference = roundMoney(beforeAmount - afterAmount);

            if (difference <= 0) return null;

            return {
              id: previousCategory.id,
              name: previousCategory.name || 'Budget Category',
              beforeAmount,
              afterAmount,
              difference,
            };
          })
          .filter(Boolean)
      : [];

    const deficitResolvedByTrim = monthlyPlan.type === 'deficit' && trimPlan.covered;
    const canShowDebtAcceleration =
      monthlyPlan.type === 'surplus' || deficitResolvedByTrim;

    const hasActiveDebt = state.debts.some((debt) => toNumber(debt.balance) > 0);
    const hasFlexibleSpending = totals.nonEssentialBudgetTotal > 0;
    const hasSavingsTarget = toNumber(monthlyPlan.effectiveEmergencyTarget) > 0;

    const strategyBadgeLabel =
      payoffStrategy === PAYOFF_STRATEGIES.avalanche
        ? 'Avalanche active'
        : 'Snowball active';

    const heroTitle =
      monthlyPlan.type === 'deficit'
        ? `You’re currently ${formatValue(Math.abs(monthlyPlan.surplus))} short each month`
        : `You have ${formatValue(monthlyPlan.surplus)} left each month`;

    const heroSubtext =
      monthlyPlan.type === 'deficit'
        ? 'Bring your monthly balance back to zero first.'
        : 'Put this monthly surplus to work automatically.';

    return (
      <div
        ref={resultsTopRef}
        className="space-y-6 md:space-y-10 max-w-5xl mx-auto pb-12 md:pb-16 animate-in w-full"
      >
        {/* ── #1 Priority Action Banner ── */}
        <div className={`rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-4 border shadow-sm ${
          monthlyPlan.type === 'deficit'
            ? 'bg-rose-50 border-rose-200'
            : 'bg-cyan-50 border-cyan-200'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            monthlyPlan.type === 'deficit' ? 'bg-rose-100 text-rose-500' : 'bg-[#1EB1BB] text-white'
          }`}>
            {monthlyPlan.type === 'deficit' ? <AlertCircle className="w-6 h-6" /> : <Target className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
              monthlyPlan.type === 'deficit' ? 'text-rose-500' : 'text-[#1EB1BB]'
            }`}>Your #1 action right now</p>
            <p className="text-lg md:text-xl font-black text-slate-800 leading-tight">
              {monthlyPlan.type === 'deficit'
                ? trimPlan.quickWin
                  ? trimPlan.covered
                    ? `Reduce ${trimPlan.quickWin.name} by ${formatValue(trimPlan.quickWin.suggestedTrim)}/month to break even`
                    : `Close the ${formatValue(trimPlan.deficit)} monthly gap — start with ${trimPlan.quickWin.name}`
                  : `Close the ${formatValue(Math.abs(monthlyPlan.surplus))} monthly gap first`
                : nextFocusDebt
                  ? `Pay an extra ${formatValue(monthlyPlan.debtAllocation)}/month toward ${nextFocusDebt.name}`
                  : `Move ${formatValue(monthlyPlan.savingsAllocation)}/month into your emergency fund`}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {monthlyPlan.type === 'deficit'
                ? trimPlan.covered
                  ? 'One change gets you back to zero.'
                  : `You need ${formatValue(trimPlan.remainingGap)} more in cuts after trimming ${trimPlan.quickWin?.name || 'flexible spending'}.`
                : monthlyPlan.debtTimeline?.valid && monthlyPlan.debtTimeline.months > 0
                  ? `Debt-free estimate with this plan: ${getMonthsFromNowLabel(monthlyPlan.debtTimeline.months)}`
                  : 'Every extra payment builds your financial freedom.'}
            </p>
          </div>
        </div>

        <section className="bg-[#1B2B4B] text-white p-6 md:p-20 rounded-[2rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-[100px]"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12 min-w-0">
            <div className="flex-1 space-y-6 text-center md:text-left min-w-0">
              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.22em] border ${
                    monthlyPlan.type === 'deficit'
                      ? 'bg-white/10 text-rose-300 border-white/10'
                      : 'bg-white/10 text-[#7FE7ED] border-white/10'
                  }`}
                >
                  {monthlyPlan.type === 'deficit'
                    ? 'Immediate priority'
                    : 'Monthly progress plan'}
                </span>

                <span className="inline-flex items-center px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.22em] border bg-white/5 text-white/70 border-white/10">
                  {totals.tier.shortLabel}
                </span>
              </div>

              <h2 className="text-3xl md:text-5xl font-black leading-tight break-words">
                {heroTitle}
              </h2>

              <div className="space-y-3 max-w-2xl">
                <p className="text-white/75 text-lg md:text-xl font-medium">
                  {heroSubtext}
                </p>
                <p className="text-white/55 text-sm md:text-base">
                  {totals.tier.summary}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                {monthlyPlan.type === 'deficit' && trimPlan.suggestions.length > 0 && (
                  <button
                    onClick={applyTrimPlan}
                    className="bg-[#1EB1BB] text-white px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all shadow-xl ring-4 ring-cyan-200/20"
                  >
                    Apply suggested budget cuts
                  </button>
                )}

                {monthlyPlan.type === 'deficit' && (
                  <button
                    onClick={() => setStep(2)}
                    className="bg-white/10 text-white px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wider border border-white/10 hover:bg-white/15 transition-all"
                  >
                    Review my figures
                  </button>
                )}

                <button
                  onClick={exportResultsAsPdf}
                  className="bg-white text-[#1B2B4B] px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-slate-100 transition-all shadow-lg"
                >
                  Export PDF
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto max-w-full">
              <div className="bg-white/10 backdrop-blur-xl p-6 md:p-12 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 w-full md:min-w-[280px] text-center max-w-full">
                <p className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-2">
                  {totals.tier.label}
                </p>
                <p className="text-white/70 text-xs font-bold uppercase tracking-[0.25em] mb-3">
                  {totals.tier.shortLabel}
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

        {/* ── 3 stat cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Card 1: Monthly Position */}
          <div
            className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border shadow-sm min-w-0 ${
              monthlyPlan.type === 'deficit'
                ? 'bg-rose-50 border-rose-100'
                : 'bg-cyan-50 border-cyan-100'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-black uppercase tracking-wider mb-2 ${
                    monthlyPlan.type === 'deficit'
                      ? 'text-rose-500'
                      : 'text-[#1EB1BB]'
                  }`}
                >
                  Monthly Position
                </p>
                <p className="text-3xl font-black text-slate-800 break-words">
                  {formatValue(totals.remaining)}
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  {monthlyPlan.type === 'deficit'
                    ? 'This is the gap to close first.'
                    : 'This is the surplus you can put to work.'}
                </p>
              </div>
              <div
                className={`shrink-0 ${
                  monthlyPlan.type === 'deficit'
                    ? 'text-rose-400'
                    : 'text-[#1EB1BB]'
                }`}
              >
                {monthlyPlan.type === 'deficit' ? (
                  <AlertCircle className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8" />
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Total Debt */}
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
                  Total Debt
                </p>
                <p className="text-3xl font-black text-slate-800 break-words">
                  {formatValue(totals.totalDebtBalance)}
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  {nextFocusDebt
                    ? `Current focus: ${nextFocusDebt.name}`
                    : 'Add debts to build a payoff plan.'}
                </p>
              </div>
              <div className="text-slate-300 shrink-0">
                <Wallet className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Card 3: Savings Progress */}
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
                  Savings Progress
                </p>
                <p className="text-3xl font-black text-slate-800 break-words">
                  {formatValue(monthlyPlan.currentSavings)}
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  {hasSavingsTarget
                    ? `${Math.round(savingsProgress)}% of ${formatValue(monthlyPlan.effectiveEmergencyTarget)}`
                    : 'Add a savings target to guide your buffer plan.'}
                </p>
              </div>
              <div className="text-slate-300 shrink-0">
                <PiggyBank className="w-8 h-8" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1EB1BB] rounded-full transition-all duration-500"
                  style={{ width: `${clamp(savingsProgress, 0, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                <span>{formatValue(monthlyPlan.currentSavings)}</span>
                <span>{formatValue(monthlyPlan.effectiveEmergencyTarget)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Savings Roadmap ── */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm">
          <SectionIntro
            icon={<PiggyBank className="w-6 h-6" />}
            eyebrow="Savings"
            title="Savings roadmap"
            description="See how your savings goal is progressing, how long it could take, and what milestone comes next."
            iconTone="success"
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-6">
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Savings target projection
                    </p>
                    <p className="text-2xl md:text-3xl font-black text-slate-800 break-words">
                      {savingsProjection.monthsToGoal === 0
                        ? 'Goal already funded'
                        : savingsProjection.monthsToGoal
                        ? formatMonthsLabel(savingsProjection.monthsToGoal)
                        : 'Waiting for surplus'}
                    </p>
                    <p className="text-sm text-slate-500 mt-2 break-words">
                      {savingsFeedback}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shrink-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Monthly savings plan
                    </p>
                    <p className="text-lg font-black text-slate-800">
                      {formatValue(savingsProjection.monthlyContribution)}/month
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1EB1BB] rounded-full transition-all duration-500"
                      style={{ width: `${clamp(savingsProgress, 0, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 font-bold">
                    <span>Current: {formatValue(monthlyPlan.currentSavings)}</span>
                    <span>Remaining: {formatValue(savingsProjection.remainingToGoal)}</span>
                    <span>Target: {formatValue(monthlyPlan.effectiveEmergencyTarget)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {(savingsProjection.milestones || []).map((milestone) => (
                  <InsightCard
                    key={milestone.key}
                    eyebrow={milestone.label}
                    value={formatValue(milestone.amount)}
                    description={
                      milestone.achieved
                        ? 'Already reached'
                        : milestone.monthsAway === null
                        ? 'Needs monthly surplus'
                        : `Estimated ${getMonthsFromNowLabel(milestone.monthsAway)}`
                    }
                    tone={milestone.achieved ? 'success' : 'default'}
                    compact
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <InsightCard
                eyebrow="Next savings milestone"
                value={
                  nextSavingsMilestone
                    ? nextSavingsMilestone.achieved
                      ? 'All milestones reached'
                      : nextSavingsMilestone.label
                    : 'Set your target'
                }
                description={
                  nextSavingsMilestone
                    ? nextSavingsMilestone.achieved
                      ? 'Your current savings already cover the full target.'
                      : `${formatValue(nextSavingsMilestone.amount)} · ${
                          nextSavingsMilestone.monthsAway === null
                            ? 'Needs monthly surplus'
                            : `Estimated ${getMonthsFromNowLabel(nextSavingsMilestone.monthsAway)}`
                        }`
                    : 'Add a savings target to generate milestones.'
                }
                tone="highlight"
              />

              <InsightCard
                eyebrow="Savings feedback"
                value={
                  monthlyPlan.type === 'deficit'
                    ? 'Stabilise cash flow first'
                    : savingsProjection.monthsToGoal === 0
                    ? 'Goal complete'
                    : savingsProjection.monthsToGoal
                    ? 'On track'
                    : 'Needs surplus'
                }
                description={savingsProjection.status}
                tone={
                  monthlyPlan.type === 'deficit'
                    ? 'warning'
                    : savingsProjection.monthsToGoal === 0 || savingsProjection.monthsToGoal
                    ? 'success'
                    : 'default'
                }
              />

              <InsightCard
                eyebrow="Why savings matters here"
                description={
                  monthlyPlan.type === 'deficit'
                    ? 'Once your budget is back above zero, this same screen will start projecting your savings finish date automatically.'
                    : state.debts.some((debt) => toNumber(debt.balance) > 0)
                    ? 'Savings stays visible alongside debt so users can build resilience while paying down balances.'
                    : 'Savings is your main growth engine right now, so the app treats it as a first-class outcome, not leftover money.'
                }
              />
            </div>
          </div>
        </div>

        {/* ── Phase 1: Tracking (full width) ── */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm">
          <SectionIntro
            icon={<TrendingUp className="w-6 h-6" />}
            eyebrow="Phase 1"
            title="Actual spending and momentum"
            description={`Track what is really happening in ${getMonthLabel(currentMonthKey)} so the plan stays useful.`}
            iconTone="success"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InsightCard
                  eyebrow="Planned budget"
                  value={formatValue(totals.budgetSpending)}
                  compact
                />
                <InsightCard
                  eyebrow="Actual tracked spend"
                  value={formatValue(actualSpendingThisMonth)}
                  tone={actualSpendingThisMonth > totals.budgetSpending ? 'warning' : 'success'}
                  compact
                />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Log an expense
                </p>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto] gap-3">
                  <select
                    value={expenseDraft.categoryId}
                    onChange={(e) =>
                      setExpenseDraft((prev) => ({ ...prev, categoryId: e.target.value }))
                    }
                    className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    {state.budgetCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={expenseDraft.amount}
                    onChange={(e) =>
                      setExpenseDraft((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="Amount"
                    className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />

                  <input
                    value={expenseDraft.note}
                    onChange={(e) =>
                      setExpenseDraft((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="Optional note"
                    className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />

                  <button
                    onClick={addExpense}
                    className="px-4 py-3 rounded-xl bg-[#1B2B4B] text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {(state.tracking?.expenses || []).length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                    Recent tracked expenses
                  </p>
                  <div className="space-y-2">
                    {(state.tracking?.expenses || []).slice(0, 5).map((expense) => {
                      const category = state.budgetCategories.find(
                        (item) => item.id === expense.categoryId
                      );

                      return (
                        <div
                          key={expense.id}
                          className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">
                              {category?.name || 'Category'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {expense.date}
                              {expense.note ? ` · ${expense.note}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <p className="text-sm font-black text-slate-800">
                              {formatValue(expense.amount)}
                            </p>
                            <button
                              onClick={() => removeExpense(expense.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Budget categories vs actuals
                </p>
                <div className="space-y-2">
                  {categoryActuals
                    .filter((category) => category.planned > 0 || category.actual > 0)
                    .slice(0, 6)
                    .map((category) => (
                      <div
                        key={category.id}
                        className={`rounded-xl border px-4 py-3 ${
                          category.overspent
                            ? 'bg-rose-50 border-rose-100'
                            : 'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">
                              {category.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Planned {formatValue(category.planned)} · Actual {formatValue(category.actual)}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-black shrink-0 ${
                              category.overspent ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {category.overspent ? 'Over' : 'Left'} {formatValue(Math.abs(category.variance))}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Weekly check-in
                </p>
                <textarea
                  value={weeklyCheckInDraft.wins}
                  onChange={(e) =>
                    setWeeklyCheckInDraft((prev) => ({ ...prev, wins: e.target.value }))
                  }
                  placeholder="What went well this week?"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 min-h-[88px]"
                />
                <textarea
                  value={weeklyCheckInDraft.blockers}
                  onChange={(e) =>
                    setWeeklyCheckInDraft((prev) => ({ ...prev, blockers: e.target.value }))
                  }
                  placeholder="What needs attention?"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 min-h-[88px] mt-3"
                />
                <input
                  value={weeklyCheckInDraft.nextStep}
                  onChange={(e) =>
                    setWeeklyCheckInDraft((prev) => ({ ...prev, nextStep: e.target.value }))
                  }
                  placeholder="Next step for next week"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 mt-3"
                />
                <button
                  onClick={saveWeeklyCheckIn}
                  className="mt-3 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-[#1B2B4B] text-[11px] font-black uppercase tracking-wider hover:border-[#1EB1BB] hover:bg-cyan-50 transition-colors"
                >
                  Save weekly check-in
                </button>
                {currentWeekCheckIn && (
                  <p className="text-xs text-slate-500 mt-3">
                    Saved for {getWeekLabel(currentWeekKey)}.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Monthly review
                </p>
                <textarea
                  value={monthlyReviewDraft.summary}
                  onChange={(e) =>
                    setMonthlyReviewDraft((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  placeholder="Overall month summary"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 min-h-[88px]"
                />
                <input
                  value={monthlyReviewDraft.whatWorked}
                  onChange={(e) =>
                    setMonthlyReviewDraft((prev) => ({ ...prev, whatWorked: e.target.value }))
                  }
                  placeholder="What worked"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 mt-3"
                />
                <input
                  value={monthlyReviewDraft.whatNeedsAttention}
                  onChange={(e) =>
                    setMonthlyReviewDraft((prev) => ({ ...prev, whatNeedsAttention: e.target.value }))
                  }
                  placeholder="What needs attention"
                  className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 mt-3"
                />
                <button
                  onClick={saveMonthlyReview}
                  className="mt-3 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-[#1B2B4B] text-[11px] font-black uppercase tracking-wider hover:border-[#1EB1BB] hover:bg-cyan-50 transition-colors"
                >
                  Save monthly review
                </button>
                {currentMonthReview && (
                  <p className="text-xs text-slate-500 mt-3">
                    Review saved for {getMonthLabel(currentMonthKey)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>



        {monthlyPlan.type === 'deficit' ? (
          <section className="space-y-6">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <SectionIntro
                icon={<AlertCircle className="w-7 h-7" />}
                eyebrow="Step 1"
                title="Get back to zero first"
                description="Your listed monthly costs are higher than your income. Remove the shortfall first, then move into debt acceleration."
                iconTone="warning"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InsightCard
                  eyebrow="Current shortfall"
                  value={formatValue(Math.abs(monthlyPlan.surplus))}
                  description="This is the monthly gap you need to close first."
                  tone="warning"
                />

                <InsightCard
                  eyebrow="Best place to fix first"
                  value={
                    trimPlan.quickWin?.name ||
                    topTrimCategory?.name ||
                    topBudgetCategories[0]?.name ||
                    'Largest category'
                  }
                  description={
                    trimPlan.quickWin
                      ? `Cutting this by ${formatValue(
                          trimPlan.quickWin.suggestedTrim
                        )} is your fastest fix.`
                      : topBudgetCategories[0]
                      ? `This is currently your biggest category at ${formatValue(
                          topBudgetCategories[0].amount
                        )}.`
                      : 'Start with your largest flexible category.'
                  }
                />

                <InsightCard
                  eyebrow="After this fix"
                  value={formatValue(postTrimBalance)}
                  description={
                    deficitResolvedByTrim
                      ? 'This gets you back to zero and unlocks the next step.'
                      : 'This reduces pressure, but you may still need one more adjustment.'
                  }
                  tone="success"
                />
              </div>
            </div>

            {trimPlan.suggestions.length > 0 && (
              <div className="bg-white border border-slate-100 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">
                      Step 2
                    </p>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">
                      Fix the gap with one move
                    </h3>
                    <p className="text-slate-500 mt-2">
                      Vayrity can rebalance your flexible spending to remove the shortfall.
                    </p>
                  </div>

                  <button
                    onClick={applyTrimPlan}
                    className="px-5 py-3 rounded-2xl bg-[#1B2B4B] text-white font-black text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors shrink-0 shadow-lg"
                  >
                    Apply suggested budget cuts
                  </button>
                </div>

                <div className="space-y-3">
                  {trimPlan.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-slate-800">
                          {suggestion.name}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Cut by {formatValue(suggestion.suggestedTrim)} (
                          {suggestion.percentTrim}%)
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
                  <InsightCard
                    eyebrow="Deficit"
                    value={formatValue(trimPlan.deficit)}
                    tone="warning"
                    compact
                  />

                  <InsightCard
                    eyebrow="Suggested trim total"
                    value={formatValue(trimPlan.totalSuggested)}
                    compact
                  />

                  <InsightCard
                    eyebrow="New monthly balance"
                    value={formatValue(postTrimBalance)}
                    tone="success"
                    compact
                  />
                </div>
              </div>
            )}

            {trimWasApplied && (
              <div
                ref={trimUpdatedRef}
                className={`bg-white border rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-sm transition-all duration-700 ${
                  highlightTrimUpdate
                    ? 'border-cyan-300 shadow-[0_0_0_6px_rgba(30,177,187,0.10)]'
                    : 'border-slate-100'
                }`}
              >
                <SectionIntro
                  icon={<CheckCircle2 className="w-7 h-7" />}
                  eyebrow="Updated plan"
                  title="Here’s exactly what changed"
                  description="We applied the suggested trim to your flexible budget categories so your monthly position could improve."
                  iconTone="success"
                />

                <div className="mb-5">
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-50 text-[#1EB1BB] text-[11px] font-black uppercase tracking-wider border border-cyan-100">
                    Budget update applied
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InsightCard
                    eyebrow="Budget before"
                    value={formatValue(previousBudgetTotal)}
                    description="Your total monthly category budget before the change."
                  />

                  <InsightCard
                    eyebrow="Budget after"
                    value={formatValue(currentBudgetTotal)}
                    description="Your total monthly category budget after the update."
                    tone="success"
                  />

                  <InsightCard
                    eyebrow="Monthly improvement"
                    value={formatValue(trimAppliedDelta)}
                    description={
                      balanceAfterAppliedTrim !== null &&
                      balanceAfterAppliedTrim >= 0
                        ? `This moved your monthly balance to about ${formatValue(
                            balanceAfterAppliedTrim
                          )}.`
                        : `This improved your monthly balance by ${formatValue(
                            trimAppliedDelta
                          )}, but you may still need one more adjustment.`
                    }
                    tone="success"
                  />
                </div>

                {appliedTrimChanges.length > 0 && (
                  <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                      Changes made
                    </p>

                    <div className="space-y-3">
                      {appliedTrimChanges.map((change) => (
                        <div
                          key={change.id}
                          className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-black text-slate-800">
                              {change.name}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                              Reduced by {formatValue(change.difference)}
                            </p>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-sm text-slate-500">
                              {formatValue(change.beforeAmount)} →{' '}
                              <span className="font-black text-slate-800">
                                {formatValue(change.afterAmount)}
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 md:p-5">
                  <p className="text-sm font-black text-slate-800 mb-2">
                    What this means
                  </p>

                  <p className="text-sm text-slate-700 leading-relaxed">
                    {balanceAfterAppliedTrim !== null &&
                    balanceAfterAppliedTrim >= 0
                      ? `Your budget was reduced by ${formatValue(
                          trimAppliedDelta
                        )} across flexible categories. That was enough to move you from a monthly deficit into a positive monthly balance of about ${formatValue(
                          balanceAfterAppliedTrim
                        )}.`
                      : `Your budget was reduced by ${formatValue(
                          trimAppliedDelta
                        )}, which improved your monthly position, but you may still need one more change to fully remove the deficit.`}
                  </p>
                </div>
              </div>
            )}

            {trimPlan.suggestions.length === 0 && (
              <div className="bg-white border border-slate-100 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm">
                <div className="min-w-0">
                  <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">
                    Step 2
                  </p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">
                    Review essential costs or income
                  </h3>
                  <p className="text-slate-500 mt-2">
                    You do not currently have flexible spending listed to trim,
                    so the next move is to review essential costs or increase
                    income.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Budget spending
                    </p>
                    <p className="text-2xl font-black text-slate-800">
                      {formatValue(totals.budgetSpending)}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Monthly gap
                    </p>
                    <p className="text-2xl font-black text-slate-800">
                      {formatValue(Math.abs(monthlyPlan.surplus))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <SectionIntro
                icon={<Target className="w-7 h-7" />}
                eyebrow="Step 3"
                title={
                  hasActiveDebt
                    ? 'Then accelerate debt payoff'
                    : 'Then build your savings'
                }
                description={
                  hasActiveDebt
                    ? 'Once your monthly balance is stable, focus your extra cash on your priority debt.'
                    : 'Once your monthly balance is stable, direct the extra money into savings.'
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InsightCard
                  eyebrow="Next focus after stabilising"
                  value={
                    hasActiveDebt
                      ? nextFocusDebt?.name || 'Priority debt'
                      : 'Emergency savings'
                  }
                  description={
                    hasActiveDebt
                      ? `Balance: ${formatValue(
                          nextFocusDebt?.balance || 0
                        )} · Minimum payment: ${formatValue(
                          nextFocusDebt?.minPayment || 0
                        )}/month`
                      : 'With no active debt, your next move is to build a stronger cash buffer.'
                  }
                />

                <InsightCard
                  eyebrow={
                    hasActiveDebt
                      ? 'Estimated payoff at current payment'
                      : 'Savings target'
                  }
                  value={
                    hasActiveDebt
                      ? totals.payoffEstimate?.valid
                        ? formatMonthsLabel(totals.payoffEstimate.months)
                        : 'Not available yet'
                      : formatValue(monthlyPlan.effectiveEmergencyTarget || 0)
                  }
                  description={
                    hasActiveDebt
                      ? totals.payoffEstimate?.valid
                        ? 'This is a useful reference point once your budget is no longer negative.'
                        : 'Add clearer debt details to estimate this next stage.'
                      : 'This is the buffer your plan is currently working toward.'
                  }
                />
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <SectionIntro
              icon={<Target className="w-7 h-7" />}
              eyebrow="Your Monthly Plan"
              title="Here’s how to use your surplus"
              description={`You have ${formatValue(
                monthlyPlan.surplus
              )} available each month to split between savings and debt payoff.`}
              iconTone="success"
            />

            <div className="mt-6 bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Monthly Actions
                  </p>
                  <h4 className="text-2xl font-black text-slate-800 mt-2">
                    What to do each month
                  </h4>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-[#1B2B4B] text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                    {strategyBadgeLabel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultActions.slice(0, 4).map((action, index) => (
                  <div
                    key={`${action.title}-${index}`}
                    className={`rounded-[1.25rem] md:rounded-2xl border p-4 md:p-5 shadow-sm ${
                      action.tone === 'success'
                        ? 'bg-cyan-50 border-cyan-100'
                        : action.tone === 'warning'
                        ? 'bg-rose-50 border-rose-100'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <p
                      className={`text-sm font-black ${
                        action.tone === 'success'
                          ? 'text-[#1B2B4B]'
                          : action.tone === 'warning'
                          ? 'text-rose-700'
                          : 'text-slate-800'
                      }`}
                    >
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Pay Towards Your Debts
                    </p>
                    <p className="text-sm text-slate-500">
                      Keep minimums covered. Route the extra automatically using
                      your chosen strategy.
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
                            {formatMonthsLabel(debt.payoffEstimate.months)} to
                            clear.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-slate-600">
                      No debt added, so your available money can go fully into
                      savings.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-[#1EB1BB] flex items-center justify-center shrink-0">
                    <PiggyBank className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Build Your Emergency Fund
                    </p>
                    <p className="text-sm text-slate-500">
                      A stronger buffer helps you avoid borrowing again.
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
                    Your own target: {formatValue(monthlyPlan.emergencyTarget)} ·
                    Recommended based on essentials:{' '}
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
              <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Your Progress Timeline
                    </p>
                    <p className="text-sm text-slate-500">
                      A simple view of where this plan leads.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <InsightCard
                    eyebrow="Debt-free estimate"
                    value={
                      monthlyPlan.debtTimeline?.valid
                        ? monthlyPlan.debtTimeline.months === 0
                          ? 'No active debt'
                          : formatMonthsLabel(monthlyPlan.debtTimeline.months)
                        : 'Needs clearer debt details'
                    }
                  />

                  <InsightCard
                    eyebrow="Emergency fund estimate"
                    value={
                      monthlyPlan.emergencyFundMonths === 0
                        ? 'Already funded'
                        : monthlyPlan.emergencyFundMonths
                        ? formatMonthsLabel(monthlyPlan.emergencyFundMonths)
                        : monthlyPlan.savingsAllocation > 0
                        ? 'In progress'
                        : 'Not funded yet'
                    }
                  />

                  {firstPayoffMoment && (
                    <InsightCard
                      eyebrow="First likely payoff"
                      value={firstPayoffMoment.name}
                      description={`Expected ${getMonthsFromNowLabel(
                        firstPayoffMoment.month
                      )}`}
                    />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Fastest Lever
                    </p>
                    <p className="text-sm text-slate-500">
                      The easiest place to improve this plan if you want faster
                      results.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <InsightCard
                    eyebrow={
                      hasFlexibleSpending
                        ? 'Flexible spending'
                        : 'Spending structure'
                    }
                    value={formatValue(totals.nonEssentialBudgetTotal)}
                    description={
                      hasFlexibleSpending
                        ? 'This is your quickest source of extra payoff capacity.'
                        : 'You have little or no flexible spending listed, so progress will mostly come from income growth or lower essential costs.'
                    }
                  />

                  <InsightCard
                    eyebrow={
                      hasFlexibleSpending
                        ? 'First category to review'
                        : 'Largest category'
                    }
                    value={topBudgetCategories[0]?.name || 'None added'}
                    description={
                      topBudgetCategories[0]
                        ? hasFlexibleSpending
                          ? formatValue(topBudgetCategories[0].amount)
                          : `${formatValue(
                              topBudgetCategories[0].amount
                            )} · mostly essentials`
                        : 'Add categories to see your biggest cost.'
                    }
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Why This Plan Works
                    </p>
                    <p className="text-sm text-slate-500">
                      Simple, practical, and based on your current numbers.
                    </p>
                  </div>
                </div>

                <InsightCard>
                  <p className="text-slate-700 leading-relaxed break-words">
                    {monthlyPlan.explanation}
                  </p>

                  {monthlyPlan.interestSavedVsMinimums > 0 && (
                    <p className="text-sm font-bold text-[#1EB1BB] mt-4">
                      This plan could save about{' '}
                      {formatValue(monthlyPlan.interestSavedVsMinimums)} in
                      interest versus staying at minimum payments only.
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
                </InsightCard>
              </div>
            </div>

            {comparisonPlan?.debtTimeline?.valid &&
              monthlyPlan?.debtTimeline?.valid &&
              monthlyPlan.debtPlan.length > 1 &&
              (Math.abs(comparisonInterestDelta) >= 25 ||
                comparisonPlan.debtTimeline.months !==
                  monthlyPlan.debtTimeline.months) && (
                <div className="mt-6 bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Strategy Comparison
                  </p>
                  <h4 className="text-2xl font-black text-slate-800 mt-2">
                    {payoffStrategy === PAYOFF_STRATEGIES.avalanche
                      ? 'Avalanche vs snowball'
                      : 'Snowball vs avalanche'}
                  </h4>

                  <div className="flex flex-wrap gap-3 mt-6">
                    {[PAYOFF_STRATEGIES.avalanche, PAYOFF_STRATEGIES.snowball].map((strategyKey) => {
                      const isActive = selectedComparisonStrategy === strategyKey;
                      const plan =
                        strategyKey === payoffStrategy ? monthlyPlan : comparisonPlan;

                      return (
                        <button
                          key={strategyKey}
                          type="button"
                          onClick={() => setSelectedComparisonStrategy(strategyKey)}
                          className={`px-4 py-3 rounded-2xl border text-left transition-all ${
                            isActive
                              ? strategyKey === PAYOFF_STRATEGIES.avalanche
                                ? 'bg-[#1B2B4B] border-[#1B2B4B] text-white'
                                : 'bg-[#1EB1BB] border-[#1EB1BB] text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-[#1EB1BB]'
                          }`}
                        >
                          <p className="text-[11px] font-black uppercase tracking-widest">
                            {strategyKey === PAYOFF_STRATEGIES.avalanche ? 'Avalanche' : 'Snowball'}
                          </p>
                          <p className={`text-sm mt-1 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                            {formatMonthsLabel(plan.debtTimeline.months)} · {formatValue(plan.debtTimeline.totalInterest)} interest
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Selected outcome
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                          ? 'Avalanche'
                          : 'Snowball'}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        {formatMonthsLabel(
                          (selectedComparisonStrategy === payoffStrategy
                            ? monthlyPlan
                            : comparisonPlan
                          ).debtTimeline.months
                        )} ·{' '}
                        {formatValue(
                          (selectedComparisonStrategy === payoffStrategy
                            ? monthlyPlan
                            : comparisonPlan
                          ).debtTimeline.totalInterest
                        )} interest
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Compared with
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                          ? 'Snowball'
                          : 'Avalanche'}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        {formatMonthsLabel(
                          (selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                            ? comparisonPlan
                            : monthlyPlan
                          ).debtTimeline.months
                        )} ·{' '}
                        {formatValue(
                          (selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                            ? comparisonPlan
                            : monthlyPlan
                          ).debtTimeline.totalInterest
                        )} interest
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Difference
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                          ? comparisonInterestDelta === 0
                            ? 'Very similar'
                            : comparisonInterestDelta > 0
                            ? `${formatValue(comparisonInterestDelta)} less interest`
                            : `${formatValue(Math.abs(comparisonInterestDelta))} more interest`
                          : comparisonInterestDelta === 0
                          ? 'Very similar'
                          : comparisonInterestDelta > 0
                          ? `${formatValue(comparisonInterestDelta)} more interest`
                          : `${formatValue(Math.abs(comparisonInterestDelta))} less interest`}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        {selectedComparisonStrategy === PAYOFF_STRATEGIES.avalanche
                          ? 'Tap Snowball above to see that outcome instead.'
                          : 'Tap Avalanche above to see that outcome instead.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </section>
        )}

        {canShowDebtAcceleration &&
          hasActiveDebt &&
          totals.priorityDebt &&
          totals.payoffEstimate && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2 min-w-0">
                <Info className="w-4 h-4 shrink-0" /> Estimated payoff for{' '}
                {totals.priorityDebt.name || 'your priority debt'}
              </h3>

              {monthlyPlan.type === 'deficit' && (
                <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-sm font-bold text-slate-800">
                    Use this as your next step after you fix the monthly gap.
                  </p>
                </div>
              )}

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
                        At your current payment of{' '}
                        {formatValue(totals.priorityDebt.minPayment)} per month,{' '}
                        {totals.priorityDebt.name || 'this debt'} could be
                        cleared in about{' '}
                        {formatMonthsLabel(totals.payoffEstimate.months)}.
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
                        {formatValue(totals.payoffEstimate.totalInterest)} in
                        interest on {totals.priorityDebt.name || 'this debt'}{' '}
                        over that time.
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
                      Based on what you entered, this is the monthly amount
                      currently being used to estimate the payoff time above for
                      this debt.
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
                                To aim for repayment in about {option.months}{' '}
                                months, you may need to pay around{' '}
                                {formatValue(option.result.monthlyPayment)} each
                                month on this debt.
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Add clearer balance, APR, and payment details to
                              estimate this target.
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
                        Add balance, APR, and minimum payment to see an estimate
                        for this debt.
                      </p>
                    )}

                    {totals.payoffEstimate.reason === 'payment_too_low' && (
                      <>
                        <p>
                          Your current payment may be too low to bring this debt
                          down. Based on the balance and APR entered, the
                          interest added each month may be higher than your
                          monthly payment.
                        </p>

                        {(() => {
                          const minNeeded = calculateMinimumPaymentToReduce(
                            totals.priorityDebt.balance,
                            totals.priorityDebt.interest
                          );

                          return minNeeded ? (
                            <p className="text-sm text-[#1EB1BB] font-bold mt-2">
                              You may need to pay at least{' '}
                              {formatValue(minNeeded)} per month for this debt
                              to start reducing.
                            </p>
                          ) : null;
                        })()}

                        <p className="text-sm text-slate-500 mt-2">
                          Try increasing your monthly payment or check your
                          latest statement to confirm the required repayment.
                        </p>
                      </>
                    )}

                    {totals.payoffEstimate.reason === 'too_long' && (
                      <p>
                        At this payment level, this debt may take a very long
                        time to clear.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-4">
                Estimates assume the interest rate stays the same and no new
                borrowing is added.
              </p>
            </div>
          )}

        <div
          className={`bg-white p-6 md:p-16 rounded-[2rem] md:rounded-[3rem] border-2 shadow-xl ${totals.tier.border} max-w-3xl mx-auto w-full relative overflow-hidden`}
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

          <div className="mt-6 md:mt-8">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" /> Strategic Recommendation
            </h3>

            <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
              {monthlyPlan.type === 'deficit' ? (
                <>
                  <p className="font-bold text-slate-800 text-xl">
                    This gap looks fixable.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                    <p className="text-slate-700 leading-relaxed">
                      {trimPlan.quickWin
                        ? trimPlan.covered
                          ? `Best move: reduce ${trimPlan.quickWin.name} by ${formatValue(trimPlan.quickWin.suggestedTrim)} to get back to zero.`
                          : `Your monthly gap is ${formatValue(trimPlan.deficit)}. Reducing ${trimPlan.quickWin.name} by ${formatValue(trimPlan.quickWin.suggestedTrim)} is the biggest single trim, but you need ${formatValue(trimPlan.remainingGap)} more in cuts from other categories too.`
                        : `Your monthly gap is ${formatValue(trimPlan.deficit)}. Reduce flexible spending until your monthly balance reaches zero or above.`}
                    </p>
                  </div>

                  <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-100 mt-2 min-w-0">
                    <p className="text-slate-800 font-bold break-words">
                      Next: focus on {nextFocusDebt?.name || 'your priority debt'}.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-800 text-xl">
                    You now have room to make steady progress.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-w-0">
                    <p className="text-slate-700 leading-relaxed">
                      Best move: follow the plan consistently and protect the
                      extra payment going to{' '}
                      {nextFocusDebt?.name || 'your target debt'}.
                    </p>
                  </div>

                  {topBudgetCategories[0] && (
                    <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-100 mt-2 min-w-0">
                      <p className="text-slate-800 font-bold break-words">
                        {hasFlexibleSpending
                          ? `Faster progress: review ${topBudgetCategories[0].name} first.`
                          : `Largest cost: ${topBudgetCategories[0].name}.`}
                      </p>
                      <p className="text-slate-600 text-sm mt-2 break-words">
                        {hasFlexibleSpending
                          ? `It is your largest category at ${formatValue(
                              topBudgetCategories[0].amount
                            )}.`
                          : `It is currently your biggest listed cost at ${formatValue(
                              topBudgetCategories[0].amount
                            )}.`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <DisclaimerCard />

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
    <div className="min-h-screen text-slate-900 font-sans flex flex-col selection:bg-cyan-100 selection:text-[#1EB1BB] overflow-x-hidden bg-[#f8fafc]">
      {step === 5 && (
        <PrintSummary
          generatedDate={generatedDate}
          totals={totals}
          monthlyPlan={monthlyPlan}
          trimPlan={trimPlan}
          nextFocusDebt={nextFocusDebt}
          formatValue={formatValue}
          printPrimaryAction={printPrimaryAction}
        />
      )}

      {step > 0 && (
        <header className="no-print p-4 md:p-8 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100">
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
        <div className="no-print pt-8 px-4 sm:px-6 max-w-md mx-auto w-full">
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

      <main className="no-print flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-in overflow-x-hidden">
        {step === 0 && WelcomeView()}
        {step === 1 && PrepView()}
        {step === 2 && BasicsView()}
        {step === 3 && DebtsView()}
        {step === 4 && BillsView()}
        {step === 5 && ResultsView()}
      </main>

      {step > 1 && step < 5 && (
        <div className="no-print sticky bottom-0 bg-white/90 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 z-40">
          <div className="w-full max-w-2xl mx-auto">
            {!stepValidation.canProceed && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="min-w-0 break-words">
                  {stepValidation.message}
                </span>
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
                <span className="truncate">
                  {step === 4 ? 'Get Results' : 'Continue'}
                </span>
                <ChevronRight className="w-6 h-6 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {lastDeleted && (
        <div className="no-print fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-[#1B2B4B] text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <p className="font-black text-sm">
                {lastDeleted.type === 'debt'
                  ? 'Debt deleted'
                  : lastDeleted.type === 'bill'
                  ? 'Bill deleted'
                  : 'Budget item deleted'}
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
        <div className="no-print fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-[#1B2B4B] text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <p className="font-black text-sm">Trim targets applied</p>
              <p className="text-xs text-white/70">
                Your budget has been updated. Check the Results screen to compare
                before vs after.
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
        <div className="no-print fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 md:p-8 overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 mb-3">
              Reset everything?
            </h3>

            <p className="text-slate-500 leading-relaxed mb-6">
              This will clear your income, budget categories, debts, bills,
              savings setup, tracking history, and saved progress. This action cannot be undone.
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

        .print-summary {
          display: none;
        }

        @media print {
          html, body, #root {
            background: white !important;
            overflow: visible !important;
            height: auto !important;
          }

          body {
            margin: 0;
          }

          .no-print,
          header,
          main,
          button,
          .sticky {
            display: none !important;
          }

          .print-summary {
            display: block !important;
            position: static !important;
            width: 100% !important;
            background: white !important;
            color: #0f172a !important;
          }

          .print-summary * {
            visibility: visible !important;
          }

          @page {
            size: A4;
            margin: 16mm;
          }
        }
      `}</style>
    </div>
  );
}
