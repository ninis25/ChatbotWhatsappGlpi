const axios = require('axios');

// GLPI API service
const glpiService = {
  // Store the session token
  sessionToken: null,
  
  /**
   * Initialize a session with GLPI API
   * @returns {Promise<string>} - Session token
   */
  initSession: async () => {
    try {
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/initSession`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user_token ${process.env.GLPI_USER_TOKEN}`,
          'App-Token': process.env.GLPI_APP_TOKEN
        }
      });
      
      glpiService.sessionToken = response.data.session_token;
      console.log('GLPI session initialized');
      return glpiService.sessionToken;
    } catch (error) {
      console.error('Error initializing GLPI session:', error.response?.data || error.message);
      throw new Error('Failed to initialize GLPI session');
    }
  },
  
  /**
   * Kill the current GLPI session
   * @returns {Promise} - Response from GLPI API
   */
  killSession: async () => {
    if (!glpiService.sessionToken) {
      return;
    }
    
    try {
      await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/killSession`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        }
      });
      
      glpiService.sessionToken = null;
      console.log('GLPI session killed');
    } catch (error) {
      console.error('Error killing GLPI session:', error.response?.data || error.message);
    }
  },
  
  /**
   * Créer un ticket dans GLPI
   * @param {Object} ticketData - Données du ticket
   * @returns {Promise<Object>} - Informations sur le ticket créé
   */
  createTicket: async (ticketData) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Map request type to GLPI type
      const type = ticketData.type || (ticketData.requestType === 'incident' ? 1 : 2); // 1 for incident, 2 for request
      
      // Prepare ticket data - GLPI attend un tableau "input"
      const ticketPayload = {
        input: {
          name: ticketData.title || ticketData.name,
          content: ticketData.description || ticketData.content,
          type: type,
          urgency: ticketData.urgency || 3, // Default to medium if not specified
          status: 1, // New
          entities_id: 0, // Root entity
          itilcategories_id: ticketData.itilcategories_id || ticketData.category || 0 // Utiliser la catégorie avec l'ID correct
        }
      };
      
      console.log('Creating GLPI ticket with data:', JSON.stringify(ticketPayload, null, 2));
      console.log('Using API URL:', process.env.GLPI_API_URL);
      
      // Create the ticket
      const response = await axios({
        method: 'POST',
        url: `${process.env.GLPI_API_URL}/Ticket`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        data: ticketPayload
      });
      
      // Kill the session after creating the ticket
      await glpiService.killSession();
      
      // Récupérer l'ID du ticket créé
      const ticketId = response.data.id || response.data;
      
      console.log('Ticket created successfully:', response.data);
      
      // Retourner les informations du ticket
      return {
        id: ticketId,
        title: ticketData.title || ticketData.name,
        type: type,
        urgency: ticketData.urgency || 3,
        status: 1
      };
    } catch (error) {
      console.error('Error creating GLPI ticket:');
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      // Kill the session if it exists
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error(`Failed to create GLPI ticket: ${error.message}`);
    }
  },
  
  /**
   * Get a ticket from GLPI by ID
   * @param {number} ticketId - ID of the ticket to get
   * @returns {Promise<Object>} - Ticket data
   */
  getTicket: async (ticketId) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Get the ticket
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/Ticket/${ticketId}`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        }
      });
      
      // Kill the session after getting the ticket
      await glpiService.killSession();
      
      return response.data;
    } catch (error) {
      console.error('Error getting GLPI ticket:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      await glpiService.killSession();
      
      throw new Error('Failed to get GLPI ticket');
    }
  },
  
  /**
   * Récupérer les suivis (commentaires) d'un ticket
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<Array>} - Liste des suivis
   */
  getTicketFollowups: async (ticketId) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Récupérer les suivis
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/Ticket/${ticketId}/ITILFollowup`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        }
      });
      
      // Kill the session after getting followups
      await glpiService.killSession();
      
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la récupération des suivis du ticket ${ticketId}:`, error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error(`Impossible de récupérer les suivis du ticket ${ticketId}`);
    }
  },
  
  /**
   * Get ticket status name from status ID
   * @param {number} statusId - Status ID
   * @returns {string} - Status name
   */
  getTicketStatusName: (statusId) => {
    const statuses = {
      1: "Nouveau",
      2: "En cours (attribué)",
      3: "En cours (planifié)",
      4: "En attente",
      5: "Résolu",
      6: "Clos"
    };
    
    return statuses[statusId] || "Inconnu";
  },
  
  /**
   * Récupère la liste des groupes disponibles
   * @returns {Promise<Array>} - Liste des groupes
   */
  getGroups: async () => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Get the groups
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/Group`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        params: {
          range: '0-50' // Limiter à 50 groupes pour éviter des listes trop longues
        }
      });
      
      // Format the groups
      const groups = Array.isArray(response.data) 
        ? response.data.map(group => ({
            id: group.id,
            name: group.name || `Groupe #${group.id}`
          }))
        : [];
      
      return groups;
    } catch (error) {
      console.error('Erreur lors de la récupération des groupes:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error('Impossible de récupérer la liste des groupes');
    }
  },
  
  /**
   * Récupère la liste des techniciens disponibles
   * @returns {Promise<Array>} - Liste des techniciens
   */
  getTechnicians: async () => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Get the technicians (users with tech profile)
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/User`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        params: {
          range: '0-50', // Limiter à 50 techniciens pour éviter des listes trop longues
          is_active: 1   // Seulement les utilisateurs actifs
        }
      });
      
      // Format the technicians
      const technicians = Array.isArray(response.data) 
        ? response.data.map(user => ({
            id: user.id,
            name: `${user.firstname || ''} ${user.realname || ''}`.trim() || `Technicien #${user.id}`
          }))
        : [];
      
      return technicians;
    } catch (error) {
      console.error('Erreur lors de la récupération des techniciens:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error('Impossible de récupérer la liste des techniciens');
    }
  },
  
  /**
   * Assigner un ticket à un utilisateur ou un groupe
   * @param {number} ticketId - ID du ticket
   * @param {Object} assignData - Données d'assignation
   * @param {number} [assignData.userId] - ID de l'utilisateur (optionnel)
   * @param {number} [assignData.groupId] - ID du groupe (optionnel)
   * @returns {Promise<boolean>} - True si l'assignation est réussie
   */
  assignTicket: async (ticketId, assignData) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      let payload = {};
      
      // Assigner à un utilisateur
      if (assignData.userId) {
        payload = {
          input: {
            tickets_id: ticketId,
            users_id: assignData.userId,
            type: 2 // 2 = Assigned
          }
        };
        
        await axios({
          method: 'POST',
          url: `${process.env.GLPI_API_URL}/Ticket_User`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          data: payload
        });
      }
      
      // Assigner à un groupe
      if (assignData.groupId) {
        payload = {
          input: {
            tickets_id: ticketId,
            groups_id: assignData.groupId,
            type: 2 // 2 = Assigned
          }
        };
        
        await axios({
          method: 'POST',
          url: `${process.env.GLPI_API_URL}/Group_Ticket`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          data: payload
        });
      }
      
      // Mettre à jour le statut du ticket à "En cours (attribué)"
      await axios({
        method: 'PUT',
        url: `${process.env.GLPI_API_URL}/Ticket/${ticketId}`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        data: {
          input: {
            id: ticketId,
            status: 2 // 2 = En cours (attribué)
          }
        }
      });
      
      // Kill the session after assigning the ticket
      await glpiService.killSession();
      
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'assignation du ticket:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error(`Impossible d'assigner le ticket ${ticketId}`);
    }
  },
  
  /**
   * Ajouter un suivi (commentaire) à un ticket
   * @param {number} ticketId - ID du ticket
   * @param {string} content - Contenu du suivi
   * @returns {Promise<Object>} - Informations sur le suivi créé
   */
  addTicketFollowup: async (ticketId, content) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Créer le suivi
      const response = await axios({
        method: 'POST',
        url: `${process.env.GLPI_API_URL}/ITILFollowup`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        data: {
          input: {
            itemtype: 'Ticket',
            items_id: ticketId,
            content: content,
            is_private: 0 // 0 = public, 1 = privé
          }
        }
      });
      
      // Kill the session after adding the followup
      await glpiService.killSession();
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du suivi:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error(`Impossible d'ajouter un suivi au ticket ${ticketId}`);
    }
  },
  
  /**
   * Fermer un ticket
   * @param {number} ticketId - ID du ticket à fermer
   * @param {string} closeMessage - Message optionnel à ajouter lors de la fermeture
   * @returns {Promise<boolean>} - True si le ticket a été fermé avec succès
   */
  closeTicket: async (ticketId, closeMessage = "Ticket fermé via le chatbot WhatsApp") => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Mettre à jour le statut du ticket à "Fermé" (status 6)
      await axios({
        method: 'PUT',
        url: `${process.env.GLPI_API_URL}/Ticket/${ticketId}`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        data: {
          input: {
            status: 6 // 6 = Fermé
          }
        }
      });
      
      // Ajouter un suivi pour indiquer la fermeture
      if (closeMessage) {
        await glpiService.addTicketFollowup(ticketId, closeMessage);
      } else {
        // Kill the session if we don't add a followup
        await glpiService.killSession();
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de la fermeture du ticket ${ticketId}:`, error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error(`Impossible de fermer le ticket ${ticketId}`);
    }
  },
  
  /**
   * Rechercher des tickets selon différents critères
   * @param {Object} searchCriteria - Critères de recherche
   * @param {string} [searchCriteria.keyword] - Mot-clé à rechercher dans le titre et la description
   * @param {number} [searchCriteria.status] - Statut du ticket (1-6)
   * @param {number} [searchCriteria.type] - Type de ticket (1=incident, 2=demande)
   * @param {number} [searchCriteria.urgency] - Niveau d'urgence (1-5)
   * @param {number} [searchCriteria.category] - ID de la catégorie
   * @param {number} [searchCriteria.limit=10] - Nombre maximum de résultats
   * @returns {Promise<Array>} - Liste des tickets correspondants
   */
  searchTickets: async (searchCriteria) => {
    try {
      // Initialize session if needed
      if (!glpiService.sessionToken) {
        await glpiService.initSession();
      }
      
      // Construire les critères de recherche
      let searchParams = {};
      
      // Limiter le nombre de résultats
      const limit = searchCriteria.limit || 10;
      searchParams.range = `0-${limit - 1}`;
      
      // Construire la chaîne de recherche
      let searchFilters = [];
      
      // Filtrer par statut
      if (searchCriteria.status) {
        searchFilters.push(`status=${searchCriteria.status}`);
      }
      
      // Filtrer par type
      if (searchCriteria.type) {
        searchFilters.push(`type=${searchCriteria.type}`);
      }
      
      // Filtrer par urgence
      if (searchCriteria.urgency) {
        searchFilters.push(`urgency=${searchCriteria.urgency}`);
      }
      
      // Filtrer par catégorie
      if (searchCriteria.category) {
        searchFilters.push(`itilcategories_id=${searchCriteria.category}`);
      }
      
      // Recherche par mot-clé (dans le titre et la description)
      if (searchCriteria.keyword) {
        searchFilters.push(`(name LIKE '%${searchCriteria.keyword}%' OR content LIKE '%${searchCriteria.keyword}%')`);
      }
      
      // Combiner les filtres
      if (searchFilters.length > 0) {
        searchParams.criteria = searchFilters.join(' AND ');
      }
      
      // Effectuer la recherche
      const response = await axios({
        method: 'GET',
        url: `${process.env.GLPI_API_URL}/search/Ticket`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': glpiService.sessionToken,
          'App-Token': process.env.GLPI_APP_TOKEN
        },
        params: searchParams
      });
      
      // Formater les résultats
      let tickets = [];
      
      if (response.data && response.data.data) {
        tickets = response.data.data.map(ticket => ({
          id: ticket.id,
          title: ticket.name,
          status: ticket.status,
          type: ticket.type,
          urgency: ticket.urgency,
          category: ticket.itilcategories_id,
          dateCreation: ticket.date_creation
        }));
      }
      
      // Kill the session after searching
      await glpiService.killSession();
      
      return tickets;
    } catch (error) {
      console.error('Erreur lors de la recherche de tickets:', error.response?.data || error.message);
      
      // Try to kill the session even if there was an error
      if (glpiService.sessionToken) {
        await glpiService.killSession();
      }
      
      throw new Error('Impossible de rechercher des tickets');
    }
  },
  
  /**
   * Test the connection to GLPI API
   * @returns {Promise<boolean>} - True if connection is successful
   */
  testConnection: async () => {
    try {
      console.log('Testing connection to GLPI API...');
      console.log('API URL:', process.env.GLPI_API_URL);
      console.log('App Token:', process.env.GLPI_APP_TOKEN ? 'Configured' : 'Missing');
      console.log('User Token:', process.env.GLPI_USER_TOKEN ? 'Configured' : 'Missing');
      
      // Test the connection by initializing a session
      await glpiService.initSession();
      
      // If we got here, the connection is successful
      console.log('Connection to GLPI API successful!');
      
      // Kill the session
      await glpiService.killSession();
      
      return true;
    } catch (error) {
      console.error('Connection to GLPI API failed:');
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      return false;
    }
  },
};

module.exports = glpiService;
