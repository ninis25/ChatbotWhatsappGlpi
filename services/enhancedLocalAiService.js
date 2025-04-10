/**
 * Service d'IA locale amélioré pour le chatbot WhatsApp-GLPI
 * Utilise les vocabulaires étendus et les modèles TensorFlow.js
 */

const natural = require('natural');
const { WordTokenizer, PorterStemmerFr } = natural;
const tokenizer = new WordTokenizer();

// Importer les services TensorFlow
const enhancedTensorflowService = require('./enhancedTensorflowService');
require('./enhancedTensorflowTraining');
require('./enhancedTensorflowTraining2');

// Importer les vocabulaires étendus
const baseVocab = require('../data/vocabularyBase');
const domainVocab = require('../data/vocabularyDomain');
const technicalVocab = require('../data/vocabularyTechnical');

class EnhancedLocalAiService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialise le service d'IA locale amélioré
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log("Initialisation du service d'IA locale amélioré...");
      
      // Initialiser le service TensorFlow
      await enhancedTensorflowService.initialize();
      
      this.isInitialized = true;
      console.log("Service d'IA locale amélioré initialisé avec succès!");
    } catch (error) {
      console.error("Erreur lors de l'initialisation du service d'IA locale amélioré:", error);
      throw error;
    }
  }

  /**
   * Classifie le type de ticket (incident ou demande)
   * @param {string} text - Texte à analyser
   * @returns {Promise<{type: string, typeId: number, confidence: number}>} - Résultat de la classification
   */
  async classifyTicketType(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await enhancedTensorflowService.predictTicketType(text);
      
      // Si la confiance est suffisante, utiliser le résultat TensorFlow
      if (tfResult.confidence > 0.7) {
        return tfResult;
      }
      
      // Sinon, utiliser l'approche basée sur des règles comme fallback
      return this._classifyTicketTypeByRules(text);
    } catch (error) {
      console.error("Erreur lors de la classification du type de ticket:", error);
      // Fallback en cas d'erreur
      return this._classifyTicketTypeByRules(text);
    }
  }

  /**
   * Classifie le type de ticket en utilisant des règles basées sur des mots-clés
   * @param {string} text - Texte à analyser
   * @returns {{type: string, typeId: number, confidence: number}} - Résultat de la classification
   */
  _classifyTicketTypeByRules(text) {
    const lowercaseText = text.toLowerCase();
    
    // Compter les occurrences de mots-clés d'incident et de demande
    let incidentScore = 0;
    let requestScore = 0;
    
    // Vérifier les mots-clés d'incident
    baseVocab.INCIDENT_VOCABULARY.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        incidentScore++;
      }
    });
    
    // Vérifier les expressions de problème
    technicalVocab.PROBLEM_EXPRESSIONS.forEach(expression => {
      if (lowercaseText.includes(expression.toLowerCase())) {
        incidentScore++;
      }
    });
    
    // Vérifier les messages d'erreur
    technicalVocab.ERROR_MESSAGES_VOCABULARY.forEach(message => {
      if (lowercaseText.includes(message.toLowerCase())) {
        incidentScore += 2; // Donner plus de poids aux messages d'erreur
      }
    });
    
    // Vérifier les mots-clés de demande
    baseVocab.REQUEST_VOCABULARY.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        requestScore++;
      }
    });
    
    // Vérifier les expressions de demande
    technicalVocab.REQUEST_EXPRESSIONS.forEach(expression => {
      if (lowercaseText.includes(expression.toLowerCase())) {
        requestScore++;
      }
    });
    
    // Déterminer le type en fonction des scores
    if (incidentScore > requestScore) {
      return {
        type: 'incident',
        typeId: 1,
        confidence: incidentScore / (incidentScore + requestScore)
      };
    } else {
      return {
        type: 'demande',
        typeId: 2,
        confidence: requestScore / (incidentScore + requestScore)
      };
    }
  }

  /**
   * Détermine la catégorie appropriée pour un ticket
   * @param {string} text - Texte à analyser
   * @param {string} type - Type de ticket ('incident' ou 'demande')
   * @returns {Promise<{category: string, categoryId: number, confidence: number}>} - Résultat de la classification
   */
  async determineCategory(text, type) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await enhancedTensorflowService.predictTicketCategory(text, type);
      
      // Si la confiance est suffisante, utiliser le résultat TensorFlow
      if (tfResult.confidence > 0.6) {
        return tfResult;
      }
      
      // Sinon, utiliser l'approche basée sur des règles comme fallback
      return this._determineCategoryByRules(text, type);
    } catch (error) {
      console.error("Erreur lors de la détermination de la catégorie:", error);
      // Fallback en cas d'erreur
      return this._determineCategoryByRules(text, type);
    }
  }

  /**
   * Détermine la catégorie d'un ticket en utilisant des règles basées sur des mots-clés
   * @param {string} text - Texte à analyser
   * @param {string} type - Type de ticket ('incident' ou 'demande')
   * @returns {{category: string, categoryId: number, confidence: number}} - Résultat de la classification
   */
  _determineCategoryByRules(text, type) {
    const lowercaseText = text.toLowerCase();
    
    // Scores pour chaque catégorie
    const scores = {
      hardware: 0,
      software: 0,
      network: 0,
      security: 0,
      access: 0,
      information: 0
    };
    
    // Vérifier les mots-clés matériels
    baseVocab.HARDWARE_VOCABULARY.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.hardware++;
      }
    });
    
    // Vérifier les mots-clés logiciels
    baseVocab.SOFTWARE_VOCABULARY.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.software++;
      }
    });
    
    // Vérifier les mots-clés réseau
    baseVocab.NETWORK_VOCABULARY.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.network++;
      }
    });
    
    // Mots-clés de sécurité
    const securityKeywords = ['virus', 'malware', 'phishing', 'hacker', 'sécurité', 'attaque', 'compromis', 'piratage', 'vulnérabilité'];
    securityKeywords.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.security++;
      }
    });
    
    // Mots-clés d'accès
    const accessKeywords = ['accès', 'compte', 'mot de passe', 'login', 'connexion', 'permission', 'droit', 'autorisation'];
    accessKeywords.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.access++;
      }
    });
    
    // Mots-clés d'information
    const infoKeywords = ['information', 'aide', 'conseil', 'question', 'comment', 'procédure', 'documentation', 'guide'];
    infoKeywords.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.information++;
      }
    });
    
    // Trouver la catégorie avec le score le plus élevé
    let maxScore = 0;
    let bestCategory = '';
    let categoryId = 0;
    
    if (type === 'incident') {
      if (scores.hardware > maxScore) {
        maxScore = scores.hardware;
        bestCategory = 'incident_materiel';
        categoryId = 7;
      }
      if (scores.software > maxScore) {
        maxScore = scores.software;
        bestCategory = 'incident_logiciel';
        categoryId = 8;
      }
      if (scores.network > maxScore) {
        maxScore = scores.network;
        bestCategory = 'incident_reseau';
        categoryId = 6;
      }
      if (scores.security > maxScore) {
        maxScore = scores.security;
        bestCategory = 'incident_securite';
        categoryId = 9;
      }
      
      // Si aucune catégorie spécifique n'est identifiée
      if (maxScore === 0) {
        bestCategory = 'incident_autre';
        categoryId = 10;
        maxScore = 1;
      }
    } else { // type === 'demande'
      if (scores.hardware > maxScore) {
        maxScore = scores.hardware;
        bestCategory = 'demande_materiel';
        categoryId = 2;
      }
      if (scores.software > maxScore) {
        maxScore = scores.software;
        bestCategory = 'demande_logiciel';
        categoryId = 3;
      }
      if (scores.access > maxScore) {
        maxScore = scores.access;
        bestCategory = 'demande_acces';
        categoryId = 1;
      }
      if (scores.information > maxScore) {
        maxScore = scores.information;
        bestCategory = 'demande_information';
        categoryId = 4;
      }
      
      // Si aucune catégorie spécifique n'est identifiée
      if (maxScore === 0) {
        bestCategory = 'demande_autre';
        categoryId = 5;
        maxScore = 1;
      }
    }
    
    // Calculer la confiance
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;
    
    return {
      category: bestCategory,
      categoryId: categoryId,
      confidence: confidence
    };
  }

  /**
   * Suggère un niveau d'urgence pour un ticket
   * @param {string} text - Texte à analyser
   * @returns {Promise<{urgency: number, confidence: number}>} - Niveau d'urgence suggéré
   */
  async suggestUrgency(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      const tfResult = await enhancedTensorflowService.predictUrgency(text);
      
      // Si la confiance est suffisante, utiliser le résultat TensorFlow
      if (tfResult.confidence > 0.6) {
        return tfResult;
      }
      
      // Sinon, utiliser l'approche basée sur des règles comme fallback
      return this._suggestUrgencyByRules(text);
    } catch (error) {
      console.error("Erreur lors de la suggestion d'urgence:", error);
      // Fallback en cas d'erreur
      return this._suggestUrgencyByRules(text);
    }
  }

  /**
   * Suggère un niveau d'urgence en utilisant des règles basées sur des mots-clés
   * @param {string} text - Texte à analyser
   * @returns {{urgency: number, confidence: number}} - Niveau d'urgence suggéré
   */
  _suggestUrgencyByRules(text) {
    const lowercaseText = text.toLowerCase();
    
    // Scores pour chaque niveau d'urgence
    const scores = {
      veryHigh: 0,
      high: 0,
      medium: 0,
      low: 0,
      veryLow: 0
    };
    
    // Vérifier les mots-clés d'urgence très haute
    baseVocab.URGENCY_VOCABULARY[1].forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.veryHigh++;
      }
    });
    
    // Vérifier les mots-clés d'urgence haute
    baseVocab.URGENCY_VOCABULARY[2].forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.high++;
      }
    });
    
    // Vérifier les mots-clés d'urgence moyenne
    baseVocab.URGENCY_VOCABULARY[3].forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.medium++;
      }
    });
    
    // Vérifier les mots-clés d'urgence basse
    baseVocab.URGENCY_VOCABULARY[4].forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.low++;
      }
    });
    
    // Vérifier les mots-clés d'urgence très basse
    baseVocab.URGENCY_VOCABULARY[5].forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        scores.veryLow++;
      }
    });
    
    // Vérifier les expressions d'urgence
    technicalVocab.URGENCY_EXPRESSIONS.forEach(expression => {
      if (lowercaseText.includes(expression.toLowerCase())) {
        // Attribuer des points selon la position dans le tableau
        const index = technicalVocab.URGENCY_EXPRESSIONS.indexOf(expression);
        if (index < 15) {
          scores.veryHigh++;
        } else if (index < 30) {
          scores.high++;
        } else {
          scores.medium++;
        }
      }
    });
    
    // Trouver le niveau d'urgence avec le score le plus élevé
    let maxScore = 0;
    let urgency = 3; // Par défaut: urgence moyenne
    
    if (scores.veryHigh > maxScore) {
      maxScore = scores.veryHigh;
      urgency = 1;
    }
    if (scores.high > maxScore) {
      maxScore = scores.high;
      urgency = 2;
    }
    if (scores.medium > maxScore) {
      maxScore = scores.medium;
      urgency = 3;
    }
    if (scores.low > maxScore) {
      maxScore = scores.low;
      urgency = 4;
    }
    if (scores.veryLow > maxScore) {
      maxScore = scores.veryLow;
      urgency = 5;
    }
    
    // Si aucun mot-clé d'urgence n'est trouvé, utiliser l'urgence moyenne
    if (maxScore === 0) {
      urgency = 3;
      maxScore = 1;
    }
    
    // Calculer la confiance
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;
    
    return { urgency, confidence };
  }

  /**
   * Extrait un titre pertinent à partir du texte
   * @param {string} text - Texte à analyser
   * @returns {string} - Titre extrait
   */
  extractTitle(text) {
    // Diviser le texte en phrases
    const sentences = text.split(/[.!?]+/);
    
    // Filtrer les phrases vides ou trop courtes
    const validSentences = sentences.filter(sentence => 
      sentence.trim().length > 10 && sentence.trim().length < 100
    );
    
    if (validSentences.length === 0) {
      // Si aucune phrase valide n'est trouvée, utiliser les premiers mots du texte
      const words = text.split(' ');
      const titleWords = words.slice(0, 8);
      return titleWords.join(' ').trim() + (words.length > 8 ? '...' : '');
    }
    
    // Utiliser la première phrase comme titre
    let title = validSentences[0].trim();
    
    // Limiter la longueur du titre
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
    
    return title;
  }

  /**
   * Analyse le sentiment exprimé dans un texte
   * @param {string} text - Texte à analyser
   * @returns {Promise<{sentiment: number, sentimentLabel: string, confidence: number}>} - Résultat de l'analyse
   */
  async analyzeSentiment(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      return await enhancedTensorflowService.predictSentiment(text);
    } catch (error) {
      console.error("Erreur lors de l'analyse du sentiment:", error);
      // Fallback en cas d'erreur
      return { sentiment: 0, sentimentLabel: 'neutre', confidence: 0.5 };
    }
  }

  /**
   * Évalue la complexité d'un problème
   * @param {string} text - Texte à analyser
   * @returns {Promise<{complexity: string, score: number, confidence: number}>} - Résultat de l'évaluation
   */
  async evaluateComplexity(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Utiliser le modèle TensorFlow pour la prédiction
      return await enhancedTensorflowService.predictComplexity(text);
    } catch (error) {
      console.error("Erreur lors de l'évaluation de la complexité:", error);
      // Fallback en cas d'erreur
      return { complexity: 'modéré', score: 2, confidence: 0.5 };
    }
  }

  /**
   * Corrige les fautes d'orthographe courantes
   * @param {string} text - Texte à corriger
   * @returns {string} - Texte corrigé
   */
  correctSpelling(text) {
    // Liste de corrections courantes
    const corrections = {
      'probleme': 'problème',
      'problèmes': 'problèmes',
      'ordinateur': 'ordinateur',
      'ordi': 'ordinateur',
      'pc': 'PC',
      'imprimante': 'imprimante',
      'imprimente': 'imprimante',
      'réseaux': 'réseau',
      'reseaux': 'réseau',
      'reseau': 'réseau',
      'logiciel': 'logiciel',
      'logitiel': 'logiciel',
      'application': 'application',
      'appli': 'application',
      'serveur': 'serveur',
      'serveure': 'serveur',
      'mot de passe': 'mot de passe',
      'mdp': 'mot de passe',
      'internet': 'Internet',
      'wifi': 'WiFi',
      'wi-fi': 'WiFi',
      'email': 'email',
      'e-mail': 'email',
      'mail': 'email',
      'courriel': 'email',
      'fichier': 'fichier',
      'dossier': 'dossier',
      'document': 'document',
      'téléphone': 'téléphone',
      'telephone': 'téléphone',
      'tel': 'téléphone',
      'portable': 'téléphone portable',
      'smartphone': 'smartphone',
      'tablette': 'tablette',
      'windows': 'Windows',
      'microsoft': 'Microsoft',
      'office': 'Office',
      'excel': 'Excel',
      'word': 'Word',
      'powerpoint': 'PowerPoint',
      'outlook': 'Outlook',
      'teams': 'Teams',
      'google': 'Google',
      'chrome': 'Chrome',
      'firefox': 'Firefox',
      'safari': 'Safari',
      'edge': 'Edge',
      'explorer': 'Internet Explorer',
      'adobe': 'Adobe',
      'acrobat': 'Acrobat',
      'pdf': 'PDF',
      'vpn': 'VPN',
      'antivirus': 'antivirus',
      'anti-virus': 'antivirus',
      'virus': 'virus',
      'malware': 'malware',
      'spam': 'spam',
      'hacker': 'hacker',
      'pirate': 'pirate informatique'
    };
    
    // Remplacer les mots mal orthographiés
    let correctedText = text;
    
    Object.keys(corrections).forEach(misspelled => {
      const regex = new RegExp(`\\b${misspelled}\\b`, 'gi');
      correctedText = correctedText.replace(regex, corrections[misspelled]);
    });
    
    return correctedText;
  }

  /**
   * Génère une réponse personnalisée en fonction du contexte
   * @param {string} text - Texte de l'utilisateur
   * @param {Object} context - Contexte de la conversation
   * @returns {string} - Réponse générée
   */
  generateResponse(text, context) {
    // Réponses pour différentes étapes du processus de création de ticket
    const responses = {
      greeting: [
        "Bonjour ! Je suis le chatbot du support informatique. Comment puis-je vous aider aujourd'hui ?",
        "Bonjour ! Je suis là pour vous aider avec vos problèmes informatiques. Que puis-je faire pour vous ?",
        "Bonjour ! Je suis votre assistant virtuel du support IT. En quoi puis-je vous être utile ?"
      ],
      askType: [
        "S'agit-il d'un incident (quelque chose qui ne fonctionne pas) ou d'une demande (quelque chose dont vous avez besoin) ?",
        "Pouvez-vous préciser s'il s'agit d'un incident (problème technique) ou d'une demande (nouvelle fonctionnalité, accès, etc.) ?"
      ],
      askTitle: [
        "Pouvez-vous me donner un titre court qui résume votre problème ?",
        "Comment résumeriez-vous votre demande en une phrase courte ?"
      ],
      askDescription: [
        "Pourriez-vous me donner plus de détails sur votre problème ?",
        "Pouvez-vous décrire plus précisément ce dont vous avez besoin ?",
        "Merci de me fournir une description détaillée de votre situation."
      ],
      askUrgency: [
        "Quel est le niveau d'urgence de votre demande ? (1: Très haute, 2: Haute, 3: Moyenne, 4: Basse, 5: Très basse)",
        "Sur une échelle de 1 à 5 (1 étant le plus urgent), comment qualifieriez-vous l'urgence de votre demande ?"
      ],
      confirmTicket: [
        "Merci pour ces informations. Je vais créer un ticket avec les détails suivants :\n\nType: {type}\nTitre: {title}\nDescription: {description}\nUrgence: {urgency}\n\nEst-ce correct ?",
        "Voici un récapitulatif de votre demande :\n\nType: {type}\nTitre: {title}\nDescription: {description}\nUrgence: {urgency}\n\nPuis-je créer le ticket avec ces informations ?"
      ],
      ticketCreated: [
        "Votre ticket a été créé avec succès ! Numéro de référence : {ticketId}. Un technicien va traiter votre demande dès que possible.",
        "Ticket créé ! Référence : {ticketId}. Notre équipe va s'en occuper rapidement.",
        "Votre demande a été enregistrée sous la référence {ticketId}. Nous vous tiendrons informé de son avancement."
      ],
      fallback: [
        "Je suis désolé, je n'ai pas bien compris. Pouvez-vous reformuler votre demande ?",
        "Excusez-moi, je n'ai pas saisi votre message. Pourriez-vous le formuler différemment ?",
        "Pardon, je n'ai pas compris. Pouvez-vous préciser votre demande ?"
      ]
    };
    
    // Sélectionner une réponse en fonction du contexte
    let responseCategory = 'fallback';
    
    if (!context || !context.step) {
      responseCategory = 'greeting';
    } else {
      switch (context.step) {
        case 'init':
          responseCategory = 'greeting';
          break;
        case 'askType':
          responseCategory = 'askType';
          break;
        case 'askTitle':
          responseCategory = 'askTitle';
          break;
        case 'askDescription':
          responseCategory = 'askDescription';
          break;
        case 'askUrgency':
          responseCategory = 'askUrgency';
          break;
        case 'confirmTicket':
          responseCategory = 'confirmTicket';
          break;
        case 'ticketCreated':
          responseCategory = 'ticketCreated';
          break;
        default:
          responseCategory = 'fallback';
      }
    }
    
    // Sélectionner une réponse aléatoire dans la catégorie
    const responses_category = responses[responseCategory];
    const randomIndex = Math.floor(Math.random() * responses_category.length);
    let response = responses_category[randomIndex];
    
    // Remplacer les variables dans la réponse si nécessaire
    if (context) {
      response = response.replace('{type}', context.type || '');
      response = response.replace('{title}', context.title || '');
      response = response.replace('{description}', context.description || '');
      response = response.replace('{urgency}', context.urgency || '');
      response = response.replace('{ticketId}', context.ticketId || '');
    }
    
    return response;
  }

  /**
   * Analyse complète d'un message pour la création d'un ticket
   * @param {string} text - Texte à analyser
   * @returns {Promise<Object>} - Résultats de l'analyse
   */
  async analyzeMessage(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Corriger l'orthographe
    const correctedText = this.correctSpelling(text);
    
    // Classifier le type de ticket
    const typeResult = await this.classifyTicketType(correctedText);
    
    // Déterminer la catégorie
    const categoryResult = await this.determineCategory(correctedText, typeResult.type);
    
    // Suggérer un niveau d'urgence
    const urgencyResult = await this.suggestUrgency(correctedText);
    
    // Extraire un titre
    const title = this.extractTitle(correctedText);
    
    // Analyser le sentiment
    const sentimentResult = await this.analyzeSentiment(correctedText);
    
    // Évaluer la complexité
    const complexityResult = await this.evaluateComplexity(correctedText);
    
    // Retourner les résultats de l'analyse
    return {
      originalText: text,
      correctedText,
      type: {
        value: typeResult.type,
        id: typeResult.typeId,
        confidence: typeResult.confidence
      },
      category: {
        value: categoryResult.category,
        id: categoryResult.categoryId,
        confidence: categoryResult.confidence
      },
      urgency: {
        value: urgencyResult.urgency,
        confidence: urgencyResult.confidence
      },
      title,
      sentiment: {
        value: sentimentResult.sentiment,
        label: sentimentResult.sentimentLabel,
        confidence: sentimentResult.confidence
      },
      complexity: {
        value: complexityResult.complexity,
        score: complexityResult.score,
        confidence: complexityResult.confidence
      }
    };
  }
}

// Exporter une instance du service
const enhancedLocalAiService = new EnhancedLocalAiService();
module.exports = enhancedLocalAiService;
