use crate::models::{Invoice, Client, Company};
use crate::errors::AppError;
use crate::services::InvoiceService;

/// Service for Factur-X / ZUGFeRD 2.2 hybrid electronic invoice generation
/// Compliant with European standard EN 16931 and UN/CEFACT Cross Industry Invoice (CII).
pub struct FacturXService;

impl FacturXService {
    /// Generates a valid Factur-X CII XML document (BASIC profile)
    pub fn generate_cii_xml(
        company: &Company,
        invoice: &Invoice,
        client: &Client,
    ) -> Result<String, AppError> {
        let (subtotal_cents, discount_cents, total_ht_cents, vat_cents, total_ttc_cents, due_cents) =
            InvoiceService::calculate_totals(
                &invoice.items,
                invoice.discount,
                invoice.shipping,
                invoice.deposit,
            )?;

        let total_ht_eur = format!("{:.2}", (total_ht_cents as f64) / 100.0);
        let vat_eur = format!("{:.2}", (vat_cents as f64) / 100.0);
        let total_ttc_eur = format!("{:.2}", (total_ttc_cents as f64) / 100.0);
        let subtotal_eur = format!("{:.2}", (subtotal_cents as f64) / 100.0);
        let discount_eur = format!("{:.2}", (discount_cents as f64) / 100.0);
        let due_eur = format!("{:.2}", (due_cents as f64) / 100.0);

        let date_formatted = invoice.date.replace('-', "");
        let doc_type_code = if invoice.document_type == "credit_note" { "381" } else { "380" };

        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.push_str("<rsm:CrossIndustryInvoice xmlns:rsm=\"urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100\"\n");
        xml.push_str("    xmlns:ram=\"urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100\"\n");
        xml.push_str("    xmlns:udt=\"urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100\">\n");

        // Document Context (Basic Profile EN 16931)
        xml.push_str("  <rsm:ExchangedDocumentContext>\n");
        xml.push_str("    <ram:GuidelineSpecifiedDocumentContextParameter>\n");
        xml.push_str("      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>\n");
        xml.push_str("    </ram:GuidelineSpecifiedDocumentContextParameter>\n");
        xml.push_str("  </rsm:ExchangedDocumentContext>\n");

        // Exchanged Document Header
        xml.push_str("  <rsm:ExchangedDocument>\n");
        xml.push_str(&format!("    <ram:ID>{}</ram:ID>\n", invoice.number));
        xml.push_str(&format!("    <ram:TypeCode>{}</ram:TypeCode>\n", doc_type_code));
        xml.push_str("    <ram:IssueDateTime>\n");
        xml.push_str(&format!("      <udt:DateTimeString format=\"102\">{}</udt:DateTimeString>\n", date_formatted));
        xml.push_str("    </ram:IssueDateTime>\n");
        xml.push_str("  </rsm:ExchangedDocument>\n");

        // Supply Chain Trade Transaction
        xml.push_str("  <rsm:SupplyChainTradeTransaction>\n");

        // Items breakdown
        for (idx, item) in invoice.items.iter().enumerate() {
            let item_ht_cents = (item.unit_price * 100.0).round() as i64 * (item.quantity.round() as i64);
            let item_ht_eur = format!("{:.2}", (item_ht_cents as f64) / 100.0);

            xml.push_str("    <ram:IncludedSupplyChainTradeLineItem>\n");
            xml.push_str("      <ram:AssociatedDocumentLineDocument>\n");
            xml.push_str(&format!("        <ram:LineID>{}</ram:LineID>\n", idx + 1));
            xml.push_str("      </ram:AssociatedDocumentLineDocument>\n");

            xml.push_str("      <ram:SpecifiedTradeProduct>\n");
            xml.push_str(&format!("        <ram:Name>{}</ram:Name>\n", item.description));
            xml.push_str("      </ram:SpecifiedTradeProduct>\n");

            xml.push_str("      <ram:SpecifiedLineTradeAgreement>\n");
            xml.push_str("        <ram:GrossPriceProductTradePrice>\n");
            xml.push_str(&format!("          <ram:ChargeAmount>{:.2}</ram:ChargeAmount>\n", item.unit_price));
            xml.push_str("        </ram:GrossPriceProductTradePrice>\n");
            xml.push_str("      </ram:SpecifiedLineTradeAgreement>\n");

            xml.push_str("      <ram:SpecifiedLineTradeDelivery>\n");
            xml.push_str(&format!("        <ram:BilledQuantity unitCode=\"C62\">{:.2}</ram:BilledQuantity>\n", item.quantity));
            xml.push_str("      </ram:SpecifiedLineTradeDelivery>\n");

            xml.push_str("      <ram:SpecifiedLineTradeSettlement>\n");
            xml.push_str("        <ram:ApplicableTradeTax>\n");
            xml.push_str("          <ram:TypeCode>VAT</ram:TypeCode>\n");
            xml.push_str("          <ram:CategoryCode>S</ram:CategoryCode>\n");
            xml.push_str(&format!("          <ram:RateApplicablePercent>{:.2}</ram:RateApplicablePercent>\n", item.vat_rate));
            xml.push_str("        </ram:ApplicableTradeTax>\n");

            xml.push_str("        <ram:SpecifiedTradeSettlementLineMonetarySummation>\n");
            xml.push_str(&format!("          <ram:LineTotalAmount>{}</ram:LineTotalAmount>\n", item_ht_eur));
            xml.push_str("        </ram:SpecifiedTradeSettlementLineMonetarySummation>\n");
            xml.push_str("      </ram:SpecifiedLineTradeSettlement>\n");

            xml.push_str("    </ram:IncludedSupplyChainTradeLineItem>\n");
        }

        // Header Trade Agreement (Seller & Buyer)
        xml.push_str("    <ram:ApplicableHeaderTradeAgreement>\n");
        // Seller
        xml.push_str("      <ram:SellerTradeParty>\n");
        xml.push_str(&format!("        <ram:Name>{}</ram:Name>\n", company.company_name));
        xml.push_str("        <ram:SpecifiedLegalOrganization>\n");
        xml.push_str(&format!("          <ram:ID schemeID=\"0002\">{}</ram:ID>\n", company.siren));
        xml.push_str("        </ram:SpecifiedLegalOrganization>\n");
        xml.push_str("        <ram:PostalTradeAddress>\n");
        xml.push_str(&format!("          <ram:PostcodeCode>{}</ram:PostcodeCode>\n", company.postal_code));
        xml.push_str(&format!("          <ram:LineOne>{}</ram:LineOne>\n", company.address));
        xml.push_str(&format!("          <ram:CityName>{}</ram:CityName>\n", company.city));
        xml.push_str("          <ram:CountryID>FR</ram:CountryID>\n");
        xml.push_str("        </ram:PostalTradeAddress>\n");
        if let Some(tva) = &company.tva_number {
            xml.push_str("        <ram:SpecifiedTaxRegistration>\n");
            xml.push_str(&format!("          <ram:ID schemeID=\"VA\">{}</ram:ID>\n", tva));
            xml.push_str("        </ram:SpecifiedTaxRegistration>\n");
        }
        xml.push_str("      </ram:SellerTradeParty>\n");

        // Buyer
        xml.push_str("      <ram:BuyerTradeParty>\n");
        xml.push_str(&format!("        <ram:Name>{}</ram:Name>\n", client.name));
        xml.push_str("        <ram:PostalTradeAddress>\n");
        xml.push_str(&format!("          <ram:PostcodeCode>{}</ram:PostcodeCode>\n", client.postal_code));
        xml.push_str(&format!("          <ram:LineOne>{}</ram:LineOne>\n", client.address));
        xml.push_str(&format!("          <ram:CityName>{}</ram:CityName>\n", client.city));
        xml.push_str("          <ram:CountryID>FR</ram:CountryID>\n");
        xml.push_str("        </ram:PostalTradeAddress>\n");
        if let Some(vat) = &client.vat_number {
            xml.push_str("        <ram:SpecifiedTaxRegistration>\n");
            xml.push_str(&format!("          <ram:ID schemeID=\"VA\">{}</ram:ID>\n", vat));
            xml.push_str("        </ram:SpecifiedTaxRegistration>\n");
        }
        xml.push_str("      </ram:BuyerTradeParty>\n");
        xml.push_str("    </ram:ApplicableHeaderTradeAgreement>\n");

        // Trade Settlement (Payment & Totals)
        xml.push_str("    <ram:ApplicableHeaderTradeSettlement>\n");
        xml.push_str("      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>\n");

        if let Some(iban) = &company.iban {
            xml.push_str("      <ram:SpecifiedTradeSettlementPaymentMeans>\n");
            xml.push_str("        <ram:TypeCode>30</ram:TypeCode>\n"); // Credit Transfer
            xml.push_str("        <ram:PayeePartyCreditorFinancialAccount>\n");
            xml.push_str(&format!("          <ram:IBANID>{}</ram:IBANID>\n", iban));
            xml.push_str("        </ram:PayeePartyCreditorFinancialAccount>\n");
            xml.push_str("      </ram:SpecifiedTradeSettlementPaymentMeans>\n");
        }

        // Summary Totals
        xml.push_str("      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n");
        xml.push_str(&format!("        <ram:LineTotalAmount>{}</ram:LineTotalAmount>\n", subtotal_eur));
        xml.push_str(&format!("        <ram:AllowanceTotalAmount>{}</ram:AllowanceTotalAmount>\n", discount_eur));
        xml.push_str(&format!("        <ram:TaxBasisTotalAmount>{}</ram:TaxBasisTotalAmount>\n", total_ht_eur));
        xml.push_str(&format!("        <ram:TaxTotalAmount currencyID=\"EUR\">{}</ram:TaxTotalAmount>\n", vat_eur));
        xml.push_str(&format!("        <ram:GrandTotalAmount>{}</ram:GrandTotalAmount>\n", total_ttc_eur));
        xml.push_str(&format!("        <ram:DuePayableAmount>{}</ram:DuePayableAmount>\n", due_eur));
        xml.push_str("      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n");

        xml.push_str("    </ram:ApplicableHeaderTradeSettlement>\n");
        xml.push_str("  </rsm:SupplyChainTradeTransaction>\n");
        xml.push_str("</rsm:CrossIndustryInvoice>\n");

        Ok(xml)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{InvoiceItem, Company, Client};

    #[test]
    fn test_facturx_cii_xml_generation() {
        let company = Company {
            id: "co_1".to_string(),
            company_name: "Société Exemple".to_string(),
            trade_name: None,
            siren: "123456789".to_string(),
            siret: "12345678900012".to_string(),
            tva_number: Some("FR89123456789".to_string()),
            address: "1 Rue de Rivoli".to_string(),
            postal_code: "75001".to_string(),
            city: "Paris".to_string(),
            country: "France".to_string(),
            email: "contact@exemple.fr".to_string(),
            phone: "0102030405".to_string(),
            website: None,
            bank_account: None,
            iban: Some("FR7612345678901234567890123".to_string()),
            bic: None,
            logo: None,
            currency: "EUR".to_string(),
            payment_terms: None,
            payment_delay_days: 30,
            invoice_prefix: "FAC".to_string(),
            quote_prefix: "DEV".to_string(),
            theme_color: "blue".to_string(),
            has_professional_insurance: false,
            created_at: "2026-01-01".to_string(),
            updated_at: "2026-01-01".to_string(),
        };

        let client = Client {
            id: "cli_1".to_string(),
            company_id: "co_1".to_string(),
            name: "Client Test".to_string(),
            legal_name: None,
            siret: Some("98765432100099".to_string()),
            vat_number: Some("FR12987654321".to_string()),
            email: "client@test.fr".to_string(),
            phone: None,
            address: "5 Boulevard Haussmann".to_string(),
            postal_code: "75009".to_string(),
            city: "Paris".to_string(),
            country: "France".to_string(),
            notes: None,
            created_at: "2026-01-01".to_string(),
            updated_at: "2026-01-01".to_string(),
        };

        let inv = Invoice {
            id: "inv_1".to_string(),
            company_id: "co_1".to_string(),
            client_id: "cli_1".to_string(),
            document_type: "invoice".to_string(),
            number: "FAC-2026-08-000001".to_string(),
            date: "2026-08-04".to_string(),
            due_date: "2026-09-04".to_string(),
            status: "SENT".to_string(),
            items: vec![InvoiceItem {
                description: "Prestation de conseils".to_string(),
                quantity: 2.0,
                unit_price: 500.0,
                vat_rate: 20.0,
            }],
            notes: None,
            discount: 0.0,
            shipping: 0.0,
            deposit: 0.0,
            payment_method: "bank_transfer".to_string(),
            vat_rate: 20.0,
            custom_legal_mentions: None,
            created_at: "2026-08-04T10:00:00Z".to_string(),
            updated_at: "2026-08-04T10:00:00Z".to_string(),
        };

        let xml = FacturXService::generate_cii_xml(&company, &inv, &client).unwrap();
        assert!(xml.contains("CrossIndustryInvoice"));
        assert!(xml.contains("FAC-2026-08-000001"));
        assert!(xml.contains("Prestation de conseils"));
        assert!(xml.contains("<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>"));
        assert!(xml.contains("FR7612345678901234567890123"));
    }
}
