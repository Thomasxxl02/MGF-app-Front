import React, { useState, useMemo } from 'react';
import { Client, Invoice, InvoiceStatus } from '../types';
import { Plus, Search, Trash2, Mail, MapPin, Phone, Users, X, Edit2, TrendingUp, FileText, Download, SortAsc, Calendar, StickyNote, Archive, RefreshCcw, Globe, Building, CreditCard, User, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { validateSiretLuhn, deriveFrenchVatFromSiren, validateViesVatFormat } from '../services/vatSiretService';

interface ClientManagerProps {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  invoices: Invoice[];
}

type SortOption = 'name' | 'revenue' | 'activity' | 'date' | 'siret_asc' | 'siret_desc';

const ClientManager: React.FC<ClientManagerProps> = ({ clients, setClients, invoices }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    email: '',
    address: '',
    siret: '',
    phone: '',
    notes: '',
    tvaNumber: '',
    website: '',
    contactName: '',
    paymentDelayDays: 30,
    category: 'b2b'
  });

  // --- STATISTICS HELPERS ---

  const getClientStats = (clientId: string) => {
    const clientInvoices = invoices.filter(inv => inv.clientId === clientId);
    
    // Revenue (Paid invoices - Credit Notes)
    const revenue = clientInvoices
      .filter(inv => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => {
         if (inv.type === 'credit_note') return sum - inv.total;
         if (!inv.type || inv.type === 'invoice') return sum + inv.total;
         return sum;
      }, 0);

    // Last Activity Date
    const dates = clientInvoices.map(inv => new Date(inv.date).getTime());
    const lastActivity = dates.length > 0 ? Math.max(...dates) : 0;

    return {
      revenue,
      count: clientInvoices.length,
      lastActivity
    };
  };

  // --- SORTING & FILTERING ---

  const processedClients = useMemo(() => {
    // 1. Filter by Archive Status
    let result = clients.filter(c => !!c.archived === showArchived);

    // 2. Filter by Search (Name, Email, SIRET, Notes)
    const term = searchTerm.toLowerCase();
    result = result.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.email.toLowerCase().includes(term) ||
      (c.siret && c.siret.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term))
    );

    // 3. Sort
    return result.sort((a, b) => {
      const statsA = getClientStats(a.id);
      const statsB = getClientStats(b.id);

      if (sortBy === 'revenue') return statsB.revenue - statsA.revenue;
      if (sortBy === 'activity') return statsB.lastActivity - statsA.lastActivity;
      if (sortBy === 'date') return parseInt(b.id) - parseInt(a.id); // Descending (Newest first)
      if (sortBy === 'siret_asc') return (a.siret || '').localeCompare(b.siret || '');
      if (sortBy === 'siret_desc') return (b.siret || '').localeCompare(a.siret || '');
      return a.name.localeCompare(b.name);
    });
  }, [clients, searchTerm, sortBy, invoices, showArchived]);

  // --- ACTIONS ---

  const openCreate = () => {
    setEditingId(null);
    setFormData({ 
      name: '', 
      email: '', 
      address: '', 
      siret: '', 
      phone: '', 
      notes: '',
      tvaNumber: '',
      website: '',
      contactName: '',
      paymentDelayDays: 30,
      category: 'b2b'
    });
    setIsPanelOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setFormData({ ...client });
    setIsPanelOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    if (editingId) {
        setClients(clients.map(c => c.id === editingId ? { ...c, ...formData } as Client : c));
    } else {
        const client: Client = {
            id: Date.now().toString(),
            name: formData.name,
            email: formData.email,
            address: formData.address || '',
            siret: formData.siret,
            phone: formData.phone,
            notes: formData.notes,
            archived: false,
            tvaNumber: formData.tvaNumber,
            website: formData.website,
            contactName: formData.contactName,
            paymentDelayDays: formData.paymentDelayDays,
            category: formData.category
        };
        setClients([...clients, client]);
    }
    setIsPanelOpen(false);
  };

  const toggleArchiveClient = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setClients(clients.map(c => c.id === id ? { ...c, archived: !c.archived } : c));
  };

  const handleDeleteClient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client DÉFINITIVEMENT ? Cette action est irréversible.')) {
      setClients(clients.filter(c => c.id !== id));
    }
  };

  const exportCSV = () => {
    const headers = ['Nom', 'Email', 'Téléphone', 'SIRET', 'Adresse', 'Notes', 'CA Généré', 'Dernière Activité', 'Statut'];
    const rows = processedClients.map(c => {
        const stats = getClientStats(c.id);
        return [
            `"${c.name}"`,
            `"${c.email}"`,
            `"${c.phone || ''}"`,
            `"${c.siret || ''}"`,
            `"${c.address?.replace(/\n/g, ' ') || ''}"`,
            `"${c.notes?.replace(/\n/g, ' ') || ''}"`,
            stats.revenue.toFixed(2),
            stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : 'Jamais',
            c.archived ? 'Archivé' : 'Actif'
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clients_${showArchived ? 'archives' : 'actifs'}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clients</h2>
          <p className="text-slate-500">Gérez votre portefeuille et suivez les revenus.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Archive Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
               <button 
                 onClick={() => setShowArchived(false)}
                 className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${!showArchived ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-slate-500 hover:text-slate-700 shadow-none'}`}
               >
                 Actifs
               </button>
               <button 
                 onClick={() => setShowArchived(true)}
                 className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${showArchived ? 'bg-white text-slate-600 shadow' : 'bg-transparent text-slate-500 hover:text-slate-700 shadow-none'}`}
               >
                 Archivés
               </button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
                <button 
                onClick={exportCSV}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium shadow-sm flex-1 sm:flex-initial justify-center"
                title="Exporter la vue actuelle en CSV"
                >
                <Download size={18} />
                <span className="hidden sm:inline">Export {showArchived ? '(Archivés)' : '(Actifs)'}</span>
                </button>
                <button 
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 font-medium flex-1 sm:flex-initial justify-center"
                >
                <Plus size={18} />
                <span className="hidden sm:inline">Nouveau Client</span>
                <span className="sm:hidden">Nouveau</span>
                </button>
            </div>
        </div>
      </div>

      {/* Side Panel Form */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 border-l border-slate-100 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Modifier le client' : 'Nouveau client'}</h3>
                <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom / Raison Sociale <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Entreprise SAS ou Jean Dupont"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catégorie</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer font-medium text-slate-800"
                            value={formData.category || 'b2b'}
                            onChange={e => setFormData({...formData, category: e.target.value as any})}
                        >
                            <option value="b2b">B2B / Entreprise</option>
                            <option value="individual">B2C / Particulier</option>
                            <option value="public">Secteur Public</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Interlocuteur principal</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.contactName || ''}
                            onChange={e => setFormData({...formData, contactName: e.target.value})}
                            placeholder="M. Alex Martin"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Contact <span className="text-red-500">*</span></label>
                        <input 
                            type="email" 
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder="contact@exemple.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
                        <input 
                            type="tel" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            placeholder="06 12 34 56 78"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-semibold text-slate-700">SIRET / SIREN</label>
                            {formData.siret && (
                              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                                validateSiretLuhn(formData.siret).valid ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {validateSiretLuhn(formData.siret).valid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {validateSiretLuhn(formData.siret).valid ? 'Luhn OK' : 'Invalide'}
                              </span>
                            )}
                        </div>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-xs"
                            value={formData.siret || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const updated = { ...formData, siret: val };
                              // Auto calculate FR VAT if valid SIREN/SIRET and tvaNumber empty
                              const siretCheck = validateSiretLuhn(val);
                              if (siretCheck.valid && !formData.tvaNumber) {
                                const derivedVat = deriveFrenchVatFromSiren(val);
                                if (derivedVat) updated.tvaNumber = derivedVat;
                              }
                              setFormData(updated);
                            }}
                            placeholder="14 chiffres (ex: 80000000000012)"
                        />
                        {formData.siret && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {validateSiretLuhn(formData.siret).message}
                          </p>
                        )}
                    </div>
                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-semibold text-slate-700">N° TVA Intracommunautaire</label>
                            {formData.tvaNumber && (
                              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                                validateViesVatFormat(formData.tvaNumber).valid ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {validateViesVatFormat(formData.tvaNumber).valid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {validateViesVatFormat(formData.tvaNumber).valid ? 'Format VIES' : 'Format'}
                              </span>
                            )}
                        </div>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-xs"
                            value={formData.tvaNumber || ''}
                            onChange={e => setFormData({...formData, tvaNumber: e.target.value.toUpperCase()})}
                            placeholder="FRXX999999999"
                        />
                        {formData.siret && validateSiretLuhn(formData.siret).valid && !formData.tvaNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              const derived = deriveFrenchVatFromSiren(formData.siret || '');
                              if (derived) setFormData({ ...formData, tvaNumber: derived });
                            }}
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1 font-semibold"
                          >
                            <Sparkles size={10} /> Auto-générer TVA depuis SIRET
                          </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Délai de paiement (jours)</label>
                        <input 
                            type="number" 
                            min="0"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.paymentDelayDays ?? 30}
                            onChange={e => setFormData({...formData, paymentDelayDays: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Site internet</label>
                        <input 
                            type="url" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.website || ''}
                            onChange={e => setFormData({...formData, website: e.target.value})}
                            placeholder="https://client.fr"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse de facturation</label>
                    <textarea 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                        rows={3}
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="123 Rue de la Paix, 75000 Paris"
                    />
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                        <StickyNote size={14} className="text-slate-400"/> Notes privées (Interne)
                    </label>
                    <textarea 
                        className="w-full p-3 bg-yellow-50/50 border border-yellow-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 outline-none transition-all resize-none text-sm text-slate-700"
                        rows={3}
                        value={formData.notes || ''}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        placeholder="Code porte, préférences, contact secondaire..."
                    />
                </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                 <button 
                    type="button" 
                    onClick={() => setIsPanelOpen(false)}
                    className="px-6 py-2.5 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl font-medium transition-all"
                >
                    Annuler
                </button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
                >
                    {editingId ? 'Mettre à jour' : 'Enregistrer le client'}
                </button>
            </div>
        </div>
      </div>
      
      {/* Overlay */}
      {isPanelOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity"
            onClick={() => setIsPanelOpen(false)}
        />
      )}

      {/* Filter & List */}
      <div className="space-y-6">
        {/* Search & Sort Toolbar */}
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                type="text" 
                placeholder={showArchived ? "Rechercher dans les archives..." : "Rechercher par nom, email, SIRET, notes..."}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white shadow-sm transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-2xl shadow-sm">
                <SortAsc size={18} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Trier par:</span>
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
                >
                    <option value="name">Nom (A-Z)</option>
                    <option value="revenue">Chiffre d'Affaires</option>
                    <option value="activity">Activité Récente</option>
                    <option value="date">Date de création</option>
                    <option value="siret_asc">SIRET (Croissant)</option>
                    <option value="siret_desc">SIRET (Décroissant)</option>
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedClients.map(client => {
            const stats = getClientStats(client.id);
            
            return (
            <div 
                key={client.id} 
                className={`bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all duration-300 group relative flex flex-col ${client.archived ? 'grayscale-[0.5] opacity-90' : ''}`}
            >
               {/* Actions Top Right */}
               <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                        onClick={() => openEdit(client)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Modifier"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={(e) => toggleArchiveClient(client.id, e)}
                        className={`p-2 rounded-xl transition-colors ${client.archived ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                        title={client.archived ? "Restaurer" : "Archiver"}
                    >
                        {client.archived ? <RefreshCcw size={16} /> : <Archive size={16} />}
                    </button>
                    <button 
                        onClick={(e) => handleDeleteClient(client.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Supprimer définitivement"
                    >
                        <Trash2 size={16} />
                    </button>
               </div>
               
               <div className="flex items-center gap-4 mb-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-md shrink-0 
                    ${client.archived ? 'bg-slate-200 text-slate-500 shadow-slate-200' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200'}`}>
                   {client.name.charAt(0).toUpperCase()}
                 </div>
                 <div className="overflow-hidden flex-1">
                   <h4 className="font-bold text-slate-900 truncate pr-4 text-lg" title={client.name}>{client.name}</h4>
                   <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{client.email}</p>
                   <div className="flex flex-wrap gap-1.5 mt-1.5">
                     {client.archived ? (
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 px-1.5 py-0.5 rounded-md">Archivé</span>
                     ) : (
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                         client.category === 'public' 
                           ? 'bg-purple-50 text-purple-600 border-purple-100' 
                           : client.category === 'individual' 
                             ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                             : 'bg-blue-50 text-blue-600 border-blue-100'
                       }`}>
                         {client.category === 'public' ? 'Secteur Public' : client.category === 'individual' ? 'Particulier / B2C' : 'B2B / Entreprise'}
                       </span>
                     )}
                     
                     {client.paymentDelayDays !== undefined && (
                       <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                         {client.paymentDelayDays === 0 ? 'Réception' : `${client.paymentDelayDays}j`}
                       </span>
                     )}
                   </div>
                 </div>
               </div>
               
               {/* Mini Stats */}
               <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-slate-50">
                    <div className="bg-slate-50 rounded-2xl p-3">
                        <p className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center gap-1">
                            <TrendingUp size={10} /> CA Généré
                        </p>
                        <p className={`font-bold ${stats.revenue > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{stats.revenue.toLocaleString()} €</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3">
                        <p className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center gap-1">
                            <Calendar size={10} /> Activité
                        </p>
                        <p className="font-bold text-slate-900 text-sm">
                            {stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : '-'}
                        </p>
                    </div>
               </div>
               
               <div className="space-y-3 text-sm text-slate-500 mb-4">
                 {client.contactName && (
                   <div className="flex items-center gap-3">
                     <User size={14} className="text-slate-300" />
                     <span className="text-slate-700 font-medium">{client.contactName} <span className="text-xs text-slate-400 font-normal">(Contact)</span></span>
                   </div>
                 )}
                 {client.phone && (
                   <div className="flex items-center gap-3">
                     <Phone size={14} className="text-slate-300" />
                     <span>{client.phone}</span>
                   </div>
                 )}
                 {client.website && (
                   <div className="flex items-center gap-3">
                     <Globe size={14} className="text-slate-300" />
                     <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate text-xs font-semibold">
                       {client.website.replace(/^https?:\/\/(www\.)?/i, '')}
                     </a>
                   </div>
                 )}
                 {client.address && (
                   <div className="flex items-start gap-3">
                     <MapPin size={14} className="text-slate-300 mt-0.5" />
                     <span className="line-clamp-2 text-xs">{client.address}</span>
                   </div>
                 )}
                 {(client.siret || client.tvaNumber) && (
                   <div className="pt-2 border-t border-slate-50/50 text-xs font-mono space-y-1">
                     {client.siret && (
                       <div className="flex justify-between text-slate-400">
                         <span>SIRET:</span>
                         <span className="text-slate-600">{client.siret}</span>
                       </div>
                     )}
                     {client.tvaNumber && (
                       <div className="flex justify-between text-slate-400">
                         <span>N° TVA:</span>
                         <span className="text-slate-600">{client.tvaNumber}</span>
                       </div>
                     )}
                   </div>
                 )}
                 {client.notes && (
                   <div className="flex items-start gap-3 pt-2 border-t border-slate-50 mt-2">
                     <StickyNote size={14} className="text-slate-300 mt-0.5 shrink-0" />
                     <span className="line-clamp-2 text-xs italic text-slate-400">{client.notes}</span>
                   </div>
                 )}
               </div>

               {/* Quick Actions Footer */}
               <div className="mt-auto flex gap-2 pt-4 border-t border-slate-50">
                    <a 
                        href={`mailto:${client.email}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                        <Mail size={14} /> Email
                    </a>
                    {client.phone && (
                        <a 
                            href={`tel:${client.phone}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
                        >
                            <Phone size={14} /> Appeler
                        </a>
                    )}
               </div>
            </div>
          )})}
          
          {processedClients.length === 0 && (
             <div className="col-span-full py-20 text-center">
               <div className="inline-block p-6 rounded-full bg-slate-50 mb-4 animate-pulse">
                   <Users size={32} className="text-slate-300" />
               </div>
               <h3 className="text-slate-900 font-medium mb-1">{showArchived ? 'Aucun client archivé' : 'Aucun client actif'}</h3>
               <p className="text-slate-500 text-sm">{showArchived ? 'Archivez des clients pour les voir ici.' : 'Ajoutez votre premier client pour commencer.'}</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientManager;