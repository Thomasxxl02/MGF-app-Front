import React, { useState, useEffect } from 'react';
import { 
  Play, RefreshCw, CheckCircle2, XCircle, Terminal, 
  ChevronDown, ChevronUp, Gauge, Wifi, WifiOff, 
  Download, AlertTriangle, ShieldCheck, Cpu, AppWindow, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { runAllTests, TestSuiteResult, TestCaseResult, TestAssertion } from '../services/testSuite';

interface TestDashboardProps {
  currentThemeColor: 'blue' | 'emerald' | 'violet' | 'amber' | 'neutral';
}

export const TestDashboard: React.FC<TestDashboardProps> = ({ currentThemeColor }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestSuiteResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'frontend' | 'backend' | 'e2e'>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentSuiteName, setCurrentSuiteName] = useState<string>('');
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Auto-run tests on mount to populate results instantly
  useEffect(() => {
    handleRunTests();
  }, []);

  const handleRunTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setCurrentSuiteName('Démarrage des tests...');
    
    try {
      // Simulate slightly longer loading for professional visual progress
      const results = await runAllTests((prog, name) => {
        setProgress(prog);
        setCurrentSuiteName(name);
      });
      
      // Inject network failures or special conditions if in offline mode
      if (isOfflineMode) {
        // Find the synchronization test case and force it to be customized
        results.forEach(suite => {
          if (suite.categoryId === 'fe_sync') {
            suite.passed = false;
            suite.failedTests = 1;
            suite.passedTests = 0;
            suite.cases.forEach(c => {
              c.passed = false;
              c.assertions.push({
                name: 'Établissement du tunnel de réplication',
                passed: false,
                message: 'Échec de synchronisation: Réseau déconnecté (Simulation hors-ligne active)',
                expected: 'Statut de connexion: En Ligne',
                actual: 'Statut de connexion: Hors-Ligne'
              });
              c.logs.push('[FATAL] Erreur de réplication. Serveur distant inaccessible (DNS_PROBE_FINISHED_NO_INTERNET).');
            });
          }
        });
      }

      setTestResults(results);
    } catch (err) {
      console.error('Error during test execution:', err);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  // Color mapping based on theme color
  const getThemeStyles = () => {
    switch (currentThemeColor) {
      case 'emerald': return { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-600', border: 'border-emerald-600', ring: 'focus:ring-emerald-500' };
      case 'violet': return { bg: 'bg-violet-600', hover: 'hover:bg-violet-700', text: 'text-violet-600', border: 'border-violet-600', ring: 'focus:ring-violet-500' };
      case 'amber': return { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-amber-600', border: 'border-amber-600', ring: 'focus:ring-amber-500' };
      case 'neutral': return { bg: 'bg-slate-700', hover: 'hover:bg-slate-800', text: 'text-slate-700', border: 'border-slate-700', ring: 'focus:ring-slate-500' };
      default: return { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-600', border: 'border-blue-600', ring: 'focus:ring-blue-500' };
    }
  };

  const ts = getThemeStyles();

  // Metrics calculations
  const totalCases = testResults.flatMap(suite => suite.cases).length;
  const passedCasesCount = testResults.flatMap(suite => suite.cases).filter(c => c.passed).length;
  const failedCasesCount = totalCases - passedCasesCount;
  const globalExecutionTime = Math.round(testResults.reduce((acc, suite) => acc + suite.cases.reduce((sum, c) => sum + c.executionTimeMs, 0), 0) * 100) / 100;
  const successPercentage = totalCases > 0 ? Math.round((passedCasesCount / totalCases) * 100) : 0;

  // Filters results
  const filteredSuites = testResults.filter(suite => {
    if (activeFilter === 'all') return true;
    return suite.type === activeFilter;
  });

  const downloadTestReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      theme: currentThemeColor,
      offlineSimulated: isOfflineMode,
      summary: {
        totalTests: totalCases,
        passed: passedCasesCount,
        failed: failedCasesCount,
        successRate: `${successPercentage}%`,
        elapsedTimeMs: globalExecutionTime
      },
      suites: testResults
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_diagnostic_facturation_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="test-dashboard-container" className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Gauge className={ts.text} size={24} />
            Laboratoire de Diagnostic & Tests Unitaires
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Exécutez et validez l'intégralité du moteur de facturation : calculs financiers, règles fiscales, conformité et synchronisation.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Offline simulator switch */}
          <button
            onClick={() => {
              setIsOfflineMode(!isOfflineMode);
              // Trigger reload to apply simulation instantly
              setTimeout(handleRunTests, 50);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isOfflineMode 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isOfflineMode ? <WifiOff size={14} /> : <Wifi size={14} />}
            <span>Simulation: {isOfflineMode ? 'Hors-Ligne' : 'En Ligne'}</span>
          </button>

          <button
            onClick={downloadTestReport}
            disabled={testResults.length === 0 || isRunning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-50 transition-all"
            title="Télécharger le rapport JSON complet"
          >
            <Download size={14} />
            <span>Rapport</span>
          </button>

          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${ts.bg} ${ts.hover} disabled:opacity-50`}
          >
            <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
            <span>{isRunning ? 'Validation...' : 'Lancer les Tests'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar Loader */}
      {isRunning && (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Séquence : {currentSuiteName}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${ts.bg}`}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut" }}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Rate card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${failedCasesCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {failedCasesCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Taux de Réussite</span>
            <span className={`text-2xl font-black ${failedCasesCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {successPercentage}%
            </span>
          </div>
        </div>

        {/* Passed tests count card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Tests Réussis</span>
            <span className="text-2xl font-black text-slate-800">{passedCasesCount}</span>
            <span className="text-xs text-slate-400 block">sur {totalCases} cas examinés</span>
          </div>
        </div>

        {/* Failed tests count card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${failedCasesCount > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <XCircle size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Échecs</span>
            <span className={`text-2xl font-black ${failedCasesCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {failedCasesCount}
            </span>
            <span className="text-xs text-slate-400 block">anomalie(s) active(s)</span>
          </div>
        </div>

        {/* Benchmark elapsed time card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
            <Cpu size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Temps de Calcul</span>
            <span className="text-2xl font-black text-slate-800">{globalExecutionTime} ms</span>
            <span className="text-xs text-slate-400 block">moteur SQLite & Rust simulé</span>
          </div>
        </div>
      </div>

      {/* Main filter Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeFilter === 'all' 
              ? `${ts.border} text-slate-900 font-extrabold` 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Tous les Modules ({totalCases})
        </button>
        <button
          onClick={() => setActiveFilter('frontend')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeFilter === 'frontend' 
              ? `${ts.border} text-slate-900 font-extrabold` 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <AppWindow size={14} />
          IHM & Frontend ({testResults.filter(s => s.type === 'frontend').flatMap(s => s.cases).length})
        </button>
        <button
          onClick={() => setActiveFilter('backend')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeFilter === 'backend' 
              ? `${ts.border} text-slate-900 font-extrabold` 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Cpu size={14} />
          Rust & Base SQL ({testResults.filter(s => s.type === 'backend').flatMap(s => s.cases).length})
        </button>
        <button
          onClick={() => setActiveFilter('e2e')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeFilter === 'e2e' 
              ? `${ts.border} text-slate-900 font-extrabold` 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={14} />
          Parcours E2E ({testResults.filter(s => s.type === 'e2e').flatMap(s => s.cases).length})
        </button>
      </div>

      {/* Main contents */}
      <div className="space-y-4">
        {filteredSuites.map((suite, idx) => (
          <div key={suite.categoryId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Suite Category Header banner */}
            <div className="bg-slate-50/50 px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  suite.type === 'frontend' 
                    ? 'bg-blue-50 text-blue-700' 
                    : suite.type === 'backend' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {suite.type}
                </span>
                <h3 className="text-sm font-black text-slate-800">{suite.categoryName}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-500">
                  {suite.passedTests} / {suite.totalTests} passés
                </span>
                {suite.passed ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                    <CheckCircle2 size={10} /> Stable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                    <XCircle size={10} /> Échec
                  </span>
                )}
              </div>
            </div>

            {/* Test cases inside suite */}
            <div className="divide-y divide-slate-100">
              {suite.cases.map((testCase) => {
                const isExpanded = expandedCaseId === testCase.id;
                return (
                  <div key={testCase.id} className="transition-colors hover:bg-slate-50/20">
                    <div 
                      onClick={() => setExpandedCaseId(isExpanded ? null : testCase.id)}
                      className="px-5 py-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {testCase.passed ? (
                          <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                        ) : (
                          <XCircle className="text-rose-500 shrink-0 animate-bounce" size={18} />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            {testCase.name}
                            <span className="text-[10px] text-slate-400 font-normal">({testCase.executionTimeMs} ms)</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{testCase.description}</p>
                        </div>
                      </div>

                      <div className="text-slate-400 hover:text-slate-700 transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Collapsible log trace & assertions panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-5 pb-5 overflow-hidden border-t border-slate-50"
                        >
                          <div className="mt-4 space-y-4">
                            {/* Step Assertions list */}
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assertions d'Intégrité</h5>
                              <div className="space-y-1.5">
                                {testCase.assertions.map((assertion, aIdx) => (
                                  <div key={aIdx} className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 flex items-start justify-between gap-4 text-xs">
                                    <div className="space-y-1">
                                      <span className="font-bold text-slate-800 block">{assertion.name}</span>
                                      <span className="text-slate-500 block text-[11px]">{assertion.message}</span>
                                      {(assertion.expected !== undefined || assertion.actual !== undefined) && (
                                        <div className="flex gap-4 text-[10px] bg-white border border-slate-200/50 p-1.5 rounded-lg mt-1 font-mono">
                                          {assertion.expected !== undefined && (
                                            <span className="text-blue-600"><strong className="text-slate-400 font-sans">Attendu :</strong> {assertion.expected}</span>
                                          )}
                                          {assertion.actual !== undefined && (
                                            <span className={`${assertion.passed ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}><strong className="text-slate-400 font-sans">Obtenu :</strong> {assertion.actual}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md ${
                                      assertion.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}>
                                      {assertion.passed ? 'SUCCÈS' : 'ÉCHEC'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Terminal Diagnostic console logs */}
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                <Terminal size={12} /> Console Log Diagnostics
                              </h5>
                              <div className="bg-slate-900 text-slate-100 font-mono text-[10px] p-3 rounded-xl overflow-x-auto leading-relaxed max-h-48 overflow-y-auto space-y-1 shadow-inner">
                                {testCase.logs.map((log, lIdx) => {
                                  let colorClass = 'text-slate-300';
                                  if (log.startsWith('[OK]')) colorClass = 'text-emerald-400';
                                  else if (log.startsWith('[FAIL]') || log.startsWith('[ERREUR') || log.startsWith('[FATAL]')) colorClass = 'text-rose-400 font-bold';
                                  return (
                                    <div key={lIdx} className={colorClass}>
                                      {log}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Source code visualization */}
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                <Code size={12} /> Code Source Vérifié
                              </h5>
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] font-mono text-slate-600 whitespace-pre overflow-x-auto leading-normal">
                                {getTestSnippetCode(testCase.id)}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Static mock source code snippets for gorgeous visual feedback of the actual test logic
 */
function getTestSnippetCode(id: string): string {
  switch (id) {
    case 'fe_unit_1':
      return `// /services/testSuite.ts -> calculs financiers
const items = [
  { description: 'Prestation', quantity: 2, unitPrice: 150 },
  { description: 'Transport', quantity: 1, unitPrice: 50.55 }
];
const rawSum = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0); // 350.55
const discountVal = Math.round(rawSum * (10 / 100) * 100) / 100; // 35.06
const totalHT = Math.round((rawSum - discountVal + shipping) * 100) / 100; // 335.49
const vatAmount = Math.round(totalHT * (20 / 100) * 100) / 100; // 67.10
const totalTTC = Math.round((totalHT + vatAmount) * 100) / 100; // 402.59`;

    case 'fe_unit_2':
      return `// /services/testSuite.ts -> validation de SIRET (algorithme de Luhn)
let sum = 0;
for (let i = 0; i < 14; i++) {
  let val = parseInt(cleanSiret[i], 10);
  if (i % 2 === 0) {
    val *= 2;
    if (val > 9) val -= 9;
  }
  sum += val;
}
return sum % 10 === 0;`;

    case 'fe_comp_1':
      return `// /components/Sidebar.tsx -> configuration thématique
const activeClass = getThemeClasses('emerald');
expect(activeClass).toContain('emerald-600');`;

    case 'fe_comp_2':
      return `// Rendu des formulaires et contrastes WCAG AA
const formErrors = { clientName: 'Le nom du client est requis' };
expect(formErrors.clientName).toBeDefined();`;

    case 'fe_store_1':
      return `// Multi-Entreprises Isolation Check
const keyA = \`autogest_\${user}_\${companyA}_invoices\`;
const keyB = \`autogest_\${user}_\${companyB}_invoices\`;
localStorage.setItem(keyA, JSON.stringify(invoicesA));
localStorage.setItem(keyB, JSON.stringify(invoicesB));`;

    case 'fe_idb_1':
      return `// Benchmark d'écriture en masse (IndexedDB simulated)
const startTime = performance.now();
await db.bulkPut('accounting_entries', oneHundredRecords);
const elapsed = performance.now() - startTime;
expect(elapsed).toBeLessThan(50); // < 50ms constraint`;

    case 'fe_sync_1':
      return `// Résolution de conflits Last Write Wins (LWW)
const resolveConflict = (queue) => {
  const resolved = {};
  queue.forEach(item => {
    if (!resolved[item.id] || resolved[item.id].timestamp < item.timestamp) {
      resolved[item.id] = item;
    }
  });
  return resolved;
};`;

    case 'be_unit_1':
      return `// /src-tauri/src/services/validation_service.rs
// Rust precision using integers for currency values (cents)
let price_cents_1: u64 = 10; // 0.10 €
let price_cents_2: u64 = 20; // 0.20 €
let sum_cents = price_cents_1 + price_cents_2;
let final_amount = (sum_cents as f64) / 100.0;
assert_eq!(final_amount, 0.3); // No float division inaccuracies`;

    case 'be_unit_2':
      return `// /src-tauri/src/errors.rs
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    #[error("Database constraint error: {0}")]
    Database(String),
    #[error("Validation rules violation: {0}")]
    Validation(String),
}
// Check automatic propagation of SQLite violations to JSON`;

    case 'be_srv_1':
      return `// /src-tauri/src/services/numbering_service.rs
pub fn generate_document_number(pfx: &str, year: u32, count: u64) -> String {
    format!("{}-{}-{:06}", pfx, year, count)
}`;

    case 'be_api_1':
      return `// Commandes IPC Tauri typées
#[tauri::command]
pub async fn create_invoice(
    invoice: InvoiceInput,
    state: tauri::State<'_, AppState>
) -> Result<Invoice, AppError> {
    invoice.validate()?; // checks fields and throws TauriAppError
    state.invoice_service.create(invoice).await
}`;

    case 'be_sql_1':
      return `// migrations/0001_initial.sql
PRAGMA foreign_keys = ON;
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    siret TEXT UNIQUE CHECK (length(siret) >= 14)
);`;

    case 'be_perm_1':
      return `// Middlewares d'isolation multi-entreprises
pub fn verify_company_permission(
    user_active_id: &str,
    target_id: &str
) -> Result<(), AppError> {
    if user_active_id != target_id {
        return Err(AppError::BusinessRule("Accès interdit: fuite inter-entreprises".into()));
    }
    Ok(())
}`;

    case 'be_sync_srv_1':
      return `// Validation d'intégrité de la réplication cloud
fn validate_token(token: &str) -> bool {
    token.starts_with("auth_token_secure_")
}`;

    case 'e2e_flow_1':
      return `// Scénario d'intégration E2E :
// 1. Initialisation de la session utilisateur Thomas
// 2. Création du client "Jean Dupont" (cli_e2e_1)
// 3. Enregistrement d'une facture Brouillon (FAC-2026-000001)
// 4. Passage au statut "Envoyée"
// 5. Encaissement et passage au statut final "Payée"
// 6. Test d'inviolabilité de la facture validée (Impossibilité de re-modifier)`;

    default:
      return `// Code source non documenté pour ce cas de test`;
  }
}
