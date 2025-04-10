const axios = require('axios');
require('dotenv').config();

/**
 * Service avancé pour l'analyse et la classification automatique des tickets
 * en utilisant l'API OpenAI GPT-4 avec des capacités d'analyse contextuelle
 */
class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4'; // Utilisation de GPT-4 pour des capacités avancées
    this.systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de tickets informatiques pour un système GLPI.
    Tu dois analyser les demandes des utilisateurs et déterminer avec précision:
    - Le type de ticket (incident ou demande)
    - La catégorie appropriée
    - Le niveau d'urgence
    - Un titre pertinent et concis
    - Des suggestions de résolution
    
    Utilise ton expertise en support informatique pour comprendre le contexte, la gravité et l'impact des problèmes décrits.`;
  }

  /**
   * Analyse le texte pour déterminer le type de ticket (incident ou demande)
   * @param {string} title - Titre du ticket
   * @param {string} description - Description du ticket
   * @returns {Promise<Object>} - Type et catégorie du ticket
   */
  async classifyTicket(title, description) {
    try {
      // Si l'API key n'est pas configurée, utiliser une classification basique
      if (!this.apiKey) {
        console.log('OpenAI API key not configured, using basic classification');
        return this.basicClassification(title, description);
      }

      const prompt = `
        Analyse le texte suivant et détermine s'il s'agit d'un incident ou d'une demande.
        Puis, classe-le dans l'une des catégories suivantes:
        
        Pour les incidents:
        1. Incident - autre
        2. Incident - logiciel
        3. Incident - matériel
        4. Incident - Réseau
        5. Incident - sécurité
        
        Pour les demandes:
        1. Demande - Accès
        2. Demande - Autre
        3. Demande - Information
        4. Demande - logiciel
        5. Demande - Nouveau matériel
        
        Titre: ${title}
        Description: ${description}
        
        Réponds uniquement au format JSON comme ceci:
        {
          "type": "incident" ou "demande",
          "category": "nom de la catégorie exactement comme listé ci-dessus",
          "categoryId": numéro de la catégorie (1-5),
          "confidence": pourcentage de confiance (0-100)
        }
      `;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 150
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extraire et parser la réponse JSON
      const content = response.data.choices[0].message.content.trim();
      const result = JSON.parse(content);
      
      console.log('AI classification result:', result);
      return result;
    } catch (error) {
      console.error('Error in AI classification:', error.message);
      // En cas d'erreur, utiliser la classification basique comme fallback
      return this.basicClassification(title, description);
    }
  }

  /**
   * Classification basique basée sur des mots-clés
   * Utilisé comme fallback si l'API OpenAI n'est pas disponible
   */
  basicClassification(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    
    // Mots-clés pour les incidents
    const incidentKeywords = [
      'panne', 'erreur', 'bug', 'problème', 'ne fonctionne pas', 'cassé',
      'bloqué', 'plantage', 'crash', 'virus', 'malware', 'attaque'
    ];
    
    // Mots-clés pour les demandes
    const requestKeywords = [
      'demande', 'besoin', 'nouveau', 'installation', 'mise à jour',
      'accès', 'autorisation', 'information', 'comment', 'pourriez-vous'
    ];
    
    // Compter les occurrences de mots-clés
    let incidentCount = 0;
    let requestCount = 0;
    
    incidentKeywords.forEach(keyword => {
      if (text.includes(keyword)) incidentCount++;
    });
    
    requestKeywords.forEach(keyword => {
      if (text.includes(keyword)) requestCount++;
    });
    
    // Déterminer le type en fonction du nombre de mots-clés
    const type = incidentCount > requestCount ? 'incident' : 'demande';
    
    // Déterminer la catégorie en fonction des mots-clés spécifiques
    let category = '';
    let categoryId = 1;
    
    if (type === 'incident') {
      if (text.includes('logiciel') || text.includes('application') || text.includes('programme')) {
        category = 'Incident - logiciel';
        categoryId = 2;
      } else if (text.includes('matériel') || text.includes('ordinateur') || text.includes('imprimante')) {
        category = 'Incident - matériel';
        categoryId = 3;
      } else if (text.includes('réseau') || text.includes('internet') || text.includes('connexion')) {
        category = 'Incident - Réseau';
        categoryId = 4;
      } else if (text.includes('sécurité') || text.includes('virus') || text.includes('piratage')) {
        category = 'Incident - sécurité';
        categoryId = 5;
      } else {
        category = 'Incident - autre';
        categoryId = 1;
      }
    } else {
      if (text.includes('accès') || text.includes('compte') || text.includes('permission')) {
        category = 'Demande - Accès';
        categoryId = 1;
      } else if (text.includes('information') || text.includes('renseignement') || text.includes('comment')) {
        category = 'Demande - Information';
        categoryId = 3;
      } else if (text.includes('logiciel') || text.includes('application') || text.includes('installer')) {
        category = 'Demande - logiciel';
        categoryId = 4;
      } else if (text.includes('matériel') || text.includes('équipement') || text.includes('nouveau')) {
        category = 'Demande - Nouveau matériel';
        categoryId = 5;
      } else {
        category = 'Demande - Autre';
        categoryId = 2;
      }
    }
    
    return {
      type,
      category,
      categoryId,
      confidence: 70 // Confiance moyenne pour la classification basique
    };
  }

  /**
   * Analyse complète d'une demande de ticket avec GPT-4
   * @param {string} text - Texte complet de la demande
   * @returns {Promise<Object>} - Résultat complet de l'analyse (type, catégorie, urgence, titre, suggestions)
   */
  async analyzeTicketRequest(text) {
    try {
      // Si l'API key n'est pas configurée, utiliser le service d'IA locale
      if (!this.apiKey) {
        console.log('OpenAI API key not configured, using local AI service');
        return this.localAnalysis(text);
      }

      const prompt = `
        Analyse de manière approfondie le texte suivant qui décrit un problème ou une demande informatique.
        Détermine les informations suivantes avec précision:
        
        1. Type: "incident" (problème technique) ou "demande" (nouvelle fonctionnalité, accès, etc.)
        
        2. Catégorie (selon le type):
           - Pour les incidents: "Incident - Réseau", "Incident - Matériel", "Incident - Logiciel", "Incident - Sécurité", "Incident - Autre"
           - Pour les demandes: "Demande - Accès", "Demande - Matériel", "Demande - Logiciel", "Demande - Information", "Demande - Autre"
        
        3. Niveau d'urgence (1-5):
           - 1: Très haute (critique, bloquant pour l'entreprise)
           - 2: Haute (impact important sur plusieurs utilisateurs)
           - 3: Moyenne (impact modéré)
           - 4: Basse (peu d'impact)
           - 5: Très basse (amélioration mineure)
        
        4. Un titre court et descriptif pour le ticket (max 50 caractères)
        
        5. Suggestions de résolution: Propose 1-3 étapes initiales pour résoudre le problème ou traiter la demande
        
        6. Informations manquantes: Identifie les informations qui manquent et qui seraient utiles pour mieux traiter ce ticket
        
        7. Estimation de complexité: Évalue la complexité de résolution (simple, moyenne, complexe)
        
        Texte à analyser: "${text}"
        
        Réponds uniquement au format JSON comme ceci:
        {
          "type": "incident" ou "demande",
          "typeId": 1 pour incident, 2 pour demande,
          "category": "nom complet de la catégorie",
          "categoryId": ID de la catégorie,
          "urgency": niveau d'urgence (1-5),
          "title": "titre court et descriptif",
          "suggestions": ["suggestion 1", "suggestion 2", ...],
          "missingInfo": ["info manquante 1", "info manquante 2", ...],
          "complexity": "simple|moyenne|complexe"
        }
      `;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extraire et parser la réponse JSON
      const content = response.data.choices[0].message.content.trim();
      const result = JSON.parse(content);
      
      // Ajouter le nom de la catégorie pour l'affichage
      result.categoryName = result.category;
      
      console.log('AI ticket analysis result:', result);
      return result;
    } catch (error) {
      console.error('Error in AI ticket analysis:', error.message);
      // En cas d'erreur, utiliser l'analyse locale comme fallback
      return this.localAnalysis(text);
    }
  }

  /**
   * Génère une réponse personnalisée pour l'utilisateur en fonction de l'analyse du ticket
   * @param {Object} ticketData - Données du ticket analysé
   * @returns {Promise<string>} - Réponse personnalisée
   */
  async generatePersonalizedResponse(ticketData) {
    try {
      if (!this.apiKey) {
        return this.getDefaultResponse(ticketData);
      }

      const prompt = `
        En tant qu'agent de support informatique, génère une réponse personnalisée et empathique pour un utilisateur
        qui a soumis le ticket suivant:
        
        Type: ${ticketData.type === 'incident' ? 'Incident' : 'Demande'}
        Catégorie: ${ticketData.categoryName}
        Titre: ${ticketData.title}
        Description: ${ticketData.description}
        Urgence: ${ticketData.urgencyName || 'Non spécifiée'}
        
        Ta réponse doit:
        1. Être professionnelle mais chaleureuse
        2. Montrer que tu comprends le problème/la demande
        3. Donner une estimation du temps de traitement basée sur l'urgence
        4. Fournir des conseils initiaux si possible
        5. Demander des informations supplémentaires si nécessaire
      `;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating personalized response:', error.message);
      return this.getDefaultResponse(ticketData);
    }
  }

  /**
   * Obtient une réponse par défaut en cas d'échec de l'IA
   * @param {Object} ticketData - Données du ticket
   * @returns {string} - Réponse par défaut
   */
  getDefaultResponse(ticketData) {
    const urgencyEstimation = {
      '1': 'dès que possible (urgence très haute)',
      '2': 'rapidement (urgence haute)',
      '3': 'dans les meilleurs délais (urgence moyenne)',
      '4': 'prochainement (urgence basse)',
      '5': 'lorsque possible (urgence très basse)'
    };
    
    const estimation = urgencyEstimation[ticketData.urgency] || 'dans les meilleurs délais';
    
    return `Merci pour votre ${ticketData.type === 'incident' ? 'signalement d\'incident' : 'demande'}. 
    Votre ticket a été créé avec succès et sera traité ${estimation}. 
    Un technicien vous contactera pour plus d'informations si nécessaire.`;
  }

  /**
   * Analyse locale basée sur des mots-clés (sans API externe)
   * @param {string} text - Texte à analyser
   * @returns {Object} - Résultat de l'analyse
   */
  localAnalysis(text) {
    const lowerText = text.toLowerCase();
    
    // Déterminer le type (incident ou demande)
    const incidentKeywords = [
      'panne', 'erreur', 'bug', 'problème', 'ne fonctionne pas', 'cassé',
      'bloqué', 'plantage', 'crash', 'virus', 'malware', 'attaque'
    ];
    
    const requestKeywords = [
      'demande', 'besoin', 'nouveau', 'installation', 'mise à jour',
      'accès', 'autorisation', 'information', 'comment', 'pourriez-vous'
    ];
    
    let incidentCount = 0;
    let requestCount = 0;
    
    incidentKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) incidentCount++;
    });
    
    requestKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) requestCount++;
    });
    
    const type = incidentCount > requestCount ? 'incident' : 'demande';
    const typeId = type === 'incident' ? 1 : 2;
    
    // Déterminer la catégorie
    let category = '';
    let categoryId = 0;
    
    // Mapping des catégories vers les IDs selon GLPI
    const categoryMap = {
      'incident_reseau': { id: 6, name: 'Incident - Réseau' },
      'incident_materiel': { id: 7, name: 'Incident - Matériel' },
      'incident_logiciel': { id: 8, name: 'Incident - Logiciel' },
      'incident_securite': { id: 9, name: 'Incident - Sécurité' },
      'incident_autre': { id: 10, name: 'Incident - Autre' },
      'demande_acces': { id: 1, name: 'Demande - Accès' },
      'demande_materiel': { id: 2, name: 'Demande - Matériel' },
      'demande_logiciel': { id: 3, name: 'Demande - Logiciel' },
      'demande_information': { id: 4, name: 'Demande - Information' },
      'demande_autre': { id: 5, name: 'Demande - Autre' }
    };
    
    if (type === 'incident') {
      if (lowerText.includes('réseau') || lowerText.includes('internet') || lowerText.includes('connexion')) {
        category = 'incident_reseau';
      } else if (lowerText.includes('matériel') || lowerText.includes('ordinateur') || lowerText.includes('imprimante')) {
        category = 'incident_materiel';
      } else if (lowerText.includes('logiciel') || lowerText.includes('application') || lowerText.includes('programme')) {
        category = 'incident_logiciel';
      } else if (lowerText.includes('sécurité') || lowerText.includes('virus') || lowerText.includes('piratage')) {
        category = 'incident_securite';
      } else {
        category = 'incident_autre';
      }
    } else {
      if (lowerText.includes('accès') || lowerText.includes('compte') || lowerText.includes('permission')) {
        category = 'demande_acces';
      } else if (lowerText.includes('matériel') || lowerText.includes('équipement') || lowerText.includes('nouveau')) {
        category = 'demande_materiel';
      } else if (lowerText.includes('logiciel') || lowerText.includes('application') || lowerText.includes('installer')) {
        category = 'demande_logiciel';
      } else if (lowerText.includes('information') || lowerText.includes('renseignement') || lowerText.includes('comment')) {
        category = 'demande_information';
      } else {
        category = 'demande_autre';
      }
    }
    
    // Déterminer l'urgence (1-5)
    let urgency = 3; // Moyenne par défaut
    
    // Mots-clés pour les différents niveaux d'urgence
    const urgencyKeywords = {
      1: ['urgent', 'critique', 'immédiatement', 'grave', 'bloquant', 'impossible de travailler', 'production arrêtée'],
      2: ['important', 'prioritaire', 'rapidement', 'dès que possible', 'impact significatif', 'plusieurs utilisateurs'],
      4: ['basse', 'faible', 'quand vous aurez le temps', 'non urgent', 'peu important'],
      5: ['très faible', 'minimal', 'cosmétique', 'amélioration', 'suggestion', 'éventuel', 'plus tard']
    };
    
    // Vérifier les mots-clés d'urgence
    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          urgency = parseInt(level);
          break;
        }
      }
    }
    
    // Générer un titre (première phrase ou premiers mots)
    let title = text.split('.')[0].trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    // Suggestions basiques
    const suggestions = [];
    if (type === 'incident') {
      if (category === 'incident_logiciel') {
        suggestions.push("Redémarrer l'application concernée");
        suggestions.push("Vérifier les mises à jour disponibles");
      } else if (category === 'incident_materiel') {
        suggestions.push("Vérifier les connexions physiques");
        suggestions.push("Redémarrer l'équipement");
      } else if (category === 'incident_reseau') {
        suggestions.push("Vérifier la connexion réseau");
        suggestions.push("Redémarrer le routeur/modem");
      }
    }
    
    return {
      type,
      typeId,
      category: categoryMap[category].name,
      categoryName: categoryMap[category].name,
      categoryId: categoryMap[category].id,
      urgency,
      title,
      suggestions,
      missingInfo: ["Informations sur l'environnement", "Étapes pour reproduire"],
      complexity: "moyenne"
    };
  }
}

module.exports = new AIService();
