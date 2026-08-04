import React, { useState, useMemo } from 'react';
import { Expense, Invoice, InvoiceStatus, Supplier, UserProfile, Client } from '../types';
import { 
  Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, 
  PieChart as PieChartIcon, FileDown, Info, Calculator, Coins, 
  Search, Filter, CheckCircle2, AlertCircle, BookOpen, Download, 
  Briefcase, ArrowUpRight, ArrowDownRight, Layers, Table,
  Upload, Sparkles, RefreshCw, Copy, FileText, Check,
  Printer, FileSpreadsheet, Landmark, Lightbulb, ShieldCheck,
  Activity, ExternalLink
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeReceiptOCR } from '../services/geminiService';
import { parseBankCsv, parseBankOfx, reconcileTransaction } from '../services/bankReconciliationService';

interface AccountingManagerProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  invoices: Invoice[];
  setInvoices?: (invoices: Invoice[]) => void;
  suppliers: Supplier[];
  userProfile?: UserProfile;
  clients?: Client[];
}

export const AccountingManager: React.FC<AccountingManagerProps> = ({ 
  expenses, 
  setExpenses, 
  invoices, 
  setInvoices,
  suppliers, 
  userProfile,
  clients = [] 
}) => {
  // Tabs: 'bilan', 'journal', 'rapprochement', 'simulateur', 'urssaf'
  const [activeTab, setActiveTab] = useState<'bilan' | 'journal' | 'rapprochement' | 'simulateur' | 'urssaf'>('bilan');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  
  // Custom states for our new features
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<'recettes' | 'depenses'>('recettes');
  const [printYear, setPrintYear] = useState<number>(2026);

  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [matchingStatusMsg, setMatchingStatusMsg] = useState<string | null>(null);

  const [taxRegime, setTaxRegime] = useState<'liberatoire' | 'classic'>('liberatoire');
  const [taxSlabTMI, setTaxSlabTMI] = useState<number>(11); // TMI Slider: 0, 11, 30, 41, 45%
  
  // Advanced Activity Sectors Configuration (Reforme 2026/2027)
  const [activityType, setActivityType] = useState<'services' | 'goods'>('services');
  const [urssafPeriod, setUrssafPeriod] = useState<'monthly' | 'quarterly'>('monthly');
  const [journalFilter, setJournalFilter] = useState<'all' | 'recettes' | 'depenses'>('all');
  const [journalSearch, setJournalSearch] = useState('');

  // Interactive URSSAF declaration states
  const [selectedUrssafMonth, setSelectedUrssafMonth] = useState<string>('Janvier');
  const [selectedUrssafQuarter, setSelectedUrssafQuarter] = useState<string>('Q1');
  const [optInLiberatoire, setOptInLiberatoire] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State for Expense
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: 'Achats',
    supplierId: ''
  });

  // OCR Processing state for Receipts (IA Integration)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processReceiptFile = async (file: File) => {
    if (!file) return;

    setOcrLoading(true);
    setOcrError(null);
    setOcrSuccess(false);

    try {
      // Create a local object URL to display the image immediately
      const previewUrl = URL.createObjectURL(file);
      setReceiptPreview(previewUrl);

      // Read file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          if (!reader.result) {
            throw new Error("Impossible de lire le contenu du justificatif.");
          }
          const base64String = (reader.result as string).split(',')[1];
          const result = await analyzeReceiptOCR(
            base64String,
            file.type,
            userProfile?.aiGeminiApiKey || userProfile?.aiApiKey,
            userProfile ? { gemini: userProfile.aiGeminiApiKey } : undefined
          );

          if (result) {
            setNewExpense(prev => ({
              ...prev,
              date: result.date || prev.date,
              amount: result.amount !== undefined ? result.amount : prev.amount,
              category: result.category || prev.category,
              description: result.description || prev.description,
              supplierId: suppliers.find(s => s.name.toLowerCase().includes((result.supplierName || '').toLowerCase()))?.id || prev.supplierId
            }));
            
            // If the supplier was extracted but doesn't exist yet, we append Supplier to description for better tracking
            if (result.supplierName && !suppliers.some(s => s.name.toLowerCase().includes((result.supplierName || '').toLowerCase()))) {
              setNewExpense(prev => ({
                ...prev,
                description: `${result.description || ''} (Fournisseur: ${result.supplierName})`
              }));
            }

            setOcrSuccess(true);
          }
        } catch (err: any) {
          console.error(err);
          setOcrError(err.message || "Erreur lors de l'analyse OCR.");
        } finally {
          setOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setOcrLoading(false);
      setOcrError("Échec du chargement du fichier justificatif.");
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processReceiptFile(file);
  };

  // --- ADD EXPENSE PROCESS ---
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    const expense: Expense = {
      id: Date.now().toString(),
      date: newExpense.date!,
      description: newExpense.description,
      amount: Number(newExpense.amount),
      category: newExpense.category!,
      supplierId: newExpense.supplierId
    };

    setExpenses([expense, ...expenses]);
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      category: 'Achats',
      supplierId: ''
    });
    setOcrSuccess(false);
    setOcrError(null);
    setReceiptPreview(null);
    setShowExpenseForm(false);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette dépense ?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  // --- STATISTIQUES GLOBALES ---
  const totalRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'Payée' || inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + inv.total, 0);
  }, [invoices]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const netResult = totalRevenue - totalExpenses;

  // Dyn calculations for URSSAF estimations
  const customChargesRate = userProfile?.customChargesRate !== undefined ? userProfile.customChargesRate : (activityType === 'services' ? 21.1 : 12.3);
  const estimatedCharges = totalRevenue * (customChargesRate / 100);
  const netAfterCharges = netResult - estimatedCharges;
  const currencySymbol = userProfile?.currencySymbol || '€';

  // --- LEGAL CEILINGS (Reforme Fiscalité Auto-entreprise 2026/2027) with Prorata Temporis ---
  const limits = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let prorataRatio = 1;
    let daysOfActivity = 365;
    let isProrated = false;

    if (userProfile?.acreStartDate) {
      const startDate = new Date(userProfile.acreStartDate);
      const startYear = startDate.getFullYear();
      
      // Si l'immatriculation est survenue durant l'année civile en cours
      if (startYear === currentYear) {
        const endOfYear = new Date(currentYear, 11, 31); // 31 décembre
        const diffTime = Math.abs(endOfYear.getTime() - startDate.getTime());
        daysOfActivity = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour même
        prorataRatio = Math.max(0.01, Math.min(1, daysOfActivity / 365));
        isProrated = prorataRatio < 1;
      }
    }

    const baseLimits = activityType === 'services' ? {
      microCeiling: 77700,
      tvaCeiling: 39100,
      tvaBase: 36800,
      label: 'Prestation de Services / BNC',
      urssafDefaultRate: 21.1
    } : {
      microCeiling: 188700,
      tvaCeiling: 101000,
      tvaBase: 91900,
      label: 'Multi-activités / Marchandises / BIC',
      urssafDefaultRate: 12.3
    };

    return {
      microCeiling: Math.round(baseLimits.microCeiling * prorataRatio),
      tvaCeiling: Math.round(baseLimits.tvaCeiling * prorataRatio),
      tvaBase: Math.round(baseLimits.tvaBase * prorataRatio),
      label: baseLimits.label,
      urssafDefaultRate: baseLimits.urssafDefaultRate,
      daysOfActivity,
      prorataRatio,
      isProrated
    };
  }, [activityType, userProfile?.acreStartDate]);

  // Percentages relative to ceilings
  const isCloseToTva = totalRevenue >= limits.tvaBase;
  const isOverTva = totalRevenue >= limits.tvaCeiling;
  const isOverMicro = totalRevenue >= limits.microCeiling;

  const tvaProgress = Math.min((totalRevenue / limits.tvaCeiling) * 100, 100);
  const microProgress = Math.min((totalRevenue / limits.microCeiling) * 100, 100);

  // --- DÉPENSES PAR CATÉGORIE ---
  const expensesByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Autre';
      data[cat] = (data[cat] || 0) + exp.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  // --- UNIFIED DOUBLE-CHRONOLOGICAL LEDGER (Livre des Recettes & Achats) ---
  const ledgerItems = useMemo(() => {
    const recettes = invoices
      .filter(inv => inv.status === 'Payée' || inv.status === InvoiceStatus.PAID)
      .map(inv => {
        const clientObj = clients.find(c => c.id === inv.clientId);
        return {
          id: inv.id,
          date: inv.date,
          type: 'recette' as const,
          ref: inv.number,
          label: `Facture client - ${clientObj?.name || 'Client Inconnu'}`,
          category: 'Ventes / Prestations',
          amount: inv.total,
          paymentMethod: 'Virement / Carte'
        };
      });

    const depenseItems = expenses.map(exp => {
      const suppObj = suppliers.find(s => s.id === exp.supplierId);
      return {
        id: exp.id,
        date: exp.date,
        type: 'depense' as const,
        ref: `DEP-${exp.id.slice(-5)}`,
        label: exp.description + (suppObj ? ` (Fournisseur: ${suppObj.name})` : ''),
        category: exp.category,
        amount: exp.amount,
        paymentMethod: 'Prélèvement / CB'
      };
    });

    const combined = [...recettes, ...depenseItems];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, expenses, clients, suppliers]);

  // Search & Filtered ledger items
  const filteredLedger = useMemo(() => {
    return ledgerItems.filter(item => {
      const matchesType = journalFilter === 'all' || 
        (journalFilter === 'recettes' && item.type === 'recette') || 
        (journalFilter === 'depenses' && item.type === 'depense');

      const matchesSearch = journalSearch === '' || 
        item.ref.toLowerCase().includes(journalSearch.toLowerCase()) ||
        item.label.toLowerCase().includes(journalSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(journalSearch.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [ledgerItems, journalFilter, journalSearch]);

  // --- URSSAF CALCULATOR BREAKDOWN BY PERIOD ---
  const urssafBreakdown = useMemo(() => {
    const dates = filteredLedger.filter(i => i.type === 'recette');
    const quarters: Record<string, number> = { 'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0 };
    const months: Record<string, number> = {};

    // Initializing months for active year
    for (let i = 1; i <= 12; i++) {
      const monthLabel = new Date(2026, i - 1, 1).toLocaleString('fr-FR', { month: 'long' });
      months[monthLabel] = 0;
    }

    dates.forEach(item => {
      const d = new Date(item.date);
      const m = d.getMonth(); // 0-11
      const quarter = `Q${Math.floor(m / 3) + 1}`;
      quarters[quarter] = (quarters[quarter] || 0) + item.amount;

      const monthLabel = d.toLocaleString('fr-FR', { month: 'long' });
      months[monthLabel] = (months[monthLabel] || 0) + item.amount;
    });

    return {
      quarters,
      months,
      estimatedAnnualTax: estimatedCharges
    };
  }, [filteredLedger, estimatedCharges]);

  // Compute paid invoices for the actively selected month or quarter
  const paidInvoicesInSelectedPeriod = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status !== 'Payée' && inv.status !== InvoiceStatus.PAID) return false;
      const d = new Date(inv.date);
      const year = d.getFullYear();
      
      if (urssafPeriod === 'monthly') {
        const monthLabel = d.toLocaleString('fr-FR', { month: 'long' });
        return monthLabel.toLowerCase() === selectedUrssafMonth.toLowerCase();
      } else {
        const m = d.getMonth();
        const quarter = `Q${Math.floor(m / 3) + 1}`;
        return quarter === selectedUrssafQuarter;
      }
    });
  }, [invoices, urssafPeriod, selectedUrssafMonth, selectedUrssafQuarter]);

  // Split selected period's revenue into the 3 official French URSSAF auto-entrepreneur categories
  const urssafSums = useMemo(() => {
    let sales = 0;        // Vente de marchandises (BIC 12.3% or similar depending on options)
    let serviceBic = 0;   // Prestations de services artisanales et commerciales (BIC 21.2%)
    let serviceBnc = 0;   // Autres prestations de services et professions libérales (BNC 21.1%)

    paidInvoicesInSelectedPeriod.forEach(inv => {
      if (inv.operationType === 'goods') {
        sales += inv.total;
      } else if (inv.operationType === 'services') {
        if (userProfile?.activityType === 'services_liberal') {
          serviceBnc += inv.total;
        } else {
          serviceBic += inv.total;
        }
      } else {
        // Fallback checks on items or userProfile default
        if (userProfile?.activityType === 'services_liberal') {
          serviceBnc += inv.total;
        } else if (userProfile?.activityType === 'sales') {
          sales += inv.total;
        } else {
          serviceBic += inv.total;
        }
      }
    });

    return { sales, serviceBic, serviceBnc };
  }, [paidInvoicesInSelectedPeriod, userProfile]);

  const handleCopyToClipboard = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // --- CSV / FEC EXPORT SERVICE ---
  const exportCSV = (type: 'fec' | 'recettes' | 'recettes_filtre' | 'depenses' | 'depenses_filtre' | 'grand_livre' | 'grand_livre_filtre' | 'urssaf') => {
    if (type === 'fec') {
      // Official FEC (Fichier des Ecritures Comptables) formatted as flat text delimited by tabulations (\t)
      // Conforming to specifications from French Tax Authority (DGFiP / LPF Article A. 47 A-1)
      const headers = [
        "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
        "CompteAuxNum", "CompteAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
        "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Devise"
      ];
      
      const formatFECNumber = (num: number): string => {
        return num.toFixed(2).replace('.', ',');
      };
      
      const formatFECDate = (dateStr: string): string => {
        if (!dateStr) return '';
        return dateStr.replace(/[-]/g, '').slice(0, 8);
      };

      let fecRows: string[] = [];
      fecRows.push(headers.join("\t"));

      // Chronological sort
      const chronologicalItems = [...ledgerItems].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      chronologicalItems.forEach((item, index) => {
        const dateStr = formatFECDate(item.date);
        const ecritureNum = `ECR-${index + 1}`;
        const isRecette = item.type === 'recette';

        if (isRecette) {
          // Double-entry balancing entries:
          // Entry 1: Income account (706000/707000) Credit
          const productCompte = item.category?.toLowerCase().includes('marchandise') || item.category?.toLowerCase().includes('goods') ? "707000" : "706000";
          const productLib = productCompte === "707000" ? "Ventes de marchandises" : "Prestations de services";
          
          const row1 = [
            "VT",                                 // JournalCode
            "Journal de Ventes",                  // JournalLib
            ecritureNum,                          // EcritureNum
            dateStr,                              // EcritureDate
            productCompte,                        // CompteNum
            productLib,                           // CompteLib
            "",                                   // CompteAuxNum
            "",                                   // CompteAuxLib
            item.ref,                             // PieceRef
            dateStr,                              // PieceDate
            item.label,                           // EcritureLib
            "0,00",                               // Debit
            formatFECNumber(item.amount),         // Credit
            "",                                   // EcritureLet
            "",                                   // DateLet
            dateStr,                              // ValidDate
            "0,00",                               // Montantdevise
            "EUR"                                 // Devise
          ];

          // Entry 2: Bank account (512000) Debit
          const row2 = [
            "BQ",                                 // JournalCode
            "Journal de Banque",                  // JournalLib
            ecritureNum,                          // EcritureNum
            dateStr,                              // EcritureDate
            "512000",                             // CompteNum
            "Valeurs en banque",                  // CompteLib
            "",                                   // CompteAuxNum
            "",                                   // CompteAuxLib
            item.ref,                             // PieceRef
            dateStr,                              // PieceDate
            item.label,                           // EcritureLib
            formatFECNumber(item.amount),         // Debit
            "0,00",                               // Credit
            "",                                   // EcritureLet
            "",                                   // DateLet
            dateStr,                              // ValidDate
            "0,00",                               // Montantdevise
            "EUR"                                 // Devise
          ];

          fecRows.push(row1.join("\t"));
          fecRows.push(row2.join("\t"));
        } else {
          // Double-entry balancing entries for expenses:
          // Entry 1: Charge account (Class 6) Debit
          let chargeCompte = "606000";
          let chargeLib = "Achats non stockés de matières";

          const categoryLower = item.category?.toLowerCase() || "";
          if (categoryLower.includes("marchandise")) {
            chargeCompte = "607000";
            chargeLib = "Achats de marchandises";
          } else if (categoryLower.includes("sous-traitance")) {
            chargeCompte = "611000";
            chargeLib = "Sous-traitance générale";
          } else if (categoryLower.includes("déplacement") || categoryLower.includes("transport") || categoryLower.includes("voyage")) {
            chargeCompte = "625100";
            chargeLib = "Voyages et déplacements";
          } else if (categoryLower.includes("bancaire") || categoryLower.includes("banque")) {
            chargeCompte = "627000";
            chargeLib = "Services bancaires";
          } else if (categoryLower.includes("abonnement") || categoryLower.includes("logiciel") || categoryLower.includes("saas")) {
            chargeCompte = "651500";
            chargeLib = "Licences et logiciels (SaaS)";
          } else if (categoryLower.includes("impôt") || categoryLower.includes("taxe") || categoryLower.includes("urssaf") || categoryLower.includes("cotisation")) {
            chargeCompte = "630000";
            chargeLib = "Impôts, taxes et versements assimilés";
          }

          const row1 = [
            "HA",                                 // JournalCode
            "Journal des Achats",                 // JournalLib
            ecritureNum,                          // EcritureNum
            dateStr,                              // EcritureDate
            chargeCompte,                         // CompteNum
            chargeLib,                            // CompteLib
            "",                                   // CompteAuxNum
            "",                                   // CompteAuxLib
            item.ref,                             // PieceRef
            dateStr,                              // PieceDate
            item.label,                           // EcritureLib
            formatFECNumber(item.amount),         // Debit
            "0,00",                               // Credit
            "",                                   // EcritureLet
            "",                                   // DateLet
            dateStr,                              // ValidDate
            "0,00",                               // Montantdevise
            "EUR"                                 // Devise
          ];

          // Entry 2: Bank account (512000) Credit
          const row2 = [
            "BQ",                                 // JournalCode
            "Journal de Banque",                  // JournalLib
            ecritureNum,                          // EcritureNum
            dateStr,                              // EcritureDate
            "512000",                             // CompteNum
            "Valeurs en banque",                  // CompteLib
            "",                                   // CompteAuxNum
            "",                                   // CompteAuxLib
            item.ref,                             // PieceRef
            dateStr,                              // PieceDate
            item.label,                           // EcritureLib
            "0,00",                               // Debit
            formatFECNumber(item.amount),         // Credit
            "",                                   // EcritureLet
            "",                                   // DateLet
            dateStr,                              // ValidDate
            "0,00",                               // Montantdevise
            "EUR"                                 // Devise
          ];

          fecRows.push(row1.join("\t"));
          fecRows.push(row2.join("\t"));
        }
      });

      // Prepare text content on line endings
      const fecContent = fecRows.join("\r\n");

      // Generate filename according to French administration: <SIREN>FEC<AAAAMMJJ>.txt
      const rawSiret = userProfile?.siret || "123456789";
      const siren = rawSiret.replace(/\D/g, '').slice(0, 9).padEnd(9, '0');
      const closingDate = `${new Date().getFullYear()}1231`;
      const filename = `${siren}FEC${closingDate}.txt`;

      // Export using modern Blob downloader
      const blob = new Blob([fecContent], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    let csvContent = "";
    let downloadFilename = "";

    // Helper to escape values for CSV
    const escapeCSVValue = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape double quotes and enclose string if it contains separator, newline, or quotes
      if (str.includes(";") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (type === 'recettes' || type === 'recettes_filtre') {
      const itemsToExport = type === 'recettes' 
        ? ledgerItems.filter(item => item.type === 'recette')
        : filteredLedger.filter(item => item.type === 'recette');

      const headers = ["Date de l'encaissement", "Référence de pièce", "Nom du client / Intitulé", "Nature de la prestation ou vente", "Montant perçu (TTC)", "Mode de règlement", "Devise"];
      csvContent += headers.map(escapeCSVValue).join(";") + "\n";

      itemsToExport.forEach(item => {
        const row = [
          item.date,
          item.ref,
          item.label.replace('Facture client - ', ''),
          item.category,
          item.amount.toFixed(2).replace('.', ','), // French decimal format
          item.paymentMethod,
          "EUR"
        ];
        csvContent += row.map(escapeCSVValue).join(";") + "\n";
      });

      downloadFilename = `${type}_export_${activityType}_2026.csv`;

    } else if (type === 'depenses' || type === 'depenses_filtre') {
      const itemsToExport = type === 'depenses'
        ? ledgerItems.filter(item => item.type === 'depense')
        : filteredLedger.filter(item => item.type === 'depense');

      const headers = ["Date de l'opération", "Référence de pièce", "Désignation de la dépense", "Catégorie d'achat", "Montant décaissé (TTC)", "Mode de paiement", "Devise"];
      csvContent += headers.map(escapeCSVValue).join(";") + "\n";

      itemsToExport.forEach(item => {
        const row = [
          item.date,
          item.ref,
          item.label,
          item.category,
          item.amount.toFixed(2).replace('.', ','), // French decimal format
          item.paymentMethod,
          "EUR"
        ];
        csvContent += row.map(escapeCSVValue).join(";") + "\n";
      });

      downloadFilename = `${type}_export_${activityType}_2026.csv`;

    } else if (type === 'grand_livre' || type === 'grand_livre_filtre') {
      const itemsToExport = type === 'grand_livre' ? ledgerItems : filteredLedger;

      const headers = ["Date d'opération", "Type de flux", "Référence de pièce", "Désignation / Tiers", "Catégorie", "Mode de règlement", "Débit (Dépenses / EUR)", "Crédit (Recettes / EUR)"];
      csvContent += headers.map(escapeCSVValue).join(";") + "\n";

      itemsToExport.forEach(item => {
        const isRecette = item.type === 'recette';
        const row = [
          item.date,
          isRecette ? "Recette" : "Dépense",
          item.ref,
          isRecette ? item.label.replace('Facture client - ', '') : item.label,
          item.category,
          item.paymentMethod,
          isRecette ? "" : item.amount.toFixed(2).replace('.', ','),
          isRecette ? item.amount.toFixed(2).replace('.', ',') : ""
        ];
        csvContent += row.map(escapeCSVValue).join(";") + "\n";
      });

      downloadFilename = `${type}_export_general_2026.csv`;

    } else if (type === 'urssaf') {
      const periodLabel = urssafPeriod === 'monthly' ? `${selectedUrssafMonth} 2026` : `${selectedUrssafQuarter} 2026`;
      
      csvContent += escapeCSVValue("DOCUMENT DE SYNTHÈSE - PRÉPARATION À LA DÉCLARATION DE CHIFFRE D'AFFAIRES URSSAF") + "\n";
      csvContent += `Généré le;${escapeCSVValue(new Date().toLocaleDateString('fr-FR'))}\n`;
      csvContent += `Période d'activité déclarée;${escapeCSVValue(periodLabel)}\n`;
      csvContent += `Option versement libératoire de l'impôt;${escapeCSVValue(optInLiberatoire ? "OUI" : "NON")}\n\n`;

      csvContent += ["Activité ou nature de recettes", "Chiffre d'Affaires Brut (EUR)", "Taux Cotisations Sociales", "Cotisations Sociales Estimées (EUR)", "Taux Impôt Libératoire", "Impôt Libératoire Estimé (EUR)", "Total à Payer Estimé (EUR)"].map(escapeCSVValue).join(";") + "\n";

      // Ventes de marchandises
      const salesSoc = urssafSums.sales * 0.123;
      const salesTax = optInLiberatoire ? urssafSums.sales * 0.01 : 0;
      csvContent += [
        "Ventes de marchandises (BIC)",
        urssafSums.sales.toFixed(2).replace('.', ','),
        "12,3%",
        salesSoc.toFixed(2).replace('.', ','),
        optInLiberatoire ? "1,0%" : "0,0%",
        salesTax.toFixed(2).replace('.', ','),
        (salesSoc + salesTax).toFixed(2).replace('.', ',')
      ].map(escapeCSVValue).join(";") + "\n";

      // Svc BIC
      const bicSoc = urssafSums.serviceBic * 0.212;
      const bicTax = optInLiberatoire ? urssafSums.serviceBic * 0.017 : 0;
      csvContent += [
        "Prestations de services commerciales ou artisanales (BIC)",
        urssafSums.serviceBic.toFixed(2).replace('.', ','),
        "21,2%",
        bicSoc.toFixed(2).replace('.', ','),
        optInLiberatoire ? "1,7%" : "0,0%",
        bicTax.toFixed(2).replace('.', ','),
        (bicSoc + bicTax).toFixed(2).replace('.', ',')
      ].map(escapeCSVValue).join(";") + "\n";

      // Svc BNC
      const bncSoc = urssafSums.serviceBnc * 0.211;
      const bncTax = optInLiberatoire ? urssafSums.serviceBnc * 0.022 : 0;
      csvContent += [
        "Autres prestations de services / Professions libérales (BNC)",
        urssafSums.serviceBnc.toFixed(2).replace('.', ','),
        "21,1%",
        bncSoc.toFixed(2).replace('.', ','),
        optInLiberatoire ? "2,2%" : "0,0%",
        bncTax.toFixed(2).replace('.', ','),
        (bncSoc + bncTax).toFixed(2).replace('.', ',')
      ].map(escapeCSVValue).join(";") + "\n\n";

      // Total row
      const caTotal = urssafSums.sales + urssafSums.serviceBic + urssafSums.serviceBnc;
      const socTotal = salesSoc + bicSoc + bncSoc;
      const taxTotal = salesTax + bicTax + bncTax;
      const payTotal = socTotal + taxTotal;

      csvContent += [
        "TOTAL DE LA PÉRIODE DE DÉCLARATION",
        caTotal.toFixed(2).replace('.', ','),
        "-",
        socTotal.toFixed(2).replace('.', ','),
        "-",
        taxTotal.toFixed(2).replace('.', ','),
        payTotal.toFixed(2).replace('.', ',')
      ].map(escapeCSVValue).join(";") + "\n";

      downloadFilename = `declaration_urssaf_${periodLabel.replace(/\s/g, '_')}.csv`;
    }

    // Modern Blob and URL construction with UTF-8 BOM (Byte Order Mark) so Excel opens it with French accents perfectly
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", downloadFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* HEADER SECTION WITH NAVIGATION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b border-slate-150/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-2xl shadow-md">
              <Briefcase size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">Comptabilité & Trésorerie</h2>
              <p className="text-slate-400 text-sm">Contrôle fiscal, cotisations URSSAF et tenue réglementaire des livres d'auto-entrepreneur.</p>
            </div>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200/60 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('bilan')}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'bilan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-transparent'}`}
          >
            <PieChartIcon size={16} />
            Bilan & Seuils
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'journal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-transparent'}`}
          >
            <BookOpen size={16} />
            Livre Journal
          </button>
          <button 
            onClick={() => setActiveTab('rapprochement')}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'rapprochement' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-transparent'}`}
          >
            <RefreshCw size={16} />
            Rapprochement Bancaire
          </button>
          <button 
            onClick={() => setActiveTab('simulateur')}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'simulateur' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-transparent'}`}
          >
            <Coins size={16} />
            Marge & Impôts
          </button>
          <button 
            onClick={() => setActiveTab('urssaf')}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'urssaf' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-transparent'}`}
          >
            <Calculator size={16} />
            Déclarations URSSAF
          </button>
        </div>
      </div>

      {/* TAB I: BILAN & CEILINGS */}
      {activeTab === 'bilan' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* CRITICAL STATE CARD (Activity Selection) */}
          <div className="bg-slate-100/50 rounded-[2rem] p-6 border border-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-blue-600 tracking-wider bg-blue-50 border border-blue-100 rounded px-2 py-0.5 uppercase">Configuration Fiscale</span>
              <h4 className="text-base font-bold text-slate-800">Secteur principal & Régime légal de l'entreprise</h4>
              <p className="text-xs text-slate-400">Le type d'activité détermine les abattements d'impôts, limites de TVA et charges sociales applicables.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button 
                onClick={() => setActivityType('services')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${activityType === 'services' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                Prestations de Services / Libéral
              </button>
              <button 
                onClick={() => setActivityType('goods')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${activityType === 'goods' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                Vente de Marchandises / Logement
              </button>
            </div>
          </div>

          {/* DYNAMIC KPI BOARD */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-150/60 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp size={80} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recettes encaissées</p>
              <h3 className="text-3xl font-extrabold text-slate-900 font-mono mt-2">{totalRevenue.toFixed(2)} {currencySymbol}</h3>
              <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md mt-3">
                  <ArrowUpRight size={10} /> Chiffre d'Affaires Réel
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-150/60 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingDown size={80} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Achats & Frais payés</p>
              <h3 className="text-3xl font-extrabold text-slate-900 font-mono mt-2">{totalExpenses.toFixed(2)} {currencySymbol}</h3>
              <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-100/50 px-2 py-0.5 rounded-md mt-3">
                  <ArrowDownRight size={10} /> Compte de Charges
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-[2rem] shadow-xl shadow-slate-950/10 relative overflow-hidden">
              <div className="absolute bottom-[-10px] right-[-10px] p-2 opacity-10">
                  <Coins size={120} />
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Résultat d'Exploitation</p>
              <h3 className="text-3xl font-extrabold font-mono mt-2">{netResult.toFixed(2)} {currencySymbol}</h3>
              <p className="text-[10px] text-slate-400 mt-3 font-medium">Bénéfice brut d'activité (Marge)</p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-150/60 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-blue-500">
                  <Info size={16} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bénéfice Net Estimé</p>
              <h3 className="text-3xl font-extrabold text-blue-600 font-mono mt-2">{netAfterCharges.toFixed(0)} {currencySymbol}</h3>
              <p className="text-[10px] text-slate-400 leading-normal mt-2">
                Après prélèvement approx. de <strong className="text-slate-600 font-mono">{estimatedCharges.toFixed(0)} {currencySymbol}</strong> d'URSSAF ({customChargesRate}%)
              </p>
            </div>
          </div>

          {/* FISCAL THRESHOLDS PANEL (Exclusivité Réforme 2026/2027) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* THRESHOLD GAUGE I: VAT BASE EXEMPTION */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200/85 shadow-sm space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 uppercase tracking-wide">TVA Franco-Française</span>
                    {limits.isProrated && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        Prorata appliqué
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">Limite de la Franchise en Base</h4>
                  <p className="text-xs text-slate-400">Au-delà de {limits.tvaCeiling.toLocaleString()} {currencySymbol}, vous devez obligatoirement facturer et collecter la TVA.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Plafond</span>
                  <strong className="text-sm text-slate-800 font-mono">{limits.tvaCeiling.toLocaleString()} {currencySymbol}</strong>
                </div>
              </div>

              {/* Progress visual */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isOverTva ? 'bg-red-500' : isCloseToTva ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${tvaProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Encaissé : {totalRevenue.toFixed(0)} {currencySymbol} ({Math.round(tvaProgress)}%)</span>
                  <span>Tolérance dès {limits.tvaBase.toLocaleString()} {currencySymbol}</span>
                </div>
              </div>

              {limits.isProrated && (
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 text-[11px] text-indigo-700 leading-relaxed">
                  <strong>Calcul au Prorata Temporis :</strong> Votre date de début d'activité étant fixée au {new Date(userProfile?.acreStartDate || '').toLocaleDateString('fr-FR')}, vos plafonds de franchise de TVA pour cette première année sont ajustés sur la base de {limits.daysOfActivity} jours d'activité réels (Plafond initial complet : {activityType === 'services' ? '39 100' : '101 000'} {currencySymbol}).
                </div>
              )}

              {/* Warnings and compliance */}
              {isOverTva ? (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="text-xs font-bold text-red-800">Seuil de tolérance dépassé !</h5>
                    <p className="text-[11px] text-red-600 leading-normal mt-0.5">
                      Vous avez franchi le plafond de franchise de TVA. Dès le premier jour du mois de dépassement, vous devez mettre à jour votre profil pour inclure votre numéro de TVA intracommunautaire et modifier vos factures en conséquence.
                    </p>
                  </div>
                </div>
              ) : isCloseToTva ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="text-xs font-bold text-amber-800">Seuil de tolérance en cours (Seuils 2026/2027)</h5>
                    <p className="text-[11px] text-amber-600 leading-normal mt-0.5">
                      Le chiffre d'affaires cumulé se rapproche de la franchise transitoire de {limits.tvaBase.toLocaleString()} {currencySymbol}. Préparez votre demande de numéro intracommunautaire au SIE.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800">Situation conforme : Sans TVA</h5>
                    <p className="text-[11px] text-emerald-600 mt-0.5 leading-normal">
                      Vos encaissements cumulés vous permettent de bénéficier du dispositif transitoire de franchise. Vos factures doivent comporter la mention légale "TVA non applicable, art. 293 B du CGI".
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* THRESHOLD GAUGE II: MICRO-ENTERPRISE STATUS LIMIT */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200/85 shadow-sm space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 uppercase tracking-wide">Plat-Plafond Micro-DGFIP</span>
                    {limits.isProrated && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        Prorata appliqué
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">Indice de maintien du régime</h4>
                  <p className="text-xs text-slate-400">La limite légale annuelle pour le statut d'auto-entrepreneur est fixée à {limits.microCeiling.toLocaleString()} {currencySymbol}.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Auto-Plafond</span>
                  <strong className="text-sm text-slate-800 font-mono">{limits.microCeiling.toLocaleString()} {currencySymbol}</strong>
                </div>
              </div>

              {/* Progress visual */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isOverMicro ? 'bg-red-500' : microProgress > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${microProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Encaissé : {totalRevenue.toFixed(0)} {currencySymbol} ({Math.round(microProgress)}%)</span>
                  <span>Maximale : {limits.microCeiling.toLocaleString()} {currencySymbol}</span>
                </div>
              </div>

              {limits.isProrated && (
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 text-[11px] text-indigo-700 leading-relaxed">
                  <strong>Calcul au Prorata Temporis :</strong> Votre plafond de chiffre d'affaires maximal de la micro-entreprise pour cette première année est recalculé au prorata de votre temps réel d'activité de {limits.daysOfActivity} jours (Plafond initial complet : {activityType === 'services' ? '77 700' : '188 700'} {currencySymbol}).
                </div>
              )}

              {/* Compliance messaging */}
              {isOverMicro ? (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={16} />
                  <div>
                    <h5 className="text-xs font-bold text-red-800">Franchissement du statut réglementé</h5>
                    <p className="text-[11px] text-red-600 leading-normal mt-0.5">
                      Si vous dépassez ce plafond de chiffre d'affaires deux années consécutives, vous basculez automatiquement dans le régime réel d'imposition (Entreprise Individuelle classique ou Société).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <Info className="text-slate-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">Sécurité du statut assurée</h5>
                    <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                      Votre Chiffre d'Affaire est maîtrisé. Vous restez couvert à 100% par le régime simplifié des micro-entreprises avec abattement forfaitaire simplifié de vos frais administratifs.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* DISTRIBUTION OF EXPENSES CHARTS AND PIE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visual Pie */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-150/60 shadow-sm lg:col-span-2">
              <h4 className="text-base font-bold text-slate-900 mb-6">Répartition par postes de charges</h4>
              {expensesByCategory.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensesByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={6}
                          dataKey="value"
                        >
                          {expensesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value.toFixed(2)} ${currencySymbol}`, 'Dépensé']}
                          contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend Custom List */}
                  <div className="space-y-3">
                    {expensesByCategory.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-slate-600 font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-900 font-mono">{item.value.toFixed(2)} {currencySymbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <TrendingDown size={32} className="text-slate-300 mb-2" />
                  <span className="text-xs font-semibold">Aucun justificatif ou dépense comptabilisé</span>
                </div>
              )}
            </div>

            {/* Smart accounting recommendations */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-150/60 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-3">Recommandations du Régime</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">Analyse automatique de la marge opérationnelle de votre micro-entreprise.</p>
                <div className="space-y-4 text-xs text-slate-600 leading-normal">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1 rounded bg-blue-50 text-blue-600 mt-0.5">•</span>
                    <p>Vos frais externes s'élèvent à <strong className="text-slate-900 font-mono">{totalExpenses === 0 ? "0%" : `${((totalExpenses / (totalRevenue || 1)) * 100).toFixed(1)}%`}</strong> de votre chiffre d'affaires.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="p-1 rounded bg-blue-50 text-blue-600 mt-0.5">•</span>
                    <p>Le poste principal de charge est <strong className="text-indigo-650">{expensesByCategory.sort((a,b) => b.value - a.value)[0]?.name || 'non défini'}</strong>.</p>
                  </div>
                </div>
              </div>

              {/* Action Box to lock money */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 mt-4">
                <h5 className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Trésorerie Obligatoire URSSAF</h5>
                <p className="text-[10px] text-blue-600 mt-1 leading-normal">
                  Évitez les mauvaises surprises fiscales ! Bloquez immédiatement un montant forfaitaire de <strong>{estimatedCharges.toFixed(0)} {currencySymbol}</strong> sur un compte bancaire dédié à vos futures cotisations.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB II: LEGAL LEDGER (LIVRE JOURNAL DES RECEPTES ET DEPENSES) */}
      {activeTab === 'journal' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* LEDGER BAR OPTIONS (Add expense + Filters) */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            
            {/* Simple selection tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setJournalFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${journalFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-800'}`}
              >
                Tout ({ledgerItems.length})
              </button>
              <button
                onClick={() => setJournalFilter('recettes')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${journalFilter === 'recettes' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-800'}`}
              >
                Recettes ({ledgerItems.filter(i => i.type === 'recette').length})
              </button>
              <button
                onClick={() => setJournalFilter('depenses')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${journalFilter === 'depenses' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-800'}`}
              >
                Dépenses ({ledgerItems.filter(i => i.type === 'depense').length})
              </button>
            </div>

            {/* Live Search bar */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Réf, intitulé, client, catégorie..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
              />
            </div>

            {/* Action buttons (Add, custom exports) */}
            <div className="flex flex-wrap gap-2.5">
              <button 
                onClick={() => {
                  setPrintType('recettes');
                  setShowPrintModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-705 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold pointer-cursor"
              >
                <BookOpen size={14} />
                Livre des Recettes (PDF)
              </button>
              <button 
                onClick={() => {
                  setPrintType('depenses');
                  setShowPrintModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold pointer-cursor"
              >
                <Table size={14} />
                Registre des Achats (PDF)
              </button>
              <button 
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold"
              >
                <Plus size={14} />
                Nouvelle Dépense
              </button>
              <div className="relative group">
                <button
                  type="button"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold"
                >
                  <FileDown size={14} />
                  Exporter
                </button>
                {/* Micro dropdown */}
                <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden w-64 py-1.5 animate-slide-in">
                  <div className="px-3.5 py-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Grand Livre & Journaux (CSV)</div>
                  <button 
                    type="button"
                    onClick={() => exportCSV('grand_livre')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2"><Table size={13} className="text-blue-500" /> Grand Livre Général</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Complet</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => exportCSV('grand_livre_filtre')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100"
                  >
                    <span className="flex items-center gap-2"><Table size={13} className="text-blue-500" /> Grand Livre Filtré</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">Vue active</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => exportCSV('recettes')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2"><ArrowUpRight size={13} className="text-emerald-500" /> Livre de Recettes</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Complet</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => exportCSV('recettes_filtre')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100"
                  >
                    <span className="flex items-center gap-2"><ArrowUpRight size={13} className="text-emerald-500" /> Livre de Recettes Filtré</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">Vue active</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => exportCSV('depenses')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2"><ArrowDownRight size={13} className="text-indigo-500" /> Registre des Achats</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Complet</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => exportCSV('depenses_filtre')} 
                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100"
                  >
                    <span className="flex items-center gap-2"><ArrowDownRight size={13} className="text-indigo-500" /> Registre des Achats Filtré</span>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">Vue active</span>
                  </button>

                  <div className="px-3.5 py-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Fichiers Fiscaux officiels</div>
                  <button 
                    type="button"
                    onClick={() => exportCSV('fec')} 
                    className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText size={13} className="text-rose-500" /> Export FEC (.txt fiscal DGFIP)
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* CREATE EXPENSE POPUP DRAWER FORM */}
          {showExpenseForm && (
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200/80 animate-slide-in space-y-6">
              {/* Inject CSS styling for laser scanner and animations */}
              <style>{`
                @keyframes scan-laser {
                  0%, 100% { top: 0%; opacity: 0.8; }
                  50% { top: 100%; opacity: 1; }
                }
                .laser-scanner-line {
                  position: absolute;
                  left: 0;
                  width: 100%;
                  height: 4px;
                  background: linear-gradient(90deg, transparent, #10b981, #34d399, #10b981, transparent);
                  box-shadow: 0 0 16px 4px rgba(16, 185, 129, 0.7);
                  animation: scan-laser 2s infinite ease-in-out;
                  z-index: 10;
                }
                .laser-scanner-overlay {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 100%);
                  z-index: 5;
                  pointer-events: none;
                }
                @keyframes border-glow {
                  0%, 100% { border-color: #cbd5e1; box-shadow: none; }
                  50% { border-color: #6366f1; box-shadow: 0 0 8px rgba(99, 102, 241, 0.2); }
                }
                .dropzone-active {
                  animation: border-glow 1.5s infinite ease-in-out;
                  background-color: rgba(99, 102, 241, 0.02);
                }
              `}</style>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingDown className="text-indigo-500" size={18} />
                    Enregistrer un justificatif de dépense (Achat professionnel)
                  </h3>
                  <p className="text-xs text-slate-400">Saisissez les informations ou importez un ticket de caisse à scanner par IA.</p>
                </div>
              </div>

              {/* SPLIT LAYOUT: LEFT IS INTERACTIVE DROPZONE & PREVIEW, RIGHT IS FORM */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: DROPZONE */}
                <div className="lg:col-span-4 space-y-4">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Justificatif / Reçu</span>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processReceiptFile(file);
                    }}
                    className={`relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all min-h-[220px] lg:min-h-[280px] overflow-hidden ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50/30 scale-[1.02] shadow-md shadow-indigo-500/5 dropzone-active' 
                        : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
                    } group cursor-pointer`}
                  >
                    {/* Underlying hidden file input */}
                    <input 
                      type="file" 
                      id="receipt-ocr-dropzone-input"
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleReceiptUpload} 
                      disabled={ocrLoading}
                    />
                    
                    {/* Make the entire dropzone interactive as a click-to-upload */}
                    <label 
                      htmlFor="receipt-ocr-dropzone-input" 
                      className="absolute inset-0 w-full h-full cursor-pointer z-10" 
                      onClick={(e) => {
                        if (ocrLoading) e.preventDefault();
                      }}
                    />

                    {receiptPreview ? (
                      // Image preview state
                      <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900/5 p-2">
                        <img 
                          src={receiptPreview} 
                          alt="Justificatif" 
                          className="max-w-full max-h-full rounded-lg object-contain shadow-sm transition-transform group-hover:scale-105 duration-300"
                        />
                        {/* Laser Scanner Effect when processing */}
                        {ocrLoading && (
                          <>
                            <div className="laser-scanner-line" />
                            <div className="laser-scanner-overlay" />
                          </>
                        )}
                      </div>
                    ) : (
                      // Empty state / Placeholder
                      <div className="space-y-3 flex flex-col items-center relative z-0">
                        <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 transition-colors border border-indigo-100/50 group-hover:scale-110 duration-300">
                          <Upload size={20} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Glissez-déposez un reçu ici</p>
                          <p className="text-[10px] text-slate-400 mt-1">Ou cliquez pour parcourir les fichiers</p>
                        </div>
                        <div className="inline-flex items-center gap-1 bg-indigo-50/60 px-2 py-1 rounded-md text-[9px] font-semibold text-indigo-600 border border-indigo-100/30">
                          <Sparkles size={10} className="animate-pulse" />
                          Gemini OCR Intelligent
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buttons under dropzone */}
                  <div className="flex gap-2">
                    <label 
                      htmlFor="receipt-ocr-dropzone-input"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                        ocrLoading 
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-150 text-indigo-700'
                      }`}
                    >
                      {ocrLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} className="animate-pulse" />}
                      <span>{receiptPreview ? "Remplacer l'image" : "Parcourir..."}</span>
                    </label>
                    {receiptPreview && (
                      <button
                        type="button"
                        disabled={ocrLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptPreview(null);
                          setOcrSuccess(false);
                          setOcrError(null);
                        }}
                        className="px-3 py-2 border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: STATUS & FORM */}
                <div className="lg:col-span-8 space-y-4">
                  {ocrLoading && (
                    <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-850 flex items-center gap-3 animate-pulse">
                      <RefreshCw size={15} className="text-indigo-600 animate-spin" />
                      <div>
                        <span className="font-bold block text-indigo-900">Extraction intelligente Gemini IA</span>
                        <span className="text-[11px] text-indigo-700/95">Analyse de la date, du montant TTC, du fournisseur et de la TVA en cours d'extraction...</span>
                      </div>
                    </div>
                  )}

                  {ocrSuccess && (
                    <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 text-xs text-emerald-850 flex items-center gap-3 animate-fade-in">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <div>
                        <span className="font-bold block text-emerald-900 font-sans">Traitement OCR terminé avec succès !</span>
                        <span className="text-[11px] text-emerald-700">Le formulaire ci-dessous a été pré-rempli à partir de votre reçu.</span>
                      </div>
                    </div>
                  )}

                  {ocrError && (
                    <div className="bg-red-50/40 p-4 rounded-2xl border border-red-150 text-xs text-red-850 flex items-center gap-3 animate-fade-in">
                      <AlertCircle size={15} className="text-red-600" />
                      <div>
                        <span className="font-bold block text-red-900 font-sans">Erreur d'extraction OCR</span>
                        <span className="text-[11px] text-red-700">{ocrError}</span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date d'opération</label>
                      <input 
                        type="date" 
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                        value={newExpense.date}
                        onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Montant payé TTC</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:ring-1 focus:ring-blue-500 font-mono bg-white"
                        value={newExpense.amount || ''}
                        onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                        placeholder="Ex: 45.90"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catégorie réglementée</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                      >
                        <option value="Achats">Achats Matériel</option>
                        <option value="Loyer">Loyer & Charges locaux</option>
                        <option value="Logiciels">SaaS, Licences & Logiciels</option>
                        <option value="Deplacements">Transports, Essence & Indemnités</option>
                        <option value="Assurance">Assurance RCP & Auto</option>
                        <option value="Sous-traitance">Prestations externes & Freelance</option>
                        <option value="Autre">Autre dépense</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tiers fournisseur (Optionnel)</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                        value={newExpense.supplierId}
                        onChange={e => setNewExpense({...newExpense, supplierId: e.target.value})}
                      >
                        <option value="">-- Aucun fournisseur rattaché --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description explicative pour l'Administration Fiscale</label>
                      <input 
                        type="text" 
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                        value={newExpense.description}
                        onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                        placeholder="Ex: Abonnement mensuel AWS Cloud Computing"
                      />
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-3 mt-2 border-t border-slate-100 pt-4">
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowExpenseForm(false);
                          setOcrSuccess(false);
                          setOcrError(null);
                          setReceiptPreview(null);
                        }}
                        className="px-4 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 cursor-pointer"
                      >
                        Valider l'Écriture
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          )}

          {/* MAIN LEDGER TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Date d'opération</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Référence Pièce</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Intitulé / Bénéficiaire</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Catégorie</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Règlement</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Montant</th>
                    <th className="px-6 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredLedger.map((item) => {
                    const isRecette = item.type === 'recette';
                    return (
                      <tr key={item.id + '-' + item.type} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-slate-500 font-mono font-medium">
                          {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                            isRecette 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                              : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          }`}>
                            {isRecette ? 'Recette' : 'Dépense'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{item.ref}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{item.label}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-650 font-medium text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-semibold">{item.paymentMethod}</td>
                        <td className={`px-6 py-4 text-right font-extrabold text-sm ${isRecette ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {isRecette ? '+' : '-'}{item.amount.toFixed(2)} {currencySymbol}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isRecette ? (
                            <button 
                              onClick={() => handleDeleteExpense(item.id)}
                              className="text-slate-300 hover:text-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-bold">Légal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLedger.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <BookOpen size={24} className="text-slate-300" />
                          <span className="text-xs">Aucun flux financier ne correspond à vos filtres actuels.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB FOR BANK RECONCILIATION */}
      {activeTab === 'rapprochement' && (
        <div className="space-y-6 animate-fade-in">
          {/* BANNER DESCRIPTION */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2.5 py-0.5 uppercase tracking-wide">
                Automatisation & Saisie Zéro
              </span>
              <h3 className="text-xl font-bold text-slate-900">Rapprochement Bancaire Intelligent</h3>
              <p className="text-xs text-slate-400">
                Faites glisser votre relevé CSV (.csv) de Shine, Qonto, BoursoBank pour faire correspondre automatiquement vos flux réels avec vos pièces de vente et d'achats.
              </p>
            </div>
            
            <div className="flex gap-2.5 shrink-0 self-stretch sm:self-auto">
              <button
                onClick={() => {
                  // Simulate 4 realistic bank lines for immediate demonstration, linking them dynamically
                  const simulated: any[] = [];
                  
                  // Pending invoices
                  const pendingInvs = invoices.filter(i => i.status === 'Envoyée' || i.status === 'Envoyé' || i.status === InvoiceStatus.SENT);
                  if (pendingInvs.length > 0) {
                    pendingInvs.forEach((inv, idx) => {
                      const clientObj = clients.find(c => c.id === inv.clientId);
                      simulated.push({
                        id: `sim-credit-${inv.id}`,
                        date: inv.date,
                        label: `VIREMENT SEPA RECU DE ${clientObj?.name.toUpperCase() || 'CLIENT'} REF ${inv.number}`,
                        amount: inv.total,
                        matchedWith: undefined
                      });
                    });
                  } else {
                    // Fallback mock items
                    simulated.push({
                      id: 'sim-mock-1',
                      date: new Date().toISOString().split('T')[0],
                      label: 'VIREMENT SEPA CLARA S.A.S REF F2026-0032',
                      amount: 1250.00,
                      matchedWith: undefined
                    });
                  }

                  // A few mock expenses
                  simulated.push({
                    id: 'sim-mock-2',
                    date: new Date().toISOString().split('T')[0],
                    label: 'CB LE NOYAU CO-WORKING CAFETERIA PARIS',
                    amount: -18.20,
                    matchedWith: undefined
                  });
                  simulated.push({
                    id: 'sim-mock-3',
                    date: new Date().toISOString().split('T')[0],
                    label: 'COTISATION MENSUELLE SOSH TELECOM',
                    amount: -29.99,
                    matchedWith: undefined
                  });
                  simulated.push({
                    id: 'sim-mock-4',
                    date: new Date().toISOString().split('T')[0],
                    label: 'VIREMENT SEPA ACOUSTIC SERVICES - DEP LIP',
                    amount: 3200.00,
                    matchedWith: undefined
                  });

                  setBankTransactions(simulated);
                  setMatchingStatusMsg("Lignes de relevé simulées avec succès pour vos tests !");
                  setTimeout(() => setMatchingStatusMsg(null), 4000);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Sparkles size={14} className="text-amber-500" />
                Simuler un Relevé Bancaire
              </button>
            </div>
          </div>

          {/* DROPZONE AREA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-4">
                <h4 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 uppercase tracking-wider">
                  Importer Relevé CSV
                </h4>
                
                {/* Drag and Drop Box */}
                <div 
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-white flex flex-col items-center justify-center space-y-3 group"
                  onClick={() => document.getElementById('bank-csv-file')?.click()}
                >
                  <Upload size={32} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">Faire glisser votre fichier CSV</span>
                    <span className="text-[10px] text-slate-400 block">ou cliquez pour explorer</span>
                  </div>
                  <input 
                    type="file" 
                    id="bank-csv-file" 
                    accept=".csv,.ofx,.qfx" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const text = event.target?.result as string;
                          if (!text) return;
                          const fileName = file.name.toLowerCase();
                          const parsed = (fileName.endsWith('.ofx') || fileName.endsWith('.qfx'))
                            ? parseBankOfx(text)
                            : parseBankCsv(text);
                          
                          if (parsed.length > 0) {
                            setBankTransactions(parsed);
                            setMatchingStatusMsg(`Relevé importé avec succès (${parsed.length} lignes trouvées) !`);
                            setTimeout(() => setMatchingStatusMsg(null), 4000);
                          } else {
                            setMatchingStatusMsg("Erreur: Impossible d'analyser le relevé. Vérifiez le format (CSV/OFX).");
                            setTimeout(() => setMatchingStatusMsg(null), 5000);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </div>

                {matchingStatusMsg && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs font-medium animate-fade-in">
                    {matchingStatusMsg}
                  </div>
                )}

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5 text-xs text-slate-500 leading-normal">
                  <div className="flex gap-2 text-slate-700 font-bold border-b border-slate-200 pb-1.5 uppercase text-[9.5px]">
                    <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                    Format supporté
                  </div>
                  <p>Notre algorithme extrait les formats standards délimités par des virgules (,) ou points-virgules (;). Colonnes attendues :</p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[10px]">
                    <li>Colonne 1 : Date (JJ/MM/AAAA)</li>
                    <li>Colonne 2 : Libellé / Description</li>
                    <li>Colonne 3 : Débit ou Montant total</li>
                    <li>Colonne 4 : Crédit (facultatif)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* INTERACTIVE MATCHES LIST */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Lignes Bancaires à Traiter ({bankTransactions.length})
                  </h4>
                  <span className="text-xs text-slate-400 font-medium font-mono">
                    {bankTransactions.filter(bt => bt.matchedWith).length} / {bankTransactions.length} Rapprochés
                  </span>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {bankTransactions.map((line) => {
                    const isIncoming = line.amount > 0;
                    
                    // Match heuristic
                    let predictedMatch: any = null;
                    let confidence = 0;
                    let matchType: 'invoice' | 'expense' = 'invoice';

                    if (isIncoming) {
                      // Match check for Invoices
                      const matchedInvoice = invoices.find(inv => {
                        const amountDiff = Math.abs(inv.total - line.amount);
                        return amountDiff < 0.05 && inv.status !== 'Payée';
                      });

                      if (matchedInvoice) {
                        predictedMatch = matchedInvoice;
                        confidence = 99;
                        matchType = 'invoice';
                      } else {
                        // secondary search based on label similarity helper
                        const clientMatched = clients.find(cl => 
                          line.label.toLowerCase().includes(cl.name.toLowerCase().split(' ')[0])
                        );
                        if (clientMatched) {
                          const invoiceOfClient = invoices.find(inv => inv.clientId === clientMatched.id && inv.status !== 'Payée');
                          if (invoiceOfClient) {
                            predictedMatch = invoiceOfClient;
                            confidence = 70;
                            matchType = 'invoice';
                          }
                        }
                      }
                    } else {
                      // Match check for existing Expenses or suppliers
                      const matchedExpense = expenses.find(exp => 
                        Math.abs(exp.amount - Math.abs(line.amount)) < 0.05
                      );
                      if (matchedExpense) {
                        predictedMatch = matchedExpense;
                        confidence = 95;
                        matchType = 'expense';
                      }
                    }

                    return (
                      <div 
                        key={line.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          line.matchedWith
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-150 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-bold font-mono">{line.date}</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isIncoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {isIncoming ? 'Crédit (Virement)' : 'Débit (Frais)'}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-800 truncate" title={line.label}>
                              {line.label}
                            </h5>
                          </div>
                          
                          <div className={`text-sm font-extrabold font-mono text-right shrink-0 ${
                            isIncoming ? 'text-emerald-600' : 'text-slate-800'
                          }`}>
                            {isIncoming ? '+' : '-'}{Math.abs(line.amount).toFixed(2)} {currencySymbol}
                          </div>
                        </div>

                        {/* RECONCILED STATE */}
                        {line.matchedWith ? (
                          <div className="mt-3 pt-3 border-t border-emerald-100/60 flex items-center justify-between text-emerald-800 text-xs font-semibold bg-emerald-50 p-2 rounded-xl">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={14} className="text-emerald-600 font-bold" />
                              <span>Flux associé avec succès à la pièce {line.matchedWith.name} !</span>
                            </div>
                            <button
                              onClick={() => {
                                // Cancel Match
                                if (setInvoices && line.matchedWith.type === 'invoice') {
                                  const updatedInvoices = invoices.map(inv => {
                                    if (inv.id === line.matchedWith.id) {
                                      return { ...inv, status: 'Envoyée' };
                                    }
                                    return inv;
                                  });
                                  setInvoices(updatedInvoices);
                                }
                                setBankTransactions(prev => prev.map(bt => {
                                  if (bt.id === line.id) {
                                    return { ...bt, matchedWith: undefined };
                                  }
                                  return bt;
                                }));
                              }}
                              className="text-[10px] font-bold text-red-650 hover:underline"
                            >
                              Annuler le lien
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                            {/* Predictions Box */}
                            {predictedMatch ? (
                              <div className="flex-1 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-blue-50 border border-blue-100 text-blue-600 px-2 rounded-md">
                                  <Sparkles size={10} /> {confidence}% Match
                                </span>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {matchType === 'invoice' ? (
                                    <>Facture client du montant exact : <strong>{predictedMatch.number}</strong></>
                                  ) : (
                                    <>Achat correspondant dans vos frais : <strong>{predictedMatch.description}</strong></>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <div className="flex-1 text-[11px] text-slate-400 font-medium italic">
                                {isIncoming 
                                  ? "Aucun client ou montant exact correspondant n'a été pré-identifié." 
                                  : "Frais non saisis ou aucun justificatif correspondant."}
                              </div>
                            )}

                            {/* Actions Buttons */}
                            <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                              {predictedMatch ? (
                                <button
                                  onClick={() => {
                                    // Process match
                                    if (matchType === 'invoice') {
                                      if (setInvoices) {
                                        const updatedInvs = invoices.map(i => {
                                          if (i.id === predictedMatch.id) {
                                            return { ...i, status: 'Payée' };
                                          }
                                          return i;
                                        });
                                        setInvoices(updatedInvs);
                                      }
                                      setBankTransactions(prev => prev.map(bt => {
                                        if (bt.id === line.id) {
                                          return { 
                                            ...bt, 
                                            matchedWith: { type: 'invoice', id: predictedMatch.id, name: predictedMatch.number } 
                                          };
                                        }
                                        return bt;
                                      }));
                                    } else {
                                      // Reconciled with expense
                                      setBankTransactions(prev => prev.map(bt => {
                                        if (bt.id === line.id) {
                                          return { 
                                            ...bt, 
                                            matchedWith: { type: 'expense', id: predictedMatch.id, name: predictedMatch.description } 
                                          };
                                        }
                                        return bt;
                                      }));
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                                >
                                  Valider l'association
                                </button>
                              ) : (
                                !isIncoming && (
                                  <button
                                    onClick={() => {
                                      // Quick create expense
                                      const createdExp: Expense = {
                                        id: `expense-bank-${Date.now()}`,
                                        date: line.date.includes('/') ? line.date.split('/').reverse().join('-') : line.date,
                                        description: line.label,
                                        amount: Math.abs(line.amount),
                                        category: 'Achats'
                                      };
                                      setExpenses([...expenses, createdExp]);
                                      setBankTransactions(prev => prev.map(bt => {
                                        if (bt.id === line.id) {
                                          return { 
                                            ...bt, 
                                            matchedWith: { type: 'expense', id: createdExp.id, name: createdExp.description } 
                                          };
                                        }
                                        return bt;
                                      }));
                                    }}
                                    className="bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1"
                                  >
                                    <Plus size={10} /> Créer la dépense
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {bankTransactions.length === 0 && (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                      <Landmark size={36} className="text-slate-300" />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Aucun relevé chargé</span>
                        <span className="text-[10px] text-slate-400 max-w-sm block mt-1">
                          Simulez un relevé ou téléversez un CSV d'export bancaire pro pour faire vos rapprochements de fin de mois.
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const clickTrigger = document.getElementById('sim-trigger-btn');
                          if (clickTrigger) clickTrigger.click();
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold mt-2"
                      >
                        Générer un Relevé d'Essai
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB FOR MARGINS & TAX SIMULATOR */}
      {activeTab === 'simulateur' && (
        <div className="space-y-6 animate-fade-in">
          {/* BANNER DESCRIPTION */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-0.5 uppercase tracking-wide">
                Intelligence Fiscale Directe
              </span>
              <h3 className="text-xl font-bold text-slate-900">Analyse de Rentabilité & Simulateur de Reste à Vivre</h3>
              <p className="text-xs text-slate-400">
                Calculez votre bénéfice net final après abattements, cotisations fiscales de l'URSSAF et impôt prévisionnel libératoire ou classique.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PARAMETERS SELECTION (Left column) */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
                <h4 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 uppercase tracking-wider">
                  Vos Options Fiscales
                </h4>

                {/* Regime Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-705 block">
                    Mode d'Imposition sur le Revenu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTaxRegime('liberatoire')}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                        taxRegime === 'liberatoire'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Versement Libératoire
                      <span className="block text-[8.5px] font-medium opacity-80 mt-1">Prélèvement à la source (%)</span>
                    </button>
                    <button
                      onClick={() => setTaxRegime('classic')}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                        taxRegime === 'classic'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Imposition Classique
                      <span className="block text-[8.5px] font-medium opacity-80 mt-1">Abattement + Taux Marginal</span>
                    </button>
                  </div>
                </div>

                {/* Classic IR Settings (Disabled under Libératoire) */}
                {taxRegime === 'classic' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 animate-slide-in">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 block">
                          Taux Marginal d'Imposition (TMI)
                        </label>
                        <span className="text-xs font-extrabold font-mono text-indigo-650">{taxSlabTMI}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal pb-1">
                        Tranche d'imposition d'État sur laquelle seront taxés vos revenus nets professionnels.
                      </p>
                      
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 11, 30, 41, 45].map((slab) => (
                          <button
                            key={slab}
                            onClick={() => setTaxSlabTMI(slab)}
                            className={`py-2 rounded-lg text-[10px] font-bold border ${
                              taxSlabTMI === slab
                                ? 'bg-slate-950 border-slate-950 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                            }`}
                          >
                            {slab}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[10px] text-slate-500 space-y-1">
                      <span className="font-bold text-slate-700 block">Abattement légal d'activité :</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Prestations Libérales (BNC) : <strong>34%</strong></li>
                        <li>Prestations Artisanales (BIC) : <strong>50%</strong></li>
                        <li>Vente de marchandises (BIC) : <strong>71%</strong></li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Smart business advice module */}
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden shadow-md">
                  <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                    <Lightbulb size={100} />
                  </div>
                  
                  <div className="inline-flex items-center gap-1.5 text-[9.5px] font-extrabold text-amber-300 uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded border border-white/15 w-max">
                    <Lightbulb size={11} /> Optimisation Fiscale
                  </div>
                  
                  {(() => {
                    const abattementPct = activityType === 'goods' ? 71 : (userProfile?.activityType === 'services_liberal' ? 34 : 50);
                    const realExpensePct = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;
                    const isMicroOptimal = realExpensePct < abattementPct;

                    return (
                      <div className="space-y-2 z-10 text-xs text-indigo-100">
                        <p className="leading-relaxed">
                          Vos dépenses réelles représentent <strong>{realExpensePct.toFixed(1)}%</strong> de votre chiffre d'affaires.
                        </p>
                        <p className="leading-relaxed">
                          L'État applique un abattement forfaitaire de <strong>{abattementPct}%</strong> pour vos frais professionnels.
                        </p>
                        <p className="font-bold text-white leading-snug border-t border-white/10 pt-2 flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          {isMicroOptimal 
                            ? "Le régime Micro-Entreprise est ultra-optimal pour vous !" 
                            : "Le passage au régime RÉEL simplifié pourrait réduire vos impôts !"}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* SIMULATION VISUAL BENTO CARD (Right columns) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
                <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Votre Reste à Vivre Réel Prévisionnel
                </h4>

                {(() => {
                  // Setup calculations
                  const ca = totalRevenue;
                  const urssafRate = customChargesRate || (activityType === 'goods' ? 12.3 : 21.1);
                  const urssafResult = ca * (urssafRate / 100);

                  // Income tax calc
                  let taxResult = 0;
                  if (taxRegime === 'liberatoire') {
                    // VL Rate: Goods = 1%, Commercial Serv (BIC) = 1.7%, Liberal Serv (BNC) = 2.2%
                    const vlRate = activityType === 'goods' ? 1 : (userProfile?.activityType === 'services_liberal' ? 2.2 : 1.7);
                    taxResult = ca * (vlRate / 100);
                  } else {
                    const abattement = activityType === 'goods' ? 0.71 : (userProfile?.activityType === 'services_liberal' ? 0.34 : 0.5);
                    const taxableCA = ca * (1 - abattement);
                    taxResult = taxableCA * (taxSlabTMI / 100);
                  }

                  const expensesResult = totalExpenses;
                  const netGain = ca - urssafResult - taxResult - expensesResult;
                  const marginPercentage = ca > 0 ? (netGain / ca) * 100 : 0;

                  return (
                    <div className="space-y-6">
                      {/* Dynamic Bars Graph representing allocations */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ventilation du pouvoir d'achat</span>
                        <div className="h-6 w-full rounded-full overflow-hidden flex bg-slate-100">
                          {ca > 0 ? (
                            <>
                              <div 
                                style={{ width: `${Math.max(0, (netGain / ca) * 100)}%` }} 
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full hover:opacity-90 transition-opacity" 
                                title="Net gagné"
                              />
                              <div 
                                style={{ width: `${(urssafResult / ca) * 100}%` }} 
                                className="bg-yellow-400 h-full hover:opacity-90 transition-opacity" 
                                title="Cotisations URSSAF"
                              />
                              <div 
                                style={{ width: `${(taxResult / ca) * 105}%` }} 
                                className="bg-indigo-500 h-full hover:opacity-90 transition-opacity" 
                                title="Impôts sur le revenu"
                              />
                              <div 
                                style={{ width: `${(expensesResult / ca) * 100}%` }} 
                                className="bg-slate-400 h-full hover:opacity-90 transition-opacity" 
                                title="Charges et dépense"
                              />
                            </>
                          ) : (
                            <div className="w-full h-full bg-slate-105 flex items-center justify-center text-[10px] text-slate-400">
                              Aucun chiffre d'affaires encaissé pour le moment.
                            </div>
                          )}
                        </div>
                        
                        {/* Custom Legend */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                            <div className="text-[11px] leading-tight flex-1">
                              <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wide">Net Disponible</span>
                              <strong className="text-slate-800 font-mono">{netGain.toFixed(2)} {currencySymbol}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
                            <div className="text-[11px] leading-tight flex-1">
                              <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wide">Charges URSSAF</span>
                              <strong className="text-slate-800 font-mono">{urssafResult.toFixed(2)} {currencySymbol}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                            <div className="text-[11px] leading-tight flex-1">
                              <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wide">Impôt Provision</span>
                              <strong className="text-slate-800 font-mono">{taxResult.toFixed(2)} {currencySymbol}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                            <div className="text-[11px] leading-tight flex-1">
                              <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wide">Charges Réelles</span>
                              <strong className="text-slate-800 font-mono">{expensesResult.toFixed(2)} {currencySymbol}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Ledger Recap Card */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                        {/* Earnings Panel */}
                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                          <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-widest block border-b border-slate-200 pb-2">
                            Encaissements Bruts (E)
                          </span>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">Chiffre d'Affaires Encaissé :</span>
                            <span className="text-sm font-extrabold font-mono text-slate-900">{ca.toFixed(2)} {currencySymbol}</span>
                          </div>

                          <div className="flex justify-between items-center text-slate-500 text-xs">
                            <span>Abattement Pris en Compte ({activityType === 'goods' ? '71%' : (userProfile?.activityType === 'services_liberal' ? '34%' : '50%')}):</span>
                            <span className="font-bold font-mono">
                              {(ca * (activityType === 'goods' ? 0.71 : (userProfile?.activityType === 'services_liberal' ? 0.34 : 0.5))).toFixed(2)} {currencySymbol}
                            </span>
                          </div>
                        </div>

                        {/* Charges Panel */}
                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                          <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-widest block border-b border-slate-200 pb-2">
                            Total Prélèvements (P)
                          </span>
                          
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-550 flex items-center gap-1">
                              URSSAF ({urssafRate.toFixed(1)}%) :
                            </span>
                            <span className="font-extrabold font-mono text-red-650">{urssafResult.toFixed(2)} {currencySymbol}</span>
                          </div>

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-550">
                              Impôts Provisionnels ({taxRegime === 'liberatoire' ? 'VL' : `TMI ${taxSlabTMI}%`}) :
                            </span>
                            <span className="font-extrabold font-mono text-red-650">{taxResult.toFixed(2)} {currencySymbol}</span>
                          </div>

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-550">Achats & Fonctionnement :</span>
                            <span className="font-extrabold font-mono text-slate-705">{expensesResult.toFixed(2)} {currencySymbol}</span>
                          </div>
                        </div>
                      </div>

                      {/* SUMMARY NET DISPOSABLE BANNER */}
                      <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-150/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm shadow-emerald-50/30">
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-emerald-990 uppercase tracking-wider">Taux de Rendement Net d'Activité</h4>
                          <p className="text-xs text-emerald-800 leading-normal">
                            Pour chaque 100 € facturé à vos clients, il vous reste <strong>{marginPercentage.toFixed(1)} €</strong> réels et sécurisés dans votre poche.
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-emerald-600 block font-extrabold uppercase tracking-widest">Gains Net Sûrs</span>
                          <strong className="text-4xl font-extrabold font-mono text-emerald-800">
                            {netGain.toFixed(0)} {currencySymbol}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB III: URSSAF DECLARATIONS CALCULATOR */}
      {activeTab === 'urssaf' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* INTRO AND SCHEDULER SETUP */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2.5 py-0.5 uppercase tracking-wide">Assistant de Remplissage</span>
              <h3 className="text-lg font-bold text-slate-900">Préparation à la déclaration du Chiffre d'Affaires</h3>
              <p className="text-xs text-slate-400">Copiez directement les valeurs ci-dessous sur votre portail officiel <strong>autoentrepreneur.urssaf.fr</strong>.</p>
            </div>

            {/* Selector Periodicity & Export */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setUrssafPeriod('monthly')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${urssafPeriod === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Mensuelle
                </button>
                <button
                  type="button"
                  onClick={() => setUrssafPeriod('quarterly')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${urssafPeriod === 'quarterly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Trimestrielle
                </button>
              </div>

              <button
                type="button"
                onClick={() => exportCSV('urssaf')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Download size={14} />
                Exporter la Déclaration (CSV)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* PORTAL SIMULATION PANEL */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-205 shadow-sm lg:col-span-2 space-y-6">
              
              {/* Filter controls selectors */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Période :</label>
                  {urssafPeriod === 'monthly' ? (
                    <select 
                      value={selectedUrssafMonth}
                      onChange={(e) => setSelectedUrssafMonth(e.target.value)}
                      className="text-xs font-bold bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-slate-855"
                    >
                      {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map(m => (
                        <option key={m} value={m}>{m} 2026</option>
                      ))}
                    </select>
                  ) : (
                    <select 
                      value={selectedUrssafQuarter}
                      onChange={(e) => setSelectedUrssafQuarter(e.target.value)}
                      className="text-xs font-bold bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-slate-855"
                    >
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                        <option key={q} value={q}>{q} 2026</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Versement Libératoire Active status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Option Versement Libératoire :</span>
                  <button
                    onClick={() => setOptInLiberatoire(!optInLiberatoire)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      optInLiberatoire 
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {optInLiberatoire ? '✓ Activé (Impôt inclus)' : '✕ Désactivé'}
                  </button>
                </div>
              </div>

              {/* INTERACTIVE GUIDE STEPS */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-600" />
                  Assistant Déclaration URSSAF pas-à-pas (E-Reporting)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
                  {[
                    { step: 1, title: 'Se Connecter', desc: 'autoentrepreneur.urssaf.fr' },
                    { step: 2, title: 'Déclarer', desc: 'Accéder au formulaire' },
                    { step: 3, title: 'Copier', desc: 'Insérer les montants' },
                    { step: 4, title: 'Vérifier', desc: 'Comparer les cotisations' },
                    { step: 5, title: 'Valider', desc: 'Archiver le justificatif' }
                  ].map((s) => (
                    <div key={s.step} className="bg-white p-3 rounded-xl border border-slate-200/70 flex flex-col items-center justify-center gap-1">
                      <div className="w-6 h-6 rounded-full bg-blue-105 text-blue-700 text-xs font-extrabold flex items-center justify-center">
                        {s.step}
                      </div>
                      <span className="text-[11px] font-bold text-slate-800">{s.title}</span>
                      <span className="text-[9px] text-slate-400 leading-none">{s.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center bg-blue-50/50 px-4 py-3 rounded-xl border border-blue-100 text-[11px] text-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span><strong>Lien direct officiel :</strong> Déclarez en toute sécurité sur le portail de l'URSSAF.</span>
                  </div>
                  <a 
                    href="https://www.autoentrepreneur.urssaf.fr" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-bold underline flex items-center gap-1 hover:text-blue-900"
                  >
                    Ouvrir le portail <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Simulated Portal Content */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">Miroir autoentrepreneur.urssaf.fr</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">Année fiscale 2026</span>
                </div>

                <div className="divide-y divide-slate-150">
                  {/* Category 1: Ventes de marchandises */}
                  <div className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">Chambre de Commerce (BIC)</span>
                      <h5 className="text-xs font-bold text-slate-900">Ventes de marchandises, objets et fournitures de logement</h5>
                      <p className="text-[10.5px] text-slate-400">Taux global : 12.3% {optInLiberatoire && "+ 1.0% impôt"} + 0.1% CFP</p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <div className="bg-slate-50 shadow-inner px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-xs text-slate-800 text-right min-w-[120px]">
                        {urssafSums.sales.toFixed(2)} {currencySymbol}
                      </div>
                      <button 
                        onClick={() => handleCopyToClipboard(urssafSums.sales.toFixed(2), 'sales')}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold ${
                          copiedField === 'sales' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                        title="Copier le montant"
                      >
                        {copiedField === 'sales' ? <Check size={14} /> : <Copy size={14} />}
                        <span className="text-[10px]">{copiedField === 'sales' ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Category 2: Prestations de services artisanales et commerciales */}
                  <div className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">Chambre des Métiers (BIC)</span>
                      <h5 className="text-xs font-bold text-slate-900">Prestations de services commerciales ou artisanales</h5>
                      <p className="text-[10.5px] text-slate-400">Taux global : 21.2% {optInLiberatoire && "+ 1.7% impôt"} + 0.3% CFP</p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <div className="bg-slate-50 shadow-inner px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-xs text-slate-800 text-right min-w-[120px]">
                        {urssafSums.serviceBic.toFixed(2)} {currencySymbol}
                      </div>
                      <button 
                        onClick={() => handleCopyToClipboard(urssafSums.serviceBic.toFixed(2), 'bic')}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold ${
                          copiedField === 'bic' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                        title="Copier le montant"
                      >
                        {copiedField === 'bic' ? <Check size={14} /> : <Copy size={14} />}
                        <span className="text-[10px]">{copiedField === 'bic' ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Category 3: Autres prestations de services Libérales (BNC) */}
                  <div className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">Professions Libérales (BNC / CIPAV)</span>
                      <h5 className="text-xs font-bold text-slate-900">Autres prestations de services / Professions libérales</h5>
                      <p className="text-[10.5px] text-slate-400">Taux global : 21.1% {optInLiberatoire && "+ 2.2% impôt"} + 0.2% CFP</p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <div className="bg-slate-50 shadow-inner px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-xs text-slate-800 text-right min-w-[120px]">
                        {urssafSums.serviceBnc.toFixed(2)} {currencySymbol}
                      </div>
                      <button 
                        onClick={() => handleCopyToClipboard(urssafSums.serviceBnc.toFixed(2), 'bnc')}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold ${
                          copiedField === 'bnc' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                        title="Copier le montant"
                      >
                        {copiedField === 'bnc' ? <Check size={14} /> : <Copy size={14} />}
                        <span className="text-[10px]">{copiedField === 'bnc' ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Helpful hint block */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-500 leading-relaxed flex gap-3">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Pour déclarer, ouvrez l'onglet URSSAF dans votre navigateur, connectez-vous, puis copiez chacun des montants bruts ci-dessus dans les trois cases grises correspondantes de votre formulaire officiel de déclaration de chiffre d'affaires.
                </span>
              </div>
            </div>

            {/* SYNTHESE DE LA COTISATION & FISCALITE */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Détail des Calculs Fiscaux</h4>
                
                {/* Cotisations estimate */}
                <div className="space-y-3">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">Cotisations Sociales Estimées</span>
                  <div className="divide-y divide-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-500">
                      <span>Cotisations Marchandises ({urssafSums.sales > 0 ? (12.3).toFixed(1) : 0}%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.sales * 0.123).toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-500">
                      <span>Cotisations Services BIC ({urssafSums.serviceBic > 0 ? (21.2).toFixed(1) : 0}%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBic * 0.212).toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-500">
                      <span>Cotisations Services BNC ({urssafSums.serviceBnc > 0 ? (21.1).toFixed(1) : 0}%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBnc * 0.211).toFixed(2)} {currencySymbol}</span>
                    </div>
                  </div>
                </div>

                {/* CFP Estimate */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider block">Formation Professionnelle (CFP)</span>
                  <div className="divide-y divide-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-500">
                      <span>Ventes / BIC Commerce (0.1%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.sales * 0.001).toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-500">
                      <span>Artisans / BIC Services (0.3%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBic * 0.003).toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-500">
                      <span>Services & Libéral / BNC (0.2%)</span>
                      <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBnc * 0.002).toFixed(2)} {currencySymbol}</span>
                    </div>
                  </div>
                </div>

                {/* Impôts Estimations */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider block">Versement de l'Impôt</span>
                  {optInLiberatoire ? (
                    <div className="space-y-2 text-xs divide-y divide-slate-100">
                      <div className="flex justify-between py-1 text-slate-500">
                        <span>Impôt sur Ventes (1%)</span>
                        <span className="font-bold font-mono text-slate-800">{(urssafSums.sales * 0.01).toFixed(2)} {currencySymbol}</span>
                      </div>
                      <div className="flex justify-between py-1.5 text-slate-500">
                        <span>Impôt sur Services BIC (1.7%)</span>
                        <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBic * 0.017).toFixed(2)} {currencySymbol}</span>
                      </div>
                      <div className="flex justify-between py-1.5 text-slate-500">
                        <span>Impôt sur Services BNC (2.2%)</span>
                        <span className="font-bold font-mono text-slate-800">{(urssafSums.serviceBnc * 0.022).toFixed(2)} {currencySymbol}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-slate-400 italic">
                      Versement libératoire désactivé. Vos revenus d'activité seront intégrés à votre impôt sur le revenu classique avec abattement forfaitaire lors de la déclaration fiscale d'État.
                    </p>
                  )}
                </div>

                {/* Total Net à payer */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-150">
                    <span className="text-xs font-bold text-slate-700">Total à débiter :</span>
                    <span className="text-sm font-extrabold font-mono text-blue-600">
                      {(() => {
                        const socGoods = urssafSums.sales * 0.123;
                        const socSvcBic = urssafSums.serviceBic * 0.212;
                        const socSvcBnc = urssafSums.serviceBnc * 0.211;
                        
                        const cfpGoods = urssafSums.sales * 0.001;
                        const cfpBic = urssafSums.serviceBic * 0.003;
                        const cfpBnc = urssafSums.serviceBnc * 0.002;

                        const taxGoods = optInLiberatoire ? urssafSums.sales * 0.01 : 0;
                        const taxSvcBic = optInLiberatoire ? urssafSums.serviceBic * 0.017 : 0;
                        const taxSvcBnc = optInLiberatoire ? urssafSums.serviceBnc * 0.022 : 0;

                        return (socGoods + socSvcBic + socSvcBnc + cfpGoods + cfpBic + cfpBnc + taxGoods + taxSvcBic + taxSvcBnc).toFixed(2);
                      })()}{' '}{currencySymbol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Safe legal boundary banner */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-800 leading-relaxed flex gap-2.5">
                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Ce simulateur offre des estimations pour vous guider lors du remplissage de votre déclaration. Seul le paiement validé sur le portail URSSAF fait foi juridiquement.
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* OFFICIAL COMPLIANT PRINTABLE REGISTERS MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl border border-slate-200/50 max-h-[90vh] flex flex-col overflow-hidden animate-slide-in">
            {/* Modal Controls (Invisible on Print) */}
            <div className="p-6 border-b border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 print:hidden shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-105 border border-blue-150 rounded px-2 py-0.5 uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck size={11} /> Conforme d'État (Art. 286 CGI)
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {printType === 'recettes' ? 'Générateur du Livre Journal des Recettes' : "Générateur du Registre des Achats d'Activité"}
                </h3>
                <p className="text-xs text-slate-400">
                  Éditez et exportez le registre légal obligatoire en cas d'audit fiscal de votre micro-entreprise.
                </p>
              </div>

              {/* Switches */}
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <div className="inline-flex rounded-xl bg-slate-200 p-0.5">
                  <button
                    onClick={() => setPrintType('recettes')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      printType === 'recettes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Livre de Recettes
                  </button>
                  <button
                    onClick={() => setPrintType('depenses')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      printType === 'depenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Registre d'Achats
                  </button>
                </div>
                
                <button
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Printer size={13} />
                  Imprimer / PDF
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Print Warning Header (Invisible on Print) */}
            <div className="p-4 bg-amber-50 border-b border-amber-100 text-amber-800 text-[11px] leading-relaxed flex gap-2.5 print:hidden shrink-0">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note légale importante :</strong> Le Code des Impôts impose que les pages soient numérotées de façon inaltérable, sans blancs ni ratures. Lorsque vous cliquez sur "Imprimer / PDF", choisissez <strong>"Enregistrer au format PDF"</strong> ou votre imprimante physique. Les options d'en-tête et pied de page du navigateur généreront automatiquement les numéros de page pour vous.
              </span>
            </div>

            {/* LEDGER AREA (This gets isolated & styled cleanly for printing) */}
            <div className="p-8 overflow-y-auto flex-1 font-sans bg-white relative" id="printable-ledger-area">
              {/* COMPREHENSIVE STYLE INJECTOR FOR TRUE PRINT LAYOUT */}
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-ledger-area, #printable-ledger-area * {
                    visibility: visible !important;
                  }
                  #printable-ledger-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }
                  .print\\:hidden {
                    display: none !important;
                  }
                  .print-break-after {
                    page-break-after: always !important;
                  }
                }
              `}</style>

              {/* Business Official Header Block */}
              <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-start">
                <div className="space-y-1.5 min-w-0">
                  <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    {printType === 'recettes' ? 'Livre des Recettes Chronologique' : "Registre des Achats & Frais"}
                  </h1>
                  <span className="text-xs font-bold text-slate-505 block uppercase tracking-widest">
                    Régime Fiscal : Micro-Entrepreneur EI (Franchise en Base de TVA - Art. 293 B CGI ou assujetti)
                  </span>
                  <div className="pt-2 text-xs text-slate-600 space-y-0.5 leading-normal">
                    <p><strong>Titulaire :</strong> {userProfile?.companyName || "Entreprise Individuelle"}</p>
                    <p><strong>SIRET :</strong> {userProfile?.siret || "Non renseigné"}</p>
                    <p><strong>Adresse :</strong> {userProfile?.address || "Non renseignée"}</p>
                    {userProfile?.tvaNumber && <p><strong>TVA Intracommunautaire :</strong> {userProfile?.tvaNumber}</p>}
                  </div>
                </div>

                <div className="border border-slate-300 p-4 rounded-xl text-right bg-slate-50 min-w-[200px]">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Exercice Comptable</span>
                  <strong className="text-xl font-extrabold font-mono text-slate-800">{printYear}</strong>
                  <div className="border-t border-slate-200 mt-2.5 pt-2 text-[10px] text-slate-500">
                    Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Legal confirmation banner */}
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] text-slate-500 leading-relaxed italic">
                {printType === 'recettes' ? (
                  "En application de l'article L. 123-12 du Code de Commerce et de l'article 286 du Code Général des Impôts (CGI), le présent livre de recettes présente de manière chronologique, sincère et inaltérable l'intégralité des paiements et encaissements encaissés au titre de l'activité professionnelle."
                ) : (
                  "Conformément aux instructions administratives, le présent registre récapitule de manière chronologique de date l'ensemble des dépenses de fonctionnement faites au titre de l'exercice d'activité, appuyé par des justificatifs d'achats originaux."
                )}
              </div>

              {/* Dynamic Ledger Table */}
              {(() => {
                // Collect and sort ledger items ascending by date for compliant chronological record
                const sortedItems = [...ledgerItems]
                  .filter(item => {
                    const yearObj = new Date(item.date).getFullYear();
                    const filterMatch = printType === 'recettes' ? item.type === 'recette' : item.type === 'depense';
                    return yearObj === printYear && filterMatch;
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Group by quarter to generate quarterly sub-totals
                const getQuarter = (dateStr: string) => {
                  const m = new Date(dateStr).getMonth() + 1;
                  if (m <= 3) return 1;
                  if (m <= 6) return 2;
                  if (m <= 9) return 3;
                  return 4;
                };

                const quarters = [1, 2, 3, 4];
                let cumulativeTotal = 0;

                return (
                  <div className="space-y-8">
                    {quarters.map(q => {
                      const qItems = sortedItems.filter(item => getQuarter(item.date) === q);
                      const qSum = qItems.reduce((acc, current) => acc + current.amount, 0);
                      cumulativeTotal += qSum;

                      return (
                        <div key={q} className="space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-400 pb-1 pt-4">
                            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                              Trimestre {q} ({q === 1 ? 'Janvier - Mars' : q === 2 ? 'Avril - Juin' : q === 3 ? 'Juillet - Septembre' : 'Octobre - Décembre'})
                            </h4>
                            <span className="text-xs font-bold text-slate-500">
                              {qItems.length} opération{qItems.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-300 text-slate-500 font-bold">
                                <th className="py-2.5 w-1/8 font-mono">Date</th>
                                <th className="py-2.5 w-1/6">Référence</th>
                                <th className="py-2.5 w-1/4">Tiers ({printType === 'recettes' ? 'Client' : 'Fournisseur'})</th>
                                <th className="py-2.5 w-1/4">Désignation des travaux / Charges</th>
                                <th className="py-2.5 w-1/8 text-slate-400">Mode Règlement</th>
                                <th className="py-2.5 w-1/8 text-right">Montant brut ({currencySymbol})</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                              {qItems.map(item => (
                                <tr key={item.id + '-' + item.type} className="hover:bg-slate-50 font-sans">
                                  <td className="py-3 font-mono text-[11px]">
                                    {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </td>
                                  <td className="py-3 font-mono font-bold text-[11px] text-slate-700">{item.ref}</td>
                                  <td className="py-3 font-semibold">{item.label.split(' - ')[0]}</td>
                                  <td className="py-3 text-slate-600">{item.label}</td>
                                  <td className="py-3 text-slate-500 font-mono text-[10px] uppercase">{item.paymentMethod || 'VIREMENT'}</td>
                                  <td className="py-3 text-right font-bold font-mono text-sm">
                                    {item.amount.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                              {qItems.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                    Néant - Aucun mouvement financier n'a été enregistré au cours de ce trimestre.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-400 font-bold bg-slate-50">
                                <td colSpan={5} className="py-3 text-right uppercase tracking-wider text-[10px] text-slate-500">
                                  Sous-Total Trimestriel (Q{q}) :
                                </td>
                                <td className="py-3 text-right font-mono text-[13px] text-slate-905">
                                  {qSum.toFixed(2)} {currencySymbol}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    })}

                    {/* GRAND GENERAL TOTAL */}
                    <div className="mt-8 pt-6 border-t-4 border-double border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs space-y-1.5 leading-normal text-slate-650">
                        <p className="font-bold text-slate-850 text-[10px] uppercase tracking-wider border-b border-slate-200 pb-1 mb-1">
                          Certificat d'Authentification Éditeur
                        </p>
                        <p>ID Certifié d'Activité : {userProfile?.siret || 'EI-SIRET-COMPLIANT'}</p>
                        <p>Vérificateur : Système automatisé de micro-entreprise</p>
                        <p>Non-Modificabilité : Affirmée en base de données protégée</p>
                      </div>

                      <div className="flex flex-col items-end justify-center space-y-1 bg-slate-900 text-white p-6 rounded-2xl">
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                          Chiffre Cumulé Global de l'Exercice :
                        </span>
                        <strong className="text-3xl font-extrabold font-mono">
                          {cumulativeTotal.toFixed(2)} {currencySymbol}
                        </strong>
                        <span className="text-[9px] text-slate-400 pt-1 italic">
                          Document définitif à joindre aux liasses comptables
                        </span>
                      </div>
                    </div>

                    {/* Signature block for the entrepreneur */}
                    <div className="border-t border-dashed border-slate-300 pt-8 flex justify-between text-xs text-slate-550 italic">
                      <div>
                        Fait à d'Immatriculation professionnelle, le {new Date().toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-right w-64 pr-12 pb-16">
                        Signature et Sceau de l'EI :
                        <div className="border border-slate-200 h-16 w-full mt-2 rounded bg-slate-50/20" />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AccountingManager;

