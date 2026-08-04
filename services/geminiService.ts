import { GoogleGenAI, Type } from "@google/genai";

const defaultGeminiApiKey = process.env.API_KEY || '';

// Detect model provider based on selected model name
export const getProviderByModel = (model: string): 'gemini' | 'anthropic' | 'mistral' => {
  const m = model.toLowerCase();
  if (m.includes('claude') || m.includes('anthropic')) {
    return 'anthropic';
  }
  if (m.includes('mistral') || m.includes('codestral')) {
    return 'mistral';
  }
  return 'gemini';
};

export const generateAssistantResponse = async (
  query: string, 
  context?: string,
  userApiKey?: string,
  userModel?: string,
  // Specific provider keys passed down
  providerKeys?: {
    gemini?: string;
    anthropic?: string;
    mistral?: string;
  }
): Promise<string> => {
  const model = userModel?.trim() || 'gemini-3.5-flash';
  const provider = getProviderByModel(model);

  const systemInstruction = `Tu es un assistant expert pour les auto-entrepreneurs en France.
  Tu connais les règles de l'URSSAF, les seuils de TVA (Franchise en base), les plafonds de Chiffre d'Affaires, et les obligations de facturation.
  Réponds de manière concise, professionnelle et utile.
  Si on te demande de rédiger un email ou un texte, fais-le avec un ton courtois.
  Contexte actuel de l'utilisateur (si pertinent) : ${context || 'Aucun contexte spécifique'}`;

  // 1. PROVIDER: GOOGLE GEMINI
  if (provider === 'gemini') {
    try {
      const finalKey = providerKeys?.gemini?.trim() || userApiKey?.trim() || defaultGeminiApiKey;
      if (!finalKey) {
        return "⚠️ Clé API Gemini manquante. Veuillez renseigner votre clé API dans l'onglet 'Assistant IA' des Paramètres.";
      }
      const aiClient = new GoogleGenAI({ apiKey: finalKey });
      
      const apiConfig: any = {
        systemInstruction: systemInstruction
      };

      if (model === 'gemini-3.5-flash') {
        apiConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await aiClient.models.generateContent({
        model: model,
        contents: query,
        config: apiConfig
      });

      return response.text || "Désolé, je n'ai pas pu générer de réponse de Gemini.";
    } catch (error: any) {
      console.error("Erreur Gemini:", error);
      return `Une erreur est survenue lors de la communication avec Gemini (${error?.message || error}). Veuillez vérifier votre clé API Gemini dans les Paramètres.`;
    }
  }

  // 2. PROVIDER: ANTHROPIC CLAUDE
  if (provider === 'anthropic') {
    const finalKey = providerKeys?.anthropic?.trim() || userApiKey?.trim();
    if (!finalKey) {
      return "⚠️ Clé API Anthropic Claude manquante. Veuillez configurer votre clé API Anthropic dans l'onglet 'Assistant IA' des Paramètres.";
    }

    try {
      // Direct call via Fetch for Claude
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": finalKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          // Anthropic normally blocks direct web CORS, we hint how to unblock if it fails
          "anthropic-dangerous-direct-browser-access": "true"
        } as any,
        body: JSON.stringify({
          model: model,
          max_tokens: 3000,
          system: systemInstruction,
          messages: [
            { role: "user", content: query }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erreur serveur ${response.status}`);
      }

      const data = await response.json();
      return data?.content?.[0]?.text || "Désolé, je n'ai pas obtenu de réponse de Claude.";
    } catch (error: any) {
      console.error("Erreur Claude API:", error);
      
      // Check for CORS or standard fetch locks
      if (error?.message?.includes("Failed to fetch") || error?.name === "TypeError") {
        return `⚠️ **Erreur de Connexion Directe (CORS) avec Claude** :
Anthropic bloque les appels API directs depuis un navigateur pour des raisons de sécurité. 

**Pour contourner cette limite dans votre navigateur de test :**
1. Installez une extension de déblocage CORS temporaire (ex: "CORS Unblock").
2. Ou bien configurez une Clé API Gemini (valeur par défaut) qui prend en charge nativement les requêtes du navigateur tiers.`;
      }

      return `Une erreur est survenue avec Claude (${error?.message || error}). Veuillez vérifier la validité de votre clé API Anthropic ou le modèle choisi.`;
    }
  }

  // 3. PROVIDER: MISTRAL AI
  if (provider === 'mistral') {
    const finalKey = providerKeys?.mistral?.trim() || userApiKey?.trim();
    if (!finalKey) {
      return "⚠️ Clé API Mistral AI manquante. Veuillez configurer votre clé API Mistral dans l'onglet 'Assistant IA' des Paramètres.";
    }

    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${finalKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: query }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erreur serveur ${response.status}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || "Désolé, je n'ai pas obtenu de réponse de Mistral.";
    } catch (error: any) {
      console.error("Erreur Mistral API:", error);

      if (error?.message?.includes("Failed to fetch") || error?.name === "TypeError") {
        return `⚠️ **Erreur de Connexion Directe (CORS) avec Mistral AI** :
Mistral AI bloque les appels API d'origines tierces non déclarées sur navigateur de développement.
Configurez votre navigateur pour accepter les requêtes d'origine croisée pour vos essais ou utilisez le modèle recommandé **Gemini** qui fonctionne nativement.`;
      }

      return `Une erreur est survenue avec Mistral AI (${error?.message || error}). Veuillez vérifier la validité de votre clé API Mistral.`;
    }
  }

  return "Fournisseur d'IA non reconnu.";
};

export const suggestInvoiceDescription = async (
  clientName: string, 
  serviceType: string,
  userApiKey?: string,
  userModel?: string,
  providerKeys?: {
    gemini?: string;
    anthropic?: string;
    mistral?: string;
  }
): Promise<string> => {
  try {
    const model = userModel?.trim() || 'gemini-3.5-flash';
    const provider = getProviderByModel(model);

    const prompt = `Génère une description professionnelle courte pour une ligne de facture destinée au client "${clientName}" pour un service de type : "${serviceType}". 
    La description doit être claire et formelle. Ne donne que la description, pas de guillemets.`;

    // Try generating description with fast gemini or fall back to native placeholder
    if (provider === 'gemini') {
      const finalKey = providerKeys?.gemini?.trim() || userApiKey?.trim() || defaultGeminiApiKey;
      if (!finalKey) return serviceType;
      const aiClient = new GoogleGenAI({ apiKey: finalKey });

      const response = await aiClient.models.generateContent({
        model: model,
        contents: prompt,
      });

      return response.text?.trim() || serviceType;
    } else {
      // For external providers, just run assistant response internally or keep simple
      return `Réalisation prestation: ${serviceType}`;
    }
  } catch (error) {
    console.error("Erreur génération description:", error);
    return serviceType;
  }
};

export interface OCRResult {
  date?: string;
  amount?: number;
  category?: 'Achats' | 'Loyer' | 'Logiciels' | 'Deplacements' | 'Assurance' | 'Sous-traitance' | 'Autre';
  supplierName?: string;
  description?: string;
  tvaAmount?: number;
  confidenceScore?: number;
}

/**
 * Analyzes a receipt image (base64) using Gemini flash and returns structured JSON
 */
export const analyzeReceiptOCR = async (
  imageBase64: string,
  mimeType: string,
  userApiKey?: string,
  providerKeys?: { gemini?: string }
): Promise<OCRResult> => {
  const finalKey = providerKeys?.gemini?.trim() || userApiKey?.trim() || defaultGeminiApiKey;
  if (!finalKey) {
    throw new Error("Clé API Gemini manquante. Veuillez configurer votre clé API dans les Paramètres.");
  }

  try {
    const aiClient = new GoogleGenAI({ apiKey: finalKey });
    
    // Structure image content with Part
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType
      }
    };

    const textPart = {
      text: `Analyse attentivement cette image de reçu, ticket de caisse, facture d'achat ou facture de frais. 
      Extrais-en les informations comptables structurées suivantes :
      1. La date d'opération au format YYYY-MM-DD
      2. Le montant total payé TTC (nombre décimal)
      3. La catégorie de dépense parmi : 'Achats' (achats matériel/fournitures), 'Loyer', 'Logiciels' (SaaS, logiciels, cloud, etc.), 'Deplacements' (transports, essence, taxi), 'Assurance', 'Sous-traitance', ou 'Autre'
      4. Le nom du fournisseur (tiers)
      5. Une courte description explicative pour le fisc français
      6. Le montant de la TVA payé si visible (nombre décimal), sinon 0.`
    };

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, textPart],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { 
              type: Type.STRING, 
              description: "La date de la dépense/facture au format YYYY-MM-DD" 
            },
            amount: { 
              type: Type.NUMBER, 
              description: "Le montant total de la dépense TTC" 
            },
            category: { 
              type: Type.STRING, 
              description: "La catégorie la plus adaptée parmi: 'Achats', 'Loyer', 'Logiciels', 'Deplacements', 'Assurance', 'Sous-traitance', 'Autre'" 
            },
            supplierName: { 
              type: Type.STRING, 
              description: "Le nom de l'entreprise ou du fournisseur émetteur du ticket" 
            },
            description: { 
              type: Type.STRING, 
              description: "Intitulé résumé de la dépense (ex: 'Achat de clavier USB standard', 'Repas client midi')" 
            },
            tvaAmount: { 
              type: Type.NUMBER, 
              description: "Montant de la TVA totale en euros" 
            }
          },
          required: ["date", "amount", "category", "supplierName", "description"]
        }
      }
    });

    const text = response.text || "";
    return JSON.parse(text) as OCRResult;
  } catch (error: any) {
    console.error("Erreur durant l'OCR Gemini:", error);
    throw new Error(`Échec de l'extraction par IA : ${error.message || error}`);
  }
};

/**
 * Generates AI-powered dunning email/letter templates for overdue client invoices
 */
export const generatePaymentDunning = async (
  invoiceNumber: string,
  clientName: string,
  amount: number,
  delayDays: number,
  currency: string,
  level: 'courtois' | 'ferme' | 'mise_en_demeure',
  userApiKey?: string,
  providerKeys?: { gemini?: string },
  yourName?: string
): Promise<string> => {
  const finalKey = providerKeys?.gemini?.trim() || userApiKey?.trim() || defaultGeminiApiKey;
  const signature = yourName ? yourName : "Le service de comptabilité";
  
  const systemInstruction = `Tu es un expert en recouvrement amiable de créances pour les indépendants et TPE françaises. 
  Rédige un e-mail de relance de paiement professionnel et irréprochable. Te focaliser entièrement sur la conciliation tout en étant respectueux.`;

  const prompt = `Génère une lettre ou un mail de relance pour la facture numéro ${invoiceNumber} destinée au client "${clientName}".
  Le montant impayé est de ${amount.toFixed(2)} ${currency}. La facture accuse actuellement un retard de paiement de ${delayDays} jours.
  
  Niveau de fermeté demandé : "${level}" 
  - 'courtois' : Premier rappel poli, simple oubli supposé, ton amical, offre d'assistance.
  - 'ferme' : Deuxième relance, constatation du retard infondé, demande de date de virement claire sous 48h.
  - 'mise_en_demeure' : Rappel solennel du cadre légal (intérêts de retard, pénalités forfaitaires de 40€ pour frais de recouvrement selon l'art. L441-10 du Code de commerce), ton formel, mention d'une procédure de recouvrement contentieux si non réglé sous 8 jours.

  Texte de signature final à utiliser : "${signature}"
  N'écris rien d'autre que l'e-mail lui-même (pas de "Voici l'e-mail :", pas de commentaires ou d'introduction).`;

  if (finalKey) {
    try {
      const aiClient = new GoogleGenAI({ apiKey: finalKey });
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction
        }
      });
      return response.text?.trim() || "Désolé, échec de génération automatique.";
    } catch (e) {
      console.warn("Gemini call failed inside dunning generation. Falling back to clean template.", e);
    }
  }

  // Fallback high-quality template of 3 levels if API key is not active
  if (level === 'courtois') {
    return `Objet : Relance amiable - Rappel de règlement - Facture ${invoiceNumber} - ${amount.toFixed(2)}${currency}

Bonjour,

Sauf erreur ou omission de notre part, nous constatons que la facture n° ${invoiceNumber}, datée d'échéance récente pour un montant de ${amount.toFixed(2)} ${currency}, est toujours en attente de règlement.

Il s'agit sans doute d'un simple oubli de votre part. Vous trouverez ci-joint un exemplaire de la facture pour faciliter le traitement. Vous pouvez effectuer le règlement par virement bancaire habituel.

Nous restons à votre entière disposition pour toute question ou si vous rencontrez le moindre contretemps de trésorerie.

En vous remerciant d'avance pour le traitement rapide de ce dossier, nous vous prions d'agréer l'expression de nos salutations distinguées.

Cordialement,
${signature}`;
  } else if (level === 'ferme') {
    return `Objet : DEUXIÈME RELANCE : Non-règlement de la Facture ${invoiceNumber} (Délai dépassé de ${delayDays} jours)

Bonjour,

Nous vous avons adressé un premier courriel concernant le règlement de la facture n° ${invoiceNumber} d'un montant de ${amount.toFixed(2)} ${currency}, normalement exigible il y a déjà ${delayDays} jours.

À ce jour, notre compte bancaire n'a toujours pas été crédité de cette somme. 

Nous vous demandons de bien vouloir procéder au paiement dans les plus brefs délais, idéalement sous 48 heures. En cas de virement déjà effectué, nous vous remercions de bien vouloir nous transmettre le justificatif de transaction afin que nous puissions régulariser votre compte client.

Nous comptons sur votre écoute et votre diligence pour clore cette formalité administrative.

Bien cordialement,
${signature}`;
  } else {
    return `Objet : MISE EN DEMEURE de paiement - Facture ${invoiceNumber} en souffrance depuis ${delayDays} jours

Madame, Monsieur,

En dépit de nos précédentes relances amiables restées infructueuses, nous constatons que votre compte présente à ce jour un solde débiteur de ${amount.toFixed(2)} ${currency} au titre de la facture n° ${invoiceNumber}.

Par la présente, nous vous mettons formellement en demeure de régler cette somme de ${amount.toFixed(2)} ${currency} sous un délai impératif de huit (8) jours à compter de la réception de ce courriel.

Nous vous rappelons que conformément à l'article L441-10 du Code de commerce :
1. Des intérêts de retard calculés au taux directeur de la BCE majoré de 10 points de pourcentage sont applicables de plein droit à compter du lendemain de la date d'échéance.
2. Une indemnité forfaitaire de quarante (40) euros pour frais de recouvrement est exigible de droit.

À défaut de paiement intégral de votre part dans le délai imparti, nous serons contraints de confier la défense de nos intérêts à notre conseil juridique afin d'engager une procédure de recouvrement judiciaire, sans autre avertissement préalable.

Nous espérons qu'un accord rapide évitera d'en arriver à ces extrémités préjudiciables.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${signature}`;
  }
};

