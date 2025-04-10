/**
 * Méthodes d'entraînement supplémentaires pour le service TensorFlow.js amélioré
 * Ce fichier étend enhancedTensorflowService.js avec des méthodes d'entraînement pour urgence, sentiment et complexité
 */

const tf = require('@tensorflow/tfjs-node');
const enhancedTensorflowService = require('./enhancedTensorflowService');
const baseVocab = require('../data/vocabularyBase');
const domainVocab = require('../data/vocabularyDomain');
const technicalVocab = require('../data/vocabularyTechnical');

/**
 * Crée et entraîne le modèle de prédiction d'urgence
 */
enhancedTensorflowService._createAndTrainUrgencyModel = async function() {
  console.log("Création et entraînement du modèle d'urgence...");
  
  try {
    // Créer le modèle
    this.urgencyModel = tf.sequential();
    
    // Ajouter les couches
    this.urgencyModel.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.urgencyVocabulary.size]
    }));
    
    this.urgencyModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    this.urgencyModel.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.urgencyModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.urgencyModel.add(tf.layers.dense({
      units: 5, // 5 niveaux d'urgence
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.urgencyModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Générer des données d'entraînement
    const { xs, ys } = this._generateUrgencyTrainingData();
    
    // Entraîner le modèle
    await this.urgencyModel.fit(xs, ys, {
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
    
    console.log("Modèle d'urgence entraîné avec succès");
  } catch (error) {
    console.error("Erreur lors de l'entraînement du modèle d'urgence:", error);
    throw error;
  }
};

/**
 * Génère des données d'entraînement pour le modèle d'urgence
 * @returns {Object} - Tenseurs d'entrée (xs) et de sortie (ys)
 */
enhancedTensorflowService._generateUrgencyTrainingData = function() {
  const trainingData = [];
  const trainingLabels = [];
  
  // Niveaux d'urgence
  const urgencyLevels = [
    { level: 1, name: 'très haute', keywords: [...baseVocab.URGENCY_VOCABULARY[1], ...(technicalVocab.URGENCY_EXPRESSIONS ? technicalVocab.URGENCY_EXPRESSIONS.slice(0, 15) : [])] },
    { level: 2, name: 'haute', keywords: [...baseVocab.URGENCY_VOCABULARY[2], ...(technicalVocab.URGENCY_EXPRESSIONS ? technicalVocab.URGENCY_EXPRESSIONS.slice(15, 30) : [])] },
    { level: 3, name: 'moyenne', keywords: [...baseVocab.URGENCY_VOCABULARY[3], ...(technicalVocab.URGENCY_EXPRESSIONS ? technicalVocab.URGENCY_EXPRESSIONS.slice(30, 35) : [])] },
    { level: 4, name: 'basse', keywords: [...baseVocab.URGENCY_VOCABULARY[4]] },
    { level: 5, name: 'très basse', keywords: [...baseVocab.URGENCY_VOCABULARY[5]] }
  ];
  
  // Générer des exemples pour chaque niveau d'urgence
  urgencyLevels.forEach(urgency => {
    // Plus d'exemples pour les niveaux moyens, moins pour les extrêmes
    const numExamples = urgency.level === 3 ? 300 : (urgency.level === 2 || urgency.level === 4 ? 250 : 200);
    
    for (let i = 0; i < numExamples; i++) {
      // Mélanger des mots-clés d'urgence avec d'autres vocabulaires
      const numUrgencyKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
      const text = this._generateRandomText(urgency.keywords, numUrgencyKeywords);
      
      // Créer le vecteur one-hot pour le niveau d'urgence
      const label = Array(5).fill(0);
      label[urgency.level - 1] = 1;
      
      // Ajouter aux données d'entraînement
      trainingData.push(this._textToFeatures(text, this.urgencyVocabulary));
      trainingLabels.push(label);
    }
  });
  
  // Convertir en tenseurs
  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);
  
  return { xs, ys };
};

/**
 * Crée et entraîne le modèle de sentiment
 */
enhancedTensorflowService._createAndTrainSentimentModel = async function() {
  console.log("Création et entraînement du modèle de sentiment...");
  
  try {
    // Créer le modèle
    this.sentimentModel = tf.sequential();
    
    // Ajouter les couches
    this.sentimentModel.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.sentimentVocabulary.size]
    }));
    
    this.sentimentModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    this.sentimentModel.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.sentimentModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.sentimentModel.add(tf.layers.dense({
      units: 3, // négatif, neutre, positif
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.sentimentModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Générer des données d'entraînement
    const { xs, ys } = this._generateSentimentTrainingData();
    
    // Entraîner le modèle
    await this.sentimentModel.fit(xs, ys, {
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
    
    console.log("Modèle de sentiment entraîné avec succès");
  } catch (error) {
    console.error("Erreur lors de l'entraînement du modèle de sentiment:", error);
    throw error;
  }
};

/**
 * Génère des données d'entraînement pour le modèle de sentiment
 * @returns {Object} - Tenseurs d'entrée (xs) et de sortie (ys)
 */
enhancedTensorflowService._generateSentimentTrainingData = function() {
  const trainingData = [];
  const trainingLabels = [];
  
  // Expressions de sentiment
  const sentimentExpressions = technicalVocab.SENTIMENT_EXPRESSIONS;
  
  // Expressions positives (indices 0-19)
  const positiveExpressions = sentimentExpressions.slice(0, 20);
  
  // Expressions négatives (indices 20-39)
  const negativeExpressions = sentimentExpressions.slice(20, 40);
  
  // Expressions neutres (combinaison de salutations et autres expressions neutres)
  const neutralExpressions = [
    ...technicalVocab.GREETING_EXPRESSIONS.slice(0, 20),
    ...technicalVocab.FOLLOW_UP_EXPRESSIONS.slice(0, 10)
  ];
  
  // Générer des exemples positifs
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(positiveExpressions, numKeywords);
    
    trainingData.push(this._textToFeatures(text, this.sentimentVocabulary));
    trainingLabels.push([0, 0, 1]); // [négatif, neutre, positif]
  }
  
  // Générer des exemples négatifs
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(negativeExpressions, numKeywords);
    
    trainingData.push(this._textToFeatures(text, this.sentimentVocabulary));
    trainingLabels.push([1, 0, 0]); // [négatif, neutre, positif]
  }
  
  // Générer des exemples neutres
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(neutralExpressions, numKeywords);
    
    trainingData.push(this._textToFeatures(text, this.sentimentVocabulary));
    trainingLabels.push([0, 1, 0]); // [négatif, neutre, positif]
  }
  
  // Convertir en tenseurs
  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);
  
  return { xs, ys };
};

/**
 * Crée et entraîne le modèle de complexité
 */
enhancedTensorflowService._createAndTrainComplexityModel = async function() {
  console.log("Création et entraînement du modèle de complexité...");
  
  try {
    // Créer le modèle
    this.complexityModel = tf.sequential();
    
    // Ajouter les couches
    this.complexityModel.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.vocabulary.size]
    }));
    
    this.complexityModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    this.complexityModel.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.complexityModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.complexityModel.add(tf.layers.dense({
      units: 3, // simple, modéré, complexe
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.complexityModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Générer des données d'entraînement
    const { xs, ys } = this._generateComplexityTrainingData();
    
    // Entraîner le modèle
    await this.complexityModel.fit(xs, ys, {
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
    
    console.log("Modèle de complexité entraîné avec succès");
  } catch (error) {
    console.error("Erreur lors de l'entraînement du modèle de complexité:", error);
    throw error;
  }
};

/**
 * Génère des données d'entraînement pour le modèle de complexité
 * @returns {Object} - Tenseurs d'entrée (xs) et de sortie (ys)
 */
enhancedTensorflowService._generateComplexityTrainingData = function() {
  const trainingData = [];
  const trainingLabels = [];
  
  // Mots-clés de complexité
  const simpleKeywords = [
    'simple', 'facile', 'basique', 'élémentaire', 'rapide', 'direct',
    'réinitialiser', 'redémarrer', 'relancer', 'activer', 'désactiver',
    'mot de passe', 'identifiant', 'compte', 'accès', 'connexion'
  ];
  
  const moderateKeywords = [
    'configuration', 'paramétrage', 'mise à jour', 'installation', 'migration',
    'synchronisation', 'sauvegarde', 'restauration', 'récupération',
    'performance', 'optimisation', 'ralentissement', 'lenteur'
  ];
  
  const complexKeywords = [
    'complexe', 'difficile', 'critique', 'urgent', 'grave', 'sérieux',
    'corruption', 'perte de données', 'crash', 'plantage', 'écran bleu',
    'sécurité', 'virus', 'malware', 'ransomware', 'phishing',
    'réseau', 'connectivité', 'infrastructure', 'serveur', 'base de données'
  ];
  
  // Générer des exemples simples
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(simpleKeywords, numKeywords);
    
    trainingData.push(this._textToFeatures(text));
    trainingLabels.push([1, 0, 0]); // [simple, modéré, complexe]
  }
  
  // Générer des exemples modérés
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(moderateKeywords, numKeywords);
    
    trainingData.push(this._textToFeatures(text));
    trainingLabels.push([0, 1, 0]); // [simple, modéré, complexe]
  }
  
  // Générer des exemples complexes
  for (let i = 0; i < 300; i++) {
    const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
    const text = this._generateRandomText(complexKeywords, numKeywords);
    
    trainingData.push(this._textToFeatures(text));
    trainingLabels.push([0, 0, 1]); // [simple, modéré, complexe]
  }
  
  // Convertir en tenseurs
  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);
  
  return { xs, ys };
};

// Exporter le service
module.exports = enhancedTensorflowService;
