
export type DocumentType = 'invoice' | 'quote' | 'order' | 'credit_note';

export enum InvoiceStatus {
  DRAFT = 'Brouillon',
  SENT = 'Envoyée',
  PAID = 'Payée',
  CANCELLED = 'Annulée',
  // Status spécifiques aux devis
  ACCEPTED = 'Accepté',
  REJECTED = 'Refusé'
}

export interface Client {
  id: string;
  companyId?: string; // Rattachement à une entreprise
  name: string;
  email: string;
  address: string;
  siret?: string;
  phone?: string;
  notes?: string; // Nouveau champ pour notes internes
  archived?: boolean; // Nouveau champ pour l'archivage
  tvaNumber?: string; // Numéro de TVA intracommunautaire du client
  website?: string; // Site internet du client
  contactName?: string; // Interlocuteur principal
  paymentDelayDays?: number; // Délai de règlement négocié
  category?: 'individual' | 'b2b' | 'public'; // Catégorie (Art. 293 B ou public Chorus)
}

export interface Supplier {
  id: string;
  companyId?: string; // Rattachement à une entreprise
  name: string;
  email?: string;
  phone?: string;
  siret?: string;
  address?: string;
  category?: string; // ex: "Matériel", "Logiciel", "Assurance"
  notes?: string; // Nouveau champ pour notes internes
  tvaNumber?: string; // Numéro de TVA intracommunautaire du fournisseur
  website?: string; // Site internet du fournisseur
  contactName?: string; // Interlocuteur principal
  iban?: string; // Coordonnées bancaires IBAN
  bic?: string; // Code BIC
  paymentDelayDays?: number; // Délai de règlement pratiqué (jours)
  archived?: boolean; // Statut d'archivage
}

export interface Product {
  id: string;
  companyId?: string; // Rattachement à une entreprise
  name: string;
  description: string;
  price: number;
  type: 'service' | 'product';
  reference?: string; // Référence catalogue ou SKU
  vatRate?: number; // Taux de TVA par défaut (ex: 20, 10, 5.5, 0)
  purchasePrice?: number; // Prix d'achat / coût de revient
  unit?: string; // Unité (ex: heure, jour, unité, forfait, m²)
  category?: string; // Catégorie d'article (ex: Matériel, Conseil, Abonnement)
  stockQuantity?: number; // Quantité en stock
  trackStock?: boolean; // Activer le suivi de stock
}

export interface Expense {
  id: string;
  companyId?: string; // Rattachement à une entreprise
  date: string;
  description: string;
  amount: number;
  category: string;
  supplierId?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  companyId?: string; // Rattachement à une entreprise
  type: DocumentType; 
  number: string;
  linkedDocumentId?: string; // ID du document parent (ex: Facture pour un Avoir)
  date: string;
  dueDate: string;
  clientId: string;
  items: InvoiceItem[];
  status: string; // Changé de InvoiceStatus à string pour permettre la personnalisation
  notes?: string;
  total: number;
  reminderDate?: string; // Nouveau champ pour les rappels
  
  // Nouveaux champs logiques métiers
  discount?: number; // Pourcentage de remise globale (0-100)
  shipping?: number; // Frais de port / déplacement
  deposit?: number; // Montant de l'acompte déjà versé ou demandé

  // Nouveaux champs de conformité Facturation Électronique 2026 (Format Mixte/Factur-X)
  operationType?: 'goods' | 'services' | 'mixed';
  vatOption?: 'debits' | 'encaissements';
  deliveryAddress?: string;
  paymentMethod?: 'transfer' | 'card' | 'check' | 'cash' | 'direct_debit';
  vatRate?: number; // Pourcentage de TVA (ex: 20, 10, 5.5, 2.1, 0)
  transmissionStatus?: 'draft' | 'transmitted' | 'received' | 'accepted' | 'rejected' | 'paid_declared';
  customThemeColor?: 'blue' | 'emerald' | 'violet' | 'amber' | 'neutral'; // Tonalité personnalisée pour cette pièce
  customTitle?: string; // Titre personnalisé du document (ex: Facture Proforma, Proposition)
  customLogo?: string; // Sceau/Émoticône spécifique pour cette pièce
  customLegalMentions?: string; // Mentions bas de page ou d'exonération spécifiques
  cgv?: string; // Conditions générales de vente
  customSubtitle?: string; // Sous-titre ou Slogan publicitaire/commercial
  customSignatory?: string; // Nom ou fonction de la personne signataire pour cette pièce
  hideVatColumn?: boolean; // Option pour masquer s'il y a lieu la colonne TVA sur le tableau de la pièce
  customBannerStyle?: 'gradient' | 'minimal' | 'bordered'; // Style d'en-tête de page pour le document
  customVatReason?: string; // Clause d'exonération prédéfinie ou taux dérogatoire spécifique
  auditHash?: string; // Empreinte cryptographique SHA-256 (Inviolabilité fiscale & Piste d'audit fiable)
  previousAuditHash?: string; // Chaînage cryptographique avec le document précédent
  recurrence?: {
    frequency: 'monthly' | 'quarterly' | 'yearly';
    nextDate: string;
    active: boolean;
    lastGenerated?: string;
  };
  dunningHistory?: Array<{
    id: string;
    date: string;
    level: 'courtois' | 'ferme' | 'mise_en_demeure';
    penaltyAmount: number;
    recoveryFeeApplied: boolean;
    notes?: string;
  }>;
}

export interface UserProfile {
  companyName: string;
  siret: string;
  address: string;
  email: string;
  phone: string;
  website?: string;
  bankAccount?: string; // IBAN short
  bic?: string; // BIC Code
  tvaNumber?: string; // Numéro TVA Intracom
  legalStatus?: string; // ex: EI, SASU, SARL, EURL
  capitalSocial?: string; // ex: 1000 €
  activitySector?: string; // ex: Conseil pour les affaires, Conseil IT
  rcsRegistry?: string; // ex: RCS Lyon, Greffe de Paris
  vatRegime?: 'franchise' | 'simplified' | 'normal'; // Régime fiscal
  legalMentions?: string; // Mentions spécifiques bas de page
  activityType?: 'services_liberal' | 'services_commercial' | 'sales' | 'custom';
  customChargesRate?: number; // Taux de cotisations sociales personnalisé (%)
  customVatThreshold?: number; // Seuil personnalisé de franchise de TVA
  autoVatThreshold?: boolean; // Calcul automatique du seuil TVA (Art. 293 B)
  customCaThreshold?: number; // Seuil de chiffre d'affaires max (micro-entreprise)
  autoCaThreshold?: boolean; // Calcul automatique du seuil CA max
  vatFranchiseArt293B?: boolean; // Franchise en base activée (Art. 293 B du CGI)
  defaultVatRate?: number; // Taux de TVA par défaut (si assujetti)
  
  // Assurance Décennale / Responsabilité Civile Professionnelle
  hasProfessionalInsurance?: boolean; // Activer l'assurance professionnelle
  insuranceCompanyName?: string; // Nom de l'assureur
  insuranceContractNumber?: string; // Numéro de contrat
  insuranceCoverageArea?: string; // Zone de couverture (ex: France entière)
  insuranceDetails?: string; // Garanties spécifiques (ex: Décennale Bâtiment)

  // Options fiscales avancées
  hasVli?: boolean; // Option pour le versement libératoire de l'impôt (VLI)
  hasAcre?: boolean; // Bénéficiaire de l'ACRE
  acreStartDate?: string; // Date de début ACRE / immatriculation

  // Calendrier fiscal personnalisé
  fiscalDeclarationPeriodicity?: 'monthly' | 'quarterly'; // Périodicité (Mensuelle / Trimestrielle)

  currencySymbol?: string; // Symbole monétaire
  invoicePrefix?: string; // Préfixe factures
  quotePrefix?: string; // Préfixe devis
  paymentDelayDays?: number; // Délai de paiement par défaut (en jours)
  // Configuration pour le Portail Public de Facturation (PPF / Chorus 2026)
  ppfEnvironment?: 'sandbox' | 'production' | 'simulated';
  ppfClientId?: string;
  ppfClientSecret?: string;
  ppfCertificateName?: string;
  ppfAutoSyncDirectory?: boolean;
  ppfPreferredFramework?: 'ppf_direct' | 'pdp' | 'od';
  ppfPdpSiret?: string; // SIRET de la PDP partenaire choisie
  // Configuration de l'Assistant IA
  aiTone?: 'professional' | 'pedagogical' | 'concise' | 'creative';
  aiCustomInstructions?: string;
  aiIncludeContext?: boolean;
  aiModel?: string;
  aiApiKey?: string;
  aiGeminiApiKey?: string;
  aiAnthropicApiKey?: string;
  aiMistralApiKey?: string;
  themeColor?: 'blue' | 'emerald' | 'violet' | 'amber' | 'neutral';
  logoUrl?: string;
  darkMode?: boolean;
  defaultView?: ViewState;
  cgv?: string;
}

export interface SecureDocument {
  id: string;
  name: string;
  category: 'invoice_quote' | 'expense_receipt' | 'administrative' | 'other';
  uploadDate: string;
  size: string;
  fileType: string;
  notes?: string;
  fileData?: string; // base64 string
  linkedInvoiceId?: string;
  linkedExpenseId?: string;
}

export interface Company {
  id: string;
  companyName: string; // raison sociale
  tradeName?: string; // nom commercial
  siren?: string; // SIREN
  siret: string; // SIRET
  tvaNumber?: string; // numéro de TVA intracommunautaire
  address: string; // adresse
  postalCode: string; // code postal
  city: string; // ville
  country: string; // pays
  email: string; // email
  phone: string; // téléphone
  website?: string; // site web
  bankAccount?: string; // coordonnées bancaires
  iban?: string; // IBAN
  bic?: string; // BIC
  logo?: string; // logo
  currency: string; // devise (ex: EUR)
  paymentTerms?: string; // conditions de paiement par défaut
  paymentDelayDays?: number; // délai de paiement
  invoicePrefix?: string; // préfixe de numérotation pour factures
  quotePrefix?: string; // préfixe de numérotation pour devis
  themeColor?: 'blue' | 'emerald' | 'violet' | 'amber' | 'neutral';
  createdAt: string; // date de création
  updatedAt: string; // date de modification
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export type ViewState = 'dashboard' | 'invoices' | 'clients' | 'suppliers' | 'products' | 'accounting' | 'settings' | 'ppf' | 'ai_assistant' | 'documents' | 'companies';