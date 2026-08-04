/**
 * Service for Bank Statement Import (CSV/OFX) and Intelligent Reconciliation.
 */

export interface BankStatementLine {
  id: string;
  date: string;
  label: string;
  amount: number;
  matchedWith?: {
    type: 'invoice' | 'expense';
    id: string;
    ref: string;
    label: string;
  };
}

export interface ReconcileResult {
  predictedMatch: {
    type: 'invoice' | 'expense';
    id: string;
    ref: string;
    label: string;
    amount: number;
  } | null;
  confidence: number; // 0 to 100
}

/**
 * Parses raw CSV text (from BoursoBank, Shine, Qonto, LCL, BNP, etc.) into structured bank lines.
 * Handles both comma (,) and semicolon (;) separators, as well as single-column or debit/credit column formats.
 */
export function parseBankCsv(csvContent: string): BankStatementLine[] {
  if (!csvContent || !csvContent.trim()) return [];

  const lines = csvContent.split(/\r?\n/);
  const results: BankStatementLine[] = [];

  lines.forEach((line, index) => {
    if (index === 0 || !line.trim()) return; // Skip header or empty lines

    const cols = line.indexOf(';') >= 0 ? line.split(';') : line.split(',');
    if (cols.length < 2) return;

    const dateStr = cols[0]?.replace(/"/g, '').trim() || '';
    const description = cols[1]?.replace(/"/g, '').trim() || '';
    let rawAmount = 0;

    if (cols.length >= 4) {
      const debit = parseFloat((cols[2] || '').replace(/"/g, '').replace(/[\s€]/g, '').replace(',', '.'));
      const credit = parseFloat((cols[3] || '').replace(/"/g, '').replace(/[\s€]/g, '').replace(',', '.'));
      rawAmount = !isNaN(credit) && credit > 0 ? credit : (!isNaN(debit) ? -Math.abs(debit) : 0);
    } else if (cols[2]) {
      rawAmount = parseFloat(cols[2].replace(/"/g, '').replace(/[\s€]/g, '').replace(',', '.'));
    }

    if (dateStr && description && !isNaN(rawAmount) && rawAmount !== 0) {
      results.push({
        id: `csv-${index}-${Date.now()}`,
        date: dateStr,
        label: description,
        amount: rawAmount
      });
    }
  });

  return results;
}

/**
 * Parses OFX (Open Financial Exchange) format into bank lines.
 */
export function parseBankOfx(ofxContent: string): BankStatementLine[] {
  if (!ofxContent) return [];

  const lines: BankStatementLine[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  let index = 0;
  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    
    const trnAmtMatch = block.match(/<TRNAMT>([\d.-]+)/i);
    const dtPostedMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const nameMatch = block.match(/<NAME>([^<\r\n]+)/i) || block.match(/<MEMO>([^<\r\n]+)/i);

    if (trnAmtMatch && dtPostedMatch) {
      const amt = parseFloat(trnAmtMatch[1]);
      const rawDt = dtPostedMatch[1]; // YYYYMMDD
      const formattedDt = `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}`;
      const label = nameMatch ? nameMatch[1].trim() : 'Transaction OFX';

      index++;
      lines.push({
        id: `ofx-${index}-${Date.now()}`,
        date: formattedDt,
        label,
        amount: amt
      });
    }
  }

  return lines;
}

/**
 * Intelligent reconciliation algorithm:
 * Predicts invoice or expense match for a bank transaction based on amount, invoice reference numbers, or client names.
 */
export function reconcileTransaction(
  bankLine: BankStatementLine,
  pendingInvoices: Array<{ id: string; number: string; clientName?: string; total: number }>,
  existingExpenses: Array<{ id: string; ref: string; label: string; amount: number }>
): ReconcileResult {
  const isIncoming = bankLine.amount > 0;
  const labelUpper = bankLine.label.toUpperCase();

  if (isIncoming) {
    // 1. Exact amount match + Ref in label (Highest confidence: 100%)
    const exactRefAndAmount = pendingInvoices.find(inv => {
      const amountMatch = Math.abs(inv.total - bankLine.amount) < 0.02;
      const refMatch = labelUpper.includes(inv.number.toUpperCase());
      return amountMatch && refMatch;
    });

    if (exactRefAndAmount) {
      return {
        predictedMatch: {
          type: 'invoice',
          id: exactRefAndAmount.id,
          ref: exactRefAndAmount.number,
          label: `Facture ${exactRefAndAmount.number} (${exactRefAndAmount.clientName || 'Client'})`,
          amount: exactRefAndAmount.total
        },
        confidence: 100
      };
    }

    // 2. Exact amount match (Confidence: 90%)
    const exactAmount = pendingInvoices.find(inv => Math.abs(inv.total - bankLine.amount) < 0.02);
    if (exactAmount) {
      return {
        predictedMatch: {
          type: 'invoice',
          id: exactAmount.id,
          ref: exactAmount.number,
          label: `Facture ${exactAmount.number} (${exactAmount.clientName || 'Client'})`,
          amount: exactAmount.total
        },
        confidence: 90
      };
    }

    // 3. Client name match in label (Confidence: 70%)
    const clientMatch = pendingInvoices.find(inv => {
      if (!inv.clientName) return false;
      const nameFirstPart = inv.clientName.split(' ')[0].toUpperCase();
      return nameFirstPart.length > 2 && labelUpper.includes(nameFirstPart);
    });

    if (clientMatch) {
      return {
        predictedMatch: {
          type: 'invoice',
          id: clientMatch.id,
          ref: clientMatch.number,
          label: `Facture ${clientMatch.number} (${clientMatch.clientName})`,
          amount: clientMatch.total
        },
        confidence: 70
      };
    }
  } else {
    // Expense reconciliation (outgoing)
    const expenseAmount = Math.abs(bankLine.amount);
    
    // 1. Exact amount and ref/label match (Confidence: 95%)
    const exactExpense = existingExpenses.find(exp => Math.abs(exp.amount - expenseAmount) < 0.02);
    if (exactExpense) {
      return {
        predictedMatch: {
          type: 'expense',
          id: exactExpense.id,
          ref: exactExpense.ref,
          label: exactExpense.label,
          amount: exactExpense.amount
        },
        confidence: 95
      };
    }
  }

  return { predictedMatch: null, confidence: 0 };
}
