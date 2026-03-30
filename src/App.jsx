import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Plus, 
  Trash2, 
  CircleDollarSign, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Receipt,
  Wallet,
  PenLine,
  Info
} from 'lucide-react';

// --- Constants ---
const STORAGE_KEY = 'vayrity_app_data_v6';
const CURRENCIES = [
  { code: 'GBP', symbol: '£' }, { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' },
  { code: 'NGN', symbol: '₦' }, { code: 'AUD', symbol: 'A$' }, { code: 'CAD', symbol: 'C$' },
];
const BILL_PRESETS = ["Rent", "Council Tax", "Energy", "Water", "Internet", "Phone", "Gym", "Streaming"];
const DEBT_PRESETS = ["Credit Card", "Loan", "Overdraft", "Car Finance", "BNPL"];

export default function App() {
  // --- State ---
  const [step, setStep] = useState(0);
  const [state, setState] = useState({
    currency: 'GBP',
    income: '',
    everydaySpending: '',
    debts: [],
    bills: []
  });

  // --- Initialization & Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // --- Helpers ---
  const getCurrencySymbol = () => CURRENCIES.find(c => c.code === state.currency)?.symbol || '£';

  const formatValue = (val) => {
    const num = Number(val || 0);
    return `${num < 0 ? '-' : ''}${getCurrencySymbol()}${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // --- Calculations ---
  const totals = useMemo(() => {
    const income = Number(state.income || 0);
    const monthlyDebtRepayment = state.debts.reduce((sum, d) => sum + Number(d.minPayment || 0), 0);
    const monthlyBills = state.bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const totalOut = monthlyDebtRepayment + monthlyBills + Number(state.everydaySpending || 0);
    const remaining = income - totalOut;
    const totalDebtBalance = state.debts.reduce((sum, d) => sum + Number(d.balance || 0), 0);
    const priorityDebt = [...state.debts].sort((a, b) => (Number(b.interest) || 0) - (Number(a.interest) || 0))[0];

    // Determine Tier
    let tier = { level: 5, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' };
    if (remaining < -300) tier = { level: 1, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', heading: "Under serious pressure", label: "Monthly Deficit" };
    else if (remaining < 0) tier = { level: 2, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100', heading: "Needs immediate attention", label: "Monthly Deficit" };
    else if (remaining <= 100) tier = { level: 3, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', heading: "Things are very tight", label: "Monthly Margin" };
    else if (remaining <= 300) tier = { level: 4, color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-teal-100', heading: "Some room to work with", label: "Monthly Surplus" };
    else tier = { level: 5, color: 'text-[#1EB1BB]', bg: 'bg-cyan-50', border: 'border-cyan-100', heading: "Meaningful breathing room", label: "Monthly Surplus" };

    return { monthlyDebtRepayment, monthlyBills, totalOut, remaining, totalDebtBalance, priorityDebt, tier };
  }, [state]);

  // --- Actions ---
  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));
  const resetApp = () => {
    setState({ currency: 'GBP', income: '', everydaySpending: '', debts: [], bills: [] });
    setStep(0);
  };

  const addDebt = (name = "") => {
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      debts: [...prev.debts, { id, name: name || "New Debt", balance: "", interest: "", minPayment: "" }]
    }));
  };

  const updateDebt = (id, key, val) => {
    setState(prev => ({
      ...prev,
      debts: prev.debts.map(d => d.id === id ? { ...d, [key]: val } : d)
    }));
  };

  const removeDebt = (id) => {
    setState(prev => ({ ...prev, debts: prev.debts.filter(d => d.id !== id) }));
  };

  const addBill = (name = "") => {
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      bills: [...prev.bills, { id, name: name || "New Bill", amount: "" }]
    }));
  };

  const updateBill = (id, key, val) => {
    setState(prev => ({
      ...prev,
      bills: prev.bills.map(b => b.id === id ? { ...b, [key]: val } : b)
    }));
  };

  const removeBill = (id) => {
    setState(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
  };

  // --- Sub-components for Views ---
  
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
      Debt and monthly bills can be overwhelming. We help you list everything in one place and find clarity in minutes.
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

  const BasicsView = () => (
    <div className="space-y-12 max-w-2xl mx-auto animate-in">
      <section>
        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">1. Select Currency</label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CURRENCIES.map(c => (
            <button 
              key={c.code}
              onClick={() => setState(p => ({ ...p, currency: c.code }))}
              className={`py-4 rounded-xl border-2 font-black transition-all text-sm ${state.currency === c.code ? 'border-[#1EB1BB] bg-cyan-50 text-[#1B2B4B]' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">2. Monthly Income (After Tax)</label>
          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl group-focus-within:text-[#1EB1BB] transition-colors">{getCurrencySymbol()}</span>
            <input 
              type="number" 
              value={state.income}
              onChange={(e) => setState(p => ({ ...p, income: e.target.value }))}
              placeholder="0.00" 
              className="w-full pl-16 pr-6 py-6 rounded-3xl border-2 border-slate-100 focus:border-[#1EB1BB] focus:ring-8 focus:ring-cyan-50 focus:outline-none text-3xl font-black transition-all" 
            />
          </div>
        </section>
        <section>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">3. Everyday Spending</label>
          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl group-focus-within:text-[#1EB1BB] transition-colors">{getCurrencySymbol()}</span>
            <input 
              type="number" 
              value={state.everydaySpending}
              onChange={(e) => setState(p => ({ ...p, everydaySpending: e.target.value }))}
              placeholder="0.00" 
              className="w-full pl-16 pr-6 py-6 rounded-3xl border-2 border-slate-100 focus:border-[#1EB1BB] focus:ring-8 focus:ring-cyan-50 focus:outline-none text-3xl font-black transition-all" 
            />
          </div>
        </section>
      </div>
    </div>
  );

  const DebtsView = () => (
    <div className="space-y-8 max-w-4xl mx-auto animate-in">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-2xl font-black text-slate-800">Your Debts</h3>
          <button 
            onClick={() => addDebt()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {DEBT_PRESETS.map(type => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.debts.length === 0 ? (
          <div className="col-span-full bg-slate-50 rounded-[2.5rem] p-16 text-center border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
            No debts added yet. Use the presets above to start.
          </div>
        ) : (
          state.debts.map(debt => (
            <div key={debt.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6 animate-in hover:shadow-xl hover:border-slate-200 transition-all group">
              <div className="flex justify-between items-center">
                <input 
                  value={debt.name}
                  onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                  className="font-black text-xl text-[#1B2B4B] focus:outline-none w-full bg-transparent border-b border-transparent focus:border-[#1EB1BB]" 
                  placeholder="Debt Name" 
                />
                <button onClick={() => removeDebt(debt.id)} className="text-slate-200 hover:text-red-500 transition-colors p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Balance</label>
                  <input 
                    type="number" 
                    value={debt.balance}
                    onChange={(e) => updateDebt(debt.id, 'balance', e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">APR %</label>
                  <input 
                    type="number" 
                    value={debt.interest}
                    onChange={(e) => updateDebt(debt.id, 'interest', e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Min Pay</label>
                  <input 
                    type="number" 
                    value={debt.minPayment}
                    onChange={(e) => updateDebt(debt.id, 'minPayment', e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-xl text-sm font-black text-[#1EB1BB] focus:ring-2 focus:ring-[#1EB1BB] focus:outline-none" 
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const BillsView = () => (
    <div className="space-y-8 max-w-4xl mx-auto animate-in">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-2xl font-black text-slate-800">Regular Bills</h3>
          <button 
            onClick={() => addBill()}
            className="text-[10px] font-black uppercase tracking-widest text-[#1EB1BB] bg-cyan-50 px-5 py-3 rounded-2xl hover:bg-cyan-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {BILL_PRESETS.map(type => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.bills.length === 0 ? (
          <div className="col-span-full bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
            No bills added yet.
          </div>
        ) : (
          state.bills.map(bill => (
            <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 animate-in group hover:border-[#1EB1BB] transition-colors">
              <input 
                value={bill.name}
                onChange={(e) => updateBill(bill.id, 'name', e.target.value)}
                className="flex-1 font-black text-sm text-[#1B2B4B] focus:outline-none bg-transparent" 
                placeholder="Bill Name" 
              />
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-300 font-bold">{getCurrencySymbol()}</span>
                <input 
                  type="number" 
                  value={bill.amount}
                  onChange={(e) => updateBill(bill.id, 'amount', e.target.value)}
                  className="w-full bg-slate-50 pl-7 pr-3 py-3 rounded-xl text-xs font-black text-right focus:outline-none focus:ring-1 focus:ring-[#1EB1BB]" 
                  placeholder="0" 
                />
              </div>
              <button onClick={() => removeBill(bill.id)} className="text-slate-200 hover:text-red-500 transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
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
              {totals.remaining < 0 ? ' deficit' : ' left over'} each month.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-xl p-10 md:p-12 rounded-[2rem] border border-white/10 min-w-[280px] text-center transform hover:scale-105 transition-transform duration-300">
              <p className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-3">{totals.tier.label}</p>
              <p className={`text-4xl md:text-6xl font-black ${totals.remaining < 0 ? 'text-rose-400' : 'text-[#1EB1BB]'}`}>
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
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-2">Total Debt Balance</p>
          <p className="text-3xl font-black text-slate-800">{formatValue(totals.totalDebtBalance)}</p>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-1">Priority Focus</p>
            <p className="text-xl font-black text-slate-800">
              {totals.priorityDebt ? totals.priorityDebt.name : 'No Debts'}
            </p>
            <p className="text-xs text-[#1EB1BB] font-bold">Highest Interest: {totals.priorityDebt?.interest || 0}% APR</p>
          </div>
          <div className="text-right">
             <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center text-[#1EB1BB]">
               <TrendingUp className="w-6 h-6" />
             </div>
          </div>
        </div>
      </div>

      <div className={`bg-white p-10 md:p-16 rounded-[3rem] border-2 shadow-xl ${totals.tier.border} max-w-3xl mx-auto w-full relative`}>
        <div className={`absolute -top-6 left-12 p-4 rounded-2xl ${totals.tier.bg} ${totals.tier.color} shadow-lg`}>
          {totals.remaining < 0 ? <AlertCircle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
        </div>
        <div className="mt-4">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Info className="w-4 h-4" /> Strategic Recommendation
          </h3>
          <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
            {totals.remaining < 0 ? (
              <>
                <p className="font-bold text-slate-800 text-xl">Your budget is under pressure.</p>
                <p>Your commitments currently exceed your income. This is often the primary cause of financial stress. We recommend reviewing your flexible spending and contacting creditors if repayments feel unmanageable.</p>
                <ul className="space-y-3 list-none font-medium">
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2.5 flex-shrink-0" /> Review direct debits for non-essentials</li>
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2.5 flex-shrink-0" /> Identify the highest interest debt causing the most bleed</li>
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2.5 flex-shrink-0" /> Check for potential income support or restructuring</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800 text-xl">You have a healthy surplus.</p>
                <p>This is a great foundation. By directing this extra cash strategically, you can save thousands in future interest costs and clear your balances months or years sooner.</p>
                <ul className="space-y-3 list-none font-medium">
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0" /> Use the "Snowball" method on {totals.priorityDebt?.name || 'your debt'}</li>
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0" /> Build a 3-month emergency fund buffer</li>
                  <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#1EB1BB] mt-2.5 flex-shrink-0" /> Consider consolidating smaller balances if rates allow</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button 
          onClick={() => setStep(1)}
          className="text-slate-400 font-black text-[11px] uppercase tracking-[0.3em] hover:text-[#1EB1BB] transition-colors flex items-center gap-3 mx-auto p-6"
        >
          <PenLine className="w-4 h-4" /> Refine Your Figures
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-cyan-100 selection:text-[#1EB1BB]">
      {/* Header */}
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

      {/* Progress Indicator */}
      {step > 0 && step < 4 && (
        <div className="pt-8 px-6 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((i) => (
              <React.Fragment key={i}>
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${step >= i ? 'bg-[#1EB1BB] text-white shadow-lg shadow-cyan-200' : 'bg-slate-200 text-slate-500'}`}
                >
                  {i}
                </div>
                {i < 4 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${step > i ? 'bg-[#1EB1BB]' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-4 py-12 animate-in">
        {step === 0 && <WelcomeView />}
        {step === 1 && <BasicsView />}
        {step === 2 && <DebtsView />}
        {step === 3 && <BillsView />}
        {step === 4 && <ResultsView />}
      </main>

      {/* Footer Navigation */}
      {step > 0 && step < 4 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md p-6 border-t border-slate-100 z-40">
          <div className="flex items-center justify-between w-full max-w-2xl mx-auto gap-4">
            <button 
   onClick={prevStep}
              className="flex-1 flex items-center justify-center gap-2 py-5 rounded-2xl font-black text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors text-sm uppercase tracking-widest"
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>

            <button 
              onClick={nextStep}
              className="flex-[2] bg-[#1B2B4B] text-white py-5 rounded-2xl font-black text-lg hover:bg-slate-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-wider"
            >
              {step === 3 ? 'Get Results' : 'Continue'}
              <ChevronRight className="w-6 h-6" />
            </button>
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
