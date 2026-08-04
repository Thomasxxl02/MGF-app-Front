import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { 
  Plus, Search, Trash2, Package, Briefcase, X, Edit2, Zap, Download, SortAsc, 
  Tag, Percent, DollarSign, Scale, FolderOpen, Layers, Info, Check, RefreshCw 
} from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
}

type SortOption = 'name' | 'price' | 'type' | 'stock' | 'reference';

const ProductManager: React.FC<ProductManagerProps> = ({ products, setProducts }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    reference: '',
    description: '',
    price: 0,
    purchasePrice: 0,
    type: 'service',
    vatRate: 20,
    unit: 'unité',
    category: '',
    stockQuantity: 0,
    trackStock: false
  });

  // Générateur de référence automatique
  const generateRef = () => {
    const prefix = formData.type === 'service' ? 'SRV' : 'ART';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, reference: `${prefix}-${randNum}` }));
  };

  const openCreate = () => {
    setEditingId(null);
    const prefix = 'SRV';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setFormData({ 
      name: '', 
      reference: `${prefix}-${randNum}`,
      description: '', 
      price: 0, 
      purchasePrice: 0,
      type: 'service',
      vatRate: 20,
      unit: 'unité',
      category: '',
      stockQuantity: 0,
      trackStock: false
    });
    setIsPanelOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({ 
      ...product,
      reference: product.reference || `ART-${product.id.slice(-4)}`,
      vatRate: product.vatRate ?? 20,
      unit: product.unit ?? 'unité',
      purchasePrice: product.purchasePrice ?? 0,
      category: product.category ?? '',
      stockQuantity: product.stockQuantity ?? 0,
      trackStock: product.trackStock ?? false
    });
    setIsPanelOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const updatedProduct: Product = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      description: formData.description || '',
      price: Number(formData.price) || 0,
      type: (formData.type || 'service') as 'service' | 'product',
      reference: formData.reference || `ART-${Date.now().toString().slice(-4)}`,
      vatRate: Number(formData.vatRate) ?? 20,
      purchasePrice: Number(formData.purchasePrice) || 0,
      unit: formData.unit || 'unité',
      category: formData.category || '',
      stockQuantity: Number(formData.stockQuantity) || 0,
      trackStock: !!formData.trackStock
    };

    if (editingId) {
         setProducts(products.map(p => p.id === editingId ? updatedProduct : p));
    } else {
         setProducts([...products, updatedProduct]);
    }
    setIsPanelOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Supprimer cet élément du catalogue ?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const copyRefToClipboard = (ref: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ref);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = useMemo(() => {
    const list = products.map(p => p.category).filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [products]);

  const exportCSV = () => {
    const headers = ['Référence', 'Nom', 'Type', 'Catégorie', 'Prix Vente HT', 'Coût Achat HT', 'TVA %', 'Unité', 'Stock', 'Description'];
    const rows = products.map(p => [
        `"${p.reference || ''}"`,
        `"${p.name}"`,
        `"${p.type === 'service' ? 'Prestation' : 'Marchandise'}"`,
        `"${p.category || ''}"`,
        p.price.toFixed(2),
        (p.purchasePrice || 0).toFixed(2),
        (p.vatRate ?? 20).toString(),
        `"${p.unit || 'unité'}"`,
        p.trackStock ? p.stockQuantity ?? 0 : 'N/A',
        `"${p.description.replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `catalogue_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processedProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let result = products.filter(p => 
      (p.name || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term) ||
      (p.reference || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );

    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    return result.sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price;
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      if (sortBy === 'reference') return (a.reference || '').localeCompare(b.reference || '');
      if (sortBy === 'stock') {
        const aStock = a.trackStock ? a.stockQuantity ?? 0 : 9999;
        const bStock = b.trackStock ? b.stockQuantity ?? 0 : 9999;
        return aStock - bStock;
      }
      return a.name.localeCompare(b.name);
    });
  }, [products, searchTerm, sortBy, selectedCategory]);

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto relative">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Catalogue</h2>
          <p className="text-slate-500">Gérez vos produits, marchandises et prestations de service.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={exportCSV}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium shadow-sm cursor-pointer"
                title="Exporter en CSV"
            >
                <Download size={18} />
                <span className="hidden sm:inline">Exporter</span>
            </button>
            <button 
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 font-medium cursor-pointer"
            >
                <Plus size={18} />
                <span>Nouvel Elément</span>
            </button>
        </div>
      </div>

       {/* Formulaire dans un panneau latéral (Side Panel) */}
       <div className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 border-l border-slate-100 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    {formData.type === 'service' ? <Briefcase size={20} /> : <Package size={20} />}
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-slate-900">{editingId ? 'Modifier l\'élément' : 'Ajouter au catalogue'}</h3>
                    <p className="text-xs text-slate-400">Renseignez les détails de l'article ou service</p>
                  </div>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer">
                    <X size={20} />
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Type de produit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Type de prestation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'service' })}
                      className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        formData.type === 'service' 
                          ? 'border-blue-600 bg-blue-50/30 text-blue-700 font-bold' 
                          : 'border-slate-100 hover:border-slate-200 text-slate-600 font-medium'
                      }`}
                    >
                      <Briefcase size={20} className={formData.type === 'service' ? "text-blue-600" : "text-slate-400"} />
                      <span className="text-sm">Prestation / Service</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'product' })}
                      className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        formData.type === 'product' 
                          ? 'border-purple-600 bg-purple-50/30 text-purple-700 font-bold' 
                          : 'border-slate-100 hover:border-slate-200 text-slate-600 font-medium'
                      }`}
                    >
                      <Package size={20} className={formData.type === 'product' ? "text-purple-600" : "text-slate-400"} />
                      <span className="text-sm">Produit / Marchandise</span>
                    </button>
                  </div>
                </div>

                {/* Section Identification */}
                <div className="space-y-4 pt-2 border-t border-slate-50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identification technique</h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Référence */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                          <span>Référence / SKU</span>
                          <button 
                            type="button" 
                            onClick={generateRef}
                            className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            title="Regénérer un code aléatoire"
                          >
                            <RefreshCw size={10} /> Auto
                          </button>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: SRV-405"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm uppercase tracking-wider transition-all"
                            value={formData.reference}
                            onChange={e => setFormData({...formData, reference: e.target.value})}
                        />
                    </div>

                    {/* Catégorie */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Catégorie</label>
                        <input 
                            type="text" 
                            list="form-categories"
                            placeholder="Ex: Matériel"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        />
                        <datalist id="form-categories">
                          {categories.map(c => <option key={c} value={c} />)}
                          <option value="Développement" />
                          <option value="Licence SaaS" />
                          <option value="Consulting" />
                          <option value="Matériel IT" />
                          <option value="Formation" />
                        </datalist>
                    </div>
                  </div>

                  {/* Nom de l'élément */}
                  <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Désignation commerciale <span className="text-red-500">*</span></label>
                      <input 
                          type="text" 
                          required
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-sm font-semibold"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="Ex: Conseil Architecture Azure Cloud"
                      />
                  </div>
                </div>

                {/* Section Financière */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tarification & Rentabilité</h4>
                    <span className="text-[10px] text-slate-400 font-mono italic">(Hors Taxes)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {/* Prix de vente */}
                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">Prix de vente public (€ HT) <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="number" 
                                required
                                min="0"
                                step="0.01"
                                className="w-full pl-8 pr-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-semibold text-slate-900 transition-all font-mono"
                                value={formData.price || ''}
                                onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                      </div>

                      {/* Coût d'achat */}
                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">Usage / Coût d'achat (€ HT)</label>
                          <div className="relative">
                            <Scale size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                className="w-full pl-8 pr-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all font-mono"
                                value={formData.purchasePrice || ''}
                                onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})}
                                placeholder="Coût fournisseur"
                            />
                          </div>
                      </div>
                  </div>

                  {/* Analyseur de Marge en Direct */}
                  {((Number(formData.price) || 0) > 0 || (Number(formData.purchasePrice) || 0) > 0) && (
                    <div className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      (Number(formData.price) || 0) - (Number(formData.purchasePrice) || 0) < 0
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : (Number(formData.price) || 0) - (Number(formData.purchasePrice) || 0) === (Number(formData.price) || 0)
                          ? 'bg-slate-50 border-slate-200/60 text-slate-700'
                          : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Percent size={14} className="opacity-70" />
                        <span className="text-xs font-bold">Marge brute estimée :</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold block">
                          +{((Number(formData.price) || 0) - (Number(formData.purchasePrice) || 0)).toFixed(2)} €
                        </span>
                        <span className="text-[10px] font-semibold opacity-80 block">
                          {Number(formData.price) > 0 
                            ? `${(((Number(formData.price) || 0) - (Number(formData.purchasePrice) || 0)) / (Number(formData.price) || 0) * 100).toFixed(0)}%` 
                            : '0%'
                          } de marge commerciale
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* Taux TVA */}
                      <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">TVA applicable (%)</label>
                          <select
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none bg-white font-semibold text-slate-800"
                              value={formData.vatRate}
                              onChange={e => setFormData({...formData, vatRate: parseFloat(e.target.value)})}
                          >
                              <option value="20">20% (Taux normal)</option>
                              <option value="10">10% (Taux réduit)</option>
                              <option value="5.5">5.5% (Taux particulier)</option>
                              <option value="2.1">2.1% (Médicaments/Presse)</option>
                              <option value="0">0% (Exonération Art. 293B)</option>
                          </select>
                      </div>

                      {/* Unité de facturation */}
                      <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">Unité de mesure</label>
                          <select
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none bg-white font-semibold text-slate-800"
                              value={formData.unit}
                              onChange={e => setFormData({...formData, unit: e.target.value})}
                          >
                              <option value="unité">unité(s) (u)</option>
                              <option value="heure">heure(s) (h)</option>
                              <option value="jour">jour(s) (j)</option>
                              <option value="forfait">forfait (forf.)</option>
                              <option value="mois">mois (m)</option>
                              <option value="an">an(s)</option>
                              <option value="km">kilomètre(s) (km)</option>
                              <option value="mètre">mètre(s) (m)</option>
                              <option value="kg">kilogramme(s) (kg)</option>
                          </select>
                      </div>
                  </div>
                </div>

                {/* Section Stock - Only shown/emphasized for merchandise products */}
                {formData.type === 'product' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 bg-purple-50/20 -mx-6 px-6 py-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} className="text-purple-600" />
                        <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Suivi d'inventaire</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={formData.trackStock || false}
                          onChange={e => setFormData({...formData, trackStock: e.target.checked})}
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {formData.trackStock && (
                      <div className="grid grid-cols-2 gap-4 animate-fade-in">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Stock actuel initial</label>
                          <input 
                            type="number" 
                            min="0"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 outline-none text-sm transition-all font-mono"
                            value={formData.stockQuantity || ''}
                            onChange={e => setFormData({...formData, stockQuantity: parseInt(e.target.value) || 0})}
                            placeholder="Ex: 50"
                          />
                        </div>
                        <div className="flex items-center">
                          <p className="text-[11px] text-slate-500 italic mt-3 leading-tight leading-4">
                            Les factures d'achat pourront incrémenter et les devis validés débiteront le stock disponible.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Description de l'élément */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Description à afficher sur les documents</label>
                    <textarea 
                        rows={4}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all resize-none placeholder:text-slate-400 placeholder:italic"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Ex: Prestation complète d'accompagnement conseil ou modèle descriptif..."
                    />
                </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                 <button 
                    type="button" 
                    onClick={() => setIsPanelOpen(false)}
                    className="px-6 py-2.5 text-slate-600 hover:bg-white border border-slate-200/60 rounded-xl font-medium transition-all text-sm cursor-pointer"
                >
                    Annuler
                </button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg shadow-blue-200 transition-all hover:scale-[1.01] text-sm cursor-pointer"
                >
                    {editingId ? 'Mettre à jour' : 'Ajouter au catalogue'}
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

      {/* Liste des éléments du catalogue */}
      <div className="space-y-6">
        {/* Barre de recherche, filtrage et tri */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Recherche textuelle */}
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Rechercher par désignation, référence ou catégorie..."
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white shadow-sm transition-all text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            {/* Tri et Filtre Catégorie */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtre Catégorie */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white px-3.5 py-2.5 border border-slate-200 rounded-2xl shadow-sm">
                  <FolderOpen size={16} className="text-slate-400" />
                  <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
                  >
                      <option value="">Tous les dossiers</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Critères de tri */}
              <div className="flex items-center gap-1.5 bg-white px-3.5 py-2.5 border border-slate-200 rounded-2xl shadow-sm">
                  <SortAsc size={16} className="text-slate-400" />
                  <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
                  >
                      <option value="name">Désignation (A-Z)</option>
                      <option value="price">Prix vente (Décroissant)</option>
                      <option value="reference">Référence (A-Z)</option>
                      <option value="type">Type</option>
                      <option value="stock">Niveau de stock</option>
                  </select>
              </div>
            </div>
        </div>

        {/* Grille d'affichage */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {processedProducts.map(p => {
              const pPrice = p.price || 0;
              const pPurchasePrice = p.purchasePrice || 0;
              const pVatRate = p.vatRate ?? 20;
              const pVatAmount = pPrice * (pVatRate / 100);
              const pPriceTtc = pPrice + pVatAmount;
              const pMargin = pPrice - pPurchasePrice;
              const pMarginPercent = pPrice > 0 ? Math.round((pMargin / pPrice) * 100) : 0;

              return (
                <div 
                    key={p.id} 
                    className="bg-white border border-slate-100 rounded-3xl p-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all duration-300 group relative flex flex-col"
                >
                     {/* Actions Top Right */}
                    <div className="absolute top-5 right-5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/95 p-1 rounded-xl shadow-sm border border-slate-100">
                        <button 
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            title="Modifier l'élément"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(p.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Supprimer du catalogue"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <div className="flex items-start justify-between mb-4">
                        <div className={`
                            w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm
                            ${p.type === 'service' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}
                        `}>
                            {p.type === 'service' ? <Briefcase size={20} /> : <Package size={20} />}
                        </div>

                        {/* Référence Copiable */}
                        <div 
                          onClick={(e) => copyRefToClipboard(p.reference || p.id, p.id, e)}
                          className="font-mono text-[10px] bg-slate-50 border border-slate-200/60 px-2 py-1 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-all flex items-center gap-1 uppercase font-bold tracking-wider"
                          title="Cliquer pour copier la référence"
                        >
                          {copiedId === p.id ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check size={9} /> COPIÉ
                            </span>
                          ) : (
                            <span>{p.reference || `REF-${p.id.slice(-4)}`}</span>
                          )}
                        </div>
                    </div>

                    <div className="mb-4 flex-1">
                         <div className="flex flex-wrap gap-1.5 mb-2">
                            {/* Type de produit */}
                            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
                                ${p.type === 'service' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}
                            `}>
                                {p.type === 'service' ? 'Service' : 'Marchandise'}
                            </span>

                            {/* Dossier / Catégorie */}
                            {p.category && (
                              <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-0.5">
                                <Tag size={8} />
                                {p.category}
                              </span>
                            )}

                            {/* Unité de mesure */}
                            {p.unit && (
                              <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-150">
                                {p.unit === 'unité' ? 'à l\'unité' : `par ${p.unit}`}
                              </span>
                            )}
                         </div>

                        {/* Nom de l'élément */}
                        <h4 className="font-bold text-slate-900 text-base leading-tight mb-1.5 pr-8 truncate" title={p.name}>{p.name}</h4>
                        
                        {/* Description */}
                        <p className="text-xs text-slate-500 line-clamp-2 h-8 leading-relaxed mb-3">
                          {p.description || "Aucune description de facturation enregistrée dans le catalogue."}
                        </p>

                        {/* Indicateurs Supplémentaires (Stock & Marges) */}
                        <div className="space-y-1.5 pt-3 border-t border-slate-50">
                          {/* Affichage d'inventaire */}
                          {p.trackStock ? (
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400 font-medium">Quantité en stock :</span>
                              <span className={`px-2 py-0.5 rounded-md font-bold font-mono ${
                                (p.stockQuantity ?? 0) === 0 
                                  ? 'bg-red-50 text-red-600 border border-red-100' 
                                  : (p.stockQuantity ?? 0) <= 5 
                                    ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {(p.stockQuantity ?? 0) === 0 ? 'Rupture' : `${p.stockQuantity} dispos`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-[10px] text-slate-400 italic">
                              <span>Inventaire :</span>
                              <span>Non géré (illimité)</span>
                            </div>
                          )}

                          {/* Affichage de la rentabilité */}
                          {pPurchasePrice > 0 && (
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400 font-medium">Rentabilité brute :</span>
                              <span className={`font-semibold shrink-0 flex items-center gap-0.5 ${pMarginPercent > 40 ? 'text-emerald-600' : 'text-blue-500'}`}>
                                <Percent size={10} /> {pMarginPercent}% marge
                              </span>
                            </div>
                          )}
                        </div>
                    </div>

                    {/* Footer Tarification */}
                    <div className="mt-auto pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">HT unitaire</span>
                        <span className="text-lg font-extrabold text-slate-900 font-mono tracking-tight">{pPrice.toFixed(2)} €</span>
                      </div>
                      
                      {/* Ligne Infos Complémentaires (TTC / TVA) */}
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>TVA {pVatRate}%</span>
                        <span>{pPriceTtc.toFixed(2)} € TTC</span>
                      </div>
                    </div>
                </div>
              );
            })}
            
            {processedProducts.length === 0 && (
                 <div className="col-span-full py-20 text-center">
                    <div className="inline-block p-6 rounded-full bg-slate-50 mb-4 animate-pulse">
                        <Zap size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-slate-900 font-medium mb-1">Catalogue de produits vide</h3>
                    <p className="text-slate-500 text-sm">Aucun produit ou prestation ne correspond à vos filtres de recherche.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProductManager;