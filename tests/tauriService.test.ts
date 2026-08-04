import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TauriAppError, 
  getPdpConfig, 
  savePdpConfig, 
  computeInvoiceAuditSeal, 
  createInvoice,
  getActiveCompanyId,
  PdpConfig 
} from '../services/tauri';
import { Invoice } from '../types';

describe('Tauri Service & Backend Integration Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).__TAURI__;
  });

  describe('TauriAppError Class', () => {
    it('creates structured app errors matching Rust backend error enum', () => {
      const err = new TauriAppError('BusinessRule', 'Transition de statut invalide.');
      expect(err.name).toBe('TauriAppError');
      expect(err.type).toBe('BusinessRule');
      expect(err.message).toBe('Transition de statut invalide.');
    });
  });

  describe('Company and PDP Configuration Persistence', () => {
    it('initializes active company ID and returns PDP config defaults', () => {
      const companyId = getActiveCompanyId();
      expect(companyId).toBeTruthy();

      const pdp = getPdpConfig();
      expect(pdp.environment).toBe('sandbox');
      expect(pdp.endpointUrl).toContain('chorus-pro');
    });

    it('saves and retrieves updated PDP configuration', () => {
      const customConfig: PdpConfig = {
        endpointUrl: 'https://pdp-partner.fr/api/v1',
        clientId: 'client_prod_123',
        clientSecret: 'secret_456',
        technicalUser: 'user_tech@partner.fr',
        environment: 'production'
      };

      savePdpConfig(customConfig);
      const retrieved = getPdpConfig();

      expect(retrieved.environment).toBe('production');
      expect(retrieved.clientId).toBe('client_prod_123');
      expect(retrieved.endpointUrl).toBe('https://pdp-partner.fr/api/v1');
    });
  });

  describe('Audit Seal Computation (computeInvoiceAuditSeal)', () => {
    it('computes a cryptographic hash seal for an invoice and links with sequence', async () => {
      const created = await createInvoice({
        type: 'invoice',
        clientId: 'cli_test',
        date: '2026-08-04',
        dueDate: '2026-09-04',
        status: 'PAID' as any,
        items: [{ description: 'Prestation', quantity: 1, unitPrice: 500 }],
        vatRate: 20
      });

      const result = await computeInvoiceAuditSeal(created.id);

      expect(result.hashSeal).toBeDefined();
      expect(result.hashSeal.length).toBe(64);
      expect(result.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      expect(result.timestamp).toBeDefined();
    });

    it('generates strict sequential document numbers for invoices created in sequence', async () => {
      const inv1 = await createInvoice({
        type: 'invoice',
        clientId: 'cli_1',
        date: '2026-08-04',
        items: [{ description: 'Consulting', quantity: 1, unitPrice: 200 }]
      });

      const inv2 = await createInvoice({
        type: 'invoice',
        clientId: 'cli_1',
        date: '2026-08-04',
        items: [{ description: 'Audit', quantity: 2, unitPrice: 150 }]
      });

      expect(inv1.number).toContain('2026');
      expect(inv2.number).toContain('2026');
      expect(inv1.number).not.toEqual(inv2.number);
    });
  });
});
