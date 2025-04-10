/**
 * Service d'IA local avancé pour l'analyse, la classification et la génération de réponses
 * sur des tickets d'assistance, sans dépendre d'une API externe.
 * 
 * Ce service utilise une combinaison de techniques avancées :
 * 1. Réseaux de neurones TensorFlow.js pour la classification
 * 2. Traitement du langage naturel (NLP) avec natural.js
 * 3. Analyse contextuelle et sémantique
 * 4. Génération de réponses basée sur des templates dynamiques
 * 5. Analyse de sentiment et d'intention
 * 6. Extraction d'entités et de relations
 * 7. Système de mémoire pour l'apprentissage continu
 * 
 * Auteur : Anisse Fouka
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { WordTokenizer, PorterStemmerFr, SentimentAnalyzer, LanguageProcessor } = natural;
const tokenizer = new WordTokenizer();
const fs = require('fs');
const path = require('path');
const enhancedTensorflowService = require('./enhancedTensorflowService');

// Importer les vocabulaires étendus
const baseVocab = require('../data/vocabularyBase');
const domainVocab = require('../data/vocabularyDomain');
const technicalVocab = require('../data/vocabularyTechnical');

// Initialiser le stemmer français
const stemmer = PorterStemmerFr;

/**************************************************
 *           Structures de données                *
 **************************************************/

// Mots-clés pour la classification des types de tickets
const INCIDENT_KEYWORDS = [
  'panne', 'problème', 'pb', 'pn', 'bug', 'erreur', 'ne fonctionne pas', 'ne marche pas', 'cassé', 'bloqué',
  'planté', 'crash', 'écran bleu', 'virus', 'malware', 'lent', 'ralenti',
  'corruption', 'endommagé', 'perdu', 'supprimé', 'disparu', 'incompatible',
  'imprimante', 'impression', 'papier', 'encre', 'toner', 'cartouche', 'scanner', 'fax'
];

const REQUEST_KEYWORDS = [
  'demande', 'besoin', 'nouveau', 'installation', 'mise à jour', 'configurer',
  'paramétrer', 'créer', 'ajouter', 'modifier', 'changer', 'remplacer', 'mettre à jour',
  'accès', 'autorisation', 'permission', 'droit', 'compte', 'identifiant', 'mot de passe',
  'formation', 'aide', 'assistance', 'information', 'renseignement', 'conseil',
  'pourriez-vous', 'serait-il possible', 'j\'aimerais', 'je souhaite', 'je voudrais'
];

// Mots-clés pour la classification des catégories (étendu)
const CATEGORY_KEYWORDS = {
  // Incidents
  'incident_autre': ['autre', 'divers', 'inconnu', 'indéterminé', 'général'],
  'incident_logiciel': [
    'logiciel', 'application', 'programme', 'software', 'windows', 'office', 'excel', 
    'word', 'outlook', 'email', 'mail', 'navigateur', 'browser', 'chrome', 'firefox', 
    'edge', 'internet', 'système d\'exploitation', 'os', 'mise à jour', 'update',
    'erreur', 'bug', 'plantage', 'freeze', 'blocage', 'lenteur', 'performance',
    'antivirus', 'sauvegarde', 'backup', 'restauration', 'installation', 'désinstallation'
  ],
  'incident_materiel': [
    'matériel', 'hardware', 'ordinateur', 'pc', 'laptop', 'écran', 'clavier', 'souris', 
    'imprimante', 'scanner', 'téléphone', 'batterie', 'chargeur', 'alimentation', 
    'disque dur', 'mémoire', 'ram', 'processeur', 'cpu', 'carte graphique', 'gpu',
    'ventilateur', 'surchauffe', 'bruit', 'ne s\'allume pas', 'ne démarre pas',
    'périphérique', 'port usb', 'hdmi', 'câble', 'connecteur', 'dock', 'station d\'accueil'
  ],
  'incident_reseau': [
    'réseau', 'network', 'internet', 'wifi', 'connexion', 'déconnexion', 'lent', 
    'intranet', 'serveur', 'vpn', 'proxy', 'dns', 'ip', 'ethernet', 'routeur', 
    'switch', 'firewall', 'pare-feu', 'modem', 'fibre', 'adsl', 'bande passante',
    'latence', 'ping', 'packet loss', 'perte de paquets', 'timeout', 'délai d\'attente',
    'sans fil', 'wireless', 'bluetooth', 'synchronisation', 'sync'
  ],
  'incident_securite': [
    'sécurité', 'virus', 'malware', 'ransomware', 'phishing', 'hameçonnage', 'spam', 
    'piratage', 'hack', 'compromis', 'suspect', 'accès non autorisé', 'mot de passe', 
    'authentification', 'vol', 'fuite de données', 'confidentialité', 'chiffrement',
    'encryption', 'certificat', 'ssl', 'vpn', 'firewall', 'antivirus', 'protection',
    'vulnérabilité', 'exploit', 'attaque', 'menace', 'alerte'
  ],
  
  // Demandes
  'demande_acces': [
    'accès', 'autorisation', 'permission', 'droit', 'compte', 'identifiant', 'login', 
    'mot de passe', 'réinitialisation', 'débloquer', 'verrouillé', 'authentification',
    'connexion', 'session', 'profil', 'utilisateur', 'groupe', 'rôle', 'privilège',
    'admin', 'administrateur', 'super-utilisateur', 'root', 'sudo'
  ],
  'demande_autre': [
    'autre', 'divers', 'spécifique', 'particulier', 'exceptionnel', 'ponctuel',
    'unique', 'inhabituel', 'non standard', 'personnalisé', 'sur mesure'
  ],
  'demande_information': [
    'information', 'renseignement', 'question', 'comment', 'procédure', 'documentation', 
    'guide', 'manuel', 'formation', 'aide', 'assistance', 'conseil', 'tutoriel',
    'explication', 'clarification', 'précision', 'détail', 'instruction',
    'mode d\'emploi', 'faq', 'questions fréquentes'
  ],
  'demande_logiciel': [
    'logiciel', 'application', 'programme', 'software', 'installation', 'mise à jour', 
    'update', 'version', 'licence', 'license', 'abonnement', 'office', 'windows',
    'déploiement', 'package', 'extension', 'plugin', 'add-on', 'module',
    'fonctionnalité', 'feature', 'outil', 'utilitaire'
  ],
  'demande_materiel': [
    'matériel', 'hardware', 'équipement', 'ordinateur', 'pc', 'laptop', 'écran', 
    'clavier', 'souris', 'imprimante', 'scanner', 'téléphone', 'mobile', 'smartphone', 
    'tablette', 'casque', 'accessoire', 'périphérique', 'disque dur', 'ssd',
    'mémoire', 'ram', 'processeur', 'batterie', 'chargeur', 'dock', 'adaptateur',
    'câble', 'connecteur', 'webcam', 'microphone', 'haut-parleur', 'enceinte'
  ]
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

// Mots-clés pour l'urgence (étendu)
const URGENCY_KEYWORDS = {
  1: [ // Très haute
    'urgent', 'critique', 'immédiatement', 'grave', 'bloquant', 'impossible de travailler',
    'production arrêtée', 'sécurité compromise', 'très urgent', 'immédiat', 'priorité absolue',
    'extrêmement urgent', 'catastrophique', 'majeur', 'crucial', 'vital', 'perte financière',
    'perte de données', 'impact majeur', 'tous les utilisateurs', 'entreprise entière',
    'système entièrement inaccessible', 'urgence maximale', 'sans délai', 'maintenant'
  ],
  2: [ // Haute
    'important', 'prioritaire', 'rapidement', 'dès que possible', 'impact significatif',
    'plusieurs utilisateurs', 'service dégradé', 'haute priorité', 'urgent mais pas critique',
    'perturbation importante', 'affecte un département', 'productivité réduite',
    'fonctionnalité principale', 'alternative limitée', 'contournement difficile',
    'impact sur les clients', 'délai court', 'aujourd\'hui', 'dans la journée'
  ],
  3: [ // Moyenne
    'normal', 'standard', 'régulier', 'dès que possible', 'gênant', 'un utilisateur',
    'priorité normale', 'impact modéré', 'fonctionnalité secondaire', 'alternative disponible',
    'contournement possible', 'perturbation mineure', 'quelques utilisateurs',
    'productivité affectée', 'cette semaine', 'dans les jours qui viennent'
  ],
  4: [ // Basse
    'basse', 'faible', 'quand vous aurez le temps', 'non urgent', 'peu important',
    'amélioration', 'faible priorité', 'impact mineur', 'fonctionnalité rarement utilisée',
    'contournement simple', 'perturbation minime', 'un seul utilisateur',
    'productivité peu affectée', 'ce mois-ci', 'dans les semaines à venir'
  ],
  5: [ // Très basse
    'très faible', 'minimal', 'cosmétique', 'amélioration', 'suggestion', 'éventuel',
    'plus tard', 'priorité minimale', 'aucun impact', 'fonctionnalité optionnelle',
    'esthétique', 'ergonomie', 'confort', 'préférence', 'quand vous aurez le temps',
    'sans échéance', 'à considérer', 'à étudier', 'à planifier', 'prochainement'
  ]
};

// Expressions pour la détection d'intentions
const INTENT_EXPRESSIONS = {
  greeting: [
    'bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou', 'bjr',
    'bon matin', 'bonne journée', 'bien le bonjour', 'cc'
  ],
  thanks: [
    'merci', 'remercie', 'remerciement', 'gratitude', 'reconnaissance',
    'je vous remercie', 'merci beaucoup', 'merci d\'avance', 'thanks'
  ],
  urgency: [
    'urgent', 'rapidement', 'vite', 'immédiatement', 'dès que possible',
    'au plus vite', 'sans délai', 'pressé', 'pressant', 'critique'
  ],
  frustration: [
    'frustré', 'énervé', 'agacé', 'irrité', 'en colère', 'mécontent',
    'insatisfait', 'déçu', 'ras-le-bol', 'ça suffit', 'inadmissible',
    'inacceptable', 'ridicule', 'absurde', 'n\'importe quoi'
  ],
  confusion: [
    'confus', 'perdu', 'ne comprends pas', 'pas clair', 'ambigu',
    'compliqué', 'difficile à comprendre', 'complexe', 'embrouillé',
    'je ne sais pas', 'comment faire', 'que faire'
  ],
  positive: [
    'bien', 'super', 'génial', 'excellent', 'parfait', 'formidable',
    'fantastique', 'impeccable', 'top', 'bravo', 'félicitations'
  ],
  negative: [
    'mauvais', 'horrible', 'terrible', 'affreux', 'nul', 'médiocre',
    'catastrophique', 'désastreux', 'pénible', 'insupportable'
  ],
  question: [
    'comment', 'pourquoi', 'quand', 'où', 'qui', 'quel', 'quelle',
    'quels', 'quelles', 'est-ce que', 'est-ce qu\'', 'pouvez-vous',
    'pourriez-vous', 'serait-il possible'
  ],
  request: [
    'pouvez-vous', 'pourriez-vous', 'j\'aimerais', 'je souhaite',
    'je voudrais', 'je désire', 'je demande', 'merci de', 'svp',
    's\'il vous plaît', 'veuillez'
  ],
  followUp: [
    'suivi', 'suite', 'mise à jour', 'update', 'avancement', 'progression',
    'statut', 'état', 'ticket', 'numéro', 'référence', 'précédent',
    'déjà signalé', 'toujours pas résolu', 'encore'
  ]
};

/**************************************************
 *           Fonctions utilitaires                *
 **************************************************/

/**
 * Prétraite le texte pour l'analyse (normalisation, tokenization, stemming)
 * @param {string} text - Texte à prétraiter
 * @returns {Object} - Texte prétraité, tokens et stems
 */
function preprocessText(text) {
  // Normalisation
  const normalized = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Tokenization
  const tokens = tokenizer.tokenize(normalized);
  
  // Stemming
  const stems = tokens.map(token => stemmer.stem(token));
  
  return {
    normalized,
    tokens,
    stems,
    originalText: text
  };
}

/**
 * Compte le nombre d'occurrences d'un ensemble de mots-clés dans un texte.
 * @param {string} text - Le texte à analyser.
 * @param {string[]} keywords - Liste de mots-clés à rechercher.
 * @returns {Object} - Nombre d'occurrences et mots trouvés.
 */
function countKeywords(text, keywords) {
  const normalizedText = text.toLowerCase();
  let count = 0;
  const foundKeywords = new Set();
  
  keywords.forEach(keyword => {
    // Expression régulière pour trouver toutes les occurrences
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b|${keyword.toLowerCase()}`, 'g');
    const matches = normalizedText.match(regex);
    if (matches) {
      count += matches.length;
      foundKeywords.add(keyword);
    }
  });
  
  return {
    count,
    foundKeywords: Array.from(foundKeywords)
  };
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

/**
 * Convertit un texte en vecteur de caractéristiques pour les modèles TensorFlow
 * @param {string} text - Texte à convertir
 * @param {Set} vocabulary - Vocabulaire à utiliser
 * @returns {number[]} - Vecteur de caractéristiques
 */
function textToFeatures(text, vocabulary) {
  const { stems } = preprocessText(text);
  const vocabArray = Array.from(vocabulary);
  
  // Initialiser le vecteur avec des zéros
  const features = new Array(vocabArray.length).fill(0);
  
  // Compter les occurrences de chaque mot du vocabulaire
  stems.forEach(stem => {
    const index = vocabArray.indexOf(stem);
    if (index !== -1) {
      features[index]++;
    }
  });
  
  return features;
}

/**************************************************
 *        Fonctions principales du service        *
 **************************************************/

const advancedLocalAiService = {
  /**
   * Initialise le service d'IA avancé
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log("Initialisation du service d'IA avancé...");
      
      // Initialiser le service TensorFlow amélioré
      await enhancedTensorflowService.initialize();
      
      console.log("Service d'IA avancé initialisé avec succès!");
      return true;
    } catch (error) {
      console.error("Erreur lors de l'initialisation du service d'IA avancé:", error);
      return false;
    }
  },

  /**
   * Détermine le type de ticket (incident ou demande)
   * @param {string} text - Texte à analyser
   * @returns {Object} - Type de ticket et score de confiance
   */
  async determineTicketType(text) {
    console.log(`[determineTicketType] Début de la détermination du type pour: "${text.substring(0, 50)}..."`);
    
    // Vérifier d'abord les indications explicites
    const incidentKeywords = ['incident', 'problème', 'bug', 'erreur', 'panne', 'dysfonctionnement'];
    const requestKeywords = ['demande', 'besoin', 'requête', 'souhait', 'voudrais', 'pouvez-vous'];
    
    // Compter les occurrences des mots-clés
    const incidentCount = this.countKeywords(text, incidentKeywords);
    const requestCount = this.countKeywords(text, requestKeywords);
    
    console.log(`[determineTicketType] Mots-clés incidents trouvés: ${incidentCount.count}, mots-clés demandes trouvés: ${requestCount.count}`);
    
    // Si l'un des compteurs est clairement supérieur à l'autre
    if (incidentCount.count > 0 && incidentCount.count > requestCount.count * 2) {
      console.log(`[determineTicketType] Indication explicite détectée: Incident`);
      return { type: 'incident', typeId: 1, confidence: 0.99, analysis: { incidentKeywords: incidentCount, requestKeywords: requestCount } };
    } else if (requestCount.count > 0 && requestCount.count > incidentCount.count * 2) {
      console.log(`[determineTicketType] Indication explicite détectée: Demande`);
      return { type: 'demande', typeId: 2, confidence: 0.99, analysis: { incidentKeywords: incidentCount, requestKeywords: requestCount } };
    }
    
    console.log(`[determineTicketType] Pas d'indication explicite, utilisation de la classification standard`);
    
    // Sinon, utiliser la classification standard
    return this.classifyTicketType(text);
  },

  /**
   * Classifie un ticket comme incident ou demande en utilisant TensorFlow et l'analyse de mots-clés
   * @param {string} text - Le texte à analyser.
   * @returns {Promise<{ type: string, typeId: number, confidence: number, analysis: Object }>}
   */
  async classifyTicketType(text) {
    try {
      // Utiliser le modèle TensorFlow amélioré pour la prédiction
      const tfResult = await enhancedTensorflowService.predictTicketType(text);
      
      // Approche basée sur les règles comme complément
      const lowerText = text.toLowerCase();
      
      // Analyser les mots-clés d'incident
      const incidentResult = this.countKeywords(lowerText, INCIDENT_KEYWORDS);
      const incidentScore = incidentResult.count;
      
      // Analyser les mots-clés de demande
      const requestResult = this.countKeywords(lowerText, REQUEST_KEYWORDS);
      const requestScore = requestResult.count;
      
      // Combiner les deux approches
      let finalType, finalTypeId, finalConfidence;
      
      // Si la confiance du modèle TensorFlow est élevée, l'utiliser
      if (tfResult.confidence > 0.75) {
        finalType = tfResult.type;
        finalTypeId = tfResult.typeId;
        finalConfidence = tfResult.confidence;
      } 
      // Sinon, utiliser l'approche basée sur les règles si elle est confiante
      else if (incidentScore > 0 || requestScore > 0) {
        const totalScore = incidentScore + requestScore;
        if (incidentScore > requestScore) {
          finalType = 'incident';
          finalTypeId = 1;
          finalConfidence = incidentScore / totalScore;
        } else {
          finalType = 'demande';
          finalTypeId = 2;
          finalConfidence = requestScore / totalScore;
        }
      } 
      // Si les deux approches ne sont pas confiantes, utiliser celle avec la plus haute confiance
      else {
        if (tfResult.confidence >= 0.5) {
          finalType = tfResult.type;
          finalTypeId = tfResult.typeId;
          finalConfidence = tfResult.confidence;
        } else {
          finalType = 'incident';
          finalTypeId = 1;
          finalConfidence = 0.5;
        }
      }
      
      return {
        type: finalType,
        typeId: finalTypeId,
        confidence: finalConfidence,
        analysis: {
          tensorflowResult: tfResult,
          keywordAnalysis: {
            incident: {
              score: incidentScore,
              keywords: incidentResult.foundKeywords
            },
            request: {
              score: requestScore,
              keywords: requestResult.foundKeywords
            }
          }
        }
      };
    } catch (error) {
      console.error("Erreur lors de la classification du type de ticket:", error);
      // Fallback en cas d'erreur
      return { 
        type: 'incident', 
        typeId: 1, 
        confidence: 0.5,
        analysis: {
          error: error.message,
          fallback: true
        }
      };
    }
  },
  
  /**
   * Classifie la catégorie d'un ticket en utilisant TensorFlow et l'analyse de mots-clés
   * @param {string} text - Le texte à analyser.
   * @param {string} type - 'incident' ou 'demande'.
   * @returns {Promise<{ category: string, categoryId: number, confidence: number, analysis: Object }>}
   */
  async classifyTicketCategory(text, type) {
    try {
      // Utiliser le modèle TensorFlow amélioré pour la prédiction
      const tfResult = await enhancedTensorflowService.predictTicketCategory(text, type);
      
      // Approche basée sur les règles comme complément
      const lowerText = text.toLowerCase();
      const scores = {};
      const keywordAnalysis = {};
      
      // Filtrer les catégories en fonction du type
      const relevantCategories = Object.keys(CATEGORY_KEYWORDS).filter(category => 
        category.startsWith(type === 'incident' ? 'incident_' : 'demande_')
      );
      
      // Calculer les scores pour chaque catégorie
      relevantCategories.forEach(category => {
        const keywords = CATEGORY_KEYWORDS[category];
        const result = this.countKeywords(lowerText, keywords);
        scores[category] = result.count;
        keywordAnalysis[category] = {
          score: result.count,
          keywords: result.foundKeywords
        };
      });
      
      // Trouver la catégorie avec le score le plus élevé
      let maxScore = 0;
      let bestCategory = null;
      
      Object.keys(scores).forEach(category => {
        if (scores[category] > maxScore) {
          maxScore = scores[category];
          bestCategory = category;
        }
      });
      
      // Calculer la confiance
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
      const ruleBasedConfidence = totalScore > 0 ? maxScore / totalScore : 0;
      
      // Combiner les deux approches
      let finalCategory, finalCategoryId, finalConfidence;
      
      // Si la confiance du modèle TensorFlow est élevée, l'utiliser
      if (tfResult.confidence > 0.7) {
        finalCategory = tfResult.category;
        finalCategoryId = tfResult.categoryId;
        finalConfidence = tfResult.confidence;
      } 
      // Sinon, utiliser l'approche basée sur les règles si elle est confiante
      else if (ruleBasedConfidence > 0.6 && bestCategory) {
        finalCategory = bestCategory;
        finalCategoryId = CATEGORY_MAP[bestCategory];
        finalConfidence = ruleBasedConfidence;
      } 
      // Si les deux approches ne sont pas confiantes, utiliser celle avec la plus haute confiance
      else {
        if (tfResult.confidence >= ruleBasedConfidence) {
          finalCategory = tfResult.category;
          finalCategoryId = tfResult.categoryId;
          finalConfidence = tfResult.confidence;
        } else {
          finalCategory = bestCategory || `${type}_autre`;
          finalCategoryId = CATEGORY_MAP[finalCategory] || (type === 'incident' ? 10 : 5); // ID pour "autre"
          finalConfidence = ruleBasedConfidence;
        }
      }
      
      return {
        category: finalCategory,
        categoryId: finalCategoryId,
        confidence: finalConfidence,
        analysis: {
          tensorflowResult: tfResult,
          keywordAnalysis: keywordAnalysis
        }
      };
    } catch (error) {
      console.error("Erreur lors de la classification de la catégorie de ticket:", error);
      // Fallback en cas d'erreur - catégorie "autre" selon le type
      const fallbackCategory = type === 'incident' ? 'incident_autre' : 'demande_autre';
      const fallbackCategoryId = type === 'incident' ? 10 : 5;
      
      return { 
        category: fallbackCategory, 
        categoryId: fallbackCategoryId, 
        confidence: 0.5,
        analysis: {
          error: error.message,
          fallback: true
        }
      };
    }
  },

  /**
   * Évalue le niveau d'urgence d'un ticket en utilisant TensorFlow et l'analyse de mots-clés
   * @param {string} text - Le texte à analyser.
   * @returns {Promise<{ urgency: number, confidence: number, analysis: Object }>}
   */
  async assessUrgency(text) {
    try {
      // Utiliser le modèle TensorFlow amélioré pour la prédiction
      const tfResult = await enhancedTensorflowService.predictUrgency(text);
      
      // Approche basée sur les règles comme complément
      const lowerText = text.toLowerCase();
      const scores = {};
      const keywordAnalysis = {};
      
      // Calculer les scores pour chaque niveau d'urgence
      Object.keys(URGENCY_KEYWORDS).forEach(level => {
        const keywords = URGENCY_KEYWORDS[level];
        const result = this.countKeywords(lowerText, keywords);
        scores[level] = result.count;
        keywordAnalysis[level] = {
          score: result.count,
          keywords: result.foundKeywords
        };
      });
      
      // Trouver le niveau d'urgence avec le score le plus élevé
      let maxScore = 0;
      let bestLevel = null;
      
      Object.keys(scores).forEach(level => {
        if (scores[level] > maxScore) {
          maxScore = scores[level];
          bestLevel = parseInt(level);
        }
      });
      
      // Calculer la confiance
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
      const ruleBasedConfidence = totalScore > 0 ? maxScore / totalScore : 0;
      
      // Combiner les deux approches
      let finalUrgency, finalConfidence;
      
      // Si la confiance du modèle TensorFlow est élevée, l'utiliser
      if (tfResult.confidence > 0.7) {
        finalUrgency = tfResult.urgency;
        finalConfidence = tfResult.confidence;
      } 
      // Sinon, utiliser l'approche basée sur les règles si elle est confiante
      else if (ruleBasedConfidence > 0.6 && bestLevel) {
        finalUrgency = bestLevel;
        finalConfidence = ruleBasedConfidence;
      } 
      // Si les deux approches ne sont pas confiantes, utiliser celle avec la plus haute confiance
      else {
        if (tfResult.confidence >= ruleBasedConfidence) {
          finalUrgency = tfResult.urgency;
          finalConfidence = tfResult.confidence;
        } else {
          finalUrgency = bestLevel || 3; // Niveau moyen par défaut
          finalConfidence = ruleBasedConfidence;
        }
      }
      
      // Facteurs contextuels qui peuvent influencer l'urgence
      const contextFactors = {
        length: text.length > 300 ? 'long' : 'court', // Un texte long peut indiquer un problème complexe
        exclamationMarks: (text.match(/!/g) || []).length, // Beaucoup de points d'exclamation peuvent indiquer l'urgence
        questionMarks: (text.match(/\?/g) || []).length, // Beaucoup de points d'interrogation peuvent indiquer la confusion
        capsLockWords: (text.match(/\b[A-Z]{2,}\b/g) || []).length // Mots en majuscules peuvent indiquer l'urgence
      };
      
      // Ajuster l'urgence en fonction des facteurs contextuels
      if (contextFactors.exclamationMarks > 2 || contextFactors.capsLockWords > 2) {
        // Augmenter l'urgence si beaucoup de points d'exclamation ou de mots en majuscules
        finalUrgency = Math.max(1, finalUrgency - 1); // Augmenter l'urgence (1 est plus urgent que 5)
      }
      
      return {
        urgency: finalUrgency,
        confidence: finalConfidence,
        analysis: {
          tensorflowResult: tfResult,
          keywordAnalysis: keywordAnalysis,
          contextFactors: contextFactors
        }
      };
    } catch (error) {
      console.error("Erreur lors de l'évaluation de l'urgence du ticket:", error);
      // Fallback en cas d'erreur - urgence moyenne
      return { 
        urgency: 3, 
        confidence: 0.5,
        analysis: {
          error: error.message,
          fallback: true
        }
      };
    }
  },
  
  /**
   * Extrait les entités nommées du texte (personnes, lieux, dates, etc.)
   * @param {string} text - Le texte à analyser.
   * @returns {{ dates: string[], locations: string[], people: string[], organizations: string[] }}
   */
  extractEntities(text) {
    try {
      // Expressions régulières simples pour l'extraction d'entités
      const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{2,4}|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi;
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
      const phoneRegex = /\b(\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}\b/g;
      const urlRegex = /\bhttps?:\/\/[^\s]+\b/g;
      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      
      // Extraire les entités
      const dates = (text.match(dateRegex) || []).map(date => date.trim());
      const emails = (text.match(emailRegex) || []).map(email => email.trim());
      const phones = (text.match(phoneRegex) || []).map(phone => phone.trim());
      const urls = (text.match(urlRegex) || []).map(url => url.trim());
      const ips = (text.match(ipRegex) || []).map(ip => ip.trim());
      
      // Extraction de personnes et organisations (simplifiée)
      const words = text.split(/\s+/);
      const people = [];
      const organizations = [];
      const locations = [];
      
      // Mots qui peuvent indiquer une personne
      const personIndicators = ['monsieur', 'madame', 'mme', 'm.', 'dr', 'docteur', 'prof', 'professeur'];
      
      // Mots qui peuvent indiquer une organisation
      const orgIndicators = ['société', 'entreprise', 'groupe', 'compagnie', 'association', 'département', 'service', 'équipe'];
      
      // Mots qui peuvent indiquer un lieu
      const locIndicators = ['bureau', 'salle', 'étage', 'bâtiment', 'site', 'agence', 'filiale', 'succursale'];
      
      // Recherche de patterns pour les personnes, organisations et lieux
      for (let i = 0; i < words.length - 1; i++) {
        const word = words[i].toLowerCase();
        const nextWord = words[i + 1];
        
        // Vérifier si le mot actuel est un indicateur de personne
        if (personIndicators.includes(word) && nextWord.match(/^[A-Z]/)) {
          people.push(`${word} ${nextWord}`);
        }
        
        // Vérifier si le mot actuel est un indicateur d'organisation
        if (orgIndicators.includes(word) && nextWord.match(/^[A-Z]/)) {
          organizations.push(`${word} ${nextWord}`);
        }
        
        // Vérifier si le mot actuel est un indicateur de lieu
        if (locIndicators.includes(word)) {
          locations.push(`${word} ${nextWord}`);
        }
      }
      
      return {
        dates,
        emails,
        phones,
        urls,
        ips,
        people,
        organizations,
        locations
      };
    } catch (error) {
      console.error("Erreur lors de l'extraction des entités:", error);
      return {
        dates: [],
        emails: [],
        phones: [],
        urls: [],
        ips: [],
        people: [],
        organizations: [],
        locations: []
      };
    }
  },
  
  /**
   * Améliore (corrige) le texte en remplaçant certaines fautes ou abréviations courantes.
   * @param {string} text - Le texte à corriger.
   * @returns {string} - Texte corrigé.
   */
  improveText(text) {
    // Corrections courantes
    const corrections = [
      { pattern: /\bpb\b/gi, replacement: 'problème' },
      { pattern: /\bpn\b/gi, replacement: 'problème' },
      { pattern: /\bslm\b/gi, replacement: 'salut' },
      { pattern: /\bslt\b/gi, replacement: 'salut' },
      { pattern: /\bjr\b/gi, replacement: 'bonjour' },
      { pattern: /\bcc\b/gi, replacement: 'coucou' },
      { pattern: /\bfrerot\b/gi, replacement: 'collègue' },
      { pattern: /\bordi\b/gi, replacement: 'ordinateur' },
      { pattern: /\bappli\b/gi, replacement: 'application' },
      { pattern: /\bapplis\b/gi, replacement: 'applications' },
      { pattern: /\bmsg\b/gi, replacement: 'message' },
      { pattern: /\btel\b/gi, replacement: 'téléphone' },
      { pattern: /\btel\.\b/gi, replacement: 'téléphone' },
      { pattern: /\brdv\b/gi, replacement: 'rendez-vous' },
      { pattern: /\brdv\.\b/gi, replacement: 'rendez-vous' },
      { pattern: /\bsvp\b/gi, replacement: 's\'il vous plaît' },
      { pattern: /\bstp\b/gi, replacement: 's\'il te plaît' },
      { pattern: /\basap\b/gi, replacement: 'dès que possible' },
      { pattern: /\bpc\b/gi, replacement: 'ordinateur' },
      { pattern: /\bpc\.\b/gi, replacement: 'ordinateur' },
      { pattern: /\bwifi\b/gi, replacement: 'Wi-Fi' },
      { pattern: /\bmail\b/gi, replacement: 'e-mail' },
      { pattern: /\bmail\.\b/gi, replacement: 'e-mail' },
      { pattern: /\bpw\b/gi, replacement: 'mot de passe' },
      { pattern: /\bpw\.\b/gi, replacement: 'mot de passe' },
      { pattern: /\bid\b/gi, replacement: 'identifiant' },
      { pattern: /\bid\.\b/gi, replacement: 'identifiant' },
      { pattern: /\blog\b/gi, replacement: 'connexion' },
      { pattern: /\blog\.\b/gi, replacement: 'connexion' },
      { pattern: /\bconfig\b/gi, replacement: 'configuration' },
      { pattern: /\badmin\b/gi, replacement: 'administrateur' },
      { pattern: /\bdev\b/gi, replacement: 'développeur' },
      { pattern: /\bdoc\b/gi, replacement: 'documentation' },
      { pattern: /\binfo\b/gi, replacement: 'information' },
      { pattern: /\binfos\b/gi, replacement: 'informations' },
      { pattern: /\bdispo\b/gi, replacement: 'disponible' },
      { pattern: /\bindispo\b/gi, replacement: 'indisponible' },
      { pattern: /\bvpn\b/gi, replacement: 'réseau privé virtuel' }
    ];
    
    // Appliquer les corrections
    let improvedText = text;
    corrections.forEach(({ pattern, replacement }) => {
      improvedText = improvedText.replace(pattern, replacement);
    });
    
    return improvedText;
  },
  
  /**
   * Détecte les intentions présentes dans le texte (salutation, remerciement, urgence, frustration, confusion...).
   * @param {string} text - Le texte à analyser.
   * @returns {{ intents: Object, sentiment: number, sentimentLabel: string }}
   */
  detectIntents(text) {
    const lowerText = text.toLowerCase();
    const intents = {};
    
    // Détecter les intentions en fonction des expressions
    Object.keys(INTENT_EXPRESSIONS).forEach(intent => {
      const keywords = INTENT_EXPRESSIONS[intent];
      const result = this.countKeywords(lowerText, keywords);
      intents[intent] = {
        detected: result.count > 0,
        score: result.count,
        keywords: result.foundKeywords
      };
    });
    
    // Calculer le sentiment global
    let sentimentScore = 0;
    
    // Les intentions positives augmentent le score
    if (intents.greeting.detected) sentimentScore += 0.2;
    if (intents.thanks.detected) sentimentScore += 0.3;
    if (intents.positive.detected) sentimentScore += 0.5;
    
    // Les intentions négatives diminuent le score
    if (intents.frustration.detected) sentimentScore -= 0.4;
    if (intents.negative.detected) sentimentScore -= 0.5;
    if (intents.urgency.detected) sentimentScore -= 0.2;
    if (intents.confusion.detected) sentimentScore -= 0.1;
    
    // Limiter le score entre -1 et 1
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
    
    // Déterminer le label du sentiment
    let sentimentLabel;
    if (sentimentScore >= 0.5) sentimentLabel = 'très positif';
    else if (sentimentScore >= 0.1) sentimentLabel = 'positif';
    else if (sentimentScore > -0.1) sentimentLabel = 'neutre';
    else if (sentimentScore > -0.5) sentimentLabel = 'négatif';
    else sentimentLabel = 'très négatif';
    
    return {
      intents,
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
    console.log(`[detectTicketFollowUp] Vérification de suivi pour: "${text.substring(0, 50)}..."`);
    
    // Expressions régulières pour détecter les références à des tickets existants
    const ticketRegex = /(ticket|demande|incident|requête)\s+(?:n[°o]?\s*)?(?:#|n[°o])?(\d+)/i;
    
    // Mots-clés qui indiquent un suivi
    const followUpKeywords = [
      'suivi', 'suite', 'mise à jour', 'update', 'avancement', 'progression',
      'statut', 'état', 'ticket', 'numéro', 'référence', 'précédent',
      'déjà signalé', 'toujours pas résolu', 'encore'
    ];
    
    // Vérifier si le texte contient des mots-clés de suivi
    const keywordResults = this.countKeywords(text, followUpKeywords);
    const hasFollowUpKeywords = keywordResults.count > 0;
    
    console.log(`[detectTicketFollowUp] Mots-clés de suivi trouvés: ${keywordResults.count}`);
    
    // Chercher un numéro de ticket
    const ticketNumberMatch = text.match(ticketRegex);
    const ticketNumber = ticketNumberMatch ? ticketNumberMatch[2] : null;
    
    console.log(`[detectTicketFollowUp] Numéro de ticket trouvé: ${ticketNumber || 'aucun'}`);
    
    // C'est un suivi si on a un numéro de ticket ou des mots-clés de suivi
    const isFollowUp = ticketNumber !== null || hasFollowUpKeywords;
    
    console.log(`[detectTicketFollowUp] Résultat: isFollowUp=${isFollowUp}, ticketNumber=${ticketNumber}, keywords=${keywordResults.count}`);
    
    return {
      isFollowUp: isFollowUp,
      ticketNumber: ticketNumber,
      keywords: keywordResults.found
    };
  },
  
  /**
   * Évalue la complexité d'un problème en se basant sur certains facteurs.
   * @param {string} text - Le texte à analyser.
   * @returns {{ level: string, score: number, factors: Object }}
   */
  assessComplexity(text) {
    console.log(`[assessComplexity] Évaluation de la complexité pour: "${text.substring(0, 50)}..."`);
    
    // Facteurs de complexité
    const factors = {
      textLength: text.length,
      sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
      technicalTerms: 0,
      systemsCount: 0,
      complexityIndicators: 0
    };
    
    // Liste de termes techniques qui indiquent un problème complexe
    const technicalTerms = [
      'serveur', 'réseau', 'base de données', 'sql', 'api', 'vpn', 'active directory',
      'ldap', 'authentification', 'autorisation', 'sécurité', 'cryptage', 'certificat',
      'ssl', 'tls', 'firewall', 'proxy', 'dns', 'ip', 'ethernet', 'routeur', 
      'switch', 'firewall', 'pare-feu', 'modem', 'fibre', 'adsl', 'bande passante',
      'latence', 'ping', 'packet loss', 'perte de paquets', 'timeout', 'délai d\'attente',
      'sans fil', 'wireless', 'bluetooth', 'synchronisation', 'sync'
    ];
    
    // Compter les termes techniques
    const techTermsResult = this.countKeywords(text, technicalTerms);
    factors.technicalTerms = techTermsResult.count;
    
    // Liste de systèmes et applications
    const systems = [
      'windows', 'linux', 'unix', 'macos', 'ios', 'android', 'sap', 'oracle',
      'salesforce', 'dynamics', 'sharepoint', 'exchange', 'office 365', 'azure',
      'aws', 'google cloud', 'jira', 'confluence', 'teams', 'slack', 'zoom',
      'webex', 'skype', 'active directory', 'exchange', 'sql server', 'mysql',
      'postgresql', 'mongodb', 'oracle', 'sap', 'erp', 'crm', 'bi', 'tableau',
      'power bi', 'qlik', 'cognos', 'microstrategy', 'hyperion'
    ];
    
    // Compter les systèmes mentionnés
    const systemsResult = this.countKeywords(text, systems);
    factors.systemsCount = systemsResult.count;
    
    // Indicateurs de complexité dans le langage
    const complexityIndicators = [
      'complexe', 'difficile', 'compliqué', 'technique', 'avancé', 'spécifique',
      'expert', 'spécialiste', 'jamais vu', 'inhabituel', 'rare', 'étrange',
      'bizarre', 'incompréhensible', 'inexplicable', 'multiple', 'plusieurs',
      'interconnecté', 'dépendant', 'interdépendant', 'intégré', 'systémique'
    ];
    
    // Compter les indicateurs de complexité
    const indicatorsResult = this.countKeywords(text, complexityIndicators);
    factors.complexityIndicators = indicatorsResult.count;
    
    console.log(`[assessComplexity] Termes techniques trouvés: ${factors.technicalTerms}, systèmes: ${factors.systemsCount}, indicateurs: ${factors.complexityIndicators}`);
    
    // Calculer un score de complexité (0-10)
    let complexityScore = 0;
    
    // La longueur du texte contribue à la complexité (max 2 points)
    complexityScore += Math.min(text.length / 500, 2);
    
    // Le nombre de phrases contribue à la complexité (max 1 point)
    complexityScore += Math.min(factors.sentenceCount / 5, 1);
    
    // Les termes techniques contribuent fortement (max 3 points)
    complexityScore += Math.min(factors.technicalTerms * 0.5, 3);
    
    // Le nombre de systèmes impliqués contribue (max 2 points)
    complexityScore += Math.min(factors.systemsCount, 2);
    
    // Les indicateurs de complexité dans le langage (max 2 points)
    complexityScore += Math.min(factors.complexityIndicators, 2);
    
    // Déterminer le niveau de complexité
    let complexityLevel;
    if (complexityScore < 2) {
      complexityLevel = 'très faible';
    } else if (complexityScore < 4) {
      complexityLevel = 'faible';
    } else if (complexityScore < 6) {
      complexityLevel = 'moyenne';
    } else if (complexityScore < 8) {
      complexityLevel = 'élevée';
    } else {
      complexityLevel = 'très élevée';
    }
    
    console.log(`[assessComplexity] Score de complexité: ${complexityScore.toFixed(2)}, niveau: ${complexityLevel}`);
    console.log(`[assessComplexity] Facteurs: longueur=${factors.textLength}, phrases=${factors.sentenceCount}, termes techniques=${factors.technicalTerms}, systèmes=${factors.systemsCount}, indicateurs=${factors.complexityIndicators}`);
    
    return {
      level: complexityLevel,
      score: complexityScore,
      factors: factors
    };
  },
  
  /**
   * Suggère les prochaines actions à effectuer en fonction de l'analyse
   * @param {Object} intents - Intents détectés
   * @param {Object} followUp - Résultat de detectTicketFollowUp()
   * @param {Object} complexity - Résultat de assessComplexity()
   * @returns {string[]} - Liste d'actions suggérées
   */
  suggestNextActions(intents, followUp, complexity) {
    console.log(`[suggestNextActions] Début - Paramètres: intents=${!!intents}, followUp=${!!followUp}, complexity=${!!complexity}`);
    const actions = [];
    
    // Si c'est un suivi de ticket
    if (followUp && followUp.isFollowUp) {
      console.log(`[suggestNextActions] Détecté comme suivi de ticket: ${JSON.stringify(followUp)}`);
      if (followUp.ticketNumber) {
        actions.push(`Vérifier le statut du ticket #${followUp.ticketNumber}`);
        actions.push(`Informer l'utilisateur de l'avancement du ticket #${followUp.ticketNumber}`);
      } else {
        actions.push("Demander plus d'informations sur le ticket précédent");
      }
    }
    
    // Si l'utilisateur est frustré ou négatif
    if (intents && (intents.frustration?.detected || intents.negative?.detected)) {
      console.log(`[suggestNextActions] Détecté frustration ou sentiment négatif`);
      actions.push("Prioriser la résolution de ce ticket");
      actions.push("Faire preuve d'empathie dans la réponse");
      actions.push("Proposer une alternative ou une solution temporaire");
    }
    
    // Si l'utilisateur est confus
    if (intents && intents.confusion?.detected) {
      console.log(`[suggestNextActions] Détecté confusion`);
      actions.push("Fournir des explications claires et détaillées");
      actions.push("Proposer une documentation ou un guide");
    }
    
    // Si c'est une question
    if (intents && intents.question?.detected) {
      console.log(`[suggestNextActions] Détecté question`);
      actions.push("Répondre à la question de manière précise");
      actions.push("Fournir des ressources supplémentaires si nécessaire");
    }
    
    // En fonction de la complexité
    if (complexity && (complexity.level === 'très élevée' || complexity.level === 'élevée')) {
      console.log(`[suggestNextActions] Complexité élevée détectée: ${complexity.level}`);
      actions.push("Escalader vers un technicien de niveau supérieur");
      actions.push("Prévoir plus de temps pour la résolution");
      actions.push("Planifier une intervention à distance ou sur site");
    } else if (complexity && complexity.level === 'moyenne') {
      console.log(`[suggestNextActions] Complexité moyenne détectée`);
      actions.push("Traiter selon la procédure standard");
    } else {
      console.log(`[suggestNextActions] Complexité faible détectée ou non définie`);
      actions.push("Résoudre rapidement avec une solution standard");
    }
    
    console.log(`[suggestNextActions] Fin - Actions suggérées: ${actions.length}`);
    return actions;
  },
  
  /**
   * Analyse complète d'un ticket pour déterminer type, catégorie, urgence et autres attributs
   * @param {string} text - Le texte à analyser
   * @returns {Promise<Object>} - Résultat complet de l'analyse
   */
  async analyzeTicket(text) {
    console.log(`[analyzeTicket] Début de l'analyse pour: "${text.substring(0, 50)}..."`);
    try {
      // Améliorer le texte (corriger les fautes, abréviations, etc.)
      console.log(`[analyzeTicket] Amélioration du texte...`);
      const improvedText = this.improveText(text);
      console.log(`[analyzeTicket] Texte amélioré: "${improvedText.substring(0, 50)}..."`);
      
      // Déterminer le type de ticket (incident ou demande)
      console.log(`[analyzeTicket] Détermination du type de ticket...`);
      const typeResult = await this.determineTicketType(improvedText);
      console.log(`[analyzeTicket] Type détecté: ${typeResult.type} (confiance: ${typeResult.confidence})`);
      
      // Déterminer la catégorie du ticket
      console.log(`[analyzeTicket] Classification de la catégorie...`);
      const categoryResult = await this.classifyTicketCategory(improvedText, typeResult.type);
      console.log(`[analyzeTicket] Catégorie détectée: ${categoryResult.category} (confiance: ${categoryResult.confidence})`);
      
      // Évaluer l'urgence du ticket
      console.log(`[analyzeTicket] Évaluation de l'urgence...`);
      const urgencyResult = await this.assessUrgency(improvedText);
      console.log(`[analyzeTicket] Urgence évaluée: ${urgencyResult.urgency} (confiance: ${urgencyResult.confidence})`);
      
      // Extraire les entités du texte
      console.log(`[analyzeTicket] Extraction des entités...`);
      const entities = this.extractEntities(improvedText);
      console.log(`[analyzeTicket] Entités extraites: ${Object.keys(entities).length} types`);
      
      // Détecter les intentions
      console.log(`[analyzeTicket] Détection des intentions...`);
      const intents = this.detectIntents(improvedText);
      console.log(`[analyzeTicket] Intentions détectées`);
      
      // Vérifier si c'est un suivi de ticket existant
      console.log(`[analyzeTicket] Vérification de suivi de ticket...`);
      const followUp = this.detectTicketFollowUp(improvedText);
      console.log(`[analyzeTicket] Suivi de ticket: ${followUp.isFollowUp ? 'Oui' : 'Non'}`);
      
      // Évaluer la complexité du ticket
      console.log(`[analyzeTicket] Évaluation de la complexité...`);
      const complexityResult = this.assessComplexity(improvedText);
      console.log(`[analyzeTicket] Complexité évaluée: ${complexityResult.level} (score: ${complexityResult.score})`);
      
      // Générer un titre pour le ticket
      console.log(`[analyzeTicket] Génération du titre...`);
      const title = this.generateSummary(improvedText);
      console.log(`[analyzeTicket] Titre généré: "${title}"`);
      
      // Déterminer les prochaines actions recommandées
      console.log(`[analyzeTicket] Suggestion des prochaines actions...`);
      const nextActions = this.suggestNextActions(
        intents,
        followUp,
        complexityResult
      );
      console.log(`[analyzeTicket] Actions suggérées: ${nextActions.length}`);
      
      // Assembler le résultat complet
      console.log(`[analyzeTicket] Assemblage du résultat complet...`);
      const result = {
        originalText: text,
        improvedText: improvedText,
        title: title,
        type: typeResult.type,
        typeId: typeResult.typeId,
        typeConfidence: typeResult.confidence,
        category: categoryResult.category,
        categoryId: categoryResult.categoryId,
        categoryConfidence: categoryResult.confidence,
        urgency: urgencyResult.urgency,
        urgencyConfidence: urgencyResult.confidence,
        complexity: complexityResult,
        entities: entities,
        intentions: intents,
        sentiment: intents.sentiment,
        followUp: followUp,
        nextActions: nextActions
      };
      console.log(`[analyzeTicket] Analyse terminée avec succès`);
      return result;
    } catch (error) {
      console.error(`[analyzeTicket] ERREUR lors de l'analyse du ticket:`, error);
      // Valeurs par défaut en cas d'erreur
      console.log(`[analyzeTicket] Retour des valeurs par défaut suite à l'erreur`);
      return {
        originalText: text,
        improvedText: text,
        title: this.generateSummary(text),
        type: 'incident',
        typeId: 1,
        typeConfidence: 0.5,
        category: 'incident_autre',
        categoryId: 5,
        categoryConfidence: 0.5,
        urgency: 3,
        urgencyConfidence: 0.5,
        complexity: { level: 'moyenne', score: 5, factors: {} },
        entities: { dates: [], emails: [], phones: [], urls: [], ips: [], people: [], organizations: [], locations: [] },
        intentions: { greeting: { detected: false, score: 0, keywords: [] }, thanks: { detected: false, score: 0, keywords: [] } },
        sentiment: { label: 'neutre', score: 0.5 },
        followUp: { isFollowUp: false, ticketNumber: null, keywords: [] },
        nextActions: ["Traiter selon la procédure standard"]
      };
    }
  },
  
  /**
   * Analyse contextuelle avancée du texte (intents, suivi, complexité, etc.)
   * @param {string} text - Le texte à analyser
   * @param {Object[]} [previousMessages=[]] - Historique (facultatif)
   * @returns {Promise<Object>} - Objet contenant l'analyse détaillée
   */
  async analyzeContext(text, previousMessages = []) {
    console.log(`[analyzeContext] Début de l'analyse contextuelle pour: "${text.substring(0, 50)}..."`);
    try {
      // Analyse de base du ticket
      console.log(`[analyzeContext] Lancement de l'analyse de base du ticket...`);
      const ticketAnalysis = await this.analyzeTicket(text);
      console.log(`[analyzeContext] Analyse de base terminée, type: ${ticketAnalysis.type}`);
      
      // Analyse contextuelle supplémentaire
      console.log(`[analyzeContext] Construction de l'analyse contextuelle...`);
      const contextAnalysis = {
        // Historique de conversation
        conversationHistory: {
          messageCount: previousMessages.length,
          hasPreviousContext: previousMessages.length > 0
        },
        
        // Cohérence avec les messages précédents
        coherence: {
          score: 0,
          isCoherent: true
        },
        
        // Progression de la conversation
        progression: {
          stage: 'initial',
          nextStage: 'classification'
        },
        
        // Ajouter les informations de l'analyse du ticket
        entities: ticketAnalysis.entities,
        intents: ticketAnalysis.intentions,
        sentiment: ticketAnalysis.sentiment,
        followUp: ticketAnalysis.followUp
      };
      
      // Si nous avons des messages précédents, analyser la cohérence
      if (previousMessages.length > 0) {
        console.log(`[analyzeContext] Analyse de la cohérence avec ${previousMessages.length} messages précédents`);
        // Calculer la similarité avec le dernier message
        const lastMessage = previousMessages[previousMessages.length - 1];
        const similarityScore = this.calculateSimilarity(text, lastMessage.content);
        console.log(`[analyzeContext] Score de similarité avec le dernier message: ${similarityScore}`);
        
        contextAnalysis.coherence.score = similarityScore;
        contextAnalysis.coherence.isCoherent = similarityScore > 0.2;
        
        // Déterminer l'étape de progression
        if (previousMessages.length === 1) {
          contextAnalysis.progression.stage = 'classification';
          contextAnalysis.progression.nextStage = 'confirmation';
        } else if (previousMessages.length === 2) {
          contextAnalysis.progression.stage = 'confirmation';
          contextAnalysis.progression.nextStage = 'resolution';
        } else {
          contextAnalysis.progression.stage = 'resolution';
          contextAnalysis.progression.nextStage = 'cloture';
        }
        console.log(`[analyzeContext] Étape de progression: ${contextAnalysis.progression.stage} -> ${contextAnalysis.progression.nextStage}`);
      }
      
      console.log(`[analyzeContext] Analyse contextuelle terminée`);
      return contextAnalysis;
    } catch (error) {
      console.error(`[analyzeContext] ERREUR lors de l'analyse contextuelle:`, error);
      // Valeurs par défaut en cas d'erreur
      return {
        entities: { dates: [], emails: [], phones: [], urls: [], ips: [], people: [], organizations: [], locations: [] },
        intents: { greeting: { detected: false, score: 0, keywords: [] }, thanks: { detected: false, score: 0, keywords: [] } },
        sentiment: { label: 'neutre', score: 0.5 },
        followUp: { isFollowUp: false, ticketNumber: null, keywords: [] },
        conversationHistory: { messageCount: 0, hasPreviousContext: false },
        coherence: { score: 0, isCoherent: true },
        progression: { stage: 'initial', nextStage: 'classification' }
      };
    }
  },
  
  /**
   * Génère une réponse automatique basée sur l'analyse du ticket
   * @param {Object} analysis - Résultat de l'analyse
   * @returns {string} - Réponse générée
   */
  generateResponse(analysis) {
    try {
      // Templates de réponses en fonction du type et de la catégorie
      const templates = {
        greeting: [
          "Bonjour,",
          "Bonjour et merci pour votre message,",
          "Bonjour, j'ai bien reçu votre demande,"
        ],
        
        acknowledgment: {
          incident: [
            "J'ai bien pris en compte votre signalement concernant {ISSUE}.",
            "Je comprends que vous rencontrez un problème avec {ISSUE}.",
            "Merci d'avoir signalé ce dysfonctionnement concernant {ISSUE}."
          ],
          demande: [
            "J'ai bien reçu votre demande concernant {ISSUE}.",
            "Je prends note de votre besoin concernant {ISSUE}.",
            "Merci pour votre demande relative à {ISSUE}."
          ]
        },
        
        urgency: {
          1: "Ce problème est traité en priorité absolue.",
          2: "Ce problème est traité en haute priorité.",
          3: "Ce problème est traité avec une priorité normale.",
          4: "Ce problème sera traité dès que possible.",
          5: "Ce problème sera traité selon nos disponibilités."
        },
        
        nextSteps: {
          incident: {
            incident_logiciel: "Notre équipe de support logiciel va analyser ce problème et vous proposer une solution.",
            incident_materiel: "Un technicien spécialisé en matériel informatique va examiner votre problème.",
            incident_reseau: "Notre équipe réseau va diagnostiquer ce problème de connectivité.",
            incident_securite: "Notre équipe de sécurité va immédiatement examiner cet incident.",
            incident_autre: "Notre équipe de support va analyser votre problème et vous recontacter."
          },
          demande: {
            demande_acces: "Votre demande d'accès sera traitée selon notre procédure d'autorisation standard.",
            demande_logiciel: "Votre demande d'installation logicielle sera évaluée par notre équipe.",
            demande_materiel: "Votre demande de matériel sera examinée selon notre procédure d'attribution.",
            demande_information: "Nous allons vous fournir les informations demandées dans les meilleurs délais.",
            demande_autre: "Votre demande sera traitée par le service approprié."
          }
        },
        
        timeframe: {
          1: "Nous vous recontacterons dans l'heure.",
          2: "Nous vous recontacterons dans la journée.",
          3: "Nous vous recontacterons sous 24 à 48 heures.",
          4: "Nous vous recontacterons d'ici la fin de la semaine.",
          5: "Nous vous recontacterons dès que possible."
        },
        
        followUp: {
          withTicketNumber: "Concernant votre ticket #{TICKET_NUMBER}, ",
          withoutTicketNumber: "Concernant votre demande précédente, "
        },
        
        closing: [
          "N'hésitez pas à nous fournir toute information complémentaire qui pourrait nous aider.",
          "Merci de votre patience.",
          "Nous restons à votre disposition pour toute question."
        ],
        
        signature: [
          "Cordialement,\nLe service informatique",
          "Bien à vous,\nL'équipe support",
          "À votre service,\nLe support technique"
        ]
      };
      
      // Fonction pour sélectionner aléatoirement un élément d'un tableau
      const randomPick = (array) => array[Math.floor(Math.random() * array.length)];
      
      // Construire la réponse
      let response = '';
      
      // Si c'est un suivi de ticket
      if (analysis.followUp && analysis.followUp.isFollowUp) {
        if (analysis.followUp.ticketNumber) {
          response += templates.followUp.withTicketNumber.replace('{TICKET_NUMBER}', analysis.followUp.ticketNumber);
        } else {
          response += templates.followUp.withoutTicketNumber;
        }
      } else {
        // Salutation
        response += randomPick(templates.greeting) + '\n\n';
      }
      
      // Accusé de réception
      const acknowledgmentTemplates = templates.acknowledgment[analysis.type];
      if (acknowledgmentTemplates) {
        response += randomPick(acknowledgmentTemplates).replace('{ISSUE}', analysis.title) + ' ';
      }
      
      // Urgence
      if (analysis.urgency && templates.urgency[analysis.urgency]) {
        response += templates.urgency[analysis.urgency] + '\n\n';
      }
      
      // Prochaines étapes
      const nextStepsCategory = templates.nextSteps[analysis.type][analysis.category];
      if (nextStepsCategory) {
        response += nextStepsCategory + ' ';
      }
      
      // Délai
      if (analysis.urgency && templates.timeframe[analysis.urgency]) {
        response += templates.timeframe[analysis.urgency] + '\n\n';
      }
      
      // Informations supplémentaires en fonction de la complexité
      if (analysis.complexity && analysis.complexity.level === 'élevée') {
        response += "En raison de la complexité de votre demande, un expert pourrait vous contacter pour plus de détails.\n\n";
      }
      
      // Si des entités ont été détectées, les mentionner
      if (analysis.entities) {
        if (analysis.entities.dates && analysis.entities.dates.length > 0) {
          response += `Nous avons bien noté la date mentionnée : ${analysis.entities.dates.join(', ')}.\n`;
        }
        
        if (analysis.entities.emails && analysis.entities.emails.length > 0) {
          response += `Nous utiliserons l'adresse e-mail suivante pour vous contacter : ${analysis.entities.emails[0]}.\n`;
        }
      }
      
      // Clôture
      response += '\n' + randomPick(templates.closing) + '\n\n';
      
      // Signature
      response += randomPick(templates.signature);
      
      return response;
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse:", error);
      // Réponse par défaut en cas d'erreur
      return "Bonjour,\n\nNous avons bien reçu votre message et nous allons le traiter dans les meilleurs délais.\n\nCordialement,\nLe service informatique";
    }
  },
  
  /**
   * Analyse une demande de ticket pour la compatibilité avec index.js
   * @param {string} text - Le texte de la demande
   * @returns {Promise<Object>} - Résultat de l'analyse formaté pour index.js
   */
  async analyzeTicketRequest(text) {
    try {
      // Utiliser notre fonction analyzeTicket existante
      const analysis = await this.analyzeTicket(text);
      
      // Formater le résultat pour la compatibilité avec index.js
      return {
        title: analysis.title,
        type: analysis.type,
        typeId: analysis.typeId,
        category: analysis.category,
        categoryId: analysis.categoryId,
        categoryName: this.getCategoryName(analysis.category),
        urgency: analysis.urgency,
        suggestions: analysis.nextActions,
        missingInfo: this.generateMissingInfoList(analysis),
        complexity: analysis.complexity.level,
        sentiment: analysis.sentiment.label,
        entities: analysis.entities
      };
    } catch (error) {
      console.error("Erreur lors de l'analyse de la demande de ticket:", error);
      // Valeurs par défaut en cas d'erreur
      return {
        title: this.generateSummary(text),
        type: 'incident',
        typeId: 1,
        category: 'incident_autre',
        categoryId: 10,
        categoryName: 'Autre incident',
        urgency: 3,
        suggestions: ["Traiter selon la procédure standard"],
        missingInfo: ["Plus de détails sur le problème rencontré"],
        complexity: "moyenne",
        sentiment: "neutre",
        entities: {}
      };
    }
  },
  
  /**
   * Génère une liste d'informations manquantes en fonction de l'analyse
   * @param {Object} analysis - Résultat de l'analyse
   * @returns {string[]} - Liste d'informations manquantes
   */
  generateMissingInfoList(analysis) {
    const missingInfo = [];
    
    // Si la confiance est faible pour le type ou la catégorie
    if (analysis.typeConfidence < 0.7) {
      missingInfo.push("Préciser s'il s'agit d'un incident ou d'une demande");
    }
    
    if (analysis.categoryConfidence < 0.7) {
      missingInfo.push("Plus de détails sur la catégorie du problème");
    }
    
    // Si aucune entité n'a été détectée
    if (!analysis.entities.dates || analysis.entities.dates.length === 0) {
      missingInfo.push("Préciser si une date est importante pour cette demande");
    }
    
    if (!analysis.entities.people || analysis.entities.people.length === 0) {
      missingInfo.push("Préciser les personnes concernées par cette demande");
    }
    
    // En fonction de la catégorie
    if (analysis.category === 'incident_materiel' && analysis.complexity.level === 'faible') {
      missingInfo.push("Préciser la marque et le modèle de l'équipement");
    }
    
    if (analysis.category === 'incident_logiciel' && analysis.complexity.level === 'faible') {
      missingInfo.push("Préciser la version du logiciel concerné");
    }
    
    if (analysis.category === 'incident_reseau' && analysis.complexity.level === 'faible') {
      missingInfo.push("Préciser si d'autres utilisateurs sont affectés");
    }
    
    // Si la liste est vide, ajouter une suggestion générique
    if (missingInfo.length === 0) {
      missingInfo.push("Des captures d'écran ou photos pourraient être utiles");
    }
    
    return missingInfo;
  },
  
  /**
   * Obtient le nom de la catégorie à partir de son identifiant
   * @param {string} categoryId - Identifiant de la catégorie
   * @returns {string} - Nom de la catégorie
   */
  getCategoryName(categoryId) {
    const categoryNames = {
      'incident_logiciel': 'Incident logiciel',
      'incident_materiel': 'Incident matériel',
      'incident_reseau': 'Incident réseau',
      'incident_securite': 'Incident de sécurité',
      'incident_autre': 'Autre incident',
      'demande_acces': 'Demande d\'accès',
      'demande_logiciel': 'Demande de logiciel',
      'demande_materiel': 'Demande de matériel',
      'demande_information': 'Demande d\'information',
      'demande_autre': 'Autre demande'
    };
    
    return categoryNames[categoryId] || 'Catégorie inconnue';
  },
  
  /**
   * Génère une réponse personnalisée pour un ticket
   * @param {Object} ticketData - Données du ticket
   * @returns {Promise<string>} - Réponse personnalisée
   */
  async generatePersonalizedResponse(ticketData) {
    try {
      // Créer un objet d'analyse à partir des données du ticket
      const analysis = {
        title: ticketData.title,
        type: ticketData.type,
        typeId: ticketData.typeId,
        category: ticketData.category,
        urgency: parseInt(ticketData.urgency),
        complexity: { level: ticketData.complexity },
        entities: {},
        followUp: { isFollowUp: false }
      };
      
      // Utiliser notre fonction generateResponse existante
      return this.generateResponse(analysis);
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse personnalisée:", error);
      return "Votre ticket a été créé avec succès. Nous vous tiendrons informé de son avancement. Merci de votre confiance.";
    }
  },
  
  /**
   * Compte le nombre d'occurrences d'un ensemble de mots-clés dans un texte.
   * @param {string} text - Le texte à analyser.
   * @param {string[]} keywords - Liste de mots-clés à rechercher.
   * @returns {Object} - Nombre d'occurrences et mots trouvés.
   */
  countKeywords(text, keywords) {
    console.log(`[countKeywords] Recherche de ${keywords.length} mots-clés dans un texte de ${text.length} caractères`);
    
    const lowerText = text.toLowerCase();
    const found = [];
    let count = 0;
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        found.push(keyword);
        count++;
      }
    }
    
    console.log(`[countKeywords] ${count} mots-clés trouvés: ${found.slice(0, 5).join(', ')}${found.length > 5 ? '...' : ''}`);
    
    return {
      count,
      found
    };
  },
  
  /**
   * Génère un résumé du ticket à partir de la description
   * @param {string} text - Description complète
   * @returns {string} - Résumé du ticket
   */
  generateSummary(text) {
    console.log(`[generateSummary] Génération d'un résumé pour: "${text.substring(0, 50)}..."`);
    
    // Extraire la première phrase (max 100 caractères)
    const firstSentence = text.split(/[.!?]+/)[0];
    
    let summary;
    if (firstSentence.length <= 100) {
      summary = firstSentence;
    } else {
      // Si la première phrase est trop longue, prendre les 100 premiers caractères
      summary = firstSentence.substring(0, 97) + '...';
    }
    
    console.log(`[generateSummary] Résumé généré: "${summary}"`);
    return summary;
  }
};

module.exports = advancedLocalAiService;
