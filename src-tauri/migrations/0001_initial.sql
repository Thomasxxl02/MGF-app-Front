-- ====================================================================
-- MIGRATION 0001_initial.sql
-- Description : Initialisation du schéma SQLite transactionnel professionnel
-- ====================================================================

-- 1. Activation globale des clés étrangères pour garantir l'intégrité référentielle
PRAGMA foreign_keys = ON;

-- 2. Table des entreprises (multi-sociétés étanche)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY NOT NULL,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    siren TEXT NOT NULL UNIQUE CHECK(length(siren) = 9),
    siret TEXT NOT NULL UNIQUE CHECK(length(replace(siret, ' ', '')) = 14),
    tva_number TEXT,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    website TEXT,
    bank_account TEXT,
    iban TEXT,
    bic TEXT,
    logo TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    payment_terms TEXT,
    payment_delay_days INTEGER NOT NULL DEFAULT 30 CHECK(payment_delay_days >= 0),
    invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
    quote_prefix TEXT NOT NULL DEFAULT 'DEV',
    theme_color TEXT NOT NULL DEFAULT 'blue',
    has_professional_insurance INTEGER NOT NULL DEFAULT 0 CHECK(has_professional_insurance IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Index pour accélérer les recherches sur l'adresse email de connexion
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);

-- 3. Table des tiers / clients (liée à une entreprise)
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    legal_name TEXT,
    siret TEXT CHECK(siret IS NULL OR length(replace(siret, ' ', '')) = 14),
    vat_number TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Index pour isoler les clients par entreprise rattachée
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- 4. Table des factures et devis (isolée par entreprise et liée à un client)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK(document_type IN ('quote', 'invoice', 'credit_note', 'order')),
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes TEXT,
    discount REAL NOT NULL DEFAULT 0.0 CHECK(discount >= 0.0 AND discount <= 100.0),
    shipping REAL NOT NULL DEFAULT 0.0 CHECK(shipping >= 0.0),
    deposit REAL NOT NULL DEFAULT 0.0 CHECK(deposit >= 0.0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('bank_transfer', 'card', 'check', 'cash', 'direct_debit')),
    vat_rate REAL NOT NULL DEFAULT 20.0 CHECK(vat_rate >= 0.0),
    custom_legal_mentions TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    -- Contrainte d'unicité absolue du numéro de facture par entreprise
    UNIQUE(company_id, number)
);

-- Index d'isolation et d'unicité pour les recherches multicritères rapides
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);

-- 5. Lignes de détail de la facture
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity >= 0.0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0.0),
    vat_rate REAL NOT NULL DEFAULT 20.0 CHECK(vat_rate >= 0.0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Index pour lier rapidement les lignes de factures à l'en-tête
CREATE INDEX IF NOT EXISTS idx_invoice_items_header ON invoice_items(invoice_id);
