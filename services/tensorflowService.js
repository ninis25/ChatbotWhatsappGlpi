/**
 * Service TensorFlow.js pour l'analyse avancée des tickets
 * Utilise des réseaux de neurones pour améliorer la classification
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { WordTokenizer, PorterStemmerFr } = natural;
const tokenizer = new WordTokenizer();

// Mots-clés pour la classification (repris du service existant)
const INCIDENT_KEYWORDS = [
  'problème', 'incident', 'panne', 'erreur', 'bug', 'dysfonctionnement', 'ne fonctionne pas',
  'ne marche pas', 'cassé', 'bloqué', 'planté', 'écran bleu', 'bsod', 'crash', 'freeze',
  'gelé', 'lent', 'lenteur'
];

const REQUEST_KEYWORDS = [
  'demande', 'requête', 'besoin', 'nouveau', 'nouvelle', 'installer', 'installation',
  'configurer', 'configuration', 'créer', 'création', 'ajouter', 'ajout', 'mise à jour',
  'mettre à jour', 'changer', 'changement', 'modifier', 'modification'
];

// Catégories pour la classification
const CATEGORIES = {
  // Incidents
  'incident_autre': ['autre', 'divers', 'inconnu'],
  'incident_logiciel': ['logiciel', 'application', 'programme', 'software', 'windows', 'office', 'excel', 'word', 'outlook', 'email', 'mail', 'navigateur', 'browser', 'chrome', 'firefox', 'edge', 'internet'],
  'incident_materiel': ['matériel', 'hardware', 'ordinateur', 'pc', 'laptop', 'écran', 'clavier', 'souris', 'imprimante', 'scanner', 'téléphone', 'batterie', 'chargeur', 'alimentation', 'disque dur', 'mémoire', 'ram'],
  'incident_reseau': ['réseau', 'network', 'internet', 'wifi', 'connexion', 'déconnexion', 'lent', 'intranet', 'serveur', 'vpn', 'proxy', 'dns', 'ip', 'ethernet', 'routeur', 'switch', 'firewall'],
  'incident_securite': ['sécurité', 'virus', 'malware', 'ransomware', 'phishing', 'hameçonnage', 'spam', 'piratage', 'hack', 'compromis', 'suspect', 'accès non autorisé', 'mot de passe', 'authentification'],
  
  // Demandes
  'demande_acces': ['accès', 'autorisation', 'permission', 'droit', 'compte', 'identifiant', 'login', 'mot de passe', 'réinitialisation', 'débloquer', 'verrouillé'],
  'demande_autre': ['autre', 'divers', 'spécifique', 'particulier'],
  'demande_information': ['information', 'renseignement', 'question', 'comment', 'procédure', 'documentation', 'guide', 'manuel', 'formation', 'aide', 'assistance', 'conseil'],
  'demande_logiciel': ['logiciel', 'application', 'programme', 'software', 'installation', 'mise à jour', 'update', 'version', 'licence', 'license', 'abonnement', 'office', 'windows'],
  'demande_materiel': ['matériel', 'hardware', 'équipement', 'ordinateur', 'pc', 'laptop', 'écran', 'clavier', 'souris', 'imprimante', 'scanner', 'téléphone', 'mobile', 'smartphone', 'tablette', 'casque', 'accessoire']
};

// Mots-clés pour l'urgence
const URGENCY_KEYWORDS = {
  1: ['urgent', 'critique', 'immédiatement', 'grave', 'bloquant', 'impossible de travailler', 'production arrêtée', 'sécurité compromise'],
  2: ['important', 'prioritaire', 'rapidement', 'dès que possible', 'impact significatif', 'plusieurs utilisateurs', 'service dégradé'],
  3: ['normal', 'standard', 'régulier', 'dès que possible', 'gênant', 'un utilisateur'],
  4: ['basse', 'faible', 'quand vous aurez le temps', 'non urgent', 'peu important', 'amélioration'],
  5: ['très faible', 'minimal', 'cosmétique', 'amélioration', 'suggestion', 'éventuel', 'plus tard']
};

// Classe pour le service TensorFlow
class TensorflowService {
  constructor() {
    this.typeModel = null;
    this.categoryModel = null;
    this.urgencyModel = null;
    this.vocabulary = new Set();
    this.categoryVocabulary = new Set();
    this.urgencyVocabulary = new Set();
    this.allCategories = Object.keys(CATEGORIES);
    this.isInitialized = false;
    
    // Construire le vocabulaire
    this._buildVocabulary();
  }

  /**
   * Initialise les modèles TensorFlow
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log("Initialisation des modèles TensorFlow...");
    
    try {
      // Créer et entraîner les modèles
      await this._createAndTrainTypeModel();
      await this._createAndTrainCategoryModel();
      await this._createAndTrainUrgencyModel();
      
      this.isInitialized = true;
      console.log("Modèles TensorFlow initialisés avec succès!");
    } catch (error) {
      console.error("Erreur lors de l'initialisation des modèles TensorFlow:", error);
      throw error;
    }
  }

  /**
   * Construit le vocabulaire à partir des mots-clés
   */
  _buildVocabulary() {
    // Vocabulaire pour le type (incident/demande)
    [...INCIDENT_KEYWORDS, ...REQUEST_KEYWORDS].forEach(word => {
      const tokens = tokenizer.tokenize(word.toLowerCase());
      tokens.forEach(token => this.vocabulary.add(PorterStemmerFr.stem(token)));
    });
    
    // Vocabulaire pour les catégories
    Object.values(CATEGORIES).forEach(keywords => {
      keywords.forEach(word => {
        const tokens = tokenizer.tokenize(word.toLowerCase());
        tokens.forEach(token => {
          const stemmed = PorterStemmerFr.stem(token);
          this.vocabulary.add(stemmed);
          this.categoryVocabulary.add(stemmed);
        });
      });
    });
    
    // Vocabulaire pour l'urgence
    Object.values(URGENCY_KEYWORDS).forEach(keywords => {
      keywords.forEach(word => {
        const tokens = tokenizer.tokenize(word.toLowerCase());
        tokens.forEach(token => {
          const stemmed = PorterStemmerFr.stem(token);
          this.vocabulary.add(stemmed);
          this.urgencyVocabulary.add(stemmed);
        });
      });
    });
    
    console.log(`Vocabulaire construit: ${this.vocabulary.size} mots`);
  }

  /**
   * Crée et entraîne le modèle de classification de type (incident/demande)
   */
  async _createAndTrainTypeModel() {
    // Créer des données d'entraînement synthétiques
    const trainingData = [];
    const trainingLabels = [];
    
    // Exemples d'incidents
    for (let i = 0; i < 100; i++) {
      const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
      const text = this._generateRandomText(INCIDENT_KEYWORDS, numKeywords);
      trainingData.push(this._textToFeatures(text));
      trainingLabels.push([1, 0]); // [incident, demande]
    }
    
    // Exemples de demandes
    for (let i = 0; i < 100; i++) {
      const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
      const text = this._generateRandomText(REQUEST_KEYWORDS, numKeywords);
      trainingData.push(this._textToFeatures(text));
      trainingLabels.push([0, 1]); // [incident, demande]
    }
    
    // Convertir en tenseurs
    const xs = tf.tensor2d(trainingData);
    const ys = tf.tensor2d(trainingLabels);
    
    // Créer le modèle
    this.typeModel = tf.sequential();
    this.typeModel.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
      inputShape: [this.vocabulary.size]
    }));
    this.typeModel.add(tf.layers.dense({
      units: 2,
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.typeModel.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Entraîner le modèle
    await this.typeModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });
    
    console.log("Modèle de classification de type entraîné");
  }

  /**
   * Crée et entraîne le modèle de classification de catégorie
   */
  async _createAndTrainCategoryModel() {
    // Créer des données d'entraînement synthétiques
    const trainingData = [];
    const trainingLabels = [];
    
    // Pour chaque catégorie
    this.allCategories.forEach((category, categoryIndex) => {
      const keywords = CATEGORIES[category];
      
      // Générer 20 exemples par catégorie
      for (let i = 0; i < 20; i++) {
        const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
        const text = this._generateRandomText(keywords, numKeywords);
        trainingData.push(this._textToFeatures(text, this.categoryVocabulary));
        
        // Créer un vecteur one-hot pour la catégorie
        const label = Array(this.allCategories.length).fill(0);
        label[categoryIndex] = 1;
        trainingLabels.push(label);
      }
    });
    
    // Convertir en tenseurs
    const xs = tf.tensor2d(trainingData);
    const ys = tf.tensor2d(trainingLabels);
    
    // Créer le modèle
    this.categoryModel = tf.sequential();
    this.categoryModel.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [this.categoryVocabulary.size]
    }));
    this.categoryModel.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    this.categoryModel.add(tf.layers.dense({
      units: this.allCategories.length,
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.categoryModel.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Entraîner le modèle
    await this.categoryModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });
    
    console.log("Modèle de classification de catégorie entraîné");
  }

  /**
   * Crée et entraîne le modèle de classification d'urgence
   */
  async _createAndTrainUrgencyModel() {
    // Créer des données d'entraînement synthétiques
    const trainingData = [];
    const trainingLabels = [];
    
    // Pour chaque niveau d'urgence (1 à 5)
    for (let urgency = 1; urgency <= 5; urgency++) {
      const keywords = URGENCY_KEYWORDS[urgency];
      
      // Générer 20 exemples par niveau d'urgence
      for (let i = 0; i < 20; i++) {
        const numKeywords = Math.floor(Math.random() * 3) + 1; // 1 à 3 mots-clés
        const text = this._generateRandomText(keywords, numKeywords);
        trainingData.push(this._textToFeatures(text, this.urgencyVocabulary));
        
        // Créer un vecteur one-hot pour l'urgence
        const label = Array(5).fill(0);
        label[urgency - 1] = 1;
        trainingLabels.push(label);
      }
    }
    
    // Convertir en tenseurs
    const xs = tf.tensor2d(trainingData);
    const ys = tf.tensor2d(trainingLabels);
    
    // Créer le modèle
    this.urgencyModel = tf.sequential();
    this.urgencyModel.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
      inputShape: [this.urgencyVocabulary.size]
    }));
    this.urgencyModel.add(tf.layers.dense({
      units: 5,
      activation: 'softmax'
    }));
    
    // Compiler le modèle
    this.urgencyModel.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Entraîner le modèle
    await this.urgencyModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });
    
    console.log("Modèle de classification d'urgence entraîné");
  }

  /**
   * Génère un texte aléatoire à partir d'une liste de mots-clés
   * @param {string[]} keywords - Liste de mots-clés
   * @param {number} numKeywords - Nombre de mots-clés à inclure
   * @returns {string} - Texte généré
   */
  _generateRandomText(keywords, numKeywords) {
    const selectedKeywords = [];
    const fillerWords = ['je', 'vous', 'il', 'elle', 'nous', 'ils', 'le', 'la', 'les', 'un', 'une', 'des', 'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'votre', 'vos', 'son', 'sa', 'ses', 'notre', 'nos', 'leur', 'leurs', 'avec', 'sans', 'pour', 'par', 'en', 'dans', 'sur', 'sous', 'avant', 'après', 'pendant', 'depuis', 'jusqu\'à', 'vers', 'chez', 'entre', 'parmi', 'selon', 'malgré', 'sauf', 'excepté', 'outre', 'hormis', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'quand', 'comme', 'si', 'que', 'qui', 'dont', 'où', 'comment', 'pourquoi', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'lequel', 'laquelle', 'lesquels', 'lesquelles', 'duquel', 'de', 'laquelle', 'desquels', 'desquelles', 'auquel', 'à', 'laquelle', 'auxquels', 'auxquelles'];
    
    // Sélectionner des mots-clés aléatoires
    for (let i = 0; i < numKeywords; i++) {
      const randomIndex = Math.floor(Math.random() * keywords.length);
      selectedKeywords.push(keywords[randomIndex]);
    }
    
    // Ajouter des mots de remplissage
    const numFillerWords = Math.floor(Math.random() * 10) + 5; // 5 à 15 mots de remplissage
    const fillerWordsToAdd = [];
    for (let i = 0; i < numFillerWords; i++) {
      const randomIndex = Math.floor(Math.random() * fillerWords.length);
      fillerWordsToAdd.push(fillerWords[randomIndex]);
    }
    
    // Mélanger les mots-clés et les mots de remplissage
    const allWords = [...selectedKeywords, ...fillerWordsToAdd];
    for (let i = allWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
    }
    
    return allWords.join(' ');
  }

  /**
   * Convertit un texte en vecteur de caractéristiques (bag of words)
   * @param {string} text - Texte à convertir
   * @param {Set} vocabToUse - Vocabulaire à utiliser (par défaut: vocabulaire complet)
   * @returns {number[]} - Vecteur de caractéristiques
   */
  _textToFeatures(text, vocabToUse = this.vocabulary) {
    const features = Array(vocabToUse.size).fill(0);
    const vocabArray = Array.from(vocabToUse);
    
    // Tokeniser et stemmer le texte
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stemmedTokens = tokens.map(token => PorterStemmerFr.stem(token));
    
    // Compter les occurrences de chaque mot du vocabulaire
    stemmedTokens.forEach(token => {
      const index = vocabArray.indexOf(token);
      if (index !== -1) {
        features[index] += 1;
      }
    });
    
    return features;
  }

  /**
   * Prédit le type de ticket (incident ou demande)
   * @param {string} text - Texte à analyser
   * @returns {Object} - Résultat de la prédiction {type, typeId, confidence}
   */
  async predictTicketType(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const features = this._textToFeatures(text);
    const prediction = await this.typeModel.predict(tf.tensor2d([features])).array();
    const [incidentProb, requestProb] = prediction[0];
    
    const type = incidentProb > requestProb ? 'incident' : 'demande';
    const confidence = type === 'incident' ? incidentProb : requestProb;
    
    return {
      type,
      typeId: type === 'incident' ? 1 : 2,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }

  /**
   * Prédit la catégorie d'un ticket
   * @param {string} text - Texte à analyser
   * @param {string} type - Type de ticket (incident ou demande)
   * @returns {Object} - Résultat de la prédiction {category, categoryId, confidence}
   */
  async predictTicketCategory(text, type) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const features = this._textToFeatures(text, this.categoryVocabulary);
    const prediction = await this.categoryModel.predict(tf.tensor2d([features])).array();
    const probabilities = prediction[0];
    
    // Filtrer les catégories en fonction du type
    const relevantCategories = this.allCategories.filter(category => 
      type === 'incident' ? category.startsWith('incident_') : category.startsWith('demande_')
    );
    
    // Trouver la catégorie avec la plus haute probabilité
    let bestCategory = relevantCategories[0];
    let highestProb = 0;
    
    relevantCategories.forEach(category => {
      const index = this.allCategories.indexOf(category);
      if (probabilities[index] > highestProb) {
        highestProb = probabilities[index];
        bestCategory = category;
      }
    });
    
    // Mapping des catégories vers les IDs (mis à jour selon l'image)
    const categoryMap = {
      'incident_autre': 10,       // Incident - autre
      'incident_logiciel': 8,     // Incident - logiciel
      'incident_materiel': 7,     // Incident - matériel
      'incident_reseau': 6,       // Incident - Réseau
      'incident_securite': 9,     // Incident - sécurité
      'demande_acces': 1,         // Demande - Accès
      'demande_autre': 5,         // Demande - Autre
      'demande_information': 4,   // Demande - Information
      'demande_logiciel': 3,      // Demande - logiciel
      'demande_materiel': 2       // Demande - Nouveau matériel
    };
    
    return {
      category: bestCategory,
      categoryId: categoryMap[bestCategory],
      confidence: parseFloat(highestProb.toFixed(2))
    };
  }

  /**
   * Prédit le niveau d'urgence d'un ticket
   * @param {string} text - Texte à analyser
   * @returns {Object} - Résultat de la prédiction {urgency, confidence}
   */
  async predictUrgency(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const features = this._textToFeatures(text, this.urgencyVocabulary);
    const prediction = await this.urgencyModel.predict(tf.tensor2d([features])).array();
    const probabilities = prediction[0];
    
    // Trouver l'urgence avec la plus haute probabilité
    let highestProb = 0;
    let bestUrgency = 3; // Par défaut: urgence moyenne
    
    probabilities.forEach((prob, index) => {
      if (prob > highestProb) {
        highestProb = prob;
        bestUrgency = index + 1; // Les urgences sont de 1 à 5
      }
    });
    
    return {
      urgency: bestUrgency,
      confidence: parseFloat(highestProb.toFixed(2))
    };
  }

  /**
   * Analyse complète d'un ticket (type, catégorie, urgence)
   * @param {string} text - Texte à analyser
   * @returns {Object} - Résultat complet de l'analyse
   */
  async analyzeTicket(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const typeResult = await this.predictTicketType(text);
    const categoryResult = await this.predictTicketCategory(text, typeResult.type);
    const urgencyResult = await this.predictUrgency(text);
    
    // Extraire un titre potentiel (première phrase ou premiers mots)
    let title = text.split('.')[0].trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return {
      type: typeResult.type,
      typeId: typeResult.typeId,
      typeConfidence: typeResult.confidence,
      category: categoryResult.category,
      categoryId: categoryResult.categoryId,
      categoryConfidence: categoryResult.confidence,
      urgency: urgencyResult.urgency,
      urgencyConfidence: urgencyResult.confidence,
      suggestedTitle: title,
      originalText: text
    };
  }
}

// Exporter une instance du service
const tensorflowService = new TensorflowService();
module.exports = tensorflowService;
