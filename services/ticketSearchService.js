/**
 * Service de recherche avancée de tickets GLPI
 * Permet de rechercher des tickets selon différents critères et de formater les résultats
 */

const glpiService = require('./glpiService');

const ticketSearchService = {
  /**
   * Rechercher des tickets selon différents critères
   * @param {Object} criteria - Critères de recherche
   * @returns {Promise<Array>} - Liste des tickets correspondants
   */
  searchTickets: async (criteria) => {
    try {
      return await glpiService.searchTickets(criteria);
    } catch (error) {
      console.error('Erreur lors de la recherche de tickets:', error);
      throw new Error('Impossible de rechercher des tickets');
    }
  },
  
  /**
   * Formater les résultats de recherche pour l'affichage dans WhatsApp
   * @param {Array} tickets - Liste des tickets trouvés
   * @param {string} [keyword] - Mot-clé utilisé pour la recherche
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatSearchResults: (tickets, keyword = null) => {
    if (!tickets || tickets.length === 0) {
      if (keyword) {
        return `🔍 Aucun ticket trouvé pour la recherche "${keyword}".`;
      }
      return "🔍 Aucun ticket ne correspond à vos critères de recherche.";
    }
    
    let message = "";
    
    if (keyword) {
      message += `🔍 *Résultats pour "${keyword}"*\n\n`;
    } else {
      message += `🔍 *Résultats de recherche*\n\n`;
    }
    
    message += `${tickets.length} ticket(s) trouvé(s):\n\n`;
    
    tickets.forEach((ticket, index) => {
      message += `*#${ticket.id}* - ${ticket.title}\n`;
      message += `📋 Type: ${glpiService.getTicketTypeName(ticket.type)}\n`;
      message += `🚦 Statut: ${glpiService.getTicketStatusName(ticket.status)}\n`;
      message += `🔥 Urgence: ${glpiService.getUrgencyName(ticket.urgency)}\n`;
      
      // Ajouter la date de création formatée
      if (ticket.dateCreation) {
        const date = new Date(ticket.dateCreation);
        message += `📅 Créé le: ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR')}\n`;
      }
      
      // Ajouter un séparateur entre les tickets
      if (index < tickets.length - 1) {
        message += "\n-------------------\n\n";
      }
    });
    
    return message;
  },
  
  /**
   * Formater un message pour demander les critères de recherche
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatSearchCriteriaPrompt: () => {
    return `🔍 *Recherche avancée de tickets*\n\n` +
      `Veuillez spécifier vos critères de recherche:\n\n` +
      `1️⃣ Pour rechercher par mot-clé, envoyez:\n` +
      `   *mot:* suivi de votre mot-clé\n\n` +
      `2️⃣ Pour filtrer par statut, envoyez:\n` +
      `   *statut:* suivi du numéro de statut (1-6)\n\n` +
      `3️⃣ Pour filtrer par type, envoyez:\n` +
      `   *type:* suivi du type (1=incident, 2=demande)\n\n` +
      `4️⃣ Pour filtrer par urgence, envoyez:\n` +
      `   *urgence:* suivi du niveau d'urgence (1-5)\n\n` +
      `5️⃣ Pour combiner plusieurs critères, séparez-les par des espaces.\n\n` +
      `Exemples:\n` +
      `- "mot:imprimante"\n` +
      `- "statut:2 type:1"\n` +
      `- "mot:réseau urgence:3"\n\n` +
      `Envoyez *annuler* pour revenir au menu principal.`;
  },
  
  /**
   * Analyser les critères de recherche à partir du texte de l'utilisateur
   * @param {string} text - Texte de l'utilisateur
   * @returns {Object} - Critères de recherche formatés
   */
  parseCriteria: (text) => {
    const criteria = {};
    
    // Rechercher les différents critères dans le texte
    const keywordMatch = text.match(/mot:([^\s]+)/i);
    if (keywordMatch && keywordMatch[1]) {
      criteria.keyword = keywordMatch[1];
    }
    
    const statusMatch = text.match(/statut:(\d+)/i);
    if (statusMatch && statusMatch[1]) {
      criteria.status = parseInt(statusMatch[1]);
    }
    
    const typeMatch = text.match(/type:(\d+)/i);
    if (typeMatch && typeMatch[1]) {
      criteria.type = parseInt(typeMatch[1]);
    }
    
    const urgencyMatch = text.match(/urgence:(\d+)/i);
    if (urgencyMatch && urgencyMatch[1]) {
      criteria.urgency = parseInt(urgencyMatch[1]);
    }
    
    const categoryMatch = text.match(/categorie:(\d+)/i);
    if (categoryMatch && categoryMatch[1]) {
      criteria.category = parseInt(categoryMatch[1]);
    }
    
    // Si aucun critère n'est spécifié mais qu'il y a du texte, considérer comme mot-clé
    if (Object.keys(criteria).length === 0 && text.trim() && !text.match(/^annuler$/i)) {
      criteria.keyword = text.trim();
    }
    
    return criteria;
  }
};

module.exports = ticketSearchService;
