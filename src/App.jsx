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
} from 'lucide-react';

// --- Constants ---
const STORAGE_KEY = 'vayrity_app_data_v6';

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

// --- Helpers ---
const isFilled = (value) =>
  value !== '' && value !== null && value !== undefined;

const isNegative = (value) => isFilled(value) && Number(value) < 0;

// --- Payoff Helpers ---
const calculateDebtPayoff = (balance, apr, monthlyPayment) => {
  const principal = Number(balance || 0);
  const annualRate = Number(apr || 0);
  const payment = Number(monthlyPayment || 0);

  if (principal <= 0 || payment <= 0) {
    return { valid: false, reason: 'missing_values' };
  }

  const monthlyRate = annualRate / 100 / 12;
  let remainingBalance = principal;
  let months = 0;
  let totalInterest = 0;

  const maxMonths = 600;

  while (remainingBalance > 0 && months < maxMonths) {
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
    totalInterest: Math.round(totalInterest),
  };
};

const calculateMinimumPaymentToReduce = (balance, apr) => {
  const principal = Number(balance || 0);
  const annualRate = Number(apr || 0);

  if (principal <= 0 || annualRate <= 0) return null;

  const monthlyRate = annualRate / 100 / 12;
  const minPayment = principal * monthlyRate;

  return Math.ceil(minPayment);
};

const calculateRequiredMonthlyPayment = (balance, apr, targetMonths) => {
  const principal = Number(balance || 0);
  const annualRate = Number(apr || 0);
  const monthsTarget = Number(targetMonths || 0);

  if (principal <= 0 || monthsTarget <= 0) {
    return { valid: false, reason: 'missing_values' };
  }

  let low = 0;
  let high = principal * 2;

  let safety = 0;
  while (safety < 50) {
    const test = calculateDebtPayoff(principal, annualRate, high);
    if (test.valid && test.months <= monthsTarget) break;
    high *= 2;
    safety += 1;
  }

  if (safety >= 50) {
    return { valid: false, reason: 'too_long' };
  }

  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    const result = calculateDebtPayoff(principal, annualRate, mid);

    if (!result.valid || result.months > monthsTarget) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const requiredPayment = Math.ceil(high);
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

export default function App() {
  const [step, setStep] = useState(0);
  const [expandedDebtId, setExpandedDebtId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [state, setState] = useState({
    currency: 'GBP',
    income: '',
    everydaySpending: '',
    debts: [],
    bills: [],
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to load saved state', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const getCurrencySymbol = () =>
    CURRENCIES.find((c) => c.code === state.currency)?.symbol || '£';

  const formatValue = (val) => {
    const num = Number(val || 0);
    return `${num < 0 ? '-' : ''}${getCurrencySymbol()}${Math.abs(
      num
    ).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

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

  const hasInvalidDebts = state.debts.some(
    (debt) =>
      isNegative(debt.balance) ||
      isNegative(debt.interest) ||
      isNegative(debt.minPayment)
  );

  const hasInvalidBills = state.bills.some((bill) => isNegative(bill.amount));

  const incomeMissing = step === 2 && !isFilled(state.income);
  const spendingMissing = step === 2 && !isFilled(state.everydaySpending);

  const stepValidation = useMemo(() => {
    if (step === 2) {
      const incomeFilled = isFilled(state.income);
      const spendingFilled = isFilled(state.everydaySpending);

      if (!incomeFilled || !spendingFilled) {
        return {
          canProceed: false,
          message:
            'Please fill in both Monthly Income and Everyday Spending before continuing.',
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
  }, [step, state.income, state.everydaySpending, hasInvalidDebts, hasInvalidBills]);

  const totals = useMemo(() => {
    const income = Number(state.income || 0);
    const monthlyDebtRepayment = state.debts.reduce(
      (sum, d) => sum + Number(d.minPayment || 0),
      0
    );
    const monthlyBills = state.bills.reduce(
      (sum, b) => sum + Number(b.amount || 0),
      0
    );
    const totalOut =
      monthlyDebtRepayment + monthlyBills + Number(state.everydaySpending || 0);
    const remaining = income - totalOut;
    const totalDebtBalance = state.debts.reduce(
      (sum, d) => sum + Number(d.balance || 0),
      0
    );
    const priorityDebt = [...state.debts].sort(
      (a, b) => (Number(b.interest) || 0) - (Number(a.interest) || 0)
    )[0];

    const payoffEstimate = priorityDebt
      ? calculateDebtPayoff(
          priorityDebt.balance,
          priorityDebt.interest,
          priorityDebt.minPayment
        )
      : null;

    const targetPaymentOptions = priorityDebt
      ? [
          {
            label: 'Clear in 6 months',
            months: 6,
            result: calculateRequiredMonthlyPayment(
              priorityDebt.balance,
              priorityDebt.interest,
              6
            ),
          },
          {
            label: 'Clear in 12 months',
            months: 12,
            result: calculateRequiredMonthlyPayment(
              priorityDebt.balance,
              priorityDebt.interest,
              12
            ),
          },
          {
            label: 'Clear in 24 months',
            months: 24,
            result: calculateRequiredMonthlyPayment(
              priorityDebt.balance,
              priorityDebt.interest,
              24
            ),
          },
        ]
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
      monthlyDebtRepayment,
      monthlyBills,
      totalOut,
      remaining,
      totalDebtBalance,
      priorityDebt,
      payoffEstimate,
      targetPaymentOptions,
      tier,
    };
  }, [state]);

  const nextStep = () => {
    if (!stepValidation.canProceed) return;
    setStep((s) => Math.min(s + 1, 5));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const resetApp = () => {
    setState({
      currency: 'GBP',
      income: '',
      everydaySpending: '',
      debts: [],
      bills: [],
    });
    setExpandedDebtId(null);
    setExpandedBillId(null);
    setStep(0);
  };

  const addDebt = (name = '') => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      debts: [
        {
          id,
          name: name || 'New Debt',
          balance: '',
          interest: '',
          minPayment: '',
        },
        ...prev.debts,
      ],
    }));
    setExpandedDebtId(id);
  };

  const updateDebt = (id, key, val) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, [key]: val } : d)),
    }));
  };

  const removeDebt = (id) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
    setExpandedDebtId((prev) => (prev === id ? null : prev));
  };

  const toggleDebt = (id) => {
    setExpandedDebtId((prev) => (prev === id ? null : id));
  };

  const addBill = (name = '') => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      bills: [{ id, name: name || 'New Bill', amount: '' }, ...prev.bills],
    }));
    setExpandedBillId(id);
  };

  const updateBill = (id, key, val) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => (b.id === id ? { ...b, [key]: val } : b)),
    }));
  };

  const removeBill = (id) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.filter((b) => b.id !== id),
    }));
    setExpandedBillId((prev) => (prev === id ? null : prev));
  };

  const toggleBill = (id) => {
    setExpandedBillId((prev) => (prev === id ? null : id));
  };

  const WelcomeView = () => (
    <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-20 shadow-2xl border border-slate-100 text-center max-w-4xl mx-auto animate-in">
      <div className="flex flex-col items-center mb-10">
        <img
          src="/vayrity-logo.png"
          alt="Vayrity logo"
          className="h-16 md:h-20 object-contain mb-8"
        />

        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[#1B2B4B] mb-3">
          VAYRITY
        </h1>

        <p className="text-xs md:text-sm font-bold tracking-[0.5em] text-[#1EB1BB] uppercase">
          Clear Truth. Real Freedom.
        </p>
      </div>

      <h2 className="text-3xl md:text-5xl font-extrabold mt-6 mb-8 text-slate-800 leading-tight max-w-2xl mx-auto">
        See where your money is going and what to do next.
      </h2>

      <p className="text-slate-500 mb-12 text-lg md:text-xl leading-relaxed max-w-md mx-auto font-medium">
        Debt and monthly bills can be overwhelming. We help you list everything
        in one place and find clarity in minutes.
      </p>

      <div className="flex justify-center mt-6">
        <button
          onClick={nextStep}
          className="w-full max-w-sm mx-auto bg-[#1B2B4B] text-white py-6 rounded-2xl font-black text-xl hover:bg-slate-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-4 group"
        >
          Get started
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );

  const PrepView = () => (
    <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-16 shadow-2xl border border-slate-100 max-w-3xl mx-auto animate-in">
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
          className="w-full max-w-sm mx-auto bg-[#1B2B4B] text-white py-5 rounded-2xl font-black text-lg hover:bg-slate-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-wider"
        >
          Continue
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const BasicsView = () => (
    <div className="space-y-12 max-w-2xl mx-auto animate-in">
      <section>
        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
          1. Select Currency
        </label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setState((p) => ({ ...p, currency: c.code }))}
              className={`py-4 rounded-xl border-2 font-black transition-all text-sm ${
                state.currency === c.code
                  ? 'border-[#1EB1BB] bg-cyan-50 text-[#1B2B4B]'
                  : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
              }`}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            2. Monthly Income (After Tax)
          </label>
          <p className="text-xs text-slate-400 mt-1">
            Enter your total monthly income (salary + other income combined)
          </p>
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
              min="0"
              value={state.income}
              onChange={(e) =>
                setState((p) => ({ ...p, income: e.target.value }))
              }
              placeholder="0.00"
              className={`w-full pl-16 pr-6 py-6 rounded-3xl border-2 focus:ring-8 focus:outline-none text-3xl font-black transition-all ${
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

        <section>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            3. Everyday Spending
          </label>
          <p className="text-xs text-slate-400 mt-1">
            Estimate your total monthly spending on food, transport, etc.
          </p>
          <div className="relative group">
            <span
              className={`absolute left-6 top-1/2 -translate-y-1/2 font-black text-2xl transition-colors ${
                spendingMissing
                  ? 'text-red-300 group-focus-within:text-red-500'
                  : 'text-slate-300 group-focus-within:text-[#1EB1BB]'
              }`}
            >
              {getCurrencySymbol()}
            </span>
            <input
              type="number"
              min="0"
              value={state.everydaySpending}
              onChange={(e) =>
                setState((p) => ({ ...p, everydaySpending: e.target.value }))
              }
              placeholder="0.00"
              className={`w-full pl-16 pr-6 py-6 rounded-3xl border-2 focus:ring-8 focus:outline-none text-3xl font-black transition-all ${
                spendingMissing
                  ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-50'
                  : 'border-slate-100 focus:border-[#1EB1BB] focus:ring-cyan-50'
              }`}
            />
          </div>
          {spendingMissing && (
            <p className="text-xs text-red-500 font-bold mt-2">
              Everyday Spending is required.
            </p>
          )}
        </section>
      </div>
    </div>
  );

  const DebtsView = () => (
    <div className="space-y-8 max-w-4xl mx-auto animate-in">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start gap-4 px-2">
          <div>
            <h3 className="text-2xl font-black text-slate-800">Your Debts</h3>
            <p className="text-sm text-slate-400 mt-2">
              You can add more than one of the same debt type, for example
              multiple credit cards or loans.
            </p>
          </div>

          <button
            onClick={() => addDebt()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {DEBT_PRESETS.map((type) => (
            <button
              key={type}
              onClick={() => addDebt(type)}
              className="whitespace-nowrap px-6 py-3 bg-white border border-slate-100 rounded-full text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm hover:shadow-md active:bg-cyan-50 transition-all hover:border-[#1EB1BB]"
            >
              + {type}
            </button>
          ))}
        </div>
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

            return (
              <div
                key={debt.id}
                className={`bg-white rounded-[2rem] border shadow-sm transition-all overflow-hidden ${
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg md:text-xl font-black text-[#1B2B4B] truncate">
                          {debt.name || 'New Debt'}
                        </p>

                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${status.bg} ${status.text} ${status.border}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs md:text-sm text-slate-500">
                        <span>Balance: {formatValue(debt.balance)}</span>
                        <span>APR: {Number(debt.interest || 0)}%</span>
                        <span>Min Pay: {formatValue(debt.minPayment)}/month</span>
                      </div>
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
                  <div className="px-5 md:px-6 pb-6 animate-in border-t border-slate-100">
                    <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Debt Name
                        </label>
                        <input
                          value={debt.name}
                          onChange={(e) =>
                            updateDebt(debt.id, 'name', e.target.value)
                          }
                          className="w-full bg-slate-50 p-4 rounded-xl text-sm font-black text-[#1B2B4B] focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none"
                          placeholder="Debt Name"
                        />
                      </div>

                      <div className="space-y-1">
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
                          className={`w-full p-4 rounded-xl text-sm font-black focus:outline-none ${
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

                      <div className="space-y-1">
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
                          className={`w-full p-4 rounded-xl text-sm font-black focus:outline-none ${
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

                      <div className="space-y-1 md:col-span-3">
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
                          className={`w-full p-4 rounded-xl text-sm font-black focus:outline-none ${
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
    <div className="space-y-8 max-w-4xl mx-auto animate-in">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start gap-4 px-2">
          <div>
            <h3 className="text-2xl font-black text-slate-800">
              Regular Bills
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              You can add more than one of the same bill type if needed.
            </p>
          </div>

          <button
            onClick={() => addBill()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {BILL_PRESETS.map((type) => (
            <button
              key={type}
              onClick={() => addBill(type)}
              className="whitespace-nowrap px-6 py-3 bg-white border border-slate-100 rounded-full text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm hover:shadow-md active:bg-cyan-50 transition-all hover:border-[#1EB1BB]"
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
                className={`bg-white rounded-[2rem] border shadow-sm transition-all overflow-hidden ${
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-base md:text-lg font-black text-[#1B2B4B] truncate">
                          {bill.name || 'New Bill'}
                        </p>

                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${status.bg} ${status.text} ${status.border}`}
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
                  <div className="px-5 md:px-6 pb-6 animate-in border-t border-slate-100">
                    <div className="pt-6 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Bill Name
                        </label>
                        <input
                          value={bill.name}
                          onChange={(e) =>
                            updateBill(bill.id, 'name', e.target.value)
                          }
                          className="w-full bg-slate-50 p-4 rounded-xl text-sm font-black text-[#1B2B4B] focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none"
                          placeholder="Bill Name"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                          Monthly Amount
                        </label>
                        <div className="relative w-full">
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
                            onChange={(e) =>
                              updateBill(bill.id, 'amount', e.target.value)
                            }
                            className={`w-full pl-10 pr-4 py-4 rounded-xl text-sm font-black text-right focus:outline-none ${
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

  const ResultsView = () => (
    <div className="space-y-10 max-w-5xl mx-auto pb-16 animate-in">
      <section className="bg-[#1B2B4B] text-white p-10 md:p-20 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-[100px]"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-black leading-tight">
              {totals.tier.heading}
            </h2>
            <p className="text-white/70 text-lg md:text-xl font-medium max-w-xl">
              Based on your figures, you have {formatValue(Math.abs(totals.remaining))}
              {totals.remaining < 0
                ? ' missing each month after your listed costs.'
                : ' left each month after your listed costs.'}
            </p>
          </div>

          <div className="w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-xl p-10 md:p-12 rounded-[2rem] border border-white/10 min-w-[280px] text-center transform hover:scale-105 transition-transform duration-300">
              <p className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-3">
                {totals.tier.label}
              </p>
              <p
                className={`text-4xl md:text-6xl font-black ${
                  totals.remaining < 0 ? 'text-rose-400' : 'text-[#1EB1BB]'
                }`}
              >
                {formatValue(totals.remaining)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <div className="flex justify-center mb-4 text-slate-300">
            <Wallet className="w-8 h-8" />
          </div>
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">
            Total Debt Balance
          </p>
          <p className="text-3xl font-black text-slate-800">
            {formatValue(totals.totalDebtBalance)}
          </p>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider">
                Priority Focus
              </p>
              <p className="text-xl font-black text-slate-800">
                {totals.priorityDebt ? totals.priorityDebt.name : 'No debt added'}
              </p>
              <p className="text-sm text-slate-600">
                Balance: {totals.priorityDebt ? formatValue(totals.priorityDebt.balance) : formatValue(0)}
              </p>
              <p className="text-sm text-slate-600">
                Minimum payment:{' '}
                {totals.priorityDebt
                  ? `${formatValue(totals.priorityDebt.minPayment)}/month`
                  : `${formatValue(0)}/month`}
              </p>
              <p className="text-xs text-[#1EB1BB] font-bold">
                Highest Interest: {totals.priorityDebt?.interest || 0}% APR
              </p>
            </div>

            <div className="text-right">
              <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center text-[#1EB1BB]">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            The payoff estimates below apply to this priority debt only, not your
            full total debt balance.
          </p>
        </div>
      </div>

      {totals.priorityDebt && totals.payoffEstimate && (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Info className="w-4 h-4" /> Estimated payoff for{' '}
            {totals.priorityDebt.name || 'your priority debt'}
          </h3>

          {totals.payoffEstimate.valid ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Estimated payoff time
                  </p>
                  <p className="text-2xl font-black text-slate-800">
                    {totals.payoffEstimate.months} months
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    At your current payment of {formatValue(totals.priorityDebt.minPayment)} per
                    month, {totals.priorityDebt.name || 'this debt'} could be cleared in about{' '}
                    {totals.payoffEstimate.months} months.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Estimated interest paid
                  </p>
                  <p className="text-2xl font-black text-slate-800">
                    {formatValue(totals.payoffEstimate.totalInterest)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    If you keep paying the same amount, you may pay about{' '}
                    {formatValue(totals.payoffEstimate.totalInterest)} in interest on{' '}
                    {totals.priorityDebt.name || 'this debt'} over that time.
                  </p>
                </div>
              </div>

              <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Current monthly payment
                </p>
                <p className="text-2xl font-black text-slate-800">
                  {formatValue(totals.priorityDebt.minPayment)}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Based on what you entered, this is the monthly amount currently
                  being used to estimate the payoff time above for this debt.
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
                      className="bg-slate-50 rounded-2xl p-5 border border-slate-100"
                    >
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        {option.label}
                      </p>

                      {option.result.valid ? (
                        <>
                          <p className="text-2xl font-black text-slate-800">
                            {formatValue(option.result.monthlyPayment)}/month
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            To aim for repayment in about {option.months} months, you may
                            need to pay around {formatValue(option.result.monthlyPayment)} each
                            month on this debt.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Add clearer balance, APR, and payment details to estimate
                          this target.
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
                    Add balance, APR, and minimum payment to see an estimate for
                    this debt.
                  </p>
                )}

                {totals.payoffEstimate.reason === 'payment_too_low' && (
                  <>
                    <p>
                      Your current payment may be too low to bring this debt down.
                      Based on the balance and APR entered, the interest added each
                      month may be higher than your monthly payment.
                    </p>

                    {(() => {
                      const minNeeded = calculateMinimumPaymentToReduce(
                        totals.priorityDebt.balance,
                        totals.priorityDebt.interest
                      );

                      return minNeeded ? (
                        <p className="text-sm text-[#1EB1BB] font-bold mt-2">
                          You may need to pay at least {formatValue(minNeeded)} per
                          month for this debt to start reducing.
                        </p>
                      ) : null;
                    })()}

                    <p className="text-sm text-slate-500 mt-2">
                      Try increasing your monthly payment or check your latest
                      statement to confirm the required repayment.
                    </p>
                  </>
                )}

                {totals.payoffEstimate.reason === 'too_long' && (
                  <p>
                    At this payment level, this debt may take a very long time to
                    clear.
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-4">
            Estimates assume the interest rate stays the same and no new borrowing
            is added.
          </p>
        </div>
      )}

      <div
        className={`bg-white p-10 md:p-16 rounded-[3rem] border-2 shadow-xl ${totals.tier.border} max-w-3xl mx-auto w-full relative`}
      >
        <div
          className={`absolute -top-6 left-12 p-4 rounded-2xl ${totals.tier.bg} ${totals.tier.color} shadow-lg`}
        >
          {totals.remaining < 0 ? (
            <AlertCircle className="w-8 h-8" />
          ) : (
            <CheckCircle2 className="w-8 h-8" />
          )}
        </div>

        <div className="mt-4">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Info className="w-4 h-4" /> Strategic Recommendation
          </h3>

          <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
            {totals.remaining < 0 ? (
              <>
                <p className="font-bold text-slate-800 text-xl">
                  Your current position is under pressure.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      What this means
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      Your listed monthly costs are currently higher than your
                      income. This may explain why things feel difficult to manage
                      right now.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      What to focus on
                    </p>
                    <ul className="space-y-2 text-slate-700">
                      <li>• Review any flexible or non essential spending</li>
                      <li>• Check which debt is costing the most in interest</li>
                      <li>• Review whether repayments feel manageable</li>
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800 text-xl">
                  You have some room to make progress.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      What this means
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      You currently have money left after your listed obligations.
                      That gives you some room to reduce debt or build a buffer.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      What to focus on
                    </p>
                    <ul className="space-y-2 text-slate-700">
                      <li>• Prioritise your highest interest debt</li>
                      <li>• Keep up minimum payments on the rest</li>
                      <li>• Build a small emergency cushion if possible</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={() => setStep(2)}
          className="text-slate-400 font-black text-[11px] uppercase tracking-[0.3em] hover:text-[#1EB1BB] transition-colors flex items-center gap-3 mx-auto p-6"
        >
          <PenLine className="w-4 h-4" /> Refine Your Figures
        </button>
      </div>
    </div>
  );

  const progressSteps = [2, 3, 4];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-cyan-100 selection:text-[#1EB1BB]">
      {step > 0 && (
        <header className="p-5 md:p-8 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100">
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
            <div
              className="flex items-center cursor-pointer active:scale-95 transition-transform"
              onClick={() => setStep(0)}
            >
              <img
                src="/vayrity-logo.png"
                alt="Vayrity logo"
                className="h-10 md:h-12 w-auto object-contain"
              />
            </div>

            <button
              onClick={resetApp}
              className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2 uppercase tracking-widest px-4 py-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </header>
      )}

      {step > 1 && step < 5 && (
        <div className="pt-8 px-6 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between">
            {progressSteps.map((progressStep, index) => (
              <React.Fragment key={progressStep}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                    step >= progressStep
                      ? 'bg-[#1EB1BB] text-white shadow-lg shadow-cyan-200'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < progressSteps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${
                      step > progressStep ? 'bg-[#1EB1BB]' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 px-4 py-12 animate-in">
        {step === 0 && WelcomeView()}
        {step === 1 && PrepView()}
        {step === 2 && BasicsView()}
        {step === 3 && DebtsView()}
        {step === 4 && BillsView()}
        {step === 5 && ResultsView()}
      </main>

      {step > 1 && step < 5 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md p-6 border-t border-slate-100 z-40">
          <div className="w-full max-w-2xl mx-auto">
            {!stepValidation.canProceed && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {stepValidation.message}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={prevStep}
                className="flex-1 flex items-center justify-center gap-2 py-5 rounded-2xl font-black text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors text-sm uppercase tracking-widest"
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>

              <button
                onClick={nextStep}
                disabled={!stepValidation.canProceed}
                className={`flex-[2] py-5 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-wider ${
                  stepValidation.canProceed
                    ? 'bg-[#1B2B4B] text-white hover:bg-slate-800 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {step === 4 ? 'Get Results' : 'Continue'}
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-in {
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
