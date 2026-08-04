import { describe, it, expect } from 'vitest';
import { generateEpcQrPayload } from '../components/SepaQrCode';

describe('SepaQrCode EPC Payload Unit Tests', () => {
  it('generates a valid EPC QR Code payload conforming to EPC069-12 standard', () => {
    const payload = generateEpcQrPayload({
      iban: 'FR76 3000 6000 0112 3456 7890 189',
      bic: 'BNPAFRPPXXX',
      beneficiaryName: 'ACME CONSULTING SAS',
      amount: 1250.50,
      reference: 'FAC-2026-08-0001'
    });

    const lines = payload.split('\n');

    expect(lines[0]).toBe('BCD'); // Service Tag
    expect(lines[1]).toBe('002'); // Version
    expect(lines[2]).toBe('1');   // Encoding UTF-8
    expect(lines[3]).toBe('SCT'); // SEPA Credit Transfer
    expect(lines[4]).toBe('BNPAFRPPXXX'); // BIC
    expect(lines[5]).toBe('ACME CONSULTING SAS'); // Beneficiary
    expect(lines[6]).toBe('FR7630006000011234567890189'); // IBAN without spaces
    expect(lines[7]).toBe('EUR1250.50'); // Amount formatted
    expect(lines[10]).toBe('FAC-2026-08-0001'); // Remittance text
  });

  it('handles spaces and sanitizes beneficiary name and IBAN', () => {
    const payload = generateEpcQrPayload({
      iban: ' fr76 1234 5678 9012 3456 7890 123 ',
      beneficiaryName: '  Dupont  ',
      amount: 40.00,
      reference: 'REF-100'
    });

    expect(payload).toContain('FR7612345678901234567890123');
    expect(payload).toContain('EUR40.00');
    expect(payload).toContain('Dupont');
  });
});
