import React, { useState, useMemo } from 'react';
import { Supplier, Expense } from '../types';
import { Plus, Search, Trash2, Mail, MapPin, Phone, Truck, Package, X, Edit2, Wallet, ArrowDownRight, Download, SortAsc, StickyNote, Tag, Filter, Globe, Building, CreditCard, User, Calendar, Archive, Check } from 'lucide-react';

interface SupplierManagerProps {
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
  expenses: Expense[];
}

type SortOption = 'name' | 'spending' | 'category';

const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, setSuppliers, expenses }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    email: '',
    address: '',
    phone: '',
    siret: '',
    category: '',
    notes: '',
    tvaNumber: '',
    website: '',
    contactName: '',
    iban: '',
    bic: '',
    paymentDelayDays: 30,
    archived: false
  });

  // --- STATS HELPERS ---

  const getSupplierStats = (supplierId: string) => {
    const supplierExpenses = expenses.filter(exp => exp.supplierId === supplierId);
    const totalSpent = supplierExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    return {
      totalSpent,
      count: supplierExpenses.length
    };
  };

  // --- SORTING & FILTERING ---
  
  // Extraire les catégories uniques pour le filtre
  const categories = useMemo(() => {
    const cats = new Set(suppliers.map(s => s.category).filter(Boolean));
    return Array.from(cats);
  }, [suppliers]);

  const processedSuppliers = useMemo(() => {
    let result = suppliers.filter(s => !!s.archived === showArchived);

    const term = searchTerm.toLowerCase();
    result = result.filter(s => 
      s.name.toLowerCase().includes(term) || 
      (s.category && s.category.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.contactName && s.contactName.toLowerCase().includes(term))
    );

    if (selectedCategory) {
        result = result.filter(s => s.category === selectedCategory);
    }

    return result.sort((a, b) => {
      if (sortBy === 'spending') {
        return getSupplierStats(b.id).totalSpent - getSupplierStats(a.id).totalSpent;
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.name.localeCompare(b.name);
    });
  }, [suppliers, searchTerm, sortBy, selectedCategory, expenses, showArchived]);

  // --- ACTIONS ---

  const openCreate = () => {
    setEditingId(null);
    setFormData({ 
      name: '', 
      email: '', 
      address: '', 
      phone: '', 
      siret: '',
      category: '', 
      notes: '',
      tvaNumber: '',
      website: '',
      contactName: '',
      iban: '',
      bic: '',
      paymentDelayDays: 30,
      archived: false
    });
    setIsPanelOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({ 
      ...supplier,
      paymentDelayDays: supplier.paymentDelayDays ?? 30,
      archived: supplier.archived ?? false
    });
    setIsPanelOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingId) {
        setSuppliers(suppliers.map(s => s.id === editingId ? { ...s, ...formData } as Supplier : s));
    } else {
        const supplier: Supplier = {
            id: Date.now().toString(),
            name: formData.name,
            email: formData.email,
            address: formData.address,
            phone: formData.phone,
            siret: formData.siret,
            category: formData.category,
            notes: formData.notes,
            tvaNumber: formData.tvaNumber,
            website: formData.website,
            contactName: formData.contactName,
            iban: formData.iban,
            bic: formData.bic,
            paymentDelayDays: formData.paymentDelayDays ?? 30,
            archived: false
        };
        setSuppliers([...suppliers, supplier]);
    }
    setIsPanelOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Supprimer ce fournisseur ?')) {
      setSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  const toggleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSuppliers(suppliers.map(s => s.id === id ? { ...s, archived: !s.archived } : s));
  };

  const copyIban = (iban: string, supplierId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(iban);
    setCopiedId(supplierId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportCSV = () => {
    const headers = ['Nom', 'Catégorie', 'Email', 'Téléphone', 'SIRET', 'N° TVA', 'Site Internet', 'Contact Principal', 'IBAN', 'BIC', 'Délai Paiement (jours)', 'Archivé', 'Adresse', 'Notes', 'Total Dépensé'];
    const rows = suppliers.map(s => {
        const stats = getSupplierStats(s.id);
        return [
            `"${s.name}"`,
            `"${s.category || ''}"`,
            `"${s.email || ''}"`,
            `"${s.phone || ''}"`,
            `"${s.siret || ''}"`,
            `"${s.tvaNumber || ''}"`,
            `"${s.website || ''}"`,
            `"${s.contactName || ''}"`,
            `"${s.iban || ''}"`,
            `"${s.bic || ''}"`,
            s.paymentDelayDays ?? 30,
            s.archived ? 'Oui' : 'Non',
            `"${s.address?.replace(/\n/g, ' ') || ''}"`,
            `"${s.notes?.replace(/\n/g, ' ') || ''}"`,
            stats.totalSpent.toFixed(2)
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fournisseurs_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Fournisseurs</h2>
          <p className="text-slate-500">Gérez vos partenaires et suivez vos achats.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={exportCSV}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium shadow-sm"
                title="Exporter en CSV"
            >
                <Download size={18} />
                <span className="hidden sm:inline">Export</span>
            </button>
            <button 
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 font-medium"
            >
            <Plus size={18} />
            <span className="hidden sm:inline">Nouveau Fournisseur</span>
            <span className="sm:hidden">Nouveau</span>
            </button>
        </div>
      </div>

       {/* Side Panel Form */}
       <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 border-l border-slate-100 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
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
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
                        value={formData.name || ''}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Grossiste France SAS"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catégorie d'achat</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.category || ''}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            placeholder="Ex: Logiciel, Matériel, Cloud..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Interlocuteur principal</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.contactName || ''}
                            onChange={e => setFormData({...formData, contactName: e.target.value})}
                            placeholder="Mme. Sophie Laurent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email de contact</label>
                        <input 
                            type="email" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.email || ''}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder="contact@fournisseur.com"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
                        <input 
                            type="tel" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.phone || ''}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            placeholder="01 45 67 89 00"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">N° de SIRET</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-slate-800 animate-fade-in"
                            value={formData.siret || ''}
                            onChange={e => setFormData({...formData, siret: e.target.value})}
                            placeholder="14 chiffres"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Numéro de TVA</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-slate-800"
                            value={formData.tvaNumber || ''}
                            onChange={e => setFormData({...formData, tvaNumber: e.target.value})}
                            placeholder="FRXX999999999"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Délai de paiement (jours)</label>
                        <input 
                            type="number" 
                            min="0"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.paymentDelayDays ?? 30}
                            onChange={e => setFormData({...formData, paymentDelayDays: parseInt(e.target.value) || 0})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Site internet</label>
                        <input 
                            type="url" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800"
                            value={formData.website || ''}
                            onChange={e => setFormData({...formData, website: e.target.value})}
                            placeholder="https://partenaire.com"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard size={16} className="text-blue-500" />
                        Coordonnées bancaires de règlement
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">IBAN</label>
                            <input 
                                type="text" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-xs uppercase text-slate-800"
                                value={formData.iban || ''}
                                onChange={e => setFormData({...formData, iban: e.target.value.replace(/\s/g, '').toUpperCase()})}
                                placeholder="FR76 3000..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">BIC / SWIFT</label>
                            <input 
                                type="text" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-xs uppercase text-slate-800"
                                value={formData.bic || ''}
                                onChange={e => setFormData({...formData, bic: e.target.value.replace(/\s/g, '').toUpperCase()})}
                                placeholder="ABCHFR22XXX"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse du siège / postale</label>
                    <textarea 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-slate-800"
                        rows={3}
                        value={formData.address || ''}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="12 rue de l'Innovation, 69000 Lyon"
                    />
                </div>

                {editingId && (
                    <div className="pt-4 border-t border-slate-150 flex items-center justify-between">
                        <div>
                            <span className="block text-sm font-semibold text-slate-700">Archiver le partenaire</span>
                            <span className="block text-xs text-slate-400">Masquer temporairement de la liste active</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={formData.archived || false}
                                onChange={e => setFormData({...formData, archived: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                        <StickyNote size={14} className="text-slate-400"/> Notes privées (Ref client, SAV...)
                    </label>
                    <textarea 
                        className="w-full p-3 bg-yellow-50/50 border border-yellow-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 outline-none transition-all resize-none text-sm text-slate-700"
                        rows={3}
                        value={formData.notes || ''}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        placeholder="Ex: Identifiant ID-98273"
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
                    {editingId ? 'Mettre à jour' : 'Enregistrer'}
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

      {/* List */}
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                type="text" 
                placeholder="Rechercher par nom, catégorie, contact, email..."
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white shadow-sm transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-2xl shadow-sm">
                    <Filter size={18} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-600">Filtre:</span>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer w-28"
                    >
                        <option value="">Toutes</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat as string}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-2xl shadow-sm">
                    <SortAsc size={18} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-600">Trier:</span>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        <option value="name">Nom (A-Z)</option>
                        <option value="spending">Dépenses (Total)</option>
                        <option value="category">Catégorie</option>
                    </select>
                </div>

                <button 
                    onClick={() => setShowArchived(!showArchived)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-2xl shadow-sm font-semibold text-sm transition-all ${
                        showArchived 
                        ? 'bg-amber-500 border-amber-500 text-white' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Archive size={16} />
                    <span>{showArchived ? 'Masquer les archivés' : 'Voir les archivés'}</span>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedSuppliers.map(supplier => {
            const stats = getSupplierStats(supplier.id);
            return (
            <div 
                key={supplier.id} 
                className={`bg-white border rounded-3xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 group relative flex flex-col ${
                  supplier.archived 
                    ? 'border-slate-200 bg-slate-50/50 opacity-80' 
                    : 'border-slate-100 hover:border-amber-200'
                }`}
            >
               {/* Actions Top Right */}
               <div className="absolute top-5 right-5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                        onClick={() => openEdit(supplier)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Modifier"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={(e) => toggleArchive(supplier.id, e)}
                        className={`p-2 rounded-xl transition-colors ${
                          supplier.archived 
                            ? 'text-amber-600 hover:bg-amber-50' 
                            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                        title={supplier.archived ? "Désarchiver" : "Archiver"}
                    >
                        <Archive size={16} />
                    </button>
                    <button 
                        onClick={(e) => handleDelete(supplier.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Supprimer"
                    >
                        <Trash2 size={16} />
                    </button>
               </div>
               
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-sm shrink-0">
                   <Truck size={28} className="opacity-90" />
                 </div>
                 <div className="overflow-hidden">
                   <h4 className="font-bold text-slate-900 truncate pr-16 text-lg" title={supplier.name}>{supplier.name}</h4>
                   <div className="flex flex-wrap gap-1.5 mt-1">
                     {supplier.category && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50/70 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={10} />
                          {supplier.category}
                        </span>
                     )}
                     {supplier.archived && (
                       <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                         Archivé
                       </span>
                     )}
                     {supplier.paymentDelayDays !== undefined && (
                       <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full" title="Délai de règlement convenu">
                         {supplier.paymentDelayDays === 0 ? 'Paiement immédiat' : `${supplier.paymentDelayDays}j`}
                       </span>
                     )}
                   </div>
                 </div>
               </div>
               
               {/* Mini Stats */}
               <div className="mb-6 pb-6 border-b border-slate-50">
                    <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 flex items-center gap-1">
                                <Wallet size={10} /> Total Dépensé
                            </p>
                            <p className="font-bold text-slate-900">{stats.totalSpent.toFixed(2)} €</p>
                        </div>
                        <div className="text-right">
                             <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Transactions</p>
                             <p className="font-bold text-slate-900">{stats.count}</p>
                        </div>
                    </div>
               </div>
               
               <div className="space-y-2.5 text-sm text-slate-500 mb-6 flex-1">
                 {supplier.contactName && (
                   <div className="flex items-center gap-3">
                     <User size={14} className="text-slate-300" />
                     <span className="text-slate-700 font-medium text-xs">{supplier.contactName} <span className="text-[11px] text-slate-400 font-normal">(Contact)</span></span>
                   </div>
                 )}
                 {supplier.website && (
                   <div className="flex items-center gap-3">
                     <Globe size={14} className="text-slate-300" />
                     <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate text-sm font-semibold">
                       {supplier.website.replace(/^https?:\/\/(www\.)?/i, '')}
                     </a>
                   </div>
                 )}
                 {supplier.address && (
                   <div className="flex items-start gap-3">
                     <MapPin size={14} className="text-slate-300 mt-0.5" />
                     <span className="line-clamp-2 text-xs text-slate-600">{supplier.address}</span>
                   </div>
                 )}

                 {/* IBAN copiable */}
                 {supplier.iban && (
                   <div className="mt-3 pt-3 border-t border-slate-100">
                     <div 
                       onClick={(e) => copyIban(supplier.iban!, supplier.id, e)}
                       className="flex items-center justify-between p-2 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/50 rounded-xl cursor-pointer transition-all group/iban"
                       title="Cliquer pour copier l'IBAN"
                     >
                       <div className="flex items-center gap-2 overflow-hidden">
                         <CreditCard size={13} className="text-slate-400 group-hover/iban:text-blue-500 shrink-0" />
                         <span className="font-mono text-[11px] text-slate-600 truncate uppercase tracking-wider">
                           {supplier.iban.replace(/(.{4})/g, '$1 ')}
                         </span>
                       </div>
                       <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 shrink-0 bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded-md ml-2">
                         {copiedId === supplier.id ? (
                           <span className="text-emerald-600 flex items-center gap-1">
                             <Check size={10} /> Copié !
                           </span>
                         ) : 'Copier'}
                       </button>
                     </div>
                     {supplier.bic && (
                       <div className="flex justify-between px-2 mt-1 text-[10px] font-mono text-slate-400 uppercase">
                         <span>BIC / SWIFT :</span>
                         <span>{supplier.bic}</span>
                       </div>
                     )}
                   </div>
                 )}

                 {/* SIRET & TVA */}
                 {(supplier.siret || supplier.tvaNumber) && (
                   <div className="pt-2 border-t border-slate-100 text-[11px] font-mono space-y-1">
                     {supplier.siret && (
                       <div className="flex justify-between text-slate-400 font-bold">
                         <span>SIRET :</span>
                         <span className="text-slate-600 font-normal">{supplier.siret}</span>
                       </div>
                     )}
                     {supplier.tvaNumber && (
                       <div className="flex justify-between text-slate-400 font-bold">
                         <span>N° TVA :</span>
                         <span className="text-slate-600 font-normal">{supplier.tvaNumber}</span>
                       </div>
                     )}
                   </div>
                 )}

                 {supplier.notes && (
                   <div className="flex items-start gap-3 pt-2.5 border-t border-slate-100 mt-1">
                     <StickyNote size={13} className="text-slate-400 mt-0.5 shrink-0" />
                     <p className="text-xs text-slate-500 italic line-clamp-2">{supplier.notes}</p>
                   </div>
                 )}
               </div>

                {/* Quick Actions Footer */}
               <div className="mt-auto flex gap-2 pt-4 border-t border-slate-50">
                    {supplier.email ? (
                    <a 
                        href={`mailto:${supplier.email}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                        <Mail size={14} /> Email
                    </a>
                    ) : (
                        <span className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-300 text-xs font-semibold cursor-not-allowed">
                             <Mail size={14} /> Email
                        </span>
                    )}
                    {supplier.phone ? (
                        <a 
                            href={`tel:${supplier.phone}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
                        >
                            <Phone size={14} /> Appeler
                        </a>
                    ) : (
                         <span className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 text-slate-300 text-xs font-semibold cursor-not-allowed">
                             <Phone size={14} /> Appeler
                        </span>
                    )}
               </div>
            </div>
          )})}
          
          {processedSuppliers.length === 0 && (
             <div className="col-span-full py-20 text-center">
               <div className="inline-block p-6 rounded-full bg-slate-50 mb-4 animate-pulse">
                   <Package size={32} className="text-slate-300" />
               </div>
               <h3 className="text-slate-900 font-medium mb-1">Aucun fournisseur trouvé</h3>
               <p className="text-slate-500 text-sm">Ajoutez votre premier partenaire pour commencer.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierManager;