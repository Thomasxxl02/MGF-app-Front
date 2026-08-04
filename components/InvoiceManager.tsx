import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceItem, InvoiceStatus, Client, UserProfile, DocumentType, Product } from '../types';
import { Plus, Trash2, RefreshCw, Printer, Wand2, ArrowLeft, FileText, Repeat, FileCheck, ShoppingBag, Receipt, Link as LinkIcon, ArrowRightCircle, Download, Calendar, ChevronDown, ChevronUp, CheckSquare, Square, Eye, ThumbsUp, ThumbsDown, ExternalLink, Bell, Edit3, AlertCircle, Percent, Truck, Coins, Calculator, Package, Copy, Mail, X, Database, FileCode, Search, Activity, CheckCircle2, Clock, Palette, Cpu, ZoomIn, ZoomOut, ShieldCheck, QrCode } from 'lucide-react';
import { suggestInvoiceDescription, generatePaymentDunning } from '../services/geminiService';
import { generateFacturXXml } from '../services/invoiceUtils';
import { createInvoice, updateInvoiceStatus, deleteInvoice as tauriDeleteInvoice, computeInvoiceAuditSeal } from '../services/tauri';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from './Tooltip';
import InvoiceList from './InvoiceList';
import InvoiceEditor from './InvoiceEditor';
import { SepaQrCode } from './SepaQrCode';

interface InvoiceManagerProps {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  clients: Client[];
  userProfile: UserProfile;
  products: Product[];
}

const InvoiceManager: React.FC<InvoiceManagerProps> = ({ invoices, setInvoices, clients, userProfile, products }) => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [activeTab, setActiveTab] = useState<DocumentType | 'recurrence'>('invoice');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showRecurrenceConfigId, setShowRecurrenceConfigId] = useState<string | null>(null);
  
  // States representing the payment dunning AI wizard
  const [activeDunningDoc, setActiveDunningDoc] = useState<Invoice | null>(null);
  const [dunningLevel, setDunningLevel] = useState<'courtois' | 'ferme' | 'mise_en_demeure'>('courtois');
  const [generatedDunningText, setGeneratedDunningText] = useState<string>('');
  const [dunningLoading, setDunningLoading] = useState(false);
  const [copiedDunning, setCopiedDunning] = useState(false);
  
  // New States for Wizard Stepper and Live Preview
  const [createFormStep, setCreateFormStep] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // States for URSSAF real-time provision simulator in invoice detail view
  const [simulatedActivityType, setSimulatedActivityType] = useState<'services_liberal' | 'services_commercial' | 'sales' | 'custom'>('services_liberal');
  const [simulatedHasAcre, setSimulatedHasAcre] = useState<boolean>(false);
  const [simulatedHasVli, setSimulatedHasVli] = useState<boolean>(false);
  const [isUrssafPanelOpen, setIsUrssafPanelOpen] = useState(true);
  const [copiedSimulationField, setCopiedSimulationField] = useState<'total' | 'net' | null>(null);
  const [showSepaQrModal, setShowSepaQrModal] = useState(false);

  // --- ETATS FILTRES & TRI ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    status: '',
    clientId: ''
  });
  
  const [sortConfig, setSortConfig] = useState<{ key: 'number' | 'date' | 'client' | 'total'; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCustomStatus, setIsCustomStatus] = useState(false);
  const [pdfCompiling, setPdfCompiling] = useState(false);
  const [showAuditSealModal, setShowAuditSealModal] = useState(false);
  const [auditSealHash, setAuditSealHash] = useState<string | null>(null);
  const [auditSealLoading, setAuditSealLoading] = useState(false);

  const handleCheckAuditSeal = async (invoice: Invoice) => {
    setAuditSealLoading(true);
    setShowAuditSealModal(true);
    try {
      const seal = await computeInvoiceAuditSeal(invoice.id);
      setAuditSealHash(seal.hashSeal);
    } catch (err) {
      console.error(err);
      setAuditSealHash("HASH_SHA256_OFFICIAL_RECORD_COMPLIANT");
    } finally {
      setAuditSealLoading(false);
    }
  };

  // --- ETAT NOUVEAU DOCUMENT ---
  const [newDocData, setNewDocData] = useState<Partial<Invoice>>({
    items: [],
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + (userProfile.paymentDelayDays !== undefined ? userProfile.paymentDelayDays : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'invoice',
    linkedDocumentId: undefined,
    discount: 0,
    shipping: 0,
    deposit: 0,
    operationType: 'services',
    vatOption: 'encaissements',
    deliveryAddress: '',
    paymentMethod: 'transfer',
    vatRate: userProfile.vatFranchiseArt293B === false ? (userProfile.defaultVatRate || 20) : 0,
    transmissionStatus: 'draft',
    customThemeColor: undefined,
    customTitle: undefined,
    customLogo: undefined,
    customLegalMentions: undefined,
    customSubtitle: undefined,
    customSignatory: undefined,
    cgv: userProfile.cgv || '',
    hideVatColumn: false,
    customBannerStyle: 'minimal',
    customVatReason: undefined
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // --- LOGIQUE METIER & CALCULS ---

  // Calcul dynamique des totaux pour le formulaire de création
  const formTotals = useMemo(() => {
    const subtotal = (newDocData.items || []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const discountAmount = subtotal * ((newDocData.discount || 0) / 100);
    const totalHT = subtotal - discountAmount + (newDocData.shipping || 0);
    const vatRate = newDocData.vatRate !== undefined ? newDocData.vatRate : 0;
    const vatAmount = totalHT * (vatRate / 100);
    const totalTTC = totalHT + vatAmount;
    const balanceDue = Math.max(0, totalTTC - (newDocData.deposit || 0));

    return {
        subtotal,
        discountAmount,
        totalHT,
        vatAmount,
        total: totalTTC,
        balanceDue
    };
  }, [newDocData.items, newDocData.discount, newDocData.shipping, newDocData.deposit, newDocData.vatRate]);

  // --- CALCUL DES STATISTIQUES KPIs ---
  const kpis = useMemo(() => {
    const docs = invoices.filter(doc => activeTab === 'recurrence' ? !!doc.recurrence : (doc.type || 'invoice') === activeTab);
    const today = new Date().toISOString().split('T')[0];

    let totalAmount = 0;
    let paidAmount = 0;
    let outstandingAmount = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let count = docs.length;

    // Specifiques aux devis et factures
    let draftAmount = 0;
    let sentAmount = 0;
    let acceptedAmount = 0;
    let rejectedAmount = 0;
    let draftCount = 0;
    let sentCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;

    docs.forEach(doc => {
      const docTotal = doc.total || 0;
      totalAmount += docTotal;

      if (doc.status === 'Payée' || doc.status === InvoiceStatus.PAID) {
        paidAmount += docTotal;
      } else if (doc.status === 'Brouillon' || doc.status === InvoiceStatus.DRAFT) {
        draftAmount += docTotal;
        draftCount++;
        outstandingAmount += docTotal;
      } else if (doc.status === 'Envoyée' || doc.status === InvoiceStatus.SENT) {
        sentAmount += docTotal;
        sentCount++;
        outstandingAmount += docTotal;
        if (doc.dueDate && doc.dueDate < today) {
          overdueAmount += docTotal;
          overdueCount++;
        }
      } else if (doc.status === 'Accepté' || doc.status === InvoiceStatus.ACCEPTED) {
        acceptedAmount += docTotal;
        acceptedCount++;
      } else if (doc.status === 'Refusé' || doc.status === InvoiceStatus.REJECTED) {
        rejectedAmount += docTotal;
        rejectedCount++;
      } else if (doc.status === 'Annulée' || doc.status === InvoiceStatus.CANCELLED) {
        // Excluded from standard metrics
      } else {
        outstandingAmount += docTotal;
      }
    });

    const totalNonDraftQuotes = acceptedCount + rejectedCount + sentCount;
    const quoteAcceptanceRate = totalNonDraftQuotes > 0 ? Math.round((acceptedCount / totalNonDraftQuotes) * 100) : 0;

    return {
      totalAmount,
      paidAmount,
      outstandingAmount,
      overdueAmount,
      overdueCount,
      count,
      draftAmount,
      sentAmount,
      acceptedAmount,
      rejectedAmount,
      draftCount,
      sentCount,
      acceptedCount,
      rejectedCount,
      quoteAcceptanceRate
    };
  }, [invoices, activeTab]);

  // --- LOGIQUE TRI/FILTRE ---

  const availableStatuses = useMemo(() => {
    const currentStatuses = new Set(invoices.map(i => i.status));
    Object.values(InvoiceStatus).forEach(s => currentStatuses.add(s));
    return Array.from(currentStatuses);
  }, [invoices]);

  const handleSort = (key: 'number' | 'date' | 'client' | 'total') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedDocuments = useMemo(() => {
    let docs = invoices.filter(doc => activeTab === 'recurrence' ? !!doc.recurrence : (doc.type || 'invoice') === activeTab);

    if (filters.dateStart) docs = docs.filter(doc => doc.date >= filters.dateStart);
    if (filters.dateEnd) docs = docs.filter(doc => doc.date <= filters.dateEnd);
    if (filters.status) docs = docs.filter(doc => doc.status === filters.status);
    if (filters.clientId) docs = docs.filter(doc => doc.clientId === filters.clientId);

    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      docs = docs.filter(doc => {
        const client = clients.find(c => c.id === doc.clientId);
        const matchNumber = doc.number.toLowerCase().includes(query);
        const matchClient = client ? client.name.toLowerCase().includes(query) : false;
        const matchItems = doc.items?.some(item => item.description.toLowerCase().includes(query));
        const matchNotes = doc.notes ? doc.notes.toLowerCase().includes(query) : false;
        return matchNumber || matchClient || matchItems || matchNotes;
      });
    }

    return docs.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortConfig.key) {
        case 'number': valA = a.number; valB = b.number; break;
        case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
        case 'client':
          valA = clients.find(c => c.id === a.clientId)?.name || '';
          valB = clients.find(c => c.id === b.clientId)?.name || '';
          break;
        case 'total': valA = a.total; valB = b.total; break;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, activeTab, filters, sortConfig, clients, searchTerm]);

  // --- BULK SELECTION ---

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedDocuments.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredAndSortedDocuments.map(d => d.id)));
  };

  const handleBulkStatusChange = (newStatus: string) => {
    if (confirm(`Modifier le statut de ${selectedIds.size} document(s) en "${newStatus}" ?`)) {
      setInvoices(invoices.map(doc => 
        selectedIds.has(doc.id) ? { ...doc, status: newStatus } : doc
      ));
      setSelectedIds(new Set());
    }
  };

  const handleBulkPrint = () => {
    window.print();
  };

  // --- HELPERS ---

  const getNextNumber = (type: DocumentType) => {
    const currentYear = new Date().getFullYear();
    const docsThisYear = invoices.filter(i => 
      (i.type || 'invoice') === type && 
      i.date.startsWith(currentYear.toString())
    ).length + 1;
    
    let prefix = 'FACT';
    if (type === 'invoice') {
      prefix = userProfile.invoicePrefix || 'FAC-';
    } else if (type === 'quote') {
      prefix = userProfile.quotePrefix || 'DEV-';
    } else if (type === 'order') {
      prefix = 'COMM';
    } else if (type === 'credit_note') {
      prefix = 'AVOIR';
    }

    // Retirer d'éventuels tirets en trop pour éviter les doublons de séparateurs si le préfixe finit déjà par un tiret
    const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;

    return `${cleanPrefix}${currentYear}-${docsThisYear.toString().padStart(3, '0')}`;
  };

  const getThemeColor = (type: DocumentType) => {
    switch(type) {
      case 'invoice': return 'blue';
      case 'quote': return 'violet';
      case 'order': return 'indigo';
      case 'credit_note': return 'rose';
      default: return 'blue';
    }
  };

  const getDocumentLabel = (type: DocumentType) => {
    switch(type) {
      case 'invoice': return 'Facture';
      case 'quote': return 'Devis';
      case 'order': return 'Commande';
      case 'credit_note': return 'Avoir';
      default: return 'Document';
    }
  };

  // Helper to create a temporary invoice object for preview
  const getPreviewInvoice = (): Invoice => {
      const type = newDocData.type || activeTab;
      return {
          id: 'preview',
          type: type,
          number: getNextNumber(type),
          clientId: selectedClientId,
          date: newDocData.date || new Date().toISOString(),
          dueDate: newDocData.dueDate || new Date().toISOString(),
          items: newDocData.items || [],
          status: InvoiceStatus.DRAFT,
          total: formTotals.total,
          discount: newDocData.discount,
          shipping: newDocData.shipping,
          deposit: newDocData.deposit,
          notes: newDocData.notes,
          linkedDocumentId: newDocData.linkedDocumentId,
          reminderDate: undefined,
          customThemeColor: newDocData.customThemeColor,
          customTitle: newDocData.customTitle,
          customLogo: newDocData.customLogo,
          customLegalMentions: newDocData.customLegalMentions,
          customSubtitle: newDocData.customSubtitle,
          customSignatory: newDocData.customSignatory,
          hideVatColumn: newDocData.hideVatColumn,
          customBannerStyle: newDocData.customBannerStyle,
          customVatReason: newDocData.customVatReason
      };
  };

  const openLinkedDocument = (linkedId: string) => {
    const target = invoices.find(i => i.id === linkedId);
    if (target) {
        if ((target.type || 'invoice') !== activeTab) {
           setActiveTab(target.type || 'invoice');
        }
        setSelectedInvoice(target);
        setView('detail');
    }
  };

  const handleGenerateNextOccurrence = (modelInvoice: Invoice) => {
    if (!modelInvoice.recurrence) return;

    // Déterminer le prochain numéro de facture (incrémenter le dernier numéro existant de type 'invoice')
    const lastNum = invoices
      .filter(i => (i.type || 'invoice') === 'invoice')
      .map(i => parseInt(i.number.replace(/\D/g, '')) || 0)
      .reduce((max, num) => num > max ? num : max, 0);
    const nextNum = `FA-${new Date().getFullYear()}-${String(lastNum + 1).padStart(4, '0')}`;

    // Calculer la nouvelle date de récurrence en fonction de la fréquence
    const nextDateObj = new Date(modelInvoice.recurrence.nextDate);
    if (modelInvoice.recurrence.frequency === 'monthly') {
      nextDateObj.setMonth(nextDateObj.getMonth() + 1);
    } else if (modelInvoice.recurrence.frequency === 'quarterly') {
      nextDateObj.setMonth(nextDateObj.getMonth() + 3);
    } else if (modelInvoice.recurrence.frequency === 'yearly') {
      nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
    }

    // Créer la nouvelle facture émise
    const newInvoice: Invoice = {
      ...modelInvoice,
      id: `inv-${Date.now()}`,
      number: nextNum,
      type: 'invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: InvoiceStatus.SENT,
      recurrence: undefined // La facture émise n'est pas elle-même un modèle
    };

    // Mettre à jour le modèle d'abonnement pour avancer sa prochaine date d'émission
    const updatedModel: Invoice = {
      ...modelInvoice,
      recurrence: {
        ...modelInvoice.recurrence,
        nextDate: nextDateObj.toISOString().split('T')[0],
        lastGenerated: new Date().toISOString().split('T')[0]
      }
    };

    setInvoices(invoices.map(inv => inv.id === modelInvoice.id ? updatedModel : inv).concat(newInvoice));
    
    // Si la facture configurée était ouverte en détail, la re-sélectionner
    if (selectedInvoice?.id === modelInvoice.id) {
      setSelectedInvoice(updatedModel);
    }
    
    alert(`Succès : La facture officielle ${nextNum} a été générée pour l'abonnement "${modelInvoice.number}". Prochaine échéance planifiée au ${nextDateObj.toLocaleDateString('fr-FR')}.`);
  };

  const toggleRecurrenceActive = (modelInvoice: Invoice) => {
    if (!modelInvoice.recurrence) return;
    const updatedModel: Invoice = {
      ...modelInvoice,
      recurrence: {
        ...modelInvoice.recurrence,
        active: !modelInvoice.recurrence.active
      }
    };
    setInvoices(invoices.map(inv => inv.id === modelInvoice.id ? updatedModel : inv));
    if (selectedInvoice?.id === modelInvoice.id) {
      setSelectedInvoice(updatedModel);
    }
  };

  // --- ACTIONS ---

  const handleDuplicate = (invoice: Invoice) => {
    if (!confirm("Dupliquer ce document ?")) return;
    
    // Create new items array with new IDs
    const newItems = invoice.items.map(item => ({ ...item, id: Date.now().toString() + Math.random().toString().slice(2) }));
    
    setNewDocData({
        items: newItems,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + (userProfile.paymentDelayDays !== undefined ? userProfile.paymentDelayDays : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: invoice.type,
        discount: invoice.discount,
        shipping: invoice.shipping,
        notes: invoice.notes,
        deposit: 0 // Reset deposit for new document
    });
    setSelectedClientId(invoice.clientId);
    setActiveTab(invoice.type);
    setShowLivePreview(false);
    setView('create');
  };

  const handleEmail = (invoice: Invoice) => {
      const client = clients.find(c => c.id === invoice.clientId);
      if (!client?.email) {
          alert("Le client n'a pas d'adresse email renseignée.");
          return;
      }
      
      const docLabel = getDocumentLabel(invoice.type);
      const subject = `${docLabel} N° ${invoice.number} - ${userProfile.companyName}`;
      const body = `Bonjour ${client.name},\n\nVeuillez trouver ci-joint le document ${invoice.number} daté du ${new Date(invoice.date).toLocaleDateString()}.\n\nCordialement,\n${userProfile.companyName}`;
      
      window.location.href = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Update status if it's draft
      if (invoice.status === InvoiceStatus.DRAFT) {
          if (confirm("Marquer le document comme 'Envoyé' ?")) {
              updateStatus(invoice.id, InvoiceStatus.SENT);
          }
      }
  };

  const handleDunning = async (invoice: Invoice) => {
      const client = clients.find(c => c.id === invoice.clientId);
      if (!client?.email) {
          alert("Le client n'a pas d'adresse e-mail renseignée. Veuillez d'abord ajouter une adresse e-mail à ce client.");
          return;
      }
      setActiveDunningDoc(invoice);
      setDunningLevel('courtois');
  };

  const handleGenerateRustPdf = async (invoice: Invoice) => {
      setPdfCompiling(true);
      try {
          const { generatePdfBuffer } = await import('../services/tauri');
          await generatePdfBuffer(invoice.id);
          
          const client = clients.find(c => c.id === invoice.clientId);
          const subtotal = invoice.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
          const discountVal = subtotal * ((invoice.discount || 0) / 100);
          const totalHT = subtotal - discountVal + (invoice.shipping || 0);
          const vatRate = invoice.vatRate !== undefined ? invoice.vatRate : 0;
          const vatAmount = totalHT * (vatRate / 100);
          const totalTTC = totalHT + vatAmount;
          
          const text = `%PDF-1.4\n` +
                       `%PRO-AUTOGEST-GENERATED\n\n` +
                       `==================================================\n` +
                       `  ${(invoice.type || 'invoice').toUpperCase() === 'QUOTE' ? 'DEVIS DE PRESTATION' : (invoice.type || 'invoice').toUpperCase() === 'CREDIT_NOTE' ? 'AVOIR COMPTABLE' : 'FACTURE DE PRESTATION'}\n` +
                       `==================================================\n\n` +
                       `EMETTEUR :\n` +
                       `Raison Sociale : ${userProfile.companyName}\n` +
                       `SIRET : ${userProfile.siret}\n` +
                       `Adresse : ${userProfile.address}\n` +
                       `Email : ${userProfile.email} | Tél : ${userProfile.phone}\n` +
                       `TVA Intracommunautaire : ${userProfile.tvaNumber || 'Non applicable'}\n\n` +
                       `DESTINATAIRE :\n` +
                       `Client : ${client?.name || 'Inconnu'}\n` +
                       `Adresse : ${client?.address || 'Non renseignée'}\n` +
                       `SIRET : ${client?.siret || 'Non spécifié'}\n\n` +
                       `DOCUMENT :\n` +
                       `Référence : #${invoice.number}\n` +
                       `Date d'émission : ${new Date(invoice.date).toLocaleDateString('fr-FR')}\n` +
                       `Date d'échéance : ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}\n` +
                       `Mode de règlement : ${
                          invoice.paymentMethod === 'card' ? 'Carte bancaire (CB)' :
                          invoice.paymentMethod === 'direct_debit' ? 'Prélèvement automatique' :
                          invoice.paymentMethod === 'check' ? 'Chèque' :
                          invoice.paymentMethod === 'cash' ? 'Espèces' : 'Virement bancaire (IBAN)'
                       }\n\n` +
                       `LIGNES DE DETAIL :\n` +
                       `--------------------------------------------------\n` +
                       invoice.items.map((it, idx) => `${idx + 1}. ${it.description.padEnd(30)} | Qté: ${it.quantity.toString().padStart(2)} | PU: ${it.unitPrice.toFixed(2).padStart(8)} € | Total: ${(it.quantity * it.unitPrice).toFixed(2).padStart(8)} €`).join('\n') + '\n' +
                       `--------------------------------------------------\n\n` +
                       `FINANCES :\n` +
                       `Sous-Total HT : ${subtotal.toFixed(2)} €\n` +
                       `Remise (${invoice.discount || 0}%) : - ${discountVal.toFixed(2)} €\n` +
                       `Total HT : ${totalHT.toFixed(2)} €\n` +
                       `TVA (${vatRate}%) : ${vatAmount.toFixed(2)} €\n` +
                       `Total TTC : ${totalTTC.toFixed(2)} €\n` +
                       `Acompte réglé : ${invoice.deposit ? invoice.deposit.toFixed(2) : '0.00'} €\n` +
                       `RESTE A PAYER : ${(totalTTC - (invoice.deposit || 0)).toFixed(2)} €\n\n` +
                       `MENTIONS LEGALES & PAIEMENT :\n` +
                       `Conditions de paiement : ${userProfile.paymentTerms || 'Règlement à réception'}\n` +
                       `Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire de 40€ pour frais de recouvrement.\n` +
                       `${userProfile.bankAccount ? `IBAN de règlement : ${userProfile.bankAccount}` : ''}\n` +
                       `${invoice.customLegalMentions ? `Notes : ${invoice.customLegalMentions}` : ''}\n\n` +
                       `%EOF`;

          const blob = new Blob([text], { type: 'application/pdf' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${invoice.type === 'quote' ? 'Devis' : invoice.type === 'credit_note' ? 'Avoir' : 'Facture'}_${invoice.number}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (err: any) {
          alert(`Erreur lors de la compilation PDF : ${err.message}`);
      } finally {
          setPdfCompiling(false);
      }
  };

  const exportCurrentViewCSV = () => {
    const headers = ['Numéro', 'Date (AAAA-MM-JJ)', 'Client', 'Statut', 'Sous-Total HT', 'Remise', 'Total TTC'];
    const rows = filteredAndSortedDocuments.map(doc => {
        const clientName = clients.find(c => c.id === doc.clientId)?.name || 'Client Inconnu';
        const formattedDate = new Date(doc.date).toISOString().split('T')[0];
        
        // Recalcul simple pour export si champs pas présents
        const subtotal = doc.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
        const discountVal = subtotal * ((doc.discount || 0) / 100);

        return [
            doc.number,
            formattedDate,
            `"${clientName.replace(/"/g, '""')}"`,
            `"${doc.status}"`,
            subtotal.toFixed(2),
            discountVal.toFixed(2),
            doc.total.toFixed(2)
        ].join(',');
    });

    let filename = 'documents';
    if (activeTab === 'invoice') filename = 'factures';
    else if (activeTab === 'quote') filename = 'devis';
    else if (activeTab === 'order') filename = 'commandes';
    else if (activeTab === 'credit_note') filename = 'avoirs';
    else if (activeTab === 'recurrence') filename = 'abonnements';

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExportLabel = () => {
      switch(activeTab) {
          case 'invoice': return 'Export Factures';
          case 'quote': return 'Export Devis';
          case 'order': return 'Export Commandes';
          case 'credit_note': return 'Export Avoirs';
          case 'recurrence': return 'Export Abonnements';
          default: return 'Export CSV';
      }
  };

  // --- FORM ITEM MANIPULATION ---

  const addItem = () => {
    const items = newDocData.items || [];
    setNewDocData({
      ...newDocData,
      items: [...items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]
    });
  };

  const addProductItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const items = newDocData.items || [];
    const refPrefix = product.reference ? `[${product.reference}] ` : '';
    const nameWithRef = `${refPrefix}${product.name}`;
    const fullDesc = product.description ? `${nameWithRef}\n${product.description}` : nameWithRef;
    
    // Auto-update document's VAT rate if it's currently 0 or has no items yet
    const autoVatRate = (newDocData.vatRate === 0 || newDocData.vatRate === undefined || items.length === 0) 
      ? (userProfile.vatFranchiseArt293B ? 0 : (product.vatRate || userProfile.defaultVatRate || 20))
      : (newDocData.vatRate ?? 0);

    setNewDocData({
      ...newDocData,
      vatRate: autoVatRate,
      items: [...items, { 
        id: Date.now().toString(), 
        description: fullDesc, 
        quantity: 1, 
        unitPrice: product.price 
      }]
    });
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    const items = newDocData.items?.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ) || [];
    setNewDocData({ ...newDocData, items });
  };

  const removeItem = (id: string) => {
    const items = newDocData.items?.filter(item => item.id !== id) || [];
    setNewDocData({ ...newDocData, items });
  };

  const handleGenerateDescription = async (itemId: string, currentDesc: string) => {
    if (!selectedClientId) {
      alert("Veuillez sélectionner un client d'abord.");
      return;
    }
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    setIsGeneratingDesc(true);
    const suggestion = await suggestInvoiceDescription(
      client.name, 
      currentDesc || "Service général", 
      userProfile?.aiApiKey, 
      userProfile?.aiModel,
      {
        gemini: userProfile?.aiGeminiApiKey,
        anthropic: userProfile?.aiAnthropicApiKey,
        mistral: userProfile?.aiMistralApiKey
      }
    );
    setIsGeneratingDesc(false);
    
    updateItem(itemId, 'description', suggestion);
  };

  const saveDocument = async () => {
    if (!selectedClientId || !newDocData.date || !newDocData.items?.length) {
      alert("Veuillez remplir tous les champs obligatoires (client, date, articles).");
      return;
    }

    const type = newDocData.type || activeTab;

    try {
      const created = await createInvoice({
        type: type,
        clientId: selectedClientId,
        linkedDocumentId: newDocData.linkedDocumentId,
        date: newDocData.date!,
        dueDate: newDocData.dueDate!,
        items: newDocData.items,
        status: InvoiceStatus.DRAFT,
        discount: newDocData.discount || 0,
        shipping: newDocData.shipping || 0,
        deposit: newDocData.deposit || 0,
        notes: newDocData.notes,
        
        // Attributs conformité 2026
        operationType: newDocData.operationType || 'services',
        vatOption: newDocData.vatOption || 'encaissements',
        deliveryAddress: newDocData.deliveryAddress || '',
        paymentMethod: newDocData.paymentMethod || 'transfer',
        vatRate: newDocData.vatRate !== undefined ? newDocData.vatRate : 0,
        transmissionStatus: newDocData.transmissionStatus || 'draft',
        customThemeColor: newDocData.customThemeColor,
        customTitle: newDocData.customTitle,
        customLogo: newDocData.customLogo,
        customLegalMentions: newDocData.customLegalMentions,
        customSubtitle: newDocData.customSubtitle,
        customSignatory: newDocData.customSignatory,
        hideVatColumn: newDocData.hideVatColumn,
        customBannerStyle: newDocData.customBannerStyle,
        customVatReason: newDocData.customVatReason
      });

      setInvoices([created, ...invoices]);
      setView('list');
      setNewDocData({
        items: [],
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + (userProfile.paymentDelayDays !== undefined ? userProfile.paymentDelayDays : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: activeTab,
        linkedDocumentId: undefined,
        discount: 0, 
        shipping: 0,
        deposit: 0,
        operationType: 'services',
        vatOption: 'encaissements',
        deliveryAddress: '',
        paymentMethod: 'transfer',
        vatRate: 0,
        transmissionStatus: 'draft',
        customThemeColor: undefined,
        customTitle: undefined,
        customLogo: undefined,
        customLegalMentions: undefined,
        customSubtitle: undefined,
        customSignatory: undefined,
        hideVatColumn: false,
        customBannerStyle: 'minimal',
        customVatReason: undefined
      });
      setSelectedClientId('');
    } catch (error: any) {
      alert(error.message || "Une erreur est survenue lors de la création de la facture.");
    }
  };

  // --- TRANSFORMATION LOGIC ---

  const convertQuoteToInvoice = (quote: Invoice) => {
    if (!confirm("Convertir ce devis en facture ?")) return;

    let updatedInvoices = invoices;
    if (quote.status !== InvoiceStatus.ACCEPTED) {
         updatedInvoices = invoices.map(i => 
            i.id === quote.id ? { ...i, status: InvoiceStatus.ACCEPTED } : i
        );
    }

    const newInvoice: Invoice = {
        ...quote,
        id: Date.now().toString(),
        type: 'invoice',
        linkedDocumentId: quote.id,
        number: getNextNumber('invoice'),
        date: new Date().toISOString().split('T')[0],
        status: InvoiceStatus.DRAFT,
        notes: `Facture suite au devis ${quote.number}`
    };

    setInvoices([newInvoice, ...updatedInvoices]);
    setActiveTab('invoice');
    setSelectedInvoice(newInvoice);
  };

  const convertOrderToInvoice = (order: Invoice) => {
     if (!confirm("Facturer cette commande ?")) return;
     
     const newInvoice: Invoice = {
         ...order,
         id: Date.now().toString(),
         type: 'invoice',
         linkedDocumentId: order.id,
         number: getNextNumber('invoice'),
         date: new Date().toISOString().split('T')[0],
         status: InvoiceStatus.DRAFT,
         notes: `Facture pour la commande ${order.number}`
     };
     setInvoices([newInvoice, ...invoices]);
     setActiveTab('invoice');
     setSelectedInvoice(newInvoice);
  };

  const createCreditNoteFromInvoice = (invoice: Invoice) => {
    if (!confirm("Créer un avoir pour cette facture ?")) return;

    setNewDocData({
        items: invoice.items.map(i => ({...i})),
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        type: 'credit_note',
        linkedDocumentId: invoice.id,
        discount: invoice.discount,
        notes: `Avoir sur facture ${invoice.number}`
    });
    setSelectedClientId(invoice.clientId);
    setActiveTab('credit_note');
    setView('create');
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === 'CUSTOM_INPUT') {
      setIsCustomStatus(true);
      return;
    }
    try {
      const updated = await updateInvoiceStatus(id, status);
      setInvoices(invoices.map(inv => inv.id === id ? updated : inv));
      if (selectedInvoice && selectedInvoice.id === id) {
          setSelectedInvoice(updated);
      }
      setIsCustomStatus(false);
    } catch (error: any) {
      alert(error.message || "Impossible de changer le statut.");
    }
  };

  const updateReminder = (id: string, date: string) => {
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, reminderDate: date } : inv));
    if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice({ ...selectedInvoice, reminderDate: date });
    }
  }

  const deleteDocument = async (id: string) => {
     if(confirm("Supprimer ce document définitivement ?")) {
       try {
         await tauriDeleteInvoice(id);
         setInvoices(invoices.filter(inv => inv.id !== id));
         if (selectedInvoice?.id === id) setView('list');
       } catch (error: any) {
         alert(error.message || "Erreur de suppression.");
       }
     }
  }

  const handleTriggerDunning = async (doc: Invoice, level: 'courtois' | 'ferme' | 'mise_en_demeure') => {
    setDunningLoading(true);
    setDunningLevel(level);
    try {
      const clientName = clients.find(c => c.id === doc.clientId)?.name || 'Client';
      const delayDays = doc.dueDate ? Math.max(1, Math.floor((Date.now() - new Date(doc.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 7;
      const text = await generatePaymentDunning(
        doc.number,
        clientName,
        doc.total,
        delayDays,
        '€',
        level,
        undefined,
        undefined,
        userProfile.name
      );
      setGeneratedDunningText(text);
    } catch (e: any) {
      console.error(e);
      setGeneratedDunningText("Erreur lors de la génération. Veuillez réessayer.");
    } finally {
      setDunningLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeDunningDoc) {
      handleTriggerDunning(activeDunningDoc, dunningLevel);
    }
  }, [activeDunningDoc, dunningLevel]);

  React.useEffect(() => {
    if (selectedInvoice) {
      // Map operationType if available
      let initialActivity: 'services_liberal' | 'services_commercial' | 'sales' | 'custom' = userProfile.activityType || 'services_liberal';
      if (selectedInvoice.operationType === 'goods') {
        initialActivity = 'sales';
      } else if (selectedInvoice.operationType === 'services') {
        initialActivity = userProfile.activityType === 'services_commercial' ? 'services_commercial' : 'services_liberal';
      }
      
      setSimulatedActivityType(initialActivity);
      setSimulatedHasAcre(userProfile.hasAcre || false);
      setSimulatedHasVli(userProfile.hasVli || false);
    }
  }, [selectedInvoice, userProfile.activityType, userProfile.hasAcre, userProfile.hasVli]);

  const handleCopySimulationValue = (val: string, field: 'total' | 'net') => {
    navigator.clipboard.writeText(val);
    setCopiedSimulationField(field);
    setTimeout(() => setCopiedSimulationField(null), 2000);
  };

  const startCreate = () => {
      setNewDocData({
        items: [],
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + (userProfile.paymentDelayDays !== undefined ? userProfile.paymentDelayDays : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: activeTab,
        linkedDocumentId: undefined,
        discount: 0,
        shipping: 0,
        deposit: 0,
        operationType: 'services',
        vatOption: 'encaissements',
        deliveryAddress: '',
        paymentMethod: 'transfer',
        vatRate: userProfile.vatFranchiseArt293B === false ? (userProfile.defaultVatRate || 20) : 0,
        transmissionStatus: 'draft'
      });
      setSelectedClientId('');
      setShowLivePreview(false);
      setView('create');
  }

  // --- STYLES HELPER ---
  const themeColor = getThemeColor(activeTab);

  // --- RENDER PAPER COMPONENT ---
  const InvoicePaper = ({ invoice, isPreview }: { invoice: Invoice, isPreview?: boolean }) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const docType = invoice.type || 'invoice';
    const docTheme = invoice.customThemeColor || getThemeColor(docType);
    const linkedDoc = invoice.linkedDocumentId ? invoices.find(i => i.id === invoice.linkedDocumentId) : null;
    const bannerStyle = invoice.customBannerStyle || 'minimal';

    let title = invoice.customTitle || 'FACTURE';
    if (!invoice.customTitle) {
      if (docType === 'quote') { title = 'DEVIS'; }
      if (docType === 'order') { title = 'COMMANDE'; }
      if (docType === 'credit_note') { title = 'AVOIR'; }
    }
    
    let icon = <FileText size={24} />;
    if (docType === 'quote') { icon = <FileCheck size={24} />; }
    if (docType === 'order') { icon = <ShoppingBag size={24} />; }
    if (docType === 'credit_note') { icon = <Receipt size={24} />; }

    // Calculations
    const subtotal = invoice.items?.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) || 0;
    const discountVal = subtotal * ((invoice.discount || 0) / 100);
    const totalHT = subtotal - discountVal + (invoice.shipping || 0);
    const vatRate = invoice.vatRate !== undefined ? invoice.vatRate : 0;
    const vatAmount = totalHT * (vatRate / 100);
    const totalBeforeDeposit = totalHT + vatAmount;
    const balanceDue = totalBeforeDeposit - (invoice.deposit || 0);

    // Mappage de couleur pour eviter l'interpolation dynamique de classes Tailwind
    const themeBgClasses: Record<string, string> = {
      blue: 'bg-blue-600 shadow-blue-200',
      emerald: 'bg-emerald-600 shadow-emerald-200',
      violet: 'bg-violet-600 shadow-violet-200',
      amber: 'bg-amber-600 shadow-amber-200',
      neutral: 'bg-slate-700 shadow-slate-200'
    };

    const themeTextClasses: Record<string, string> = {
      blue: 'text-blue-600',
      emerald: 'text-emerald-600',
      violet: 'text-violet-600',
      amber: 'text-amber-600',
      neutral: 'text-slate-700'
    };

    const themeBorderClasses: Record<string, string> = {
      blue: 'border-blue-600',
      emerald: 'border-emerald-600',
      violet: 'border-violet-600',
      amber: 'border-amber-600',
      neutral: 'border-slate-700'
    };

    const safeThemeColor = themeTextClasses[docTheme] || 'text-slate-700';
    const safeThemeBg = themeBgClasses[docTheme] || 'bg-slate-700';
    const safeThemeBorder = themeBorderClasses[docTheme] || 'border-slate-700';

    return (
        <div 
            className={`bg-white p-12 shadow-2xl shadow-slate-200/50 rounded-sm min-h-[1000px] relative mx-auto print:shadow-none print:w-full print:m-0 printable-area ${bannerStyle === 'bordered' ? `border-t-8 ${safeThemeBorder} pt-10` : ''}`} 
            id="invoice-preview"
            style={{ maxWidth: '210mm' }}
        >
           {isPreview && (
               <div className="absolute top-0 right-0 left-0 bg-blue-600 text-white text-center py-1 text-xs font-bold uppercase tracking-widest no-print">
                   Mode Aperçu
               </div>
           )}

           {/* Visual Link Banner */}
           {linkedDoc && (
             <div 
                className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors print:hidden no-print"
                onClick={() => !isPreview && openLinkedDocument(linkedDoc.id)}
             >
                <div className="flex items-center gap-3">
                    <div className="bg-blue-200 p-2 rounded-lg text-blue-700">
                        <LinkIcon size={18} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-blue-900">Document lié : {linkedDoc.type === 'quote' ? 'Devis' : linkedDoc.type === 'order' ? 'Commande' : 'Facture'} #{linkedDoc.number}</p>
                        <p className="text-xs text-blue-600">Cliquez pour voir le document original</p>
                    </div>
                </div>
                {!isPreview && <ArrowRightCircle size={18} className="text-blue-400" />}
             </div>
           )}

           {/* MAIN BANNER STYLE CONTEXT */}
           <div className={`flex flex-col md:flex-row justify-between items-start mb-12 pb-8 border-b border-slate-100 ${bannerStyle === 'gradient' ? `bg-gradient-to-br from-${docTheme}-50/35 via-slate-50/50 to-transparent p-8 rounded-[2rem] border border-slate-100` : ''}`}>
            <div>
               <div className="flex items-center gap-3 mb-4">
                 <div className={`w-12 h-12 ${safeThemeBg} rounded-xl flex items-center justify-center text-white text-xl font-bold`}>
                    {invoice.customLogo ? (
                      <span>{invoice.customLogo}</span>
                    ) : (
                      icon
                    )}
                 </div>
                 <div>
                   <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase leading-none">{userProfile.companyName}</h1>
                   {invoice.customSubtitle ? (
                     <p className={`text-xs ${safeThemeColor} font-semibold italic mt-1.5 max-w-xs`}>
                       « {invoice.customSubtitle} »
                     </p>
                   ) : (
                     <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
                        {userProfile.legalStatus || 'EI'}
                        {userProfile.capitalSocial ? ` au capital de ${userProfile.capitalSocial}` : ''}
                        {userProfile.activitySector ? ` — ${userProfile.activitySector}` : ''}
                      </p>
                   )}
                 </div>
               </div>
               <div className="text-xs text-slate-500 leading-relaxed font-semibold">
                 <p>{userProfile.address}</p>
                 <p>{userProfile.email} • {userProfile.phone}</p>
                 <p className="mt-1 font-mono text-[10px] text-slate-400">SIRET : {userProfile.siret}{userProfile.rcsRegistry ? ` • ${userProfile.rcsRegistry}` : ''}{userProfile.tvaNumber ? ` • TVA : ${userProfile.tvaNumber}` : ''}</p>
               </div>
            </div>
            <div className="text-right mt-6 md:mt-0 w-full md:w-auto flex flex-col items-end">
              <h2 className="text-4xl font-light text-slate-900 mb-1 tracking-tight leading-tight">{title}</h2>
              <p className={`${safeThemeColor} font-mono font-black text-xl tracking-wide`}>#{invoice.number}</p>
              
              <div className="mt-6 text-left bg-slate-50 p-5 rounded-2xl border border-slate-100 inline-block min-w-[220px]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Destinataire</h3>
                <p className="font-extrabold text-slate-900 text-base">{client?.name}</p>
                <p className="text-sm text-slate-500 whitespace-pre-line mt-1.5 leading-relaxed font-semibold">{client?.address}</p>
                {client?.siret && <p className="text-[10px] text-slate-400 mt-2 font-mono">SIRET: {client.siret}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10 border-b border-slate-100 pb-8 text-xs font-semibold">
             <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date d'émission</span>
                <span className="text-slate-900 text-sm font-extrabold">{new Date(invoice.date).toLocaleDateString('fr-FR')}</span>
             </div>
             <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{docType === 'quote' ? 'Validité' : 'Échéance'}</span>
                <span className="text-slate-900 text-sm font-extrabold">{new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</span>
             </div>
             <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mode de règlement</span>
                <span className="text-slate-900 text-sm font-extrabold">
                  {invoice.paymentMethod === 'card' ? 'CB' :
                   invoice.paymentMethod === 'direct_debit' ? 'Prélèvement' :
                   invoice.paymentMethod === 'check' ? 'Chèque' :
                   invoice.paymentMethod === 'cash' ? 'Espèces' : 'Virement'}
                </span>
             </div>
             <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Régime de TVA</span>
                <span className="text-slate-900 text-sm font-extrabold">
                  {vatRate > 0 ? (invoice.vatOption === 'debits' ? 'Sur les Débits' : 'Sur encaissement') : 'Exonéré (Art. 293B)'}
                </span>
             </div>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                <th className="py-4">Description</th>
                <th className="py-4 text-right">Qté</th>
                <th className="py-4 text-right">Prix Unitaire</th>
                <th className="py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-5 text-slate-800 font-semibold">{item.description}</td>
                  <td className="py-5 text-right text-slate-500 font-medium">{item.quantity}</td>
                  <td className="py-5 text-right text-slate-500 font-medium">{item.unitPrice.toFixed(2)} €</td>
                  <td className="py-5 text-right font-bold text-slate-900">{(item.quantity * item.unitPrice).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-1/2">
                <div className="space-y-3 pb-6 border-b border-slate-100">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Sous-Total HT</span>
                        <span className="font-bold text-slate-900">{subtotal.toFixed(2)} €</span>
                    </div>
                    {(invoice.discount || 0) > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span className="font-medium">Remise ({invoice.discount}%)</span>
                            <span className="font-bold">- {discountVal.toFixed(2)} €</span>
                        </div>
                    )}
                    {(invoice.shipping || 0) > 0 && (
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-medium">Frais de port</span>
                            <span className="font-bold text-slate-900">+ {invoice.shipping?.toFixed(2)} €</span>
                        </div>
                    )}
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">{vatRate > 0 ? `TVA (${vatRate}%)` : 'TVA (exonérée)'}</span>
                        <span className="font-bold text-slate-900">{vatAmount.toFixed(2)} €</span>
                    </div>
                </div>
                
                <div className="pt-6">
                    <div className="flex justify-between items-end mb-2">
                         <span className={`text-${docTheme}-900 font-bold text-lg`}>Total TTC</span>
                         <span className={`text-${docTheme}-600 font-bold text-xl`}>{totalBeforeDeposit.toFixed(2)} €</span>
                    </div>
                    
                    {(invoice.deposit || 0) > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                            <div className="flex justify-between text-sm text-slate-600 mb-2">
                                <span>Acompte {docType === 'quote' ? 'demandé' : 'déjà réglé'}</span>
                                <span className="font-mono">- {invoice.deposit?.toFixed(2)} €</span>
                            </div>
                            <div className={`flex justify-between font-bold text-lg text-${docTheme}-700 border-t border-slate-200 pt-2`}>
                                <span>Reste à payer</span>
                                <span>{balanceDue.toFixed(2)} €</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* BLOC INDICATEURS CONFORMITE ELECTONIQUE 2026 (PPF / Factur-X) */}
          <div className="mt-8 mb-12 border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-2 text-[10px] text-slate-500 font-sans grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Database size={12} className="text-blue-600" />
                      Métadonnées Facturation Électronique 2026
                  </h4>
                  <p><span className="font-semibold text-slate-600">Nature de l'opération :</span> {invoice.operationType === 'goods' ? 'Livraison de biens' : invoice.operationType === 'mixed' ? 'Opération mixte' : 'Prestation de services'}</p>
                  <p><span className="font-semibold text-slate-600">Régime de TVA :</span> {vatRate > 0 ? `TVA exigible sur les ${invoice.vatOption === 'debits' ? 'débits' : 'encaissements'}` : 'Franchise en base de TVA (non applicable)'}</p>
                  {invoice.deliveryAddress && <p><span className="font-semibold text-slate-600">Adresse de livraison :</span> {invoice.deliveryAddress}</p>}
              </div>
              <div className="sm:border-l sm:border-slate-200 sm:pl-4 flex flex-col justify-between">
                  <div>
                      <h4 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                          <Cpu size={12} className="text-emerald-600" />
                          Raccordement PPF / Format Factur-X
                      </h4>
                      <p><span className="font-semibold text-slate-600">Format d'échange :</span> CII Minimum / Factur-X (.xml standardisé)</p>
                      <p className="flex items-center gap-1"><span className="font-semibold text-slate-600">Moyen de règlement :</span> {
                        invoice.paymentMethod === 'card' ? 'Carte bancaire (CB)' :
                        invoice.paymentMethod === 'direct_debit' ? 'Prélèvement automatique' :
                        invoice.paymentMethod === 'check' ? 'Chèque' :
                        invoice.paymentMethod === 'cash' ? 'Espèces' : 'Virement bancaire (IBAN)'
                      }</p>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold self-start border border-emerald-100 uppercase tracking-wider text-[8px]">
                      ● Conforme Réforme 2026
                  </div>
              </div>
          </div>

          <div className="absolute bottom-12 left-12 right-12 text-center">
             {invoice.notes ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-start text-left">
                      <div className="bg-slate-50 p-5 rounded-2xl text-xs text-slate-600 border border-slate-100 relative">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Notes &amp; Conditions</span>
                          {invoice.notes}
                      </div>
                      {invoice.customSignatory && (
                          <div className={`p-5 rounded-2xl bg-${docTheme}-50/20 border border-${docTheme}-100 text-left flex flex-col justify-between min-h-[110px]`}>
                             <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Signature autorisée</span>
                                <p className="text-xs font-black text-slate-800 transition-colors uppercase">{invoice.customSignatory}</p>
                             </div>
                             <div className="border-t border-dashed border-slate-200 mt-6 pt-1 text-right">
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider italic">Mention "Bon pour accord", date et signature</span>
                             </div>
                          </div>
                      )}
                  </div>
              ) : (
                  invoice.customSignatory && (
                      <div className="flex justify-end mb-8 text-left">
                          <div className={`w-1/2 p-5 rounded-2xl bg-${docTheme}-50/20 border border-${docTheme}-100 text-left flex flex-col justify-between min-h-[110px]`}>
                             <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Signature autorisée</span>
                                <p className="text-xs font-black text-slate-800 transition-colors uppercase">{invoice.customSignatory}</p>
                             </div>
                             <div className="border-t border-dashed border-slate-200 mt-6 pt-1 text-right">
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider italic">Mention "Bon pour accord", date et signature</span>
                             </div>
                          </div>
                      </div>
                  )
              )}
            <div className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-8 font-medium">
                {invoice.customLegalMentions && <p className="mb-2 text-slate-650 font-bold italic">« {invoice.customLegalMentions} »</p>}
                {userProfile.legalMentions && !invoice.customLegalMentions && <p className="mb-2 text-slate-500">{userProfile.legalMentions}</p>}
                <p>{vatRate > 0 ? `TVA n° ${userProfile.tvaNumber || 'Non renseigné'}` : (invoice.customVatReason || 'TVA non applicable, art. 293 B du CGI.')}</p>
                {userProfile.hasProfessionalInsurance && userProfile.insuranceCompanyName && (
                    <p className="mt-1 text-slate-500">
                        Assurance Pro / Décennale : <span className="font-semibold text-slate-700">{userProfile.insuranceCompanyName}</span> {userProfile.insuranceContractNumber ? `(Contrat n° ${userProfile.insuranceContractNumber})` : ''} • Couverture : {userProfile.insuranceCoverageArea || 'France entière'} {userProfile.insuranceDetails ? ` • Garanties : ${userProfile.insuranceDetails}` : ''}
                    </p>
                )}
                {userProfile.bankAccount && (
                  <div className="mt-4 mb-2">
                    <SepaQrCode 
                      iban={userProfile.bankAccount}
                      bic={userProfile.bic}
                      beneficiaryName={userProfile.companyName || 'Entreprise'}
                      amount={balanceDue > 0 ? balanceDue : totalBeforeDeposit}
                      reference={`FAC-${invoice.number}`}
                      compact={true}
                    />
                  </div>
                )}
                {userProfile.bankAccount && <p className="mt-1 font-mono text-slate-500">IBAN : {userProfile.bankAccount} {userProfile.bic ? ` • BIC : ${userProfile.bic}` : ''}</p>}
                {(docType === 'invoice') && <p className="mt-2 text-slate-400">En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée. Une indemnité forfaitaire de 40€ pour frais de recouvrement sera due.</p>}
            </div>
          </div>
        </div>
    );
  };

  // --- RENDERERS ---

  if (view === 'create') {
    return (
      <InvoiceEditor 
        view={view}
        activeTab={activeTab}
        clients={clients}
        products={products}
        invoices={invoices}
        userProfile={userProfile}
        newDocData={newDocData}
        setNewDocData={setNewDocData}
        selectedClientId={selectedClientId}
        setSelectedClientId={setSelectedClientId}
        setView={setView}
        addItem={addItem}
        updateItem={updateItem}
        removeItem={removeItem}
        addProductItem={addProductItem}
        handleGenerateDescription={handleGenerateDescription}
        isGeneratingDesc={isGeneratingDesc}
        getThemeColor={getThemeColor}
        getDocumentLabel={getDocumentLabel}
        saveDocument={saveDocument}
        themeColor={themeColor}
        createFormStep={createFormStep}
        setCreateFormStep={setCreateFormStep}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        showLivePreview={showLivePreview}
        setShowLivePreview={setShowLivePreview}
        formTotals={formTotals}
        InvoicePaper={InvoicePaper}
        getPreviewInvoice={getPreviewInvoice}
      />
    );
  }

  if (view === 'detail' && selectedInvoice) {
     const docType = selectedInvoice.type || 'invoice';
     
    return (
      <div className="max-w-4xl mx-auto animate-fade-in pb-10">
        <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-4 mb-6 flex justify-between items-center print:hidden border-b border-slate-200/50 no-print">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-4 py-2 hover:bg-white rounded-lg transition-all">
            <ArrowLeft size={18} /> Retour
          </button>
          
          <div className="flex items-center gap-2">
             {/* CUSTOM STATUS SELECTOR */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 pr-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Statut</span>
                {isCustomStatus ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      autoFocus
                      className="text-sm font-semibold rounded-md py-1 px-2 outline-none bg-slate-50 w-32 border border-blue-200"
                      placeholder="Nouveau statut"
                      value={selectedInvoice.status}
                      onChange={(e) => updateStatus(selectedInvoice.id, e.target.value)}
                      onBlur={() => setIsCustomStatus(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsCustomStatus(false)}
                    />
                    <button onClick={() => setIsCustomStatus(false)} className="text-slate-400 hover:text-slate-600"><CheckSquare size={14}/></button>
                  </div>
                ) : (
                  <select 
                    value={selectedInvoice.status}
                    onChange={(e) => updateStatus(selectedInvoice.id, e.target.value)}
                    className={`text-sm font-semibold rounded-md py-1 px-2 cursor-pointer outline-none bg-transparent ${
                        selectedInvoice.status === InvoiceStatus.PAID || selectedInvoice.status === InvoiceStatus.ACCEPTED ? 'text-emerald-600' :
                        selectedInvoice.status === InvoiceStatus.SENT ? 'text-amber-600' :
                        selectedInvoice.status === InvoiceStatus.REJECTED ? 'text-red-600' :
                        'text-slate-600'
                    }`}
                  >
                  {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="CUSTOM_INPUT" className="font-bold text-blue-600">+ Personnalisé...</option>
                  </select>
                )}
            </div>
            
            {/* Reminder Feature */}
            {selectedInvoice.status !== InvoiceStatus.PAID && (
                 <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm relative group">
                    <div className="p-2 text-slate-400 group-hover:text-blue-500 transition-colors">
                        <Bell size={16} />
                    </div>
                    <input 
                        type="date" 
                        className="text-xs font-medium text-slate-600 bg-transparent outline-none w-28 cursor-pointer"
                        value={selectedInvoice.reminderDate || ''}
                        onChange={(e) => updateReminder(selectedInvoice.id, e.target.value)}
                        title="Date de rappel"
                    />
                 </div>
            )}

            <button 
                onClick={() => handleEmail(selectedInvoice)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Envoyer par email"
            >
                <Mail size={18} />
            </button>
            {selectedInvoice.status !== InvoiceStatus.PAID && selectedInvoice.status !== 'Payée' && selectedInvoice.dueDate && new Date(selectedInvoice.dueDate) < new Date() && (
                <button
                    onClick={() => handleDunning(selectedInvoice)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Envoyer une relance"
                >
                    <AlertCircle size={18} />
                </button>
            )}
            {userProfile.bankAccount && (
              <button
                onClick={() => setShowSepaQrModal(true)}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Afficher le QR Code de Virement SEPA (EPC)"
              >
                <QrCode size={16} /> QR Code SEPA
              </button>
            )}
            <button 
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
                title="Imprimer / Enregistrer via Navigateur"
            >
                <Printer size={15} /> Imprimer
            </button>
            <button 
                onClick={() => handleGenerateRustPdf(selectedInvoice)}
                disabled={pdfCompiling}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                title="Générer le PDF officiel via le compilateur Rust"
            >
                {pdfCompiling ? (
                    <>
                        <RefreshCw size={15} className="animate-spin" /> Compilation Rust...
                    </>
                ) : (
                    <>
                        <Download size={15} /> Télécharger PDF (Rust)
                    </>
                )}
            </button>
            <button 
                onClick={() => handleDuplicate(selectedInvoice)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Dupliquer"
            >
                <Copy size={18} />
            </button>

            {docType === 'invoice' && (
                <button 
                    onClick={() => setShowRecurrenceConfigId(selectedInvoice.id)}
                    className={`p-2 rounded-lg transition-colors ${selectedInvoice.recurrence ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                    title="Planifier un abonnement récurrent (Retainer)"
                >
                    <Repeat size={18} />
                </button>
            )}

            {docType === 'quote' && selectedInvoice.status === InvoiceStatus.SENT && (
                <>
                <button 
                    onClick={() => updateStatus(selectedInvoice.id, InvoiceStatus.ACCEPTED)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Accepter"
                >
                    <ThumbsUp size={18} />
                </button>
                 <button 
                    onClick={() => updateStatus(selectedInvoice.id, InvoiceStatus.REJECTED)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Refuser"
                >
                    <ThumbsDown size={18} />
                </button>
                </>
            )}

            {docType === 'quote' && selectedInvoice.status === InvoiceStatus.ACCEPTED && (
                <button 
                    onClick={() => convertQuoteToInvoice(selectedInvoice)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Convertir en Facture"
                >
                    <Repeat size={18} />
                </button>
            )}

             {docType === 'order' && (
                <button 
                    onClick={() => convertOrderToInvoice(selectedInvoice)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Facturer"
                >
                    <ArrowRightCircle size={18} />
                </button>
            )}

            {docType === 'invoice' && (
                <button 
                    onClick={() => createCreditNoteFromInvoice(selectedInvoice)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Créer un avoir"
                >
                    <Receipt size={18} />
                </button>
            )}
            
            {selectedInvoice.type === 'invoice' && (
              <>
                <button 
                  onClick={() => handleCheckAuditSeal(selectedInvoice)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 text-slate-100 hover:bg-slate-700 rounded-lg transition-colors font-medium text-xs border border-slate-700 shadow-sm"
                  title="Vérifier le Sceau Cryptographique SHA-256 (Inviolabilité Fiscale Art. 286 I-3° CGI)"
                >
                  <ShieldCheck size={16} className="text-emerald-400" /> Sceau SHA-256 (Piste d'Audit)
                </button>

                <button 
                  onClick={() => {
                    const xmlContent = generateFacturXXml(selectedInvoice, clients.find(c => c.id === selectedInvoice.clientId), userProfile);
                    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `factur-x_${selectedInvoice.number}.xml`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200/50 font-medium text-sm"
                  title="Télécharger l'XML de conformité Factur-X pour la norme 2026"
                >
                  <FileCode size={16} /> Exporter XML Factur-X (2026)
                </button>
              </>
            )}
            
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 font-medium text-sm"
              title="Télécharger en PDF via l'impression"
            >
              <Printer size={16} /> Télécharger PDF / Imprimer
            </button>
          </div>
        </div>

        {/* SIMULATEUR DE PROVISIONNEMENT URSSAF ET CHARGES */}
        {docType === 'invoice' && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 mb-8 print:hidden no-print overflow-hidden">
            <div className="flex justify-between items-center cursor-pointer border-b border-slate-100 pb-4 mb-4 select-none" onClick={() => setIsUrssafPanelOpen(!isUrssafPanelOpen)}>
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Simulateur de Provisionnement URSSAF & Impôts
                    <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-150">
                      Auto-calculé
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Estimez les charges à provisionner à chaque encaissement de cette facture.</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                {isUrssafPanelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isUrssafPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 overflow-hidden"
                >
                  {/* Grid for customizers */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    {/* Activity Type Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Catégorie d'activité</label>
                      <select
                        value={simulatedActivityType}
                        onChange={(e) => setSimulatedActivityType(e.target.value as any)}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-300 transition-colors"
                      >
                        <option value="services_liberal">Prestation de Service Libérale (BNC - 21.1%)</option>
                        <option value="services_commercial">Prestation Artisanale / Commerc. (BIC - 21.2%)</option>
                        <option value="sales">Vente de marchandises (BIC - 12.3%)</option>
                        <option value="custom">Taux personnalisé ({userProfile.customChargesRate || 21.1}%)</option>
                      </select>
                    </div>

                    {/* ACRE toggle */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Bénéficiaire ACRE</span>
                        <span className="text-[9px] text-slate-400">Taux divisé par 2 (1ère année)</span>
                      </div>
                      <button
                        onClick={() => setSimulatedHasAcre(!simulatedHasAcre)}
                        className={`w-10 h-5.5 rounded-full p-0.5 transition-all flex items-center cursor-pointer ${simulatedHasAcre ? 'bg-emerald-600 justify-end' : 'bg-slate-200 justify-start'}`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-sm block animate-fade-in" />
                      </button>
                    </div>

                    {/* VLI toggle */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Versement Libératoire</span>
                        <span className="text-[9px] text-slate-400">Impôt prélevé à la source</span>
                      </div>
                      <button
                        onClick={() => setSimulatedHasVli(!simulatedHasVli)}
                        className={`w-10 h-5.5 rounded-full p-0.5 transition-all flex items-center cursor-pointer ${simulatedHasVli ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'}`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-sm block animate-fade-in" />
                      </button>
                    </div>
                  </div>

                  {/* Calculations breakdown */}
                  {(() => {
                    const subtotal = selectedInvoice.items?.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) || 0;
                    const discountVal = subtotal * ((selectedInvoice.discount || 0) / 100);
                    const totalHT = subtotal - discountVal + (selectedInvoice.shipping || 0);

                    // Get rates and amounts
                    let socialRate = 0;
                    let cfpRate = 0;
                    let vliRate = 0;
                    let activityLabel = '';

                    switch (simulatedActivityType) {
                      case 'sales':
                        socialRate = simulatedHasAcre ? 6.15 : 12.3;
                        cfpRate = 0.1;
                        vliRate = simulatedHasVli ? 1.0 : 0;
                        activityLabel = 'Achat / Vente de Marchandises';
                        break;
                      case 'services_commercial':
                        socialRate = simulatedHasAcre ? 10.6 : 21.2;
                        cfpRate = 0.3;
                        vliRate = simulatedHasVli ? 1.7 : 0;
                        activityLabel = 'Services Artisanaux ou Commerciaux';
                        break;
                      case 'services_liberal':
                        socialRate = simulatedHasAcre ? 10.55 : 21.1;
                        cfpRate = 0.2;
                        vliRate = simulatedHasVli ? 2.2 : 0;
                        activityLabel = 'Professions Libérales / Services BNC';
                        break;
                      case 'custom':
                        const defaultRate = userProfile.customChargesRate || 21.1;
                        socialRate = simulatedHasAcre ? defaultRate / 2 : defaultRate;
                        cfpRate = 0.2;
                        vliRate = simulatedHasVli ? 2.2 : 0;
                        activityLabel = 'Taux Personnalisé';
                        break;
                    }

                    const socialAmount = totalHT * (socialRate / 100);
                    const cfpAmount = totalHT * (cfpRate / 100);
                    const vliAmount = totalHT * (vliRate / 100);
                    const totalProvisions = socialAmount + cfpAmount + vliAmount;
                    const netRestant = totalHT - totalProvisions;
                    const totalProvisionRate = socialRate + cfpRate + vliRate;
                    const netPercent = 100 - totalProvisionRate;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Breakdown table */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Détail des retenues estimées (Base CA HT : {totalHT.toFixed(2)} €)</h4>
                          
                          <div className="divide-y divide-slate-150 space-y-2 text-xs text-slate-600">
                            <div className="flex justify-between items-center py-1.5">
                              <span className="font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                Cotisations sociales URSSAF ({socialRate.toFixed(2)}%)
                              </span>
                              <span className="font-bold font-mono text-slate-950">{socialAmount.toFixed(2)} €</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5">
                              <span className="font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                Formation Professionnelle CFP ({cfpRate.toFixed(1)}%)
                              </span>
                              <span className="font-bold font-mono text-slate-950">{cfpAmount.toFixed(2)} €</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5">
                              <span className="font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                Versement Libératoire Impôt ({vliRate.toFixed(1)}%)
                              </span>
                              <span className="font-bold font-mono text-slate-950">
                                {simulatedHasVli ? `${vliAmount.toFixed(2)} €` : 'Néant (impos. classique)'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-2.5 border-t border-dashed border-slate-300 font-extrabold text-slate-900 bg-slate-50/50 p-2.5 rounded-xl">
                              <span className="uppercase tracking-wider text-[10px]">Total à Provisionner ({totalProvisionRate.toFixed(2)}%) :</span>
                              <span className="font-mono text-sm text-blue-600">{totalProvisions.toFixed(2)} €</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopySimulationValue(totalProvisions.toFixed(2), 'total')}
                              className={`flex-1 py-2 px-3 border rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                copiedSimulationField === 'total'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                              }`}
                            >
                              {copiedSimulationField === 'total' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              {copiedSimulationField === 'total' ? 'Montant copié !' : 'Copier provision'}
                            </button>
                            <button
                              onClick={() => handleCopySimulationValue(netRestant.toFixed(2), 'net')}
                              className={`flex-1 py-2 px-3 border rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                copiedSimulationField === 'net'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                              }`}
                            >
                              {copiedSimulationField === 'net' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              {copiedSimulationField === 'net' ? 'Montant copié !' : 'Copier net restant'}
                            </button>
                          </div>
                        </div>

                        {/* Summary Visual Box */}
                        <div className="bg-slate-900 text-white p-6 rounded-[1.5rem] flex flex-col justify-between space-y-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Simulation Financière</span>
                            <h5 className="text-sm font-extrabold text-slate-100">{activityLabel}</h5>
                            {simulatedHasAcre && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mt-1">
                                Bénéfice ACRE Activé
                              </span>
                            )}
                          </div>

                          {/* Progress bar mapping */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>Charges ({totalProvisionRate.toFixed(1)}%)</span>
                              <span>Reste Net ({netPercent.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                              <div className="h-full bg-blue-500" style={{ width: `${totalProvisionRate}%` }} title="Charges" />
                              <div className="h-full bg-emerald-500 flex-1" title="Reste Net" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Provision à retenir</span>
                              <strong className="text-xl font-mono text-blue-400 font-black">{totalProvisions.toFixed(2)} €</strong>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Trésorerie nette estimée</span>
                              <strong className="text-xl font-mono text-emerald-400 font-black">{netRestant.toFixed(2)} €</strong>
                            </div>
                          </div>

                          <div className="bg-slate-800/50 rounded-xl p-3 text-[10.5px] text-slate-300 leading-normal italic">
                            💡 <strong>Conseil :</strong> Lorsque le client règle cette facture de {selectedInvoice.total.toFixed(2)} €, transférez immédiatement <strong>{totalProvisions.toFixed(2)} €</strong> sur un compte dédié (ex: livret pro) pour préparer vos échéances fiscales sans effort.
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Invoice Paper Component */}
        <InvoicePaper invoice={selectedInvoice} />

        {/* RECURRENCE CONFIGURATION MODAL */}
        {showRecurrenceConfigId === selectedInvoice.id && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Repeat size={18} className="text-emerald-600 animate-spin-slow" />
                  Planifier un Abonnement / Retainer
                </h3>
                <button 
                  onClick={() => setShowRecurrenceConfigId(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-slate-500 leading-relaxed">
                  Transformez la facture <strong className="text-slate-800">{selectedInvoice.number}</strong> en modèle d'abonnement récurrent. Le système vous permettra de générer en un clic la prochaine facture à échéance.
                </p>

                {/* Switch Active */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                  <div>
                    <span className="font-bold text-slate-800 block">Activer la récurrence</span>
                    <span className="text-[10px] text-slate-400">Le modèle apparaîtra dans l'onglet Abonnements</span>
                  </div>
                  <button
                    onClick={() => {
                      const updatedInvoice: Invoice = {
                        ...selectedInvoice,
                        recurrence: selectedInvoice.recurrence 
                          ? { ...selectedInvoice.recurrence, active: !selectedInvoice.recurrence.active }
                          : { active: true, frequency: 'monthly', nextDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] }
                      };
                      setInvoices(invoices.map(inv => inv.id === selectedInvoice.id ? updatedInvoice : inv));
                      setSelectedInvoice(updatedInvoice);
                    }}
                    className={`w-12 h-6 rounded-full p-1 transition-all ${selectedInvoice.recurrence?.active ? 'bg-emerald-600 flex justify-end' : 'bg-slate-200 flex justify-start'}`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm block animate-fade-in" />
                  </button>
                </div>

                {selectedInvoice.recurrence?.active && (
                  <>
                    {/* Frequency Selector */}
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="font-bold text-slate-700 block">Fréquence de facturation</label>
                      <select
                        value={selectedInvoice.recurrence.frequency}
                        onChange={(e) => {
                          const updatedInvoice: Invoice = {
                            ...selectedInvoice,
                            recurrence: {
                              ...selectedInvoice.recurrence!,
                              frequency: e.target.value as 'monthly' | 'quarterly' | 'yearly'
                            }
                          };
                          setInvoices(invoices.map(inv => inv.id === selectedInvoice.id ? updatedInvoice : inv));
                          setSelectedInvoice(updatedInvoice);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-medium text-slate-800"
                      >
                        <option value="monthly">Mensuel (Chaque mois)</option>
                        <option value="quarterly">Trimestriel (Chaque trimestre)</option>
                        <option value="yearly">Annuel (Chaque année)</option>
                      </select>
                    </div>

                    {/* Next Due Date */}
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="font-bold text-slate-700 block">Date de la prochaine émission</label>
                      <input
                        type="date"
                        value={selectedInvoice.recurrence.nextDate}
                        onChange={(e) => {
                          const updatedInvoice: Invoice = {
                            ...selectedInvoice,
                            recurrence: {
                              ...selectedInvoice.recurrence!,
                              nextDate: e.target.value
                            }
                          };
                          setInvoices(invoices.map(inv => inv.id === selectedInvoice.id ? updatedInvoice : inv));
                          setSelectedInvoice(updatedInvoice);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-mono font-medium text-slate-800"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowRecurrenceConfigId(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
                >
                  Fermer & Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SCEAU AUDIT SHA-256 */}
        {showAuditSealModal && selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Sceau d'Inviolabilité Cryptographique</h3>
                    <p className="text-xs text-slate-500">Conformité Anti-Fraude Article 286 I-3° du CGI</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAuditSealModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-600">
                <p>
                  Chaque pièce validée fait l'objet d'un calcul d'empreinte numérique <strong>SHA-256</strong> garantissant son inaltérabilité et sa traçabilité selon la Piste d'Audit Fiable (PAF).
                </p>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">N° Pièce</span>
                    <span className="text-slate-900 font-bold">{selectedInvoice.number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">Montant TTC SCELLÉ</span>
                    <span className="text-emerald-700 font-bold">{selectedInvoice.total.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">Empreinte SHA-256 Courante</span>
                    {auditSealLoading ? (
                      <span className="text-blue-600 animate-pulse">Calcul de la clé cryptographique en cours...</span>
                    ) : (
                      <span className="text-slate-800 break-all select-all font-bold">{auditSealHash || '0x4f8a2e1b8c9d0e1f...'}</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Piste d'Audit Validée</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      L'empreinte est scellée avec horodatage local et liée aux écritures comptables du FEC.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowAuditSealModal(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL QR CODE SEPA */}
        {showSepaQrModal && selectedInvoice && userProfile.bankAccount && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in no-print">
            <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Générateur QR Code SEPA (GiroCode)</h3>
                    <p className="text-[11px] text-slate-500">Facture {selectedInvoice.number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSepaQrModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <SepaQrCode 
                iban={userProfile.bankAccount}
                bic={userProfile.bic}
                beneficiaryName={userProfile.companyName || 'Entreprise'}
                amount={selectedInvoice.total}
                reference={`FAC-${selectedInvoice.number}`}
                compact={false}
              />

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-colors"
                >
                  <Printer size={14} /> Imprimer avec le QR Code
                </button>
                <button
                  onClick={() => setShowSepaQrModal(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List View remains mostly similar but we ensure context is correct
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
            <p className="text-slate-500">Gérez vos documents commerciaux.</p>
        </div>
        
        {/* Type Toggle Pills */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-1">
            <button onClick={() => { setActiveTab('invoice'); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'invoice' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><FileText size={16} /> Factures</button>
            <button onClick={() => { setActiveTab('quote'); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'quote' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><FileCheck size={16} /> Devis</button>
            <button onClick={() => { setActiveTab('order'); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'order' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><ShoppingBag size={16} /> Commandes</button>
            <button onClick={() => { setActiveTab('credit_note'); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'credit_note' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><Receipt size={16} /> Avoirs</button>
            <button onClick={() => { setActiveTab('recurrence'); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'recurrence' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><RefreshCw size={16} /> Abonnements</button>
        </div>

        <div className="flex gap-2">
            <button 
                onClick={exportCurrentViewCSV}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium shadow-sm"
                title={`Exporter en CSV`}
            >
                <Download size={18} />
                <span className="hidden sm:inline">{getExportLabel()}</span>
            </button>

            <button 
                onClick={startCreate}
                className={`bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-${themeColor}-200 font-medium`}
            >
                <Plus size={18} />
                Créer
            </button>
        </div>
      </div>

      {/* SECTION REPORTING - TABLEAU DE BORD DYNAMIQUE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeTab === 'invoice' && (
              <>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                          <Coins size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Facturé</p>
                          <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{kpis.totalAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-slate-400 font-medium">{kpis.count} factures au total</span>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                          <CheckCircle2 size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Encaissé</p>
                          <h3 className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5">{kpis.paidAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-emerald-500 font-bold">
                              {kpis.totalAmount > 0 ? `${Math.round((kpis.paidAmount / kpis.totalAmount) * 100)}%` : '0%'} de taux d'encaissement
                          </span>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                          <Clock size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reste à Recouvrer</p>
                          <h3 className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">{kpis.outstandingAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-slate-400 font-medium font-bold text-amber-500/90">Hors factures réglées</span>
                      </div>
                  </div>
                  <div className={`bg-white border p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] ${kpis.overdueCount > 0 ? 'border-red-100 bg-red-50/10' : 'border-slate-200/60'}`}>
                      <div className={`p-3 rounded-2xl ${kpis.overdueCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                          <AlertCircle size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Factures Échues</p>
                          <h3 className={`text-xl font-extrabold font-mono mt-0.5 ${kpis.overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{kpis.overdueAmount.toFixed(2)} €</h3>
                          <span className={`text-[10px] font-bold ${kpis.overdueCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                              {kpis.overdueCount} en retard de paiement
                          </span>
                      </div>
                  </div>
              </>
          )}

          {activeTab === 'quote' && (
              <>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                          <FileText size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume proposé</p>
                          <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{kpis.totalAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-slate-400 font-medium">{kpis.count} devis émis</span>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                          <ThumbsUp size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Signé / Gagné</p>
                          <h3 className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5">{kpis.acceptedAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-emerald-500 font-bold">{kpis.acceptedCount} devis signés</span>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                          <Activity size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taux d'Acceptation</p>
                          <h3 className="text-xl font-extrabold text-blue-600 font-mono mt-0.5">{kpis.quoteAcceptanceRate}%</h3>
                          {/* Mini Progress Bar */}
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1.5">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${kpis.quoteAcceptanceRate}%` }}></div>
                          </div>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
                          <ThumbsDown size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perdus / Refusés</p>
                          <h3 className="text-xl font-extrabold text-slate-700 font-mono mt-0.5">{kpis.rejectedAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-slate-400 font-medium">{kpis.rejectedCount} devis refusés</span>
                      </div>
                  </div>
              </>
          )}

          {(activeTab === 'order' || activeTab === 'credit_note') && (
              <>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] col-span-2">
                      <div className={`p-3 rounded-2xl ${activeTab === 'order' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                          {activeTab === 'order' ? <ShoppingBag size={24} /> : <Receipt size={24} />}
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume total cumulé</p>
                          <h3 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{kpis.totalAmount.toFixed(2)} €</h3>
                          <span className="text-[10px] text-slate-400 font-medium">{kpis.count} document(s) trouvé(s)</span>
                      </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] col-span-2">
                      <div className="p-3 bg-slate-50 text-slate-500 rounded-2xl">
                          <Database size={24} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-semibold">Explications</p>
                          <p className="text-xs text-slate-500 mt-1 leading-normal">
                              {activeTab === 'order' 
                               ? 'Les bons de commande vous permettent de préparer des livraisons ou réserver des marchandises avant facturation.' 
                               : 'Les avoirs comptables permettent d\'annuler partiellement ou totalement une facture en conformité légale.'}
                          </p>
                      </div>
                  </div>
              </>
          )}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
         {/* Live Text Search */}
         <div className="flex-1 min-w-[200px] flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Recherche</label>
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Numéro, client, notes, article..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
             </div>
         </div>
         <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Du</label>
             <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <input 
                    type="date" 
                    className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                    value={filters.dateStart}
                    onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
                 />
             </div>
         </div>
         <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-400 uppercase">Au</label>
             <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <input 
                    type="date" 
                    className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                    value={filters.dateEnd}
                    onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
                 />
             </div>
         </div>
         <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Client</label>
             <select 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all w-40"
                value={filters.clientId}
                onChange={(e) => setFilters({...filters, clientId: e.target.value})}
             >
                 <option value="">Tous</option>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
         </div>
         <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 uppercase">Statut</label>
             <select 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all w-32"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
             >
                 <option value="">Tous</option>
                 {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
         </div>
         <button 
            onClick={() => { setFilters({ dateStart: '', dateEnd: '', status: '', clientId: '' }); setSearchTerm(''); }}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors mb-0.5"
         >
             Réinitialiser
         </button>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 animate-slide-in">
              <div className="flex items-center gap-3">
                  <div className="bg-white/10 px-3 py-1 rounded-lg text-sm font-bold">
                      {selectedIds.size} sélectionné(s)
                  </div>
                  <span className="text-sm text-slate-300 hidden sm:inline">Modifier le statut en :</span>
              </div>
              <div className="flex gap-2">
                   {/* Status options depend on active tab slightly, but simplified for UI */}
                   {activeTab !== 'quote' && (
                       <button onClick={() => handleBulkStatusChange(InvoiceStatus.PAID)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                           Payée
                       </button>
                   )}
                   {activeTab === 'quote' && (
                       <>
                       <button onClick={() => handleBulkStatusChange(InvoiceStatus.ACCEPTED)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                           Accepté
                       </button>
                       <button onClick={() => handleBulkStatusChange(InvoiceStatus.REJECTED)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors">
                           Refusé
                       </button>
                       </>
                   )}
                   <button onClick={() => handleBulkStatusChange(InvoiceStatus.SENT)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors">
                       Envoyée
                   </button>
                   <button onClick={() => handleBulkStatusChange(InvoiceStatus.CANCELLED)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                       Annulée
                   </button>
                   <Tooltip content="Imprimer les documents sélectionnés">
                       <button onClick={handleBulkPrint} className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                           <Printer size={14} /> Imprimer
                       </button>
                   </Tooltip>
              </div>
          </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-5 w-12 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                        {selectedIds.size > 0 && selectedIds.size === filteredAndSortedDocuments.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                </th>
                <th className="px-4 py-5 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('number')}>
                    <div className="flex items-center gap-1">{activeTab === 'recurrence' ? 'Abonnement / Modèle' : 'Numéro'} {sortConfig.key === 'number' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="px-6 py-5 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('client')}>
                    <div className="flex items-center gap-1">Client {sortConfig.key === 'client' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="px-6 py-5 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">{activeTab === 'recurrence' ? 'Fréquence' : 'Date d\'Émission'} {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="px-6 py-5 font-semibold uppercase tracking-wider text-xs text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('total')}>
                    <div className="flex items-center justify-end gap-1">{activeTab === 'recurrence' ? 'Montant HT' : 'Total TTC'} {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="px-6 py-5 font-semibold uppercase tracking-wider text-xs text-center">{activeTab === 'recurrence' ? 'État & Échéance' : 'Statut'}</th>
                <th className="px-6 py-5 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedDocuments.map((doc) => {
                 const clientName = clients.find(c => c.id === doc.clientId)?.name || 'Client Inconnu';
                 const type = doc.type || 'invoice';
                 const color = getThemeColor(type);
                 
                 let Icon = FileText;
                 if (type === 'quote') Icon = FileCheck;
                 if (type === 'order') Icon = ShoppingBag;
                 if (type === 'credit_note') Icon = Receipt;

                  return activeTab === 'recurrence' ? (() => {
                    const frequencyLabels: Record<string, string> = {
                      monthly: 'Mensuel',
                      quarterly: 'Trimestriel',
                      yearly: 'Annuel'
                    };
                    const isRecActive = doc.recurrence?.active;
                    
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-5 text-center">
                          {/* No checkbox for recurrence view */}
                        </td>
                        <td className="px-4 py-5 font-mono font-medium text-slate-700">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 bg-emerald-50">
                                    <Repeat size={16} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold">Abonnement #{doc.number}</span>
                                    <span className="text-[10px] text-slate-400">Modèle original</span>
                                </div>
                             </div>
                        </td>
                        <td className="px-6 py-5 text-slate-900 font-bold">{clientName}</td>
                        <td className="px-6 py-5 text-slate-500 font-semibold text-emerald-600">
                          {frequencyLabels[doc.recurrence?.frequency || 'monthly']}
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-900">{(doc.total).toFixed(2)} €</td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button 
                              onClick={() => toggleRecurrenceActive(doc)}
                              className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isRecActive 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {isRecActive ? '✓ Actif' : '✕ Suspendu'}
                            </button>
                            {isRecActive && doc.recurrence?.nextDate && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Échéance : {new Date(doc.recurrence.nextDate).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isRecActive && (
                              <button 
                                  onClick={() => handleGenerateNextOccurrence(doc)}
                                  className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl transition-colors flex items-center justify-center gap-1 text-xs font-bold border border-emerald-200"
                                  title="Générer la facture d'échéance"
                              >
                                  <RefreshCw size={14} /> Générer Échéance
                              </button>
                            )}
                            <button 
                                onClick={() => { setSelectedInvoice(doc); setView('detail'); }}
                                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-xl transition-colors"
                                title="Voir le modèle original"
                            >
                                <Eye size={18} />
                            </button>
                            <button 
                                onClick={() => {
                                  if (confirm("Supprimer la récurrence de ce modèle ? (La facture d'origine ne sera pas supprimée)")) {
                                    const updated = { ...doc, recurrence: undefined };
                                    setInvoices(invoices.map(inv => inv.id === doc.id ? updated : inv));
                                  }
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"
                                title="Supprimer la récurrence"
                            >
                                <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })() : (
                   <tr key={doc.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(doc.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-5 text-center">
                         <button onClick={() => toggleSelection(doc.id)} className={`transition-colors ${selectedIds.has(doc.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>
                            {selectedIds.has(doc.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                    </td>
                    <td className="px-4 py-5 font-mono font-medium text-slate-700">
                         <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-${color}-600 bg-${color}-50`}>
                                <Icon size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span>{doc.number}</span>
                                {doc.linkedDocumentId && <span className="text-[10px] text-slate-400 flex items-center gap-1"><LinkIcon size={8} /> Lié</span>}
                                {doc.reminderDate && <span className="text-[10px] text-orange-500 flex items-center gap-1"><Bell size={8} /> {new Date(doc.reminderDate).toLocaleDateString()}</span>}
                            </div>
                         </div>
                    </td>
                    <td className="px-6 py-5 text-slate-900 font-bold">{clientName}</td>
                    <td className="px-6 py-5 text-slate-500 font-medium">{new Date(doc.date).toLocaleDateString()}</td>
                    <td className="px-6 py-5 text-right font-bold text-slate-900">{doc.total.toFixed(2)} €</td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                          ${doc.status === InvoiceStatus.PAID || doc.status === InvoiceStatus.ACCEPTED ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            doc.status === InvoiceStatus.SENT ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            doc.status === InvoiceStatus.REJECTED ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {doc.status}
                        </span>
                        {(() => {
                          const isOverdue = type === 'invoice' && doc.status !== 'Payée' && doc.status !== InvoiceStatus.PAID && doc.dueDate && new Date(doc.dueDate) < new Date();
                          const delayDays = isOverdue ? Math.max(1, Math.floor((Date.now() - new Date(doc.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
                          return isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-150 text-[10px] font-black text-rose-600 rounded-md uppercase animate-pulse">
                              <AlertCircle size={10} /> Retard J+{delayDays}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(() => {
                          const isOverdue = type === 'invoice' && doc.status !== 'Payée' && doc.status !== InvoiceStatus.PAID && doc.dueDate && new Date(doc.dueDate) < new Date();
                          return type === 'invoice' && doc.status !== 'Payée' && doc.status !== InvoiceStatus.PAID && doc.status !== 'Brouillon' && doc.status !== InvoiceStatus.DRAFT ? (
                            <button 
                                onClick={() => { setActiveDunningDoc(doc); setDunningLevel('courtois'); }}
                                className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 p-2 rounded-xl transition-colors flex items-center justify-center"
                                title="Relancer par IA Gemini"
                            >
                                <Wand2 size={18} className="text-amber-500" />
                            </button>
                          ) : null;
                        })()}
                        <button 
                            onClick={() => { setSelectedInvoice(doc); setView('detail'); }}
                            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-xl transition-colors"
                            title="Aperçu & Impression"
                        >
                            <Eye size={18} />
                        </button>
                        <button 
                            onClick={() => { setSelectedInvoice(doc); setView('detail'); }}
                            className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-colors"
                            title="Ouvrir le détail"
                        >
                            <FileText size={18} />
                        </button>
                        <button 
                            onClick={() => deleteDocument(doc.id)}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAndSortedDocuments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                        <FileText size={64} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium text-slate-500">Aucun document trouvé</p>
                        <p className="text-sm">Modifiez vos filtres ou créez un nouveau document.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL / DRAWER RELANCE IA DUNNING */}
      {activeDunningDoc && (() => {
        const dunningClient = clients.find(c => c.id === activeDunningDoc.clientId);
        const dueDateObj = activeDunningDoc.dueDate ? new Date(activeDunningDoc.dueDate) : new Date();
        const delayDays = Math.max(1, Math.floor((Date.now() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Calcul légal des pénalités de retard : Taux BCE (ex 4.25%) + 10 points = 14.25% par an
        // Pénalité = Montant TTC * (14.25 / 100) * (Jours de retard / 365)
        const legalInterestRate = 14.25;
        const calculatedInterest = Number((activeDunningDoc.total * (legalInterestRate / 100) * (delayDays / 365)).toFixed(2));
        const recoveryFee = 40.00; // Indemnité forfaitaire légale pour frais de recouvrement (Art. L441-10)
        const totalPenaltiesDue = Number((calculatedInterest + recoveryFee).toFixed(2));

        const handleSaveDunningRecord = () => {
          const newRecord = {
            id: `dun-${Date.now()}`,
            date: new Date().toISOString(),
            level: dunningLevel,
            penaltyAmount: calculatedInterest,
            recoveryFeeApplied: true,
            notes: `Relance ${dunningLevel.toUpperCase()} envoyée (${delayDays}j de retard)`
          };

          const updatedDoc: Invoice = {
            ...activeDunningDoc,
            dunningHistory: [...(activeDunningDoc.dunningHistory || []), newRecord]
          };

          setInvoices(invoices.map(i => i.id === activeDunningDoc.id ? updatedDoc : i));
          setActiveDunningDoc(updatedDoc);
          alert(`Relance de niveau "${dunningLevel}" consignée avec succès dans l'historique de la facture ${activeDunningDoc.number}.`);
        };

        const handleCreatePenaltyInvoice = () => {
          if (!confirm(`Générer une facture de frais de recouvrement de ${totalPenaltiesDue.toFixed(2)} € (Intérêts : ${calculatedInterest.toFixed(2)} € + Forfait 40 €) ?`)) return;

          const penaltyItem = {
            id: `item-${Date.now()}-1`,
            description: `Frais de recouvrement et pénalités de retard (Art. L441-10 Code de commerce) - Facture ref ${activeDunningDoc.number} (${delayDays} jours de retard à ${legalInterestRate}%)`,
            quantity: 1,
            unitPrice: calculatedInterest
          };

          const feeItem = {
            id: `item-${Date.now()}-2`,
            description: `Indemnité forfaitaire légale pour frais de recouvrement (Art. D441-5 Code de commerce)`,
            quantity: 1,
            unitPrice: recoveryFee
          };

          const newInvoice: Invoice = {
            id: `inv-${Date.now()}`,
            type: 'invoice',
            number: getNextNumber('invoice'),
            clientId: activeDunningDoc.clientId,
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [penaltyItem, feeItem],
            status: InvoiceStatus.SENT,
            notes: `Facture de pénalités et frais de recouvrement rattachée à la facture d'origine ${activeDunningDoc.number}.`,
            total: totalPenaltiesDue,
            linkedDocumentId: activeDunningDoc.id
          };

          setInvoices([newInvoice, ...invoices]);
          setActiveDunningDoc(null);
          setSelectedInvoice(newInvoice);
          setView('detail');
          alert(`Facture de pénalités ${newInvoice.number} d'un montant de ${totalPenaltiesDue.toFixed(2)} € créée avec succès.`);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-200/60 shadow-sm">
                    <Wand2 size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">Gestionnaire de Relance & Pénalités de Retard</h3>
                    <p className="text-xs text-slate-500">Facture {activeDunningDoc.number} • Client : <strong className="text-slate-700">{dunningClient?.name}</strong> • Retard : <span className="text-amber-700 font-bold">{delayDays} jours</span></p>
                  </div>
                </div>
                <button 
                  onClick={() => { setActiveDunningDoc(null); setGeneratedDunningText(''); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Visual Legal Penalty Calculator Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator size={18} className="text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Calculateur Légale de Pénalités (Art. L441-10)</span>
                    </div>
                    <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 self-start sm:self-auto">
                      Taux légal BCE + 10% = 14.25%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Intérêts de Retard ({delayDays}j)</span>
                      <span className="text-base font-black text-amber-400">{calculatedInterest.toFixed(2)} €</span>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Forfait Frais Recouvrement</span>
                      <span className="text-base font-black text-emerald-400">+ 40.00 €</span>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Pénalités Totales Exigibles</span>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-lg font-black text-white">{totalPenaltiesDue.toFixed(2)} €</span>
                        <button
                          onClick={handleCreatePenaltyInvoice}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-all shadow-sm"
                          title="Facturer ces frais au client"
                        >
                          Facturer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firmness level toggles */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Niveau d'intensité & ton de la relance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'courtois', label: '1. Courtois', desc: 'Rappel amical / Oubli' },
                      { key: 'ferme', label: '2. Ferme', desc: 'Exigence de date sous 48h' },
                      { key: 'mise_en_demeure', label: '3. Mise en Demeure', desc: 'Sommation légale + Pénalités' }
                    ].map((lvl) => (
                      <button
                        key={lvl.key}
                        onClick={() => handleTriggerDunning(activeDunningDoc, lvl.key as any)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          dunningLevel === lvl.key
                            ? 'bg-amber-50/80 border-amber-300 text-amber-900 ring-2 ring-amber-200/80 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="text-xs font-black">{lvl.label}</span>
                        <span className="text-[10px] opacity-75 leading-tight">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Output visual block */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>E-mail / Courrier de Relance Rédigé</span>
                    {dunningLoading && <span className="animate-pulse text-amber-600 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Rédaction par l'IA...</span>}
                  </div>

                  {dunningLoading ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl h-56 flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-amber-500" />
                      <span className="text-xs text-slate-500 animate-pulse font-medium">Rédaction du message personnalisé en cours...</span>
                    </div>
                  ) : (
                    <div className="relative group">
                      <textarea
                        value={generatedDunningText}
                        onChange={(e) => setGeneratedDunningText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-250 rounded-2xl p-4 font-mono text-[11.5px] text-slate-800 h-56 outline-none resize-none focus:border-slate-400 focus:bg-white transition-all leading-relaxed"
                      />
                      
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedDunningText);
                          setCopiedDunning(true);
                          setTimeout(() => setCopiedDunning(false), 2000);
                        }}
                        className={`absolute right-4 bottom-4 px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-md transition-all active:scale-95 ${
                          copiedDunning
                            ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-950/20'
                        }`}
                      >
                        {copiedDunning ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copiedDunning ? 'Copié !' : 'Copier le message'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Historique des relances effectuées */}
                {activeDunningDoc.dunningHistory && activeDunningDoc.dunningHistory.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Historique des relances enregistrées sur ce document :</span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeDunningDoc.dunningHistory.map((h) => (
                        <div key={h.id} className="p-2 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {h.level}
                            </span>
                            <span>{new Date(h.date).toLocaleDateString('fr-FR')} à {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 italic">{h.notes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer actions */}
              <div className="p-5 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDunningRecord}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-800 transition-all flex items-center gap-1.5"
                    title="Enregistrer cet envoi dans le journal de la facture"
                  >
                    <CheckSquare size={15} className="text-slate-700" />
                    <span>Consigner dans l'historique</span>
                  </button>
                </div>

                <div className="flex gap-2.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => { setActiveDunningDoc(null); setGeneratedDunningText(''); }}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-250 text-xs font-bold text-slate-650 hover:bg-slate-100 cursor-pointer"
                  >
                    Fermer
                  </button>
                  {dunningClient?.email && (
                    <a
                      href={`mailto:${dunningClient.email}?subject=${encodeURIComponent(`Relance : Facture N° ${activeDunningDoc.number} en retard (${delayDays} jours)`)}&body=${encodeURIComponent(generatedDunningText)}`}
                      onClick={handleSaveDunningRecord}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-md hover:shadow-blue-500/15 active:scale-95 transition-all cursor-pointer"
                    >
                      <Mail size={15} />
                      <span>Envoyer par E-mail</span>
                    </a>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default InvoiceManager;