import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, LayoutDashboard, FileText, Users, Settings, Package, Truck, Calculator, Globe, Sparkles, X, FolderClosed } from 'lucide-react';
import { ViewState } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setView: (view: ViewState) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, setView }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
    { id: 'invoices', label: 'Devis & Factures', icon: <FileText size={18} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={18} /> },
    { id: 'suppliers', label: 'Fournisseurs', icon: <Truck size={18} /> },
    { id: 'products', label: 'Catalogue', icon: <Package size={18} /> },
    { id: 'accounting', label: 'Comptabilité', icon: <Calculator size={18} /> },
    { id: 'documents', label: 'Documents', icon: <FolderClosed size={18} /> },
    { id: 'ppf', label: 'Portail Public (PPF)', icon: <Globe size={18} /> },
    { id: 'ai_assistant', label: 'Assistant IA', icon: <Sparkles size={18} /> },
    { id: 'settings', label: 'Paramètres', icon: <Settings size={18} /> },
  ];

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredActions = actions.filter(a => a.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20"
            onClick={onClose}
          >
            <div 
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <Search size={18} className="text-slate-400" />
                <input 
                  ref={inputRef}
                  type="text" 
                  placeholder="Rechercher une action..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
                <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2">
                {filteredActions.map(action => (
                  <button 
                    key={action.id}
                    onClick={() => { setView(action.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
