import React, { useMemo, useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, UserProfile, Client, Expense, Product, ViewState } from '../types';
import { Skeleton } from './Skeleton';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { 
  Euro, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowRight, Wallet, 
  CheckCircle2, Plus, Calendar, Clock, Sparkles, Building2, UserCheck, 
  ShieldAlert, Zap, Globe, FileCheck2, ShoppingBag, Landmark, ArrowDownRight, 
  UserPlus, FilePlus, Copy, Compass, HelpCircle, Activity, Info, Bell
} from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  expenses?: Expense[];
  clients?: Client[];
  products?: Product[];
  userProfile?: UserProfile;
  setView?: (view: ViewState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices = [], 
  expenses = [], 
  clients = [], 
  products = [], 
  userProfile,
  setView
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const currencySymbol = userProfile?.currencySymbol || '€';
  const currentTheme = userProfile?.themeColor || 'blue';
  
  const theme = useMemo(() => {
    const themeClasses: any = {
        blue: { text: 'text-blue-600', bg: 'bg-blue-600', border: 'border-blue-105', badge: 'bg-blue-50 text-blue-700 border-blue-100', ring: 'focus:ring-blue-500', bgHover: 'hover:border-blue-300 hover:shadow-blue-50/50', chartColor: '#3b82f6', innerBg: 'bg-blue-50/50 text-blue-650' },
        emerald: { text: 'text-emerald-600', bg: 'bg-emerald-600', border: 'border-emerald-105', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', ring: 'focus:ring-emerald-500', bgHover: 'hover:border-emerald-300 hover:shadow-emerald-50/50', chartColor: '#10b981', innerBg: 'bg-emerald-50/50 text-emerald-650' },
        violet: { text: 'text-indigo-600', bg: 'bg-indigo-650', border: 'border-indigo-105', badge: 'bg-indigo-50 text-indigo-700 border-indigo-100', ring: 'focus:ring-indigo-500', bgHover: 'hover:border-indigo-300 hover:shadow-indigo-50/50', chartColor: '#6366f1', innerBg: 'bg-indigo-50/50 text-indigo-650' },
        amber: { text: 'text-amber-600', bg: 'bg-amber-600', border: 'border-amber-105', badge: 'bg-amber-50 text-amber-700 border-amber-100', ring: 'focus:ring-amber-500', bgHover: 'hover:border-amber-300 hover:shadow-amber-50/50', chartColor: '#f59e0b', innerBg: 'bg-amber-50 stream text-amber-650' },
        neutral: { text: 'text-slate-900', bg: 'bg-slate-900', border: 'border-slate-300', badge: 'bg-slate-100 text-slate-800 border-slate-200', ring: 'focus:ring-slate-900', bgHover: 'hover:border-slate-300 hover:shadow-slate-50/50', chartColor: '#475569', innerBg: 'bg-slate-50/50 text-slate-650' }
    };
    return themeClasses[currentTheme] || themeClasses.blue;
  }, [currentTheme]);
  const [simulatedExtra, setSimulatedExtra] = React.useState<number>(0);

  const themeClasses: Record<string, {
    text: string;
    bg: string;
    border: string;
    badge: string;
    ring: string;
    bgHover: string;
    chartColor: string;
    innerBg: string;
  }> = {
    blue: {
      text: 'text-blue-600',
      bg: 'bg-blue-600',
      border: 'border-blue-105',
      badge: 'bg-blue-50 text-blue-700 border-blue-100',
      ring: 'focus:ring-blue-500',
      bgHover: 'hover:border-blue-300 hover:shadow-blue-50/50',
      chartColor: '#3b82f6',
      innerBg: 'bg-blue-50/50 text-blue-650'
    },
    emerald: {
      text: 'text-emerald-600',
      bg: 'bg-emerald-600',
      border: 'border-emerald-105',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      ring: 'focus:ring-emerald-500',
      bgHover: 'hover:border-emerald-300 hover:shadow-emerald-50/50',
      chartColor: '#10b981',
      innerBg: 'bg-emerald-50/50 text-emerald-650'
    },
    violet: {
      text: 'text-indigo-600',
      bg: 'bg-indigo-650',
      border: 'border-indigo-105',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      ring: 'focus:ring-indigo-500',
      bgHover: 'hover:border-indigo-300 hover:shadow-indigo-50/50',
      chartColor: '#6366f1',
      innerBg: 'bg-indigo-50/50 text-indigo-650'
    },
    amber: {
      text: 'text-amber-600',
      bg: 'bg-amber-600',
      border: 'border-amber-105',
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      ring: 'focus:ring-amber-500',
      bgHover: 'hover:border-amber-300 hover:shadow-amber-50/50',
      chartColor: '#f59e0b',
      innerBg: 'bg-amber-50 stream text-amber-650'
    },
    neutral: {
      text: 'text-slate-900',
      bg: 'bg-slate-900',
      border: 'border-slate-300',
      badge: 'bg-slate-100 text-slate-800 border-slate-200',
      ring: 'focus:ring-slate-900',
      bgHover: 'hover:border-slate-400 hover:shadow-slate-100',
      chartColor: '#1e293b',
      innerBg: 'bg-slate-50 text-slate-800'
    }
  };

  const tc = themeClasses[currentTheme] || themeClasses.blue;

  // --- 1. DETAILED REVENUE & EXPENSES STATS ---
  const totalRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'Payée' || inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => {
        const type = inv.type || 'invoice';
        if (type === 'invoice') return sum + inv.total;
        if (type === 'credit_note') return sum - inv.total;
        return sum; 
      }, 0);
  }, [invoices]);

  const pendingRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT)
      .reduce((sum, inv) => {
        const type = inv.type || 'invoice';
        if (type === 'invoice') return sum + inv.total;
        return sum; 
      }, 0);
  }, [invoices]);

  const overdueInvoicesCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return invoices.filter(inv => 
      (inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT) && 
      inv.dueDate < todayStr && 
      (inv.type === 'invoice' || !inv.type)
    ).length;
  }, [invoices]);

  const totalExpensesAmount = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const netMarge = totalRevenue - totalExpensesAmount;

  // Dyn calculations for URSSAF estimations
  const activityType = userProfile?.activityType || 'services_liberal';
  const customChargesRate = userProfile?.customChargesRate !== undefined 
    ? userProfile.customChargesRate 
    : (activityType.includes('sales') ? 12.3 : 21.1);

  const estimatedCharges = totalRevenue * (customChargesRate / 100);
  const netCorporateProfit = netMarge - estimatedCharges;

  // Simulate revenue for slider projections
  const simulatedRevenue = totalRevenue + simulatedExtra;

  // --- 2. DOUBLE THRESHOLDS GAUGE CALCULATION (SEUILS 2026/2027) ---
  const limits = useMemo(() => {
    const customVatThreshold = userProfile?.customVatThreshold;
    const customCaThreshold = userProfile?.customCaThreshold;
    const autoVatThreshold = userProfile?.autoVatThreshold !== false;
    const autoCaThreshold = userProfile?.autoCaThreshold !== false;

    let microCeiling = 77700;
    let tvaCeiling = 39100;
    let tvaBase = 36800;
    let label = 'Prestations de Services / BNC';

    if (activityType === 'sales') {
      microCeiling = 188700;
      tvaCeiling = 101000;
      tvaBase = 91900;
      label = 'Vente de Marchandises / BIC';
    } else if (activityType === 'services_commercial') {
      microCeiling = 77700;
      tvaCeiling = 39100;
      tvaBase = 36800;
      label = 'Prestations de Services Commerciales / BIC';
    } else if (activityType === 'custom') {
      label = 'Seuils Personnalisés / Micro-entreprise';
    }

    if (!autoVatThreshold && customVatThreshold !== undefined && customVatThreshold > 0) {
      tvaCeiling = customVatThreshold;
      tvaBase = Math.round(customVatThreshold * 0.94);
    }
    if (!autoCaThreshold && customCaThreshold !== undefined && customCaThreshold > 0) {
      microCeiling = customCaThreshold;
    }

    return {
      microCeiling,
      tvaCeiling,
      tvaBase,
      label
    };
  }, [activityType, userProfile]);

  const tvaProgress = Math.min((totalRevenue / limits.tvaCeiling) * 100, 100);
  const microProgress = Math.min((totalRevenue / limits.microCeiling) * 100, 150);

  // --- 3. DYNAMIC CHARTS DATA CONSTRUCTOR ---
  const monthlyComparativeData = useMemo(() => {
    const data: Record<string, { income: number; expense: number }> = {};
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    months.forEach(m => data[m] = { income: 0, expense: 0 });

    // Sum receipts
    invoices.forEach(inv => {
      if (inv.status === 'Payée' || inv.status === InvoiceStatus.PAID) {
        const date = new Date(inv.date);
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          const mName = months[monthIndex];
          const type = inv.type || 'invoice';
          if (type === 'invoice') {
            data[mName].income += inv.total;
          } else if (type === 'credit_note') {
            data[mName].income -= inv.total;
          }
        }
      }
    });

    // Sum expenses
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      const monthIndex = date.getMonth();
      if (monthIndex >= 0 && monthIndex < 12) {
        const mName = months[monthIndex];
        data[mName].expense += exp.amount;
      }
    });

    return months.map(name => ({ 
        name, 
        Recettes: data[name].income, 
        Frais: data[name].expense,
        Marge: data[name].income - data[name].expense
    }));
  }, [invoices, expenses]);

  // Top clients revenue share
  const topClientsData = useMemo(() => {
    const clientRevenue: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === 'Payée' || inv.status === InvoiceStatus.PAID) {
        const type = inv.type || 'invoice';
        const clientVal = clients.find(c => c.id === inv.clientId)?.name || 'Client Inconnu';
        const amount = type === 'invoice' ? inv.total : -inv.total;
        clientRevenue[clientVal] = (clientRevenue[clientVal] || 0) + amount;
      }
    });

    return Object.entries(clientRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [invoices, clients]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

  // --- 4. COMBINED CRITICAL ALERTS AND SYSTEM BADGES ---
  const criticalReminders = useMemo(() => {
    const alerts: { id: string; title: string; desc: string; type: 'error' | 'warn' | 'info' }[] = [];
    
    // Check for late invoices
    const todayStr = new Date().toISOString().split('T')[0];
    const lateInvoicesCount = invoices.filter(inv => 
      (inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT) && 
      inv.dueDate < todayStr && 
      (inv.type === 'invoice' || !inv.type)
    );

    if (lateInvoicesCount.length > 0) {
      const lateSum = lateInvoicesCount.reduce((s, i) => s + i.total, 0);
      alerts.push({
        id: 'late-inv',
        title: `${lateInvoicesCount.length} Factures en retard de paiement`,
        desc: `Relance requise d'urgence pour un total de ${lateSum.toFixed(0)} ${currencySymbol}.`,
        type: 'error'
      });
    }

    // Check threshold warnings
    if (totalRevenue >= limits.tvaBase && totalRevenue < limits.tvaCeiling) {
      alerts.push({
        id: 'tva-warning',
        title: 'Seuil de Tolérance de TVA approché',
        desc: `Vous approchez de la franchise transitoire de TVA. Préparez votre numéro de TVA intracommunautaire DGFIP.`,
        type: 'warn'
      });
    } else if (totalRevenue >= limits.tvaCeiling) {
      alerts.push({
        id: 'tva-exceeded',
        title: 'Franchise de TVA Désormais Applicable',
        desc: `Plafond dépassé ! Vous devez ajouter les taux de TVA sur vos factures et les collecter auprès du SIE.`,
        type: 'error'
      });
    }

    // Check PPF setup reminder
    if (!userProfile?.ppfCertificateName) {
      alerts.push({
        id: 'ppf-setup',
        title: 'Raccordement PPF 2026 en attente',
        desc: 'Associez un certificat fiscal de signature DGFIP dans vos réglages pour valider votre conformité.',
        type: 'info'
      });
    }

    return alerts;
  }, [invoices, totalRevenue, limits, userProfile]);

  // Combined last chronological actions
  const chronologicalFeed = useMemo(() => {
    const list: { id: string; date: string; type: 'sale' | 'expense'; title: string; detail: string; amount: number }[] = [];
    
    invoices.slice(0, 5).forEach(inv => {
      const clientName = clients.find(c => c.id === inv.clientId)?.name || 'Client Inconnu';
      list.push({
        id: inv.id,
        date: inv.date,
        type: 'sale',
        title: inv.type === 'credit_note' ? `Avoir émis : ${inv.number}` : `Facture client : ${inv.number}`,
        detail: `Client : ${clientName} (${inv.status})`,
        amount: inv.type === 'credit_note' ? -inv.total : inv.total
      });
    });

    expenses.slice(0, 5).forEach(exp => {
      list.push({
        id: exp.id,
        date: exp.date,
        type: 'expense',
        title: `Note de frais : ${exp.category}`,
        detail: exp.description,
        amount: exp.amount
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [invoices, expenses, clients]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-8 animate-fade-in max-w-7xl mx-auto pb-12 font-sans selection:bg-slate-200/50`}>
      
      {/* 1. TITLE BAR WITH QUICK INSIGHT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${tc.text} ${tc.badge} px-2 py-0.5 rounded-md uppercase tracking-wider`}>Tableau de bord auto-géré</span>
            <span className="text-[10px] font-bold text-purple-650 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={10} /> France Ordonnance 2026/2027 Compliant
            </span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Bonjour{userProfile?.companyName ? `, ${userProfile.companyName}` : ''}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5 font-medium">Contrôlez vos indicateurs légaux, vos marges et votre conformité Factur-X en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueInvoicesCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 px-3 py-2 rounded-2xl shadow-sm text-xs font-bold text-red-650 dark:text-red-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span>{overdueInvoicesCount} Facture{overdueInvoicesCount > 1 ? 's' : ''} en retard</span>
            </div>
          )}
          <div className="relative">
            <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm text-slate-650 dark:text-slate-400 relative" title={`${overdueInvoicesCount} alertes de retard de paiement`}>
              <Bell size={16} className={overdueInvoicesCount > 0 ? "animate-bounce text-red-500" : ""} />
              {overdueInvoicesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                  {overdueInvoicesCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-sm text-xs font-semibold text-slate-600 dark:text-slate-455">
            <Calendar size={14} style={{ color: tc.chartColor }} />
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC CRITICAL MESSENGERS FOR AUDIT ACTIONS */}
      {criticalReminders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {criticalReminders.map((alert) => (
            <div 
              key={alert.id}
              className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${
                alert.type === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                alert.type === 'warn' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-slate-50/50 border-slate-150 text-slate-900'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                alert.type === 'error' ? 'bg-white text-red-650 shadow-sm' :
                alert.type === 'warn' ? 'bg-white text-amber-600 shadow-sm' :
                `bg-white ${tc.text} shadow-sm`
              }`}>
                <AlertCircle size={14} />
              </div>
              <div>
                <h5 className="text-xs font-extrabold leading-tight">{alert.title}</h5>
                <p className="text-[10px] text-slate-500 leading-normal mt-1">{alert.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. FOUR CRITICAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Chiffre d'affaires encaissé */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-150/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-300 text-slate-400">
            <Landmark size={80} style={{ color: tc.chartColor }} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 ${tc.innerBg.split(' ')[0]} ${tc.text} rounded-xl`}>
              <Euro size={20} />
            </div>
            <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              Récupéré
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recettes réelles (en banque)</p>
          <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-1.5">
            {totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">Cumul de l'exercice comptable</p>
        </div>

        {/* Card 2: Dépenses / Frais professionnels */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-150/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-300 text-indigo-500">
            <ShoppingBag size={80} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingDown size={20} />
            </div>
            <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              Décaissements
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Charges d'activité (Achats)</p>
          <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-1.5">
            {totalExpensesAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">{expenses.length} justificatifs archivés</p>
        </div>

        {/* Card 3: Résultat d'Exploitation ou Marge Opérationnelle */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-15px] opacity-10">
            <TrendingUp size={110} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 text-white rounded-xl">
              <Zap size={20} />
            </div>
            <span className="text-[9px] font-extrabold text-[#1cb7c4] bg-[#1cb7c4]/15 px-2 py-0.5 rounded-full">
              Marge Opérationnelle
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bénéfice de fonctionnement</p>
          <h4 className="text-2xl font-black font-mono tracking-tight mt-1.5 text-white">
            {netMarge.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">
            Marge réelle : <strong className="text-emerald-400">{totalRevenue === 0 ? '105' : ((netMarge / (totalRevenue || 1)) * 100).toFixed(0)}%</strong> du CA
          </p>
        </div>

        {/* Card 4: Facture en cours / À recevoir */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-150/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-300 text-orange-500">
            <Clock size={80} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Wallet size={20} />
            </div>
            <span className="text-[9px] font-extrabold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
              À Recevoir
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CA Facturé restant en attente</p>
          <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-1.5">
            {pendingRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencySymbol}
          </h4>
          <p className="text-[10px] text-slate-400 mt-2">
            {invoices.filter(i => i.status === 'Envoyée' || i.status === InvoiceStatus.SENT).length} factures non recouvrées
          </p>
        </div>

      </div>

      {/* 4. SEUIL STATUS ET REFORME DGFIP 2026 */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <span className={`text-[10px] font-bold ${tc.text} ${tc.badge} px-2 py-0.5 rounded uppercase tracking-wider`}>Observatoire Fiscal</span>
            <h4 className="text-xl font-bold text-slate-900">Surveillance des Seuils & Plafonds d'Activité ({limits.label})</h4>
            <p className="text-xs text-slate-400 leading-normal">Surveillez vos plafonds de chiffre d'affaires légaux définis par le Ministère des Finances pour l'année fiscale en cours.</p>
          </div>
          <div className="p-4 bg-slate-50/80 border border-slate-200/50 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
            <Globe className={`${tc.text} shrink-0`} size={16} />
            <span>Format standard <strong>Factur-X</strong> de vos factures prêt pour le <strong>PPF</strong>.</span>
          </div>
        </div>

        {/* INTERACTIVE SIMULATOR SLIDER SLOT */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulateur de Croissance</span>
              <h5 className="text-sm font-extrabold text-slate-800">Prédisez le franchissement de vos plafonds</h5>
            </div>
            <div className={`px-3.5 py-1.5 ${tc.badge} rounded-full text-xs font-bold font-mono`}>
              CA Projeté : {simulatedRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {currencySymbol}
              {simulatedExtra > 0 && <span className="ml-1 text-emerald-600 font-extrabold">(+{simulatedExtra.toLocaleString('fr-FR')} {currencySymbol})</span>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input 
              type="range" 
              min={0} 
              max={limits.microCeiling * 1.2 - totalRevenue > 0 ? Math.ceil(limits.microCeiling * 1.2 - totalRevenue) : 50000} 
              step={1000} 
              value={simulatedExtra} 
              onChange={(e) => setSimulatedExtra(Number(e.target.value))}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 focus:outline-none`}
              style={{
                background: `linear-gradient(to right, ${tc.chartColor} 0%, ${tc.chartColor} ${(simulatedExtra / (limits.microCeiling * 1.2 - totalRevenue > 0 ? limits.microCeiling * 1.2 - totalRevenue : 50000)) * 100}%, #e2e8f0 ${(simulatedExtra / (limits.microCeiling * 1.2 - totalRevenue > 0 ? limits.microCeiling * 1.2 - totalRevenue : 50000)) * 100}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => setSimulatedExtra(Math.max(0, simulatedExtra + 5000))}
                className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-650 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                +5 k{currencySymbol}
              </button>
              <button 
                onClick={() => setSimulatedExtra(Math.max(0, simulatedExtra + 15000))}
                className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-650 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                +15 k{currencySymbol}
              </button>
              <button 
                onClick={() => setSimulatedExtra(0)}
                className="px-2.5 py-1 text-[10px] font-black text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors"
                title="Réinitialiser"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Progress bar A: Franchise TVA */}
          <div className="p-6 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Limite franchise TVA</span>
                <h5 className="text-sm font-extrabold text-slate-800">Franchise de TVA en Base</h5>
                <p className="text-[10px] text-slate-400">Si vous dépassez {limits.tvaCeiling.toLocaleString('fr-FR')} {currencySymbol}, vous perdez l'article 293 B du CGI.</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-slate-404 block font-medium">Plafond</span>
                <strong className="text-xs font-bold text-slate-900 font-mono">{limits.tvaCeiling.toLocaleString('fr-FR')} {currencySymbol}</strong>
              </div>
            </div>

            {/* Visual Gauge */}
            <div className="space-y-2">
              <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden flex">
                {/* Actual value */}
                <div 
                  className={`h-full rounded-l-full transition-all duration-300 ${
                    totalRevenue >= limits.tvaCeiling ? 'bg-red-500' : totalRevenue >= limits.tvaBase ? 'bg-amber-500' : tc.bg
                  }`}
                  style={{ width: `${Math.min((totalRevenue / limits.tvaCeiling) * 100, 100)}%` }}
                />
                {/* Simulated increase value */}
                {simulatedExtra > 0 && (
                  <div 
                    className="h-full bg-emerald-400 animate-pulse bg-stripes transition-all duration-300 rounded-r-full"
                    style={{ 
                      width: `${Math.min((simulatedRevenue / limits.tvaCeiling) * 100, 100) - Math.min((totalRevenue / limits.tvaCeiling) * 100, 100)}%` 
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                <span>{simulatedRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {currencySymbol} ({Math.min((simulatedRevenue / limits.tvaCeiling) * 100, 150).toFixed(0)}%)</span>
                <span>Seuil limite : {limits.tvaBase.toLocaleString('fr-FR')} {currencySymbol}</span>
              </div>
            </div>
          </div>

          {/* Progress bar B: Micro-enterprise Status */}
          <div className="p-6 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Limite Auto-Statut</span>
                <h5 className="text-sm font-extrabold text-slate-800">Seuil de Maintien Micro-DGFIP</h5>
                <p className="text-[10px] text-slate-400">Plafond restrictif d'application fiscale pour garder l'abattement forfaitaire simplifié.</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] text-slate-404 block font-medium">Auto-Plafond</span>
                <strong className="text-xs font-bold text-slate-900 font-mono">{limits.microCeiling.toLocaleString('fr-FR')} {currencySymbol}</strong>
              </div>
            </div>

            {/* Visual Gauge */}
            <div className="space-y-2">
              <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full rounded-l-full transition-all duration-300 ${
                    totalRevenue >= limits.microCeiling ? 'bg-red-500' : microProgress > 80 ? 'bg-amber-400' : 'bg-purple-600'
                  }`}
                  style={{ width: `${Math.min((totalRevenue / limits.microCeiling) * 100, 100)}%` }}
                />
                {/* Simulated increase value */}
                {simulatedExtra > 0 && (
                  <div 
                    className="h-full bg-emerald-400 animate-pulse transition-all duration-300 rounded-r-full"
                    style={{ 
                      width: `${Math.min((simulatedRevenue / limits.microCeiling) * 100, 100) - Math.min((totalRevenue / limits.microCeiling) * 100, 100)}%` 
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                <span>{simulatedRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {currencySymbol} ({Math.min((simulatedRevenue / limits.microCeiling) * 100, 150).toFixed(0)}%)</span>
                <span>Max : {limits.microCeiling.toLocaleString('fr-FR')} {currencySymbol}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Dynamic Legal Alerts & Advisory Panel */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3 text-xs leading-relaxed text-slate-600">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <strong className="text-slate-800 font-bold block">Consignes Fiscales de Transition (Art. 293 B du CGI)</strong>
              <p>
                Si vous excédez le seuil de base ({limits.tvaBase.toLocaleString('fr-FR')} {currencySymbol}) mais restez sous le seuil majoré ({limits.tvaCeiling.toLocaleString('fr-FR')} {currencySymbol}) pendant deux ans consécutifs, vous perdez la franchise de TVA au 1er janvier de la 3ème année.
              </p>
              <p className="text-red-650 font-bold">
                ⚠️ En cas de franchissement immédiat du seuil majoré ({limits.tvaCeiling.toLocaleString('fr-FR')} {currencySymbol}), vous devez facturer et collecter la TVA dès le 1er jour du mois de dépassement.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3 text-xs leading-relaxed text-slate-600">
            <ShieldAlert className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1.5">
              <strong className="text-slate-800 font-bold block">Audit Prorata & Obligations de Facturation</strong>
              <div className="space-y-1.5 text-slate-500">
                <p>
                  En cas de début d'activité en cours d'année, les seuils sont ajustés <strong>prorata temporis</strong> au nombre de jours passés d'ouverture fiscale.
                </p>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-mono text-[10px]">
                  <span>Mention requise : "TVA non applicable, art. 293 B du CGI"</span>
                </div>
                {simulatedRevenue >= limits.tvaBase && (
                  <div className="flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 animate-pulse text-[11px]">
                    ⚠️ Seuil de franchise franchi sous simulation : vous devez configurer vos paramètres TVA à 20%.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>


      {/* 5. INTERACTIVE CHARTS SECTION (BENTO GRID STYLE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Revenue Evolution Chart - Last 6 months */}
        <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
           <h4 className="text-base font-extrabold text-slate-900">Évolution du CA (6 derniers mois)</h4>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={monthlyComparativeData.slice(-6)}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString('fr-FR')} ${currencySymbol}`} />
                 <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }} />
                 <Bar dataKey="Recettes" fill="#3b82f6" radius={[6, 6, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Dual Chart Area */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Analyse de Trésorerie Mensuelle</h4>
              <p className="text-xs text-slate-400">CA Net Encaissé vs Total des Frais rattachés par mois.</p>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Revenus</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span>Dépenses</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Marge</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyComparativeData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(val) => `${val.toLocaleString('fr-FR')} ${currencySymbol}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 12 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                    padding: '16px',
                    backgroundColor: 'white',
                    fontFamily: 'Inter'
                  }}
                  formatter={(value: number, name: string) => [`${value.toFixed(2)} ${currencySymbol}`, name]}
                />
                <Bar dataKey="Recettes" fill={tc.chartColor} radius={[6, 6, 0, 0]} barSize={16} />
                <Bar dataKey="Frais" fill="#f87171" radius={[6, 6, 0, 0]} barSize={16} />
                <Line type="monotone" dataKey="Marge" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 1 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Top distribution share */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Top Clients (CA Encaissé)</h4>
            <p className="text-xs text-slate-400 leading-normal">Abattez vos risques et déterminez vos meilleurs partenaires économiques.</p>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center">
            {topClientsData.length > 0 ? (
              <div className="w-full space-y-4">
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topClientsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {topClientsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }}
                        formatter={(val: number) => [`${val.toFixed(2)} ${currencySymbol}`, 'CA perçu']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {topClientsData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-slate-650 font-bold truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-950 font-mono">{item.value.toFixed(0)} {currencySymbol}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
                <UserCheck size={32} className="text-slate-300" />
                <p className="text-xs">Aucune facture payée archivée pour générer la répartition.</p>
              </div>
            )}
          </div>

          {/* Assistant Prompting banner */}
          <div className={`${tc.badge} p-4 rounded-2xl flex items-start gap-2.5`}>
            <Sparkles className={`${tc.text} shrink-0 mt-0.5`} size={14} />
            <p className="text-[10px] leading-normal font-semibold">
              Utilisez l'<strong>IA Assistant</strong> de la barre de navigation pour affiner vos prévisions fiscales et concevoir des offres tarifaires.
            </p>
          </div>
        </div>

      </div>

      {/* 6. BENTO QUICK ACTIONS */}
      <div className="space-y-4">
        <h4 className="text-base font-extrabold text-slate-900">Passerelles & Actions de raccourcis</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          
          <button 
            onClick={() => setView?.('invoices')}
            className={`p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md ${tc.bgHover.split(' ')[0]} group text-left transition-all duration-300 flex flex-col justify-between h-40`}
          >
            <div className={`p-3 ${tc.innerBg.split(' ')[0]} ${tc.text} rounded-2xl w-fit group-hover:scale-110 transition-transform`}>
              <FilePlus size={18} />
            </div>
            <div>
              <h5 className={`text-xs font-extrabold text-slate-900 group-hover:${tc.text} transition-colors`}>Nouvelle Facture</h5>
              <p className="text-[10px] text-slate-400 mt-1">Concevez vos factures Factur-X conformes 2026.</p>
            </div>
          </button>

          <button 
            onClick={() => setView?.('accounting')}
            className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-indigo-300 group text-left transition-all duration-300 flex flex-col justify-between h-40"
          >
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
              <TrendingDown size={18} />
            </div>
            <div>
              <h5 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">Ajouter un Frais</h5>
              <p className="text-[10px] text-slate-400 mt-1">Saisissez vos dépenses et archivez vos justificatifs.</p>
            </div>
          </button>

          <button 
            onClick={() => setView?.('clients')}
            className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-cyan-300 group text-left transition-all duration-300 flex flex-col justify-between h-40"
          >
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
              <UserPlus size={18} />
            </div>
            <div>
              <h5 className="text-xs font-extrabold text-slate-900 group-hover:text-cyan-600 transition-colors">Nouveau Client</h5>
              <p className="text-[10px] text-slate-400 mt-1">Gérez vos clients B2B et intégrez leurs numéros SIRET/TVA.</p>
            </div>
          </button>

          <button 
            onClick={() => setView?.('ppf')}
            className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-emerald-300 group text-left transition-all duration-300 flex flex-col justify-between h-40"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
              <Globe size={18} />
            </div>
            <div>
              <h5 className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">Passerelle PPF</h5>
              <p className="text-[10px] text-slate-400 mt-1">Gérez vos télétransmissions d'État et d'acquittement fiscal.</p>
            </div>
          </button>

          <button 
            onClick={() => setView?.('accounting')}
            className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-purple-300 group text-left transition-all duration-300 flex flex-col justify-between h-40 col-span-2 md:col-span-1"
          >
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
              <Landmark size={18} />
            </div>
            <div>
              <h5 className="text-xs font-extrabold text-slate-900 group-hover:text-purple-600 transition-colors">Grand Livre & FEC</h5>
              <p className="text-[10px] text-slate-400 mt-1">Exportez vos registres comptables conformes au fisc.</p>
            </div>
          </button>

        </div>
      </div>

      {/* 7. COMBINED DOUBLE FEED: REALTIME HISTORY & UNPAID BALANCES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Recent Realtime Activity Feed */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Activité Financière</h4>
              <p className="text-xs text-slate-400">Flux d'écritures récents (factures & charges).</p>
            </div>
            <button 
              onClick={() => setView?.('accounting')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 duration-300 text-[10px] font-bold text-slate-600 rounded-full flex items-center gap-1"
            >
              Livre Journal <ArrowRight size={10} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {chronologicalFeed.map((feed) => {
              const isSale = feed.type === 'sale';
              return (
                <div 
                  key={feed.id} 
                  className="flex justify-between items-center p-3 rounded-2xl border border-slate-105 hover:bg-slate-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      isSale ? 'bg-emerald-50 text-emerald-600 lg:group-hover:scale-105' : 'bg-red-50 text-red-500 lg:group-hover:scale-105'
                    } duration-300`}>
                      {isSale ? <Landmark size={15} /> : <ShoppingBag size={15} />}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">{feed.title}</h5>
                      <span className="text-[10px] text-slate-400 font-medium">{feed.detail}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-extrabold font-mono ${isSale ? 'text-emerald-605' : 'text-slate-850'}`}>
                      {isSale ? '+' : '-'}{Math.abs(feed.amount).toFixed(0)} {currencySymbol}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium block font-mono">
                      {new Date(feed.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {chronologicalFeed.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-450 text-center space-y-1.5 py-12">
                <Activity size={24} className="text-slate-300" />
                <span className="text-xs font-semibold">Aucune écriture comptabilisée pour l'instant.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Unpaid Invoices detailed oversight */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Relance clients & Contentieux</h4>
              <p className="text-xs text-slate-400 font-medium">Factures envoyées en attente légale d'acquittement fiscal.</p>
            </div>
            <span className="text-[10px] font-bold text-orange-650 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
              Délai de règlement
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {invoices
              .filter(inv => (inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT) && (inv.type === 'invoice' || !inv.type))
              .map(inv => {
                const clientName = clients.find(c => c.id === inv.clientId)?.name || 'Client Inconnu';
                const isOverdue = new Date(inv.dueDate) < new Date();
                return (
                  <div 
                    key={inv.id} 
                    className={`flex justify-between items-center p-3.5 rounded-2xl border transition-all ${
                      isOverdue ? 'bg-red-50/10 border-red-100' : 'bg-slate-50/40 border-slate-150'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">{inv.number}</span>
                        {isOverdue && (
                          <span className="text-[9px] font-bold text-red-650 bg-red-50 border border-red-100 rounded px-1.5 px-0.5 uppercase tracking-wide">
                            En Retard
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-normal">
                        Client : <strong>{clientName}</strong> • Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-950 font-mono block">
                        {inv.total.toFixed(0)} {currencySymbol}
                      </span>
                      <button 
                        onClick={() => setView?.('invoices')}
                        className="text-[9px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-1"
                      >
                        Encaisser <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {invoices.filter(inv => (inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT) && (inv.type === 'invoice' || !inv.type)).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-450 text-center space-y-1.5 py-12">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Toutes vos factures ont été encaissées !</span>
                <p className="text-[10px] text-slate-400 max-w-[200px]">Votre trésorerie professionnelle est saine et à jour.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
