import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InvoiceManager from './components/InvoiceManager';
import ClientManager from './components/ClientManager';
import SupplierManager from './components/SupplierManager';
import ProductManager from './components/ProductManager';
import AccountingManager from './components/AccountingManager';
import SettingsManager from './components/SettingsManager';
import PpfManager from './components/PpfManager';
import AIAssistant from './components/AIAssistant';
import DocumentManager from './components/DocumentManager';
import { AuthManager } from './components/AuthManager';
import CommandPalette from './components/CommandPalette';
import { ViewState, Invoice, Client, UserProfile, Supplier, Product, Expense, InvoiceStatus } from './types';
import { initializeDatabase } from './services/tauri';
import { CompanyManager } from './components/CompanyManager';
import { ToastProvider } from './components/ToastManager';
import { Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autogest_sidebar_collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    initializeDatabase().catch(err => {
      console.error("Failed to initialize database:", err);
    });
  }, []);

  // --- AUTH STATES ---
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email');
  });
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(() => {
    return localStorage.getItem('autogest_session_name') || sessionStorage.getItem('autogest_session_name');
  });

  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const email = localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email') || 'default_user';
    const cleanEmail = email.replace(/[@.]/g, '_');
    return localStorage.getItem(`autogest_${cleanEmail}_active_company_id`) || 'co_default_123';
  });

  // Dynamic initialization helper for isolated storage
  const getInitialStateForUser = <T,>(suffix: string, defaultValue: T): T => {
    const email = localStorage.getItem('autogest_session_email') || sessionStorage.getItem('autogest_session_email');
    if (!email) return defaultValue;
    const cleanEmail = email.replace(/[@.]/g, '_');
    
    // Isolate by active company for these business collections
    const isIsolated = ['invoices', 'clients', 'suppliers', 'products', 'expenses'].includes(suffix);
    if (isIsolated) {
      const activeId = localStorage.getItem(`autogest_${cleanEmail}_active_company_id`) || 'co_default_123';
      const saved = localStorage.getItem(`autogest_${cleanEmail}_${activeId}_${suffix}`);
      return saved ? JSON.parse(saved) : defaultValue;
    }
    
    const saved = localStorage.getItem(`autogest_${cleanEmail}_${suffix}`);
    return saved ? JSON.parse(saved) : defaultValue;
  };

  // --- STATE ---
  const [invoices, setInvoices] = useState<Invoice[]>(() => getInitialStateForUser('invoices', []));
  const [clients, setClients] = useState<Client[]>(() => getInitialStateForUser('clients', []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getInitialStateForUser('suppliers', []));
  const [products, setProducts] = useState<Product[]>(() => getInitialStateForUser('products', []));
  const [expenses, setExpenses] = useState<Expense[]>(() => getInitialStateForUser('expenses', []));
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getInitialStateForUser('profile', {
    companyName: 'Ma Micro-Entreprise',
    siret: '123 456 789 00012',
    address: '123 Avenue de la République, 75001 Paris',
    email: localStorage.getItem('autogest_session_email') || 'contact@mon-entreprise.fr',
    phone: '01 02 03 04 05',
    bankAccount: 'FR76 1234 5678 9012 3456 7890 123',
    activityType: 'services_liberal',
    vatRegime: 'franchise',
    autoVatThreshold: true,
    autoCaThreshold: true,
    vatFranchiseArt293B: true,
    defaultVatRate: 20,
    hasProfessionalInsurance: false,
    hasVli: false,
    hasAcre: false,
    fiscalDeclarationPeriodicity: 'monthly',
    themeColor: 'blue',
    darkMode: false
  }));

  const overdueInvoicesCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return invoices.filter(inv => 
      (inv.status === 'Envoyée' || inv.status === InvoiceStatus.SENT) && 
      inv.dueDate < todayStr && 
      (inv.type === 'invoice' || !inv.type)
    ).length;
  }, [invoices]);

  // --- RELOAD DATA ON USER OR COMPANY SWITCH ---
  useEffect(() => {
    if (!currentUserEmail) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    
    const currentCompId = localStorage.getItem(`autogest_${cleanEmail}_active_company_id`) || 'co_default_123';
    
    const savedInvoices = localStorage.getItem(`autogest_${cleanEmail}_${currentCompId}_invoices`);
    setInvoices(savedInvoices ? JSON.parse(savedInvoices) : []);

    const savedClients = localStorage.getItem(`autogest_${cleanEmail}_${currentCompId}_clients`);
    setClients(savedClients ? JSON.parse(savedClients) : []);

    const savedSuppliers = localStorage.getItem(`autogest_${cleanEmail}_${currentCompId}_suppliers`);
    setSuppliers(savedSuppliers ? JSON.parse(savedSuppliers) : []);

    const savedProducts = localStorage.getItem(`autogest_${cleanEmail}_${currentCompId}_products`);
    setProducts(savedProducts ? JSON.parse(savedProducts) : []);

    const savedExpenses = localStorage.getItem(`autogest_${cleanEmail}_${currentCompId}_expenses`);
    setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);

    // Load active company profile to userProfile state
    const savedCompaniesStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
    const savedCompanies = savedCompaniesStr ? JSON.parse(savedCompaniesStr) : [];
    const activeCompany = savedCompanies.find((c: any) => c.id === currentCompId) || savedCompanies[0];
    
    if (activeCompany) {
      setUserProfile({
        companyName: activeCompany.companyName,
        siret: activeCompany.siret,
        address: `${activeCompany.address}, ${activeCompany.postalCode} ${activeCompany.city}, ${activeCompany.country}`,
        email: activeCompany.email,
        phone: activeCompany.phone,
        website: activeCompany.website,
        bankAccount: activeCompany.bankAccount || activeCompany.iban,
        bic: activeCompany.bic,
        tvaNumber: activeCompany.tvaNumber,
        themeColor: activeCompany.themeColor || 'blue',
        invoicePrefix: activeCompany.invoicePrefix || 'FAC',
        quotePrefix: activeCompany.quotePrefix || 'DEV',
        paymentDelayDays: activeCompany.paymentDelayDays || 30,
        currencySymbol: activeCompany.currency === 'USD' ? '$' : activeCompany.currency === 'GBP' ? '£' : '€',
        activityType: 'services_liberal',
        vatRegime: 'normal',
        defaultVatRate: 20,
        darkMode: false
      });
    } else {
      // Seed default company
      const defaultComp = {
        id: 'co_default_123',
        companyName: 'Ma Micro-Entreprise',
        tradeName: 'Ma Micro-Entreprise',
        siren: '123456789',
        siret: '123 456 789 00012',
        tvaNumber: 'FR89123456789',
        address: '123 Avenue de la République',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        email: currentUserEmail,
        phone: '01 02 03 04 05',
        website: 'https://mon-entreprise.fr',
        bankAccount: 'FR76 1234 5678 9012 3456 7890 123',
        iban: 'FR76 1234 5678 9012 3456 7890 123',
        bic: 'TRNFR2BXXX',
        logo: '',
        currency: 'EUR',
        paymentTerms: 'Règlement à réception',
        paymentDelayDays: 30,
        invoicePrefix: 'FAC',
        quotePrefix: 'DEV',
        themeColor: 'blue',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify([defaultComp]));
      localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, defaultComp.id);
      setActiveCompanyId(defaultComp.id);
    }
  }, [currentUserEmail, activeCompanyId]);

  // --- EFFECTS FOR PERSISTENCE ---
  useEffect(() => {
    if (!currentUserEmail || !activeCompanyId) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_${activeCompanyId}_invoices`, JSON.stringify(invoices));
  }, [invoices, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (!currentUserEmail || !activeCompanyId) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_${activeCompanyId}_clients`, JSON.stringify(clients));
  }, [clients, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (!currentUserEmail || !activeCompanyId) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_${activeCompanyId}_suppliers`, JSON.stringify(suppliers));
  }, [suppliers, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (!currentUserEmail || !activeCompanyId) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_${activeCompanyId}_products`, JSON.stringify(products));
  }, [products, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (!currentUserEmail || !activeCompanyId) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_${activeCompanyId}_expenses`, JSON.stringify(expenses));
  }, [expenses, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (!currentUserEmail) return;
    const cleanEmail = currentUserEmail.replace(/[@.]/g, '_');
    localStorage.setItem(`autogest_${cleanEmail}_profile`, JSON.stringify(userProfile));
    
    // Also keep active company fields updated in the company list
    const savedCompaniesStr = localStorage.getItem(`autogest_${cleanEmail}_companies`);
    if (savedCompaniesStr && activeCompanyId) {
      const companies = JSON.parse(savedCompaniesStr);
      const index = companies.findIndex((c: any) => c.id === activeCompanyId);
      if (index !== -1) {
        companies[index] = {
          ...companies[index],
          companyName: userProfile.companyName,
          siret: userProfile.siret,
          email: userProfile.email,
          phone: userProfile.phone,
          website: userProfile.website,
          bankAccount: userProfile.bankAccount,
          iban: userProfile.bankAccount,
          bic: userProfile.bic,
          tvaNumber: userProfile.tvaNumber,
          themeColor: userProfile.themeColor,
          invoicePrefix: userProfile.invoicePrefix,
          quotePrefix: userProfile.quotePrefix,
          paymentDelayDays: userProfile.paymentDelayDays,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(`autogest_${cleanEmail}_companies`, JSON.stringify(companies));
      }
    }
  }, [userProfile, currentUserEmail, activeCompanyId]);

  useEffect(() => {
    if (userProfile.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userProfile.darkMode]);

  const handleLoginSuccess = (email: string, displayName: string, rememberMe: boolean, defaultInit?: any) => {
    if (rememberMe) {
      localStorage.setItem('autogest_session_email', email);
      localStorage.setItem('autogest_session_name', displayName);
      sessionStorage.removeItem('autogest_session_email');
      sessionStorage.removeItem('autogest_session_name');
    } else {
      sessionStorage.setItem('autogest_session_email', email);
      sessionStorage.setItem('autogest_session_name', displayName);
      localStorage.removeItem('autogest_session_email');
      localStorage.removeItem('autogest_session_name');
    }
    
    const cleanEmail = email.replace(/[@.]/g, '_');
    if (defaultInit) {
      localStorage.setItem(`autogest_${cleanEmail}_default_init`, JSON.stringify(defaultInit));
    }
    
    setCurrentUserEmail(email);
    setCurrentUserDisplayName(displayName);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('autogest_session_email');
    localStorage.removeItem('autogest_session_name');
    sessionStorage.removeItem('autogest_session_email');
    sessionStorage.removeItem('autogest_session_name');
    setCurrentUserEmail(null);
    setCurrentUserDisplayName(null);
    setCurrentView('dashboard');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            invoices={invoices} 
            userProfile={userProfile} 
            expenses={expenses}
            clients={clients}
            products={products}
            setView={setCurrentView}
          />
        );
      case 'invoices':
        return <InvoiceManager invoices={invoices} setInvoices={setInvoices} clients={clients} userProfile={userProfile} products={products} />;
      case 'clients':
        // Pass invoices to calculate total revenue per client
        return <ClientManager clients={clients} setClients={setClients} invoices={invoices} />;
      case 'suppliers':
        // Pass expenses to calculate total spent per supplier
        return <SupplierManager suppliers={suppliers} setSuppliers={setSuppliers} expenses={expenses} />;
      case 'products':
        return <ProductManager products={products} setProducts={setProducts} />;
      case 'accounting':
        return (
          <AccountingManager 
            expenses={expenses} 
            setExpenses={setExpenses} 
            invoices={invoices} 
            setInvoices={setInvoices}
            suppliers={suppliers} 
            userProfile={userProfile}
            clients={clients}
          />
        );
      case 'settings':
        return (
          <SettingsManager 
            userProfile={userProfile} 
            setUserProfile={setUserProfile} 
            invoices={invoices}
            setInvoices={setInvoices}
            clients={clients}
            setClients={setClients}
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            products={products}
            setProducts={setProducts}
            expenses={expenses}
            setExpenses={setExpenses}
            onCompanySwitched={(id) => {
              setActiveCompanyId(id);
              const cleanEmail = currentUserEmail?.replace(/[@.]/g, '_') || 'default_user';
              localStorage.setItem(`autogest_${cleanEmail}_active_company_id`, id);
            }}
          />
        );
      case 'ppf':
        return (
          <PpfManager 
            invoices={invoices}
            setInvoices={setInvoices}
            clients={clients}
            suppliers={suppliers}
            expenses={expenses}
            setExpenses={setExpenses}
            userProfile={userProfile}
          />
        );
      case 'ai_assistant':
        return (
          <AIAssistant 
            invoices={invoices}
            clients={clients}
            products={products}
            suppliers={suppliers}
            expenses={expenses}
            userProfile={userProfile}
          />
        );
      case 'documents':
        return (
          <DocumentManager
            invoices={invoices}
            setInvoices={setInvoices}
            expenses={expenses}
            setExpenses={setExpenses}
            clients={clients}
            suppliers={suppliers}
            userProfile={userProfile}
            setView={setCurrentView}
          />
        );
      default:
        return <Dashboard invoices={invoices} userProfile={userProfile} />;
    }
  };

  if (!currentUserEmail) {
    return <AuthManager onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <ToastProvider>
      <CommandPalette 
        isOpen={isPaletteOpen} 
        onClose={() => setIsPaletteOpen(false)} 
        setView={setCurrentView} 
      />
      <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950/95 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 selection:text-blue-900 transition-colors duration-200">
        <Sidebar 
          currentView={currentView} 
          setView={setCurrentView} 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          userProfile={userProfile}
          currentUserDisplayName={currentUserDisplayName || undefined}
          currentUserEmail={currentUserEmail || undefined}
          onLogout={handleLogout}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          overdueInvoicesCount={overdueInvoicesCount}
        />

        <main className={`flex-1 ${isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-72'} transition-all duration-300 p-6 lg:p-10 overflow-x-hidden`}>
          {/* Mobile Header */}
          <div className="lg:hidden flex justify-between items-center mb-8 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-10 py-3 px-1 border-b border-slate-200/50 dark:border-slate-800">
            <img 
              src="/logo_mgf.svg" 
              alt="Micro-Gestion-Facile Logo" 
              className="h-12 w-auto select-none dark:brightness-110" 
              referrerPolicy="no-referrer" 
            />
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
};

export default App;