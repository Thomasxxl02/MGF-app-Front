import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Invoice, Client, Product, Supplier, Expense, UserProfile } from '../types';
import { generateAssistantResponse } from '../services/geminiService';
import { 
  Send, Bot, User, Sparkles, MessageSquare, Calculator, Lightbulb, 
  ArrowRight, ShieldCheck, Mail, History, TrendingUp, AlertCircle 
} from 'lucide-react';

interface AIAssistantProps {
  invoices?: Invoice[];
  clients?: Client[];
  products?: Product[];
  suppliers?: Supplier[];
  expenses?: Expense[];
  userProfile?: UserProfile;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  invoices = [],
  clients = [],
  products = [],
  suppliers = [],
  expenses = [],
  userProfile
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `Bonjour ${userProfile?.companyName ? userProfile.companyName : ''} ! Je suis votre conseiller et assistant administratif propulsé par l'IA. 

Je suis directement connecté aux données en temps réel de votre compte. Je peux vous aider à :
• Estimer vos cotisations et charges URSSAF
• Préparer des emails professionnels de relance client pour factures en retard
• Suivre vos franchissements de seuils de TVA et de statut micro-entrepreneur
• Analyser la rentabilité de votre catalogue ou de vos dépenses

Choisissez un raccourci ci-dessous ou posez-moi votre question directement !`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate dynamic state summaries for the LLM context
  const buildContextString = () => {
    const includeContext = userProfile?.aiIncludeContext !== false;

    const totalRevenue = invoices
      .filter(i => i.status === 'Payée')
      .reduce((sum, i) => sum + i.total, 0);

    const totalPending = invoices
      .filter(i => i.status === 'Envoyée')
      .reduce((sum, i) => sum + i.total, 0);

    const lateCount = invoices.filter(i => {
      const todayStr = new Date().toISOString().split('T')[0];
      return i.status === 'Envoyée' && i.dueDate < todayStr;
    }).length;

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const formatClients = clients.map(c => `- ${c.name} (${c.category || 'B2B'}, Email: ${c.email || 'non-renseigné'})`).join('\n');
    const formatProducts = products.map(p => `- ${p.name}: ${p.price}€ (${p.type === 'service' ? 'Service' : 'Matériel'})`).join('\n');

    let context = `
=== PROFIL COMPAGNIE ===
Entreprise : ${userProfile?.companyName || 'Mon Entreprise'}
SIRET : ${userProfile?.siret || 'Client-Side Local'}
Type d'activité : ${userProfile?.activityType || 'services_liberal'}
Seuils personnalisés : TVA=${userProfile?.customVatThreshold || 'défaut'}, Charges=${userProfile?.customChargesRate || 'dur'} %
`;

    if (includeContext) {
      context += `
=== DONNÉES EN TEMPS RÉEL (ARCHIVÉES DANS L'APP) ===
Nombre de factures total : ${invoices.length}
Chiffre d'affaires total encaissé : ${totalRevenue.toFixed(2)} €
Chiffre d'affaires en attente : ${totalPending.toFixed(2)} €
Nombre de factures en retard de paiement : ${lateCount}
Total des dépenses / frais de fonctionnement : ${totalExpenses.toFixed(2)} €

=== CLIENTS ENREGISTRÉS (${clients.length}) ===
${formatClients || 'Aucun client actuellement.'}

=== ARTICLES CATALOGUE (${products.length}) ===
${formatProducts || 'Aucun article actuellement.'}
`;
    } else {
      context += `
(Note : L'utilisateur a suspendu le partage de ses données chiffrées détaillées dans ses paramètres de confidentialité. Ne présume pas de son chiffre d'affaires, de ses clients ou de ses dépenses réels.)
`;
    }

    // Include the configured AI Tone instruction
    const toneVal = userProfile?.aiTone || 'professional';
    let toneInstruction = '';
    if (toneVal === 'professional') {
      toneInstruction = "Adopte une tonalité extrêmement professionnelle et formelle. Sois précis et rassurant.";
    } else if (toneVal === 'pedagogical') {
      toneInstruction = "Adopte une tonalité pédagogique et explicative. Prends le temps d'expliquer les termes fiscaux, de cotisations, ou d'administration d'entreprise avec clarté.";
    } else if (toneVal === 'concise') {
      toneInstruction = "Adopte un style ultra-concis. Rédige de courtes réponses, va droit au but sans fioritures superflues.";
    } else if (toneVal === 'creative') {
      toneInstruction = "Adopte une tonalité créative, dynamique et engageante. Idéal pour du copywriting ou chercher de nouvelles manières de se développer.";
    }

    context += `
=== STYLE ET TONALITÉ REQUIS ===
${toneInstruction}
`;

    // Include the custom directives
    if (userProfile?.aiCustomInstructions?.trim()) {
      context += `
=== DIRECTIVES CONSIGNES MÉTIER SUPPLÉMENTAIRES COMPACTES ===
Voici des exigences spéciales du profil de l'utilisateur que tu dois absolument appliquer :
${userProfile.aiCustomInstructions}
`;
    }

    return context.trim();
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const businessDataDoc = buildContextString();
    
    // Create the conversation history context for the last 4 exchanges
    const conversationHistory = messages
      .slice(-4)
      .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const totalPromptContext = `
${businessDataDoc}

=== CONVERSATION PRÉCÉDENTE ===
${conversationHistory}
`.trim();

    const responseText = await generateAssistantResponse(
      userMsg.content, 
      totalPromptContext,
      userProfile?.aiApiKey,
      userProfile?.aiModel,
      {
        gemini: userProfile?.aiGeminiApiKey,
        anthropic: userProfile?.aiAnthropicApiKey,
        mistral: userProfile?.aiMistralApiKey
      }
    );

    const modelMsg: ChatMessage = { role: 'model', content: responseText, timestamp: Date.now() };
    setMessages(prev => [...prev, modelMsg]);
    setIsLoading(false);
  };

  // Pre-configured French Micro-enterprise assistance queries
  const promptSuggestions = [
    {
      label: "Estimer mes charges URSSAF",
      query: "Peux-tu m'estimer le total de mes cotisations sociales URSSAF et me dire quel est le montant net qu'il me reste après charges ?",
      icon: <Calculator className="text-blue-500" size={16} />
    },
    {
      label: "Vérifier mes seuils de TVA",
      query: "En fonction de mon chiffre d'affaires encaissé actuel, dis-moi exactement où j'en suis par rapport aux seuils de franchise en base de TVA en France.",
      icon: <TrendingUp className="text-purple-500" size={16} />
    },
    {
      label: "Modèle de relance impayé",
      query: "Rédige-moi un email de relance poli mais ferme pour mes clients en retard de paiement de factures.",
      icon: <Mail className="text-amber-500" size={16} />
    },
    {
      label: "Optimiser mes frais",
      query: "Quels sont tes conseils pour un auto-entrepreneur pour bien catégoriser et optimiser ses frais professionnels ?",
      icon: <Lightbulb className="text-emerald-500" size={16} />
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans animate-fade-in select-none">
      
      {/* HEADER SECTION */}
      <div className="border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-650 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
            Intelligence Artificielle Locale
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Assistant IA Intelligent
          </h2>
          <p className="text-slate-400 text-sm mt-0.5 font-medium">
            Votre conseiller fiscal et administratif personnel, connecté en continu à vos indicateurs de facturation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* LEFT COLUMN: QUICK SUGGESTIONS BENTO */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs uppercase tracking-wider border-b border-slate-50 pb-2.5">
              <Sparkles size={14} className="text-blue-600" />
              <span>Actions rapides</span>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {promptSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(sug.query)}
                  disabled={isLoading}
                  className="w-full text-left p-3 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 border border-slate-100 rounded-2xl transition-all duration-300 text-xs font-semibold text-slate-700 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {sug.icon}
                    <span className="truncate">{sug.label}</span>
                  </div>
                  <ArrowRight size={12} className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-950 to-slate-850 text-white p-5 rounded-3xl shadow-lg space-y-3 relative overflow-hidden">
            <div className="absolute top-[-10px] right-[-10px] opacity-10">
              <Bot size={120} />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              <ShieldCheck size={12} />
              <span>Sécurité des données</span>
            </div>
            <h4 className="text-sm font-extrabold">Confidentialité Totale</h4>
            <p className="text-[10px] text-slate-350 leading-relaxed">
              Vos informations client, recettes et coordonnées comptables sont analysées localement au fil des prompts et ne servent jamais à l'entraînement public des modèles de fondation.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: MAIN INTERACTIVE CHAT ENGINE */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm flex flex-col h-[650px] overflow-hidden relative">
          
          {/* Active Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">Conseiller Virtuel Auto-Entrepreneur</h3>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Disponible en temps réel • Modèle {userProfile?.aiModel || 'gemini-3.5-flash'}
                </span>
              </div>
            </div>
          </div>

          {/* Messages Flow Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20 custom-scrollbar scroll-smooth">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}
                >
                  {/* Bot Logo */}
                  {!isUser && (
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-blue-600 shrink-0">
                      <Bot size={16} />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[82%]`}>
                    <div 
                      className={`
                        px-4.5 py-3.5 text-xs sm:text-xs leading-relaxed whitespace-pre-wrap shadow-sm rounded-2xl
                        ${isUser 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-150'
                        }
                      `}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium font-mono mt-1.5 px-0.5">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* User Badge */}
                  {isUser && (
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-center text-white shrink-0">
                      <User size={16} />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-blue-600 shrink-0">
                  <Bot size={16} />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-150 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-duration:0.8s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:.15s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:.3s]"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Text Input Bar */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }} 
            className="p-5 bg-white border-t border-slate-100"
          >
            <div className="flex gap-3 items-center">
              <input
                type="text"
                disabled={isLoading}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez vos questions fiscales ou demandez de rédiger un avis..."
                className="flex-1 px-4.5 py-3 border border-slate-200/80 rounded-2xl text-xs sm:text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-2xl shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Send size={15} />
              </button>
            </div>
            
            <p className="text-[9px] text-slate-400 font-medium text-center mt-3 flex items-center justify-center gap-1">
              <AlertCircle size={10} />
              L'IA peut commettre des erreurs. Validez toujours les décisions réglementaires majeures avec le site officiel de l'URSSAF.
            </p>
          </form>

        </div>

      </div>

    </div>
  );
};

export default AIAssistant;
