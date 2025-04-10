/**
 * Méthodes d'entraînement pour le service TensorFlow.js amélioré
 * Ce fichier étend enhancedTensorflowService.js avec des méthodes d'entraînement
 */

const tf = require('@tensorflow/tfjs-node');
const enhancedTensorflowService = require('./enhancedTensorflowService');
const baseVocab = require('../data/vocabularyBase');
const domainVocab = require('../data/vocabularyDomain');
const technicalVocab = require('../data/vocabularyTechnical');
const natural = require('natural');
const { WordTokenizer, PorterStemmerFr } = natural;
const tokenizer = new WordTokenizer();

/**
 * Crée et entraîne le modèle de classification de type de ticket
 */
enhancedTensorflowService._createAndTrainTypeModel = async function() {
  console.log("Création et entraînement du modèle de type de ticket...");
  
  try {
    // Créer le modèle
    this.typeModel = tf.sequential();
    
    // Ajouter les couches
    this.typeModel.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.vocabulary.size]
    }));
    
    this.typeModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    this.typeModel.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.typeModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.typeModel.add(tf.layers.dense({
      units: 2, // Incident ou Demande
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.typeModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Générer des données d'entraînement
    const { xs, ys } = this._generateTypeTrainingData();
    
    // Entraîner le modèle
    await this.typeModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
          }
        }
      }
    });
    
    console.log("Modèle de type de ticket entraîné avec succès");
  } catch (error) {
    console.error("Erreur lors de l'entraînement du modèle de type de ticket:", error);
    throw error;
  }
};

/**
 * Génère des données d'entraînement pour le modèle de type de ticket
 * @returns {Object} - Tenseurs d'entrée (xs) et de sortie (ys)
 */
enhancedTensorflowService._generateTypeTrainingData = function() {
  const trainingData = [];
  const trainingLabels = [];
  
  // Générer des exemples d'incidents
  for (let i = 0; i < 1000; i++) {
    // Mélanger des mots-clés d'incident avec d'autres vocabulaires
    const numIncidentKeywords = Math.floor(Math.random() * 5) + 3; // 3 à 7 mots-clés
    const text = this._generateRandomText([
      ...baseVocab.INCIDENT_VOCABULARY,
      ...technicalVocab.PROBLEM_EXPRESSIONS,
      ...technicalVocab.ERROR_MESSAGES_VOCABULARY
    ], numIncidentKeywords);
    
    // Ajouter aux données d'entraînement
    trainingData.push(this._textToFeatures(text));
    trainingLabels.push([1, 0]); // [incident, demande]
  }
  
  // Générer des exemples de demandes
  for (let i = 0; i < 1000; i++) {
    // Mélanger des mots-clés de demande avec d'autres vocabulaires
    const numRequestKeywords = Math.floor(Math.random() * 5) + 3; // 3 à 7 mots-clés
    const text = this._generateRandomText([
      ...baseVocab.REQUEST_VOCABULARY,
      ...technicalVocab.REQUEST_EXPRESSIONS
    ], numRequestKeywords);
    
    // Ajouter aux données d'entraînement
    trainingData.push(this._textToFeatures(text));
    trainingLabels.push([0, 1]); // [incident, demande]
  }
  
  // Convertir en tenseurs
  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);
  
  return { xs, ys };
};

/**
 * Crée et entraîne le modèle de classification de catégorie
 */
enhancedTensorflowService._createAndTrainCategoryModel = async function() {
  console.log("Création et entraînement du modèle de catégorie...");
  
  try {
    // Créer le modèle
    this.categoryModel = tf.sequential();
    
    // Ajouter les couches
    this.categoryModel.add(tf.layers.dense({
      units: 256,
      activation: 'relu',
      inputShape: [this.categoryVocabulary.size]
    }));
    
    this.categoryModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    this.categoryModel.add(tf.layers.dense({
      units: 128,
      activation: 'relu'
    }));
    
    this.categoryModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.categoryModel.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.categoryModel.add(tf.layers.dense({
      units: this.allCategories.length,
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.categoryModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Générer des données d'entraînement
    const { xs, ys } = this._generateCategoryTrainingData();
    
    // Entraîner le modèle
    await this.categoryModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
          }
        }
      }
    });
    
    console.log("Modèle de catégorie entraîné avec succès");
  } catch (error) {
    console.error("Erreur lors de l'entraînement du modèle de catégorie:", error);
    throw error;
  }
};

/**
 * Génère des données d'entraînement pour le modèle de catégorie
 * @returns {Object} - Tenseurs d'entrée (xs) et de sortie (ys)
 */
enhancedTensorflowService._generateCategoryTrainingData = function() {
  const trainingData = [];
  const trainingLabels = [];
  
  // Catégories d'incidents
  const incidentCategories = [
    { name: 'incident_materiel', keywords: [...baseVocab.HARDWARE_VOCABULARY] },
    { name: 'incident_logiciel', keywords: [...baseVocab.SOFTWARE_VOCABULARY] },
    { name: 'incident_reseau', keywords: [...baseVocab.NETWORK_VOCABULARY] },
    { name: 'incident_securite', keywords: ['virus', 'malware', 'phishing', 'hacker', 'sécurité', 'attaque', 'compromis'] },
    { name: 'incident_autre', keywords: ['autre', 'divers', 'inconnu', 'général'] }
  ];
  
  // Catégories de demandes
  const requestCategories = [
    { name: 'demande_materiel', keywords: [...baseVocab.HARDWARE_VOCABULARY] },
    { name: 'demande_logiciel', keywords: [...baseVocab.SOFTWARE_VOCABULARY] },
    { name: 'demande_acces', keywords: ['accès', 'compte', 'mot de passe', 'login', 'connexion', 'permission', 'droit'] },
    { name: 'demande_information', keywords: ['information', 'aide', 'conseil', 'question', 'comment', 'procédure', 'documentation'] },
    { name: 'demande_autre', keywords: ['autre', 'divers', 'inconnu', 'général'] }
  ];
  
  // Générer des exemples pour chaque catégorie d'incident
  incidentCategories.forEach(category => {
    for (let i = 0; i < 200; i++) {
      // Mélanger des mots-clés de catégorie avec des mots-clés d'incident
      const numCategoryKeywords = Math.floor(Math.random() * 3) + 2; // 2 à 4 mots-clés
      const numIncidentKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
      
      const text = this._generateRandomText([
        ...category.keywords,
        ...baseVocab.INCIDENT_VOCABULARY.slice(0, 10),
        ...technicalVocab.PROBLEM_EXPRESSIONS.slice(0, 10)
      ], numCategoryKeywords + numIncidentKeywords);
      
      // Créer le vecteur one-hot pour la catégorie
      const label = Array(this.allCategories.length).fill(0);
      const categoryIndex = this.allCategories.indexOf(category.name);
      label[categoryIndex] = 1;
      
      // Ajouter aux données d'entraînement
      trainingData.push(this._textToFeatures(text, this.categoryVocabulary));
      trainingLabels.push(label);
    }
  });
  
  // Générer des exemples pour chaque catégorie de demande
  requestCategories.forEach(category => {
    for (let i = 0; i < 200; i++) {
      // Mélanger des mots-clés de catégorie avec des mots-clés de demande
      const numCategoryKeywords = Math.floor(Math.random() * 3) + 2; // 2 à 4 mots-clés
      const numRequestKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
      
      const text = this._generateRandomText([
        ...category.keywords,
        ...baseVocab.REQUEST_VOCABULARY.slice(0, 10),
        ...technicalVocab.REQUEST_EXPRESSIONS.slice(0, 10)
      ], numCategoryKeywords + numRequestKeywords);
      
      // Créer le vecteur one-hot pour la catégorie
      const label = Array(this.allCategories.length).fill(0);
      const categoryIndex = this.allCategories.indexOf(category.name);
      label[categoryIndex] = 1;
      
      // Ajouter aux données d'entraînement
      trainingData.push(this._textToFeatures(text, this.categoryVocabulary));
      trainingLabels.push(label);
    }
  });
  
  // Convertir en tenseurs
  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);
  
  return { xs, ys };
};

module.exports = enhancedTensorflowService;
