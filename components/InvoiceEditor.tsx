import React, { useState, useMemo } from 'react';
import { Invoice, Client, UserProfile, DocumentType, Product } from '../types';
import { 
    ArrowLeft, Plus, Trash2, Wand2, Link as LinkIcon, Package, Database, Palette, 
    Calculator, Percent, Truck, Coins, FileCode, Eye, X, ZoomIn, ZoomOut, Bell,
    GripVertical, ArrowUp, ArrowDown, Code, Copy, Check, ChevronRight, ChevronDown,
    ShieldCheck, AlertCircle, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Standard Factur-X XML generator conforming to electronic invoice regulations
const generateFacturXXML = (invoice: any, userProfile: any, client: any) => {
    const docType = invoice.type || 'invoice';
    const docNumber = invoice.number || 'PROVISOIRE';
    const docDateStr = invoice.date ? invoice.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
    const currency = 'EUR';

    // Sums
    const subtotal = invoice.items?.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) || 0;
    const discountVal = subtotal * ((invoice.discount || 0) / 100);
    const totalHT = subtotal - discountVal + (invoice.shipping || 0);
    const vatRate = invoice.vatRate !== undefined ? invoice.vatRate : 0;
    const vatAmount = totalHT * (vatRate / 100);
    const totalTTC = totalHT + vatAmount;
    const deposit = invoice.deposit || 0;
    const balanceDue = Math.max(0, totalTTC - deposit);

    const escapeXml = (unsafe: string) => {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice 
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" 
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" 
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  
  <!-- Factur-X EN16931 (COMFORT) Compliant Metadata for 2026 Mandate -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:comfort</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(docNumber)}</ram:ID>
    <ram:TypeCode>${docType === 'invoice' ? '380' : docType === 'credit_note' ? '381' : '326'}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${escapeXml(docDateStr)}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>${escapeXml(invoice.customVatReason || (vatRate === 0 ? "TVA non applicable, art. 293 B du CGI" : "Exonération TVA"))}</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTransaction>
    <!-- Line Items Section -->
    ${(invoice.items || []).map((item: any, idx: number) => {
        const itemTotal = item.quantity * item.unitPrice;
        return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${item.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="HUR">${item.quantity.toFixed(2)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatRate === 0 ? 'O' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${vatRate.toFixed(1)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${itemTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    }).join('\n')}

    <ram:ApplicableHeaderTradeAgreement>
      <!-- Seller Trade Party (Émetteur) -->
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(userProfile.companyName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(userProfile.siret || '00000000000000')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(userProfile.address || '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>

      <!-- Buyer Trade Party (Client) -->
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(client?.name || 'Client Non Défini')}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(client?.siret || '00000000000000')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(client?.address || '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${escapeXml(docNumber)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      
      <!-- Bank Account Details (IBAN/BIC) -->
      ${userProfile.bankAccount ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DirectDebitMandateID>${escapeXml(userProfile.bankAccount)}</ram:DirectDebitMandateID>
      </ram:SpecifiedTradePaymentTerms>` : ''}

      <!-- VAT Tax Summary -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${vatAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${vatRate === 0 ? 'O' : 'S'}</ram:CategoryCode>
        <ram:RateApplicablePercent>${vatRate.toFixed(1)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>

      <!-- Grand Totals Section -->
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotal.toFixed(2)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>${invoice.shipping?.toFixed(2) || '0.00'}</ram:ChargeTotalAmount>
        <ram:TaxBasisTotalAmount>${totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${vatAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${deposit.toFixed(2)}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${balanceDue.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTransaction>
</rsm:CrossIndustryInvoice>`.trim();
};

interface InvoiceEditorProps {
    view: 'list' | 'create' | 'detail';
    activeTab: DocumentType;
    clients: Client[];
    products: Product[];
    invoices: Invoice[];
    userProfile: UserProfile;
    newDocData: Partial<Invoice>;
    setNewDocData: (data: Partial<Invoice>) => void;
    selectedClientId: string;
    setSelectedClientId: (id: string) => void;
    setView: (view: 'list' | 'create' | 'detail') => void;
    addItem: () => void;
    updateItem: (itemId: string, field: string, value: any) => void;
    removeItem: (itemId: string) => void;
    addProductItem: (productId: string) => void;
    handleGenerateDescription: (itemId: string, currentDesc: string) => Promise<void>;
    isGeneratingDesc: boolean;
    getThemeColor: (type: DocumentType) => string;
    getDocumentLabel: (type: DocumentType) => string;
    saveDocument: () => void;
    themeColor: string;
    
    // Wizard props passed from InvoiceManager
    createFormStep: number;
    setCreateFormStep: React.Dispatch<React.SetStateAction<number>>;
    previewZoom: number;
    setPreviewZoom: React.Dispatch<React.SetStateAction<number>>;
    showLivePreview: boolean;
    setShowLivePreview: (show: boolean) => void;
    formTotals: {
        subtotal: number;
        discountAmount: number;
        totalHT: number;
        vatAmount: number;
        total: number;
        balanceDue: number;
    };
    InvoicePaper: React.FC<{ invoice: any; isPreview?: boolean }>;
    getPreviewInvoice: () => any;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({
    view, activeTab, clients, products, invoices, userProfile, newDocData, setNewDocData,
    selectedClientId, setSelectedClientId, setView, addItem, updateItem, removeItem,
    addProductItem, handleGenerateDescription, isGeneratingDesc, getThemeColor,
    getDocumentLabel, saveDocument, themeColor,
    createFormStep, setCreateFormStep, previewZoom, setPreviewZoom,
    showLivePreview, setShowLivePreview, formTotals, InvoicePaper, getPreviewInvoice
}) => {
    // Interactive states for XML and drag & drop
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [previewTab, setPreviewTab] = useState<'pdf' | 'xml' | 'audit'>('pdf');
    const [xmlCopied, setXmlCopied] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
        header: true,
        seller: true,
        buyer: true,
        items: true,
        taxes: true,
        totals: true
    });

    const toggleNode = (node: string) => {
        setExpandedNodes(prev => ({ ...prev, [node]: !prev[node] }));
    };

    const reorderItems = (startIndex: number, endIndex: number) => {
        if (!newDocData.items) return;
        const result = Array.from(newDocData.items);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        setNewDocData({ ...newDocData, items: result });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            reorderItems(draggedIndex, index);
        }
        setDraggedIndex(null);
    };
    const cptColor = userProfile?.themeColor || 'blue';
    const customThemeClasses: Record<string, {
        text: string;
        bg: string;
        border: string;
        badge: string;
        ring: string;
    }> = {
        blue: {
            text: 'text-blue-600',
            bg: 'bg-blue-600',
            border: 'border-blue-500',
            badge: 'bg-blue-50 text-blue-700 border-blue-100',
            ring: 'focus:ring-blue-500/20 focus:border-blue-500'
        },
        emerald: {
            text: 'text-emerald-600',
            bg: 'bg-emerald-600',
            border: 'border-emerald-500',
            badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            ring: 'focus:ring-emerald-500/20 focus:border-emerald-500'
        },
        violet: {
            text: 'text-violet-600',
            bg: 'bg-violet-600',
            border: 'border-violet-500',
            badge: 'bg-violet-50 text-violet-700 border-violet-100',
            ring: 'focus:ring-violet-500/20 focus:border-violet-500'
        },
        amber: {
            text: 'text-amber-600',
            bg: 'bg-amber-600',
            border: 'border-amber-500',
            badge: 'bg-amber-50 text-amber-700 border-amber-100',
            ring: 'focus:ring-amber-500/20 focus:border-amber-500'
        },
        neutral: {
            text: 'text-slate-900',
            bg: 'bg-slate-900',
            border: 'border-slate-800',
            badge: 'bg-slate-100 text-slate-800 border-slate-200',
            ring: 'focus:ring-slate-900/20 focus:border-slate-950'
        }
    };
    const tc = customThemeClasses[cptColor] || customThemeClasses.blue;
    const selectedClient = clients.find(c => c.id === selectedClientId);

    const complianceAudit = useMemo(() => {
        const inv = getPreviewInvoice();
        
        const checks = [
            {
                id: 'siret_seller',
                title: 'SIRET de votre entreprise',
                description: 'Numéro SIRET à 14 chiffres obligatoire pour l\'émetteur.',
                status: userProfile?.siret && userProfile.siret.replace(/\s/g, '').length === 14 ? 'success' : 'danger',
                message: userProfile?.siret && userProfile.siret.replace(/\s/g, '').length === 14 
                    ? `SIRET valide détecté : ${userProfile.siret}`
                    : 'Le SIRET de votre entreprise est absent ou invalide (doit comporter 14 chiffres).',
                fixable: true,
                fixType: 'profile_siret'
            },
            {
                id: 'siret_buyer',
                title: 'SIRET du client (B2B)',
                description: 'Obligatoire en France pour l\'aiguillage de la facture électronique B2B via l\'annuaire du PPF.',
                status: selectedClient?.siret && selectedClient.siret.replace(/\s/g, '').length === 14 ? 'success' : 'warning',
                message: selectedClient?.siret && selectedClient.siret.replace(/\s/g, '').length === 14
                    ? `SIRET client valide détecté : ${selectedClient.siret}`
                    : 'Le SIRET du client est absent ou invalide. Optionnel en B2C mais obligatoire en B2B.',
                fixable: false
            },
            {
                id: 'vat_reason',
                title: 'Mention d\'exonération de TVA',
                description: 'Si le taux de TVA est de 0%, la mention légale d\'exonération (ex: Art. 293 B du CGI) est strictement obligatoire.',
                status: (inv.vatRate !== 0 || inv.customVatReason) ? 'success' : 'danger',
                message: (inv.vatRate !== 0 || inv.customVatReason)
                    ? (inv.vatRate === 0 ? `Mention d'exonération : "${inv.customVatReason}"` : `TVA facturée à ${inv.vatRate}%`)
                    : 'Taux de TVA à 0% sans mention légale de motif d\'exonération.',
                fixable: inv.vatRate === 0 && !inv.customVatReason,
                fixType: 'vat_reason'
            },
            {
                id: 'invoice_number',
                title: 'Numéro de pièce comptable',
                description: 'Numérotation chronologique unique sans rupture obligatoire pour toute pièce légale.',
                status: inv.number ? 'success' : 'danger',
                message: inv.number ? `Numéro de pièce : ${inv.number}` : 'Le numéro de facture est obligatoire.',
                fixable: false
            },
            {
                id: 'due_date',
                title: 'Date de règlement (Échéance)',
                description: 'La date limite de paiement doit être explicitement indiquée sur toute facture professionnelle.',
                status: inv.dueDate ? 'success' : 'danger',
                message: inv.dueDate ? `Échéance fixée au : ${inv.dueDate}` : 'La date d\'échéance est manquante.',
                fixable: true,
                fixType: 'due_date'
            },
            {
                id: 'bank_info',
                title: 'Coordonnées bancaires (IBAN)',
                description: 'Fortement recommandé pour faciliter le règlement et obligatoire pour le prélèvement.',
                status: userProfile?.bankAccount ? 'success' : 'warning',
                message: userProfile?.bankAccount ? 'IBAN configuré avec succès.' : 'Aucun IBAN n\'est configuré sur votre profil de facturation.',
                fixable: true,
                fixType: 'iban'
            }
        ];

        const successCount = checks.filter(c => c.status === 'success').length;
        const score = Math.round((successCount / checks.length) * 100);

        return {
            checks,
            score
        };
    }, [getPreviewInvoice, selectedClient, userProfile]);

    if (view !== 'create') return null;

    return (
        <div className="max-w-6xl mx-auto pb-20 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 cursor-pointer">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Éditeur : {getDocumentLabel(activeTab)}</h2>
                        <p className="text-slate-500 text-sm">Créez votre document réglementaire Factur-X pas-à-pas.</p>
                    </div>
                </div>

                {/* Stepper Progress indicators */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl w-full md:w-auto overflow-x-auto">
                    {[
                        { step: 1, label: 'Client', desc: 'Identité' },
                        { step: 2, label: 'Prestations', desc: 'Lignes' },
                        { step: 3, label: 'Conformité & Style', desc: 'Factur-X' }
                    ].map((s, index) => {
                        const isActive = createFormStep === s.step;
                        const isCompleted = createFormStep > s.step;
                        return (
                            <React.Fragment key={s.step}>
                                {index > 0 && <div className={`h-0.5 w-6 rounded-full shrink-0 ${createFormStep >= s.step ? tc.bg : 'bg-slate-200'}`} />}
                                <button
                                    type="button"
                                    onClick={() => setCreateFormStep(s.step)}
                                    className={`flex items-center gap-1.5 p-1 rounded-xl transition-all cursor-pointer whitespace-nowrap ${isActive ? 'bg-white shadow-sm px-2' : 'px-1'}`}
                                >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                                        isActive ? `${tc.bg} text-white shadow-sm` :
                                        isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        {isCompleted ? '✓' : s.step}
                                    </span>
                                    <span className={`text-[10px] font-extrabold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Colonne Gauche : Stepper Wizard */}
                <div className="lg:col-span-2 space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={createFormStep}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="space-y-6"
                        >
                            {createFormStep === 1 && (
                                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300" />
                                    <div>
                                        <span className={`text-[9px] font-extrabold uppercase tracking-widest ${tc.text} ${tc.badge} px-2.5 py-1 rounded-full`}>Étape 1 • Destination</span>
                                        <h3 className="text-lg font-black text-slate-800 mt-2">Dossier Client &amp; Calendrier</h3>
                                        <p className="text-xs text-slate-400">Renseignez le destinataire de la pièce et les dates réglementaires d'exigibilité fiscale.</p>
                                    </div>

                                    {newDocData.linkedDocumentId && (
                                        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold">
                                            <LinkIcon size={12} />
                                            Lié au document ID: {invoices.find(i => i.id === newDocData.linkedDocumentId)?.number || 'Inconnu'}
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Facturé</label>
                                            <select 
                                                className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                value={selectedClientId}
                                                onChange={(e) => setSelectedClientId(e.target.value)}
                                                disabled={!!newDocData.linkedDocumentId}
                                            >
                                                <option value="">Sélectionner un client...</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            {selectedClient && (
                                                <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-sm relative">
                                                    <div className="absolute top-3 right-3 text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Fiche Client</div>
                                                    <p className="font-extrabold text-slate-800">{selectedClient.name}</p>
                                                    <p className="text-slate-500 whitespace-pre-line mt-2 leading-relaxed font-semibold">{selectedClient.address}</p>
                                                    {selectedClient.siret && <p className="text-[10px] text-slate-400 mt-3 font-mono">SIRET: {selectedClient.siret}</p>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date d'émission</label>
                                                <input 
                                                    type="date" 
                                                    className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.date}
                                                    onChange={(e) => setNewDocData({...newDocData, date: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date d'échéance règlement</label>
                                                <input 
                                                    type="date" 
                                                    className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.dueDate}
                                                    onChange={(e) => setNewDocData({...newDocData, dueDate: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {createFormStep === 2 && (
                                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-300 via-teal-300 to-indigo-300" />
                                    <div className="flex justify-between items-start flex-wrap gap-2">
                                        <div>
                                            <span className={`text-[9px] font-extrabold uppercase tracking-widest ${tc.text} ${tc.badge} px-2.5 py-1 rounded-full`}>Étape 2 • Devis &amp; Articles</span>
                                            <h3 className="text-lg font-black text-slate-800 mt-2">Prestations de Service &amp; Produits</h3>
                                            <p className="text-xs text-slate-400">Renseignez vos prestations. Utilisez l'assistant IA (Wand) pour reformuler vos libellés de facturation.</p>
                                        </div>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold font-mono px-3 py-1 rounded-lg">
                                            {(newDocData.items || []).length} ligne(s)
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        {newDocData.items?.map((item, index) => (
                                            <div 
                                                key={item.id} 
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={() => setDraggedIndex(null)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-50 p-4 rounded-2xl border border-slate-150 group hover:border-indigo-300 transition-all shadow-sm ${draggedIndex === index ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50/10' : ''}`}
                                            >
                                                {/* Reordering Controls (Drag handle & arrows) */}
                                                <div className="flex items-center gap-1 shrink-0 select-none">
                                                    <div className="text-slate-400 cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded transition-colors hidden md:block" title="Faites glisser pour réordonner">
                                                        <GripVertical size={16} />
                                                    </div>
                                                    <div className="flex flex-row md:flex-col gap-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => reorderItems(index, index - 1)}
                                                            className="p-1 hover:bg-slate-200 rounded text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                                            title="Monter l'article"
                                                        >
                                                            <ArrowUp size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={index === (newDocData.items || []).length - 1}
                                                            onClick={() => reorderItems(index, index + 1)}
                                                            className="p-1 hover:bg-slate-200 rounded text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                                            title="Descendre l'article"
                                                        >
                                                            <ArrowDown size={12} />
                                                        </button>
                                                    </div>
                                                    <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-slate-400 border border-slate-200 shadow-sm ml-1 shrink-0">
                                                        {index + 1}
                                                    </span>
                                                </div>

                                                <div className="flex-1 w-full relative">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Description de la prestation / du produit..."
                                                        className="w-full bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none py-1.5 text-slate-800 font-extrabold placeholder:text-slate-400 transition-colors"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                    />
                                                    <button 
                                                        onClick={() => handleGenerateDescription(item.id, item.description)}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-indigo-450 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 p-1 bg-white shadow rounded-lg cursor-pointer"
                                                        title="Améliorer avec l'IA de l'Observatoire"
                                                    >
                                                        <Wand2 size={13} className={isGeneratingDesc ? "animate-spin text-violet-600" : ""} />
                                                    </button>
                                                </div>
                                                <div className="flex gap-4 w-full md:w-auto">
                                                    <div className="flex flex-col w-20">
                                                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Qté</label>
                                                        <input 
                                                            type="number" min="0" step="0.5"
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-right font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col w-24">
                                                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">P.U. HT</label>
                                                        <input 
                                                            type="number" min="0" step="0.01"
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-right font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                            value={item.unitPrice}
                                                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col min-w-20 justify-end">
                                                        <div className="text-right font-extrabold text-slate-900 py-2 font-mono">
                                                            {(item.quantity * item.unitPrice).toFixed(2)} €
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeItem(item.id)} className="self-end mb-2.5 text-slate-350 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-lg cursor-pointer">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {newDocData.items?.length === 0 && (
                                            <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                                <Package className="mx-auto text-slate-300 mb-2" size={28} />
                                                <p className="text-xs font-bold text-slate-500">Aucune ligne de facture pour le moment</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Ajoutez une ligne ou importer un modèle depuis le catalogue.</p>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                            <button onClick={addItem} className={`flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-${themeColor}-400 hover:text-${themeColor}-600 transition-all font-medium flex items-center justify-center gap-2 cursor-pointer bg-white`}>
                                                <Plus size={18} /> Ajouter une ligne vide
                                            </button>
                                            
                                            <div className="relative flex-1">
                                                <select 
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            addProductItem(e.target.value);
                                                            e.target.value = "";
                                                        }
                                                    }}
                                                    className={`w-full py-3 pl-10 pr-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-${themeColor}-400 hover:text-${themeColor}-600 transition-all font-medium appearance-none cursor-pointer bg-white outline-none`}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>+ Ajouter depuis le catalogue</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price.toFixed(2)}€</option>)}
                                                    {products.length === 0 && <option value="" disabled>Catalogue vide</option>}
                                                </select>
                                                <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {createFormStep === 3 && (
                                <div className="space-y-6">
                                    {/* BLOC CONFORMITE ELECTONIQUE 2026 */}
                                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-300 via-purple-300 to-emerald-300" />
                                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                            <Database className="text-indigo-600" size={20} />
                                            <div>
                                                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${tc.text} ${tc.badge} px-2.5 py-1 rounded-full`}>Étape 3 • Conformité</span>
                                                <h3 className="font-extrabold text-slate-900 text-sm md:text-base mt-2">Options de Conformité &amp; Facturation Électronique 2026</h3>
                                                <p className="text-xs text-slate-400">Réglementations obligatoires de la réforme 2026 (Portail Public CHORUS / PPF).</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Nature de l'opération */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nature de l'opération</label>
                                                <select 
                                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.operationType || 'services'}
                                                    onChange={(e) => setNewDocData({...newDocData, operationType: e.target.value as any})}
                                                >
                                                    <option value="services">Prestation de services (standard)</option>
                                                    <option value="goods">Livraison de biens</option>
                                                    <option value="mixed">Opérations mixtes (Prestations &amp; Biens)</option>
                                                </select>
                                            </div>

                                            {/* Régime d'exigibilité de la taxe */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exigibilité de la TVA</label>
                                                <select 
                                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.vatOption || 'encaissements'}
                                                    onChange={(e) => setNewDocData({...newDocData, vatOption: e.target.value as any})}
                                                >
                                                    <option value="encaissements">TVA sur encaissements (standard prestataires)</option>
                                                    <option value="debits">TVA sur débits (standard vendeurs)</option>
                                                </select>
                                            </div>

                                            {/* Moyen de réglement */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moyen de règlement prévu</label>
                                                <select 
                                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.paymentMethod || 'transfer'}
                                                    onChange={(e) => setNewDocData({...newDocData, paymentMethod: e.target.value as any})}
                                                >
                                                    <option value="transfer">Virement Bancaire (recommandé SEPA)</option>
                                                    <option value="card">Carte bancaire (CB)</option>
                                                    <option value="direct_debit">Prélèvement automatique</option>
                                                    <option value="check">Chèque de table/banque</option>
                                                    <option value="cash">Espèces</option>
                                                </select>
                                            </div>

                                            {/* Taux de TVA applicable sur la facture */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Taux Global de TVA de la pièce</label>
                                                <select 
                                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all font-semibold text-slate-700`}
                                                    value={newDocData.vatRate !== undefined ? newDocData.vatRate : 0}
                                                    onChange={(e) => {
                                                        const rate = parseFloat(e.target.value);
                                                        const updatedData = { ...newDocData, vatRate: rate };
                                                        if (rate === 0) {
                                                            // Auto prefill mandatory exemption reason
                                                            updatedData.customVatReason = "TVA non applicable, art. 293 B du CGI";
                                                        } else if (newDocData.customVatReason === "TVA non applicable, art. 293 B du CGI") {
                                                            // Clear if it was set automatically and we switched back to a taxed rate
                                                            updatedData.customVatReason = "";
                                                        }
                                                        setNewDocData(updatedData);
                                                    }}
                                                >
                                                    <option value="0">0% (Franchise en base de TVA - Art. 293 B du CGI)</option>
                                                    <option value="2.1">2.1% (Taux particulier - Presse, etc.)</option>
                                                    <option value="5.5">5.5% (Taux réduit - Alimentation, Livres)</option>
                                                    <option value="10">10% (Taux intermédiaire - Hôtellerie, Restauration)</option>
                                                    <option value="20">20% (Taux normal - Services, Prestations et Biens standards)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Adresse de livraison spécifique */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adresse de livraison spécifique (Optionnelle)</label>
                                            <input 
                                                type="text"
                                                placeholder="Identique à l'adresse du client par défaut..."
                                                className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${tc.ring} outline-none transition-all text-sm font-semibold text-slate-700`}
                                                value={newDocData.deliveryAddress || ''}
                                                onChange={(e) => setNewDocData({...newDocData, deliveryAddress: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* Visuel & Marque */}
                                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 space-y-6">
                                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                            <Palette className="text-violet-600" size={20} />
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-sm md:text-base">Personnalisation Visuelle &amp; Éditoriale</h3>
                                                <p className="text-xs text-slate-400">Affinez l'allure graphique et le style éditorial de cette pièce pour la rendre unique.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* 1. Couleur Thématique de la pièce */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Surlignage Couleur du Document</label>
                                                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                    {(['blue', 'emerald', 'violet', 'amber', 'neutral'] as const).map((color) => {
                                                        const isSelected = newDocData.customThemeColor === color || (!newDocData.customThemeColor && themeColor === color);
                                                        const colorClasses: Record<string, string> = {
                                                            blue: 'bg-blue-600 border-blue-400',
                                                            emerald: 'bg-emerald-600 border-emerald-400',
                                                            violet: 'bg-violet-600 border-violet-400',
                                                            amber: 'bg-amber-600 border-amber-400',
                                                            neutral: 'bg-slate-600 border-slate-400'
                                                        };
                                                        return (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                onClick={() => setNewDocData({...newDocData, customThemeColor: color})}
                                                                className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center text-white text-[9px] ${colorClasses[color]} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105 font-bold' : 'opacity-85'}`}
                                                                title={`Thème ${color}`}
                                                            >
                                                                {isSelected && '✓'}
                                                            </button>
                                                        );
                                                    })}
                                                    {newDocData.customThemeColor && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewDocData({...newDocData, customThemeColor: undefined})}
                                                            className="text-[9px] text-slate-400 font-bold hover:text-slate-650 underline pl-1 cursor-pointer"
                                                        >
                                                            Défaut
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Logo / Symbole Émoticône */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Émoticône de pièce</label>
                                                <div className="flex gap-1.5 flex-wrap items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    {['💼', '🛠️', '🚀', '🎨', '🤝'].map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            onClick={() => setNewDocData({...newDocData, customLogo: emoji})}
                                                            className={`w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-xs hover:scale-110 transition-all cursor-pointer ${newDocData.customLogo === emoji ? 'border-violet-550 ring-2 ring-violet-500/10' : ''}`}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                    <input
                                                        type="text"
                                                        placeholder="..."
                                                        className="w-8 h-7 p-0.5 text-center bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none"
                                                        maxLength={2}
                                                        value={newDocData.customLogo || ''}
                                                        onChange={(e) => setNewDocData({...newDocData, customLogo: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                            {/* 3. Style d'En-tête (customBannerStyle) */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Style de l'En-tête de page </label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[
                                                        { value: 'minimal', label: 'Minimal', desc: 'Discret' },
                                                        { value: 'bordered', label: 'Bordure', desc: 'Ligne couleur' },
                                                        { value: 'gradient', label: 'Dégradé', desc: 'Arrière-plan' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setNewDocData({...newDocData, customBannerStyle: opt.value as any})}
                                                            className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${newDocData.customBannerStyle === opt.value || (!newDocData.customBannerStyle && opt.value === 'minimal') ? 'border-violet-600 bg-violet-50/25' : 'border-slate-200 bg-slate-50/50'}`}
                                                        >
                                                            <span className="text-[11px] font-extrabold text-slate-800">{opt.label}</span>
                                                            <span className="text-[9px] text-slate-400 mt-0.5 font-medium">{opt.desc}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 4. Slogan ou Sous-titre Commercial (customSubtitle) */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sous-titre ou Slogan de l'Émetteur</label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Consultant Tech sénior, Expert Cloud..."
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-700"
                                                    value={newDocData.customSubtitle || ''}
                                                    onChange={(e) => setNewDocData({...newDocData, customSubtitle: e.target.value})}
                                                />
                                            </div>

                                            {/* 5. Titre alternatif du document */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Titre alternatif du document</label>
                                                <input 
                                                    type="text"
                                                    placeholder={`Ex: Devis Spécialisé, Facture Intermédiaire...`}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-700"
                                                    value={newDocData.customTitle || ''}
                                                    onChange={(e) => setNewDocData({...newDocData, customTitle: e.target.value})}
                                                />
                                            </div>

                                            {/* 6. Signataire Responsable */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom &amp; Titre du Signataire (Cadre "Bon pour accord")</label>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: Jean Dupont, Gérant..."
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-700"
                                                    value={newDocData.customSignatory || ''}
                                                    onChange={(e) => setNewDocData({...newDocData, customSignatory: e.target.value})}
                                                />
                                            </div>

                                            {/* 7. Colonne TVA Masquable (hideVatColumn) */}
                                            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-700">Alléger le tableau de facturation</span>
                                                    <span className="block text-[10px] text-slate-400 font-semibold">Masquer la colonne TVA des articles (si non-assujetti).</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewDocData({...newDocData, hideVatColumn: !newDocData.hideVatColumn})}
                                                    className={`w-10 h-5.5 rounded-full transition-all relative shrink-0 cursor-pointer ${newDocData.hideVatColumn ? 'bg-violet-600' : 'bg-slate-200'}`}
                                                >
                                                    <span className={`absolute top-0.75 bg-white w-4 h-4 rounded-full transition-all ${newDocData.hideVatColumn ? 'left-5' : 'left-0.75'}`}></span>
                                                </button>
                                            </div>

                                            {/* 8. Motif d'exonération de TVA (customVatReason) */}
                                            <div className="md:col-span-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Motif Fiscal d'Exonération de TVA</label>
                                                    {newDocData.vatRate === 0 && !newDocData.customVatReason && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewDocData({ ...newDocData, customVatReason: "TVA non applicable, art. 293 B du CGI" })}
                                                            className="text-[10px] font-bold text-violet-650 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                                        >
                                                            ⚡ Suggérer : Franchise Art. 293 B
                                                        </button>
                                                    )}
                                                </div>
                                                <input 
                                                    type="text"
                                                    placeholder="Ex: TVA non applicable, art. 293 B du CGI..."
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold text-slate-700"
                                                    value={newDocData.customVatReason || ''}
                                                    onChange={(e) => setNewDocData({...newDocData, customVatReason: e.target.value})}
                                                />
                                            </div>

                                            {/* 9. Footers */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes réglementaires additionnelles spécifiques</label>
                                                <textarea 
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none font-semibold text-slate-700"
                                                    rows={2}
                                                    value={newDocData.customLegalMentions || ''}
                                                    onChange={e => setNewDocData({...newDocData, customLegalMentions: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Wizard Navigation control footer block */}
                    <div className="flex justify-between items-center bg-white rounded-3xl border border-slate-200 p-5.5 shadow-sm mt-6">
                        <button
                            type="button"
                            onClick={() => setCreateFormStep(prev => Math.max(1, prev - 1))}
                            disabled={createFormStep === 1}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 font-extrabold text-xs text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Précédent
                        </button>
                        
                        {createFormStep < 3 ? (
                            <button
                                type="button"
                                onClick={() => setCreateFormStep(prev => Math.min(3, prev + 1))}
                                className={`px-6 py-2.5 ${tc.bg} hover:opacity-90 transition-all font-extrabold text-xs text-white rounded-xl shadow-md cursor-pointer`}
                            >
                                Suivant
                            </button>
                        ) : (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                Toutes les étapes validées
                            </span>
                        )}
                    </div>
                </div>

                {/* Colonne Droite : Totaux & Validation */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-xl sticky top-6">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                            <Calculator size={20} className="text-blue-400" />
                            Récapitulatif
                        </h3>

                        <div className="space-y-4 mb-6 text-sm">
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Sous-total HT</span>
                                <span className="font-mono font-bold">{formTotals.subtotal.toFixed(2)} €</span>
                            </div>
                            
                            {/* Remise Input */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Percent size={14} className="text-slate-500" />
                                    <span>Remise (%)</span>
                                </div>
                                <input 
                                    type="number" min="0" max="100"
                                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white outline-none focus:border-blue-500 font-bold"
                                    value={newDocData.discount || ''}
                                    onChange={(e) => setNewDocData({...newDocData, discount: parseFloat(e.target.value) || 0})}
                                    placeholder="0"
                                />
                            </div>
                            {formTotals.discountAmount > 0 && (
                                <div className="flex justify-end text-xs text-emerald-400 font-mono font-semibold">
                                    - {formTotals.discountAmount.toFixed(2)} €
                                </div>
                            )}

                            {/* Shipping Input */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Truck size={14} className="text-slate-500" />
                                    <span>Frais de port</span>
                                </div>
                                <input 
                                    type="number" min="0"
                                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white outline-none focus:border-blue-500 font-bold"
                                    value={newDocData.shipping || ''}
                                    onChange={(e) => setNewDocData({...newDocData, shipping: parseFloat(e.target.value) || 0})}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="h-px bg-slate-800 my-4"></div>

                            <div className="flex justify-between items-end">
                                <span className="font-bold text-slate-400 text-sm">Total TTC</span>
                                <span className="font-black text-2xl tracking-tight text-white font-mono">{formTotals.total.toFixed(2)} €</span>
                            </div>

                            {/* Deposit Input */}
                            <div className="bg-slate-800/50 p-4.5 rounded-2xl mt-6 border border-slate-850">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 text-slate-300 text-xs uppercase font-bold">
                                        <Coins size={12} className="text-amber-400" />
                                        <span>Acompte</span>
                                    </div>
                                    <input 
                                        type="number" min="0"
                                        className="w-24 bg-slate-900 border border-slate-750 rounded-lg px-2 py-1 text-right text-white outline-none focus:border-blue-500 font-mono text-sm font-bold"
                                        value={newDocData.deposit || ''}
                                        onChange={(e) => setNewDocData({...newDocData, deposit: parseFloat(e.target.value) || 0})}
                                        placeholder="0.00"
                                    />
                                </div>

                                {/* Quick Percentage Selectors */}
                                <div className="flex justify-end gap-1.5 mb-3">
                                    {[30, 40, 50].map((pct) => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => {
                                                const calculatedDeposit = Math.round((formTotals.total * pct / 100) * 100) / 100;
                                                setNewDocData({ ...newDocData, deposit: calculatedDeposit });
                                            }}
                                            className="text-[10px] bg-slate-850 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md font-extrabold transition-all cursor-pointer"
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                    {newDocData.deposit !== undefined && newDocData.deposit > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setNewDocData({ ...newDocData, deposit: 0 })}
                                            className="text-[10px] bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 text-red-300 px-2 py-1 rounded-md font-semibold transition-all cursor-pointer"
                                        >
                                            Effacer
                                        </button>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-2.5 border-t border-slate-750">
                                    <span className="text-blue-300 font-bold text-xs uppercase">Reste dû</span>
                                    <span className="text-blue-100 font-black font-mono text-xl">{formTotals.balanceDue.toFixed(2)} €</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <button 
                                onClick={saveDocument}
                                className={`w-full bg-${themeColor}-600 text-white py-4 rounded-xl hover:bg-${themeColor}-550 font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2`}
                            >
                                <FileCode size={16} /> Enregistrer la pièce
                            </button>
                            
                            {selectedClientId && (
                                <button 
                                    onClick={() => {
                                        setPreviewZoom(100);
                                        setShowLivePreview(true);
                                    }}
                                    className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl hover:bg-slate-750 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Eye size={18} /> Prévisualiser Factur-X
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic sliding drawer Flyout companion */}
            <AnimatePresence>
                {showLivePreview && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLivePreview(false)}
                            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
                        />

                        {/* Sliding Tray Drawer */}
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 26, stiffness: 180 }}
                            className="fixed top-0 right-0 h-screen w-full max-w-4xl bg-slate-100 z-50 shadow-2xl flex flex-col border-l border-slate-200"
                        >
                            {/* Flyout Header with tabs */}
                            <div className="flex flex-col bg-white border-b border-slate-200 shrink-0">
                                <div className="flex justify-between items-center p-4">
                                    <div className="space-y-0.5">
                                        <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                                            <Eye size={18} className="text-violet-600"/> Compagnon de Rendu Factur-X
                                        </h3>
                                        <p className="text-[10px] text-slate-400">Génération de la pièce légale avec son enveloppe XML fusionnée.</p>
                                    </div>

                                    {/* Controls and Actions */}
                                    <div className="flex items-center gap-4">
                                        {/* Interactive Zoom tool (Only show for PDF preview) */}
                                        {previewTab === 'pdf' && (
                                            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-xl">
                                                <button 
                                                    type="button"
                                                    onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                                                    title="Zoom Arrière"
                                                >
                                                    <ZoomOut size={13} />
                                                </button>
                                                <span className="text-[11px] font-mono font-bold text-slate-600 min-w-10 text-center">{previewZoom}%</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => setPreviewZoom(z => Math.min(130, z + 10))}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                                                    title="Zoom Avant"
                                                >
                                                    <ZoomIn size={13} />
                                                </button>
                                            </div>
                                        )}

                                        <button 
                                            onClick={() => setShowLivePreview(false)}
                                            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs for PDF/XML Selection */}
                                <div className="flex px-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewTab('pdf')}
                                        className={`py-3 px-4 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${previewTab === 'pdf' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <FileCode size={14} />
                                        Aperçu PDF (Factur-X)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewTab('xml')}
                                        className={`py-3 px-4 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${previewTab === 'xml' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <Code size={14} />
                                        Inspecteur XML &amp; Données Structurées
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewTab('audit')}
                                        className={`py-3 px-4 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${previewTab === 'audit' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <ShieldCheck size={14} />
                                        Diagnostic de Conformité 2026
                                    </button>
                                </div>
                            </div>

                            {/* Viewport Selection */}
                            {previewTab === 'pdf' ? (
                                /* Tactile scrollable paper stage */
                                <div className="flex-1 overflow-y-auto p-12 bg-slate-250 flex justify-center items-start">
                                    <div 
                                        className="transition-transform duration-250 ease-out origin-top"
                                        style={{ transform: `scale(${previewZoom / 100})` }}
                                    >
                                        <div className="relative">
                                            {/* Layered physical paper backgrounds for A4 depth stack simulation */}
                                            <div className="absolute inset-x-2 top-2 h-full bg-slate-300/10 rounded-sm translate-y-3 shadow-sm border border-slate-350/20 -z-30" />
                                            <div className="absolute inset-x-1 top-1 h-full bg-slate-100 rounded-sm translate-y-1.5 shadow-md border border-slate-300/30 -z-20" />
                                            
                                            {/* Primary Document Card Frame with heavy soft shadow */}
                                            <div className="bg-white rounded-sm shadow-2xl border border-slate-200/60 overflow-hidden text-left">
                                                <InvoicePaper invoice={getPreviewInvoice()} isPreview={true} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : previewTab === 'xml' ? (
                                /* Interactive High-tech XML Metadata Viewer & Code Source */
                                <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 flex flex-col p-6">
                                    {/* Sub-header */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800 shrink-0">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-black tracking-widest text-violet-400 bg-violet-950/55 px-2.5 py-1 rounded-full border border-violet-900/40">Factur-X / EDI 2026</span>
                                                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/30">Profil COMFORT</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-300 mt-2">Métadonnées XML d'intégration fiscale de la pièce</h4>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const xmlText = generateFacturXXML(getPreviewInvoice(), userProfile, selectedClient);
                                                    navigator.clipboard.writeText(xmlText);
                                                    setXmlCopied(true);
                                                    setTimeout(() => setXmlCopied(false), 2000);
                                                }}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-sm"
                                            >
                                                {xmlCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                {xmlCopied ? 'XML Copié !' : 'Copier l\'XML'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Main Inspector Section */}
                                    <div className="flex-1 grid grid-cols-1 gap-6 overflow-y-auto">
                                        {/* Node Tree view */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Explorateur de Nœuds Factur-X (Vue Structurée)</span>
                                            </div>
                                            
                                            <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4.5 space-y-4.5 font-mono text-xs">
                                                {/* Node Header */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('header')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.header ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;rsm:ExchangedDocument&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">({getPreviewInvoice().number || 'PROVISOIRE'})</span>
                                                    </button>
                                                    {expandedNodes.header && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-1.5 py-1 text-[11px] text-slate-300">
                                                            <p><span className="text-slate-500">&lt;ram:ID&gt;</span>{getPreviewInvoice().number || 'PROVISOIRE'}<span className="text-slate-500">&lt;/ram:ID&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:TypeCode&gt;</span>{getPreviewInvoice().type === 'invoice' ? '380' : getPreviewInvoice().type === 'credit_note' ? '381' : '326'}<span className="text-slate-500">&lt;/ram:TypeCode&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:IssueDateTime&gt;</span>{getPreviewInvoice().date || 'Non spécifiée'}<span className="text-slate-500">&lt;/ram:IssueDateTime&gt;</span></p>
                                                            {getPreviewInvoice().customVatReason && (
                                                                <p><span className="text-slate-500">&lt;ram:Content&gt;</span>{getPreviewInvoice().customVatReason}<span className="text-slate-500">&lt;/ram:Content&gt;</span></p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Node Seller */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('seller')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.seller ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;ram:SellerTradeParty&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">(Émetteur)</span>
                                                    </button>
                                                    {expandedNodes.seller && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-1.5 py-1 text-[11px] text-slate-300">
                                                            <p><span className="text-slate-500">&lt;ram:Name&gt;</span><strong className="text-indigo-300">{userProfile.companyName}</strong><span className="text-slate-500">&lt;/ram:Name&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:ID schemeID="0002"&gt;</span>{userProfile.siret || 'Non renseigné'}<span className="text-slate-500">&lt;/ram:ID&gt;</span> <span className="text-[10px] text-slate-500">(SIRET)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:LineOne&gt;</span>{userProfile.address || 'Non spécifiée'}<span className="text-slate-500">&lt;/ram:LineOne&gt;</span></p>
                                                            {userProfile.bankAccount && (
                                                                <p><span className="text-slate-500">&lt;ram:IBAN&gt;</span>{userProfile.bankAccount}<span className="text-slate-500">&lt;/ram:IBAN&gt;</span></p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Node Buyer */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('buyer')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.buyer ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;ram:BuyerTradeParty&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">(Client)</span>
                                                    </button>
                                                    {expandedNodes.buyer && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-1.5 py-1 text-[11px] text-slate-300">
                                                            <p><span className="text-slate-500">&lt;ram:Name&gt;</span><strong className="text-indigo-300">{selectedClient?.name || 'Client Provisoire'}</strong><span className="text-slate-500">&lt;/ram:Name&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:ID schemeID="0002"&gt;</span>{selectedClient?.siret || 'Non renseigné'}<span className="text-slate-500">&lt;/ram:ID&gt;</span> <span className="text-[10px] text-slate-500">(SIRET)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:LineOne&gt;</span>{selectedClient?.address || 'Non spécifiée'}<span className="text-slate-500">&lt;/ram:LineOne&gt;</span></p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Node Items */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('items')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.items ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;ram:IncludedSupplyChainTradeLineItem&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">({(getPreviewInvoice().items || []).length} prestation(s))</span>
                                                    </button>
                                                    {expandedNodes.items && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-4 py-1 text-[11px] text-slate-300">
                                                            {(getPreviewInvoice().items || []).map((it: any, idx: number) => (
                                                                <div key={it.id} className="space-y-1 pb-2 border-b border-slate-800 last:border-0 last:pb-0">
                                                                    <p className="text-slate-400 font-black">Prestation #{idx + 1}</p>
                                                                    <p><span className="text-slate-500">&lt;ram:Name&gt;</span><span className="text-slate-200">{it.description}</span><span className="text-slate-500">&lt;/ram:Name&gt;</span></p>
                                                                    <p><span className="text-slate-500">&lt;ram:BilledQuantity&gt;</span>{it.quantity} HUR<span className="text-slate-500">&lt;/ram:BilledQuantity&gt;</span></p>
                                                                    <p><span className="text-slate-500">&lt;ram:ChargeAmount&gt;</span>{it.unitPrice.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:ChargeAmount&gt;</span></p>
                                                                    <p><span className="text-slate-500">&lt;ram:LineTotalAmount&gt;</span>{(it.quantity * it.unitPrice).toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:LineTotalAmount&gt;</span></p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Node Taxes */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('taxes')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.taxes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;ram:ApplicableTradeTax&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">(Calcul de TVA)</span>
                                                    </button>
                                                    {expandedNodes.taxes && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-1.5 py-1 text-[11px] text-slate-300">
                                                            <p><span className="text-slate-500">&lt;ram:TypeCode&gt;</span>VAT<span className="text-slate-500">&lt;/ram:TypeCode&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:CategoryCode&gt;</span>{(getPreviewInvoice().vatRate || 0) === 0 ? 'O (Exonéré)' : 'S (Standard)'}<span className="text-slate-500">&lt;/ram:CategoryCode&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:RateApplicablePercent&gt;</span>{(getPreviewInvoice().vatRate || 0).toFixed(1)}%<span className="text-slate-500">&lt;/ram:RateApplicablePercent&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:BasisAmount&gt;</span>{formTotals.totalHT.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:BasisAmount&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:CalculatedAmount&gt;</span>{formTotals.vatAmount.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:CalculatedAmount&gt;</span></p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Node Totals */}
                                                <div className="space-y-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleNode('totals')}
                                                        className="flex items-center gap-2 text-violet-400 hover:text-violet-300 font-extrabold w-full text-left cursor-pointer"
                                                    >
                                                        {expandedNodes.totals ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>&lt;ram:SpecifiedTradeSettlementHeaderMonetarySummation&gt;</span>
                                                        <span className="text-[10px] text-slate-500 font-normal">(Totaux Généraux)</span>
                                                    </button>
                                                    {expandedNodes.totals && (
                                                        <div className="pl-6 border-l border-slate-850 space-y-1.5 py-1 text-[11px] text-slate-300">
                                                            <p><span className="text-slate-500">&lt;ram:LineTotalAmount&gt;</span>{formTotals.subtotal.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:LineTotalAmount&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:ChargeTotalAmount&gt;</span>{(getPreviewInvoice().shipping || 0).toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:ChargeTotalAmount&gt;</span> <span className="text-[10px] text-slate-500">(Frais de port)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:TaxBasisTotalAmount&gt;</span>{formTotals.totalHT.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:TaxBasisTotalAmount&gt;</span> <span className="text-[10px] text-slate-500">(Total HT net)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:TaxTotalAmount&gt;</span>{formTotals.vatAmount.toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:TaxTotalAmount&gt;</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:GrandTotalAmount&gt;</span><strong className="text-emerald-400">{formTotals.total.toFixed(2)} EUR</strong><span className="text-slate-500">&lt;/ram:GrandTotalAmount&gt;</span> <span className="text-[10px] text-slate-500">(TTC)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:TotalPrepaidAmount&gt;</span>{(getPreviewInvoice().deposit || 0).toFixed(2)} EUR<span className="text-slate-500">&lt;/ram:TotalPrepaidAmount&gt;</span> <span className="text-[10px] text-slate-500">(Acompte)</span></p>
                                                            <p><span className="text-slate-500">&lt;ram:DuePayableAmount&gt;</span><strong className="text-amber-400">{formTotals.balanceDue.toFixed(2)} EUR</strong><span className="text-slate-500">&lt;/ram:DuePayableAmount&gt;</span> <span className="text-[10px] text-slate-500">(Solde à payer)</span></p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Source XML Block */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Source XML Structuré (Factur-X / EDI)</span>
                                            </div>
                                            
                                            <pre className="font-mono text-[10px] md:text-[11px] text-slate-300 overflow-x-auto p-4 bg-slate-950 rounded-2xl border border-slate-800 leading-relaxed max-h-[400px] overflow-y-auto select-all">
                                                {generateFacturXXML(getPreviewInvoice(), userProfile, selectedClient)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Audit Panel - Diagnostic de Conformité 2026 */
                                <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 flex flex-col p-6">
                                    {/* Sub-header */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800 shrink-0">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-black tracking-widest text-violet-400 bg-violet-950/55 px-2.5 py-1 rounded-full border border-violet-900/40">Audit de Conformité</span>
                                                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/30 font-sans">Réforme Facturation 2026</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-300 mt-2">Diagnostic légal de votre facture électronique</h4>
                                        </div>
                                    </div>

                                    {/* Audit Core Score Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0 text-left">
                                        {/* Score Gauges */}
                                        <div className="md:col-span-1 bg-slate-950/60 border border-slate-850 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Score de Conformité</span>
                                            <div className="relative flex items-center justify-center w-24 h-24">
                                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                    <path
                                                        className="text-slate-850"
                                                        strokeWidth="3"
                                                        stroke="currentColor"
                                                        fill="none"
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    />
                                                    <path
                                                        className={`${complianceAudit.score === 100 ? 'text-emerald-500' : complianceAudit.score >= 70 ? 'text-violet-500' : 'text-amber-500'} transition-all duration-500`}
                                                        strokeDasharray={`${complianceAudit.score}, 100`}
                                                        strokeWidth="3"
                                                        strokeLinecap="round"
                                                        stroke="currentColor"
                                                        fill="none"
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    />
                                                </svg>
                                                <div className="absolute text-xl font-black font-mono">
                                                    {complianceAudit.score}%
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-3 font-semibold">
                                                {complianceAudit.score === 100 ? '✨ Document 100% conforme !' : '⚠️ Des corrections sont recommandées.'}
                                            </span>
                                        </div>

                                        {/* Regulatory Info Card */}
                                        <div className="md:col-span-2 bg-slate-950/60 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between">
                                            <div>
                                                <h5 className="text-xs font-extrabold text-violet-400 uppercase tracking-widest mb-1">Réglementation Chorus Pro / PPF</h5>
                                                <p className="text-[11px] text-slate-350 leading-relaxed font-sans">
                                                    En France, la réforme de la facturation électronique impose la transmission structurée (en format mixte PDF/A-3 Factur-X) via le Portail Public de Facturation (PPF). Les mentions comme le SIRET des deux parties et le détail d\'exemption de TVA sont contrôlés automatiquement à la réception.
                                                </p>
                                            </div>
                                            <div className="text-[10px] bg-slate-900/80 border border-slate-800 p-2 rounded-xl text-slate-400 flex items-center gap-2 mt-4">
                                                <Info size={13} className="text-violet-400 shrink-0" />
                                                <span className="font-sans">Utilisez les corrections rapides pour rendre votre document conforme immédiatement.</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Checklist */}
                                    <div className="space-y-4 flex-1 text-left">
                                        <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Points de Contrôle Analysés</span>
                                        <div className="space-y-3">
                                            {complianceAudit.checks.map((check) => (
                                                <div 
                                                    key={check.id}
                                                    className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-800 transition-all"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            {check.status === 'success' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />}
                                                            {check.status === 'warning' && <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />}
                                                            {check.status === 'danger' && <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />}
                                                            <h6 className="font-extrabold text-xs text-slate-200">{check.title}</h6>
                                                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                                                check.status === 'success' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                                                                check.status === 'warning' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                                                                'bg-red-950/40 text-red-400 border border-red-900/30'
                                                            }`}>
                                                                {check.status === 'success' ? 'Vérifié' : check.status === 'warning' ? 'Conseillé' : 'Critique'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-sans">{check.description}</p>
                                                        <p className="text-xs text-slate-300 font-semibold mt-1 font-sans">{check.message}</p>
                                                    </div>

                                                    {/* Fix actions */}
                                                    {check.fixable && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (check.fixType === 'vat_reason') {
                                                                    setNewDocData((prev: any) => ({
                                                                        ...prev,
                                                                        customVatReason: "TVA non applicable, art. 293 B du CGI"
                                                                    }));
                                                                } else if (check.fixType === 'due_date') {
                                                                    const in30Days = new Date();
                                                                    in30Days.setDate(in30Days.getDate() + 30);
                                                                    const dateString = in30Days.toISOString().split('T')[0];
                                                                    setNewDocData((prev: any) => ({
                                                                        ...prev,
                                                                        dueDate: dateString
                                                                    }));
                                                                } else if (check.fixType === 'profile_siret') {
                                                                    alert("Pour corriger votre SIRET d'entreprise de manière permanente, veuillez le configurer dans l'onglet 'Paramètres'.");
                                                                } else if (check.fixType === 'iban') {
                                                                    alert("Pour configurer votre IBAN, rendez-vous dans l'onglet 'Paramètres' de l'application.");
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-violet-950/65 hover:bg-violet-900/80 text-violet-300 hover:text-white rounded-xl text-[10px] font-black transition-all border border-violet-900/40 cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
                                                        >
                                                            ⚡ Correction Rapide
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InvoiceEditor;
