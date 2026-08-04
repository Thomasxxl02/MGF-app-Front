import { describe, it, expect } from 'vitest';
import { 
  parseBankCsv, 
  parseBankOfx, 
  reconcileTransaction, 
  BankStatementLine 
} from '../services/bankReconciliationService';

describe('bankReconciliationService Unit Tests', () => {
  describe('parseBankCsv', () => {
    it('parses standard comma-separated bank statements with credit/debit', () => {
      const csvData = `Date,Description,Debit,Credit
2026-08-01,"VIREMENT SEPA RECU ACME CORP",,1250.00
2026-08-02,"CB CAFETERIA PARIS",18.50,`;

      const lines = parseBankCsv(csvData);
      expect(lines).toHaveLength(2);
      expect(lines[0].label).toBe('VIREMENT SEPA RECU ACME CORP');
      expect(lines[0].amount).toBe(1250.00);
      expect(lines[1].amount).toBe(-18.50);
    });

    it('parses French semicolon-delimited CSV statements with single amount column', () => {
      const csvData = `Date;Libellé;Montant
04/08/2026;VIREMENT SEPA CLIENT DUPONT;1800,00
05/08/2026;PRELEVEMENT SOSH TELECOM;-29,99`;

      const lines = parseBankCsv(csvData);
      expect(lines).toHaveLength(2);
      expect(lines[0].amount).toBe(1800.00);
      expect(lines[1].amount).toBe(-29.99);
    });

    it('returns empty array for invalid or empty input', () => {
      expect(parseBankCsv('')).toEqual([]);
      expect(parseBankCsv('   ')).toEqual([]);
    });
  });

  describe('parseBankOfx', () => {
    it('parses OFX XML/SGML transactions correctly', () => {
      const ofxData = `
        <OFX>
          <BANKTRANLIST>
            <STMTTRN>
              <TRNTYPE>CREDIT</TRNTYPE>
              <DTPOSTED>20260804120000</DTPOSTED>
              <TRNAMT>1500.00</TRNAMT>
              <FITID>20260804001</FITID>
              <NAME>VIREMENT SEPA FAC-2026-08-0001</NAME>
            </STMTTRN>
            <STMTTRN>
              <TRNTYPE>DEBIT</TRNTYPE>
              <DTPOSTED>20260805120000</DTPOSTED>
              <TRNAMT>-45.00</TRNAMT>
              <FITID>20260805002</FITID>
              <MEMO>ACHAT FOURNITURES BUREAU</MEMO>
            </STMTTRN>
          </BANKTRANLIST>
        </OFX>
      `;

      const lines = parseBankOfx(ofxData);
      expect(lines).toHaveLength(2);
      expect(lines[0].date).toBe('2026-08-04');
      expect(lines[0].amount).toBe(1500.00);
      expect(lines[0].label).toBe('VIREMENT SEPA FAC-2026-08-0001');
      expect(lines[1].amount).toBe(-45.00);
    });
  });

  describe('reconcileTransaction', () => {
    const mockInvoices = [
      { id: 'inv_1', number: 'FAC-2026-0001', clientName: 'ACME SAS', total: 1800.00 },
      { id: 'inv_2', number: 'FAC-2026-0002', clientName: 'Benoit Dupont', total: 450.00 }
    ];

    const mockExpenses = [
      { id: 'exp_1', ref: 'DEP-2026-01', label: 'Fournitures Bureau', amount: 45.00 }
    ];

    it('matches exact ref & amount with 100% confidence', () => {
      const line: BankStatementLine = {
        id: 'line_1',
        date: '2026-08-04',
        label: 'VIREMENT RECU FAC-2026-0001 ACME',
        amount: 1800.00
      };

      const result = reconcileTransaction(line, mockInvoices, mockExpenses);
      expect(result.confidence).toBe(100);
      expect(result.predictedMatch?.id).toBe('inv_1');
      expect(result.predictedMatch?.type).toBe('invoice');
    });

    it('matches exact amount with 90% confidence', () => {
      const line: BankStatementLine = {
        id: 'line_2',
        date: '2026-08-04',
        label: 'VIREMENT RECU SANS REF',
        amount: 450.00
      };

      const result = reconcileTransaction(line, mockInvoices, mockExpenses);
      expect(result.confidence).toBe(90);
      expect(result.predictedMatch?.id).toBe('inv_2');
    });

    it('matches client name with 70% confidence', () => {
      const line: BankStatementLine = {
        id: 'line_3',
        date: '2026-08-04',
        label: 'VIREMENT DE BENOIT',
        amount: 400.00 // different amount
      };

      const result = reconcileTransaction(line, mockInvoices, mockExpenses);
      expect(result.confidence).toBe(70);
      expect(result.predictedMatch?.id).toBe('inv_2');
    });

    it('matches outgoing expense transaction with 95% confidence', () => {
      const line: BankStatementLine = {
        id: 'line_4',
        date: '2026-08-04',
        label: 'PAIEMENT CB FOURNITURES',
        amount: -45.00
      };

      const result = reconcileTransaction(line, mockInvoices, mockExpenses);
      expect(result.confidence).toBe(95);
      expect(result.predictedMatch?.id).toBe('exp_1');
      expect(result.predictedMatch?.type).toBe('expense');
    });
  });
});
