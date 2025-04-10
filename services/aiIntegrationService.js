/**
 * Service d'intégration de l'IA améliorée pour le chatbot WhatsApp-GLPI
 * Ce service gère l'intégration entre les différents services d'IA
 */

// Importer les services d'IA
const localAiService = require('./localAiService');
const enhancedLocalAiService = require('./enhancedLocalAiService');
const enhancedTensorflowService = require('./enhancedTensorflowService');

class AiIntegrationService {
  constructor() {
    this.isInitialized = false;
    this.useEnhancedAi = true; // Par défaut, utiliser l'IA améliorée
  }

  /**
   * Initialise le service d'intégration d'IA
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log("Initialisation du service d'intégration d'IA...");
      
      // Initialiser les deux services d'IA
      if (this.useEnhancedAi) {
        await enhancedLocalAiService.initialize();
      } else {
        // Initialiser le service d'IA local de base (pour la compatibilité)
        if (typeof localAiService.initialize === 'function') {
          await localAiService.initialize();
        }
      }
      
      this.isInitialized = true;
      console.log("Service d'intégration d'IA initialisé avec succès!");
    } catch (error) {
      console.error("Erreur lors de l'initialisation du service d'intégration d'IA:", error);
      this.useEnhancedAi = false; // Fallback au service de base en cas d'erreur
      
      // Tenter d'initialiser le service de base
      if (typeof localAiService.initialize === 'function') {
        await localAiService.initialize();
      }
      
      this.isInitialized = true;
    }
  }

  /**
   * Active ou désactive l'IA améliorée
   * @param {boolean} enabled - True pour activer, False pour désactiver
   */
  setEnhancedAi(enabled) {
    this.useEnhancedAi = enabled;
    this.isInitialized = false; // Forcer la réinitialisation
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.classifyTicketType(text);
    } else {
      return localAiService.classifyTicketType(text);
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.determineCategory(text, type);
    } else {
      return localAiService.determineCategory(text, type);
    }
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.suggestUrgency(text);
    } else {
      return localAiService.suggestUrgency(text);
    }
  }

  /**
   * Extrait un titre pertinent à partir du texte
   * @param {string} text - Texte à analyser
   * @returns {string} - Titre extrait
   */
  extractTitle(text) {
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.extractTitle(text);
    } else {
      return localAiService.extractTitle(text);
    }
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.analyzeSentiment(text);
    } else {
      // Fallback si le service de base ne supporte pas cette fonction
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.evaluateComplexity(text);
    } else {
      // Fallback si le service de base ne supporte pas cette fonction
      return { complexity: 'modéré', score: 2, confidence: 0.5 };
    }
  }

  /**
   * Corrige les fautes d'orthographe courantes
   * @param {string} text - Texte à corriger
   * @returns {string} - Texte corrigé
   */
  correctSpelling(text) {
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.correctSpelling(text);
    } else {
      // Fallback si le service de base ne supporte pas cette fonction
      return text;
    }
  }

  /**
   * Génère une réponse personnalisée en fonction du contexte
   * @param {string} text - Texte de l'utilisateur
   * @param {Object} context - Contexte de la conversation
   * @returns {string} - Réponse générée
   */
  generateResponse(text, context) {
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.generateResponse(text, context);
    } else {
      return localAiService.generateResponse(text, context);
    }
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
    
    if (this.useEnhancedAi) {
      return enhancedLocalAiService.analyzeMessage(text);
    } else {
      // Créer une structure compatible avec l'analyse améliorée
      const typeResult = await localAiService.classifyTicketType(text);
      const categoryResult = await localAiService.determineCategory(text, typeResult.type);
      const urgencyResult = await localAiService.suggestUrgency(text);
      const title = localAiService.extractTitle(text);
      
      return {
        originalText: text,
        correctedText: text,
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
          value: 0,
          label: 'neutre',
          confidence: 0.5
        },
        complexity: {
          value: 'modéré',
          score: 2,
          confidence: 0.5
        }
      };
    }
  }

  /**
   * Obtient des statistiques sur les performances des modèles
   * @returns {Promise<Object>} - Statistiques des modèles
   */
  async getModelStats() {
    if (!this.isInitialized || !this.useEnhancedAi) {
      return {
        vocabularySize: 0,
        categoryVocabularySize: 0,
        urgencyVocabularySize: 0,
        sentimentVocabularySize: 0,
        modelsInitialized: false
      };
    }
    
    return {
      vocabularySize: enhancedTensorflowService.vocabulary.size,
      categoryVocabularySize: enhancedTensorflowService.categoryVocabulary.size,
      urgencyVocabularySize: enhancedTensorflowService.urgencyVocabulary.size,
      sentimentVocabularySize: enhancedTensorflowService.sentimentVocabulary.size,
      modelsInitialized: enhancedTensorflowService.isInitialized
    };
  }
}

// Exporter une instance du service
const aiIntegrationService = new AiIntegrationService();
module.exports = aiIntegrationService;
