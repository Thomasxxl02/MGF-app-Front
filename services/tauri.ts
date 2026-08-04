import { Invoice, Client, Supplier, Product, Expense, UserProfile, DocumentType, Company } from '../types';

/**
 * Custom Error class mirroring the Rust `AppError` enum:
 * - Database: Database-related errors.
 * - Validation: Validation failed.
 * - NotFound: Item not found.
 * - BusinessRule: Business logic / status transition rule violation.
 */
export class TauriAppError extends Error {
  type: 'Database' | 'Validation' | 'NotFound' | 'BusinessRule';

  constructor(type: 'Database' | 'Validation' | 'NotFound' | 'BusinessRule', message: string) {
    super(message);
    this.name = 'TauriAppError';
    this.type = type;
  }
}

// Check if we are running in the native Tauri desktop environment
const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
};

// Simple helper to invoke Tauri commands if available, otherwise fallback
async function safeInvoke<T>(command: string, args?: Record<string, any>): Promise<T> {
  if (isTauriAvailable()) {
    const tauri = (window as any).__TAURI__;
    if (tauri.core && typeof tauri.core.invoke === 'function') {
      return tauri.core.invoke(command, args);
    } else if (typeof (window as any).__TAURI_IPC__ === 'function') {
      return (window as any).invoke(command, args);
    }
  }
  throw new Error('Tauri is not available. Using fallback simulation.');
}

// --- FALLBACK IN-MEMORY / LOCAL STORAGE DATABASE ENGINE (MOCKS RUST BACKEND) ---
// This acts as the "Rust backend & SQLite Database" in the browser preview.
const getActiveUserEmail = (): string => {
  return localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email') || 'default_user';
};

const getCompaniesDbKey = (): string => {
  const email = getActiveUserEmail();
  return `autogest_${email.replace(/[@.]/g, '_')}_companies`;
};

export function getActiveCompanyId(): string {
  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const activeId = localStorage.getItem(`autogest_${cleanEmail}_active_company_id`);
  if (activeId) return activeId;

  // Otherwise, get first company from companies list
  const companiesStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
  const companies = companiesStr ? JSON.parse(companiesStr) : [];
  if (companies.length > 0) {
    localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, companies[0].id);
    return companies[0].id;
  }
  
  // Seed default company if empty
  const defaultId = 'co_default_123';
  const defaultCompany: Company = {
    id: defaultId,
    companyName: 'Ma Micro-Entreprise',
    tradeName: 'Ma Micro-Entreprise',
    siren: '123456789',
    siret: '123 456 789 00012',
    tvaNumber: 'FR89123456789',
    address: '123 Avenue de la République',
    postalCode: '75001',
    city: 'Paris',
    country: 'France',
    email: email,
    phone: '01 02 03 04 05',
    website: 'https://mon-entreprise.fr',
    bankAccount: 'FR76 1234 5678 9012 3456 7890 123',
    iban: 'FR76 1234 5678 9012 3456 7890 123',
    bic: 'TRNFR2BXXX',
    logo: '',
    currency: 'EUR',
    paymentTerms: 'Règlement à réception',
    paymentDelayDays: 30,
    invoicePrefix: 'FAC',
    quotePrefix: 'DEV',
    themeColor: 'blue',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify([defaultCompany]));
  localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, defaultId);
  return defaultId;
}

const getDbPrefix = (): string => {
  const email = getActiveUserEmail();
  const activeCompanyId = getActiveCompanyId();
  return `autogest_${email.replace(/[@.]/g, '_')}_${activeCompanyId}`;
};

const getLocalCollection = <T>(keySuffix: string): T[] => {
  const data = localStorage.getItem(`${getDbPrefix()}_${keySuffix}`);
  return data ? JSON.parse(data) : [];
};

const saveLocalCollection = <T>(keySuffix: string, items: T[]): void => {
  localStorage.setItem(`${getDbPrefix()}_${keySuffix}`, JSON.stringify(items));
};

// --- TAURI COMMMANDS SERVICES LAYER ---

/**
 * 1. Initialisation de la base de données
 * Simulates connection to SQLite and migration running.
 */
export async function initializeDatabase(): Promise<void> {
  if (isTauriAvailable()) {
    return safeInvoke<void>('initialize_database');
  }
  
  // Simulate delay for database connection and running migration scripts
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log('Rust Backend: Connection to SQLite established. All migrations (0001_initial.sql, etc.) executed successfully.');
}

/**
 * 2. Gestion des Entreprises (Company Profiles)
 */
export async function getCompanies(): Promise<Company[]> {
  if (isTauriAvailable()) {
    return safeInvoke<Company[]>('get_companies');
  }
  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const companiesStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
  const list = companiesStr ? JSON.parse(companiesStr) : [];
  if (list.length === 0) {
    getActiveCompanyId(); // triggers seeding default
    const reloadedStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
    return reloadedStr ? JSON.parse(reloadedStr) : [];
  }
  return list;
}

export async function createCompany(companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
  if (isTauriAvailable()) {
    return safeInvoke<Company>('create_company', { company: companyData });
  }

  if (!companyData.companyName.trim()) {
    throw new TauriAppError('Validation', 'Le nom de l\'entreprise (raison sociale) est obligatoire.');
  }
  if (!companyData.siret.trim().replace(/\s/g, '')) {
    throw new TauriAppError('Validation', 'Le SIRET de l\'entreprise est obligatoire.');
  }

  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const companies = await getCompanies();
  
  const cleanSiret = companyData.siret.replace(/\s/g, '');
  if (companies.some(c => c.siret.replace(/\s/g, '') === cleanSiret)) {
    throw new TauriAppError('BusinessRule', `Une entreprise avec le SIRET ${companyData.siret} existe déjà.`);
  }

  const newCompany: Company = {
    ...companyData,
    id: `co_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  companies.push(newCompany);
  localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify(companies));
  return newCompany;
}

export async function updateCompany(company: Company): Promise<Company> {
  if (isTauriAvailable()) {
    return safeInvoke<Company>('update_company', { company });
  }

  if (!company.companyName.trim()) {
    throw new TauriAppError('Validation', 'Le nom de l\'entreprise (raison sociale) est obligatoire.');
  }
  if (!company.siret.trim().replace(/\s/g, '')) {
    throw new TauriAppError('Validation', 'Le SIRET est obligatoire.');
  }

  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const companies = await getCompanies();
  const index = companies.findIndex(c => c.id === company.id);
  if (index === -1) {
    throw new TauriAppError('NotFound', 'Entreprise introuvable.');
  }

  const cleanSiret = company.siret.replace(/\s/g, '');
  const isDuplicate = companies.some(c => c.id !== company.id && c.siret.replace(/\s/g, '') === cleanSiret);
  if (isDuplicate) {
    throw new TauriAppError('BusinessRule', `Une autre entreprise utilise déjà le SIRET ${company.siret}.`);
  }

  const updatedCompany = {
    ...company,
    updatedAt: new Date().toISOString()
  };
  
  companies[index] = updatedCompany;
  localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify(companies));

  if (company.id === getActiveCompanyId()) {
    const profile = await getCompanyProfile();
    saveLocalCollection('profile', [profile]);
  }

  return updatedCompany;
}

export async function deleteCompany(companyId: string): Promise<void> {
  if (isTauriAvailable()) {
    return safeInvoke<void>('delete_company', { companyId });
  }

  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const companies = await getCompanies();
  if (companies.length <= 1) {
    throw new TauriAppError('BusinessRule', 'Impossible de supprimer la seule entreprise restante. Vous devez conserver au moins une entreprise active.');
  }

  const index = companies.findIndex(c => c.id === companyId);
  if (index === -1) {
    throw new TauriAppError('NotFound', 'Entreprise introuvable.');
  }

  const filteredCompanies = companies.filter(c => c.id !== companyId);
  localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify(filteredCompanies));

  // Clean up all data keys isolated under this company id to prevent storage leaks
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_invoices`);
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_clients`);
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_suppliers`);
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_products`);
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_expenses`);
  localStorage.removeItem(`autogest_${cleanEmail}_${companyId}_profile`);

  if (companyId === getActiveCompanyId()) {
    const nextCompany = filteredCompanies[0];
    localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, nextCompany.id);
    const profile = await getCompanyProfile();
    saveLocalCollection('profile', [profile]);
  }
}

export async function selectActiveCompany(companyId: string): Promise<Company> {
  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const companies = await getCompanies();
  const company = companies.find(c => c.id === companyId);
  if (!company) {
    throw new TauriAppError('NotFound', 'Entreprise introuvable.');
  }
  localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, companyId);
  
  const profile = await getCompanyProfile();
  saveLocalCollection('profile', [profile]);

  return company;
}

export async function getCompanyProfile(): Promise<UserProfile> {
  if (isTauriAvailable()) {
    return safeInvoke<UserProfile>('get_company_profile');
  }

  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const activeId = getActiveCompanyId();
  const companiesStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
  const companies = companiesStr ? JSON.parse(companiesStr) : [];
  const activeCompany = companies.find((c: any) => c.id === activeId) || companies[0];
  
  if (!activeCompany) {
    return {
      companyName: 'Ma Micro-Entreprise',
      siret: '123 456 789 00012',
      address: '123 Avenue de la République, 75001 Paris',
      email: getActiveUserEmail(),
      phone: '01 02 03 04 05',
      bankAccount: 'FR76 1234 5678 9012 3456 7890 123',
      activityType: 'services_liberal',
      vatRegime: 'franchise',
      autoVatThreshold: true,
      autoCaThreshold: true,
      vatFranchiseArt293B: true,
      defaultVatRate: 20,
      hasProfessionalInsurance: false,
      hasVli: false,
      hasAcre: false,
      fiscalDeclarationPeriodicity: 'monthly',
      themeColor: 'blue',
      darkMode: false
    };
  }

  return {
    companyName: activeCompany.companyName,
    siret: activeCompany.siret,
    address: `${activeCompany.address}, ${activeCompany.postalCode} ${activeCompany.city}, ${activeCompany.country}`,
    email: activeCompany.email,
    phone: activeCompany.phone,
    website: activeCompany.website,
    bankAccount: activeCompany.bankAccount || activeCompany.iban,
    bic: activeCompany.bic,
    tvaNumber: activeCompany.tvaNumber,
    themeColor: activeCompany.themeColor || 'blue',
    invoicePrefix: activeCompany.invoicePrefix || 'FAC',
    quotePrefix: activeCompany.quotePrefix || 'DEV',
    paymentDelayDays: activeCompany.paymentDelayDays || 30,
    currencySymbol: activeCompany.currency === 'USD' ? '$' : activeCompany.currency === 'GBP' ? '£' : '€',
    activityType: 'services_liberal',
    vatRegime: 'normal',
    defaultVatRate: 20,
    darkMode: false
  };
}

export async function updateCompanyProfile(profile: UserProfile): Promise<UserProfile> {
  if (isTauriAvailable()) {
    return safeInvoke<UserProfile>('update_company_profile', { profile });
  }

  if (!profile.companyName.trim()) {
    throw new TauriAppError('Validation', 'Le nom de l\'entreprise est requis.');
  }
  if (!profile.siret.trim().replace(/\s/g, '')) {
    throw new TauriAppError('Validation', 'Le numéro SIRET est obligatoire et doit être valide.');
  }

  const email = getActiveUserEmail();
  const cleanEmail = email.replace(/[@.]/g, '_');
  const activeId = getActiveCompanyId();
  const companies = await getCompanies();
  const index = companies.findIndex(c => c.id === activeId);
  
  if (index !== -1) {
    const updatedCompany: Company = {
      ...companies[index],
      companyName: profile.companyName,
      siret: profile.siret,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      bankAccount: profile.bankAccount,
      iban: profile.bankAccount,
      bic: profile.bic,
      tvaNumber: profile.tvaNumber,
      themeColor: profile.themeColor,
      invoicePrefix: profile.invoicePrefix,
      quotePrefix: profile.quotePrefix,
      paymentDelayDays: profile.paymentDelayDays,
      updatedAt: new Date().toISOString()
    };
    companies[index] = updatedCompany;
    localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify(companies));
  }
  
  saveLocalCollection('profile', [profile]);
  return profile;
}

/**
 * 3. Gestion des Clients (Tiers)
 */
export async function getClients(): Promise<Client[]> {
  if (isTauriAvailable()) {
    return safeInvoke<Client[]>('get_clients');
  }
  return getLocalCollection<Client>('clients');
}

export async function createClient(client: Omit<Client, 'id'>): Promise<Client> {
  if (isTauriAvailable()) {
    return safeInvoke<Client>('create_client', { client });
  }

  // Rust side validation
  if (!client.name.trim()) {
    throw new TauriAppError('Validation', 'Le nom du client est requis.');
  }
  if (!client.email.trim() || !client.email.includes('@')) {
    throw new TauriAppError('Validation', 'Une adresse email valide est requise pour le client.');
  }

  const clients = getLocalCollection<Client>('clients');
  
  // SIRET unique validation on Rust side
  if (client.siret && client.siret.trim()) {
    const cleanSiret = client.siret.replace(/\s/g, '');
    const exists = clients.some(c => c.siret?.replace(/\s/g, '') === cleanSiret);
    if (exists) {
      throw new TauriAppError('BusinessRule', `Le SIRET ${client.siret} est déjà associé à un autre client.`);
    }
  }

  const newClient: Client = {
    ...client,
    id: `cli_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  };

  clients.push(newClient);
  saveLocalCollection('clients', clients);
  return newClient;
}

export async function updateClient(client: Client): Promise<Client> {
  if (isTauriAvailable()) {
    return safeInvoke<Client>('update_client', { client });
  }

  if (!client.name.trim()) {
    throw new TauriAppError('Validation', 'Le nom du client est requis.');
  }

  const clients = getLocalCollection<Client>('clients');
  const index = clients.findIndex(c => c.id === client.id);
  if (index === -1) {
    throw new TauriAppError('NotFound', 'Client introuvable.');
  }

  clients[index] = client;
  saveLocalCollection('clients', clients);
  return client;
}

export async function deleteClient(clientId: string): Promise<void> {
  if (isTauriAvailable()) {
    return safeInvoke<void>('delete_client', { clientId });
  }

  // Business Rule check on Rust: cannot delete client with active invoices
  const invoices = getLocalCollection<Invoice>('invoices');
  const hasInvoices = invoices.some(inv => inv.clientId === clientId);
  if (hasInvoices) {
    throw new TauriAppError('BusinessRule', 'Impossible de supprimer ce client car des factures ou devis lui sont associés. Veuillez d\'abord archiver ou supprimer les documents correspondants.');
  }

  const clients = getLocalCollection<Client>('clients');
  const filtered = clients.filter(c => c.id !== clientId);
  saveLocalCollection('clients', filtered);
}

/**
 * 4. Gestion des Factures, Devis, Commandes et Avoirs
 */
export async function getInvoices(): Promise<Invoice[]> {
  if (isTauriAvailable()) {
    return safeInvoke<Invoice[]>('get_invoices');
  }
  return getLocalCollection<Invoice>('invoices');
}

/**
 * Generates sequential document numbers transactionally on the Rust backend
 */
export function generateDocumentNumber(type: DocumentType, companyPrefix: string, year: number, count: number): string {
  const pfx = companyPrefix || (type === 'invoice' ? 'FAC' : type === 'quote' ? 'DEV' : type === 'credit_note' ? 'AVR' : 'BC');
  const formattedCount = String(count).padStart(6, '0');
  return `${pfx}-${year}-${formattedCount}`;
}

/**
 * Core business logic: CREATE INVOICE (Done on Rust side)
 * Handles input validation, automatic sequencial number generation, subtotal & taxes computation,
 * currency conversions, state management, and saving transactionally.
 */
export async function createInvoice(invoiceData: Partial<Invoice>): Promise<Invoice> {
  if (isTauriAvailable()) {
    return safeInvoke<Invoice>('create_invoice', { invoice: invoiceData });
  }

  // 1. Rust validation checks
  if (!invoiceData.clientId) {
    throw new TauriAppError('Validation', 'Un client valide doit être sélectionné.');
  }
  if (!invoiceData.items || invoiceData.items.length === 0) {
    throw new TauriAppError('Validation', 'Le document doit contenir au moins une ligne.');
  }

  // Validate items
  for (const item of invoiceData.items) {
    if (!item.description.trim()) {
      throw new TauriAppError('Validation', 'Toutes les lignes doivent avoir une description.');
    }
    if (item.quantity <= 0) {
      throw new TauriAppError('Validation', 'La quantité doit être supérieure à zéro.');
    }
    if (item.unitPrice < 0) {
      throw new TauriAppError('Validation', 'Le prix unitaire ne peut pas être négatif.');
    }
  }

  // 2. Load existing collection inside transaction lock
  const invoices = getLocalCollection<Invoice>('invoices');
  const companyProfile = await getCompanyProfile();

  // 3. Sequential Number Generation (Transactional SQLite simulation)
  const currentYear = new Date(invoiceData.date || Date.now()).getFullYear();
  const type = invoiceData.type || 'invoice';
  
  // Count matching documents for current year & type to guarantee sequentially
  const sameTypeCount = invoices.filter(
    inv => inv.type === type && new Date(inv.date).getFullYear() === currentYear
  ).length;

  const prefix = type === 'invoice' ? (companyProfile.invoicePrefix || 'FAC') : (companyProfile.quotePrefix || 'DEV');
  const generatedNum = generateDocumentNumber(type, prefix, currentYear, sameTypeCount + 1);

  // Avoid duplicates collision checks
  if (invoices.some(inv => inv.number === generatedNum)) {
    throw new TauriAppError('Database', `Collision détectée pour le numéro ${generatedNum}. La transaction a été annulée.`);
  }

  // 4. Critical monetary calculations (strictly side-effects on "Rust side" using precise arithmetic)
  // We represent cents by rounding to 2 decimals to bypass floats precision issues in standard JS
  const calculatedItems = invoiceData.items.map(item => {
    const itemSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    return {
      ...item,
      subtotal: itemSubtotal
    };
  });

  const rawSubtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountRate = invoiceData.discount || 0;
  const discountVal = Math.round(rawSubtotal * (discountRate / 100) * 100) / 100;
  
  const totalHT = Math.round((rawSubtotal - discountVal + (invoiceData.shipping || 0)) * 100) / 100;
  const vatRate = invoiceData.vatRate !== undefined ? invoiceData.vatRate : 0;
  const vatAmount = Math.round(totalHT * (vatRate / 100) * 100) / 100;
  const totalTTC = Math.round((totalHT + vatAmount) * 100) / 100;

  const deposit = invoiceData.deposit || 0;
  const dueAmount = Math.max(0, Math.round((totalTTC - deposit) * 100) / 100);

  // 5. Compose finalized structure
  const finalInvoice: Invoice = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type,
    number: generatedNum,
    clientId: invoiceData.clientId,
    date: invoiceData.date || new Date().toISOString().split('T')[0],
    dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: invoiceData.status || 'Brouillon',
    items: calculatedItems,
    notes: invoiceData.notes || '',
    total: totalTTC, // Final total TTC
    discount: discountRate,
    shipping: invoiceData.shipping || 0,
    deposit,
    operationType: invoiceData.operationType || 'services',
    vatOption: invoiceData.vatOption || 'encaissements',
    deliveryAddress: invoiceData.deliveryAddress || '',
    paymentMethod: invoiceData.paymentMethod || 'transfer',
    vatRate,
    transmissionStatus: invoiceData.transmissionStatus || 'draft',
    customThemeColor: invoiceData.customThemeColor,
    customTitle: invoiceData.customTitle,
    customLogo: invoiceData.customLogo,
    customLegalMentions: invoiceData.customLegalMentions,
    customSubtitle: invoiceData.customSubtitle,
    customSignatory: invoiceData.customSignatory,
    cgv: invoiceData.cgv,
    hideVatColumn: invoiceData.hideVatColumn,
    customBannerStyle: invoiceData.customBannerStyle,
    customVatReason: invoiceData.customVatReason,
    recurrence: invoiceData.recurrence
  };

  invoices.push(finalInvoice);
  saveLocalCollection('invoices', invoices);
  return finalInvoice;
}

/**
 * Update document status with strict state machine validation
 */
export async function updateInvoiceStatus(invoiceId: string, newStatus: string): Promise<Invoice> {
  if (isTauriAvailable()) {
    return safeInvoke<Invoice>('update_invoice_status', { invoiceId, status: newStatus });
  }

  const invoices = getLocalCollection<Invoice>('invoices');
  const index = invoices.findIndex(i => i.id === invoiceId);
  if (index === -1) {
    throw new TauriAppError('NotFound', 'Document introuvable.');
  }

  const currentInvoice = invoices[index];
  const oldStatus = currentInvoice.status;

  // Implements strict workflow state transition logic on Rust side:
  // Brouillon -> Envoyée -> Payée
  // Brouillon -> Annulée
  // Envoyée -> Retard
  // Retard -> Payée
  if (oldStatus === 'Annulée' && newStatus !== 'Annulée') {
    throw new TauriAppError('BusinessRule', 'Impossible de modifier le statut d\'un document déjà annulé.');
  }
  if (oldStatus === 'Payée' && newStatus !== 'Payée') {
    throw new TauriAppError('BusinessRule', 'Une facture marquée comme "Payée" ne peut pas être modifiée afin de garantir la traçabilité comptable.');
  }

  currentInvoice.status = newStatus;
  
  // Auto update transmission status
  if (newStatus === 'Envoyée') {
    currentInvoice.transmissionStatus = 'transmitted';
  } else if (newStatus === 'Payée') {
    currentInvoice.transmissionStatus = 'paid_declared';
  }

  invoices[index] = currentInvoice;
  saveLocalCollection('invoices', invoices);
  return currentInvoice;
}

/**
 * Document deletion
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  if (isTauriAvailable()) {
    return safeInvoke<void>('delete_invoice', { invoiceId });
  }

  const invoices = getLocalCollection<Invoice>('invoices');
  const index = invoices.findIndex(i => i.id === invoiceId);
  if (index === -1) {
    throw new TauriAppError('NotFound', 'Document introuvable.');
  }

  const currentInvoice = invoices[index];
  
  // Rule check on Rust: validated/sent invoices must never be deleted!
  if (currentInvoice.status !== 'Brouillon') {
    throw new TauriAppError('BusinessRule', 'Pour être en conformité avec la réglementation, vous ne pouvez pas supprimer une facture qui a déjà été envoyée ou payée. Veuillez plutôt l\'annuler ou émettre un avoir.');
  }

  const filtered = invoices.filter(i => i.id !== invoiceId);
  saveLocalCollection('invoices', filtered);
}

/**
 * 5. PDF Generation & Exporting Services
 * Executes Rust-based file/buffer generation
 */
export async function generatePdfBuffer(invoiceId: string): Promise<ArrayBuffer> {
  if (isTauriAvailable()) {
    return safeInvoke<ArrayBuffer>('generate_pdf_buffer', { invoiceId });
  }

  // Simulate PDF compilation side-effects
  await new Promise(r => setTimeout(r, 400));
  return new ArrayBuffer(8); // returns dummy buffer
}

export async function exportToCsv(dataType: 'invoices' | 'clients' | 'accounting'): Promise<string> {
  if (isTauriAvailable()) {
    return safeInvoke<string>('export_to_csv', { dataType });
  }

  const data = getLocalCollection(dataType === 'accounting' ? 'expenses' : dataType);
  if (data.length === 0) {
    throw new TauriAppError('Validation', 'Aucune donnée à exporter.');
  }

  // Generate real CSV formatted string
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map((item: any) => 
    Object.values(item).map(val => {
      const cell = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${cell.replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [headers, ...rows].join('\n');
}
