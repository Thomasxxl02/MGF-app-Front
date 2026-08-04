use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Company {
    pub id: String,
    pub company_name: String,
    pub trade_name: Option<String>,
    pub siren: String,
    pub siret: String,
    pub tva_number: Option<String>,
    pub address: String,
    pub postal_code: String,
    pub city: String,
    pub country: String,
    pub email: String,
    pub phone: String,
    pub website: Option<String>,
    pub bank_account: Option<String>,
    pub iban: Option<String>,
    pub bic: Option<Option<String>>,
    pub logo: Option<String>,
    pub currency: String,
    pub payment_terms: Option<String>,
    pub payment_delay_days: i32,
    pub invoice_prefix: String,
    pub quote_prefix: String,
    pub theme_color: String,
    pub has_professional_insurance: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub legal_name: Option<String>,
    pub siret: Option<String>,
    pub vat_number: Option<String>,
    pub email: String,
    pub phone: Option<String>,
    pub address: String,
    pub postal_code: String,
    pub city: String,
    pub country: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub vat_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: String,
    pub company_id: String,
    pub client_id: String,
    pub document_type: String, // "quote", "invoice", "credit_note", "order"
    pub number: String,
    pub date: String,
    pub due_date: String,
    pub status: String,
    pub items: Vec<InvoiceItem>,
    pub notes: Option<String>,
    pub discount: f64,
    pub shipping: f64,
    pub deposit: f64,
    pub payment_method: String,
    pub vat_rate: f64,
    pub custom_legal_mentions: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
