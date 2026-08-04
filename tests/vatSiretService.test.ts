import { describe, it, expect } from 'vitest';
import { validateSiretLuhn, deriveFrenchVatFromSiren, validateViesVatFormat } from '../services/vatSiretService';

describe('vatSiretService Unit Tests', () => {
  describe('SIRET / SIREN Validation (Luhn algorithm)', () => {
    it('validates a correct 9-digit SIREN (e.g. La Poste: 356000000)', () => {
      const res = validateSiretLuhn('356000000');
      expect(res.valid).toBe(true);
      expect(res.isSiret).toBe(false);
      expect(res.siren).toBe('356000000');
    });

    it('validates a correct 14-digit SIRET (e.g. La Poste siège: 35600000000048)', () => {
      const res = validateSiretLuhn('35600000000048');
      expect(res.valid).toBe(true);
      expect(res.isSiret).toBe(true);
      expect(res.siren).toBe('356000000');
    });

    it('rejects an invalid SIRET with incorrect Luhn check digit', () => {
      const res = validateSiretLuhn('35600000000049');
      expect(res.valid).toBe(false);
    });

    it('rejects non-digit or incorrect length input', () => {
      expect(validateSiretLuhn('12345').valid).toBe(false);
      expect(validateSiretLuhn('ABCDEFGHIJKLM1').valid).toBe(false);
    });
  });

  describe('French VAT Auto-Derivation', () => {
    it('correctly calculates French Intra-community VAT number from SIREN', () => {
      // SIREN: 356000000 -> (12 + 3 * (356000000 % 97)) % 97 = 39 -> FR 39 356000000
      const vat = deriveFrenchVatFromSiren('35600000000048');
      expect(vat).toBe('FR39356000000');
    });
  });

  describe('VIES Intra-community VAT Format Validation', () => {
    it('validates French VAT format', () => {
      expect(validateViesVatFormat('FR31356000000').valid).toBe(true);
      expect(validateViesVatFormat('FR00356000000').valid).toBe(true);
      expect(validateViesVatFormat('FRINVALID').valid).toBe(false);
    });

    it('validates German, Belgian and Italian VAT format standards', () => {
      expect(validateViesVatFormat('DE123456789').valid).toBe(true);
      expect(validateViesVatFormat('BE0123456789').valid).toBe(true);
      expect(validateViesVatFormat('IT12345678901').valid).toBe(true);
    });
  });
});
