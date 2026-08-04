import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClientManager from '../components/ClientManager';
import { Client } from '../types';

const mockClients: Client[] = [
  {
    id: 'cli_1',
    name: 'ACME Corp',
    siret: '35600000000048',
    tvaNumber: 'FR39356000000',
    email: 'contact@acme.fr',
    phone: '01 23 45 67 89',
    address: '10 Rue de la Paix',
    postalCode: '75002',
    city: 'Paris',
    country: 'France',
    created_at: '2026-01-01'
  }
];

describe('ClientManager Component Unit Tests', () => {
  const mockSetClients = vi.fn();

  it('renders client list with SIRET and contact details', () => {
    render(
      <ClientManager 
        clients={mockClients} 
        setClients={mockSetClients} 
        invoices={[]} 
      />
    );

    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    expect(screen.getByText('35600000000048')).toBeInTheDocument();
    expect(screen.getByText('contact@acme.fr')).toBeInTheDocument();
  });

  it('opens creation modal when clicking Nouveau Client', () => {
    render(
      <ClientManager 
        clients={mockClients} 
        setClients={mockSetClients} 
        invoices={[]} 
      />
    );

    const newBtn = screen.getByText('Nouveau Client');
    fireEvent.click(newBtn);

    expect(screen.getByText('Nouveau client')).toBeInTheDocument();
  });

  it('filters clients list via search query', () => {
    render(
      <ClientManager 
        clients={mockClients} 
        setClients={mockSetClients} 
        invoices={[]} 
      />
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    fireEvent.change(searchInput, { target: { value: 'Inexistant' } });

    expect(screen.queryByText('ACME Corp')).not.toBeInTheDocument();
    expect(screen.getByText('Aucun client actif')).toBeInTheDocument();
  });
});
