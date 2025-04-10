/**
 * Service TensorFlow.js amélioré pour l'analyse avancée des tickets
 * Utilise des réseaux de neurones avec un vocabulaire étendu
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { WordTokenizer, PorterStemmerFr } = natural;
const tokenizer = new WordTokenizer();
const path = require('path');
const fs = require('fs');

// Importer les vocabulaires étendus
const baseVocab = require('../data/vocabularyBase');
const domainVocab = require('../data/vocabularyDomain');
const technicalVocab = require('../data/vocabularyTechnical');

// Classe pour le service TensorFlow amélioré
class EnhancedTensorflowService {
  constructor() {
    this.typeModel = null;
    this.categoryModel = null;
    this.urgencyModel = null;
    this.sentimentModel = null;
    this.complexityModel = null;
    
    this.vocabulary = new Set();
    this.categoryVocabulary = new Set();
    this.urgencyVocabulary = new Set();
    this.sentimentVocabulary = new Set();
    
    this.allCategories = [
      // Incidents
      'incident_autre', 'incident_logiciel', 'incident_materiel', 'incident_reseau', 'incident_securite',
      // Demandes
      'demande_acces', 'demande_autre', 'demande_information', 'demande_logiciel', 'demande_materiel'
    ];
    
    this.isInitialized = false;
    this.modelPath = path.join(__dirname, '../models');
    
    // S'assurer que le répertoire des modèles existe
    if (!fs.existsSync(this.modelPath)) {
      fs.mkdirSync(this.modelPath, { recursive: true });
    }
    
    // Construire le vocabulaire étendu
    this._buildExtendedVocabulary();
  }

  /**
   * Initialise les modèles TensorFlow
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log("Initialisation des modèles TensorFlow améliorés...");
    
    try {
      // Vérifier si des modèles pré-entraînés existent
      const hasPretrainedModels = this._checkForPretrainedModels();
      
      if (hasPretrainedModels) {
        await this._loadPretrainedModels();
      } else {
        // Créer et entraîner les modèles
        await this._createAndTrainTypeModel();
        await this._createAndTrainCategoryModel();
        await this._createAndTrainUrgencyModel();
        await this._createAndTrainSentimentModel();
        await this._createAndTrainComplexityModel();
        
        // Sauvegarder les modèles entraînés
        await this._saveModels();
      }
      
      this.isInitialized = true;
      console.log("Modèles TensorFlow améliorés initialisés avec succès!");
    } catch (error) {
      console.error("Erreur lors de l'initialisation des modèles TensorFlow améliorés:", error);
      throw error;
    }
  }

  /**
   * Vérifie si des modèles pré-entraînés existent
   * @returns {boolean} - True si des modèles pré-entraînés existent
   */
  _checkForPretrainedModels() {
    try {
      const typeModelPath = path.join(this.modelPath, 'type_model');
      const categoryModelPath = path.join(this.modelPath, 'category_model');
      const urgencyModelPath = path.join(this.modelPath, 'urgency_model');
      const sentimentModelPath = path.join(this.modelPath, 'sentiment_model');
      const complexityModelPath = path.join(this.modelPath, 'complexity_model');
      
      return (
        fs.existsSync(typeModelPath) &&
        fs.existsSync(categoryModelPath) &&
        fs.existsSync(urgencyModelPath) &&
        fs.existsSync(sentimentModelPath) &&
        fs.existsSync(complexityModelPath)
      );
    } catch (error) {
      console.error("Erreur lors de la vérification des modèles pré-entraînés:", error);
      return false;
    }
  }

  /**
   * Charge les modèles pré-entraînés
   */
  async _loadPretrainedModels() {
    console.log("Chargement des modèles pré-entraînés...");
    
    try {
      this.typeModel = await tf.loadLayersModel(`file://${path.join(this.modelPath, 'type_model/model.json')}`);
      this.categoryModel = await tf.loadLayersModel(`file://${path.join(this.modelPath, 'category_model/model.json')}`);
      this.urgencyModel = await tf.loadLayersModel(`file://${path.join(this.modelPath, 'urgency_model/model.json')}`);
      this.sentimentModel = await tf.loadLayersModel(`file://${path.join(this.modelPath, 'sentiment_model/model.json')}`);
      this.complexityModel = await tf.loadLayersModel(`file://${path.join(this.modelPath, 'complexity_model/model.json')}`);
      
      console.log("Modèles pré-entraînés chargés avec succès");
    } catch (error) {
      console.error("Erreur lors du chargement des modèles pré-entraînés:", error);
      throw error;
    }
  }

  /**
   * Sauvegarde les modèles entraînés
   */
  async _saveModels() {
    console.log("Sauvegarde des modèles entraînés...");
    
    try {
      await this.typeModel.save(`file://${path.join(this.modelPath, 'type_model')}`);
      await this.categoryModel.save(`file://${path.join(this.modelPath, 'category_model')}`);
      await this.urgencyModel.save(`file://${path.join(this.modelPath, 'urgency_model')}`);
      await this.sentimentModel.save(`file://${path.join(this.modelPath, 'sentiment_model')}`);
      await this.complexityModel.save(`file://${path.join(this.modelPath, 'complexity_model')}`);
      
      console.log("Modèles entraînés sauvegardés avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des modèles:", error);
      // Continuer même en cas d'erreur de sauvegarde
    }
  }

  /**
   * Construit le vocabulaire étendu à partir des fichiers de vocabulaire
   */
  _buildExtendedVocabulary() {
    // Ajouter le vocabulaire de base
    this._addVocabularyToSet(baseVocab.INCIDENT_VOCABULARY, this.vocabulary);
    this._addVocabularyToSet(baseVocab.REQUEST_VOCABULARY, this.vocabulary);
    this._addVocabularyToSet(baseVocab.HARDWARE_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(baseVocab.SOFTWARE_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(baseVocab.NETWORK_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    
    // Ajouter le vocabulaire d'urgence
    Object.values(baseVocab.URGENCY_VOCABULARY).forEach(keywords => {
      this._addVocabularyToSet(keywords, this.vocabulary, this.urgencyVocabulary);
    });
    
    // Ajouter le vocabulaire de domaine
    this._addVocabularyToSet(domainVocab.ENTERPRISE_IT_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.MEDICAL_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.FINANCE_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.RETAIL_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.EDUCATION_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.INDUSTRY_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.PUBLIC_SECTOR_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.TELECOM_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    this._addVocabularyToSet(domainVocab.LOGISTICS_VOCABULARY, this.vocabulary, this.categoryVocabulary);
    
    // Ajouter le vocabulaire technique
    this._addVocabularyToSet(technicalVocab.ERROR_MESSAGES_VOCABULARY, this.vocabulary);
    this._addVocabularyToSet(technicalVocab.PROBLEM_EXPRESSIONS, this.vocabulary);
    this._addVocabularyToSet(technicalVocab.REQUEST_EXPRESSIONS, this.vocabulary);
    this._addVocabularyToSet(technicalVocab.URGENCY_EXPRESSIONS, this.vocabulary, this.urgencyVocabulary);
    this._addVocabularyToSet(technicalVocab.SENTIMENT_EXPRESSIONS, this.vocabulary, this.sentimentVocabulary);
    this._addVocabularyToSet(technicalVocab.GREETING_EXPRESSIONS, this.vocabulary, this.sentimentVocabulary);
    this._addVocabularyToSet(technicalVocab.FOLLOW_UP_EXPRESSIONS, this.vocabulary);
    
    console.log(`Vocabulaire étendu construit: ${this.vocabulary.size} mots`);
    console.log(`Vocabulaire de catégorie: ${this.categoryVocabulary.size} mots`);
    console.log(`Vocabulaire d'urgence: ${this.urgencyVocabulary.size} mots`);
    console.log(`Vocabulaire de sentiment: ${this.sentimentVocabulary.size} mots`);
  }

  /**
   * Ajoute un vocabulaire à un ou plusieurs ensembles
   * @param {string[]} vocabulary - Liste de mots ou expressions
   * @param {...Set} sets - Ensembles auxquels ajouter le vocabulaire
   */
  _addVocabularyToSet(vocabulary, ...sets) {
    vocabulary.forEach(word => {
      const tokens = tokenizer.tokenize(word.toLowerCase());
      tokens.forEach(token => {
        const stemmed = PorterStemmerFr.stem(token);
        sets.forEach(set => set.add(stemmed));
      });
    });
  }

  /**
   * Convertit un texte en vecteur de caractéristiques pour les modèles
   * @param {string} text - Texte à convertir
   * @param {Set} vocabSet - Ensemble de vocabulaire à utiliser (par défaut: this.vocabulary)
   * @returns {number[]} - Vecteur de caractéristiques
   */
  _textToFeatures(text, vocabSet = this.vocabulary) {
    const features = Array(vocabSet.size).fill(0);
    const vocabArray = Array.from(vocabSet);
    
    // Tokeniser et stemmer le texte
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stemmedTokens = tokens.map(token => PorterStemmerFr.stem(token));
    
    // Compter les occurrences de chaque mot du vocabulaire
    stemmedTokens.forEach(stemmedToken => {
      const index = vocabArray.indexOf(stemmedToken);
      if (index !== -1) {
        features[index]++;
      }
    });
    
    return features;
  }

  /**
   * Génère un texte aléatoire à partir d'une liste de mots-clés
   * @param {string[]} keywords - Liste de mots-clés
   * @param {number} numKeywords - Nombre de mots-clés à inclure
   * @returns {string} - Texte généré
   */
  _generateRandomText(keywords, numKeywords) {
    const selectedKeywords = [];
    const fillerWords = ['je', 'ai', 'un', 'une', 'le', 'la', 'les', 'des', 'avec', 'sur', 'dans', 'pour', 'qui', 'que', 'et', 'ou', 'mon', 'ma', 'mes'];
    
    // Sélectionner des mots-clés aléatoires
    for (let i = 0; i < numKeywords; i++) {
      const randomIndex = Math.floor(Math.random() * keywords.length);
      selectedKeywords.push(keywords[randomIndex]);
    }
    
    // Ajouter des mots de remplissage
    const numFillerWords = Math.floor(Math.random() * 5) + 3; // 3 à 7 mots de remplissage
    for (let i = 0; i < numFillerWords; i++) {
      const randomIndex = Math.floor(Math.random() * fillerWords.length);
      const position = Math.floor(Math.random() * (selectedKeywords.length + 1));
      selectedKeywords.splice(position, 0, fillerWords[randomIndex]);
    }
    
    return selectedKeywords.join(' ');
  }

  /**
   * Prédit le type de ticket (incident ou demande)
   * @param {string} text - Texte à analyser
   * @returns {Promise<{type: string, typeId: number, confidence: number}>} - Résultat de la prédiction
   */
  async predictTicketType(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Convertir le texte en caractéristiques
      const features = this._textToFeatures(text);
      
      // Prédire avec le modèle
      const prediction = this.typeModel.predict(tf.tensor2d([features]));
      const predictionData = await prediction.data();
      
      // Déterminer le type en fonction des probabilités
      const incidentProb = predictionData[0];
      const requestProb = predictionData[1];
      
      let type, typeId, confidence;
      
      if (incidentProb > requestProb) {
        type = 'incident';
        typeId = 1;
        confidence = incidentProb;
      } else {
        type = 'demande';
        typeId = 2;
        confidence = requestProb;
      }
      
      return { type, typeId, confidence };
    } catch (error) {
      console.error("Erreur lors de la prédiction du type de ticket:", error);
      // Fallback en cas d'erreur
      return { type: 'incident', typeId: 1, confidence: 0.5 };
    }
  }

  /**
   * Prédit la catégorie d'un ticket
   * @param {string} text - Texte à analyser
   * @param {string} type - Type de ticket ('incident' ou 'demande')
   * @returns {Promise<{category: string, categoryId: number, confidence: number}>} - Résultat de la prédiction
   */
  async predictTicketCategory(text, type) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Convertir le texte en caractéristiques
      const features = this._textToFeatures(text, this.categoryVocabulary);
      
      // Prédire avec le modèle
      const prediction = this.categoryModel.predict(tf.tensor2d([features]));
      const predictionData = await prediction.data();
      
      // Filtrer les catégories en fonction du type
      const relevantCategories = this.allCategories.filter(category => 
        category.startsWith(type)
      );
      
      // Trouver la catégorie avec la plus haute probabilité
      let maxProb = 0;
      let bestCategory = '';
      let bestCategoryIndex = -1;
      
      relevantCategories.forEach((category, index) => {
        const categoryIndex = this.allCategories.indexOf(category);
        const prob = predictionData[categoryIndex];
        
        if (prob > maxProb) {
          maxProb = prob;
          bestCategory = category;
          bestCategoryIndex = categoryIndex;
        }
      });
      
      // Mapping des catégories vers les IDs GLPI
      const categoryMap = {
        'incident_autre': 10,
        'incident_logiciel': 8,
        'incident_materiel': 7,
        'incident_reseau': 6,
        'incident_securite': 9,
        'demande_acces': 1,
        'demande_autre': 5,
        'demande_information': 4,
        'demande_logiciel': 3,
        'demande_materiel': 2
      };
      
      return {
        category: bestCategory,
        categoryId: categoryMap[bestCategory] || 0,
        confidence: maxProb
      };
    } catch (error) {
      console.error("Erreur lors de la prédiction de la catégorie:", error);
      // Fallback en cas d'erreur
      return {
        category: type === 'incident' ? 'incident_autre' : 'demande_autre',
        categoryId: type === 'incident' ? 10 : 5,
        confidence: 0.5
      };
    }
  }

  /**
   * Prédit le niveau d'urgence d'un ticket
   * @param {string} text - Texte à analyser
   * @returns {Promise<{urgency: number, confidence: number}>} - Résultat de la prédiction
   */
  async predictUrgency(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Convertir le texte en caractéristiques
      const features = this._textToFeatures(text, this.urgencyVocabulary);
      
      // Prédire avec le modèle
      const prediction = this.urgencyModel.predict(tf.tensor2d([features]));
      const predictionData = await prediction.data();
      
      // Trouver le niveau d'urgence avec la plus haute probabilité
      let maxProb = 0;
      let bestUrgency = 3; // Par défaut: urgence moyenne
      
      for (let i = 0; i < 5; i++) {
        const prob = predictionData[i];
        if (prob > maxProb) {
          maxProb = prob;
          bestUrgency = i + 1; // Les niveaux d'urgence vont de 1 à 5
        }
      }
      
      return { urgency: bestUrgency, confidence: maxProb };
    } catch (error) {
      console.error("Erreur lors de la prédiction de l'urgence:", error);
      // Fallback en cas d'erreur
      return { urgency: 3, confidence: 0.5 };
    }
  }

  /**
   * Prédit le sentiment exprimé dans un texte
   * @param {string} text - Texte à analyser
   * @returns {Promise<{sentiment: number, sentimentLabel: string, confidence: number}>} - Résultat de la prédiction
   */
  async predictSentiment(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Convertir le texte en caractéristiques
      const features = this._textToFeatures(text, this.sentimentVocabulary);
      
      // Prédire avec le modèle
      const prediction = this.sentimentModel.predict(tf.tensor2d([features]));
      const predictionData = await prediction.data();
      
      // Les sentiments sont: négatif (0), neutre (1), positif (2)
      const negativeProb = predictionData[0];
      const neutralProb = predictionData[1];
      const positiveProb = predictionData[2];
      
      let sentiment, sentimentLabel, confidence;
      
      if (negativeProb > neutralProb && negativeProb > positiveProb) {
        sentiment = -1;
        sentimentLabel = 'négatif';
        confidence = negativeProb;
      } else if (positiveProb > neutralProb && positiveProb > negativeProb) {
        sentiment = 1;
        sentimentLabel = 'positif';
        confidence = positiveProb;
      } else {
        sentiment = 0;
        sentimentLabel = 'neutre';
        confidence = neutralProb;
      }
      
      return { sentiment, sentimentLabel, confidence };
    } catch (error) {
      console.error("Erreur lors de la prédiction du sentiment:", error);
      // Fallback en cas d'erreur
      return { sentiment: 0, sentimentLabel: 'neutre', confidence: 0.5 };
    }
  }

  /**
   * Prédit la complexité d'un problème
   * @param {string} text - Texte à analyser
   * @returns {Promise<{complexity: string, score: number, confidence: number}>} - Résultat de la prédiction
   */
  async predictComplexity(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Convertir le texte en caractéristiques
      const features = this._textToFeatures(text);
      
      // Prédire avec le modèle
      const prediction = this.complexityModel.predict(tf.tensor2d([features]));
      const predictionData = await prediction.data();
      
      // Les niveaux de complexité sont: simple (0), modéré (1), complexe (2)
      const simpleProb = predictionData[0];
      const moderateProb = predictionData[1];
      const complexProb = predictionData[2];
      
      let complexity, score, confidence;
      
      if (simpleProb > moderateProb && simpleProb > complexProb) {
        complexity = 'simple';
        score = 1;
        confidence = simpleProb;
      } else if (complexProb > moderateProb && complexProb > simpleProb) {
        complexity = 'complexe';
        score = 3;
        confidence = complexProb;
      } else {
        complexity = 'modéré';
        score = 2;
        confidence = moderateProb;
      }
      
      return { complexity, score, confidence };
    } catch (error) {
      console.error("Erreur lors de la prédiction de la complexité:", error);
      // Fallback en cas d'erreur
      return { complexity: 'modéré', score: 2, confidence: 0.5 };
    }
  }
}

// Exporter une instance du service
const enhancedTensorflowService = new EnhancedTensorflowService();
module.exports = enhancedTensorflowService;
