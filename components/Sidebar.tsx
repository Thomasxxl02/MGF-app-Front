import React from 'react';
import { ViewState, UserProfile } from '../types';
import { 
  LayoutDashboard, FileText, Users, Settings, Package, Truck, 
  Calculator, Globe, Sparkles, LogOut, FolderClosed, 
  ChevronLeft, ChevronRight, X, Building2
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  userProfile?: UserProfile;
  currentUserDisplayName?: string;
  currentUserEmail?: string;
  onLogout?: () => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  overdueInvoicesCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  userProfile,
  currentUserDisplayName,
  currentUserEmail,
  onLogout,
  isCollapsed = false,
  setIsCollapsed,
  overdueInvoicesCount = 0
}) => {
  const menuItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
    { id: 'invoices', label: 'Devis & Factures', icon: <FileText size={20} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={20} /> },
    { id: 'suppliers', label: 'Fournisseurs', icon: <Truck size={20} /> },
    { id: 'products', label: 'Catalogue', icon: <Package size={20} /> },
    { id: 'accounting', label: 'Comptabilité', icon: <Calculator size={20} /> },
    { id: 'documents', label: 'Documents', icon: <FolderClosed size={20} /> },
    { id: 'ppf', label: 'Portail Public (PPF)', icon: <Globe size={20} /> },
    { id: 'ai_assistant', label: 'Assistant IA', icon: <Sparkles size={20} /> },
    { id: 'settings', label: 'Paramètres', icon: <Settings size={20} /> },
  ];

  const handleNavClick = (view: ViewState) => {
    setView(view);
    setIsMobileMenuOpen(false);
  };

  const currentTheme = userProfile?.themeColor || 'blue';

  const themeClasses: Record<string, { text: string; bg: string; badge: string; hoverBg: string }> = {
    blue: { text: 'text-blue-600', bg: 'bg-blue-600', badge: 'bg-blue-400', hoverBg: 'hover:bg-blue-50/50 dark:hover:bg-slate-800/50' },
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-600', badge: 'bg-emerald-400', hoverBg: 'hover:bg-emerald-50/50 dark:hover:bg-slate-800/50' },
    violet: { text: 'text-indigo-600', bg: 'bg-indigo-600', badge: 'bg-indigo-400', hoverBg: 'hover:bg-indigo-50/50 dark:hover:bg-slate-800/50' },
    amber: { text: 'text-amber-600', bg: 'bg-amber-600', badge: 'bg-amber-400', hoverBg: 'hover:bg-amber-50/50 dark:hover:bg-slate-800/50' },
    neutral: { text: 'text-slate-900', bg: 'bg-slate-900', badge: 'bg-slate-900', hoverBg: 'hover:bg-slate-100 dark:hover:bg-slate-800/50' }
  };

  const tc = themeClasses[currentTheme] || themeClasses.blue;

  const getCompanyInitials = () => {
    const name = userProfile?.companyName || 'Mon Entreprise';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const sidebarWidthClass = isCollapsed ? 'lg:w-20 w-72' : 'w-72';

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-30 h-screen ${sidebarWidthClass} bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-300 border-r border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Collapse Toggle Button (Desktop Only) */}
        {setIsCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3.5 top-10 z-40 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95"
            title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        )}

        {/* Logo Area */}
        <div className="flex items-center justify-between px-6 py-5 mb-2 border-b border-slate-150/50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/50 relative overflow-hidden h-[90px]">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="full-logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-start w-full"
              >
                <img 
                  src="/logo_mgf.svg" 
                  alt="Micro-Gestion-Facile Logo" 
                  className="h-12 w-auto drop-shadow-[0_2px_10px_rgba(2,136,209,0.1)] select-none transition-all duration-300 hover:scale-[1.03] dark:brightness-110" 
                  referrerPolicy="no-referrer" 
                />
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="hidden lg:flex w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 items-center justify-center font-extrabold text-xs text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 mx-auto"
              >
                {getCompanyInitials()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Close button for Mobile */}
          {isMobileMenuOpen && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`px-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar ${isCollapsed ? 'lg:px-2' : ''}`}>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 0.7, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-4 mt-2"
              >
                Menu Principal
              </motion.div>
            )}
          </AnimatePresence>
          
          {menuItems.map((item) => {
            const isItemActive = currentView === item.id;
            const hasOverdueBadge = item.id === 'dashboard' && overdueInvoicesCount > 0;
            const buttonContent = (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                whileHover={{ x: isCollapsed ? 0 : 4, scale: isCollapsed ? 1.05 : 1 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-3.5 px-4 py-3' : 'px-4 py-3'} rounded-2xl text-sm font-semibold transition-all duration-300 group relative overflow-hidden
                  ${isItemActive 
                    ? `bg-slate-50 dark:bg-slate-800 ${tc.text} shadow-sm` 
                    : `text-slate-500 dark:text-slate-400 ${tc.hoverBg} hover:text-slate-900 dark:hover:text-slate-100`}
                `}
              >
                {isItemActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 ${tc.bg} rounded-r-full`}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`transition-transform duration-300 ${isItemActive ? 'scale-110' : 'group-hover:scale-110'} shrink-0 relative`}>
                  {item.icon}
                  {hasOverdueBadge && isCollapsed && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
                  )}
                </span>
                
                {!isCollapsed && (
                  <span className="ml-4 truncate flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {hasOverdueBadge && (
                      <span className="ml-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-5 h-5 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm animate-pulse">
                        {overdueInvoicesCount}
                      </span>
                    )}
                  </span>
                )}
              </motion.button>
            );

            if (isCollapsed) {
              return (
                <div key={item.id} className="relative">
                  <div className="hidden lg:block">
                    <Tooltip content={item.label}>
                      {buttonContent}
                    </Tooltip>
                  </div>
                  <div className="lg:hidden">
                    {buttonContent}
                  </div>
                </div>
              );
            }
            return buttonContent;
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md transition-all duration-300">
          <div className={`flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} gap-2 p-1.5 rounded-2xl`}>
            <div className="flex items-center gap-2.5 overflow-hidden flex-1">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                className={`w-9 h-9 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold ${tc.text} border border-slate-200 dark:border-slate-700`}
              >
                {getCompanyInitials()}
              </motion.div>
              
              <AnimatePresence mode="popLayout">
                {!isCollapsed && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="overflow-hidden flex-1"
                  >
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {currentUserDisplayName || userProfile?.companyName || 'Mon Entreprise'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight">
                      {currentUserEmail || 'session@locale'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {onLogout && (!isCollapsed || isMobileMenuOpen) && (
              <motion.button
                whileHover={{ scale: 1.1, rotate: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (confirm("Voulez-vous vraiment vous déconnecter de votre espace de micro-entreprise ?")) {
                    onLogout();
                  }
                }}
                className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
                title="Déconnexion"
              >
                <LogOut size={14} />
              </motion.button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

