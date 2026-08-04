import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { 
  Building2, Plus, Check, Trash2, Edit2, Globe, Mail, Phone, 
  MapPin, Landmark, Settings, Calendar, FileText, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCompanies, createCompany, updateCompany, deleteCompany, selectActiveCompany, getActiveCompanyId } from '../services/tauri';

interface CompanyManagerProps {
  onCompanySwitched: (companyId: string) => void;
  currentThemeColor?: 'blue' | 'emerald' | 'violet' | 'amber' | 'neutral';
}

export const CompanyManager: React.FC<CompanyManagerProps> = ({ 
  onCompanySwitched,
  currentThemeColor = 'blue'
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  // Form State
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [siren, setSiren] = useState('');
  const [siret, setSiret] = useState('');
  const [tvaNumber, setTvaNumber] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [logo, setLogo] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [paymentTerms, setPaymentTerms] = useState('Règlement à réception');
  const [paymentDelayDays, setPaymentDelayDays] = useState(30);
  const [invoicePrefix, setInvoicePrefix] = useState('FAC');
  const [quotePrefix, setQuotePrefix] = useState('DEV');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load Companies
  const loadCompaniesData = async () => {
    try {
      const list = await getCompanies();
      setCompanies(list);
      const currentActive = getActiveCompanyId();
      setActiveId(currentActive);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des entreprises.');
    }
  };

  useEffect(() => {
    loadCompaniesData();
  }, []);

  const handleSwitchCompany = async (id: string) => {
    try {
      await selectActiveCompany(id);
      setActiveId(id);
      onCompanySwitched(id);
      setSuccess('Entreprise activée avec succès !');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement d\'entreprise.');
    }
  };

  const openCreateForm = () => {
    setEditingCompany(null);
    setCompanyName('');
    setTradeName('');
    setSiren('');
    setSiret('');
    setTvaNumber('');
    setAddress('');
    setPostalCode('');
    setCity('');
    setCountry('France');
    setEmail('');
    setPhone('');
    setWebsite('');
    setBankAccount('');
    setIban('');
    setBic('');
    setLogo('');
    setCurrency('EUR');
    setPaymentTerms('Règlement à réception');
    setPaymentDelayDays(30);
    setInvoicePrefix('FAC');
    setQuotePrefix('DEV');
    setError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (company: Company) => {
    setEditingCompany(company);
    setCompanyName(company.companyName);
    setTradeName(company.tradeName || '');
    setSiren(company.siren || '');
    setSiret(company.siret);
    setTvaNumber(company.tvaNumber || '');
    setAddress(company.address);
    setPostalCode(company.postalCode);
    setCity(company.city);
    setCountry(company.country);
    setEmail(company.email);
    setPhone(company.phone);
    setWebsite(company.website || '');
    setBankAccount(company.bankAccount || '');
    setIban(company.iban || '');
    setBic(company.bic || '');
    setLogo(company.logo || '');
    setCurrency(company.currency);
    setPaymentTerms(company.paymentTerms || '');
    setPaymentDelayDays(company.paymentDelayDays || 30);
    setInvoicePrefix(company.invoicePrefix || 'FAC');
    setQuotePrefix(company.quotePrefix || 'DEV');
    setError(null);
    setIsFormOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('La raison sociale est obligatoire.');
      return;
    }
    if (!siret.trim()) {
      setError('Le numéro SIRET est obligatoire.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Une adresse email de contact valide est requise.');
      return;
    }

    try {
      const companyData = {
        companyName,
        tradeName: tradeName || undefined,
        siren: siren || undefined,
        siret,
        tvaNumber: tvaNumber || undefined,
        address,
        postalCode,
        city,
        country,
        email,
        phone,
        website: website || undefined,
        bankAccount: bankAccount || undefined,
        iban: iban || undefined,
        bic: bic || undefined,
        logo: logo || undefined,
        currency,
        paymentTerms: paymentTerms || undefined,
        paymentDelayDays: Number(paymentDelayDays),
        invoicePrefix,
        quotePrefix,
        themeColor: editingCompany?.themeColor || 'blue'
      };

      if (editingCompany) {
        await updateCompany({
          ...editingCompany,
          ...companyData
        });
        setSuccess('Entreprise modifiée avec succès.');
      } else {
        await createCompany(companyData);
        setSuccess('Nouvelle entreprise créée avec succès.');
      }

      setIsFormOpen(false);
      loadCompaniesData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (companies.length <= 1) {
      setError('Impossible de supprimer la seule entreprise restante.');
      return;
    }
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible et supprimera TOUTES ses données associées (factures, clients, produits, dépenses).')) {
      try {
        await deleteCompany(id);
        setSuccess('Entreprise supprimée avec succès.');
        loadCompaniesData();
        onCompanySwitched(getActiveCompanyId());
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        setError(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  // Theme styling mapping
  const themeClasses: Record<string, { btnBg: string, border: string, badgeBg: string, activeCardBorder: string }> = {
    blue: { btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/10', border: 'border-blue-200', badgeBg: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30', activeCardBorder: 'border-blue-500 ring-2 ring-blue-500/10' },
    emerald: { btnBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/10', border: 'border-emerald-200', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30', activeCardBorder: 'border-emerald-500 ring-2 ring-emerald-500/10' },
    violet: { btnBg: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/10', border: 'border-indigo-200', badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30', activeCardBorder: 'border-indigo-500 ring-2 ring-indigo-500/10' },
    amber: { btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/10', border: 'border-amber-200', badgeBg: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30', activeCardBorder: 'border-amber-500 ring-2 ring-amber-500/10' },
    neutral: { btnBg: 'bg-slate-900 hover:bg-slate-950 focus:ring-slate-500/10', border: 'border-slate-200', badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', activeCardBorder: 'border-slate-900 ring-2 ring-slate-900/10' }
  };

  const activeTheme = themeClasses[currentThemeColor] || themeClasses.blue;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="text-blue-500" size={24} />
            Gestion Multi-Entreprises
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Gérez plusieurs structures commerciales de façon 100% cloisonnée et sécurisée.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className={`flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 ${activeTheme.btnBg}`}
        >
          <Plus size={16} />
          Créer une Entreprise
        </button>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400 text-sm"
          >
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-start gap-3 text-emerald-700 dark:text-emerald-400 text-sm"
          >
            <Check className="shrink-0 mt-0.5" size={16} />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {companies.map((company) => {
          const isActive = company.id === activeId;
          return (
            <motion.div
              key={company.id}
              layout
              className={`bg-white dark:bg-slate-900 border ${isActive ? activeTheme.activeCardBorder : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'} rounded-2xl shadow-sm p-5 transition-all duration-200 flex flex-col justify-between relative overflow-hidden`}
            >
              {/* Background gradient hint */}
              {isActive && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
              )}

              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${isActive ? 'bg-blue-550 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'} font-black text-lg flex items-center justify-center w-12 h-12 shadow-sm`}>
                      {company.logo ? (
                        <img src={company.logo} alt="Logo" className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                      ) : (
                        company.companyName.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                        {company.companyName}
                        {company.tradeName && (
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            ({company.tradeName})
                          </span>
                        )}
                      </h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-mono mt-0.5">
                        SIRET: {company.siret}
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${activeTheme.badgeBg} flex items-center gap-1`}>
                      <Check size={10} className="stroke-[3]" /> Actif
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitchCompany(company.id)}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Activer <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                <hr className="my-4 border-slate-100 dark:border-slate-800/60" />

                {/* Company Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{company.address}, {company.postalCode} {company.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{company.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span>{company.phone}</span>
                  </div>
                  {company.website && (
                    <div className="flex items-center gap-2">
                      <Globe size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{company.website}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Landmark size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate font-mono">{company.iban || 'IBAN non renseigné'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-slate-400 shrink-0" />
                    <span>Devise : <strong>{company.currency}</strong> | Pref : <strong>{company.invoicePrefix}</strong></span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditForm(company)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                  title="Modifier l'entreprise"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDeleteCompany(company.id)}
                  disabled={isActive || companies.length <= 1}
                  className={`p-2 rounded-xl transition-all ${isActive || companies.length <= 1 ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'}`}
                  title="Supprimer l'entreprise"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Creation / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 size={20} className="text-blue-500" />
                {editingCompany ? 'Modifier la structure' : 'Créer une nouvelle structure'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-6 space-y-6">
              {/* Profile identity info */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identité de l'entreprise</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Raison sociale *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: ACME SAS"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nom commercial</label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ex: Acme Consulting"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">SIREN</label>
                    <input
                      type="text"
                      value={siren}
                      onChange={(e) => setSiren(e.target.value)}
                      placeholder="9 chiffres"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">SIRET *</label>
                    <input
                      type="text"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      placeholder="14 chiffres"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Numéro de TVA Intracommunautaire</label>
                    <input
                      type="text"
                      value={tvaNumber}
                      onChange={(e) => setTvaNumber(e.target.value)}
                      placeholder="Ex: FR89123456789"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">URL Logo (ou Base64)</label>
                    <input
                      type="text"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Address & Contact */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Coordonnées de l'entreprise</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Adresse</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ex: 12 Rue de la Paix"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Code postal</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Ex: 75001"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Ville</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: Paris"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pays</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Ex: France"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Email de contact *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@acme.com"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Téléphone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 01 02 03 04 05"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Site internet</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://acme.com"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Coordonnées Bancaires</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">IBAN</label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => {
                        setIban(e.target.value);
                        setBankAccount(e.target.value);
                      }}
                      placeholder="Ex: FR76 ..."
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Code BIC</label>
                    <input
                      type="text"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      placeholder="Ex: TRNFR2BXXX"
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Financial & Invoicing Defaults */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Paramètres de facturation</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Devise</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white font-bold"
                    >
                      <option value="EUR">Euro (€)</option>
                      <option value="USD">Dollar ($)</option>
                      <option value="GBP">Livre (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Délai de paiement (jours)</label>
                    <input
                      type="number"
                      value={paymentDelayDays}
                      onChange={(e) => setPaymentDelayDays(Number(e.target.value))}
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Préfixe Facture</label>
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Préfixe Devis</label>
                    <input
                      type="text"
                      value={quotePrefix}
                      onChange={(e) => setQuotePrefix(e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white font-bold uppercase"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Conditions de règlement par défaut</label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="Ex: Paiement à 30 jours, virement ou chèque."
                      className="w-full text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-white font-bold rounded-xl text-sm transition-all shadow-sm ${activeTheme.btnBg}`}
                >
                  {editingCompany ? 'Mettre à jour' : 'Créer la structure'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
