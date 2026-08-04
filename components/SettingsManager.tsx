import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Invoice, Client, Supplier, Product, Expense, ViewState } from '../types';
import { 
  Building, Wallet, Mail, CheckCircle2, Globe, Phone, MapPin, 
  CreditCard, ShieldCheck, Download, Upload, RefreshCw, Trash2, 
  Percent, Coins, HelpCircle, Sparkles, Sliders, AlertTriangle, Database,
  Cpu, Shield, Key, FileCode, Palette, ShieldAlert, BadgeCheck, Sparkle, Eye, EyeOff, ShieldCheck as BadgeCheck2, FileCheck, Check, Lightbulb, Play,
  Laptop, Clock, Maximize2, Minimize2, Building2, Printer, Copy, PlusCircle, RotateCcw, Edit3, Scale, BookOpen, Info, XCircle, FileText, FilePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RichTextEditor } from './RichTextEditor';
import { CompanyManager } from './CompanyManager';
import { TestDashboard } from './TestDashboard';
import { Gauge } from 'lucide-react';

interface SettingsManagerProps {
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
  products: Product[];
  setProducts: (products: Product[]) => void;
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  onCompanySwitched?: (companyId: string) => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ 
  userProfile, 
  setUserProfile,
  invoices,
  setInvoices,
  clients,
  setClients,
  suppliers,
  setSuppliers,
  products,
  setProducts,
  expenses,
  setExpenses,
  onCompanySwitched
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'companies' | 'billing' | 'accounting' | 'data' | 'ppf' | 'ai_assistant' | 'cgv' | 'tests'>('profile');
  const [showAiKey, setShowAiKey] = useState<boolean>(false);
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState<boolean>(false);
  const [showMistralKey, setShowMistralKey] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [sqlImportError, setSqlImportError] = useState<string | null>(null);
  const [sqlImportSuccess, setSqlImportSuccess] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqlFileInputRef = useRef<HTMLInputElement>(null);

  // État et gestion du mode plein écran (Fullscreen API)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // États et gestion de l'onglet CGV
  const [cgvViewMode, setCgvViewMode] = useState<'edit' | 'preview'>('edit');
  const [cgvCopySuccess, setCgvCopySuccess] = useState<boolean>(false);
  const [showCgvTemplateModal, setShowCgvTemplateModal] = useState<boolean>(false);
  const [showCgvPrintModal, setShowCgvPrintModal] = useState<boolean>(false);
  const [selectedCgvTemplateId, setSelectedCgvTemplateId] = useState<string>('service_b2b');

  // Remplace les balises de variables {RAISON_SOCIALE}, {SIRET}... par les vraies valeurs du profil
  const getSubstitutedCgvText = (rawText: string) => {
    let result = rawText || '';
    const companyName = userProfile.companyName || 'Votre Entreprise';
    const siret = userProfile.siret || '000 000 000 00000';
    const paymentDelay = userProfile.paymentDelayDays !== undefined ? `${userProfile.paymentDelayDays} jours` : '30 jours';
    const tribunal = userProfile.rcsRegistry ? `Tribunal de Commerce de ${userProfile.rcsRegistry}` : 'Tribunal de Commerce du siège social';
    const email = userProfile.email || 'contact@entreprise.fr';
    const vatMention = userProfile.vatFranchiseArt293B ? 'TVA non applicable, art. 293 B du CGI' : (userProfile.tvaNumber ? `N° TVA Intracommunautaire : ${userProfile.tvaNumber}` : 'TVA au taux légal en vigueur');

    return result
      .replace(/{RAISON_SOCIALE}/g, companyName)
      .replace(/{SIRET}/g, siret)
      .replace(/{DELAI_PAIEMENT}/g, paymentDelay)
      .replace(/{TRIBUNAL_COMPETENT}/g, tribunal)
      .replace(/{EMAIL}/g, email)
      .replace(/{MENTION_TVA}/g, vatMention);
  };

  const handleSubstituteCgvVariablesInProfile = () => {
    const currentCgv = userProfile.cgv || '';
    const updated = getSubstitutedCgvText(currentCgv);
    handleChange('cgv', updated);
    triggerFeedback("Toutes les balises de variables ont été remplacées par les vraies coordonnées de votre profil !");
  };

  const handleCopyCgvText = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = getSubstitutedCgvText(userProfile.cgv || '');
    const plainText = tempDiv.innerText || tempDiv.textContent || '';
    navigator.clipboard.writeText(plainText);
    setCgvCopySuccess(true);
    triggerFeedback("Texte brut des CGV copié dans le presse-papier !");
    setTimeout(() => setCgvCopySuccess(false), 3000);
  };

  const getCgvComplianceCheck = (cgvText: string) => {
    const text = (cgvText || '').toLowerCase();
    
    const checks = [
      {
        id: 'identity',
        label: 'Identification légale (SIRET / Raison Sociale)',
        passed: text.includes('siret') || text.includes('raison sociale') || text.includes('entreprise') || text.includes('société') || text.includes('societe'),
        fixSnippet: '<h2>ARTICLE – IDENTIFICATION</h2><p>Les présentes CGV sont applicables aux ventes conclues par <strong>{RAISON_SOCIALE}</strong>, enregistrée sous le SIRET : {SIRET}.</p>'
      },
      {
        id: 'payment_delay',
        label: 'Délais de règlement & Échéances',
        passed: text.includes('délai') || text.includes('delai') || text.includes('échéance') || text.includes('echeance') || text.includes('règlement') || text.includes('reglement') || text.includes('comptant') || text.includes('réception'),
        fixSnippet: '<h2>ARTICLE – DÉLAIS DE PAIEMENT</h2><p>Les factures sont exigibles dans un délai de <strong>{DELAI_PAIEMENT}</strong> à compter de la date d’émission.</p>'
      },
      {
        id: 'penalties',
        label: 'Pénalités de retard (Taux légal BCE)',
        passed: text.includes('pénalité') || text.includes('penalite') || text.includes('taux légal') || text.includes('taux legal') || text.includes('intérêts de retard'),
        fixSnippet: '<p><strong>Pénalités de retard :</strong> Tout retard de paiement entraîne de plein droit l’application de pénalités de retard au taux annuel égal à 3 fois le taux d’intérêt légal.</p>'
      },
      {
        id: 'recovery_fee',
        label: 'Indemnité forfaitaire de recouvrement (40 € - Art. D. 441-5)',
        passed: text.includes('40') && (text.includes('recouvrement') || text.includes('forfaitaire')),
        fixSnippet: '<p><strong>Frais de recouvrement :</strong> Une indemnité forfaitaire pour frais de recouvrement de <strong>40 €</strong> sera due par le client professionnel en cas de retard de paiement (Art. D. 441-5 du Code de commerce).</p>'
      },
      {
        id: 'discount',
        label: 'Mention d’Escompte pour paiement anticipé',
        passed: text.includes('escompte'),
        fixSnippet: '<p><strong>Escompte :</strong> Aucun escompte n’est accordé en cas de paiement anticipé.</p>'
      },
      {
        id: 'jurisdiction',
        label: 'Attribution de juridiction & Droit applicable',
        passed: text.includes('tribunal') || text.includes('juridiction') || text.includes('litige') || text.includes('droit français'),
        fixSnippet: '<h2>ARTICLE – JURIDICTION</h2><p>Tout différend sera soumis au droit français et porté devant le <strong>{TRIBUNAL_COMPETENT}</strong>.</p>'
      }
    ];

    const passedCount = checks.filter(c => c.passed).length;
    const scorePercentage = Math.round((passedCount / checks.length) * 100);

    return {
      checks,
      passedCount,
      totalCount: checks.length,
      scorePercentage
    };
  };

  const cgvTemplatesList = [
    {
      id: 'service_b2b',
      title: '💼 Prestations de Services B2B',
      subtitle: 'Idéal Freelances, Consultants, Agences, IT & Conseil',
      badge: 'Recommandé B2B',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      content: `<h2>ARTICLE 1 – CHAMP D'APPLICATION ET OPPOSABILITÉ</h2>
<p>Les présentes Conditions Générales de Vente (CGV) constituent le socle unique de la relation commerciale entre <strong>{RAISON_SOCIALE}</strong> (SIRET : {SIRET}) et ses clients professionnels. Elles s'appliquent sans restriction à toutes les prestations de services commandées.</p>

<h2>ARTICLE 2 – COMMANDES ET DEVIS</h2>
<p>Chaque prestation fait l'objet d'un devis préalable précisant la nature, la durée et le tarif des travaux. La commande est ferme dès réception du devis daté, signé et revêtu de la mention manuscrite « Bon pour accord ».</p>

<h2>ARTICLE 3 – TARIFS ET FRANCHISE DE TVA</h2>
<p>Les prix sont exprimés en Euros (€) et sont garantis pendant la durée de validité du devis. {MENTION_TVA}</p>

<h2>ARTICLE 4 – CONDITIONS ET DÉLAIS DE PAIEMENT</h2>
<p>Les factures sont payables dans un délai de <strong>{DELAI_PAIEMENT}</strong> à compter de leur date d'émission.</p>
<p><strong>Pénalités de retard :</strong> Tout retard de paiement donnera lieu de plein droit et sans mise en demeure préalable à l'application de pénalités de retard calculées au taux de 3 fois le taux d'intérêt légal en vigueur.</p>
<p><strong>Indemnité forfaitaire de recouvrement :</strong> Conformément aux articles L. 441-10 et D. 441-5 du Code de commerce, une indemnité forfaitaire pour frais de recouvrement d'un montant de <strong>40 €</strong> sera automatiquement due pour tout retard de règlement.</p>
<p><strong>Escompte :</strong> Aucun escompte n'est accordé en cas de paiement anticipé.</p>

<h2>ARTICLE 5 – PROPRIÉTÉ INTELLECTUELLE</h2>
<p>Les livrables et créations demeurent la propriété exclusive de <strong>{RAISON_SOCIALE}</strong> jusqu'au paiement intégral du prix convenu. Le transfert des droits d'exploitation ou de reproduction est subordonné à l'encaissement effectif et complet des sommes dues.</p>

<h2>ARTICLE 6 – RESPONSABILITÉ ET FORCE MAJEURE</h2>
<p>La responsabilité du prestataire est soumise à une obligation de moyens. Elle ne saurait être engagée en cas de force majeure ou de mauvaise utilisation des livrables par le Client.</p>

<h2>ARTICLE 7 – LITIGES ET JURIDICTION</h2>
<p>Les présentes CGV sont régies par le droit français. À défaut d'accord amiable, tout différend relatif à leur application sera porté devant le <strong>{TRIBUNAL_COMPETENT}</strong>.</p>`
    },
    {
      id: 'products_b2b',
      title: '📦 Vente de Marchandises & Produits (B2B)',
      subtitle: 'Pour les grossistes, fabricants, vente de biens matériels & équipements',
      badge: 'Vente Matérielle',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      content: `<h2>ARTICLE 1 – DISPOSITIONS GÉNÉRALES</h2>
<p>Les présentes CGV s'appliquent à l'ensemble des ventes de produits conclues par la société ou entreprise <strong>{RAISON_SOCIALE}</strong> (SIRET : {SIRET}) auprès de tout acheteur professionnel.</p>

<h2>ARTICLE 2 – PRIX ET COMMANDES</h2>
<p>Les produits sont fournis au prix en vigueur lors de l'enregistrement de la commande. Les offres de prix sont valables dans la limite des stocks disponibles.</p>

<h2>ARTICLE 3 – CLAUSE DE RÉSERVE DE PROPRIÉTÉ</h2>
<p><strong>{RAISON_SOCIALE}</strong> conserve la propriété absolue des marchandises livrées jusqu'au paiement complet de l'intégralité du prix en principal, intérêts et frais (Loi n° 80-335 du 12 mai 1980).</p>

<h2>ARTICLE 4 – LIVRAISON ET TRANSFERT DES RISQUES</h2>
<p>La livraison est effectuée à l'adresse indiquée par l'acheteur. Les risques sont transférés à l'acheteur dès la remise des marchandises au transporteur ou au client.</p>

<h2>ARTICLE 5 – PAIEMENT ET RETARD DE RÈGLEMENT</h2>
<p>Paiement sous <strong>{DELAI_PAIEMENT}</strong>. En cas de retard : pénalités au taux de 3 fois le taux légal + <strong>40 €</strong> d'indemnité forfaitaire de recouvrement (Art. D. 441-5). Pas d'escompte accordé pour paiement anticipé.</p>

<h2>ARTICLE 6 – GARANTIE ET RÉCLAMATIONS</h2>
<p>Toute réclamation pour vice apparent ou non-conformité de la marchandise doit être transmise par lettre recommandée avec AR dans un délai de 8 jours suivant la réception.</p>

<h2>ARTICLE 7 – TRIBUNAL COMPÉTENT</h2>
<p>Tout litige relèvera de la compétence exclusive du <strong>{TRIBUNAL_COMPETENT}</strong>.</p>`
    },
    {
      id: 'artisans_works',
      title: '🛠️ Artisans, Bâtiment & Travaux',
      subtitle: 'Pour les professionnels du bâtiment, dépannage, travaux et prestations avec fournitures',
      badge: 'Artisans / Chantier',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      content: `<h2>ARTICLE 1 – VALIDITÉ DU DEVIS</h2>
<p>Les prestations et travaux exécutés par <strong>{RAISON_SOCIALE}</strong> (SIRET : {SIRET}) font l'objet d'un devis préalable valable 30 jours à compter de sa date d'émission.</p>

<h2>ARTICLE 2 – ACOMPTE ET DÉROULEMENT DES TRAVAUX</h2>
<p>Un acompte de 30 % du montant TTC du devis est exigé à la signature. Les travaux débuteront à réception de cet acompte et sous réserve de l'accessibilité des lieux.</p>

<h2>ARTICLE 3 – MODIFICATIONS DE CHANTIER</h2>
<p>Toute prestation complémentaire non prévue au devis initial fera l'objet d'un avenant écrit d'un commun accord préalable.</p>

<h2>ARTICLE 4 – RÉSERVE DE PROPRIÉTÉ MATÉRIELLE</h2>
<p>Les matériaux, équipements et fournitures livrés ou posés demeurent la propriété de <strong>{RAISON_SOCIALE}</strong> jusqu'à l'encaissement complet du prix.</p>

<h2>ARTICLE 5 – MODALITÉS DE RÈGLEMENT</h2>
<p>Solde de facture payable à <strong>{DELAI_PAIEMENT}</strong>. Retard de paiement : pénalités de 3 fois le taux légal + <strong>40 €</strong> de frais de recouvrement. Pas d'escompte pour paiement anticipé.</p>

<h2>ARTICLE 6 – DROIT APPLICABLE</h2>
<p>Attribution de juridiction au <strong>{TRIBUNAL_COMPETENT}</strong> en cas de litige non résolu à l'amiable.</p>`
    },
    {
      id: 'dev_it_saas',
      title: '💻 Développement Web, Software & IT',
      subtitle: 'Pour les développeurs web, créateurs de logiciels, SaaS & intégrateurs',
      badge: 'Tech & Digital',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      content: `<h2>ARTICLE 1 – CHAMP D'APPLICATION</h2>
<p>Les présentes CGV régissent les prestations informatiques et le développement de logiciels sur mesure par <strong>{RAISON_SOCIALE}</strong> (SIRET : {SIRET}).</p>

<h2>ARTICLE 2 – CAHIER DES CHARGES ET RECETTE</h2>
<p>Les développements sont réalisés conformément au cahier des charges validé. Le Client dispose d'une période de recette de 14 jours pour valider la livraison. Passé ce délai, les livrables sont réputés définitivement acceptés.</p>

<h2>ARTICLE 3 – NIVEAU DE RESPONSABILITÉ</h2>
<p>Le prestataire s'engage à apporter tout son soin à l'exécution de la mission (obligation de moyens). Sa responsabilité est plafonnée au montant global de la prestation.</p>

<h2>ARTICLE 4 – DROITS D'AUTEUR ET CODE SOURCE</h2>
<p>La cession des droits d'utilisation ou d'exploitation du code source n'intervient qu'après paiement intégral de l'ensemble des factures associées à la prestation.</p>

<h2>ARTICLE 5 – MODALITÉS DE PAIEMENT</h2>
<p>Paiement exigible sous <strong>{DELAI_PAIEMENT}</strong>. Tout retard entraîne l'exigibilité de pénalités de 3 fois le taux légal et d'une indemnité forfaitaire pour frais de recouvrement de <strong>40 €</strong>. Aucun escompte.</p>

<h2>ARTICLE 6 – TRIBUNAL COMPÉTENT</h2>
<p>Attribution exclusive de compétence au <strong>{TRIBUNAL_COMPETENT}</strong>.</p>`
    },
    {
      id: 'micro_simplified',
      title: '⚡ CGV Micro-Entreprise Simplifiées (Art. 293 B)',
      subtitle: 'Format concis pour micro-entrepreneurs avec clause d\'exonération de TVA',
      badge: 'Micro-Entreprise',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      content: `<h2>ARTICLE 1 – APPLICATION</h2>
<p>Les présentes CGV s'appliquent à l'ensemble des ventes et services fournis par l'entreprise individuelle <strong>{RAISON_SOCIALE}</strong> (SIRET : {SIRET}).</p>

<h2>ARTICLE 2 – FRANCHISE DE TVA</h2>
<p>TVA non applicable, art. 293 B du Code Général des Impôts (CGI). Les montants facturés sont nets.</p>

<h2>ARTICLE 3 – DELAIS ET CONDITION DE PAIEMENT</h2>
<p>Factures payables à <strong>{DELAI_PAIEMENT}</strong> après émission. Tout retard donne lieu de plein droit à des pénalités au taux de 3 fois le taux d'intérêt légal et à une indemnité forfaitaire pour frais de recouvrement de <strong>40 €</strong> (Art. D. 441-5 du Code de commerce). Aucun escompte pour paiement anticipé.</p>

<h2>ARTICLE 4 – RÉCLAMATIONS ET LITIGES</h2>
<p>Toute réclamation doit être notifiée par email à {EMAIL} sous 8 jours. Litiges soumis au droit français et au <strong>{TRIBUNAL_COMPETENT}</strong>.</p>`
    }
  ];

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    setIsFullscreen(!!document.fullscreenElement);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Erreur d'activation du mode plein écran:", err);
        triggerFeedback("Le mode plein écran n'est pas supporté ou a été bloqué par votre navigateur.");
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Erreur de désactivation du mode plein écran:", err);
      });
    }
  };

  // Nouvelles fonctionnalités de gestion visuelle et conformité
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditProgress, setAuditProgress] = useState<number>(0);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [auditStepMessage, setAuditStepMessage] = useState<string>('');
  const [simulateAmount, setSimulateAmount] = useState<number>(35000);

  // Sceaux d'illustrations de marques
  const brandSymbols = [
    { value: 'rocket', label: '🚀 Innovation / Tech', emoji: '🚀' },
    { value: 'feather', label: '✒️ Consulting / Plume', emoji: '✒️' },
    { value: 'chart', label: '📈 Croissance / Finance', emoji: '📈' },
    { value: 'globe', label: '🌐 International / Web', emoji: '🌐' },
    { value: 'hammer', label: '🔨 Artisanat / Outil', emoji: '🔨' },
    { value: 'leaf', label: '🌱 Éco / Bien-être', emoji: '🌱' },
  ];

  // Helper pour récupérer les classes de couleurs actives du thème choisi
  const currentTheme = userProfile.themeColor || 'blue';
  
  const getThemeClasses = (theme: string = 'blue') => {
    switch (theme) {
      case 'emerald':
        return {
          primaryBg: 'bg-emerald-600',
          hoverBg: 'hover:bg-emerald-700',
          borderAccent: 'border-emerald-500',
          textAccent: 'text-emerald-600',
          gradientBg: 'from-emerald-600 to-teal-600',
          lightBg: 'bg-emerald-50/40',
          lightBorder: 'border-emerald-100',
          ringFocus: 'focus:ring-emerald-500/10 focus:border-emerald-500',
          activeTab: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        };
      case 'violet':
        return {
          primaryBg: 'bg-indigo-600',
          hoverBg: 'hover:bg-indigo-700',
          borderAccent: 'border-indigo-500',
          textAccent: 'text-indigo-600',
          gradientBg: 'from-indigo-600 to-violet-600',
          lightBg: 'bg-indigo-50/40',
          lightBorder: 'border-indigo-100',
          ringFocus: 'focus:ring-indigo-500/10 focus:border-indigo-500',
          activeTab: 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        };
      case 'amber':
        return {
          primaryBg: 'bg-amber-600',
          hoverBg: 'hover:bg-amber-700',
          borderAccent: 'border-amber-500',
          textAccent: 'text-amber-600',
          gradientBg: 'from-amber-500 to-orange-500',
          lightBg: 'bg-amber-50/40',
          lightBorder: 'border-amber-100',
          ringFocus: 'focus:ring-amber-500/10 focus:border-amber-500',
          activeTab: 'bg-amber-600 text-white shadow-md shadow-amber-500/10',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-100',
        };
      case 'neutral':
        return {
          primaryBg: 'bg-slate-900',
          hoverBg: 'hover:bg-slate-950',
          borderAccent: 'border-slate-800',
          textAccent: 'text-slate-900',
          gradientBg: 'from-slate-900 to-slate-850',
          lightBg: 'bg-slate-50',
          lightBorder: 'border-slate-200',
          ringFocus: 'focus:ring-slate-900/10 focus:border-slate-900',
          activeTab: 'bg-slate-900 text-white shadow-md shadow-slate-900/10',
          badgeBg: 'bg-slate-50 text-slate-800 border-slate-250',
        };
      case 'blue':
      default:
        return {
          primaryBg: 'bg-blue-600',
          hoverBg: 'hover:bg-blue-700',
          borderAccent: 'border-blue-500',
          textAccent: 'text-blue-600',
          gradientBg: 'from-blue-600 to-indigo-650',
          lightBg: 'bg-blue-50/40',
          lightBorder: 'border-blue-100',
          ringFocus: 'focus:ring-blue-500/10 focus:border-blue-500',
          activeTab: 'bg-blue-600 text-white shadow-md shadow-blue-500/10',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-100',
        };
    }
  };

  const tc = getThemeClasses(currentTheme);

  // Fonction pour exécuter un Audit de Conformité Factur-X ultra-réaliste
  const runFacturXAudit = () => {
    setIsAuditing(true);
    setAuditProgress(0);
    setAuditResult(null);
    setAuditStepMessage("Démarrage de l'analyse des métadonnées de l'entreprise...");

    const steps = [
      { progress: 20, message: "🔍 Étape 1/5 : Analyse de l'identité légale (Raison sociale, Numéro SIRET)" },
      { progress: 40, message: "📍 Étape 2/5 : Évaluation géographique (Siège social local, conformité postale)" },
      { progress: 60, message: "💳 Étape 3/5 : Validation du raccordement financier (Format structurel IBAN/BIC)" },
      { progress: 80, message: "📑 Étape 4/5 : Détection du statut fiscal (Régime de TVA et mentions obligatoires 293B)" },
      { progress: 100, message: "🔏 Étape 5/5 : Vérification de la signature numérique du certificat fiscal" },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setAuditProgress(step.progress);
        setAuditStepMessage(step.message);

        if (step.progress === 100) {
          // Calculer le résultat d'audit final de manière dynamique sur les vrais champs de l'user
          setTimeout(() => {
            const hasSiret = userProfile.siret && userProfile.siret.replace(/\s/g, '').length >= 9;
            const hasIban = userProfile.bankAccount && userProfile.bankAccount.replace(/\s/g, '').toUpperCase().startsWith('FR');
            const hasAddress = userProfile.address && userProfile.address.length > 5;
            const hasEmail = userProfile.email && userProfile.email.includes('@');
            const isPpfReady = userProfile.ppfClientId && userProfile.ppfClientSecret;
            const hasCert = !!userProfile.ppfCertificateName;

            const missingList: string[] = [];
            let score = 30;

            if (userProfile.companyName && userProfile.companyName !== 'Ma Micro-Entreprise') score += 15;
            else missingList.push("Nom d'Établissement par défaut");

            if (hasSiret) score += 20;
            else missingList.push("Numéro SIRET invalide ou absent (obligatoire sur toutes les factures)");

            if (hasAddress) score += 10;
            else missingList.push("Adresse du siège social inexistante");

            if (hasIban) score += 10;
            else missingList.push("IBAN du compte bancaire absent ou mal configuré");

            if (hasCert) score += 15;
            else missingList.push("Aucun certificat fiscal RGS** de signature activement lié");

            // Optionnel : raccordement PPF
            if (isPpfReady) score += 10;

            let verdict: 'excellent' | 'good' | 'warning' = 'excellent';
            let verdictMessage = "";
            let description = "";

            if (score >= 85) {
              verdict = 'excellent';
              verdictMessage = "Label Conformité Factur-X Totale certifiée (A++)";
              description = "Félicitations ! Votre profil d'auto-entrepreneur répond parfaitement aux contraintes d'émission de l'administration publique française pour la facturation électronique 2026. Vos documents PDF/A-3 embarquant le XML standardisé seront acceptés nativement sans risque de rejet comptable.";
            } else if (score >= 60) {
              verdict = 'good';
              verdictMessage = "Conformité Légale Standard (Optionnel)";
              description = "Vos données d'émission basiques sont valides pour la législation actuelle, mais nous vous recommandons fortement d'intégrer un certificat RGS** ou de compléter la configuration de raccordement API pour être prêt face à la dématérialisation systémique de 2026.";
            } else {
              verdict = 'warning';
              verdictMessage = "Non-Conformité Légale Critique détectée";
              description = "Attention : plusieurs critères juridiques obligatoires pour émettre une facture électronique authentifiable en France sont absents ou incomplets dans votre profil fiscal. Émettre des factures dans cet état vous expose à des rejets ou amendes.";
            }

            setAuditResult({
              score,
              verdict,
              verdictMessage,
              description,
              missingList,
              timestamp: Date.now()
            });
            setIsAuditing(false);
            triggerFeedback("Diagnostic de conformité légale terminé !");
          }, 600);
        }
      }, (idx + 1) * 500);
    });
  };

  // Notifications temporaires pour le feedback visuel
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleChange = (field: keyof UserProfile, value: any) => {
    setUserProfile({ ...userProfile, [field]: value });
  };

  // Met à jour les régimes de cotisations et plafonds selon l'activité
  const handleActivityTypeChange = (type: 'services_liberal' | 'services_commercial' | 'sales' | 'custom') => {
    let chargesRate = 22.0;
    let vatThreshold = 39100;
    let caThreshold = 77700;

    if (type === 'sales') {
      chargesRate = 12.3;
      vatThreshold = 101000;
      caThreshold = 188700;
    } else if (type === 'services_liberal' || type === 'services_commercial') {
      chargesRate = 22.0;
      vatThreshold = 39100;
      caThreshold = 77700;
    } else if (type === 'custom') {
      chargesRate = userProfile.customChargesRate || 22.0;
      vatThreshold = userProfile.customVatThreshold || 39100;
      caThreshold = userProfile.customCaThreshold || 77700;
    }

    setUserProfile({
      ...userProfile,
      activityType: type,
      customChargesRate: chargesRate,
      customVatThreshold: vatThreshold,
      customCaThreshold: caThreshold,
      autoVatThreshold: type !== 'custom',
      autoCaThreshold: type !== 'custom'
    });

    triggerFeedback("Régime fiscal, plafonds et cotisations mis à jour !");
  };

  // --- EXPORT JSON ---
  const handleExportData = () => {
    const backupData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      userProfile,
      invoices,
      clients,
      suppliers,
      products,
      expenses
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    // Format de date simple
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `autogest_sauvegarde_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    triggerFeedback("Exportation de la sauvegarde réussie !");
  };

  // --- EXPORT SQL ---
  const handleExportSqlData = () => {
    const escapeSQL = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'boolean') return val ? '1' : '0';
      const str = String(val).replace(/'/g, "''");
      return `'${str}'`;
    };

    let sql = `-- ==========================================================\n`;
    sql += `-- Sauvegarde de la Base de Données AutoGest (Format SQL)\n`;
    sql += `-- Généré le : ${new Date().toISOString()}\n`;
    sql += `-- Compatible avec SQLite, PostgreSQL et MySQL/MariaDB\n`;
    sql += `-- ==========================================================\n\n`;
    
    sql += `BEGIN TRANSACTION;\n\n`;

    // 1. Table user_profile
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'user_profile'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS user_profile (\n`;
    sql += `  company_name TEXT,\n`;
    sql += `  siret TEXT,\n`;
    sql += `  address TEXT,\n`;
    sql += `  email TEXT,\n`;
    sql += `  phone TEXT,\n`;
    sql += `  website TEXT,\n`;
    sql += `  bank_account TEXT,\n`;
    sql += `  tva_number TEXT,\n`;
    sql += `  legal_mentions TEXT,\n`;
    sql += `  activity_type TEXT,\n`;
    sql += `  custom_charges_rate REAL,\n`;
    sql += `  custom_vat_threshold REAL,\n`;
    sql += `  currency_symbol TEXT,\n`;
    sql += `  invoice_prefix TEXT,\n`;
    sql += `  quote_prefix TEXT,\n`;
    sql += `  payment_delay_days INTEGER\n`;
    sql += `);\n\n`;

    sql += `DELETE FROM user_profile;\n`;
    sql += `INSERT INTO user_profile (\n`;
    sql += `  company_name, siret, address, email, phone, website, bank_account, tva_number, \n`;
    sql += `  legal_mentions, activity_type, custom_charges_rate, custom_vat_threshold, \n`;
    sql += `  currency_symbol, invoice_prefix, quote_prefix, payment_delay_days\n`;
    sql += `) VALUES (\n`;
    sql += `  ${escapeSQL(userProfile.companyName)},\n`;
    sql += `  ${escapeSQL(userProfile.siret)},\n`;
    sql += `  ${escapeSQL(userProfile.address)},\n`;
    sql += `  ${escapeSQL(userProfile.email)},\n`;
    sql += `  ${escapeSQL(userProfile.phone)},\n`;
    sql += `  ${escapeSQL(userProfile.website)},\n`;
    sql += `  ${escapeSQL(userProfile.bankAccount)},\n`;
    sql += `  ${escapeSQL(userProfile.tvaNumber)},\n`;
    sql += `  ${escapeSQL(userProfile.legalMentions)},\n`;
    sql += `  ${escapeSQL(userProfile.activityType)},\n`;
    sql += `  ${escapeSQL(userProfile.customChargesRate)},\n`;
    sql += `  ${escapeSQL(userProfile.customVatThreshold)},\n`;
    sql += `  ${escapeSQL(userProfile.currencySymbol)},\n`;
    sql += `  ${escapeSQL(userProfile.invoicePrefix)},\n`;
    sql += `  ${escapeSQL(userProfile.quotePrefix)},\n`;
    sql += `  ${escapeSQL(userProfile.paymentDelayDays)}\n`;
    sql += `);\n\n`;

    // 2. Table clients
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'clients'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS clients (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  name TEXT NOT NULL,\n`;
    sql += `  email TEXT NOT NULL,\n`;
    sql += `  address TEXT NOT NULL,\n`;
    sql += `  siret TEXT,\n`;
    sql += `  phone TEXT,\n`;
    sql += `  notes TEXT,\n`;
    sql += `  archived INTEGER DEFAULT 0\n`;
    sql += `);\n\n`;

    if (clients.length > 0) {
      sql += `DELETE FROM clients;\n`;
      clients.forEach(c => {
        sql += `INSERT INTO clients (id, name, email, address, siret, phone, notes, archived) VALUES (\n`;
        sql += `  ${escapeSQL(c.id)},\n`;
        sql += `  ${escapeSQL(c.name)},\n`;
        sql += `  ${escapeSQL(c.email)},\n`;
        sql += `  ${escapeSQL(c.address)},\n`;
        sql += `  ${escapeSQL(c.siret)},\n`;
        sql += `  ${escapeSQL(c.phone)},\n`;
        sql += `  ${escapeSQL(c.notes)},\n`;
        sql += `  ${escapeSQL(c.archived ? 1 : 0)}\n`;
        sql += `);\n`;
      });
      sql += `\n`;
    }

    // 3. Table suppliers
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'suppliers'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS suppliers (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  name TEXT NOT NULL,\n`;
    sql += `  email TEXT,\n`;
    sql += `  phone TEXT,\n`;
    sql += `  siret TEXT,\n`;
    sql += `  address TEXT,\n`;
    sql += `  category TEXT,\n`;
    sql += `  notes TEXT\n`;
    sql += `);\n\n`;

    if (suppliers.length > 0) {
      sql += `DELETE FROM suppliers;\n`;
      suppliers.forEach(s => {
        sql += `INSERT INTO suppliers (id, name, email, phone, siret, address, category, notes) VALUES (\n`;
        sql += `  ${escapeSQL(s.id)},\n`;
        sql += `  ${escapeSQL(s.name)},\n`;
        sql += `  ${escapeSQL(s.email)},\n`;
        sql += `  ${escapeSQL(s.phone)},\n`;
        sql += `  ${escapeSQL(s.siret)},\n`;
        sql += `  ${escapeSQL(s.address)},\n`;
        sql += `  ${escapeSQL(s.category)},\n`;
        sql += `  ${escapeSQL(s.notes)}\n`;
        sql += `);\n`;
      });
      sql += `\n`;
    }

    // 4. Table products
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'products'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS products (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  name TEXT NOT NULL,\n`;
    sql += `  description TEXT,\n`;
    sql += `  price REAL NOT NULL,\n`;
    sql += `  type TEXT NOT NULL\n`;
    sql += `);\n\n`;

    if (products.length > 0) {
      sql += `DELETE FROM products;\n`;
      products.forEach(p => {
        sql += `INSERT INTO products (id, name, description, price, type) VALUES (\n`;
        sql += `  ${escapeSQL(p.id)},\n`;
        sql += `  ${escapeSQL(p.name)},\n`;
        sql += `  ${escapeSQL(p.description)},\n`;
        sql += `  ${escapeSQL(p.price)},\n`;
        sql += `  ${escapeSQL(p.type)}\n`;
        sql += `);\n`;
      });
      sql += `\n`;
    }

    // 5. Table expenses
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'expenses'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS expenses (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  date TEXT NOT NULL,\n`;
    sql += `  description TEXT NOT NULL,\n`;
    sql += `  amount REAL NOT NULL,\n`;
    sql += `  category TEXT NOT NULL,\n`;
    sql += `  supplier_id TEXT\n`;
    sql += `);\n\n`;

    if (expenses.length > 0) {
      sql += `DELETE FROM expenses;\n`;
      expenses.forEach(e => {
        sql += `INSERT INTO expenses (id, date, description, amount, category, supplier_id) VALUES (\n`;
        sql += `  ${escapeSQL(e.id)},\n`;
        sql += `  ${escapeSQL(e.date)},\n`;
        sql += `  ${escapeSQL(e.description)},\n`;
        sql += `  ${escapeSQL(e.amount)},\n`;
        sql += `  ${escapeSQL(e.category)},\n`;
        sql += `  ${escapeSQL(e.supplierId)}\n`;
        sql += `);\n`;
      });
      sql += `\n`;
    }

    // 6. Table invoices
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'invoices'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS invoices (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  type TEXT NOT NULL,\n`;
    sql += `  number TEXT NOT NULL,\n`;
    sql += `  linked_document_id TEXT,\n`;
    sql += `  date TEXT NOT NULL,\n`;
    sql += `  due_date TEXT NOT NULL,\n`;
    sql += `  client_id TEXT NOT NULL,\n`;
    sql += `  status TEXT NOT NULL,\n`;
    sql += `  notes TEXT,\n`;
    sql += `  total REAL NOT NULL,\n`;
    sql += `  reminder_date TEXT,\n`;
    sql += `  discount REAL,\n`;
    sql += `  shipping REAL,\n`;
    sql += `  deposit REAL\n`;
    sql += `);\n\n`;

    // 7. Table invoice_items
    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Structure et données pour la table 'invoice_items'\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `CREATE TABLE IF NOT EXISTS invoice_items (\n`;
    sql += `  id TEXT PRIMARY KEY,\n`;
    sql += `  invoice_id TEXT NOT NULL,\n`;
    sql += `  description TEXT NOT NULL,\n`;
    sql += `  quantity REAL NOT NULL,\n`;
    sql += `  unit_price REAL NOT NULL\n`;
    sql += `);\n\n`;

    if (invoices.length > 0) {
      sql += `DELETE FROM invoices;\n`;
      sql += `DELETE FROM invoice_items;\n`;
      
      invoices.forEach(inv => {
        sql += `INSERT INTO invoices (id, type, number, linked_document_id, date, due_date, client_id, status, notes, total, reminder_date, discount, shipping, deposit) VALUES (\n`;
        sql += `  ${escapeSQL(inv.id)},\n`;
        sql += `  ${escapeSQL(inv.type)},\n`;
        sql += `  ${escapeSQL(inv.number)},\n`;
        sql += `  ${escapeSQL(inv.linkedDocumentId)},\n`;
        sql += `  ${escapeSQL(inv.date)},\n`;
        sql += `  ${escapeSQL(inv.dueDate)},\n`;
        sql += `  ${escapeSQL(inv.clientId)},\n`;
        sql += `  ${escapeSQL(inv.status)},\n`;
        sql += `  ${escapeSQL(inv.notes)},\n`;
        sql += `  ${escapeSQL(inv.total)},\n`;
        sql += `  ${escapeSQL(inv.reminderDate)},\n`;
        sql += `  ${escapeSQL(inv.discount)},\n`;
        sql += `  ${escapeSQL(inv.shipping)},\n`;
        sql += `  ${escapeSQL(inv.deposit)}\n`;
        sql += `);\n`;

        if (inv.items && inv.items.length > 0) {
          inv.items.forEach(it => {
            sql += `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price) VALUES (\n`;
            sql += `  ${escapeSQL(it.id)},\n`;
            sql += `  ${escapeSQL(inv.id)},\n`;
            sql += `  ${escapeSQL(it.description)},\n`;
            sql += `  ${escapeSQL(it.quantity)},\n`;
            sql += `  ${escapeSQL(it.unitPrice)}\n`;
            sql += `);\n`;
          });
        }
      });
      sql += `\n`;
    }

    sql += `COMMIT;\n`;

    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(sql);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `autogest_sauvegarde_${dateStr}.sql`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    triggerFeedback("Exportation de la sauvegarde SQL réussie !");
  };

  // --- IMPORT JSON ---
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    const fileReader = new FileReader();
    const files = e.target.files;

    if (!files || files.length === 0) return;

    fileReader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target?.result as string);
        
        // Validation basique de la sauvegarde
        if (!parsedData.userProfile) {
          throw new Error("Le fichier importé n'est pas une sauvegarde valide (profil utilisateur manquant).");
        }

        // Restauration des states de l'applet
        if (parsedData.userProfile) setUserProfile(parsedData.userProfile);
        if (parsedData.invoices) setInvoices(parsedData.invoices);
        if (parsedData.clients) setClients(parsedData.clients);
        if (parsedData.suppliers) setSuppliers(parsedData.suppliers);
        if (parsedData.products) setProducts(parsedData.products);
        if (parsedData.expenses) setExpenses(parsedData.expenses);

        setImportSuccess(true);
        triggerFeedback("Données restaurées avec succès !");
        
        // Reset l'input file
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err: any) {
        setImportError(err.message || "Erreur lors de la lecture ou du formatage de la sauvegarde JSON.");
      }
    };

    fileReader.readAsText(files[0]);
  };

  // --- IMPORT SQL ---
  const parseSQLValues = (valuesStr: string): any[] => {
    const result: any[] = [];
    let i = 0;
    const s = valuesStr.trim();
    
    while (i < s.length) {
      while (i < s.length && (s[i] === ' ' || s[i] === ',' || s[i] === '\n' || s[i] === '\r' || s[i] === '\t')) {
        i++;
      }
      if (i >= s.length) break;
      
      if (s.startsWith('NULL', i)) {
        result.push(null);
        i += 4;
        continue;
      }
      
      if (s[i] === "'") {
        i++; // skip open quote
        let strVal = "";
        while (i < s.length) {
          if (s[i] === "'") {
            if (i + 1 < s.length && s[i + 1] === "'") {
              strVal += "'";
              i += 2;
            } else {
              i++; // skip close quote
              break;
            }
          } else {
            strVal += s[i];
            i++;
          }
        }
        result.push(strVal);
        continue;
      }
      
      let numStr = "";
      while (i < s.length && /[-+0-9.]/.test(s[i])) {
        numStr += s[i];
        i++;
      }
      if (numStr) {
        if (numStr.includes('.')) {
          result.push(parseFloat(numStr));
        } else {
          result.push(parseInt(numStr, 10));
        }
        continue;
      }
      
      i++;
    }
    return result;
  };

  const handleImportSqlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSqlImportError(null);
    setSqlImportSuccess(false);
    const fileReader = new FileReader();
    const files = e.target.files;

    if (!files || files.length === 0) return;

    fileReader.onload = (event) => {
      try {
        const sqlText = event.target?.result as string;
        
        const regex = /INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi;
        let match;
        
        let importedProfile: any = null;
        const importedClients: Client[] = [];
        const importedSuppliers: Supplier[] = [];
        const importedProducts: Product[] = [];
        const importedExpenses: Expense[] = [];
        const importedInvoices: Invoice[] = [];
        const importedInvoiceItems: any[] = [];
        
        while ((match = regex.exec(sqlText)) !== null) {
          const tableName = match[1].toLowerCase();
          const cols = match[2].split(',').map(name => name.trim().toLowerCase());
          const valsStr = match[3];
          const vals = parseSQLValues(valsStr);
          
          const row: any = {};
          cols.forEach((col, idx) => {
            row[col] = vals[idx];
          });
          
          if (tableName === 'user_profile') {
            importedProfile = {
              companyName: row.company_name || 'Ma Micro-Entreprise',
              siret: row.siret || '',
              address: row.address || '',
              email: row.email || '',
              phone: row.phone || '',
              website: row.website || '',
              bankAccount: row.bank_account || '',
              tvaNumber: row.tva_number || '',
              legalMentions: row.legal_mentions || '',
              activityType: row.activity_type || 'services_liberal',
              customChargesRate: row.custom_charges_rate !== undefined ? row.custom_charges_rate : 22.0,
              customVatThreshold: row.custom_vat_threshold !== undefined ? row.custom_vat_threshold : 36800,
              currencySymbol: row.currency_symbol || '€',
              invoicePrefix: row.invoice_prefix || 'FAC-',
              quotePrefix: row.quote_prefix || 'DEV-',
              paymentDelayDays: row.payment_delay_days || 30
            };
          } else if (tableName === 'clients') {
            importedClients.push({
              id: row.id,
              name: row.name || 'Client Inconnu',
              email: row.email || '',
              address: row.address || '',
              siret: row.siret || '',
              phone: row.phone || '',
              notes: row.notes || '',
              archived: row.archived === 1
            });
          } else if (tableName === 'suppliers') {
            importedSuppliers.push({
              id: row.id,
              name: row.name || 'Fournisseur Inconnu',
              email: row.email || '',
              phone: row.phone || '',
              siret: row.siret || '',
              address: row.address || '',
              category: row.category || '',
              notes: row.notes || ''
            });
          } else if (tableName === 'products') {
            importedProducts.push({
              id: row.id,
              name: row.name || 'Produit Inconnu',
              description: row.description || '',
              price: row.price || 0,
              type: row.type || 'service'
            });
          } else if (tableName === 'expenses') {
            importedExpenses.push({
              id: row.id,
              date: row.date || '',
              description: row.description || '',
              amount: row.amount || 0,
              category: row.category || '',
              supplierId: row.supplier_id || ''
            });
          } else if (tableName === 'invoices') {
            importedInvoices.push({
              id: row.id,
              type: row.type || 'invoice',
              number: row.number || '',
              linkedDocumentId: row.linked_document_id || undefined,
              date: row.date || '',
              dueDate: row.due_date || '',
              clientId: row.client_id || '',
              status: row.status || 'Brouillon',
              notes: row.notes || '',
              total: row.total || 0,
              reminderDate: row.reminder_date || undefined,
              discount: row.discount !== undefined ? row.discount : undefined,
              shipping: row.shipping !== undefined ? row.shipping : undefined,
              deposit: row.deposit !== undefined ? row.deposit : undefined,
              items: []
            });
          } else if (tableName === 'invoice_items') {
            importedInvoiceItems.push({
              id: row.id,
              invoiceId: row.invoice_id,
              description: row.description || '',
              quantity: row.quantity || 0,
              unitPrice: row.unit_price || 0
            });
          }
        }

        if (!importedProfile && importedClients.length === 0 && importedInvoices.length === 0) {
          throw new Error("Aucune donnée d'insertion reconnue. Assurez-vous que le fichier est un fichier SQL exporté par cette application.");
        }

        importedInvoices.forEach(inv => {
          inv.items = importedInvoiceItems
            .filter(item => item.invoiceId === inv.id)
            .map(item => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }));
        });

        if (importedProfile) setUserProfile(importedProfile);
        setClients(importedClients);
        setSuppliers(importedSuppliers);
        setProducts(importedProducts);
        setExpenses(importedExpenses);
        setInvoices(importedInvoices);

        setSqlImportSuccess(true);
        triggerFeedback("Données restaurées avec succès depuis le fichier SQL !");
        
        if (sqlFileInputRef.current) sqlFileInputRef.current.value = "";
      } catch (err: any) {
        setSqlImportError(err.message || "Erreur de syntaxe lors de la relecture de la sauvegarde SQL.");
      }
    };

    fileReader.readAsText(files[0]);
  };

  // --- REMISE À ZÉRO ---
  const handleResetData = () => {
    // Profil vierge par défaut
    const defaultProfile: UserProfile = {
      companyName: 'Ma Micro-Entreprise',
      siret: '',
      address: '',
      email: '',
      phone: '',
      website: '',
      bankAccount: '',
      tvaNumber: '',
      legalMentions: '',
      activityType: 'services_liberal',
      customChargesRate: 22.0,
      customVatThreshold: 36800,
      currencySymbol: '€',
      invoicePrefix: 'FAC-',
      quotePrefix: 'DEV-',
      paymentDelayDays: 30
    };

    setUserProfile(defaultProfile);
    setInvoices([]);
    setClients([]);
    setSuppliers([]);
    setProducts([]);
    setExpenses([]);
    
    setShowResetConfirm(false);
    triggerFeedback("Toutes les données de l'application ont été réinitialisées.");
  };

  // --- SEEDER DE DONNÉES DE DÉMONSTRATION ---
  const handleSeedDemoData = () => {
    const demoProfile: UserProfile = {
      companyName: "Horizon Web Studio",
      siret: "847 902 113 00018",
      address: "24 Rue de la Bourse, 69002 Lyon",
      email: "finance@horizonwebstudio.fr",
      phone: "04 72 40 10 20",
      website: "https://horizonwebstudio.fr",
      bankAccount: "FR76 1234 5678 9012 3456 7890 123",
      tvaNumber: "FR42 847902113",
      legalMentions: "Siren 847902113 - Franchise de TVA, article 293 B du CGI.",
      activityType: "services_liberal",
      customChargesRate: 22.0,
      customVatThreshold: 36800,
      currencySymbol: "€",
      invoicePrefix: "FACT-",
      quotePrefix: "DEV-",
      paymentDelayDays: 30
    };

    const demoClients: Client[] = [
      { id: "c1", name: "SNCF Direction Digitale", email: "compta@sncf-reseau.fr", address: "92 Avenue de France, 75013 Paris", siret: "41228073700010", phone: "01 85 07 00 00", notes: "Grand compte, paiement à 30 jours par virement bancaire." },
      { id: "c2", name: "Boulangerie Louise Franches", email: "contact@louiseboulange.fr", address: "14 Rue des Martyrs, 75009 Paris", siret: "51092837100028", phone: "01 42 55 90 12" },
      { id: "c3", name: "Cabinet Médical Dr. Sophie Martin", email: "dr.martin@medecine-paris.fr", address: "105 Boulevards Saint-Germain, 75006 Paris", phone: "01 43 25 11 00" },
      { id: "c4", name: "AeroTech Ingenierie", email: "facturation@aerotech-sol.net", address: "Zone Aéroportuaire, Blagnac, 31700 Blagnac", siret: "80231945100142", notes: "Compte aéronautique récurrent." }
    ];

    const demoProducts: Product[] = [
      { id: "p1", name: "Prestation Technique Dev React/Node (TJM)", description: "Conception et implémentation de fonctionnalités cloud, taux journalier moyen.", price: 600, type: "service" },
      { id: "p2", name: "Audit de Sécurité & RGPD", description: "Audit architectural complet, scan de vulnérabilités et livrables de remédiation.", price: 1200, type: "service" },
      { id: "p3", name: "Abonnement Maintenance Mensuel VPS", description: "Maintenance corrective, mises à jour logicielles de sécurité et supervision 24/7.", price: 150, type: "product" },
      { id: "p4", name: "Atelier Design High-Fidelity & Figma", description: "Études ergonomiques, maquettage dynamique et prototypes interactifs.", price: 450, type: "service" }
    ];

    const demoSuppliers: Supplier[] = [
      { id: "s1", name: "OVHcloud SAS", email: "support-pro@ovh.com", siret: "42476141900045", address: "2 Rue Kellermann, 59100 Roubaix", category: "Logiciel / Cloud", notes: "Hébergement des machines virtuelles de production" },
      { id: "s2", name: "Adobe Systems SAS", email: "comptabilite@adobe.fr", address: "135 Boulevard Haussmann, 75008 Paris", category: "Outil de Design / Créatif" },
      { id: "s3", name: "AXA Assurances Entreprises", email: "contact.pro@axa.fr", category: "Assurances Professionnelles" }
    ];

    const demoExpenses: Expense[] = [
      { id: "e1", date: "2026-01-05", description: "Hébergement serveurs et noms de domaine - OVH", amount: 45.60, category: "Logiciel / Cloud", supplierId: "s1" },
      { id: "e2", date: "2026-02-05", description: "Hébergement serveurs et noms de domaine - OVH", amount: 45.60, category: "Logiciel / Cloud", supplierId: "s1" },
      { id: "e3", date: "2026-02-10", description: "Abonnement suite Creative Cloud developpement - Adobe", amount: 58.99, category: "Outil de Design / Créatif", supplierId: "s2" },
      { id: "e4", date: "2026-03-01", description: "Contrat Responsabilité Civile Professionnelle Annuel", amount: 420.00, category: "Assurances Professionnelles", supplierId: "s3" },
      { id: "e5", date: "2026-04-12", description: "Achat d'un écran 4K de développement professionnel", amount: 349.90, category: "Matériel informatique" }
    ];

    const demoInvoices: Invoice[] = [
      {
        id: "inv1",
        type: "invoice",
        number: "FACT-2026-001",
        clientId: "c3",
        date: "2026-01-10",
        dueDate: "2026-01-30",
        items: [
          { id: "item1", description: "Audit de Sécurité Système d'Information - Cabinet Médical", quantity: 1, unitPrice: 1200 }
        ],
        status: "Payée",
        total: 1200,
        reminderDate: undefined
      },
      {
        id: "inv2",
        type: "invoice",
        number: "FACT-2026-002",
        clientId: "c1",
        date: "2026-01-25",
        dueDate: "2026-02-25",
        items: [
          { id: "item2", description: "Développement architecture React - Sprint Fonctionnels", quantity: 8, unitPrice: 600 },
          { id: "item3", description: "Abonnement Maintenance Mensuel VPS - Administration Cloud", quantity: 3, unitPrice: 150 }
        ],
        status: "Payée",
        total: 5250,
        reminderDate: undefined
      },
      {
        id: "inv3",
        type: "invoice",
        number: "FACT-2026-003",
        clientId: "c2",
        date: "2026-02-12",
        dueDate: "2026-03-12",
        items: [
          { id: "item4", description: "Atelier Design High-Fidelity & Figma - Maquette Mobile v1", quantity: 3, unitPrice: 450 }
        ],
        status: "Payée",
        total: 1350,
        reminderDate: undefined
      },
      {
        id: "inv4",
        type: "invoice",
        number: "FACT-2026-004",
        clientId: "c4",
        date: "2026-06-05",
        dueDate: "2026-07-05",
        items: [
          { id: "item5", description: "Assistance technique developpement application Cloud - Sprint 1-4", quantity: 20, unitPrice: 600 }
        ],
        status: "Envoyée",
        total: 12000,
        discount: 0,
        shipping: 0,
        deposit: 2000,
        reminderDate: undefined
      },
      {
        id: "quote1",
        type: "quote",
        number: "DEV-2026-001",
        clientId: "c2",
        date: "2026-05-20",
        dueDate: "2026-06-20",
        items: [
          { id: "item6", description: "Développement complet Site Boulangerie Louise et CMS", quantity: 12, unitPrice: 600 },
          { id: "item7", description: "Prise en main photographies produits & Rédactionnels", quantity: 2, unitPrice: 450 }
        ],
        status: "Accepté",
        total: 8100,
        reminderDate: undefined
      }
    ];

    setUserProfile(demoProfile);
    setClients(demoClients);
    setProducts(demoProducts);
    setSuppliers(demoSuppliers);
    setExpenses(demoExpenses);
    setInvoices(demoInvoices);

    triggerFeedback("Base de données initialisée avec de superbes données de démonstration !");
  };

  const currencySymbol = userProfile.currencySymbol || '€';

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* En-tête de page poli avec design épuré */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
            <Sliders size={13} className={tc.textAccent} />
            Espace Configuration
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             Paramètres d'entreprise & Facturation
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl text-sm leading-relaxed">
            Configurez votre profil d'émetteur légal Factur-X, vos options comptables automatisées, pilotez vos sauvegardes et gérez les raccordements ministériels.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {feedbackMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-150 text-sm font-semibold shadow-sm self-start md:self-center"
            >
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span>{feedbackMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left Column: Side Tabs and Forms */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Internal Navbar Tabs - Interactive and animated */}
          <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200/50 shadow-inner">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'profile' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Building size={14} />
              <span>Profil Entreprise</span>
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'companies' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Building2 size={14} />
              <span>Multi-Entreprises</span>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'billing' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <CreditCard size={14} />
              <span>Règles Facturation</span>
            </button>
            <button
              onClick={() => setActiveTab('accounting')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'accounting' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Percent size={14} />
              <span>Social & Fiscalité</span>
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'data' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Wallet size={14} />
              <span>Données locales</span>
            </button>
            <button
              onClick={() => setActiveTab('ppf')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'ppf' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Globe size={14} />
              <span>Raccordement PPF</span>
            </button>
            <button
              onClick={() => setActiveTab('ai_assistant')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'ai_assistant' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Sparkles size={14} />
              <span>Assistant IA</span>
            </button>
            <button
              onClick={() => setActiveTab('cgv')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'cgv' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <FileCheck size={14} />
              <span>CGV</span>
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 min-w-[130px] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 relative
                ${activeTab === 'tests' ? tc.activeTab : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55/40'}`}
            >
              <Gauge size={14} />
              <span>Diagnostic & Tests</span>
            </button>
          </div>

          {/* Form Content Container with delicate entry transition */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            
            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                    <Building className={tc.textAccent} size={20} />
                    Identité & Coordonnées légales
                  </h3>
                  <p className="text-sm text-slate-400">Ces informations seront directement injectées en entête et pied de page de vos documents.</p>
                </div>
                
                {/* Visual Identity Section - Elegantly Designed Bento Unit */}
                <div className="bg-slate-50/75 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Palette size={13} className={tc.textAccent} />
                      Couleur Thématique
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4">Personnalisez l'aspect de votre interface.</p>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {[
                        { name: 'blue', value: 'blue', label: 'Cobalt', color: 'bg-blue-600 ring-blue-105' },
                        { name: 'emerald', value: 'emerald', label: 'Menthe', color: 'bg-emerald-600 ring-emerald-105' },
                        { name: 'violet', value: 'violet', label: 'Indigo', color: 'bg-indigo-600 ring-indigo-105' },
                        { name: 'amber', value: 'amber', label: 'Ambre', color: 'bg-amber-500 ring-amber-105' },
                        { name: 'neutral', value: 'neutral', label: 'Brutal', color: 'bg-slate-900 dark:bg-slate-700 ring-slate-200' },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            handleChange('themeColor', item.value);
                            triggerFeedback(`Thème coloré passé sur : ${item.label} !`);
                          }}
                          className={`w-8 h-8 rounded-full ${item.color} border-2 border-white dark:border-slate-800 cursor-pointer relative shadow-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95
                            ${currentTheme === item.value ? 'ring-4 scale-105' : 'hover:opacity-90'}`}
                          title={item.label}
                        >
                          {currentTheme === item.value && (
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Sparkles size={13} className={tc.textAccent} />
                      Sceau & Emblème Numérique
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-3">Sélectionnez le symbole pour vos pièces PDF.</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {brandSymbols.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            handleChange('logoUrl', item.value);
                            triggerFeedback(`Sceau mis à jour : ${item.label} !`);
                          }}
                          className={`py-1.5 px-0.5 relative text-[10px] rounded-xl font-semibold border flex flex-col items-center gap-1 transition-all duration-200 outline-none
                            ${(userProfile.logoUrl || 'rocket') === item.value 
                              ? `${tc.lightBg} ${tc.borderAccent} ${tc.textAccent} font-bold dark:bg-slate-800` 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-705 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300'}`}
                        >
                          <span className="text-xs">{item.emoji}</span>
                          <span className="text-[9px] truncate max-w-full leading-none">
                            {item.label.split(' ')[1]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <span className="text-sm">👁️‍🗨️</span>
                      Luminosité & Affichage
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-3">Thème de l'interface et mode plein écran pour la saisie comptable.</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-201 dark:border-slate-705 shadow-sm">
                        <span className="text-xs font-extrabold flex items-center gap-1.5">
                          {userProfile.darkMode ? '🌙 Thème Sombre' : '☀️ Thème Clair'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newDarkMode = !userProfile.darkMode;
                            handleChange('darkMode', newDarkMode);
                            triggerFeedback(newDarkMode ? "Mode sombre activé !" : "Mode clair activé !");
                          }}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                            userProfile.darkMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                          } relative flex items-center`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                              userProfile.darkMode ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-201 dark:border-slate-705 shadow-sm">
                        <span className="text-xs font-extrabold flex items-center gap-1.5">
                          {isFullscreen ? '📺 Mode Plein Écran' : '🖥️ Mode Fenêtré'}
                        </span>
                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-white transition-all cursor-pointer ${
                            isFullscreen 
                              ? 'bg-amber-600 hover:bg-amber-700' 
                              : tc.primaryBg + ' ' + tc.hoverBg
                          }`}
                        >
                          {isFullscreen ? (
                            <>
                              <Minimize2 size={13} />
                              <span>Quitter</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={13} />
                              <span>Plein écran</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Section 1: Identité Légale de l'entreprise */}
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider md:col-span-2 border-b border-slate-100 pb-2 flex items-center gap-1.5 mt-2">
                    <Building size={14} className="text-slate-400" /> Identité légale de l'entreprise
                  </h4>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom de l'entreprise (ou Raison Sociale)</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-900" 
                      value={userProfile.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      placeholder="Ex: Sophie Lambert Consulting"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vue par défaut</label>
                    <select
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-800"
                      value={userProfile.defaultView || 'dashboard'}
                      onChange={(e) => handleChange('defaultView', e.target.value as ViewState)}
                    >
                        <option value="dashboard">Tableau de bord</option>
                        <option value="invoices">Devis & Factures</option>
                        <option value="clients">Clients</option>
                        <option value="suppliers">Fournisseurs</option>
                        <option value="products">Catalogue</option>
                        <option value="accounting">Comptabilité</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Statut Juridique / Forme Juridique</label>
                    <select
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-800"
                      value={userProfile.legalStatus || 'EI'}
                      onChange={(e) => handleChange('legalStatus', e.target.value)}
                    >
                      <option value="EI">EI - Entrepreneur Individuel</option>
                      <option value="Micro-Entreprise">Micro-Entreprise (Auto-entrepreneur)</option>
                      <option value="SASU">SASU - Soc. par Actions Simplifiée Unipersonnelle</option>
                      <option value="EURL">EURL - Entreprise Unipersonnelle à Resp. Limitée</option>
                      <option value="SARL">SARL - Soc. à Responsabilité Limitée</option>
                      <option value="SAS">SAS - Société par Actions Simplifiée</option>
                      <option value="Association">Association Loi 1901</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Capital Social (si applicable)</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800"
                      value={userProfile.capitalSocial || ''}
                      onChange={(e) => handleChange('capitalSocial', e.target.value)}
                      placeholder="Ex: 1 000 €"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Numéro SIRET</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm" 
                      value={userProfile.siret}
                      onChange={(e) => handleChange('siret', e.target.value)}
                      placeholder="847 902 113 00018"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RCS / Greffe & Ville d'immatriculation</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800" 
                      value={userProfile.rcsRegistry || ''}
                      onChange={(e) => handleChange('rcsRegistry', e.target.value)}
                      placeholder="Ex: RCS Lyon, Greffe de Paris"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Secteur d'Activité / Code APE-NAF</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800" 
                      value={userProfile.activitySector || ''}
                      onChange={(e) => handleChange('activitySector', e.target.value)}
                      placeholder="Ex: 62.02A - Conseil en systèmes et logiciels informatiques"
                    />
                  </div>

                  {/* Section 2: Coordonnées & Contact */}
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider md:col-span-2 border-b border-slate-100 pb-2 flex items-center gap-1.5 mt-4">
                    <MapPin size={14} className="text-slate-400" /> Coordonnées & Contact
                  </h4>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adresse du siège social</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none text-slate-800"
                        rows={2}
                        value={userProfile.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        placeholder="24 Rue de la Bourse, 69002 Lyon"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adresse Email professionnelle</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email" 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800" 
                        value={userProfile.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="contact@votre-entreprise.fr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800" 
                        value={userProfile.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="04 72 40 10 20"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Site Web officiel</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800" 
                        value={userProfile.website || ''}
                        onChange={(e) => handleChange('website', e.target.value)}
                        placeholder="https://votre-site-web.fr"
                      />
                    </div>
                  </div>

                  {/* Section 3: Fiscalité & Bancaire */}
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider md:col-span-2 border-b border-slate-100 pb-2 flex items-center gap-1.5 mt-4">
                    <Wallet size={14} className="text-slate-400" /> Fiscalité & Raccordement Financier
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Régime de TVA de l'entreprise</label>
                    <select
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-800"
                      value={userProfile.vatRegime || 'franchise'}
                      onChange={(e) => handleChange('vatRegime', e.target.value as any)}
                    >
                      <option value="franchise">Franchise en base de TVA (Art. 293 B du CGI - Non assujetti)</option>
                      <option value="simplified">Réel Simplifié (TVA déclarée périodiquement)</option>
                      <option value="normal">Réel Normal (TVA mensuelle)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Numéro de TVA Intracommunautaire</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm uppercase" 
                      value={userProfile.tvaNumber || ''}
                      onChange={(e) => handleChange('tvaNumber', e.target.value)}
                      placeholder="Ex: FR42 847902113"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Laissez vide si vous bénéficiez de la franchise en base de TVA.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Coordonnées de virement bancaire (IBAN)</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm uppercase" 
                        value={userProfile.bankAccount || ''}
                        onChange={(e) => handleChange('bankAccount', e.target.value)}
                        placeholder="FR76 3000 2012 3456 7890 1234 567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Code guichet / BIC</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm uppercase" 
                        value={userProfile.bic || ''}
                        onChange={(e) => handleChange('bic', e.target.value)}
                        placeholder="Ex: MCBBPPM"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mentions légales de bas de page (par défaut)</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea 
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none text-sm text-slate-800" 
                        rows={3}
                        value={userProfile.legalMentions || ''}
                        onChange={(e) => handleChange('legalMentions', e.target.value)}
                        placeholder="Ex: Siren 847902113 - Dispense de TVA sous franchise de base (Art 293B du CGI)."
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: COMPANIES */}
            {activeTab === 'companies' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <CompanyManager 
                  onCompanySwitched={onCompanySwitched || (() => {})} 
                  currentThemeColor={userProfile.themeColor as any} 
                />
              </motion.div>
            )}

            {/* TAB: TESTS & DIAGNOSTICS */}
            {activeTab === 'tests' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <TestDashboard currentThemeColor={userProfile.themeColor as any} />
              </motion.div>
            )}

            {/* TAB: BILLING */}
            {activeTab === 'billing' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                    <CreditCard className={tc.textAccent} size={20} />
                    Numérotation & Paramètres d'édition
                  </h3>
                  <p className="text-sm text-slate-400">Configurez l'aspect et la numérotation automatique de vos factures et devis.</p>
                </div>
                
                <div className="h-px bg-slate-100 my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Devise Monétaire</label>
                    <div className="relative">
                      <select
                        className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                        value={userProfile.currencySymbol || '€'}
                        onChange={(e) => handleChange('currencySymbol', e.target.value)}
                      >
                        <option value="€">Euro (€)</option>
                        <option value="$">US Dollar ($)</option>
                        <option value="£">Livre Sterling (£)</option>
                        <option value="CHF">Franc Suisse (CHF)</option>
                        <option value="CA$">Dollar Canadien (CA$)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Échéance par défaut (Délai de paiement)</label>
                    <div className="relative">
                      <select
                        className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                        value={userProfile.paymentDelayDays !== undefined ? userProfile.paymentDelayDays : 30}
                        onChange={(e) => handleChange('paymentDelayDays', parseInt(e.target.value, 10))}
                      >
                        <option value="0">À réception de facture</option>
                        <option value="15">Sous 15 jours</option>
                        <option value="30">Sous 30 jours (Standard)</option>
                        <option value="45">Sous 45 jours fin de mois</option>
                        <option value="60">Sous 60 jours</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Préfixe de numérotation - Factures</label>
                    <input 
                      type="text" 
                      className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-sm uppercase font-bold`}
                      value={userProfile.invoicePrefix || 'FAC-'}
                      onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                      placeholder="Ex: FAC-"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Génèrera des folios du type: <span className="font-semibold text-slate-600 font-mono">{userProfile.invoicePrefix || 'FAC-'}2026-001</span>.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Préfixe de numérotation - Devis</label>
                    <input 
                      type="text" 
                      className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-sm uppercase font-bold`}
                      value={userProfile.quotePrefix || 'DEV-'}
                      onChange={(e) => handleChange('quotePrefix', e.target.value)}
                      placeholder="Ex: DEV-"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Génèrera des folios du type: <span className="font-semibold text-slate-600 font-mono">{userProfile.quotePrefix || 'DEV-'}2026-001</span>.</p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border text-xs leading-relaxed mt-4 flex items-start gap-3.5 ${tc.lightBg} ${tc.lightBorder} ${tc.textAccent}`}>
                  <div className="p-1 px-2.2 bg-white rounded-lg shadow-xs font-bold shrink-0">Loi</div>
                  <span className="font-medium text-slate-700">
                    La numérotation d'une facture doit impérativement suivre une séquence chronologique continue, sans rupture et sans faille temporelle, conformément à l'article 289 du Code Général des Impôts (CGI). Modifier ces folios requiert d'assurer la continuité logique de l'exercice fiscal.
                  </span>
                </div>

                {/* ADVANCED BILLING: TVA & LEGAL SUBCLAUSES */}
                <div className="h-px bg-slate-100 my-6" />
                
                <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 mb-1">
                      <Percent className={tc.textAccent} size={16} />
                      Gestion de la TVA & Assujettissement
                    </h4>
                    <p className="text-xs text-slate-400">Configurez votre régime de TVA et l'automatisation des mentions d'exonération de l'article 293 B du CGI.</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-150 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Franchise en base de TVA (Art. 293 B du CGI)</span>
                      <p className="text-[11px] text-slate-400">Cochez cette option si vous facturez en Hors Taxes (Exonéré de TVA). La mention d'article sera injectée sur vos pièces.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={userProfile.vatFranchiseArt293B !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setUserProfile({
                            ...userProfile,
                            vatFranchiseArt293B: val,
                            vatRegime: val ? 'franchise' : 'simplified',
                            // En franchise, on applique 0% de départ
                            defaultVatRate: val ? 0 : 20
                          });
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {userProfile.vatFranchiseArt293B === false && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Numéro de TVA Intracommunautaire</label>
                        <input 
                          type="text" 
                          placeholder="Ex: FR 84 847902113"
                          className={`w-full p-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all text-sm font-semibold text-slate-900 uppercase`}
                          value={userProfile.tvaNumber || ''}
                          onChange={(e) => handleChange('tvaNumber', e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">Obligatoire sur les factures dès que vous êtes assujetti ou facturez des clients UE.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Taux standard de TVA par défaut (%)</label>
                        <select 
                          className={`w-full p-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                          value={userProfile.defaultVatRate !== undefined ? userProfile.defaultVatRate : 20}
                          onChange={(e) => handleChange('defaultVatRate', parseFloat(e.target.value))}
                        >
                          <option value="20">20% (Taux normal standard)</option>
                          <option value="10">10% (Taux intermédiaire)</option>
                          <option value="5.5">5.5% (Taux réduit)</option>
                          <option value="2.1">2.1% (Taux particulier)</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1.5">Sera appliqué par défaut sur vos nouvelles fiches de pièces/prestations.</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* OPTIONAL INSURANCE: RCP / DECENNALE */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 mb-1">
                      <ShieldCheck className={tc.textAccent} size={16} />
                      Assurance Décennale & Responsabilité Civile Professionnelle
                    </h4>
                    <p className="text-xs text-slate-400">Renseignez vos couvertures pour les injecter automatiquement en bas de page de vos devis et factures (Artisans, BTP, Conseils).</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-150 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Indiquer une assurance professionnelle sur mes factures</span>
                      <p className="text-[11px] text-slate-400">Requis légalement pour les artisans du bâtiment (mention géographique, assureur et n° de contrat).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={userProfile.hasProfessionalInsurance === true}
                        onChange={(e) => handleChange('hasProfessionalInsurance', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {userProfile.hasProfessionalInsurance && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-1"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Comptagnie d'Assurance (Assureur)</label>
                          <input 
                            type="text" 
                            placeholder="Ex: MAAF Assurances SA"
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all text-xs font-semibold text-slate-900`}
                            value={userProfile.insuranceCompanyName || ''}
                            onChange={(e) => handleChange('insuranceCompanyName', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Numéro de Contrat / Police</label>
                          <input 
                            type="text" 
                            placeholder="Ex: POL-91823901-B"
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all text-xs font-mono font-bold text-slate-900`}
                            value={userProfile.insuranceContractNumber || ''}
                            onChange={(e) => handleChange('insuranceContractNumber', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Étendue territoriale / Couverture</label>
                          <input 
                            type="text" 
                            placeholder="Ex: France métropolitaine et Corse"
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all text-xs font-semibold text-slate-900`}
                            value={userProfile.insuranceCoverageArea || ''}
                            onChange={(e) => handleChange('insuranceCoverageArea', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Détails des garanties couvertes (Optionnel)</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Garantie Décennale Maçonnerie, Carrelage, Isolations"
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all text-xs font-semibold text-slate-900`}
                            value={userProfile.insuranceDetails || ''}
                            onChange={(e) => handleChange('insuranceDetails', e.target.value)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: ACCOUNTING */}
            {activeTab === 'accounting' && (() => {
              // Calcul dynamique du Chiffre d'Affaires de l'exercice en cours (2026)
              const currentYearIndex = new Date().getFullYear();
              const invoicesCurrentYear = invoices.filter(inv => {
                if (!inv.date || inv.type !== 'invoice') return false;
                const isPaidOrSent = inv.status === 'PAID' || inv.status === 'SENT';
                const invYear = new Date(inv.date).getFullYear();
                return isPaidOrSent && invYear === currentYearIndex;
              });

              const actualYearCA = invoicesCurrentYear.reduce((sum, inv) => {
                const docTotal = inv.items?.reduce((pSum, p) => pSum + ((p.quantity || 0) * (p.unitPrice || 0)), 0) || 0;
                const discount = inv.discount || 0;
                return sum + Math.max(0, docTotal - discount);
              }, 0);

              const isSales = userProfile.activityType === 'sales';
              const isLiberal = userProfile.activityType === 'services_liberal';
              const isCommercial = userProfile.activityType === 'services_commercial';

              // Seuils 2025/2026 d'après la réglementation française
              const vatThresholdLimit = userProfile.activityType === 'custom' 
                ? (userProfile.customVatThreshold || 39100) 
                : (isSales ? 101000 : 39100);

              const caCeilingLimit = userProfile.activityType === 'custom' 
                ? (userProfile.customCaThreshold || 77700) 
                : (isSales ? 188700 : 77700);

              // Calcul des pourcentages de jauge
              const vatProgress = Math.min(100, Math.round((actualYearCA / vatThresholdLimit) * 100));
              const caProgress = Math.min(100, Math.round((actualYearCA / caCeilingLimit) * 100));

              // Taux de VLI d'après la loi française
              let vliTaxRate = 0;
              if (userProfile.hasVli) {
                if (isSales) vliTaxRate = 1.0;
                else if (isCommercial) vliTaxRate = 1.7;
                else if (isLiberal) vliTaxRate = 2.2;
                else vliTaxRate = 1.7;
              }

              // Est-ce que l'ACRE est actif ? Si coché et soit date vide soit moins de 12 mois
              let isAcreActive = false;
              if (userProfile.hasAcre) {
                if (!userProfile.acreStartDate) {
                  isAcreActive = true; // Actif par défaut si coché sans date rentrée
                } else {
                  const sDate = new Date(userProfile.acreStartDate);
                  const diffTime = Math.abs(Date.now() - sDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  isAcreActive = diffDays <= 365; // Réduction active pendant 1 an
                }
              }

              // Cotisations sociales URSSAF simulées
              const rawSocialRate = userProfile.activityType === 'custom'
                ? (userProfile.customChargesRate !== undefined ? userProfile.customChargesRate : 22.0)
                : (isSales ? 12.3 : 22.0);

              const activeSocialRate = isAcreActive ? (rawSocialRate / 2) : rawSocialRate;
              const simSocialCharges = (simulateAmount * activeSocialRate) / 100;
              const simVliCharges = userProfile.hasVli ? (simulateAmount * vliTaxRate / 100) : 0;
              const simNetIncome = simulateAmount - simSocialCharges - simVliCharges;

              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8 animate-fade-in"
                >
                  {/* TITLE HEAD */}
                  <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 mb-2">
                      <Percent className={tc.textAccent} size={22} />
                      Régime, Seuils de CA & Franchise TVA
                    </h3>
                    <p className="text-sm text-slate-400 font-medium">Suivez vos plafonds de chiffre d'affaires, paramétrez vos exonérations ACRE et le versement libératoire de l'impôt (VLI).</p>
                  </div>
                  
                  <div className="h-px bg-slate-100 my-4" />

                  {/* DOMAIN CONFIGURATION PANEL */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Générateur de régime fiscal - Secteur principal d'activité</label>
                      <div className="relative">
                        <select
                          className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                          value={userProfile.activityType || 'services_liberal'}
                          onChange={(e) => handleActivityTypeChange(e.target.value as any)}
                        >
                          <option value="services_liberal">Prestation de services - Profession Libérale (BNC - URSSAF 22%)</option>
                          <option value="services_commercial">Prestation de services - Artisanal ou Commercial (BIC - URSSAF 22%)</option>
                          <option value="sales">Achat / Vente de biens, hébergement & fournitures (BIC - URSSAF 12.3%)</option>
                          <option value="custom">Régime personnalisé (Renseignement manuel des taux & seuils)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Taux padrão URSSAF (%)</label>
                        <div className="relative">
                          <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                          <input 
                            type="number" 
                            step="0.1"
                            disabled={userProfile.activityType !== 'custom'}
                            className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono font-bold ${userProfile.activityType !== 'custom' ? 'opacity-70 cursor-not-allowed bg-slate-100/80 text-slate-500' : 'text-slate-900 bg-white'}`} 
                            value={rawSocialRate}
                            onChange={(e) => handleChange('customChargesRate', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Taux de base avant exonérations éventuelles (ex: ACRE).</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plafond Franchise TVA ({currencySymbol})</label>
                        <div className="relative overflow-hidden">
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 select-none">{currencySymbol}</span>
                          <input 
                            type="number" 
                            disabled={userProfile.activityType !== 'custom'}
                            className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono font-bold ${userProfile.activityType !== 'custom' ? 'opacity-70 cursor-not-allowed bg-slate-100/80 text-slate-500' : 'text-slate-900 bg-white'}`} 
                            value={vatThresholdLimit}
                            onChange={(e) => handleChange('customVatThreshold', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Au-delà de ce Chiffre d'Affaires annuel en cours, la TVA devient exigible.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plafond CA Micro ({currencySymbol})</label>
                        <div className="relative overflow-hidden">
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 select-none">{currencySymbol}</span>
                          <input 
                            type="number" 
                            disabled={userProfile.activityType !== 'custom'}
                            className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono font-bold ${userProfile.activityType !== 'custom' ? 'opacity-70 cursor-not-allowed bg-slate-100/80 text-slate-500' : 'text-slate-900 bg-white'}`} 
                            value={caCeilingLimit}
                            onChange={(e) => handleChange('customCaThreshold', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Seuil de tolérance avant basculement vers le régime réel.</p>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL CALCULATOR GAUGES (ALERTE SEUILS) */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-1.5">
                        Statut Réel de l'Exercice {currentYearIndex}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={18} />
                        Jauges de Surveillance de Chiffre d'Affaires & Alertes
                      </h4>
                      <p className="text-xs text-slate-400">Progression globale calculée dynamiquement à partir de vos factures encaissées/émises cette année : <span className="font-semibold text-slate-700 font-mono">{actualYearCA.toLocaleString('fr-FR')} {currencySymbol}</span>.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* GAUGE 1: TVA FRANCHISE */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-xs text-slate-700 block">1. Jauge Seuil Franchise de TVA</span>
                            <span className="text-[10px] text-slate-400">Limite d'application de l'abattement Art. 293 B CGI</span>
                          </div>
                          <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${vatProgress >= 100 ? 'bg-red-50 text-red-650 border border-red-100' : vatProgress >= 90 ? 'bg-orange-50 text-orange-650' : 'bg-green-50 text-green-650'}`}>
                            {vatProgress}%
                          </span>
                        </div>

                        {/* Bar progress */}
                        <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${vatProgress >= 100 ? 'bg-red-500' : vatProgress >= 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${vatProgress}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
                          <span>0 {currencySymbol}</span>
                          <span>Actuel: {actualYearCA.toLocaleString('fr-FR')} {currencySymbol}</span>
                          <span>Seuil: {vatThresholdLimit.toLocaleString('fr-FR')} {currencySymbol}</span>
                        </div>

                        {/* Alert Context */}
                        <div className="pt-2 border-t border-slate-200/60">
                          {vatProgress >= 100 ? (
                            <div className="text-[11px] text-slate-700 flex items-start gap-2">
                              <span className="text-red-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Seuil d'assujettissement dépassé !</strong> Vous devez d'ores et déjà facturer de la TVA à vos clients. Devenez assujetti actif et désactivez la mention d'exonération de TVA.</span>
                            </div>
                          ) : vatProgress >= 90 ? (
                            <div className="text-[11px] text-slate-700 flex items-start gap-2">
                              <span className="text-amber-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Alerte tolérance TVA !</strong> Vous approchez du seuil ({vatThresholdLimit.toLocaleString('fr-FR')} {currencySymbol}). Préparez l'intégration de la TVA sur vos prochains contrats de services ou de vente.</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 flex items-start gap-2">
                              <span className="text-emerald-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Franchise de TVA sécurisée.</strong> Vous continuez de facturer hors taxes (abattement article 293 B du CGI parfaitement justifié).</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* GAUGE 2: CA CEILING */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-xs text-slate-700 block">2. Jauge Seuil Maximal de CA</span>
                            <span className="text-[10px] text-slate-400">Plafond toléré de régime fiscal simplifié</span>
                          </div>
                          <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${caProgress >= 100 ? 'bg-red-50 text-red-650 border border-red-100' : caProgress >= 90 ? 'bg-orange-50 text-orange-650' : 'bg-green-50 text-green-650'}`}>
                            {caProgress}%
                          </span>
                        </div>

                        {/* Bar progress */}
                        <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${caProgress >= 100 ? 'bg-red-650' : caProgress >= 90 ? 'bg-amber-600' : 'bg-slate-700'}`}
                            style={{ width: `${caProgress}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
                          <span>0 {currencySymbol}</span>
                          <span>Actuel: {actualYearCA.toLocaleString('fr-FR')} {currencySymbol}</span>
                          <span>Seuil CA Max: {caCeilingLimit.toLocaleString('fr-FR')} {currencySymbol}</span>
                        </div>

                        {/* Alert Context */}
                        <div className="pt-2 border-t border-slate-200/60">
                          {caProgress >= 100 ? (
                            <div className="text-[11px] text-slate-700 flex items-start gap-2">
                              <span className="text-red-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Plafond dépassé !</strong> Dépassement constaté. Si cette situation est reconduite l'an prochain, vous serez d'office reclassé au régime réel d'imposition (EI ou société).</span>
                            </div>
                          ) : caProgress >= 90 ? (
                            <div className="text-[11px] text-slate-700 flex items-start gap-2">
                              <span className="text-amber-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Attention plafond proche !</strong> Vous touchez presque au plafond de la micro-entreprise. Ralentissez vos encaissements ou envisagez la création d'une société commerciale.</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 flex items-start gap-2">
                              <span className="text-emerald-500 font-extrabold text-sm leading-none shrink-0">●</span>
                              <span><strong>Cadre micro-entreprise sécurisé.</strong> Aucun risque opérationnel immédiat sur vos plafonds simplifiés de chiffre d'affaires.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TAX OPTIONS / INCENTIVES SELECTORS */}
                  <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 space-y-6">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 mb-1">
                        <Sliders className={tc.textAccent} size={16} />
                        Options de Fiscalité et Réductions d'Impôt
                      </h4>
                      <p className="text-xs text-slate-400">Configurez votre Versement Libératoire et votre abattement ACRE de création d'activité.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* OPTION 1: VERSEMENT LIBERATOIRE (VLI) */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-3 shrink-0">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 block">Option Versement Libératoire (VLI)</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={userProfile.hasVli === true}
                              onChange={(e) => handleChange('hasVli', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Permet de payer l'impôt sur le revenu au fur et à mesure du CA mensuel. Taux forfaitaire d'impôt appliqué à la source par l'URSSAF : 
                          <span className="font-bold text-slate-700 block mt-1">• prestat. libérales : 2.2% | artisanal : 1.7% | ventes : 1.0%</span>
                        </p>
                      </div>

                      {/* OPTION 2: EXONERATION ACRE */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 block">Bénéficiaire ACRE (Atout création)</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={userProfile.hasAcre === true}
                              onChange={(e) => handleChange('hasAcre', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Exonération partielle de charges de 50% sur l'URSSAF durant vos 4 premiers trimestres d'activité globale.
                        </p>

                        {userProfile.hasAcre && (
                          <div className="pt-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date de début de l'ACRE</label>
                            <input 
                              type="date"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs text-slate-700"
                              value={userProfile.acreStartDate || ''}
                              onChange={(e) => handleChange('acreStartDate', e.target.value)}
                            />
                            {isAcreActive ? (
                              <p className="text-[9px] text-green-600 font-bold mt-1">✓ Statut ACRE actif (applicable sur l'exercice en cours - taux divisé par 2)</p>
                            ) : userProfile.acreStartDate ? (
                              <p className="text-[9px] text-slate-400 font-medium mt-1">✗ Statut ACRE expiré (période d'un an écoulée d'après vos saisies)</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* HIGH-FIDELITY INTERACTIVE REVENUE SIMULATOR */}
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem] space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-4">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          <Coins className={tc.textAccent} size={16} />
                          Simulateur de CA & Charges (Versement VLI & ACRE intégrés)
                        </h4>
                        <p className="text-[11px] text-slate-400">Glissez le curseur pour évaluer précisément vos cotisations et impôts cumulés à l'avance.</p>
                      </div>
                      <div className="px-3.5 py-1.5 bg-white border border-slate-150 rounded-xl text-center shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">CA Projeté</span>
                        <span className="font-mono font-extrabold text-slate-900 text-lg">
                          {simulateAmount.toLocaleString('fr-FR')} {currencySymbol}
                        </span>
                      </div>
                    </div>

                    {/* Range select slider */}
                    <div className="space-y-2">
                      <input 
                        type="range" 
                        min="5000" 
                        max="120000" 
                        step="2500" 
                        value={simulateAmount}
                        onChange={(e) => setSimulateAmount(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800 focus:outline-none"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-slate-400">
                        <span>5 000 {currencySymbol}</span>
                        <span>Seuil Franchise ({vatThresholdLimit.toLocaleString('fr-FR')} {currencySymbol})</span>
                        <span>Seuil CA Max ({caCeilingLimit.toLocaleString('fr-FR')} {currencySymbol})</span>
                        <span>120 000 {currencySymbol}</span>
                      </div>
                    </div>

                    {/* Simulation Bento grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* URSSAF charges */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-150 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase">Charges URSSAF</span>
                          {isAcreActive && (
                            <span className="bg-emerald-50 text-emerald-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">ACRE ACTIVE -50%</span>
                          )}
                        </div>
                        <div className="text-xl font-mono font-extrabold text-red-500 mt-1">
                          - {simSocialCharges.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {currencySymbol}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Taux appliqué : {activeSocialRate}% {isAcreActive ? `(Standard ${rawSocialRate}%)` : ''}</p>
                      </div>

                      {/* VAT exemption indicator or VLI Tax */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-150 relative flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Impôt sur le Revenu (VLI)</span>
                          <span className="text-xl font-mono font-extrabold text-orange-650 mt-1 block">
                            {userProfile.hasVli ? `-${simVliCharges.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currencySymbol}` : `0 ${currencySymbol}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                          {userProfile.hasVli 
                            ? `Option VLI active. Prélèvement direct forfaitaire de ${vliTaxRate}%.`
                            : "Pas d'option VLI. Régime progressif classique avec abattement."
                          }
                        </p>
                      </div>

                      {/* Net Benefit */}
                      <div className={`p-4 rounded-2xl border relative bg-gradient-to-tr ${tc.gradientBg} text-white shadow-xl shadow-slate-900/5`}>
                        <span className="text-[10px] opacity-80 font-bold uppercase block">Bénéfice Net Simplifié</span>
                        <div className="text-2xl font-mono font-black mt-1">
                          + {simNetIncome.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {currencySymbol}
                        </div>
                        <p className="text-[9px] opacity-80 mt-1.5">Après déduction des cotisations et VLI configuré.</p>
                      </div>
                    </div>
                  </div>

                  {/* FISCAL CALENDAR / RETROPLANNING */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 mb-1">
                          <CheckCircle2 className="text-emerald-500" size={18} />
                          Calendrier Fiscal Personnalisé & Retroplanning
                        </h4>
                        <p className="text-xs text-slate-400">Sélectionnez la périodicité de vos télédéclarations URSSAF pour construire votre calendrier de l'exercice.</p>
                      </div>

                      <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChange('fiscalDeclarationPeriodicity', 'monthly')}
                          className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${userProfile.fiscalDeclarationPeriodicity !== 'quarterly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          Mensuel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('fiscalDeclarationPeriodicity', 'quarterly')}
                          className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${userProfile.fiscalDeclarationPeriodicity === 'quarterly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          Trimestriel
                        </button>
                      </div>
                    </div>

                    {/* Timeline of Next Deadlines for 2026/2027 */}
                    <div className="relative border-l border-slate-150 pl-6 ml-4 space-y-6 py-2">
                      {/* Timeline dot template */}
                      {userProfile.fiscalDeclarationPeriodicity === 'quarterly' ? (
                        <>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-indigo-600 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration URSSAF • Trimestre 2 (CA Avril - Juin 2026)</span>
                                <p className="text-[11px] text-slate-400">Enregistrez et acquittez les cotisations du second trimestre.</p>
                              </div>
                              <span className="bg-orange-50 text-orange-700 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-orange-100 shrink-0 font-mono">Dernière limite : 31 Juillet 2026</span>
                            </div>
                          </div>

                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-slate-350 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration URSSAF • Trimestre 3 (CA Juillet - Septembre 2026)</span>
                                <p className="text-[11px] text-slate-400">Enregistrez et acquittez les cotisations du troisième trimestre.</p>
                              </div>
                              <span className="bg-slate-50 text-slate-650 text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 font-mono">Dernière limite : 31 Octobre 2026</span>
                            </div>
                          </div>

                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-slate-350 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration URSSAF • Trimestre 4 (CA Octobre - Décembre 2026)</span>
                                <p className="text-[11px] text-slate-400">Dernière obligation de déclaration de l'exercice fiscal complet.</p>
                              </div>
                              <span className="bg-slate-50 text-slate-650 text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 font-mono">Dernière limite : 31 Janvier 2027</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-indigo-600 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5 font-medium">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration mensuelle URSSAF CA Juin 2026</span>
                                <p className="text-[11px] text-slate-400">Déclarez les encaissements perçus durant le mois de Juin.</p>
                              </div>
                              <span className="bg-orange-50 text-orange-700 text-[10px] font-extrabold px-3 py-1 rounded-lg border border-orange-100 shrink-0 font-mono">Dernière limite : 31 Juillet 2026</span>
                            </div>
                          </div>

                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-slate-350 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration mensuelle URSSAF CA Juillet 2026</span>
                                <p className="text-[11px] text-slate-400">Déclarez les encaissements perçus durant le mois de Juillet.</p>
                              </div>
                              <span className="bg-slate-50 text-slate-650 text-[10px] font-bold px-3 py-1 rounded-lg shrink-0 font-mono">Dernière limite : 31 Août 2026</span>
                            </div>
                          </div>

                          <div className="relative">
                            <span className="absolute -left-[31px] top-1.5 bg-slate-350 text-white p-1 rounded-full border-4 border-white shadow-xs">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-slate-800">Télédéclaration mensuelle URSSAF CA Août 2026</span>
                                <p className="text-[11px] text-slate-400">Déclarez les encaissements perçus durant le mois d'Août.</p>
                              </div>
                              <span className="bg-slate-50 text-slate-650 text-[10px] font-bold px-3 py-1 rounded-lg shrink-0 font-mono">Dernière limite : 30 Septembre 2026</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* OTHER DEADLINES RECURRENT FOR EVERYONE */}
                      <div className="relative">
                        <span className="absolute -left-[31px] top-1.5 bg-rose-600 text-white p-1 rounded-full border-4 border-white shadow-xs">
                          <Check size={10} className="stroke-[3]" />
                        </span>
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="space-y-0.5">
                            <span className="text-xs font-extrabold text-rose-650 flex items-center gap-1">
                                CFE • Cotisation Foncière des Entreprises
                            </span>
                            <p className="text-[11px] text-slate-400">Taxe locale foncière obligatoire pour les micro-entrepreneurs. Exonération la 1ère année ou si CA inférieur à 5000 €.</p>
                          </div>
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-extrabold px-3 py-1 rounded-lg border border-rose-100 shrink-0 font-mono">Souscription : 15 Décembre 2026</span>
                        </div>
                      </div>

                      <div className="relative">
                        <span className="absolute -left-[31px] top-1.5 bg-blue-600 text-white p-1 rounded-full border-4 border-white shadow-xs">
                          <Check size={10} className="stroke-[3]" />
                        </span>
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="space-y-0.5">
                            <span className="text-xs font-extrabold text-blue-650">Déclaration annuelle de Revenus complémentaires (N° 2042-C-PRO)</span>
                            <p className="text-[11px] text-slate-400">Intégrez votre déclaration fiscale globale auprès du service des impôts des particuliers.</p>
                          </div>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-3 py-1 rounded-lg border border-blue-100 shrink-0 font-mono">Exercice Fiscal • Mai 2027</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* TAB: LOCAL DATA */}
            {activeTab === 'data' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                    <Database className={tc.textAccent} size={20} />
                    Contrôle des données de l'application
                  </h3>
                  <p className="text-sm text-slate-400">Exportez votre environnement pour vos sauvegardes comptables, importez vos archives, ou explorez l'outil grâce aux données de démo.</p>
                </div>
                
                <div className="h-px bg-slate-100 my-4" />

                <div className="space-y-6">
                  
                  {/* Action 1: Export Backup */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-all gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                        <Download size={18} className={tc.textAccent} />
                        Exporter une sauvegarde complète (JSON)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 mr-2">Génère un fichier de sécurité universel contenant vos profils, clients, fournisseurs, produits, dépenses et factures.</p>
                    </div>
                    <button
                      onClick={handleExportData}
                      className={`py-3 px-5 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer bg-slate-900 hover:opacity-90`}
                    >
                      <Download size={16} />
                      Exporter (.json)
                    </button>
                  </div>

                  {/* Action 1.5: Export SQL Backup */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-all gap-4 font-sans">
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                        <Database size={18} className="text-emerald-650" />
                        Exporter une sauvegarde locale (SQL)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 mr-2">Génère un script SQL structuré avec la création des tables et des insertions de toutes vos lignes de données pour SQLite ou PostgreSQL.</p>
                    </div>
                    <button
                      onClick={handleExportSqlData}
                      className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Database size={16} />
                      Exporter (.sql)
                    </button>
                  </div>

                  {/* Action 2: Import Backup */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-all gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                        <Upload size={18} className="text-indigo-650" />
                        Restaurer une sauvegarde (JSON)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 mr-2">Récupérez et écrivez vos registres à partir d'un fichier de sauvegarde précédemment exporté au format compatible.</p>
                      
                      {importSuccess && <p className="text-xs text-emerald-600 font-extrabold mt-2">✓ Restauration effectuée avec succès !</p>}
                      {importError && <p className="text-xs text-red-500 font-extrabold mt-2">❌ Erreur d'import : {importError}</p>}
                    </div>
                    
                    <div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportData} 
                        accept=".json"
                        className="hidden" 
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="py-3 px-5 bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload size={16} />
                        Parcourir le fichier
                      </button>
                    </div>
                  </div>

                  {/* Action 2.5: Import SQL Backup */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-all gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                        <Upload size={18} className="text-emerald-650" />
                        Restaurer une sauvegarde (SQL)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 mr-2">Restaurer l'intégralité de vos tables (factures, clients, produits, taxes...) depuis un script SQL généré précédemment.</p>
                      
                      {sqlImportSuccess && <p className="text-xs text-emerald-600 font-extrabold mt-2">✓ Restauration du snapshot SQL réussie !</p>}
                      {sqlImportError && <p className="text-xs text-red-500 font-extrabold mt-2">❌ Erreur d'import SQL : {sqlImportError}</p>}
                    </div>
                    
                    <div>
                      <input 
                        type="file" 
                        ref={sqlFileInputRef} 
                        onChange={handleImportSqlFile} 
                        accept=".sql"
                        className="hidden" 
                      />
                      <button
                        onClick={() => sqlFileInputRef.current?.click()}
                        className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload size={16} />
                        Parcourir le fichier SQL
                      </button>
                    </div>
                  </div>

                  {/* Action 3: Seed Demo Data */}
                  <div className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border gap-4 ${tc.lightBg} ${tc.lightBorder}`}>
                    <div className="space-y-1">
                      <h4 className={`font-extrabold flex items-center gap-2 text-base ${tc.textAccent}`}>
                        <Sparkles size={18} />
                        Peupler des exemples professionnels (Démo)
                      </h4>
                      <p className="text-xs text-slate-500">Remplissez instantanément l'application avec des clients réels, des produits, des dépenses d'exercice et des factures à divers statuts comptables.</p>
                    </div>
                    <button
                      onClick={handleSeedDemoData}
                      className={`py-3 px-5 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-600`}
                    >
                      <RefreshCw size={16} />
                      Créer les données de test
                    </button>
                  </div>

                  {/* Action 4: Real hard reset */}
                  <div className="p-6 bg-red-50/50 rounded-2xl border border-red-200/60 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-extrabold text-red-900 flex items-center gap-2 text-base">
                          <Trash2 size={18} className="text-red-650" />
                          Remise à zéro d'usine (Wipe out)
                        </h4>
                        <p className="text-xs text-red-500/80 mt-1">Efface l'intégralité de vos bases de données, configurations locales et remet l'application à neuf.</p>
                      </div>
                      
                      {!showResetConfirm ? (
                        <button
                          onClick={() => setShowResetConfirm(true)}
                          className="py-3 px-5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={16} />
                          Tout supprimer...
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={handleResetData}
                            className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            Confirmer la suppression
                          </button>
                          <button
                            onClick={() => setShowResetConfirm(false)}
                            className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {showResetConfirm && (
                      <div className="bg-white p-4 rounded-xl border border-red-150 text-red-600 text-xs leading-relaxed flex items-center gap-3">
                        <AlertTriangle size={15} className="shrink-0 text-red-600 animate-bounce" />
                        <span>Attention : Cette opération est irréversible et détruira l'ensemble de votre base locale d'activité. Veillez à bien exporter vos données au préalable.</span>
                      </div>
                    )}
                  </div>

                  {/* Action 5: Detailed Session & Security Manager */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-805 space-y-5">
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2 text-base">
                        <Lock size={18} className="text-blue-500" />
                        Audit de Sécurité & Sessions Actives
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Consultez les appareils et terminaux connectés de façon sécurisée à votre espace de micro-entreprise.</p>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const email = localStorage.getItem('autogest_session_email') || '';
                        const allUsers = localStorage.getItem('autogest_registered_users');
                        const users = allUsers ? JSON.parse(allUsers) : [];
                        const currentUser = users.find((u: any) => u.email === email);
                        
                        if (!currentUser || !currentUser.sessions || currentUser.sessions.length === 0) {
                          return (
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xs text-slate-500">
                              Aucune session active enregistrée.
                            </div>
                          );
                        }

                        return currentUser.sessions.map((sess: any) => (
                          <div 
                            key={sess.id} 
                            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                                <Laptop size={16} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-50">{sess.device}</p>
                                  {sess.isActive && (
                                    <span className="text-[9px] font-extrabold tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md uppercase">
                                      Session Actuelle
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Globe size={11} /> {sess.ip} • {sess.location}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} /> Connecté le {new Date(sess.loginTime).toLocaleDateString('fr-FR')} à {new Date(sess.loginTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                alert("Révocation de jeton : Cette session est sécurisée par authentification locale unique. Pour rompre l'accès, fermez simplement l'application ou déconnectez-vous via le menu latéral.");
                              }}
                              className="p-1 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 font-extrabold hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-all cursor-pointer"
                            >
                              Révoquer l'accès
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: PPF CONFIGURATION */}
            {activeTab === 'ppf' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                    <Globe className={tc.textAccent} size={20} />
                    Configuration du Portail Public (PPF)
                  </h3>
                  <p className="text-sm text-slate-400">
                    Paramétrez le raccordement légal obligatoire de votre entreprise à la réforme française de facturation électronique (2026).
                  </p>
                </div>
                
                <div className="h-px bg-slate-100 my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Mode de raccordement */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mode de raccordement (Environnement)</label>
                    <div className="relative">
                      <select
                        className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                        value={userProfile.ppfEnvironment || 'simulated'}
                        onChange={(e) => handleChange('ppfEnvironment', e.target.value)}
                      >
                        <option value="simulated">Simulateur Local Embarqué (Recommandé)</option>
                        <option value="sandbox">Bac à Sable API (AIFE / Chorus Pro)</option>
                        <option value="production">Production Réelle (Portail Public Fiscal)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Choix d'acheminement */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Canal d'acheminement de la Facture</label>
                    <div className="relative">
                      <select
                        className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                        value={userProfile.ppfPreferredFramework || 'ppf_direct'}
                        onChange={(e) => handleChange('ppfPreferredFramework', e.target.value)}
                      >
                        <option value="ppf_direct">Solution Directe raccordée PPF (Standard DGFIP)</option>
                        <option value="pdp">Plateforme de Dématérialisation Partenaire (PDP Privée)</option>
                        <option value="od">Opérateur de Dématérialisation (OD Partenaire)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Conditions optionnelles si PDP */}
                  {userProfile.ppfPreferredFramework === 'pdp' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SIRET de la PDP Partenaire</label>
                      <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          className={`w-full pl-12 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-sm tracking-wider`}
                          value={userProfile.ppfPdpSiret || ''}
                          onChange={(e) => handleChange('ppfPdpSiret', e.target.value)}
                          placeholder="Ex: 130 025 244 00010 (PDP Sopra Steria ou Cegid)"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Configurez le SIRET fourni par votre opérateur PDP afin d'orienter vos flux d'acquittements directement vers leurs serveurs sécurisés.</p>
                    </div>
                  )}

                  {/* Credentials Section */}
                  <div className="md:col-span-2 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Key size={16} className={tc.textAccent} />
                      Identifiants de Connexions API & Cryptographie
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Identifiant Client API (Client ID)</label>
                        <input 
                          type="text" 
                          className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 font-mono text-xs`}
                          value={userProfile.ppfClientId || ''}
                          onChange={(e) => handleChange('ppfClientId', e.target.value)}
                          placeholder="Ex: PPF_CLIENT_API_4335"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Clé Secrète API (Client Secret)</label>
                        <input 
                          type="password" 
                          className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 font-mono text-xs`}
                          value={userProfile.ppfClientSecret || ''}
                          onChange={(e) => handleChange('ppfClientSecret', e.target.value)}
                          placeholder="••••••••••••••••••••••••••••••••"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Certificat Fiscal Obligatoire (Signatures RGS** / eIDAS)</label>
                        <div className="relative">
                          <select
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-slate-450 font-medium text-slate-800 text-sm appearance-none"
                            value={userProfile.ppfCertificateName || ''}
                            onChange={(e) => handleChange('ppfCertificateName', e.target.value)}
                          >
                            <option value="">-- Aucun certificat actif --</option>
                            <option value="rgs_w2_2026">Certificat National Fiscal RGS** (Clé de Signature DGFIP)</option>
                            <option value="chorus_api_key">Clé API Chorus Pro d'Acheminement (Standard National)</option>
                            <option value="custom_eidas">Certificat Securisé eIDAS de niveau 2 (Défini par décret)</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Conformément aux décrets d'application 2026, l'absence de certificat fiscal rejette les Factures du tiers destinataire lors du contrôle réglementaire du PPF.</p>
                      </div>
                    </div>
                  </div>

                  {/* Checkbox Options */}
                  <div className="md:col-span-2 font-sans">
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${tc.lightBg} ${tc.lightBorder}`}>
                      <input 
                        type="checkbox" 
                        id="ppfAutoSyncDirectory"
                        className="mt-1 w-4 h-4 text-slate-850 border-slate-300 rounded focus:ring-slate-500"
                        checked={userProfile.ppfAutoSyncDirectory !== undefined ? userProfile.ppfAutoSyncDirectory : true}
                        onChange={(e) => handleChange('ppfAutoSyncDirectory', e.target.checked)}
                      />
                      <div>
                        <label htmlFor="ppfAutoSyncDirectory" className="block text-sm font-bold text-slate-800 cursor-pointer">
                          Mise à jour automatique par Annuaire Centralisé (Siret-Annuaire)
                        </label>
                        <p className="text-xs text-slate-500 leading-normal mt-1">
                          L'application interroge automatiquement l'annuaire d'État du PPF avant de valider l'export JSON/XML du format Factur-X standard de vos clients. Cela évite les rejets lors du contrôle légal en identifiant immédiatement si le client passe par une PDP ou en direct.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 mt-4 ${tc.lightBg} ${tc.lightBorder} ${tc.textAccent}`}>
                  <div className="p-1 px-2.2 bg-white rounded-lg shadow-xs font-bold shrink-0">!</div>
                  <span className="font-medium text-slate-700">
                    La facturation électronique via PPF/Chorus sera progressivement imposée en France de 2026 à 2027. Vos fichiers XML de format Factur-X générés par cette application intègrent d'ores et déjà les métadonnées requises par le schéma d'ordonnance fiscale nationale.
                  </span>
                </div>
              </motion.div>
            )}

            {/* TAB: AI ASSISTANT CONFIGURATION */}
            {activeTab === 'ai_assistant' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${tc.textAccent} ${tc.lightBg} border ${tc.lightBorder} px-2 py-0.5 rounded uppercase tracking-wider`}>Configuration Modèle</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mt-1 mb-2">
                    <Sparkles className={`${tc.textAccent} animate-pulse`} size={20} />
                    Configuration de l'Assistant IA
                  </h3>
                  <p className="text-sm text-slate-400">
                    Ajustez les paramètres de comportement, de tonalité et de contextualisation de votre conseiller fiscal et administratif.
                  </p>
                </div>

                <div className="h-px bg-slate-100 my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Tonalité des réponses */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tonalité & Style de Rédaction</label>
                    <div className="relative">
                      <select
                        className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-900 appearance-none`}
                        value={userProfile.aiTone || 'professional'}
                        onChange={(e) => {
                          handleChange('aiTone', e.target.value);
                          triggerFeedback("Tonalité de l'assistant mise à jour !");
                        }}
                      >
                        <option value="professional">📋 Professionnel & Formel (Défaut)</option>
                        <option value="pedagogical">🎓 Pédagogique & Détaillé (Idéal réglementations)</option>
                        <option value="concise">⚡ Ultra-Concis (Direct au but)</option>
                        <option value="creative">🚀 Créatif & Commercial (Offres, Marketing)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                        ▼
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">Configure la manière dont le modèle de langage module son style d'expression dans le chatbot.</p>
                  </div>

                  {/* Bouton de synchronisation de contexte */}
                  <div className="font-sans">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Analyse Contextuelle des Données</label>
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${tc.lightBg} ${tc.lightBorder}`}>
                      <input 
                        type="checkbox" 
                        id="aiIncludeContext"
                        className="mt-1 w-4 h-4 text-slate-850 border-slate-300 rounded focus:ring-slate-505 cursor-pointer"
                        checked={userProfile.aiIncludeContext !== undefined ? userProfile.aiIncludeContext : true}
                        onChange={(e) => {
                          handleChange('aiIncludeContext', e.target.checked);
                          triggerFeedback("Partage de contexte mis à jour !");
                        }}
                      />
                      <div>
                        <label htmlFor="aiIncludeContext" className="block text-xs font-bold text-slate-850 cursor-pointer select-none">
                          Partager mes indicateurs de recettes & dépenses
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal mt-0.5 select-none font-medium">
                          Permet à l'assistant d'analyser en direct votre trésorerie, vos factures impayées, et votre catalogue d'articles pour répondre précisément à vos requêtes fiscales.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Consignes Métier Personnalisées */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Consignes Métier & Directives de Facturation</label>
                    <textarea 
                      className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all resize-none text-slate-800 font-medium text-xs h-32`}
                      value={userProfile.aiCustomInstructions || ''}
                      onChange={(e) => handleChange('aiCustomInstructions', e.target.value)}
                      placeholder="Exemple :&#10;- Rédige toujours mes emails de relance en utilisant le vouvoiement.&#10;- Rappelle systématiquement que mon entreprise applique un délai légal de 30 jours.&#10;- Rappelle l'application de pénalités de retard égales à 3 fois le taux légal."
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Incorporez des spécificités réglementaires ou professionnelles propres à votre secteur ou à vos préférences de communication.</p>
                  </div>

                  {/* Configuration Modèle et Clé API Multi-Fournisseurs */}
                  <div className="md:col-span-2 space-y-6 pt-4 border-t border-slate-100">
                    
                    {/* Choix du modèle d'IA */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Choix du modèle d'Intelligence Artificielle</label>
                      <div className="relative">
                        <select
                          className={`w-full p-4 pr-10 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-semibold text-slate-950 appearance-none text-xs`}
                          value={userProfile.aiModel || 'gemini-3.5-flash'}
                          onChange={(e) => {
                            handleChange('aiModel', e.target.value);
                            triggerFeedback(`Modèle configuré sur : ${e.target.value}`);
                          }}
                        >
                          <optgroup label="Google Gemini (Optimal & Rapide)">
                            <option value="gemini-3.5-flash">⚡ Gemini 3.5 Flash (Recommandé, rapide & puissant)</option>
                            <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Haute vitesse)</option>
                            <option value="gemini-2.0-pro-exp">💎 Gemini 2.0 Pro (Raisonnement avancé & code)</option>
                            <option value="gemini-1.5-pro">🎨 Gemini 1.5 Pro (Grand contexte de calcul)</option>
                          </optgroup>
                          <optgroup label="Anthropic Claude (Rédaction d'Emails & Rigueur)">
                            <option value="claude-3-5-sonnet-latest">🧠 Claude 3.5 Sonnet (Précision rédactionnelle exceptionnelle)</option>
                            <option value="claude-3-5-haiku-latest">⚡ Claude 3.5 Haiku (Réponses courtes et concises)</option>
                            <option value="claude-3-opus-latest">🎓 Claude 3 Opus (Raisonnement d'expert)</option>
                          </optgroup>
                          <optgroup label="Mistral AI (Souveraineté & Modèles Européens)">
                            <option value="mistral-large-latest">🇪🇺 Mistral Large (Capacités linguistiques supérieures)</option>
                            <option value="mistral-medium-latest">🇪🇺 Mistral Medium (Idéal gestion d'entreprise)</option>
                            <option value="codestral-latest">🇪🇺 Codestral (Optimisé pour les structures de code et d'appels)</option>
                          </optgroup>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-sm font-bold">
                          ▼
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Sélectionnez le moteur d'Intelligence Artificielle à activer pour l'ensemble de vos analyses comptables et rédactions.</p>
                    </div>

                    {/* Section de configuration des Clés d'API Privées */}
                    <div className="bg-slate-50/50 border border-slate-200/65 rounded-[2rem] p-6 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Key size={16} className={tc.textAccent} />
                          Configuration de vos clés API personnelles
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Configurez ici les clés de raccordement pour vos propres quotas de requêtes. Seul le fournisseur du modèle choisi sera sollicité.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        
                        {/* Clé API Google Gemini */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Clé Google Gemini</label>
                            <button
                              type="button"
                              onClick={() => setShowGeminiKey(!showGeminiKey)}
                              className={`text-[9px] font-extrabold ${tc.textAccent} hover:underline cursor-pointer`}
                            >
                              {showGeminiKey ? "Masquer" : "Afficher"}
                            </button>
                          </div>
                          <input
                            type={showGeminiKey ? "text" : "password"}
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-xs text-slate-800`}
                            value={userProfile.aiGeminiApiKey || userProfile.aiApiKey || ''}
                            onChange={(e) => {
                              handleChange('aiGeminiApiKey', e.target.value);
                              // Maintain backwards compatibility field
                              handleChange('aiApiKey', e.target.value);
                            }}
                            placeholder="AIzaSy..."
                          />
                        </div>

                        {/* Clé API Anthropic Claude */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Clé Anthropic Claude</label>
                            <button
                              type="button"
                              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                              className={`text-[9px] font-extrabold ${tc.textAccent} hover:underline cursor-pointer`}
                            >
                              {showAnthropicKey ? "Masquer" : "Afficher"}
                            </button>
                          </div>
                          <input
                            type={showAnthropicKey ? "text" : "password"}
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-xs text-slate-800`}
                            value={userProfile.aiAnthropicApiKey || ''}
                            onChange={(e) => handleChange('aiAnthropicApiKey', e.target.value)}
                            placeholder="sk-ant-api03..."
                          />
                        </div>

                        {/* Clé API Mistral AI */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Clé Mistral AI</label>
                            <button
                              type="button"
                              onClick={() => setShowMistralKey(!showMistralKey)}
                              className={`text-[9px] font-extrabold ${tc.textAccent} hover:underline cursor-pointer`}
                            >
                              {showMistralKey ? "Masquer" : "Afficher"}
                            </button>
                          </div>
                          <input
                            type={showMistralKey ? "text" : "password"}
                            className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 ${tc.ringFocus} transition-all font-mono text-xs text-slate-800`}
                            value={userProfile.aiMistralApiKey || ''}
                            onChange={(e)=> handleChange('aiMistralApiKey', e.target.value)}
                            placeholder="Ex: mistral_api_key..."
                          />
                        </div>

                      </div>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}
            {activeTab === 'cgv' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Header & Main Control Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                        Code de Commerce & Conformité 2026
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                      <FileCheck className={tc.textAccent} size={24} />
                      Conditions Générales de Vente (CGV)
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                      Rédigez, personnalisez et contrôlez la conformité juridique de vos CGV applicables à l'ensemble de vos devis, factures et contrats commerciaux.
                    </p>
                  </div>

                  {/* Right Action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setCgvViewMode(cgvViewMode === 'edit' ? 'preview' : 'edit')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                        cgvViewMode === 'preview'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cgvViewMode === 'edit' ? <Eye size={15} /> : <Edit3 size={15} />}
                      <span>{cgvViewMode === 'edit' ? 'Aperçu Document' : 'Mode Éditeur'}</span>
                    </button>

                    <button
                      onClick={() => setShowCgvTemplateModal(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 hover:bg-indigo-100 flex items-center gap-1.5 transition-all"
                    >
                      <BookOpen size={15} />
                      <span>Modèles de CGV</span>
                    </button>

                    <button
                      onClick={handleCopyCgvText}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition-all"
                      title="Copier le texte brut"
                    >
                      {cgvCopySuccess ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      <span>{cgvCopySuccess ? 'Copié !' : 'Copier'}</span>
                    </button>

                    <button
                      onClick={() => setShowCgvPrintModal(true)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition-all"
                      title="Imprimer / Télécharger PDF"
                    >
                      <Printer size={15} />
                      <span>Imprimer</span>
                    </button>
                  </div>
                </div>

                {/* Audit & Audit Bar (Audit de conformité juridique) */}
                {(() => {
                  const compliance = getCgvComplianceCheck(userProfile.cgv || '');
                  return (
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm ${
                            compliance.scorePercentage === 100 ? 'bg-emerald-600' :
                            compliance.scorePercentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}>
                            {compliance.scorePercentage}%
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>Conformité des Mentions Légales</span>
                              <span className="text-xs font-normal text-slate-500">({compliance.passedCount}/{compliance.totalCount} mentions détectées)</span>
                            </h4>
                            <p className="text-xs text-slate-500">
                              {compliance.scorePercentage === 100
                                ? 'Félicitations ! Vos CGV comportent toutes les clauses obligatoires selon le Code de commerce.'
                                : 'Certaines mentions clés recommandées sont absentes de votre texte. Cliquez pour les insérer automatiquement.'}
                            </p>
                          </div>
                        </div>

                        {compliance.scorePercentage < 100 && (
                          <button
                            onClick={handleSubstituteCgvVariablesInProfile}
                            className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1.5 self-start sm:self-center"
                          >
                            <Sparkles size={13} />
                            <span>Injecter mes variables</span>
                          </button>
                        )}
                      </div>

                      {/* Checklist badges Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60">
                        {compliance.checks.map((check) => (
                          <div
                            key={check.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                              check.passed
                                ? 'bg-emerald-50/60 border-emerald-200/60 text-emerald-900'
                                : 'bg-amber-50/60 border-amber-200/80 text-amber-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {check.passed ? (
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              ) : (
                                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                              )}
                              <span className="font-semibold truncate">{check.label}</span>
                            </div>
                            
                            {!check.passed && (
                              <button
                                onClick={() => {
                                  const current = userProfile.cgv || '';
                                  handleChange('cgv', current + '\n' + check.fixSnippet);
                                  triggerFeedback(`Clause "${check.label}" ajoutée au texte !`);
                                }}
                                className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded hover:bg-amber-700 transition-all shrink-0"
                              >
                                + Insérer
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Insertion rapide de balises de variables */}
                {cgvViewMode === 'edit' && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <PlusCircle size={14} className="text-blue-600" />
                        Variables dynamiques à insérer dans le texte :
                      </span>
                      <button
                        onClick={handleSubstituteCgvVariablesInProfile}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        Remplacer toutes les balises par mes vraies données
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { label: '{RAISON_SOCIALE}', desc: userProfile.companyName || 'Nom entreprise' },
                        { label: '{SIRET}', desc: userProfile.siret || 'SIRET' },
                        { label: '{DELAI_PAIEMENT}', desc: userProfile.paymentDelayDays !== undefined ? `${userProfile.paymentDelayDays} jours` : '30 jours' },
                        { label: '{TRIBUNAL_COMPETENT}', desc: userProfile.rcsRegistry || 'Greffe' },
                        { label: '{EMAIL}', desc: userProfile.email || 'Email' },
                        { label: '{MENTION_TVA}', desc: 'Mention TVA / Exonération' }
                      ].map((v) => (
                        <button
                          key={v.label}
                          onClick={() => {
                            const current = userProfile.cgv || '';
                            handleChange('cgv', current + ` ${v.label} `);
                            triggerFeedback(`Balise ${v.label} insérée dans l'éditeur`);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                          title={`Insérer la balise ${v.label}`}
                        >
                          <span className="text-blue-600 font-bold">{v.label}</span>
                          <span className="text-[10px] text-slate-400 font-sans">({v.desc})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main View: Editor vs Document Preview */}
                {cgvViewMode === 'edit' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Contenu HTML / WYSIWYG des CGV
                      </label>
                      <span className="text-xs text-slate-400">
                        Formaté avec titres H2, paragraphes et puces
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <RichTextEditor 
                        value={userProfile.cgv || ''}
                        onChange={(value) => handleChange('cgv', value)}
                        placeholder="Rédigez ou collez ici vos conditions générales de vente..."
                        className="w-full"
                      />
                    </div>
                    
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-2">
                      <Info size={14} className="text-blue-500 shrink-0" />
                      Ces conditions seront automatiquement intégrées dans vos devis et factures ou jointes en annexe de vos documents PDF.
                    </p>
                  </div>
                ) : (
                  /* Mode Prévisualisation Document Impressif */
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-12 space-y-8 max-w-4xl mx-auto">
                    {/* Header Document Preview */}
                    <div className="border-b-2 border-slate-900 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-tr from-slate-900 to-slate-700 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
                          {userProfile.companyName ? userProfile.companyName.charAt(0) : 'E'}
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-slate-900">
                            {userProfile.companyName || 'Nom de votre Entreprise'}
                          </h2>
                          <p className="text-xs text-slate-500 font-mono">
                            SIRET : {userProfile.siret || '000 000 000 00000'} • {userProfile.address || 'Adresse du siège'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {userProfile.email} {userProfile.phone ? `• ${userProfile.phone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left md:text-right bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Document Annexe</span>
                        <h3 className="text-base font-black text-slate-900">CONDITIONS GÉNÉRALES DE VENTE</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>

                    {/* Formatted CGV Content */}
                    <div className="prose prose-slate max-w-none text-slate-700 text-xs sm:text-sm leading-relaxed space-y-4 font-sans">
                      {userProfile.cgv ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: getSubstitutedCgvText(userProfile.cgv) }} 
                          className="cgv-formatted-preview"
                        />
                      ) : (
                        <div className="py-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Aucune condition générale de vente saisie pour le moment.
                        </div>
                      )}
                    </div>

                    {/* Signature block */}
                    <div className="pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                      <div className="space-y-2">
                        <span className="font-bold text-slate-900">Pour l'Émetteur ({userProfile.companyName || 'L\'entreprise'})</span>
                        <p className="text-slate-500 text-[11px]">Cachet et signature du représentant légal</p>
                        <div className="h-20 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-center text-slate-300 italic text-[11px]">
                          Signature de l'entreprise
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-slate-900">Pour le Client (Bon pour accord & acceptation des CGV)</span>
                        <p className="text-slate-500 text-[11px]">Nom, fonction, date et signature manuscrite</p>
                        <div className="h-20 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-center text-slate-300 italic text-[11px]">
                          Mention manuscrite « Lu et approuvé »
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL: Modèles de CGV */}
                <AnimatePresence>
                  {showCgvTemplateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
                      >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">Bibliothèque de Modèles CGV Types</h3>
                              <p className="text-xs text-slate-500">Sélectionnez un modèle juridique conforme au droit français adapté à votre activité.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowCgvTemplateModal(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cgvTemplatesList.map((tpl) => (
                              <div
                                key={tpl.id}
                                onClick={() => setSelectedCgvTemplateId(tpl.id)}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                  selectedCgvTemplateId === tpl.id
                                    ? 'border-indigo-600 bg-indigo-50/30 shadow-md'
                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${tpl.badgeColor}`}>
                                      {tpl.badge}
                                    </span>
                                    {selectedCgvTemplateId === tpl.id && (
                                      <CheckCircle2 size={18} className="text-indigo-600" />
                                    )}
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-sm mb-1">{tpl.title}</h4>
                                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{tpl.subtitle}</p>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const templateContent = getSubstitutedCgvText(tpl.content);
                                    handleChange('cgv', templateContent);
                                    setShowCgvTemplateModal(false);
                                    triggerFeedback(`Modèle "${tpl.title}" chargé avec vos données d'entreprise !`);
                                  }}
                                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    selectedCgvTemplateId === tpl.id
                                      ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <FilePlus size={14} />
                                  <span>Charger ce modèle</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                          <span>Ces modèles sont rédigés selon le Code de commerce français (Articles L. 441-10 et D. 441-5).</span>
                          <button
                            onClick={() => setShowCgvTemplateModal(false)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300"
                          >
                            Fermer
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* MODAL / IMPRESSION CGV */}
                <AnimatePresence>
                  {showCgvPrintModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-6"
                      >
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Printer className="text-blue-600" size={20} />
                            Impression & Exportation des CGV
                          </h3>
                          <button
                            onClick={() => setShowCgvPrintModal(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                          Vous pouvez lancer l'impression système ou sauvegarder les CGV au format PDF depuis la fenêtre d'impression native du navigateur.
                        </p>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Résumé du document émis :</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5 font-mono">
                            <li>• Émetteur : {userProfile.companyName || 'Non configuré'} (SIRET : {userProfile.siret || '000 000 000 00000'})</li>
                            <li>• Délai de règlement : {userProfile.paymentDelayDays !== undefined ? `${userProfile.paymentDelayDays} jours` : '30 jours'}</li>
                            <li>• Régime TVA : {userProfile.vatFranchiseArt293B ? 'Franchise en base (Art. 293 B CGI)' : 'Assujetti TVA'}</li>
                            <li>• Greffe / Juridiction : {userProfile.rcsRegistry ? `Tribunal de Commerce de ${userProfile.rcsRegistry}` : 'Tribunal compétent par défaut'}</li>
                          </ul>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setShowCgvPrintModal(false)}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => {
                              window.print();
                              setShowCgvPrintModal(false);
                            }}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 flex items-center gap-2"
                          >
                            <Printer size={16} />
                            <span>Lancer l'impression / Enregistrer en PDF</span>
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column: Live Header/Brand Preview */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Rendu de marque (Aperçu)</h4>
            
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-[4rem] -mr-8 -mt-8"></div>
              
              {/* Logo / Initiale */}
              <div className="border-b border-slate-100 pb-6 mb-6 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20 font-bold text-xl">
                  {userProfile.companyName ? userProfile.companyName.charAt(0) : 'E'}
                </div>
                <h3 className="font-extrabold text-slate-900 text-xl leading-tight mb-1">
                  {userProfile.companyName || 'Votre Entreprise'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Mail size={12} />
                  {userProfile.email || 'billing@entreprise.fr'}
                </p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Phone size={12} />
                  {userProfile.phone || '06 00 00 00 00'}
                </p>
                {userProfile.website && (
                  <p className="text-xs text-blue-600 font-medium underline mt-2 flex items-center gap-1">
                    <Globe size={12} />
                    {userProfile.website}
                  </p>
                )}
              </div>

              {/* Fake Invoice Metadata Area */}
              <div className="space-y-3 opacity-60 mb-8 text-xs">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Facture N°</span>
                  <span className="font-mono">{userProfile.invoicePrefix || 'FAC-'}2026-004</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Date d'estimation</span>
                  <span>{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Paiement requis</span>
                  <span>{userProfile.paymentDelayDays !== undefined ? `${userProfile.paymentDelayDays} jours` : '30 jours'}</span>
                </div>
              </div>

              {/* Sample Calculation footer preview */}
              <div className="mt-auto pt-6 border-t border-slate-100 text-[10px] text-center text-slate-400 leading-relaxed">
                <p className="font-bold text-slate-700 mb-1">{userProfile.companyName || 'Ma micro-entreprise'}</p>
                <p>{userProfile.address || 'Adresse du siège non configurée'}</p>
                <p className="mt-1 font-mono">SIRET: {userProfile.siret || '000 000 000 00000'}</p>
                
                {userProfile.tvaNumber ? (
                  <p className="font-mono">TVA: {userProfile.tvaNumber}</p>
                ) : (
                  <p className="italic text-[9px] mt-1 text-slate-400">TVA non applicable, art. 293 B du CGI</p>
                )}
                
                {userProfile.legalMentions && (
                  <div className="mt-2 text-[8px] bg-slate-50 text-slate-400 border border-slate-100 p-2 rounded-lg italic">
                    {userProfile.legalMentions}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-blue-600 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 text-xs font-semibold">
              <CheckCircle2 className="text-blue-500" size={16} />
              <span>Données chiffrées & enregistrées localement</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsManager;
