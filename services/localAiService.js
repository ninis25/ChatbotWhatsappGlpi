/**
 * Service d'IA local pour l'analyse, la classification et la génération de réponses
 * sur des tickets d'assistance, sans dépendre d'une API externe.
 * 
 * Basé sur un ensemble de règles et de mots-clés, ce service détermine :
 *   - Le type du ticket (incident ou demande) et sa confiance.
 *   - La catégorie du ticket (ex. matériel, réseau, logiciel, etc.) et sa confiance.
 *   - Le niveau d'urgence (1 à 5) et sa confiance.
 *   - Un résumé et un titre suggéré pour le ticket.
 *   - Des intentions de l'utilisateur (salutation, urgence, frustration, etc.).
 *   - Un suivi éventuel d'un ticket existant (avec numéro).
 *   - Le contexte et la complexité globale du problème.
 *   - Une réponse automatique personnalisée (dynamique).
 * 
 * Les méthodes principales sont :
 *   - analyzeTicket(text): renvoie type, catégorie, urgence, etc. pour un ticket.
 *   - analyzeContext(text, previousMessages): analyse avancée du texte (intents, complexité...).
 *   - generateResponse(analysis): génère un message de réponse complet en s'appuyant sur l'analyse.
 * 
 * Auteur : ChatGPT (version améliorée)
 */

const natural = require('natural');
const { WordTokenizer } = natural;
const tokenizer = new WordTokenizer();
const tensorflowService = require('./tensorflowService');

/**************************************************
 *                  Mots-clés                     *
 **************************************************/

// Mots-clés pour la classification des types de tickets
const INCIDENT_KEYWORDS = [
  'panne', 'problème', 'bug', 'erreur', 'ne fonctionne pas', 'cassé', 'bloqué',
  'planté', 'crash', 'dysfonctionnement', 'incident', 'défaut', 'défaillance',
  'brisé', 'en panne', 'ne marche pas', 'ne répond pas', 'impossible d\'accéder',
  'ne s\'allume pas', 'écran bleu', 'virus', 'malware', 'lent', 'ralenti'
];

const REQUEST_KEYWORDS = [
  'demande', 'besoin', 'nouveau', 'installation', 'mise à jour', 'configurer',
  'paramétrer', 'créer', 'ajouter', 'modifier', 'changer', 'remplacer', 'mettre à jour',
  'accès', 'autorisation', 'permission', 'droit', 'compte', 'identifiant', 'mot de passe',
  'formation', 'aide', 'assistance', 'information', 'renseignement', 'conseil'
];

// Mots-clés pour la classification des catégories
const CATEGORY_KEYWORDS = {
  // Incidents
  'incident_autre':    ['autre', 'divers', 'inconnu'],
  'incident_logiciel': ['logiciel', 'application', 'programme', 'software', 'windows', 'office', 'excel', 'word', 'outlook', 'email', 'mail', 'navigateur', 'browser', 'chrome', 'firefox', 'edge', 'internet'],
  'incident_materiel': ['matériel', 'hardware', 'ordinateur', 'pc', 'laptop', 'écran', 'clavier', 'souris', 'imprimante', 'scanner', 'téléphone', 'batterie', 'chargeur', 'alimentation', 'disque dur', 'mémoire', 'ram'],
  'incident_reseau':   ['réseau', 'network', 'internet', 'wifi', 'connexion', 'déconnexion', 'lent', 'intranet', 'serveur', 'vpn', 'proxy', 'dns', 'ip', 'ethernet', 'routeur', 'switch', 'firewall'],
  'incident_securite': ['sécurité', 'virus', 'malware', 'ransomware', 'phishing', 'hameçonnage', 'spam', 'piratage', 'hack', 'compromis', 'suspect', 'accès non autorisé', 'mot de passe', 'authentification'],
  
  // Demandes
  'demande_acces':       ['accès', 'autorisation', 'permission', 'droit', 'compte', 'identifiant', 'login', 'mot de passe', 'réinitialisation', 'débloquer', 'verrouillé'],
  'demande_autre':       ['autre', 'divers', 'spécifique', 'particulier'],
  'demande_information': ['information', 'renseignement', 'question', 'comment', 'procédure', 'documentation', 'guide', 'manuel', 'formation', 'aide', 'assistance', 'conseil'],
  'demande_logiciel':    ['logiciel', 'application', 'programme', 'software', 'installation', 'mise à jour', 'update', 'version', 'licence', 'license', 'abonnement', 'office', 'windows'],
  'demande_materiel':    ['matériel', 'hardware', 'équipement', 'ordinateur', 'pc', 'laptop', 'écran', 'clavier', 'souris', 'imprimante', 'scanner', 'téléphone', 'mobile', 'smartphone', 'tablette', 'casque', 'accessoire']
};

// Mapping catégorie -> ID
const CATEGORY_MAP = {
  'incident_autre':       10,  // Incident - autre
  'incident_logiciel':    8,   // Incident - logiciel
  'incident_materiel':    7,   // Incident - matériel
  'incident_reseau':      6,   // Incident - Réseau
  'incident_securite':    9,   // Incident - sécurité
  'demande_acces':        1,   // Demande - Accès
  'demande_autre':        5,   // Demande - Autre
  'demande_information':  4,   // Demande - Information
  'demande_logiciel':     3,   // Demande - logiciel
  'demande_materiel':     2    // Demande - Nouveau matériel
};

/**************************************************
 *           Fonctions utilitaires                *
 **************************************************/

/**
 * Compte le nombre d'occurrences d’un ensemble de mots-clés dans un texte.
 * @param {string} text - Le texte à analyser.
 * @param {string[]} keywords - Liste de mots-clés à rechercher.
 * @returns {number} - Le nombre total d'occurrences.
 */
function countKeywords(text, keywords) {
  const normalizedText = text.toLowerCase();
  let count = 0;
  
  keywords.forEach(keyword => {
    // Expression régulière pour trouver toutes les occurrences
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b|${keyword.toLowerCase()}`, 'g');
    const matches = normalizedText.match(regex);
    if (matches) {
      count += matches.length;
    }
  });
  
  return count;
}

/**
 * Calcule la similarité (coefficient de Jaccard) entre deux textes,
 * basé sur les ensembles de mots.
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number} - Score de similarité entre 0 et 1.
 */
function calculateSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**************************************************
 *        Fonctions principales du service        *
 **************************************************/

const localAiService = {
  /**
   * Classifie un ticket comme incident ou demande (basé sur des mots-clés).
   * @param {string} text - Le texte à analyser.
   * @returns {{ type: string, typeId: number, confidence: number }}
   */
  async classifyTicketType(text) {
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await tensorflowService.predictTicketType(text);
      
      // Si la confiance est suffisamment élevée, utiliser le résultat du modèle
      if (tfResult.confidence > 0.7) {
        return tfResult;
      }
      
      // Sinon, utiliser l'approche basée sur les règles comme fallback
      const lowerText = text.toLowerCase();
      
      let incidentScore = 0;
      let requestScore = 0;
      
      // Compter les occurrences des mots-clés d'incident
      INCIDENT_KEYWORDS.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
          incidentScore++;
        }
      });
      
      // Compter les occurrences des mots-clés de demande
      REQUEST_KEYWORDS.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
          requestScore++;
        }
      });
      
      // Déterminer le type en fonction des scores
      if (incidentScore > requestScore) {
        return { type: 'incident', typeId: 1, confidence: incidentScore / (incidentScore + requestScore) };
      } else if (requestScore > incidentScore) {
        return { type: 'demande', typeId: 2, confidence: requestScore / (incidentScore + requestScore) };
      } else {
        // Par défaut, considérer comme un incident
        return { type: 'incident', typeId: 1, confidence: 0.5 };
      }
    } catch (error) {
      console.error("Erreur lors de l'analyse du type de ticket:", error);
      // Fallback en cas d'erreur
      return { type: 'incident', typeId: 1, confidence: 0.5 };
    }
  },
  
  /**
   * Classifie la catégorie d'un ticket (matériel, réseau, etc.) en fonction du type (incident ou demande).
   * @param {string} text - Le texte à analyser.
   * @param {string} type - 'incident' ou 'demande'.
   * @returns {{ category: string, categoryId: number, confidence: number }}
   */
  async classifyTicketCategory(text, type) {
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await tensorflowService.predictTicketCategory(text, type);
      
      // Si la confiance est suffisamment élevée, utiliser le résultat du modèle
      if (tfResult.confidence > 0.6) {
        return tfResult;
      }
      
      // Sinon, utiliser l'approche basée sur les règles comme fallback
      const lowerText = text.toLowerCase();
      const scores = {};
      
      // Filtrer les catégories en fonction du type
      const relevantCategories = Object.keys(CATEGORY_KEYWORDS).filter(category => 
        type === 'incident' ? category.startsWith('incident_') : category.startsWith('demande_')
      );
      
      // Calculer les scores pour chaque catégorie
      relevantCategories.forEach(category => {
        scores[category] = 0;
        CATEGORY_KEYWORDS[category].forEach(keyword => {
          if (lowerText.includes(keyword.toLowerCase())) {
            scores[category]++;
          }
        });
      });
      
      // Trouver la catégorie avec le score le plus élevé
      let bestCategory = relevantCategories[0];
      let highestScore = 0;
      
      Object.keys(scores).forEach(category => {
        if (scores[category] > highestScore) {
          highestScore = scores[category];
          bestCategory = category;
        }
      });
      
      // Mapping des catégories vers les IDs
      const categoryMap = {
        'incident_autre':       10,
        'incident_logiciel':    8,
        'incident_materiel':    7,
        'incident_reseau':      6,
        'incident_securite':    9,
        'demande_acces':        1,
        'demande_autre':        5,
        'demande_information':  4,
        'demande_logiciel':     3,
        'demande_materiel':     2
      };
      
      // Calculer la confiance (nombre de mots-clés correspondants / nombre total de mots-clés)
      const totalKeywords = relevantCategories.reduce((sum, category) => sum + CATEGORY_KEYWORDS[category].length, 0);
      const confidence = highestScore / totalKeywords;
      
      return {
        category: bestCategory,
        categoryId: categoryMap[bestCategory],
        confidence: parseFloat(confidence.toFixed(2))
      };
    } catch (error) {
      console.error("Erreur lors de l'analyse de la catégorie de ticket:", error);
      // Fallback en cas d'erreur
      return { 
        category: type === 'incident' ? 'incident_autre' : 'demande_autre',
        categoryId: type === 'incident' ? 10 : 5,
        confidence: 0.5 
      };
    }
  },
  
  /**
   * Suggestion du niveau d'urgence (1-5) d'un ticket (basé sur des mots-clés).
   * @param {string} text - Le texte à analyser.
   * @returns {{ urgency: number, confidence: number }}
   */
  async assessUrgency(text) {
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await tensorflowService.predictUrgency(text);
      
      // Si la confiance est suffisamment élevée, utiliser le résultat du modèle
      if (tfResult.confidence > 0.6) {
        return tfResult.urgency;
      }
      
      // Sinon, utiliser l'approche basée sur les règles comme fallback
      const lowerText = text.toLowerCase();
      let urgencyScore = 0;
      
      // Mots-clés indiquant une urgence élevée
      const highUrgencyKeywords = [
        'urgent', 'critique', 'immédiatement', 'grave', 'bloquant',
        'impossible de travailler', 'production arrêtée', 'sécurité compromise'
      ];
      
      // Mots-clés indiquant une urgence moyenne
      const mediumUrgencyKeywords = [
        'important', 'prioritaire', 'rapidement', 'dès que possible',
        'impact significatif', 'plusieurs utilisateurs', 'service dégradé'
      ];
      
      // Mots-clés indiquant une faible urgence
      const lowUrgencyKeywords = [
        'basse', 'faible', 'quand vous aurez le temps', 'non urgent',
        'peu important', 'amélioration', 'suggestion'
      ];
      
      // Calculer le score d'urgence
      highUrgencyKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) urgencyScore += 2;
      });
      
      mediumUrgencyKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) urgencyScore += 1;
      });
      
      lowUrgencyKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) urgencyScore -= 1;
      });
      
      // Convertir le score en niveau d'urgence (1-5)
      if (urgencyScore >= 4) return 1; // Très urgent
      if (urgencyScore >= 2) return 2; // Urgent
      if (urgencyScore >= 0) return 3; // Normal
      if (urgencyScore >= -2) return 4; // Faible
      return 5; // Très faible
    } catch (error) {
      console.error("Erreur lors de l'évaluation de l'urgence:", error);
      // Urgence par défaut en cas d'erreur
      return 3;
    }
  },
  
  /**
   * Analyse de base d’un ticket pour déterminer type, catégorie et urgence.
   * @param {string} text - Le texte à analyser.
   * @returns {Object} - Résultat de l'analyse (type, catégorie, urgences, etc.).
   */
  async analyzeTicket(text) {
    try {
      // Tenter d'utiliser l'analyse TensorFlow complète
      const tfAnalysis = await tensorflowService.analyzeTicket(text);
      
      // Si toutes les confiances sont élevées, utiliser directement le résultat TensorFlow
      if (tfAnalysis.typeConfidence > 0.7 && 
          tfAnalysis.categoryConfidence > 0.6 && 
          tfAnalysis.urgencyConfidence > 0.6) {
        return {
          type: tfAnalysis.type,
          typeId: tfAnalysis.typeId,
          category: tfAnalysis.category,
          categoryId: tfAnalysis.categoryId,
          urgency: tfAnalysis.urgency,
          title: tfAnalysis.suggestedTitle,
          content: text
        };
      }
      
      // Sinon, utiliser notre approche hybride
      const typeResult = await this.classifyTicketType(text);
      const categoryResult = await this.classifyTicketCategory(text, typeResult.type);
      const urgency = await this.assessUrgency(text);
      
      // Extraire un titre potentiel (première phrase ou premiers mots)
      let title = text.split('.')[0].trim();
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      return {
        type: typeResult.type,
        typeId: typeResult.typeId,
        category: categoryResult.category,
        categoryId: categoryResult.categoryId,
        urgency: urgency,
        title: title,
        content: text
      };
    } catch (error) {
      console.error("Erreur lors de l'analyse complète du ticket:", error);
      
      // Analyse de secours en cas d'erreur
      const typeResult = await this.classifyTicketType(text);
      const categoryResult = await this.classifyTicketCategory(text, typeResult.type);
      const urgency = await this.assessUrgency(text);
      
      let title = text.split('.')[0].trim();
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      return {
        type: typeResult.type,
        typeId: typeResult.typeId,
        category: categoryResult.category,
        categoryId: categoryResult.categoryId,
        urgency: urgency,
        title: title,
        content: text
      };
    }
  },
  
  /**
   * Extrait des entités nommées du texte (personnes, lieux, dates, etc.) - simplifié.
   * @param {string} text - Le texte à analyser.
   * @returns {{ dates: string[], locations: string[], people: string[], organizations: string[] }}
   */
  extractEntities(text) {
    const entities = {
      dates: [],
      locations: [],
      people: [],
      organizations: []
    };
    
    // Dates (format simple : JJ/MM/AAAA, etc.)
    const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;
    entities.dates = text.match(dateRegex) || [];
    
    // Noms de personnes (M., Mme, Dr, etc. suivi d'un nom)
    const peopleRegex = /\b(M\.|Mme|Dr|Docteur|Pr|Professeur)\s+[A-Z][a-zéèêëàâäôöùûüç]+([-\s][A-Z][a-zéèêëàâäôöùûüç]+)*\b/g;
    entities.people = text.match(peopleRegex) || [];
    
    return entities;
  },
  
  /**
   * Améliore (corrige) le texte en remplaçant certaines fautes ou abréviations courantes.
   * @param {string} text - Le texte à corriger.
   * @returns {string} - Texte corrigé.
   */
  improveText(text) {
    const corrections = {
      'probleme': 'problème',
      'pb': 'problème',
      'ordi': 'ordinateur',
      'appli': 'application',
      'applis': 'applications',
      'tel': 'téléphone',
      'tel.': 'téléphone',
      'pc': 'PC',
      'wifi': 'WiFi',
      'mail': 'e-mail',
      'email': 'e-mail',
      'emails': 'e-mails',
      'mdp': 'mot de passe'
    };
    
    let correctedText = text;
    
    Object.keys(corrections).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      correctedText = correctedText.replace(regex, corrections[word]);
    });
    
    return correctedText;
  },
  
  /**
   * Détecte les intentions présentes dans le texte (salutation, remerciement, urgence, frustration, confusion...).
   * @param {string} text - Le texte à analyser.
   * @returns {{ intents: Object, sentiment: number, sentimentLabel: string }}
   */
  detectIntents(text) {
    const normalizedText = text.toLowerCase();
    
    // Patterns d'intention
    const intentPatterns = {
      'salutation': [
        /^bonjour/i, /^salut/i, /^hello/i, /^coucou/i, /^bonsoir/i,
        /comment ça va/i, /comment allez[- ]vous/i
      ],
      'remerciement': [
        /merci/i, /je vous remercie/i, /thanks/i, /thank you/i, /remerciements/i
      ],
      'urgence': [
        /urgent/i, /rapidement/i, /immédiatement/i, /dès que possible/i,
        /c'est critique/i, /prioritaire/i, /en urgence/i
      ],
      'frustration': [
        /pas content/i, /mécontent/i, /insatisfait/i, /déçu/i, /attends depuis/i,
        /trop long/i, /trop lent/i, /ça ne fonctionne toujours pas/i, /encore/i,
        /toujours pas/i, /jamais/i, /inacceptable/i
      ],
      'confusion': [
        /je ne comprends pas/i, /pas clair/i, /confus/i, /confusion/i,
        /pourquoi/i, /comment/i, /expliquer/i
      ]
    };
    
    const detectedIntents = {};
    Object.keys(intentPatterns).forEach(intent => {
      detectedIntents[intent] = false;
      intentPatterns[intent].forEach(pattern => {
        if (pattern.test(normalizedText)) {
          detectedIntents[intent] = true;
        }
      });
    });
    
    // Calcul du score de sentiment (très basique)
    const positiveWords = ['merci', 'bien', 'super', 'excellent', 'parfait', 'génial', 'content'];
    const negativeWords = ['problème', 'erreur', 'bug', 'mauvais', 'horrible', 'terrible', 'nul', 'pas content'];
    
    let sentimentScore = 0;
    positiveWords.forEach(word => {
      if (normalizedText.includes(word)) sentimentScore += 1;
    });
    negativeWords.forEach(word => {
      if (normalizedText.includes(word)) sentimentScore -= 1;
    });
    
    let sentimentLabel = 'neutre';
    if (sentimentScore > 0) sentimentLabel = 'positif';
    if (sentimentScore < 0) sentimentLabel = 'négatif';
    
    return {
      intents: detectedIntents,
      sentiment: sentimentScore,
      sentimentLabel
    };
  },
  
  /**
   * Détecte si le message fait suite à un ticket existant (avec numéro).
   * @param {string} text - Le texte à analyser.
   * @returns {{ isFollowUp: boolean, ticketNumber: (string|null) }}
   */
  detectTicketFollowUp(text) {
    const normalizedText = text.toLowerCase();
    
    // Recherche de numéros explicités
    const followUpPatterns = [
      /ticket (\d+)/i,
      /demande (\d+)/i,
      /incident (\d+)/i,
      /référence (\d+)/i,
      /numéro (\d+)/i,
      /suivi de (?:ma|mon|le|la) (?:demande|ticket|incident) (\d+)/i,
      /où en est (?:ma|mon|le|la) (?:demande|ticket|incident)(?: (\d+))?/i
    ];
    
    let isFollowUp = false;
    let ticketNumber = null;
    
    for (const pattern of followUpPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        isFollowUp = true;
        ticketNumber = match[1];
        break;
      }
    }
    
    // Vérifie les formulations générales de suivi sans numéro
    if (!isFollowUp) {
      const generalFollowUpPatterns = [
        /où en est ma demande/i,
        /statut de ma demande/i,
        /suivi de mon ticket/i,
        /avancement de mon incident/i,
        /des nouvelles de ma demande/i
      ];
      for (const pattern of generalFollowUpPatterns) {
        if (pattern.test(normalizedText)) {
          isFollowUp = true;
          break;
        }
      }
    }
    
    return { isFollowUp, ticketNumber };
  },
  
  /**
   * Évalue la complexité d’un problème en se basant sur certains facteurs (mots-clés, longueur...).
   * @param {string} text - Le texte à analyser.
   * @returns {{ level: string, score: number, factors: Object }}
   */
  assessComplexity(text) {
    const normalizedText = text.toLowerCase();
    
    const complexityFactors = {
      multipleIssues: /plusieurs problèmes|différents problèmes|multiples erreurs|divers soucis/i.test(normalizedText),
      technicalTerms: /api|serveur|base de données|réseau|configuration|sql|java|python|code|programmation|script|backend|frontend/i.test(normalizedText),
      longDescription: text.length > 200,
      systemWide: /tous les utilisateurs|système entier|plateforme complète|tout le monde|global/i.test(normalizedText),
      securityRelated: /sécurité|virus|malware|ransomware|phishing|hameçonnage|spam|piratage|hack|compromis|suspect|accès non autorisé|mot de passe|authentification/i.test(normalizedText)
    };
    
    let complexityScore = 0;
    Object.values(complexityFactors).forEach(factor => {
      if (factor) complexityScore += 1;
    });
    
    let complexityLevel = 'simple';
    if (complexityScore >= 4) {
      complexityLevel = 'très complexe';
    } else if (complexityScore >= 2) {
      complexityLevel = 'complexe';
    } else if (complexityScore >= 1) {
      complexityLevel = 'modéré';
    }
    
    return {
      level: complexityLevel,
      score: complexityScore,
      factors: complexityFactors
    };
  },
  
  /**
   * Analyse contextuelle avancée du texte (intents, suivi, complexité, etc.).
   * @param {string} text - Le texte à analyser.
   * @param {Object[]} [previousMessages=[]] - Historique (facultatif).
   * @returns {Object} - Objet contenant l'analyse détaillée.
   */
  analyzeContext(text, previousMessages = []) {
    // 1. Intentions (salutation, remerciement, urgence, frustration, confusion)
    const intents = this.detectIntents(text);
    
    // 2. Suivi d’un ticket
    const followUp = this.detectTicketFollowUp(text);
    
    // 3. Complexité globale
    const complexity = this.assessComplexity(text);
    
    // 4. Extraction d’entités (dates, noms, etc.)
    const entities = this.extractEntities(text);
    
    // 5. Urgence implicite
    // (On peut se baser sur la méthode "suggestUrgency" déjà existante,
    //  ou détecter d'autres indices ; ici, on le fait en "manuel".)
    
    const urgencyIndicators = {
      high: ['urgent', 'immédiatement', 'critique', 'grave', 'important', 'rapidement', 'dès que possible', 'bloquant', 'bloqué', 'impossible de travailler'],
      medium: ['dès que possible', 'bientôt', 'cette semaine', 'assez important'],
      low: ['quand vous aurez le temps', 'pas urgent', 'peu important', 'à votre convenance']
    };
    
    let implicitUrgency = 'medium';
    outerLoop:
    for (const [level, keywords] of Object.entries(urgencyIndicators)) {
      for (const keyword of keywords) {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          implicitUrgency = level;
          if (level === 'high') break outerLoop;
        }
      }
    }
    
    // 6. Impact sur l’activité
    const impactIndicators = {
      high: ['tous les utilisateurs', 'toute l\'entreprise', 'tous les services', 'production bloquée', 'impossible de travailler', 'arrêt de service', 'perte de données', 'fuite de données', 'sécurité compromise'],
      medium: ['plusieurs utilisateurs', 'mon équipe', 'mon service', 'ralentissement important'],
      low: ['seulement moi', 'un utilisateur', 'gênant mais contournable', 'problème mineur']
    };
    
    let businessImpact = 'medium';
    outerLoop2:
    for (const [level, keywords] of Object.entries(impactIndicators)) {
      for (const keyword of keywords) {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          businessImpact = level;
          if (level === 'high') break outerLoop2;
        }
      }
    }
    
    // 7. Analyse du ton et du sentiment
    let sentiment = intents.sentimentLabel; // 'positif', 'négatif', 'neutre'
    let sentimentScore = intents.sentiment;
    
    // 8. Détection de récurrence
    const recurrenceIndicators = ['encore', 'à nouveau', 'toujours', 'de nouveau', 'comme la dernière fois', 'récurrent', 'persiste', 'continue'];
    const isRecurring = recurrenceIndicators.some(i => text.toLowerCase().includes(i));
    
    // 9. Détection d’actions déjà tentées
    const attemptIndicators = ['j\'ai essayé', 'j\'ai tenté', 'j\'ai redémarré', 'j\'ai vérifié', 'j\'ai déjà', 'après avoir'];
    const hasPreviousAttempts = attemptIndicators.some(i => text.toLowerCase().includes(i));
    
    // 10. Évaluation de la compétence technique
    const technicalTerms = ['adresse ip', 'dns', 'serveur', 'réseau', 'vpn', 'proxy', 'pare-feu', 'firewall', 'base de données', 'sql', 'api', 'code d\'erreur', 'log', 'journal d\'événements', 'registre', 'gpo', 'active directory', 'dhcp', 'routeur', 'switch', 'vlan'];
    const technicalTermCount = technicalTerms.filter(t => text.toLowerCase().includes(t)).length;
    const technicalExpertise = technicalTermCount > 3 ? 'high' : (technicalTermCount > 0 ? 'medium' : 'low');
    
    // 11. Contexte temporel (passé, présent, futur)
    const timeIndicators = {
      past: ['hier', 'la semaine dernière', 'il y a', 'auparavant', 'précédemment'],
      present: ['maintenant', 'actuellement', 'en ce moment', 'aujourd\'hui'],
      future: ['demain', 'prochainement', 'bientôt', 'la semaine prochaine', 'prévoir']
    };
    
    let temporalContext = 'present';
    for (const [time, indicators] of Object.entries(timeIndicators)) {
      if (indicators.some(indicator => text.toLowerCase().includes(indicator.toLowerCase()))) {
        temporalContext = time;
        break;
      }
    }
    
    // 12. Clarté de la demande
    const clarityIndicators = {
      unclear: ['je ne sais pas', 'peut-être', 'je crois', 'je pense', 'probablement', 'quelque chose ne va pas', 'bizarre', 'étrange'],
      clear: ['précisément', 'exactement', 'spécifiquement', 'clairement', 'le problème est']
    };
    
    let requestClarity = 'medium';
    if (clarityIndicators.unclear.some(i => text.toLowerCase().includes(i))) {
      requestClarity = 'low';
    } else if (clarityIndicators.clear.some(i => text.toLowerCase().includes(i))) {
      requestClarity = 'high';
    }
    
    // 13. Préoccupation de sécurité
    const securityKeywords = ['virus', 'malware', 'ransomware', 'phishing', 'hameçonnage', 'piratage', 'hack', 'compromis', 'suspect', 'accès non autorisé', 'mot de passe volé', 'données personnelles'];
    const securityConcern = securityKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
    
    return {
      intents,
      followUp,
      complexity,
      entities,
      urgency: implicitUrgency,
      businessImpact,
      sentiment: { label: sentiment, score: sentimentScore },
      recurrence: { isRecurring, indicators: recurrenceIndicators.filter(i => text.toLowerCase().includes(i)) },
      previousAttempts: { hasPreviousAttempts, indicators: attemptIndicators.filter(i => text.toLowerCase().includes(i)) },
      technicalExpertise: { level: technicalExpertise, terms: technicalTerms.filter(t => text.toLowerCase().includes(t)) },
      temporalContext,
      clarity: {
        level: requestClarity,
        indicators: [] // (indicateurs repérés si besoin)
      },
      security: {
        hasConcern: securityConcern,
        keywords: securityKeywords.filter(k => text.toLowerCase().includes(k.toLowerCase()))
      }
    };
  },
  
  /**
   * Suggère les prochaines actions à effectuer en fonction de l'analyse (intents, suivi, complexité...).
   * @param {Object} intents - Intents détectés par detectIntents().
   * @param {Object} followUp - Résultat de detectTicketFollowUp().
   * @param {Object} complexity - Résultat de assessComplexity().
   * @returns {string[]} - Liste d'actions suggérées.
   */
  suggestNextActions(intents, followUp, complexity) {
    const actions = [];
    
    // 1. Suivi de ticket
    if (followUp.isFollowUp) {
      actions.push('rechercher_ticket');
      if (followUp.ticketNumber) {
        actions.push('afficher_statut_ticket');
      } else {
        actions.push('demander_numero_ticket');
      }
    }
    
    // 2. Frustration
    if (intents.intents.frustration) {
      actions.push('escalader_priorite');
      actions.push('offrir_assistance_supplementaire');
    }
    
    // 3. Urgence
    if (intents.intents.urgence) {
      actions.push('augmenter_urgence');
    }
    
    // 4. Complexité
    if (complexity.level === 'complexe' || complexity.level === 'très complexe') {
      actions.push('assigner_technicien_senior');
      
      if (complexity.factors.securityRelated) {
        actions.push('notifier_equipe_securite');
      }
      if (complexity.factors.systemWide) {
        actions.push('verifier_impact_systeme');
      }
    }
    
    // 5. Actions par défaut si rien n’a été suggéré
    if (actions.length === 0) {
      actions.push('creer_ticket_standard');
    }
    
    return actions;
  },
  
  /**
   * Génère un résumé du ticket à partir de la description (extrait la première phrase, max 100 caractères).
   * @param {string} text - Description complète.
   * @returns {string} - Résumé du ticket.
   */
  generateSummary(text) {
    // Extraire la première phrase ou les 100 premiers caractères
    let summary = '';
    const firstSentenceMatch = text.match(/^(.*?[.!?])\s/);
    
    if (firstSentenceMatch && firstSentenceMatch[1].length <= 100) {
      summary = firstSentenceMatch[1];
    } else {
      summary = text.substring(0, 97) + '...';
    }
    
    // Supprimer les formules de politesse au début (ex: Bonjour,...)
    const politenessPhrases = [/^bonjour,?\s*/i, /^salut,?\s*/i, /^bonsoir,?\s*/i, /^coucou,?\s*/i, /^hello,?\s*/i];
    politenessPhrases.forEach(phrase => {
      summary = summary.replace(phrase, '');
    });
    
    // Capitaliser la première lettre
    if (summary.length > 0) {
      summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    }
    
    return summary;
  },
  
  /**
   * Génère une réponse automatique basée sur l'analyse du ticket et sur une analyse contextuelle.
   * @param {Object} analysis - Résultat de l'analyse de base (type, category, urgence...).
   * @returns {string} - Réponse générée.
   */
  generateResponse(analysis) {
    // Obtenir l'analyse contextuelle complète
    const contextAnalysis = this.analyzeContext(analysis.originalText || "");
    
    /******************************************************
     *     Base de connaissances pour les suggestions     *
     ******************************************************/
    const knowledgeBase = {
      logiciel: {
        solutions: [
          "redémarrer l'application",
          "vérifier les mises à jour disponibles",
          "effacer le cache de l'application",
          "désinstaller puis réinstaller l'application",
          "vérifier la compatibilité avec votre système d'exploitation"
        ],
        preventions: [
          "maintenir vos logiciels à jour",
          "sauvegarder régulièrement vos données",
          "éviter d'installer des logiciels non vérifiés"
        ]
      },
      materiel: {
        solutions: [
          "vérifier les connexions et les câbles",
          "redémarrer l'appareil",
          "vérifier les voyants d'état",
          "tester avec un autre équipement si possible",
          "vérifier la source d'alimentation"
        ],
        preventions: [
          "nettoyer régulièrement vos équipements",
          "éviter les expositions à des températures extrêmes",
          "protéger vos appareils contre les surtensions"
        ]
      },
      reseau: {
        solutions: [
          "redémarrer votre routeur/modem",
          "vérifier la connexion WiFi ou Ethernet",
          "tester la connexion sur un autre appareil",
          "vérifier les paramètres réseau",
          "se rapprocher d'un point d'accès WiFi"
        ],
        preventions: [
          "utiliser un mot de passe WiFi sécurisé",
          "mettre à jour le firmware de votre routeur",
          "éviter de surcharger votre réseau"
        ]
      },
      securite: {
        solutions: [
          "changer immédiatement vos mots de passe",
          "activer l'authentification à deux facteurs",
          "scanner votre système avec un antivirus",
          "ne pas cliquer sur des liens suspects",
          "vérifier les autorisations des applications"
        ],
        preventions: [
          "utiliser des mots de passe forts et uniques",
          "mettre à jour régulièrement vos logiciels de sécurité",
          "être vigilant face aux tentatives de phishing"
        ]
      }
    };
    
    // Détection de produits/technologies spécifiques (exemple)
    const specificKeywords = {
      microsoft: ["Office", "Windows", "Excel", "Word", "Outlook", "Teams", "OneDrive", "SharePoint", "Microsoft"],
      apple: ["Mac", "MacBook", "iPhone", "iPad", "iOS", "macOS", "Safari", "iCloud", "Apple"],
      google: ["Gmail", "Chrome", "Drive", "Docs", "Sheets", "Android", "Google"],
      reseau_specifique: ["VPN", "proxy", "DNS", "DHCP", "firewall", "pare-feu", "routeur", "switch", "WiFi", "Ethernet"]
    };
    
    let detectedProducts = [];
    for (const [category, keywords] of Object.entries(specificKeywords)) {
      for (const keyword of keywords) {
        if (analysis.originalText.includes(keyword)) {
          detectedProducts.push({ category, keyword });
        }
      }
    }
    
    /******************************************************
     *       Construction de la réponse dynamique        *
     ******************************************************/
    let response = "";
    
    // 1. Salutation basée sur le sentiment
    const { sentiment } = contextAnalysis;
    if (sentiment.label === 'very_negative') {
      response += "Je comprends votre frustration et je vous présente nos sincères excuses pour ce désagrément. ";
    } else if (sentiment.label === 'négatif') {
      response += "Je suis désolé pour ce problème que vous rencontrez. ";
    } else if (sentiment.label === 'positif') {
      response += "Merci pour votre message et votre confiance. ";
    } else {
      response += "Merci de nous avoir contactés. ";
    }
    
    // 2. Confirmation de création du ticket
    response += "Votre ticket a été créé avec succès et sera traité ";
    if (analysis.urgency <= 2) {
      response += "en priorité haute. ";
    } else if (analysis.urgency === 3) {
      response += "avec une priorité normale. ";
    } else {
      response += "dès que possible. ";
    }
    
    // 3. Empathie selon le contexte
    if (analysis.type === 'incident') {
      if (contextAnalysis.recurrence.isRecurring) {
        response += "Nous notons qu'il s'agit d'un problème récurrent, ce qui sera pris en compte dans son traitement. ";
      }
      if (contextAnalysis.previousAttempts.hasPreviousAttempts) {
        response += "Nous avons bien noté les actions que vous avez déjà entreprises pour résoudre ce problème. ";
      }
      
      if (contextAnalysis.complexity.level === 'complexe' || contextAnalysis.complexity.level === 'très complexe') {
        response += "Votre incident semble complexe et sera traité par nos experts. ";
      }
      
      // 4. Suggestions selon la catégorie
      let categoryKey = "";
      switch (analysis.categoryId) {
        case 1:  categoryKey = "autre"; break;
        case 2:  categoryKey = "logiciel"; break;
        case 3:  categoryKey = "materiel"; break;
        case 4:  categoryKey = "reseau"; break;
        case 5:  categoryKey = "securite"; break;
        default: categoryKey = "autre"; break;
      }
      
      if (categoryKey !== "autre" && knowledgeBase[categoryKey]) {
        const { solutions, preventions } = knowledgeBase[categoryKey];
        
        // Une suggestion aléatoire de solution
        if (solutions && solutions.length > 0) {
          const randomSolution = solutions[Math.floor(Math.random() * solutions.length)];
          response += `\n\nEn attendant qu'un technicien prenne en charge votre ticket, vous pourriez essayer de ${randomSolution}. `;
        }
        
        // Info produit
        if (detectedProducts.length > 0) {
          const product = detectedProducts[0].keyword;
          response += `Comme votre problème concerne ${product}, `;
          const cat = detectedProducts[0].category;
          if (cat === 'microsoft') {
            response += "vous pourriez également consulter le centre d'aide Microsoft ou vérifier les problèmes connus avec les dernières mises à jour. ";
          } else if (cat === 'apple') {
            response += "vous pourriez également consulter le support Apple ou vérifier l'état de vos services sur le site d'Apple. ";
          } else if (cat === 'google') {
            response += "vous pourriez également consulter le centre d'aide Google ou vérifier l'état des services Google. ";
          } else if (cat === 'reseau_specifique') {
            response += "notre équipe réseau sera particulièrement attentive à votre problème. ";
          }
        }
        
        // Un conseil de prévention (50% de chance)
        if (preventions && preventions.length > 0 && Math.random() > 0.5) {
          const randomPrevention = preventions[Math.floor(Math.random() * preventions.length)];
          response += `\n\nPour éviter ce type de problème à l'avenir, nous vous recommandons de ${randomPrevention}. `;
        }
      }
      
    } else {
      // Demande
      if (contextAnalysis.urgency === 'high') {
        response += "Nous comprenons l'urgence de votre demande et allons la traiter en priorité. ";
      }
      if (contextAnalysis.clarity.level === 'low') {
        response += "Pour mieux traiter votre demande, un technicien pourrait vous contacter pour obtenir des précisions supplémentaires. ";
      }
      
      switch (analysis.categoryId) {
        case 6:
          response += "\n\nVotre demande d'accès sera traitée selon notre procédure de validation. Le délai habituel de traitement est de 24 à 48 heures ouvrées.";
          break;
        case 7:
          response += "\n\nVotre demande a été transmise au service concerné qui l'évaluera dans les meilleurs délais.";
          break;
        case 8:
          response += "\n\nLes informations demandées vous seront communiquées dès que possible par notre équipe.";
          break;
        case 9:
          response += "\n\nVotre demande logicielle a été enregistrée. Notre équipe évaluera la faisabilité et les licences disponibles avant de procéder à l'installation.";
          break;
        case 10:
          response += "\n\nVotre demande de matériel a été enregistrée et sera soumise à validation selon notre procédure d'approvisionnement.";
          break;
        default:
          response += "\n\nVotre demande a été transmise à l'équipe concernée.";
          break;
      }
    }
    
    // 5. Informations de suivi
    response += "\n\nVous recevrez une notification à chaque mise à jour de votre ticket. ";
    
    // 6. Sécurité
    if (contextAnalysis.security.hasConcern) {
      response += "Étant donné que votre demande concerne la sécurité, nous vous recommandons de ne pas partager d'informations sensibles et de suivre nos protocoles de sécurité. ";
    }
    
    if (contextAnalysis.businessImpact === 'high') {
      response += "Nous comprenons l'impact important de ce problème sur votre activité et mettons tout en œuvre pour le résoudre rapidement. ";
    }
    
    // 7. Conclusion
    response += "\n\nN'hésitez pas à nous fournir toute information supplémentaire qui pourrait nous aider à traiter votre demande plus efficacement. ";
    response += "Votre numéro de référence sera communiqué dans le mail de confirmation.\n\nCordialement,\nVotre équipe de support informatique";
    
    return response;
  }
};

module.exports = localAiService;
