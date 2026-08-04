import { describe, it, expect } from 'vitest';
import { escapeXml, generateFacturXXml } from '../services/invoiceUtils';
import { Invoice, Client, UserProfile } from '../types';

describe('invoiceUtils Unit Tests', () => {
  describe('escapeXml', () => {
    it('escapes special XML characters correctly', () => {
      expect(escapeXml('ACME & Cie <Co> "Test" \'Quote\'')).toBe('ACME &amp; Cie &lt;Co&gt; &quot;Test&quot; &apos;Quote&apos;');
    });

    it('returns empty string for falsy input', () => {
      expect(escapeXml('')).toBe('');
    });
  });

  describe('generateFacturXXml', () => {
    const mockInvoice: Invoice = {
      id: 'inv_100',
      companyId: 'co_1',
      clientId: 'cli_1',
      type: 'invoice',
      number: 'FAC-2026-0001',
      date: '2026-08-04',
      dueDate: '2026-09-04',
      status: 'SENT' as any,
      items: [
        { id: 'item_1', description: 'Conseil & Dev', quantity: 10, unitPrice: 100 }
      ],
      discount: 5, // 5% discount => 1000 - 50 = 950 HT
      shipping: 20, // 950 + 20 = 970 HT
      vatRate: 20, // 20% VAT on 970 = 194 VAT => Total TTC 1164
      deposit: 100, // Due payable = 1064
      paymentMethod: 'bank_transfer'
    };

    const mockClient: Client = {
      id: 'cli_1',
      name: 'Client Alpha & Omega',
      siret: '98765432100012',
      address: '10 Rue de la Paix, Paris',
      created_at: '2026-01-01'
    };

    const mockUserProfile: UserProfile = {
      companyName: 'Ma Société Multi-Services',
      siret: '12345678900012',
      tvaNumber: 'FR12123456789',
      address: '12 Rue des Entrepreneurs',
      bankAccount: 'FR7630001000101234567890189',
      bic: 'BNPAFRPPXXX'
    };

    it('generates valid Factur-X XML containing required header and monetary tags', () => {
      const xml = generateFacturXXml(mockInvoice, mockClient, mockUserProfile);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<ram:ID>FAC-2026-0001</ram:ID>');
      expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>'); // Invoice type
      expect(xml).toContain('<ram:Name>Client Alpha &amp; Omega</ram:Name>'); // Escaped name
      expect(xml).toContain('<ram:ID schemeID="0002">12345678900012</ram:ID>');
      expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">194.00</ram:TaxTotalAmount>');
      expect(xml).toContain('<ram:GrandTotalAmount>1164.00</ram:GrandTotalAmount>');
      expect(xml).toContain('<ram:DuePayableAmount>1064.00</ram:DuePayableAmount>');
    });

    it('uses TypeCode 381 for credit notes (avoirs)', () => {
      const creditNote: Invoice = { ...mockInvoice, type: 'credit_note', number: 'AVO-2026-0001' };
      const xml = generateFacturXXml(creditNote, mockClient, mockUserProfile);

      expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>');
      expect(xml).toContain('<ram:ID>AVO-2026-0001</ram:ID>');
    });
  });
});
