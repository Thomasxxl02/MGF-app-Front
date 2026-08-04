import { Invoice, Client, UserProfile } from '../types';

export const escapeXml = (unsafe: string): string => {
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

export const generateFacturXXml = (invoice: Invoice, client: Client | undefined, userProfile: UserProfile): string => {
  const num = invoice.number;
  const dateStr = (invoice.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const dueDateStr = (invoice.dueDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const subtotal = invoice.items?.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) || 0;
  const discountVal = subtotal * ((invoice.discount || 0) / 100);
  const totalHT = subtotal - discountVal + (invoice.shipping || 0);
  const vatRate = invoice.vatRate !== undefined ? invoice.vatRate : 0;
  const vatAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + vatAmount;
  const deposit = invoice.deposit || 0;
  const dueAmount = totalTTC - deposit;

  const sellerName = escapeXml(userProfile.companyName || 'Mon Entreprise');
  const sellerSiret = escapeXml(userProfile.siret || '00000000000000');
  const sellerAddress = escapeXml(userProfile.address || '');
  const sellerTva = escapeXml(userProfile.tvaNumber || 'FR00000000000');
  const sellerIBAN = escapeXml(userProfile.bankAccount || '');

  const buyerName = escapeXml(client?.name || 'Client Inconnu');
  const buyerSiret = escapeXml(client?.siret || '00000000000000');
  const buyerAddress = escapeXml(client?.address || '');

  const operationTypeLabel = 
    invoice.operationType === 'goods' ? 'Livraison de biens' :
    invoice.operationType === 'mixed' ? 'Opération mixte' : 'Prestation de services';
  
  const paymentMethodCode = 
    invoice.paymentMethod === 'card' ? '48' :
    invoice.paymentMethod === 'direct_debit' ? '49' :
    invoice.paymentMethod === 'check' ? '20' :
    invoice.paymentMethod === 'cash' ? '10' : '30';

  const paymentMethodLabel = 
    invoice.paymentMethod === 'card' ? 'Carte bancaire' :
    invoice.paymentMethod === 'direct_debit' ? 'Prélèvement automatique' :
    invoice.paymentMethod === 'check' ? 'Chèque' :
    invoice.paymentMethod === 'cash' ? 'Espèces' : 'Virement';

  const vatCode = vatRate > 0 ? 'S' : 'E';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice 
  xmlns:rsm="urn:unicefact:data:standard:CrossIndustryInvoice:100" 
  xmlns:ram="urn:unicefact:data:standard:ReusableAggregateBusinessInformationEntity:100" 
  xmlns:udt="urn:unicefact:data:standard:UnqualifiedDataType:100" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(num)}</ram:ID>
    <ram:TypeCode>${invoice.type === 'credit_note' ? '381' : '380'}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateStr}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  
  <rsm:SupplyChainTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${sellerName}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${sellerSiret.replace(/\s+/g, '')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${sellerAddress}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${sellerTva.replace(/\s+/g, '')}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      
      <ram:BuyerTradeParty>
        <ram:Name>${buyerName}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${buyerSiret.replace(/\s+/g, '')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${buyerAddress}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ShipToTradeParty>
        <ram:Name>${buyerName}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.deliveryAddress || buyerAddress)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:ShipToTradeParty>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${dateStr}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentMeans>
        <ram:TypeCode>${paymentMethodCode}</ram:TypeCode>
        <ram:Information>${paymentMethodLabel}</ram:Information>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${sellerIBAN.replace(/\s+/g, '')}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:PaymentMeans>
      
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${vatAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${vatCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${vatRate}</ram:RateApplicablePercent>
        <ram:ExemptionReason>${vatRate === 0 ? 'Exoneration de TVA, article 293 B du CGI' : 'TVA exigible sur les ' + escapeXml(invoice.vatOption || 'encaissements')}</ram:ExemptionReason>
      </ram:ApplicableTradeTax>
      
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Reglement a l'echeance : ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDateStr}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotal.toFixed(2)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>${(invoice.shipping || 0).toFixed(2)}</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>${discountVal.toFixed(2)}</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${vatAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${deposit.toFixed(2)}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${dueAmount.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
    
    <ram:IncludedSupplyChainTradeLineItem>
`;

  invoice.items?.forEach((item, index) => {
    const itemTotalHT = item.quantity * item.unitPrice;
    xml += `      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:GrossPriceProductTradePrice>
          <ram:ChargeAmount>${item.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:GrossPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity>${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${itemTotalHT.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
`;
  });

  xml += `  </rsm:SupplyChainTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
};
