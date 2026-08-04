import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InvoiceList from '../components/InvoiceList';
import { Invoice, Client } from '../types';

const mockClients: Client[] = [
  { id: 'cli_1', name: 'Jean Dupont', email: 'jean@example.com', address: '1 rue de Paris', created_at: '2026-01-01' },
  { id: 'cli_2', name: 'Alice Martin', email: 'alice@example.com', address: '2 rue de Lyon', created_at: '2026-01-01' }
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv_1',
    companyId: 'co_1',
    clientId: 'cli_1',
    type: 'invoice',
    number: 'FAC-2026-08-000001',
    date: '2026-08-04',
    dueDate: '2026-09-04',
    status: 'SENT' as any,
    items: [{ id: '1', description: 'Prestation Dev', quantity: 1, unitPrice: 1500 }],
    discount: 0,
    shipping: 0,
    deposit: 0,
    paymentMethod: 'bank_transfer',
    vatRate: 20,
    total: 1800
  },
  {
    id: 'inv_2',
    companyId: 'co_1',
    clientId: 'cli_2',
    type: 'invoice',
    number: 'FAC-2026-08-000002',
    date: '2026-08-05',
    dueDate: '2026-09-05',
    status: 'PAID' as any,
    items: [{ id: '2', description: 'Design UI', quantity: 2, unitPrice: 400 }],
    discount: 10,
    shipping: 0,
    deposit: 0,
    paymentMethod: 'card',
    vatRate: 20,
    total: 864
  }
];

describe('InvoiceList Component Tests', () => {
  const mockSetSelectedInvoice = vi.fn();
  const mockSetView = vi.fn();
  const mockDeleteDocument = vi.fn();
  const mockToggleSelection = vi.fn();

  it('renders all invoices correctly with formatted amounts', () => {
    render(
      <InvoiceList 
        invoices={mockInvoices}
        clients={mockClients}
        activeTab="invoice"
        selectedIds={new Set()}
        filteredAndSortedDocuments={mockInvoices}
        toggleSelection={mockToggleSelection}
        toggleSelectAll={vi.fn()}
        handleSort={vi.fn()}
        sortConfig={{ key: 'number', direction: 'asc' }}
        getThemeColor={() => 'blue'}
        setSelectedInvoice={mockSetSelectedInvoice}
        setView={mockSetView}
        deleteDocument={mockDeleteDocument}
        setActiveDunningDoc={vi.fn()}
        setDunningLevel={vi.fn()}
      />
    );

    // Verify presence of invoice numbers and client names
    expect(screen.getByText('FAC-2026-08-000001')).toBeInTheDocument();
    expect(screen.getByText('FAC-2026-08-000002')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('1800.00 €')).toBeInTheDocument();
  });

  it('displays status badges correctly', () => {
    render(
      <InvoiceList 
        invoices={mockInvoices}
        clients={mockClients}
        activeTab="invoice"
        selectedIds={new Set()}
        filteredAndSortedDocuments={mockInvoices}
        toggleSelection={mockToggleSelection}
        toggleSelectAll={vi.fn()}
        handleSort={vi.fn()}
        sortConfig={{ key: 'number', direction: 'asc' }}
        getThemeColor={() => 'blue'}
        setSelectedInvoice={mockSetSelectedInvoice}
        setView={mockSetView}
        deleteDocument={mockDeleteDocument}
        setActiveDunningDoc={vi.fn()}
        setDunningLevel={vi.fn()}
      />
    );

    expect(screen.getByText('SENT')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
  });
});
