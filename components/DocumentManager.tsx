import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderClosed, FileText, UploadCloud, Trash2, Eye, Download, 
  Sparkles, Plus, Search, Filter, CheckCircle2, AlertCircle, 
  Calendar, Info, ExternalLink, Layers, ClipboardCopy, Tag, 
  ChevronRight, FileCode, Check, RefreshCw, X, AlertTriangle
} from 'lucide-react';
import { Invoice, Expense, Client, Supplier, UserProfile, SecureDocument } from '../types';
import { analyzeReceiptOCR, OCRResult } from '../services/geminiService';

interface DocumentManagerProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  clients: Client[];
  suppliers: Supplier[];
  userProfile: UserProfile;
  setView: (view: any) => void;
}

interface CustomDocument {
  id: string;
  name: string;
  category: 'invoice_quote' | 'expense_receipt' | 'administrative' | 'other';
  uploadDate: string;
  size: string;
  fileType: string;
  notes?: string;
  fileData?: string; // base64 / text placeholder
  linkedInvoiceId?: string;
  linkedExpenseId?: string;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({
  invoices,
  setInvoices,
  expenses,
  setExpenses,
  clients,
  suppliers,
  userProfile,
  setView
}) => {
  // --- STATE ---
  const [customDocs, setCustomDocs] = useState<CustomDocument[]>(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email');
      if (email) {
        const cleanEmail = email.replace(/[@.]/g, '_');
        const saved = localStorage.getItem(`autogest_${cleanEmail}_custom_documents`);
        return saved ? JSON.parse(saved) : [
          {
            id: 'doc-kbis',
            name: 'Extrait_KBIS_MicroEntreprise.pdf',
            category: 'administrative',
            uploadDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            size: '412 KB',
            fileType: 'pdf',
            notes: 'KBIS officiel pour les démarches administratives et bancaires.'
          },
          {
            id: 'doc-rcpro',
            name: 'Attestation_Assurance_RC_Pro_2026.pdf',
            category: 'administrative',
            uploadDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            size: '1.2 MB',
            fileType: 'pdf',
            notes: 'Responsabilité Civile Professionnelle souscrite pour l\'année fiscale en cours.'
          },
          {
            id: 'doc-rib',
            name: 'RIB_Bancaire_Professionnel_Pro.pdf',
            category: 'administrative',
            uploadDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            size: '155 KB',
            fileType: 'pdf',
            notes: 'RIB de mon compte bancaire dédié à l\'activité freelance.'
          }
        ];
      }
    }
    return [];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dragActive, setDragActive] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // New Document upload form state
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<CustomDocument['category']>('administrative');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [newDocFile, setNewDocFile] = useState<{ name: string; size: string; type: string; base64?: string } | null>(null);
  
  // OCR processing state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  
  // File previewer state
  const [previewDoc, setPreviewDoc] = useState<{ name: string; category: string; date: string; size: string; notes?: string; fileType: string; isGenerated?: boolean; invoiceData?: Invoice; expenseData?: Expense } | null>(null);

  // Save custom documents to localstorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email');
      if (email) {
        const cleanEmail = email.replace(/[@.]/g, '_');
        localStorage.setItem(`autogest_${cleanEmail}_custom_documents`, JSON.stringify(customDocs));
      }
    }
  }, [customDocs]);

  // --- MERGED LIST OF ALL DOCUMENTS ---
  // To keep "all documents of the application in one page", we merge:
  // 1. Manually uploaded documents (customDocs)
  // 2. Application Invoices & Quotes (auto-populated and synchronized from `invoices`)
  // 3. Application Expenses (auto-populated and synchronized from `expenses`)
  const allMergedDocuments = useMemo(() => {
    const list: any[] = [];

    // Add manual docs
    customDocs.forEach(d => {
      list.push({
        ...d,
        id: `custom-${d.id}`,
        source: 'manual',
        icon: FileText,
        displayCategory: d.category === 'administrative' ? 'Administratif' : 
                         d.category === 'expense_receipt' ? 'Justificatif' :
                         d.category === 'invoice_quote' ? 'Facture / Devis' : 'Modèle & Autre'
      });
    });

    // Add invoices
    invoices.forEach(inv => {
      const isQuote = inv.type === 'quote';
      const label = isQuote ? 'Devis émis' : 'Facture émise';
      list.push({
        id: `invoice-${inv.id}`,
        name: `${isQuote ? 'Devis' : 'Facture'}_${inv.number}.pdf`,
        category: 'invoice_quote',
        uploadDate: inv.date,
        size: 'Autogénéré (PDF)',
        fileType: 'pdf',
        notes: `Document émis dans l'application pour le client : ${
          clients.find(c => c.id === inv.clientId)?.name || 'Client inconnu'
        }. Statut : ${inv.status}.`,
        source: 'app_invoice',
        invoiceData: inv,
        displayCategory: 'Facture / Devis',
        icon: FileText
      });
    });

    // Add expenses
    expenses.forEach(exp => {
      list.push({
        id: `expense-${exp.id}`,
        name: `Justificatif_Dépense_${exp.description.replace(/\s+/g, '_')}.pdf`,
        category: 'expense_receipt',
        uploadDate: exp.date,
        size: 'Lié à une dépense',
        fileType: 'pdf',
        notes: `Justificatif lié à la dépense "${exp.description}" de catégorie "${exp.category}". Fournisseur : ${
          suppliers.find(s => s.id === exp.supplierId)?.name || 'Non spécifié'
        }. Montant : ${exp.amount.toFixed(2)} €.`,
        source: 'app_expense',
        expenseData: exp,
        displayCategory: 'Justificatif',
        icon: FileText
      });
    });

    return list;
  }, [customDocs, invoices, expenses, clients, suppliers]);

  // --- FILTERED DOCUMENTS ---
  const filteredDocuments = useMemo(() => {
    return allMergedDocuments.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allMergedDocuments, searchTerm, selectedCategory]);

  // --- STATS / COUNTERS ---
  const categoryStats = useMemo(() => {
    const counts = {
      all: allMergedDocuments.length,
      administrative: allMergedDocuments.filter(d => d.category === 'administrative').length,
      expense_receipt: allMergedDocuments.filter(d => d.category === 'expense_receipt').length,
      invoice_quote: allMergedDocuments.filter(d => d.category === 'invoice_quote').length,
      other: allMergedDocuments.filter(d => d.category === 'other').length,
    };
    return counts;
  }, [allMergedDocuments]);

  // --- UPLOAD HANDLERS ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(0)} KB`;
    
    const ext = file.name.split('.').pop() || 'pdf';
    
    // Convert to Base64 if image for OCR option
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewDocFile({
          name: file.name,
          size: sizeStr,
          type: ext,
          base64: event.target?.result?.toString().split(',')[1] // only base64 string
        });
      };
      reader.readAsDataURL(file);
    } else {
      setNewDocFile({
        name: file.name,
        size: sizeStr,
        type: ext
      });
    }

    if (!newDocName) {
      setNewDocName(file.name);
    }
  };

  const handleSaveDocument = () => {
    if (!newDocName || !newDocFile) {
      alert("Veuillez sélectionner un fichier et lui attribuer un nom.");
      return;
    }

    const newDoc: CustomDocument = {
      id: `doc-${Date.now()}`,
      name: newDocName,
      category: newDocCategory,
      uploadDate: new Date().toISOString().split('T')[0],
      size: newDocFile.size,
      fileType: newDocFile.type,
      notes: newDocNotes,
      fileData: newDocFile.base64
    };

    setCustomDocs([newDoc, ...customDocs]);
    
    // Clear and close
    resetUploadForm();
    setUploadModalOpen(false);
  };

  const resetUploadForm = () => {
    setNewDocName('');
    setNewDocCategory('administrative');
    setNewDocNotes('');
    setNewDocFile(null);
    setOcrResult(null);
    setOcrError(null);
  };

  // --- GEMINI OCR ANALYSIS HANDLER ---
  const handleTriggerOCR = async () => {
    if (!newDocFile?.base64) {
      setOcrError("Veuillez charger une image de reçu (JPG, PNG) pour pouvoir l'analyser avec l'IA.");
      return;
    }

    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);

    try {
      // Find API keys from user profile
      const userApiKey = userProfile.aiGeminiApiKey || userProfile.aiApiKey;
      const mimeType = newDocFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      const result = await analyzeReceiptOCR(newDocFile.base64, mimeType, userApiKey);
      setOcrResult(result);
      
      // Auto fill inputs if possible
      if (result.description) {
        setNewDocName(`Justificatif_${result.supplierName || 'Fournisseur'}_${result.date || 'Inconnu'}.${newDocFile.type}`);
        setNewDocNotes(`Extrait par OCR Gemini :
• Date : ${result.date}
• Fournisseur : ${result.supplierName}
• Montant : ${result.amount} €
• Catégorie : ${result.category}
• TVA : ${result.tvaAmount || '0'} €
• Intitulé : ${result.description}`);
        setNewDocCategory('expense_receipt');
      }
    } catch (e: any) {
      console.error(e);
      setOcrError(e.message || "Erreur inconnue lors du scan OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  // --- RECORD AS APPLICATION EXPENSE DIRECTLY ---
  const handleRecordExpenseDirectly = () => {
    if (!ocrResult) return;

    // Try to find supplier by name, or create a mock supplier ID
    let foundSupplierId = '';
    if (ocrResult.supplierName) {
      const match = suppliers.find(s => s.name.toLowerCase().includes(ocrResult.supplierName!.toLowerCase()));
      if (match) foundSupplierId = match.id;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: ocrResult.date || new Date().toISOString().split('T')[0],
      description: ocrResult.description || `Achat chez ${ocrResult.supplierName || 'Fournisseur'}`,
      amount: ocrResult.amount || 0,
      category: ocrResult.category || 'Autre',
      supplierId: foundSupplierId || undefined
    };

    setExpenses(prev => [newExpense, ...prev]);

    // Save custom doc too
    const newDoc: CustomDocument = {
      id: `doc-${Date.now()}`,
      name: newDocName || `Reçu_${ocrResult.supplierName || 'Dépense'}.png`,
      category: 'expense_receipt',
      uploadDate: new Date().toISOString().split('T')[0],
      size: newDocFile?.size || 'N/A',
      fileType: newDocFile?.type || 'png',
      notes: `Lié à la dépense créée en un clic : ${newExpense.description} (${newExpense.amount} €)`,
      fileData: newDocFile?.base64,
      linkedExpenseId: newExpense.id
    };

    setCustomDocs([newDoc, ...customDocs]);
    resetUploadForm();
    setUploadModalOpen(false);
    
    alert(`Succès ! La dépense a été ajoutée automatiquement à votre comptabilité et le justificatif a été archivé.`);
  };

  const handleDeleteDocument = (id: string, name: string) => {
    if (confirm(`Voulez-vous vraiment supprimer définitivement le document "${name}" ?`)) {
      if (id.startsWith('custom-')) {
        const realId = id.replace('custom-', '');
        setCustomDocs(customDocs.filter(d => d.id !== realId));
      } else {
        alert("Les documents autogénérés (factures de l'application, etc.) ne peuvent être supprimés que depuis leurs gestionnaires respectifs pour garantir la conformité comptable.");
      }
    }
  };

  // Theme support classes
  const currentTheme = userProfile?.themeColor || 'blue';
  const themeStyles: Record<string, { text: string; bg: string; border: string; hover: string; fill: string; btn: string }> = {
    blue: { text: 'text-blue-600', bg: 'bg-blue-50/50', border: 'border-blue-100', hover: 'hover:bg-blue-50', fill: 'bg-blue-600', btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' },
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-100', hover: 'hover:bg-emerald-50', fill: 'bg-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' },
    violet: { text: 'text-indigo-600', bg: 'bg-indigo-50/50', border: 'border-indigo-100', hover: 'hover:bg-indigo-50', fill: 'bg-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' },
    amber: { text: 'text-amber-600', bg: 'bg-amber-50/50', border: 'border-amber-100', hover: 'hover:bg-amber-50', fill: 'bg-amber-600', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' },
    neutral: { text: 'text-slate-900', bg: 'bg-slate-100', border: 'border-slate-200', hover: 'hover:bg-slate-100', fill: 'bg-slate-900', btn: 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/10' }
  };
  const ts = themeStyles[currentTheme] || themeStyles.blue;

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className={`text-xs font-extrabold uppercase tracking-widest ${ts.text} block mb-1.5`}>Archives de l'activité</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FolderClosed className={ts.text} size={28} />
            Gestionnaire de Documents
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed max-w-xl">
            Retrouvez tous les documents administratifs de votre micro-entreprise, justificatifs de dépenses et factures générées, réunis et synchronisés au même endroit.
          </p>
        </div>

        <button
          onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}
          className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold text-white rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg ${ts.btn}`}
        >
          <UploadCloud size={16} />
          Ajouter un Document / Reçu
        </button>
      </div>

      {/* QUICK STATISTICS / BENTO COUNTERS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Tous les documents', key: 'all', count: categoryStats.all, icon: FolderClosed, bg: 'bg-slate-50 border-slate-150', iconColor: 'text-slate-600' },
          { label: 'Administratif', key: 'administrative', count: categoryStats.administrative, icon: Info, bg: 'bg-blue-50/40 border-blue-100', iconColor: 'text-blue-600' },
          { label: 'Justificatifs & Reçus', key: 'expense_receipt', count: categoryStats.expense_receipt, icon: Tag, bg: 'bg-teal-50/40 border-teal-100', iconColor: 'text-teal-600' },
          { label: 'Factures & Devis', key: 'invoice_quote', count: categoryStats.invoice_quote, icon: FileText, bg: 'bg-indigo-50/40 border-indigo-100', iconColor: 'text-indigo-600' },
          { label: 'Modèles & Autre', key: 'other', count: categoryStats.other, icon: Layers, bg: 'bg-amber-50/40 border-amber-100', iconColor: 'text-amber-600' }
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`text-left p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden ${
              selectedCategory === cat.key 
                ? 'bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-600/20' 
                : 'bg-white/50 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900 border-slate-100 dark:border-slate-800'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <div className={`p-2 rounded-xl ${cat.iconColor} bg-slate-100 dark:bg-slate-800`}>
                <cat.icon size={16} />
              </div>
              <span className="text-xl font-black font-mono text-slate-800 dark:text-slate-100">{cat.count}</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{cat.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* DOCUMENT SEARCH AND LIST AREA */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150/70 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* FILTERS TOOLBAR */}
        <div className="p-5 border-b border-slate-150/50 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par nom de fichier, notes de classement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 pl-10 pr-4 py-3 rounded-2xl outline-none border border-transparent focus:border-slate-200 dark:focus:border-slate-700 transition-colors font-medium"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold shrink-0">
            <Filter size={14} />
            <span>Filtre appliqué : </span>
            <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wide text-[9px] ${ts.text} ${ts.bg} border ${ts.border}`}>
              {selectedCategory === 'all' ? 'Tous' : 
               selectedCategory === 'administrative' ? 'Administratif' :
               selectedCategory === 'expense_receipt' ? 'Justificatifs' :
               selectedCategory === 'invoice_quote' ? 'Factures & Devis' : 'Modèles'}
            </span>
          </div>
        </div>

        {/* RESULTS GRID / TABLE */}
        {filteredDocuments.length === 0 ? (
          <div className="p-16 text-center max-w-sm mx-auto flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 mb-2">
              <FolderClosed size={24} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aucun document trouvé</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {searchTerm 
                ? "Aucune archive ne correspond à vos critères de recherche actuelle." 
                : "Commencez par ajouter vos documents professionnels (KBIS, assurances, etc.) ou importez des justificatifs de dépenses."}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="mt-3 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                Archiver mon premier document <ChevronRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDocuments.map(doc => {
              const dateObj = new Date(doc.uploadDate);
              const formattedDate = isNaN(dateObj.getTime()) ? doc.uploadDate : dateObj.toLocaleDateString('fr-FR', {
                year: 'numeric', month: 'short', day: 'numeric'
              });

              return (
                <div 
                  key={doc.id} 
                  className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  {/* Info Column */}
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 border ${
                      doc.category === 'administrative' ? 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20' :
                      doc.category === 'expense_receipt' ? 'text-teal-600 bg-teal-50 border-teal-100 dark:bg-teal-950/20' :
                      doc.category === 'invoice_quote' ? 'text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20' :
                      'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20'
                    }`}>
                      <doc.icon size={20} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:underline cursor-pointer block" onClick={() => setPreviewDoc(doc)}>
                          {doc.name}
                        </span>
                        <span className={`text-[8.5px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md border ${
                          doc.source === 'app_invoice' || doc.source === 'app_expense'
                            ? 'bg-purple-55 border-purple-100 text-purple-600'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {doc.source === 'app_invoice' ? 'Auto Devis/Facture' : 
                           doc.source === 'app_expense' ? 'Auto Justificatif' : 'Manuel'}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-xl">
                        {doc.notes || "Aucune note ajoutée à ce document d'archive."}
                      </p>
                      
                      <div className="flex items-center gap-3.5 text-[10px] text-slate-400 font-semibold pt-0.5">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {formattedDate}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>Catégorie : <strong>{doc.displayCategory}</strong></span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>Taille : <strong>{doc.size}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-end gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Visualiser le document"
                    >
                      <Eye size={16} />
                    </button>
                    
                    {doc.source === 'manual' && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                        className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/30 rounded-xl transition-all cursor-pointer"
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {doc.source === 'app_invoice' && (
                      <button
                        onClick={() => { setSelectedCategory('invoice_quote'); setView('invoices'); }}
                        className="text-[10px] font-bold text-indigo-600 hover:underline bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1"
                      >
                        Accéder <ExternalLink size={10} />
                      </button>
                    )}

                    {doc.source === 'app_expense' && (
                      <button
                        onClick={() => { setSelectedCategory('expense_receipt'); setView('accounting'); }}
                        className="text-[10px] font-bold text-teal-600 hover:underline bg-teal-50 hover:bg-teal-100/70 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1"
                      >
                        Comptabilité <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL : UPLOAD / ADD NEW DOCUMENT WITH GEMINI OCR */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud size={18} className="text-blue-600 animate-pulse" />
                Archiver un document professionnel
              </h3>
              <button 
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload form / drag & drop */}
            <div className="space-y-4 text-xs">
              {!newDocFile ? (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50/50' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 bg-slate-50/40 dark:bg-slate-800/40'
                  }`}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                  <div className={`p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors`}>
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Glissez-déposez votre fichier ici</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">ou cliquez pour parcourir votre ordinateur</span>
                  </div>
                  <span className="text-[9px] text-slate-400">PDF, PNG, JPG ou DOC (Max. 5 MB)</span>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-150 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 rounded-xl bg-blue-105 text-blue-600 shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{newDocFile.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{newDocFile.size} • .{newDocFile.type}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => resetUploadForm()}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Form elements if file is ready */}
              {newDocFile && (
                <div className="space-y-4 pt-1">
                  {/* OCR Assistant trigger for Images */}
                  {newDocFile.base64 && (
                    <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                      <div className="space-y-1">
                        <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-blue-600 animate-pulse" />
                          Assistant OCR intelligent (Gemini IA)
                        </span>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          S'il s'agit d'un reçu, l'IA peut lire le montant, la date, le fournisseur et l'ajouter à votre comptabilité en 1 clic.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={ocrLoading}
                        onClick={handleTriggerOCR}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {ocrLoading ? (
                          <>
                            <RefreshCw className="animate-spin" size={12} />
                            Analyse en cours...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Lancer le scan OCR
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* OCR Error Alert */}
                  {ocrError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10.5px] text-rose-700 flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>{ocrError}</span>
                    </div>
                  )}

                  {/* OCR SUCCESS & REC EXPENSE TRIGGER */}
                  {ocrResult && (
                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl space-y-3 animate-fade-in text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-teal-800">
                        <CheckCircle2 size={16} className="text-teal-600" />
                        Données comptables extraites par Gemini !
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600 font-semibold bg-white p-3 rounded-xl border border-teal-50">
                        <div>Date : <span className="text-slate-900 font-mono">{ocrResult.date}</span></div>
                        <div>Montant : <span className="text-slate-900 font-mono">{ocrResult.amount?.toFixed(2)} €</span></div>
                        <div>Fournisseur : <span className="text-slate-900">{ocrResult.supplierName}</span></div>
                        <div>TVA : <span className="text-slate-900 font-mono">{(ocrResult.tvaAmount || 0).toFixed(2)} €</span></div>
                        <div className="col-span-2 pt-1 border-t border-slate-100 mt-1">
                          Description : <span className="text-slate-900 font-normal italic">"{ocrResult.description}"</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-400">Voulez-vous aussi enregistrer cette dépense ?</span>
                        <button
                          type="button"
                          onClick={handleRecordExpenseDirectly}
                          className="px-3.5 py-1.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all text-[10px] flex items-center gap-1"
                        >
                          Oui, enregistrer la dépense et classer <Check size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Doc Title */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block">Nom d'archivage du document</label>
                      <input
                        type="text"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="Ex: Facture_Abonnement_Github.pdf"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none font-medium text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* Category Selector */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block">Catégorie de document</label>
                      <select
                        value={newDocCategory}
                        onChange={(e) => setNewDocCategory(e.target.value as CustomDocument['category'])}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none font-medium text-slate-800 dark:text-slate-100"
                      >
                        <option value="administrative">Administratif (KBIS, assurances, URSSAF)</option>
                        <option value="expense_receipt">Justificatif de dépense / Reçu de frais</option>
                        <option value="invoice_quote">Facture ou Devis (Externe ou archive)</option>
                        <option value="other">Modèles & Autre (RIB, CGV, contrats)</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes & tags */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block">Notes internes & classement (Optionnel)</label>
                    <textarea
                      value={newDocNotes}
                      onChange={(e) => setNewDocNotes(e.target.value)}
                      rows={3}
                      placeholder="Ajoutez des notes explicatives pour vous y retrouver plus facilement ou à l'attention de votre expert-comptable."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveDocument}
                disabled={!newDocFile}
                className={`px-5 py-2.5 text-white rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 ${ts.btn}`}
              >
                Enregistrer dans mes archives <Check size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : PREVIEW DOCUMENT */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600">Visualisation Archivée</span>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText size={16} className="text-blue-600" />
                  {previewDoc.name}
                </h3>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Document Content Box */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[250px] relative text-center">
              {previewDoc.fileType === 'png' || previewDoc.fileType === 'jpg' || previewDoc.fileType === 'jpeg' ? (
                previewDoc.fileData ? (
                  <img 
                    src={`data:image/${previewDoc.fileType};base64,${previewDoc.fileData}`} 
                    alt={previewDoc.name} 
                    className="max-h-[350px] w-auto rounded-lg shadow border border-slate-100" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="space-y-2">
                    <FileCode size={48} className="text-slate-300 mx-auto" />
                    <span className="text-[11px] text-slate-400 font-semibold block">Aperçu indisponible hors-ligne</span>
                  </div>
                )
              ) : (
                <div className="space-y-3 p-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center mx-auto mb-1">
                    <FileText size={32} />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block text-xs">{previewDoc.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{previewDoc.size} • Format .{previewDoc.fileType}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800 max-w-sm mx-auto text-[10.5px] text-slate-500 leading-relaxed font-medium">
                    Ce document est stocké en toute sécurité dans l'environnement de votre micro-entreprise française.
                  </div>
                </div>
              )}
            </div>

            {/* Metadata information list */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 text-[11px] space-y-3">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block text-[9.5px]">Notes d'Archivage & Contexte</span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                {previewDoc.notes || "Aucune note interne enregistrée sur cette pièce justificative."}
              </p>
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center text-slate-400 font-bold">
                <span>Date d'archivage : {previewDoc.date || previewDoc.uploadDate}</span>
                <span>Taille : {previewDoc.size}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 text-xs font-bold pt-1">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Fermer
              </button>
              
              <button
                onClick={() => {
                  // Simulate download by displaying simulated action
                  alert(`Téléchargement de "${previewDoc.name}" simulé avec succès !`);
                }}
                className={`px-5 py-2 text-white rounded-xl transition-all flex items-center gap-1.5 ${ts.btn}`}
              >
                <Download size={14} /> Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
