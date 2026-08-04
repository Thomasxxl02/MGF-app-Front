import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InvoiceList } from '../components/InvoiceList';
import { Invoice } from '../types';

// ====================================================================
// COMPONENT UNIT TEST: InvoiceList
// Ce test valide le rendu conforme, la mise en forme monétaire,
// et les interactions utilisateurs (sélections, actions) de la liste.
// ====================================================================

const mockInvoices: Invoice[] = [
  {
    id: 'inv_1',
    companyId: 'co_1',
    clientId: 'cli_1',
    clientName: 'Jean Dupont', // flat mapped in lists
    type: 'invoice',
    number: 'FAC-2026-08-000001',
    date: '2026-08-04',
    dueDate: '2026-09-04',
    status: 'SENT',
    items: [{ id: '1', description: 'Prestation Dev', quantity: 1, unitPrice: 1500 }],
    discount: 0,
    shipping: 0,
    deposit: 0,
    paymentMethod: 'bank_transfer',
    vatRate: 20,
    total: 1800, // 1500 HT * 1.20 VAT
    createdAt: '2026-08-04T00:00:00Z',
    updatedAt: '2026-08-04T00:00:00Z'
  },
  {
    id: 'inv_2',
    companyId: 'co_1',
    clientId: 'cli_2',
    clientName: 'Alice Martin',
    type: 'invoice',
    number: 'FAC-2026-08-000002',
    date: '2026-08-05',
    dueDate: '2026-09-05',
    status: 'PAID',
    items: [{ id: '2', description: 'Design UI', quantity: 2, unitPrice: 400 }],
    discount: 10, // 10% discount on 800 = 720 HT * 1.20 = 864 TTC
    shipping: 0,
    deposit: 0,
    paymentMethod: 'card',
    vatRate: 20,
    total: 864,
    createdAt: '2026-08-05T00:00:00Z',
    updatedAt: '2026-08-05T00:00:00Z'
  }
];

describe('InvoiceList Component Tests', () => {
  const mockOnSelectInvoice = vi.fn();

  it('renders all invoices correctly with formatted amounts', () => {
    render(
      <InvoiceList 
        invoices={mockInvoices} 
        onSelectInvoice={mockOnSelectInvoice}
        selectedInvoiceId={null}
        themeColor="blue"
      />
    );

    // Verify presence of invoice numbers
    expect(screen.getByText('FAC-2026-08-000001')).toBeInTheDocument();
    expect(screen.getByText('FAC-2026-08-000002')).toBeInTheDocument();

    // Verify client names
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();

    // Verify financial calculations formatted correctly (French Locale format)
    expect(screen.getByText('1 800,00 €')).toBeInTheDocument();
    expect(screen.getByText('864,00 €')).toBeInTheDocument();
  });

  it('displays correct status badges based on transaction status', () => {
    render(
      <InvoiceList 
        invoices={mockInvoices} 
        onSelectInvoice={mockOnSelectInvoice}
        selectedInvoiceId={null}
        themeColor="blue"
      />
    );

    // Verify statuses
    const envoyeeBadge = screen.getByText('Envoyée');
    const payeeBadge = screen.getByText('Payée');

    expect(envoyeeBadge).toBeInTheDocument();
    expect(payeeBadge).toBeInTheDocument();

    // Verify styling boundaries are applied correctly
    expect(envoyeeBadge.closest('span')).toHaveClass('bg-amber-50');
    expect(payeeBadge.closest('span')).toHaveClass('bg-emerald-50');
  });

  it('triggers item selection callback when a row is clicked', () => {
    render(
      <InvoiceList 
        invoices={mockInvoices} 
        onSelectInvoice={mockOnSelectInvoice}
        selectedInvoiceId={null}
        themeColor="blue"
      />
    );

    // Click the first invoice row
    const row = screen.getByText('FAC-2026-08-000001').closest('tr');
    if (row) {
      fireEvent.click(row);
      expect(mockOnSelectInvoice).toHaveBeenCalledWith(mockInvoices[0]);
    } else {
      throw new Error("Invoice row was not rendered");
    }
  });
});
