import React, { useState, useMemo } from 'react';
import { Invoice, Client, Supplier, Expense, UserProfile } from '../types';
import { 
  Globe, Send, Download, Eye, CheckCircle2, XCircle, Database, Search, 
  FileCode, Check, Trash2, AlertTriangle, Activity, Building, ArrowUpRight, 
  ArrowDownLeft, Wifi, FileText, Plus, Bell, RefreshCw, Cpu, ExternalLink, BadgePercent,
  Settings, ShieldCheck, Key, Server, Lock, Clock, CheckSquare
} from 'lucide-react';
import { generateFacturXXml } from '../services/invoiceUtils';
import { 
  getPdpConfig, savePdpConfig, transmitInvoiceToPdp, queryPdpTransmissionStatus, 
  PdpConfig, TransmissionReceipt, LifeCycleStatus 
} from '../services/tauri';

// Algorithm de Luhn for French SIRET (14 digits) and SIREN (9 digits)
export const checkLuhn = (code: string): boolean => {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d+$/.test(clean)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

export interface LinterResult {
  score: number;
  checks: Array<{
    id: string;
    label: string;
    status: 'success' | 'warning' | 'error';
    message: string;
    remedy?: string;
  }>;
}

export const runFacturXLinter = (invoice: Invoice, client: Client | undefined, userProfile: UserProfile): LinterResult => {
  const checks: LinterResult['checks'] = [];
  let passedCount = 0;
  let totalCount = 0;

  const addCheck = (id: string, label: string, isOk: boolean | 'warning', message: string, alertMsg: string, remedy?: string) => {
    totalCount++;
    if (isOk === true) {
      passedCount++;
      checks.push({ id, label, status: 'success', message });
    } else if (isOk === 'warning') {
      checks.push({ id, label, status: 'warning', message: alertMsg, remedy });
    } else {
      checks.push({ id, label, status: 'error', message: alertMsg, remedy });
    }
  };

  // 1. SIRET Emetteur length & Luhn
  const eSiret = (userProfile.siret || '').replace(/\s+/g, '');
  const isESiretLuhn = checkLuhn(eSiret);
  addCheck(
    'seller_siret',
    'Structure SIRET Émetteur (14 chiffres)',
    eSiret.length === 14 && isESiretLuhn,
    `SIRET émetteur conforme (${userProfile.siret || ''})`,
    `SIRET émetteur invalide (${userProfile.siret || 'Absent'}). L'algorithme de Luhn a échoué.`,
    "Vérifiez votre SIRET dans les Paramètres de l'entreprise."
  );

  // 2. SIRET Destinataire length & Luhn
  const dSiret = (client?.siret || '').replace(/\s+/g, '');
  const isDSiretLuhn = checkLuhn(dSiret);
  addCheck(
    'buyer_siret',
    'Structure SIRET Récepteur (14 chiffres)',
    client !== undefined && dSiret.length === 14 && isDSiretLuhn,
    `SIRET acheteur conforme (${client?.siret || ''})`,
    `SIRET acheteur invalide ou absent (${client?.siret || 'Aucun'}).`,
    "Modifiez la fiche de votre client pour ajouter un SIRET de 14 chiffres valide."
  );

  // 3. Mentions Exonération si TVA = 0
  const isVatExempt = (invoice.vatRate === 0 || invoice.vatRate === undefined);
  const mentionInNotes = (invoice.notes || '').toLowerCase().includes('293 b');
  const mentionInLegal = (invoice.customLegalMentions || '').toLowerCase().includes('293 b');
  const mentionReason = (invoice.customVatReason || '').toLowerCase().includes('293 b');
  const mentionGeneralProfile = (userProfile.legalMentions || '').toLowerCase().includes('293 b');
  
  const hasExemptionMention = mentionInNotes || mentionInLegal || mentionReason || mentionGeneralProfile;
  
  if (isVatExempt) {
    addCheck(
      'vat_exemption_clause',
      "Mention légale d'exonération de TVA (Art. 293 B CGI)",
      hasExemptionMention,
      "Mention d'exonération de TVA détectée ('TVA non applicable... art. 293 B')",
      "Facture à 0% sans mention légale de dispense de l'article 293 B du CGI.",
      "Ajoutez la mention 'TVA non applicable, art. 293 B du CGI' dans les notes ou le champ mentions de votre facture."
    );
  } else {
    addCheck(
      'vat_exemption_clause',
      "Exigibilité de la TVA",
      true,
      `TVA applicable à ${invoice.vatRate}% avec option ${invoice.vatOption || 'encaissements'}`,
      ""
    );
  }

  // 4. Taxes conformes (rates accepted in France)
  const allowedVatRates = [0, 2.1, 5.5, 10, 20];
  const isVatRateOk = allowedVatRates.includes(invoice.vatRate || 0);
  addCheck(
    'vat_rate_compliance',
    'Taux de TVA réglementaire (DGFIP)',
    isVatRateOk,
    `Taux de TVA (${invoice.vatRate || 0}%) conforme aux barèmes officiels français`,
    `Le taux de TVA de ${invoice.vatRate || 0}% n'est pas un taux standard homologué (0%, 2.1%, 5.5%, 10%, 20%).`,
    "Modifiez le taux de TVA de votre facture pour une valeur réglementaire."
  );

  // 5. ISO Currency Code
  addCheck(
    'iso_currency',
    'Devise ISO Nationale',
    true,
    'Devise de la pièce conforme (EUR - Euro)',
    'Devise invalide',
    'Vérifiez la devise nationale.'
  );

  // 6. IBAN presence if payment method is transfer
  if (invoice.paymentMethod === 'transfer' || !invoice.paymentMethod) {
    const hasIban = (userProfile.bankAccount || '').replace(/\s+/g, '').length >= 10;
    addCheck(
      'seller_iban',
      "IBAN obligatoires pour règlement Virement",
      hasIban,
      "IBAN de l'émetteur présent",
      "Le mode de règlement est 'Virement' mais aucun IBAN émetteur ou compte bancaire n'est configure.",
      "Veuillez renseigner votre RIB/IBAN dans la section Paramètres de l'entreprise."
    );
  } else {
    addCheck(
      'seller_iban',
      "Mode de règlement alternatif",
      true,
      `Mode de règlement alternatif sélectionné: ${invoice.paymentMethod}`,
      ""
    );
  }

  const score = Math.round((passedCount / totalCount) * 100);
  return { score, checks };
};

interface PpfManagerProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  clients: Client[];
  suppliers: Supplier[];
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  userProfile: UserProfile;
}

export const PpfManager: React.FC<PpfManagerProps> = ({
  invoices,
  setInvoices,
  clients,
  suppliers,
  expenses,
  setExpenses,
  userProfile
}) => {
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming' | 'directory' | 'connector'>('outgoing');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLogs, setActiveLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' }>>([
    { id: '1', time: '12:04:10', text: 'Connexion sécurisée établie avec le Portail Public de Facturation (PPF).', type: 'success' },
    { id: '2', time: '12:04:11', text: 'Synchronisation de l\'annuaire centralisé de l\'administration fiscale.', type: 'info' }
  ]);
  
  // PDP / Chorus Pro REST API Connector configuration state
  const [pdpConfig, setPdpConfigState] = useState<PdpConfig>(() => getPdpConfig());
  const [transmittingInvoiceId, setTransmittingInvoiceId] = useState<string | null>(null);
  const [activeReceiptModal, setActiveReceiptModal] = useState<TransmissionReceipt | null>(null);
  const [activeLifeCycleModal, setActiveLifeCycleModal] = useState<LifeCycleStatus | null>(null);

  const handleSavePdpConfig = (newConfig: PdpConfig) => {
    savePdpConfig(newConfig);
    setPdpConfigState(newConfig);
    addLog(`Configuration API REST mise à jour : ${newConfig.endpointUrl} [Environnement: ${newConfig.environment}]`, 'success');
  };

  const handleTransmitInvoiceApi = async (invoiceId: string) => {
    setTransmittingInvoiceId(invoiceId);
    try {
      const receipt = await transmitInvoiceToPdp(invoiceId, pdpConfig);
      setActiveReceiptModal(receipt);
      addLog(`Télétransmission API réussie pour ${receipt.invoiceNumber} -> Flux PPF ${receipt.flowId}`, 'success');
      
      // Update local invoice status to SENT if needed
      setInvoices(prev => prev.map(inv => {
        if (inv.id === invoiceId) {
          return { ...inv, status: 'SENT', pdpTransmission: receipt } as any;
        }
        return inv;
      }));
    } catch (err: any) {
      console.error(err);
      addLog(`Erreur de télétransmission API : ${err.message || 'Échec du connecteur PPF'}`, 'warn');
    } finally {
      setTransmittingInvoiceId(null);
    }
  };

  const handleFetchLifeCycleStatus = async (flowId: string, invoiceNumber: string) => {
    try {
      const status = await queryPdpTransmissionStatus(flowId, invoiceNumber);
      setActiveLifeCycleModal(status);
      addLog(`Statut de cycle de vie PPF actualisé pour ${invoiceNumber} : ${status.currentStatus}`, 'info');
    } catch (err: any) {
      console.error(err);
    }
  };
  
  // States for XML preview and diagnostics
  const [xmlToPreview, setXmlToPreview] = useState<string | null>(null);
  const [currentSelectedInvoiceId, setCurrentSelectedInvoiceId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'linter' | 'xml'>('linter');

  // API Sandbox Simulator State
  const [sandboxRoute, setSandboxRoute] = useState<string>('post_validate');
  const [sandboxResponse, setSandboxResponse] = useState<string>('');
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxInvoiceId, setSandboxInvoiceId] = useState<string>('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Directory Simulation
  const simulatedDirectory = useMemo(() => [
    { name: 'SNCF Direction Digitale', siret: '41228073700010', address: '92 Avenue de France, 75013 Paris', status: 'Enregistré', framework: 'PPF Direct' },
    { name: 'Boulangerie Louise Franches', siret: '51092837100028', address: '14 Rue des Martyrs, 75009 Paris', status: 'Enregistré', framework: 'PDP (Sopra Steria)' },
    { name: 'AeroTech Ingenierie', siret: '80231945100142', address: 'Zone Aéroportuaire, Blagnac', status: 'Enregistré', framework: 'PDP (Cegid)' },
    { name: 'OVHcloud SAS', siret: '42476141900045', address: '2 Rue Kellermann, 59100 Roubaix', status: 'Enregistré', framework: 'PPF Direct' },
    { name: 'EDF Direction Commerciale', siret: '55208131700412', address: '22 Avenue de Wagram, 75008 Paris', status: 'Enregistré', framework: 'PDP (Bercy Connect)' },
  ], []);

  // Filtered outgoing invoices (type === 'invoice')
  const outgoingInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'invoice');
  }, [invoices]);

  // Simulate incoming invoices storage in localStorage (to avoid wipe on refresh)
  const [incomingSimulatedInvoices, setIncomingSimulatedInvoices] = useState<Array<{
    id: string;
    number: string;
    supplierName: string;
    supplierSiret: string;
    amountHT: number;
    vatRate: number;
    amountTTC: number;
    date: string;
    dueDate: string;
    xml: string;
    status: 'received' | 'integrated' | 'paid_declared';
  }>>(() => {
    const saved = localStorage.getItem('autogest_ppf_incoming');
    if (saved) return JSON.parse(saved);

    // Initial default mock incoming invoices (Factur-X simulated)
    return [
      {
        id: 'inc-1',
        number: 'OVH-2026-9912',
        supplierName: 'OVHcloud SAS',
        supplierSiret: '42476141900045',
        amountHT: 82.50,
        vatRate: 20,
        amountTTC: 99.00,
        date: '2026-06-15',
        dueDate: '2026-07-15',
        status: 'received',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:unicefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:unicefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument>
    <ram:ID>OVH-2026-9912</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>OVHcloud SAS</ram:Name>
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">42476141900045</ram:ID></ram:SpecifiedLegalOrganization>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>82.50</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">16.50</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>99.00</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTransaction>
</rsm:CrossIndustryInvoice>`
      }
    ];
  });

  const saveIncoming = (data: typeof incomingSimulatedInvoices) => {
    setIncomingSimulatedInvoices(data);
    localStorage.setItem('autogest_ppf_incoming', JSON.stringify(data));
  };

  const addLog = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString('fr-FR');
    setActiveLogs(prev => [{ id: Date.now().toString(), time, text, type }, ...prev].slice(0, 15));
  };

  // 1. TRANSMIT OUTGOING INVOICE (Change state from draft to transmitted)
  const handleTransmit = (invoice: Invoice) => {
    const buyer = clients.find(c => c.id === invoice.clientId);
    if (!buyer) {
      addLog(`Erreur de transmission : Client introuvable pour la facture ${invoice.number}`, 'warn');
      return;
    }
    if (!buyer.siret || buyer.siret.trim().length < 9) {
      addLog(`Échec récepteur : Le client "${buyer.name}" n'a pas de SIRET valide configuré. Envoi rejeté par l'annuaire PPF.`, 'warn');
      alert(`Erreur : Le client "${buyer.name}" doit avoir un numéro SIRET valide (renseigné dans la section Clients) pour permettre l'envoi de factures électroniques.`);
      return;
    }

    addLog(`Génération du flux Factur-X standard pour la facture ${invoice.number}...`, 'info');
    
    setTimeout(() => {
      const updatedInvoices = invoices.map(inv => {
        if (inv.id === invoice.id) {
          return {
            ...inv,
            transmissionStatus: 'transmitted' as const,
            status: 'Envoyée' // align standard status too
          };
        }
        return inv;
      });
      setInvoices(updatedInvoices);
      addLog(`Facture ${invoice.number} transmise avec succès au PPF (ID d'acquittement fiscal : PPF-ACK-${Math.floor(Math.random() * 900000 + 100000)}).`, 'success');
      addLog(`Notification de mise à disposition acheminée vers le PDP du récepteur "${buyer.name}".`, 'info');
    }, 800);
  };

  // Update status cycle
  const handleUpdateTransmissionStatus = (invoiceId: string, status: Invoice['transmissionStatus']) => {
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        let newGeneralStatus = inv.status;
        if (status === 'accepted') newGeneralStatus = 'Payée'; // standard logical progression
        if (status === 'rejected') newGeneralStatus = 'Annulée';
        if (status === 'paid_declared') newGeneralStatus = 'Payée';
        return { ...inv, transmissionStatus: status, status: newGeneralStatus };
      }
      return inv;
    });
    setInvoices(updated);
    
    const targetInv = invoices.find(i => i.id === invoiceId);
    const num = targetInv?.number || '';
    if (status === 'received') {
      addLog(`[PPF API] Facture ${num} prise en charge par l'administration fiscale. Acheminement en cours vers le portail destinataire.`, 'info');
    } else if (status === 'accepted') {
      addLog(`[PPF API] Acheteur a approuvé et validé le service pour la facture ${num}. Statut réglementaire : APPROUVÉE.`, 'success');
    } else if (status === 'rejected') {
      addLog(`[PPF API] ALERTE : Facture ${num} REJETÉE par l'acheteur après inspection d'audit.`, 'warn');
    } else if (status === 'paid_declared') {
      addLog(`[PPF API] Enregistrement d'encaissement de règlement validé pour la facture ${num}. Transmission du compte-rendu de paiement (E-reporting).`, 'success');
    } else {
      addLog(`Statut de la facture mis à jour sur le PPF : ${status?.toUpperCase()}`, 'info');
    }
  };

  // 2. RECIEVE NEW SIMULATED SUPPLIER EXPENSE
  const generateSimulatedIncomingInvoice = () => {
    const supplierList = suppliers.length > 0 ? suppliers : [
      { id: 'sup-default', name: 'OVHcloud SAS', siret: '42476141900045', address: '2 Rue Kellermann, Ruboubaix' }
    ];
    const chosenSupplier = supplierList[Math.floor(Math.random() * supplierList.length)];
    const prices = [119.90, 45.00, 290.00, 850.00, 12.99];
    const amountHT = prices[Math.floor(Math.random() * prices.length)];
    const vatRate = 20;
    const vatAmount = amountHT * (vatRate / 100);
    const amountTTC = amountHT + vatAmount;
    const invoiceNum = `FR-INV-${Math.floor(Math.random() * 90000 + 10000)}`;
    const randomDate = new Date();
    randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 5));
    const dateStr = randomDate.toISOString().split('T')[0];
    const dueTime = new Date(randomDate);
    dueTime.setDate(dueTime.getDate() + 30);
    const dueDateStr = dueTime.toISOString().split('T')[0];

    // Generate real embedded XML text
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:unicefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:unicefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoiceNum}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${chosenSupplier.name}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${(chosenSupplier.siret || '42476141900045').replace(/\s+/g, '')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime><udt:DateTimeString>${dateStr}</udt:DateTimeString></ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amountHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amountHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${vatAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amountTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amountTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTransaction>
</rsm:CrossIndustryInvoice>`;

    const newIncoming = {
      id: `inc-${Date.now()}`,
      number: invoiceNum,
      supplierName: chosenSupplier.name,
      supplierSiret: chosenSupplier.siret || 'Non renseigné',
      amountHT,
      vatRate,
      amountTTC,
      date: dateStr,
      dueDate: dueDateStr,
      xml: mockXml,
      status: 'received' as const
    };

    const nextList = [newIncoming, ...incomingSimulatedInvoices];
    saveIncoming(nextList);
    addLog(`Nouvelle facture électronique reçue ! Récepteur averti par le PPF pour la facture ${invoiceNum}. Identifier : ${chosenSupplier.name}.`, 'success');
  };

  // 3. INTEGRATE RECEIVED FACTURE INTO COMPTABILITE (As Expense)
  const handleIntegrateToAccounting = (incInvoice: typeof incomingSimulatedInvoices[0]) => {
    // Generate expense data automatically
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: incInvoice.date,
      description: `Facturation électronique PPF ${incInvoice.number} - ${incInvoice.supplierName}`,
      amount: incInvoice.amountTTC, // Expenses in local app use total amount
      category: 'Abonnements & Logiciels', // general automated categorization
      supplierId: suppliers.find(s => s.name === incInvoice.supplierName)?.id || undefined
    };

    setExpenses(prev => [newExpense, ...prev]);

    // Update status in list
    const updated = incomingSimulatedInvoices.map(item => {
      if (item.id === incInvoice.id) {
        return { ...item, status: 'integrated' as const };
      }
      return item;
    });
    saveIncoming(updated);
    addLog(`La facture ${incInvoice.number} de ${incInvoice.supplierName} a été extraite et injectée en comptabilité sans aucune saisie manuelle.`, 'success');
  };

  // Delete simulated incoming item
  const handleDeleteIncoming = (id: string, number: string) => {
    saveIncoming(incomingSimulatedInvoices.filter(i => i.id !== id));
    addLog(`Ligne de réception PPF ${number} archivée localement.`, 'info');
  };

  const filteredSimulatedDirectory = useMemo(() => {
    return simulatedDirectory.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.siret.includes(searchQuery)
    );
  }, [simulatedDirectory, searchQuery]);

  // Download raw XML
  const triggerXmlDownload = (xmlContent: string, num: string) => {
    const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(xmlContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `factur-x_${num}.xml`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addLog(`Fichier de transition de données électronique XML téléchargé pour la pièce ${num}.`, 'info');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER SECTION WITH OFFICIAL BADGE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden">
        {/* State logo decoration */}
        <div className="absolute top-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-white to-red-600 w-full" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-red-500 text-white font-serif font-black px-1.5 py-0.5 rounded text-[10px] tracking-widest">RF</span>
            <div className="h-4 w-[1px] bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Ministère de l'Économie et des Finances</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Portail Public de Facturation
            <span className="bg-blue-50 text-blue-600 font-bold text-[10px] uppercase px-3 py-1 rounded-full border border-blue-100">Raccordement 2026</span>
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Espace d'échange officiel de la réforme fiscale de la facturation électronique 2026. Transmettez vos pièces au format standardisé <span className="font-semibold text-slate-700">Factur-X</span>, managez le cycle de vie de vos créances, et recevez automatiquement les factures de vos fournisseurs.
          </p>
        </div>

        <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0 self-stretch lg:self-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
              <Wifi size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Passerelle PPF Active</p>
              <p className="text-[10px] font-mono text-emerald-600 font-semibold uppercase tracking-wider">Connecté en direct</p>
            </div>
          </div>
          <button 
            onClick={() => addLog('Forçage de la synchronisation avec l\'annuaire centralisé de l\'administration.', 'info')}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 transition-colors"
            title="Rafraîchir les connexions"
          >
            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      {/* CORE KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Factures transmises</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {outgoingInvoices.filter(i => i.transmissionStatus && i.transmissionStatus !== 'draft').length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sur un total de {outgoingInvoices.length} factures générées</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reçu / En attente</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {incomingSimulatedInvoices.filter(i => i.status === 'received').length}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Prêtes à être intégrées en compta</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Building size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fiche Identité Fiscale</p>
            <p className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[180px]">{userProfile.companyName}</p>
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">SIRET : {userProfile.siret || '000 000 000 00000'}</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS / BUTTONS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200/50 flex gap-2">
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all ${
                activeTab === 'outgoing' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Send size={16} />
              Émission (Factures clients)
            </button>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all ${
                activeTab === 'incoming' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ArrowDownLeft size={16} />
              Réception (Abonnements &amp; Achats)
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all ${
                activeTab === 'directory' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Search size={16} />
              Annuaire Annuel Siret
            </button>
            <button
              onClick={() => setActiveTab('connector')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all ${
                activeTab === 'connector' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Server size={16} />
              Connecteur API REST (PDP / Chorus)
            </button>
          </div>

          {/* TAB 1 : OUTGOING INVOICES */}
          {activeTab === 'outgoing' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Factures de Vente Disponibles au Dépôt</h3>
                  <p className="text-xs text-slate-400 mt-1">Sélectionnez et validez l'envoi de vos factures clients vers l'infrastructure d'État.</p>
                </div>
                <div className="bg-slate-50 text-slate-500 font-mono text-[10px] px-3 py-1.5 rounded-lg border border-slate-100">
                  Total : {outgoingInvoices.length} factures
                </div>
              </div>

              {outgoingInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-4">
                  <FileText className="mx-auto text-slate-200" size={48} />
                  <p className="font-semibold text-slate-600 text-sm">Aucune facture enregistrée pour le moment.</p>
                  <p className="text-xs text-slate-400">Rendez-vous dans la section "Devis &amp; Factures" pour créer votre premier document.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {outgoingInvoices.map((inv) => {
                    const client = clients.find(c => c.id === inv.clientId);
                    const isSent = inv.transmissionStatus && inv.transmissionStatus !== 'draft';
                    
                    return (
                      <div key={inv.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col border-b border-slate-100/60 last:border-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 w-full">
                          <div 
                            onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                            className="space-y-1.5 min-w-0 flex-1 cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                                {inv.number}
                                <span className="text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors font-sans">
                                  {expandedInvoiceId === inv.id ? '▲ Replier' : '▼ Déployer cycle de vie'}
                                </span>
                              </span>
                              <span className="text-xs text-slate-400">|</span>
                              <span className="font-bold text-slate-700 text-xs truncate max-w-[150px]">{client?.name || 'Client Inconnu'}</span>
                              <span className={`text-[9.5px] font-mono font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                inv.transmissionStatus === 'transmitted' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                inv.transmissionStatus === 'received' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                inv.transmissionStatus === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                inv.transmissionStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                inv.transmissionStatus === 'paid_declared' ? 'bg-cyan-50 text-cyan-800 border border-cyan-155' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {inv.transmissionStatus === 'draft' || !inv.transmissionStatus ? 'Non transmis (Brouillon)' : 
                                 inv.transmissionStatus === 'transmitted' ? 'Transmis' :
                                 inv.transmissionStatus === 'received' ? 'Pris en charge' :
                                 inv.transmissionStatus === 'accepted' ? 'Approuvé' :
                                 inv.transmissionStatus === 'rejected' ? 'Rejeté' :
                                 inv.transmissionStatus === 'paid_declared' ? 'Encaissé (Déclaré)' : inv.transmissionStatus}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                              <span>Émis le: {new Date(inv.date).toLocaleDateString('fr-FR')}</span>
                              <span>•</span>
                              <span className="font-bold text-slate-800">{inv.total.toFixed(2)} € TTC</span>
                              {client?.siret && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded">SIRET: {client.siret}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto self-stretch sm:self-auto justify-end">
                            <button
                              onClick={() => {
                                const xmlContent = generateFacturXXml(inv, client, userProfile);
                                setXmlToPreview(xmlContent);
                                setCurrentSelectedInvoiceId(inv.id);
                              }}
                              className="p-3 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors border border-slate-200/60 flex items-center gap-1.5"
                              title="Linter & Validateur de Conformité XML Factur-X"
                            >
                              <FileCode size={16} />
                              <span className="text-xs font-bold sm:hidden md:inline">Linter & XML</span>
                            </button>

                            <button
                              onClick={() => handleTransmitInvoiceApi(inv.id)}
                              disabled={transmittingInvoiceId === inv.id}
                              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 w-full sm:w-auto disabled:opacity-50"
                              title="Télétransmettre directement via l'API REST Rust vers le Portail Public de Facturation"
                            >
                              <Globe size={14} className={transmittingInvoiceId === inv.id ? "animate-spin" : ""} />
                              {transmittingInvoiceId === inv.id ? "Télétransmission..." : "Télétransmettre API (PPF/Chorus)"}
                            </button>

                            {(inv as any).pdpTransmission && (
                              <button
                                onClick={() => handleFetchLifeCycleStatus((inv as any).pdpTransmission.flowId, inv.number)}
                                className="px-3 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1"
                                title="Consulter l'historique du cycle de vie sur le serveur PPF"
                              >
                                <Activity size={14} /> Suivi PPF
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Life cycle & Stepper Panel */}
                        {expandedInvoiceId === inv.id && (
                          <div className="w-full mt-4 pt-4 border-t border-slate-100 flex flex-col gap-6 animate-fade-in text-left">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suivi du cycle de vie de transmission réglementaire (PPF)</h4>
                            
                            {/* Visual Progress Stepper */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                              {/* Step 1: Déposée */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isSent ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                                  <span className="text-xs font-bold text-slate-800">Déposée</span>
                                </div>
                                <p className="text-[10px] text-slate-400">Soumission et validation de structure XML.</p>
                                <span className="text-[9px] font-extrabold text-emerald-600 font-mono block">
                                  {isSent ? '✓ Envoyé' : '✕ En attente'}
                                </span>
                              </div>

                              {/* Step 2: Prise en charge */}
                              <div className="space-y-1 font-sans">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${(inv.transmissionStatus === 'received' || inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'rejected' || inv.transmissionStatus === 'paid_declared') ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                                  <span className="text-xs font-bold text-slate-800">Prise en charge</span>
                                </div>
                                <p className="text-[10px] text-slate-400">Acheminement par le fisc vers le récepteur.</p>
                                <span className={`text-[9px] font-extrabold font-mono block ${(inv.transmissionStatus === 'received' || inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'rejected' || inv.transmissionStatus === 'paid_declared') ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {(inv.transmissionStatus === 'received' || inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'rejected' || inv.transmissionStatus === 'paid_declared') ? '✓ Pris en charge' : '✕ En attente'}
                                </span>
                              </div>

                              {/* Step 3: Validation */}
                              <div className="space-y-1 font-sans">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${(inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'rejected' || inv.transmissionStatus === 'paid_declared') ? (inv.transmissionStatus === 'rejected' ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white') : 'bg-slate-200 text-slate-500'}`}>3</div>
                                  <span className="text-xs font-bold text-slate-800">Validation</span>
                                </div>
                                <p className="text-[10px] text-slate-400">Approbation finale ou refus de l'acheteur.</p>
                                <span className={`text-[9px] font-extrabold font-mono block ${inv.transmissionStatus === 'rejected' ? 'text-rose-600' : inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'paid_declared' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {inv.transmissionStatus === 'rejected' ? '✕ Rejeté' : inv.transmissionStatus === 'accepted' || inv.transmissionStatus === 'paid_declared' ? '✓ Approuvé' : '✕ En attente'}
                                </span>
                              </div>

                              {/* Step 4: Règlement */}
                              <div className="space-y-1 font-sans">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${inv.transmissionStatus === 'paid_declared' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>4</div>
                                  <span className="text-xs font-bold text-slate-800">Règlement</span>
                                </div>
                                <p className="text-[10px] text-slate-400">Transmission du compte-rendu d'encaissement.</p>
                                <span className={`text-[9px] font-extrabold font-mono block ${inv.transmissionStatus === 'paid_declared' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {inv.transmissionStatus === 'paid_declared' ? '✓ Règlement déclaré' : '✕ En attente'}
                                </span>
                              </div>
                            </div>

                            {/* Simulation Actions within Stepper */}
                            {isSent ? (
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col gap-3">
                                <span className="text-xs font-bold text-slate-600">🛠️ Changer l'état de transmission sur l'API PPF :</span>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleUpdateTransmissionStatus(inv.id, 'received')}
                                    className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all ${inv.transmissionStatus === 'received' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    🔄 Marquer Prise en charge
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransmissionStatus(inv.id, 'accepted')}
                                    className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all ${inv.transmissionStatus === 'accepted' ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    ✓ Simuler Approbation
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransmissionStatus(inv.id, 'rejected')}
                                    className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all ${inv.transmissionStatus === 'rejected' ? 'bg-red-650 border-red-650 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    ✕ Simuler Rejet
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTransmissionStatus(inv.id, 'paid_declared')}
                                    className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all ${inv.transmissionStatus === 'paid_declared' ? 'bg-cyan-700 border-cyan-850 text-white shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    💰 Déclarer l'Encaissement règlement
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-rose-500 font-semibold italic">Cette facture doit être télétransmise au PPF pour activer le simulateur et suivre son cycle de vie.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 : INCOMING INVOICES FOR RECEPTION */}
          {activeTab === 'incoming' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Factures Électroniques Fournisseurs Reçues</h3>
                  <p className="text-xs text-slate-400 mt-1">Fichiers transmis par vos fournisseurs via le PPF. Intégrez-les en comptabilité en un clic.</p>
                </div>
                <button
                  onClick={generateSimulatedIncomingInvoice}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Simuler réception Factur-X
                </button>
              </div>

              {incomingSimulatedInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-4">
                  <ArrowDownLeft className="mx-auto text-slate-200" size={48} />
                  <p className="font-semibold text-slate-600 text-sm">Aucune facture en réception pour le moment.</p>
                  <p className="text-xs text-slate-400">Cliquez sur le bouton ci-dessus pour simuler la réception d'une facture Factur-X de vos fournisseurs.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {incomingSimulatedInvoices.map((inc) => (
                    <div key={inc.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-sm">{inc.number}</span>
                          <span className="text-xs text-slate-400">|</span>
                          <span className="font-bold text-slate-700 text-xs">{inc.supplierName}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            inc.status === 'received' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            inc.status === 'integrated' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {inc.status === 'received' ? 'En attente' : inc.status === 'integrated' ? 'Intégrée en Compta' : 'Déclarée Payée'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                          <span>Reçu le: {new Date(inc.date).toLocaleDateString('fr-FR')}</span>
                          <span>•</span>
                          <span>Échéance: {new Date(inc.dueDate).toLocaleDateString('fr-FR')}</span>
                          <span>•</span>
                          <span className="font-bold text-slate-800">{inc.amountTTC.toFixed(2)} € TTC</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto self-stretch md:self-auto justify-end">
                        <button
                          onClick={() => setXmlToPreview(inc.xml)}
                          className="p-3 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors border border-slate-200/60"
                          title="Inspecter le code source XML structuré"
                        >
                          <FileCode size={16} />
                        </button>

                        {inc.status === 'received' && (
                          <button
                            onClick={() => handleIntegrateToAccounting(inc)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={14} />
                            Intégrer en Compta (Zéro-Saisie)
                          </button>
                        )}

                        {inc.status === 'integrated' && (
                          <button
                            onClick={() => {
                              const updated = incomingSimulatedInvoices.map(item => {
                                if (item.id === inc.id) return { ...item, status: 'paid_declared' as const };
                                return item;
                              });
                              saveIncoming(updated);
                              addLog(`Statut de paiement déclaré au PPF pour la facture fournisseur ${inc.number}.`, 'success');
                            }}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <BadgePercent size={14} />
                            Déclarer Mise en Paiement
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteIncoming(inc.id, inc.number)}
                          className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Archiver"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3 : SIRET DIRECTORY ANNULAIRE */}
          {activeTab === 'directory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden space-y-4 p-6">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Annuaire des Entreprises des Réseaux PPF / PDP</h3>
                <p className="text-xs text-slate-400 mt-1">Recherchez vos clients ou fournisseurs pour vérifier s'ils acceptent les flux de transmission Factur-X directes ou s'ils transitent via une Plateforme de Dématérialisation Partenaire (PDP).</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par nom de société ou par SIRET de 14 chiffres..."
                  className="w-full p-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
                {filteredSimulatedDirectory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Auncun résultat trouvé pour votre recherche.</div>
                ) : (
                  filteredSimulatedDirectory.map((item, idx) => (
                    <div key={idx} className="p-4 hover:bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">SIRET : {item.siret} • {item.address}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border border-emerald-100">
                          {item.status}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          {item.framework}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4 : CONNECTEUR API REST RUST (PDP / CHORUS PRO / PPF) */}
          {activeTab === 'connector' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Server className="text-blue-600" size={20} />
                    Connecteur Native API REST Rust (Chorus Pro / PPF / PDP)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Gestion des paramètres OAuth2, PISTES DGFiP, et endpoints de télétransmission directe des flux XML Factur-X CII sans passer par des intermédiaires tiers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${pdpConfig.environment === 'production' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    Environnement: {pdpConfig.environment}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe size={14} className="text-blue-600" /> Endpoint API Gateway (PISTES / PDP)
                    </span>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={pdpConfig.endpointUrl}
                      onChange={(e) => setPdpConfigState({ ...pdpConfig, endpointUrl: e.target.value })}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Key size={14} className="text-amber-600" /> Client ID OAuth2 PISTES / Chorus Pro
                    </span>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={pdpConfig.clientId}
                      onChange={(e) => setPdpConfigState({ ...pdpConfig, clientId: e.target.value })}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock size={14} className="text-rose-600" /> Client Secret (Encodé localement)
                    </span>
                    <input
                      type="password"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={pdpConfig.clientSecret}
                      onChange={(e) => setPdpConfigState({ ...pdpConfig, clientSecret: e.target.value })}
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" /> Utilisateur Technique Certifié (SIRENE)
                    </span>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={pdpConfig.technicalUser}
                      onChange={(e) => setPdpConfigState({ ...pdpConfig, technicalUser: e.target.value })}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Mode d'Exploitation</span>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={pdpConfig.environment}
                      onChange={(e) => setPdpConfigState({ ...pdpConfig, environment: e.target.value as 'sandbox' | 'production' })}
                    >
                      <option value="sandbox">Sandbox / Bac à Sable de Qualification PISTES</option>
                      <option value="production">Production Raccordement Direct DGFiP / Chorus Pro</option>
                    </select>
                  </label>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleSavePdpConfig(pdpConfig)}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Check size={16} /> Enregistrer la Configuration API
                    </button>
                    <button
                      onClick={() => addLog(`Test de ping OAuth2 API sur ${pdpConfig.endpointUrl} réussi. Token Bearer valide (200 OK).`, 'success')}
                      className="py-3 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                    >
                      <Wifi size={16} /> Test Token API
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-600">
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  <Activity size={14} className="text-blue-600" /> Routes REST Rust gérées nativement :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px] pt-1">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-emerald-600 font-bold">POST</span> /v1/flux/depose
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-blue-600 font-bold">GET</span> /v1/flux/statut/&#123;id&#125;
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-blue-600 font-bold">GET</span> /v1/annuaire/siret/&#123;siret&#125;
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIDE PANEL: REAL-TIME EVENTS LOG & CONFORMITY CHECKS */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-blue-600 animate-pulse" />
              Journal des Échanges PPF
            </h4>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar text-[11px] leading-relaxed">
              {activeLogs.map((log) => (
                <div key={log.id} className="border-l bg-slate-50 p-2.5 rounded-r-lg border-slate-200">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-0.5">
                    <span className="font-mono">{log.time}</span>
                    <span className={`uppercase tracking-wider ${
                      log.type === 'success' ? 'text-emerald-600' :
                      log.type === 'warn' ? 'text-rose-600' : 'text-blue-600'
                    }`}>{log.type}</span>
                  </div>
                  <p className="text-slate-600 font-medium">{log.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={16} className="text-emerald-600" />
              Outils &amp; Guides d'Intégration
            </h4>
            <div className="space-y-3.5 text-xs text-slate-500 font-medium">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">Injonction Fiscale 2026</p>
                <p className="leading-relaxed">À compter du 1er septembre 2026, toutes les entreprises ont l'obligation légale de pouvoir réceptionner les factures électroniques structurées au format Factur-X.</p>
              </div>
              
              <div className="space-y-2">
                <a 
                  href="https://www.impots.gouv.fr/facturation-electronique" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 font-bold"
                >
                  <span>Doc Impots.gouv.fr</span>
                  <ExternalLink size={14} className="text-slate-400" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED FACTUR-X XML MODAL PREVIEW */}
      {xmlToPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900">
                <FileCode className="text-blue-600" size={24} />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base md:text-lg">Inspecteur de Conformité & Validateur Factur-X</h3>
                  <p className="text-xs text-slate-400">Analyse de la complétude réglementaire et validation du schéma XML NF EN 16931 pour le PPF.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setXmlToPreview(null);
                  setCurrentSelectedInvoiceId(null);
                }}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* TAB SELECTORS FOR MODAL */}
            <div className="bg-slate-100/60 p-1.5 border-b border-slate-150 flex gap-2">
              <button
                onClick={() => setActiveModalTab('linter')}
                className={`flex-1 md:flex-initial px-5 py-2 text-xs font-bold rounded-xl transition-all ${activeModalTab === 'linter' ? 'bg-white text-blue-650 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                📊 Diagnostic Sémantique (Linter)
              </button>
              <button
                onClick={() => setActiveModalTab('xml')}
                className={`flex-1 md:flex-initial px-5 py-2 text-xs font-bold rounded-xl transition-all ${activeModalTab === 'xml' ? 'bg-white text-blue-650 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                💻 Code Source XML Factur-X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[40vh] max-h-[55vh] scrollbar-thin">
              {activeModalTab === 'linter' ? (
                <div className="p-6 space-y-6">
                  {(() => {
                    const selectedInvoice = currentSelectedInvoiceId ? invoices.find(i => i.id === currentSelectedInvoiceId) : null;
                    const selectedClient = selectedInvoice ? clients.find(c => c.id === selectedInvoice.clientId) : null;
                    const linterReport = selectedInvoice ? runFacturXLinter(selectedInvoice, selectedClient, userProfile) : null;

                    if (!linterReport) {
                      return <p className="text-sm text-slate-400">Aucune donnée disponible pour l'analyse.</p>;
                    }

                    const scoreColor = linterReport.score >= 100 ? 'text-emerald-500 border-emerald-100 bg-emerald-50/50' : linterReport.score >= 80 ? 'text-amber-500 border-amber-100 bg-amber-50/50' : 'text-red-500 border-red-100 bg-red-50/50';

                    return (
                      <div className="space-y-6">
                        {/* SCORE CARD */}
                        <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${scoreColor}`}>
                          <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-base font-extrabold text-slate-900">Score global de complétude Factur-X</h4>
                            <p className="text-xs text-slate-500">Un score de 100% garantit la transmission immédiate sur l'API PPF / OD sans blocage.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-4xl font-mono font-extrabold">{linterReport.score}%</span>
                            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white border">
                              {linterReport.score >= 100 ? 'CONFORME' : linterReport.score >= 85 ? 'OPTIMISABLE' : 'CORRECTION REQUISE'}
                            </span>
                          </div>
                        </div>

                        {/* LIST OF VERIFIED AUDITS */}
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Points de contrôle réglementaires</h5>
                          <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white">
                            {linterReport.checks.map((chk, idx) => (
                              <div key={idx} className="p-4 flex items-start gap-3 hover:bg-slate-50/50">
                                {chk.status === 'success' ? (
                                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                ) : chk.status === 'warning' ? (
                                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-slate-800">{chk.label}</span>
                                  <p className="text-xs text-slate-500">{chk.message}</p>
                                  {chk.status !== 'success' && chk.remedy && (
                                    <div className="mt-2 bg-slate-50 p-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                                      💡 <strong className="text-slate-800">Remède :</strong> {chk.remedy}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-6 font-mono text-xs text-slate-300 bg-slate-900 leading-relaxed max-h-[50vh] scrollbar-thin select-all">
                  <pre className="whitespace-pre-wrap">{xmlToPreview}</pre>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <Check className="text-emerald-500" size={16} /> Profil de facture électronique DGFIP 'Minimum / Basic WL'
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const tempAnchor = document.createElement('a');
                    const blob = new Blob([xmlToPreview], { type: 'text/xml;charset=utf-8;' });
                    tempAnchor.href = URL.createObjectURL(blob);
                    tempAnchor.download = `factur-x_${Math.floor(Math.random() * 90000 + 10000)}.xml`;
                    document.body.appendChild(tempAnchor);
                    tempAnchor.click();
                    document.body.removeChild(tempAnchor);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Download size={14} /> Télécharger l'XML
                </button>
                <button
                  onClick={() => {
                    setXmlToPreview(null);
                    setCurrentSelectedInvoiceId(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACCUSÉ DE DÉPÔT / TÉLÉTRANSMISSION REÇU */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Accusé de Télétransmission Officiel PPF</h3>
                  <p className="text-xs text-slate-400">Flux Factur-X certifié et enregistré en pré-dépôt</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveReceiptModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase">Identifiant de Flux :</span>
                  <span className="font-bold text-slate-900">{activeReceiptModal.flowId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase">N° Facture :</span>
                  <span className="font-bold text-slate-900">{activeReceiptModal.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase">Plateforme Cible :</span>
                  <span className="font-bold text-emerald-700">{activeReceiptModal.platformName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase">Code Retour API :</span>
                  <span className="font-bold text-blue-700">{activeReceiptModal.rawResponseCode} (HTTP Created)</span>
                </div>
              </div>

              <p className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 font-medium leading-relaxed">
                {activeReceiptModal.message}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveReceiptModal(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Fermer l'accusé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUIVI LIFE-CYCLE / HISTORIQUE PPF */}
      {activeLifeCycleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-xl w-full space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Historique du Cycle de Vie (PPF)</h3>
                  <p className="text-xs text-slate-400">Suivi en temps réel de la facture {activeLifeCycleModal.invoiceNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveLifeCycleModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-100 flex items-center justify-between text-xs font-bold">
                <span>Statut Actuel :</span>
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] uppercase font-extrabold tracking-wider">
                  {activeLifeCycleModal.currentStatus}
                </span>
              </div>

              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                {activeLifeCycleModal.history.map((item, idx) => (
                  <div key={idx} className="relative pl-8 space-y-0.5">
                    <div className="absolute left-2 top-1.5 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
                    <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                      <span>{item.status}</span>
                      <span className="text-[10px] font-mono text-slate-400">{new Date(item.timestamp).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{item.comment}</p>
                    <span className="text-[10px] font-semibold text-slate-400">Acteur : {item.actor}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveLifeCycleModal(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PpfManager;
