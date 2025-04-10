/**
 * Service de suivi des tickets GLPI
 * Permet de consulter l'état et les réponses d'un ticket existant
 */

const axios = require('axios');
const glpiService = require('./glpiService');
const notificationService = require('./notificationService');

const ticketTrackingService = {
  /**
   * Récupère les informations complètes d'un ticket
   * @param {number} ticketId - ID du ticket à consulter
   * @returns {Promise<Object>} - Informations du ticket et ses suivis
   */
  getTicketDetails: async (ticketId) => {
    try {
      // Récupérer les informations de base du ticket
      const ticketData = await glpiService.getTicket(ticketId);
      
      // Récupérer les suivis du ticket
      const followups = await glpiService.getTicketFollowups(ticketId);
      
      // Récupérer les assignations (groupes et techniciens)
      let assignedGroups = [];
      let assignedTechnicians = [];
      
      try {
        // Récupérer les groupes assignés
        const groupsResponse = await axios({
          method: 'GET',
          url: `${process.env.GLPI_API_URL}/Group_Ticket`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          params: {
            searchText: `{"tickets_id": ${ticketId}, "type": 2}`
          }
        });
        
        if (groupsResponse.data && Array.isArray(groupsResponse.data)) {
          assignedGroups = groupsResponse.data.map(group => ({
            id: group.groups_id,
            name: group.groups_name || `Groupe #${group.groups_id}`
          }));
        }
        
        // Récupérer les techniciens assignés
        const techniciansResponse = await axios({
          method: 'GET',
          url: `${process.env.GLPI_API_URL}/Ticket_User`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          params: {
            searchText: `{"tickets_id": ${ticketId}, "type": 2}`
          }
        });
        
        if (techniciansResponse.data && Array.isArray(techniciansResponse.data)) {
          assignedTechnicians = techniciansResponse.data.map(tech => ({
            id: tech.users_id,
            name: tech.users_name || `Technicien #${tech.users_id}`
          }));
        }
      } catch (error) {
        console.warn(`Erreur lors de la récupération des assignations pour le ticket ${ticketId}:`, error);
        // Continue without assignment info
      }
      
      // Formater les informations pour l'affichage
      const ticketDetails = {
        id: ticketData.id,
        title: ticketData.name,
        description: ticketData.content,
        status: {
          id: ticketData.status,
          name: glpiService.getTicketStatusName(ticketData.status)
        },
        type: ticketData.type === 1 ? 'Incident' : 'Demande',
        urgency: ticketData.urgency,
        category: ticketData.itilcategories_id,
        dateCreation: new Date(ticketData.date_creation).toLocaleString('fr-FR'),
        dateModification: ticketData.date_mod ? new Date(ticketData.date_mod).toLocaleString('fr-FR') : null,
        dateClosure: ticketData.closedate ? new Date(ticketData.closedate).toLocaleString('fr-FR') : null,
        assignedGroups: assignedGroups,
        assignedTechnicians: assignedTechnicians,
        followups: followups.map(followup => ({
          id: followup.id,
          content: followup.content,
          date: new Date(followup.date).toLocaleString('fr-FR'),
          author: followup.users_id_editor
        }))
      };
      
      return ticketDetails;
    } catch (error) {
      console.error(`Erreur lors de la récupération des détails du ticket ${ticketId}:`, error);
      throw new Error(`Impossible de récupérer les détails du ticket ${ticketId}`);
    }
  },
  
  /**
   * Formater un message pour afficher les détails d'un ticket
   * @param {Object} ticket - Détails du ticket
   * @param {boolean} isSubscribed - Si l'utilisateur est abonné aux notifications
   * @returns {string} - Message formaté
   */
  formatTicketDetailsMessage: (ticket, isSubscribed) => {
    // Vérifier si le ticket existe
    if (!ticket || !ticket.id) {
      return "❌ Impossible de récupérer les détails du ticket.";
    }
    
    // Formater les détails du ticket
    let message = `📋 *DÉTAILS DU TICKET #${ticket.id}*\n\n`;
    
    // Informations principales
    message += `📝 *Titre:* ${ticket.title || ticket.name}\n`;
    message += `🔖 *Type:* ${glpiService.getTicketTypeName(ticket.type)}\n`;
    message += `🚦 *Statut:* ${glpiService.getTicketStatusName(ticket.status)}\n`;
    message += `🔥 *Urgence:* ${glpiService.getUrgencyName(ticket.urgency)}\n`;
    
    // Date de création et dernière mise à jour
    if (ticket.date_creation) {
      const creationDate = new Date(ticket.date_creation);
      message += `📅 *Créé le:* ${creationDate.toLocaleDateString('fr-FR')} à ${creationDate.toLocaleTimeString('fr-FR')}\n`;
    }
    
    if (ticket.date_mod && ticket.date_mod !== ticket.date_creation) {
      const modificationDate = new Date(ticket.date_mod);
      message += `🔄 *Dernière mise à jour:* ${modificationDate.toLocaleDateString('fr-FR')} à ${modificationDate.toLocaleTimeString('fr-FR')}\n`;
    }
    
    // Assignation
    if (ticket.assigned_user_name) {
      message += `👤 *Assigné à:* ${ticket.assigned_user_name}\n`;
    } else if (ticket.assigned_group_name) {
      message += `👥 *Assigné au groupe:* ${ticket.assigned_group_name}\n`;
    } else {
      message += `👤 *Assignation:* Non assigné\n`;
    }
    
    // Description
    if (ticket.content || ticket.description) {
      const description = ticket.content || ticket.description;
      const truncatedDescription = description.length > 300 
        ? description.substring(0, 300) + "..." 
        : description;
      
      message += `\n📄 *Description:*\n${truncatedDescription}\n`;
    }
    
    // Statut d'abonnement
    message += `\n${isSubscribed ? "✅" : "❌"} Vous êtes ${isSubscribed ? "" : "non "}abonné aux notifications pour ce ticket.\n`;
    
    return message;
  },
  
  /**
   * Formate les informations du ticket pour l'affichage dans WhatsApp
   * @param {Object} ticketDetails - Détails du ticket
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatTicketMessage: (ticketDetails) => {
    let message = `*🎫 Ticket #${ticketDetails.id}*\n\n`;
    
    // Informations principales
    message += `📋 *Titre:* ${ticketDetails.title}\n`;
    message += `🔍 *Type:* ${ticketDetails.type}\n`;
    message += `🚦 *Statut:* ${ticketDetails.status.name}\n`;
    message += `🔥 *Urgence:* ${ticketDetails.urgency}/5\n`;
    message += `📅 *Créé le:* ${ticketDetails.dateCreation}\n`;
    
    if (ticketDetails.dateModification) {
      message += `🔄 *Dernière modification:* ${ticketDetails.dateModification}\n`;
    }
    
    if (ticketDetails.dateClosure) {
      message += `✅ *Clôturé le:* ${ticketDetails.dateClosure}\n`;
    }
    
    // Assignations
    if (ticketDetails.assignedGroups && ticketDetails.assignedGroups.length > 0) {
      message += `\n👥 *Groupes assignés:*\n`;
      ticketDetails.assignedGroups.forEach(group => {
        message += `   - ${group.name} (ID: ${group.id})\n`;
      });
    }
    
    if (ticketDetails.assignedTechnicians && ticketDetails.assignedTechnicians.length > 0) {
      message += `\n👨‍💻 *Techniciens assignés:*\n`;
      ticketDetails.assignedTechnicians.forEach(tech => {
        message += `   - ${tech.name} (ID: ${tech.id})\n`;
      });
    }
    
    // Description
    message += `\n📝 *Description:*\n${ticketDetails.description}\n`;
    
    // Suivis
    if (ticketDetails.followups && ticketDetails.followups.length > 0) {
      message += `\n💬 *Réponses (${ticketDetails.followups.length}):*\n`;
      
      ticketDetails.followups.forEach((followup, index) => {
        message += `\n------- Réponse #${index + 1} (ID: ${followup.id}) -------\n`;
        message += `📅 ${followup.date}\n`;
        message += `${followup.content}\n`;
      });
    } else {
      message += `\n💬 *Aucune réponse pour le moment*\n`;
    }
    
    return message;
  },
  
  /**
   * Formate un message pour présenter les options d'attribution de ticket
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatAssignmentOptionsMessage: () => {
    return "Pour attribuer ce ticket, vous pouvez :\n\n" +
           "1️⃣ L'attribuer à un groupe\n" +
           "2️⃣ L'attribuer à un technicien\n" +
           "3️⃣ Revenir au suivi du ticket";
  },
  
  /**
   * Formate un message pour présenter les groupes disponibles
   * @param {Array} groups - Liste des groupes
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatGroupsListMessage: (groups) => {
    let message = "*Groupes disponibles:*\n\n";
    
    if (!groups || groups.length === 0) {
      return message + "Aucun groupe disponible.";
    }
    
    groups.forEach((group, index) => {
      message += `${index + 1}. *${group.name}* (ID: ${group.id})\n`;
    });
    
    message += "\nPour attribuer le ticket à un groupe, répondez avec le numéro ou l'ID du groupe.";
    
    return message;
  },
  
  /**
   * Formate un message pour présenter les techniciens disponibles
   * @param {Array} technicians - Liste des techniciens
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatTechniciansListMessage: (technicians) => {
    let message = "*Techniciens disponibles:*\n\n";
    
    if (!technicians || technicians.length === 0) {
      return message + "Aucun technicien disponible.";
    }
    
    technicians.forEach((tech, index) => {
      message += `${index + 1}. *${tech.name}* (ID: ${tech.id})\n`;
    });
    
    message += "\nPour attribuer le ticket à un technicien, répondez avec le numéro ou l'ID du technicien.";
    
    return message;
  },
  
  /**
   * Attribuer un ticket à un groupe
   * @param {number} ticketId - ID du ticket
   * @param {number|string} groupIdOrIndex - ID du groupe ou index dans la liste
   * @param {string} [requesterPhone] - Numéro de téléphone du demandeur
   * @returns {Promise<boolean>} - True si l'attribution est réussie
   */
  assignTicketToGroup: async (ticketId, groupIdOrIndex, requesterPhone = null) => {
    try {
      // Convertir en nombre
      const groupId = parseInt(groupIdOrIndex);
      
      if (isNaN(groupId)) {
        throw new Error("ID de groupe invalide");
      }
      
      // Récupérer les infos du groupe si possible
      let groupName = null;
      try {
        const groups = await glpiService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
          groupName = group.name;
        }
      } catch (error) {
        console.warn(`Impossible de récupérer les informations du groupe ${groupId}:`, error);
      }
      
      // Attribuer le ticket au groupe
      await glpiService.assignTicket(ticketId, { groupId });
      
      // Notifier les abonnés
      await notificationService.notifyTicketSubscribers(ticketId, 'assignment', {
        groupId,
        groupName,
        requester: requesterPhone
      });
      
      // Abonner automatiquement le demandeur aux notifications
      if (requesterPhone) {
        notificationService.subscribeToTicket(requesterPhone, ticketId);
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'attribution du ticket ${ticketId} au groupe ${groupIdOrIndex}:`, error);
      throw new Error(`Impossible d'attribuer le ticket ${ticketId} au groupe ${groupIdOrIndex}`);
    }
  },
  
  /**
   * Attribuer un ticket à un technicien
   * @param {number} ticketId - ID du ticket
   * @param {number|string} technicianIdOrIndex - ID du technicien ou index dans la liste
   * @param {string} [requesterPhone] - Numéro de téléphone du demandeur
   * @returns {Promise<boolean>} - True si l'attribution est réussie
   */
  assignTicketToTechnician: async (ticketId, technicianIdOrIndex, requesterPhone = null) => {
    try {
      // Convertir en nombre
      const technicianId = parseInt(technicianIdOrIndex);
      
      if (isNaN(technicianId)) {
        throw new Error("ID de technicien invalide");
      }
      
      // Récupérer les infos du technicien si possible
      let technicianName = null;
      try {
        const technicians = await glpiService.getTechnicians();
        const technician = technicians.find(t => t.id === technicianId);
        if (technician) {
          technicianName = technician.name;
        }
      } catch (error) {
        console.warn(`Impossible de récupérer les informations du technicien ${technicianId}:`, error);
      }
      
      // Attribuer le ticket au technicien
      await glpiService.assignTicket(ticketId, { userId: technicianId });
      
      // Notifier les abonnés
      await notificationService.notifyTicketSubscribers(ticketId, 'assignment', {
        userId: technicianId,
        userName: technicianName,
        requester: requesterPhone
      });
      
      // Abonner automatiquement le demandeur aux notifications
      if (requesterPhone) {
        notificationService.subscribeToTicket(requesterPhone, ticketId);
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'attribution du ticket ${ticketId} au technicien ${technicianIdOrIndex}:`, error);
      throw new Error(`Impossible d'attribuer le ticket ${ticketId} au technicien ${technicianIdOrIndex}`);
    }
  },
  
  /**
   * Ajouter un suivi (commentaire) à un ticket
   * @param {number} ticketId - ID du ticket
   * @param {string} content - Contenu du commentaire
   * @param {string} [authorPhone] - Numéro de téléphone de l'auteur
   * @returns {Promise<Object>} - Informations sur le suivi créé
   */
  addTicketComment: async (ticketId, content, authorPhone = null) => {
    try {
      const followupData = await glpiService.addTicketFollowup(ticketId, content);
      
      // Notifier les abonnés
      await notificationService.notifyTicketSubscribers(ticketId, 'comment', {
        content: content,
        author: authorPhone || 'WhatsApp'
      });
      
      return followupData;
    } catch (error) {
      console.error(`Erreur lors de l'ajout du commentaire au ticket ${ticketId}:`, error);
      throw new Error(`Impossible d'ajouter un commentaire au ticket ${ticketId}`);
    }
  },
  
  /**
   * Formate un message pour demander un commentaire
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatAddCommentMessage: () => {
    return "Veuillez entrer votre commentaire pour ce ticket.\n\n" +
           "Ce commentaire sera visible par tous les utilisateurs ayant accès au ticket.";
  },

  /**
   * Formate un message pour demander un suivi
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatAddFollowupMessage: () => {
    return "💬 *Ajouter un suivi au ticket*\n\n" +
           "Veuillez entrer le texte de votre suivi pour ce ticket.\n\n" +
           "Ce suivi sera visible par tous les utilisateurs ayant accès au ticket.";
  },

  /**
   * Formate un message pour demander un demandeur
   * @returns {string} - Message formaté pour WhatsApp
   */
  formatAddRequesterMessage: () => {
    return "👤 *Ajouter un demandeur au ticket*\n\n" +
           "Veuillez entrer l'identifiant ou le nom du demandeur à ajouter.\n\n" +
           "Exemple: jean.dupont@entreprise.com ou Jean Dupont";
  },

  /**
   * Ajouter un demandeur à un ticket
   * @param {number} ticketId - ID du ticket
   * @param {string} requesterInfo - Informations sur le demandeur (email ou nom)
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  addRequesterToTicket: async (ticketId, requesterInfo) => {
    try {
      // Vérifier si le ticket existe
      const ticketDetails = await glpiService.getTicket(ticketId);
      if (!ticketDetails) {
        return {
          success: false,
          message: `❌ Ticket #${ticketId} introuvable. Impossible d'ajouter le demandeur.`
        };
      }

      // Rechercher l'utilisateur dans GLPI
      let userId = null;
      try {
        // Essayer de rechercher par email
        const usersResponse = await axios({
          method: 'GET',
          url: `${process.env.GLPI_API_URL}/User`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          params: {
            searchText: JSON.stringify({email: requesterInfo})
          }
        });

        if (usersResponse.data && Array.isArray(usersResponse.data) && usersResponse.data.length > 0) {
          userId = usersResponse.data[0].id;
        } else {
          // Essayer de rechercher par nom
          const usersNameResponse = await axios({
            method: 'GET',
            url: `${process.env.GLPI_API_URL}/User`,
            headers: {
              'Content-Type': 'application/json',
              'Session-Token': glpiService.sessionToken,
              'App-Token': process.env.GLPI_APP_TOKEN
            },
            params: {
              searchText: JSON.stringify({name: requesterInfo})
            }
          });

          if (usersNameResponse.data && Array.isArray(usersNameResponse.data) && usersNameResponse.data.length > 0) {
            userId = usersNameResponse.data[0].id;
          }
        }
      } catch (error) {
        console.error(`Erreur lors de la recherche de l'utilisateur ${requesterInfo}:`, error);
        return {
          success: false,
          message: `❌ Erreur lors de la recherche de l'utilisateur. Veuillez réessayer.`
        };
      }

      if (!userId) {
        return {
          success: false,
          message: `❌ Utilisateur '${requesterInfo}' introuvable dans GLPI. Vérifiez l'orthographe ou utilisez un email valide.`
        };
      }

      // Ajouter le demandeur au ticket
      try {
        await axios({
          method: 'POST',
          url: `${process.env.GLPI_API_URL}/Ticket_User`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          data: {
            tickets_id: ticketId,
            users_id: userId,
            type: 1 // 1 = Demandeur
          }
        });

        return {
          success: true,
          message: `✅ Demandeur ajouté avec succès au ticket #${ticketId}.`
        };
      } catch (error) {
        console.error(`Erreur lors de l'ajout du demandeur au ticket ${ticketId}:`, error);
        return {
          success: false,
          message: `❌ Erreur lors de l'ajout du demandeur au ticket. Veuillez réessayer.`
        };
      }
    } catch (error) {
      console.error(`Erreur lors de l'ajout du demandeur au ticket ${ticketId}:`, error);
      return {
        success: false,
        message: `❌ Une erreur s'est produite. Veuillez réessayer plus tard.`
      };
    }
  },

  /**
   * Ajouter un suivi à un ticket
   * @param {number} ticketId - ID du ticket
   * @param {string} content - Contenu du suivi
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  addFollowupToTicket: async (ticketId, content) => {
    try {
      // Vérifier si le ticket existe
      const ticketDetails = await glpiService.getTicket(ticketId);
      if (!ticketDetails) {
        return {
          success: false,
          message: `❌ Ticket #${ticketId} introuvable. Impossible d'ajouter le suivi.`
        };
      }

      // Ajouter le suivi au ticket
      try {
        await axios({
          method: 'POST',
          url: `${process.env.GLPI_API_URL}/ITILFollowup`,
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': glpiService.sessionToken,
            'App-Token': process.env.GLPI_APP_TOKEN
          },
          data: {
            itemtype: 'Ticket',
            items_id: ticketId,
            content: content
          }
        });

        return {
          success: true,
          message: `✅ Suivi ajouté avec succès au ticket #${ticketId}.`
        };
      } catch (error) {
        console.error(`Erreur lors de l'ajout du suivi au ticket ${ticketId}:`, error);
        return {
          success: false,
          message: `❌ Erreur lors de l'ajout du suivi au ticket. Veuillez réessayer.`
        };
      }
    } catch (error) {
      console.error(`Erreur lors de l'ajout du suivi au ticket ${ticketId}:`, error);
      return {
        success: false,
        message: `❌ Une erreur s'est produite. Veuillez réessayer plus tard.`
      };
    }
  },
  
  /**
   * Suivre un ticket spécifique
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket à suivre
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  trackTicket: async (phoneNumber, ticketId) => {
    try {
      // Récupérer les détails du ticket
      const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
      
      if (!ticketDetails) {
        return {
          success: false,
          message: `❌ Ticket #${ticketId} introuvable. Veuillez vérifier le numéro et réessayer.`
        };
      }
      
      // Vérifier si l'utilisateur est abonné aux notifications pour ce ticket
      const isSubscribed = notificationService.isSubscribedToTicket(phoneNumber, ticketId);
      
      // Formater le message avec les détails du ticket
      const message = ticketTrackingService.formatTicketDetailsMessage(ticketDetails, isSubscribed);
      
      // Préparer les options pour l'utilisateur (première ligne de boutons)
      const buttons1 = [
        {
          type: "reply",
          reply: {
            id: `comment_ticket_${ticketId}`,
            title: "📝 Ajouter commentaire"
          }
        },
        {
          type: "reply",
          reply: {
            id: `add_followup_${ticketId}`,
            title: "💬 Ajouter suivi"
          }
        }
      ];
      
      // Deuxième ligne de boutons
      const buttons2 = [
        {
          type: "reply",
          reply: {
            id: `assign_technician_${ticketId}`,
            title: "👨‍💻 Attribuer technicien"
          }
        },
        {
          type: "reply",
          reply: {
            id: `add_requester_${ticketId}`,
            title: "👤 Ajouter demandeur"
          }
        }
      ];
      
      // Troisième ligne de boutons
      const buttons3 = [];
      
      // Ajouter un bouton pour s'abonner ou se désabonner
      if (isSubscribed) {
        buttons3.push({
          type: "reply",
          reply: {
            id: `unsubscribe_ticket_${ticketId}`,
            title: "🔕 Se désabonner"
          }
        });
      } else {
        buttons3.push({
          type: "reply",
          reply: {
            id: `subscribe_ticket_${ticketId}`,
            title: "🔔 S'abonner"
          }
        });
      }
      
      // Ajouter un bouton pour voir les commentaires
      buttons3.push({
        type: "reply",
        reply: {
          id: `view_comments_${ticketId}`,
          title: "💬 Voir commentaires"
        }
      });
      
      // Combiner tous les boutons
      const allButtons = [...buttons1, ...buttons2, ...buttons3];
      
      return {
        success: true,
        message,
        buttons: allButtons,
        ticketDetails
      };
    } catch (error) {
      console.error(`Erreur lors du suivi du ticket ${ticketId}:`, error);
      return {
        success: false,
        message: `❌ Une erreur s'est produite lors du suivi du ticket #${ticketId}. Veuillez réessayer plus tard.`
      };
    }
  },
  
  /**
   * Récupérer et formater les commentaires d'un ticket
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  getTicketComments: async (ticketId) => {
    try {
      // Récupérer les suivis du ticket
      const followups = await glpiService.getTicketFollowups(ticketId);
      
      if (!followups || followups.length === 0) {
        return {
          success: true,
          message: `ℹ️ Aucun commentaire trouvé pour le ticket #${ticketId}.`,
          comments: []
        };
      }
      
      // Trier les commentaires par date (du plus récent au plus ancien)
      const sortedFollowups = followups.sort((a, b) => {
        return new Date(b.date_creation) - new Date(a.date_creation);
      });
      
      // Formater les commentaires
      let message = `💬 *COMMENTAIRES DU TICKET #${ticketId}*\n\n`;
      
      sortedFollowups.forEach((followup, index) => {
        const date = new Date(followup.date_creation);
        const formattedDate = `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR')}`;
        
        message += `*Commentaire #${index + 1}*\n`;
        message += `📅 *Date:* ${formattedDate}\n`;
        
        if (followup.users_id_editor) {
          message += `👤 *Auteur:* ${followup.users_id_editor_name || `Utilisateur #${followup.users_id_editor}`}\n`;
        }
        
        message += `💬 *Contenu:* ${followup.content}\n\n`;
      });
      
      // Ajouter un bouton pour retourner aux détails du ticket
      const buttons = [
        {
          type: "reply",
          reply: {
            id: `track_ticket_${ticketId}`,
            title: "📋 Retour aux détails"
          }
        }
      ];
      
      return {
        success: true,
        message,
        buttons,
        comments: sortedFollowups
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération des commentaires du ticket ${ticketId}:`, error);
      return {
        success: false,
        message: `❌ Une erreur s'est produite lors de la récupération des commentaires du ticket #${ticketId}. Veuillez réessayer plus tard.`,
        comments: []
      };
    }
  },
  
  /**
   * Affiche les détails d'un ticket et les options de suivi
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket à afficher
   * @returns {Promise<void>}
   */
  displayTicketDetails: async (phoneNumber, ticketId) => {
    try {
      const whatsappService = require('./whatsappService');
      
      // Récupérer les détails du ticket
      const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
      
      if (!ticketDetails) {
        await whatsappService.sendMessage(
          phoneNumber,
          `⚠️ Le ticket #${ticketId} n'a pas été trouvé. Veuillez vérifier le numéro et réessayer.`
        );
        return;
      }
      
      // Vérifier si l'utilisateur est abonné aux notifications pour ce ticket
      const isSubscribed = notificationService.isSubscribedToTicket(phoneNumber, ticketId);
      
      // Formater le message avec les détails du ticket
      const message = ticketTrackingService.formatTicketMessage(ticketDetails);
      
      // Préparer les options pour l'utilisateur (première ligne de boutons)
      const buttons = [
        {
          type: "reply",
          reply: {
            id: `comment_ticket_${ticketId}`,
            title: "📝 Commentaire"
          }
        },
        {
          type: "reply",
          reply: {
            id: `assign_ticket_${ticketId}`,
            title: "👤 Attribuer"
          }
        },
        {
          type: "reply",
          reply: {
            id: `add_requester_${ticketId}`,
            title: "👥 Demandeur"
          }
        }
      ];
      
      // Seconde ligne de boutons (selon l'état du ticket)
      const secondRowButtons = [];
      
      // Ajouter le bouton de fermeture uniquement si le ticket n'est pas déjà fermé
      if (ticketDetails.status !== 6) { // 6 = Fermé
        secondRowButtons.push({
          type: "reply",
          reply: {
            id: `close_ticket_${ticketId}`,
            title: "✅ Fermer ticket"
          }
        });
      }
      
      // Ajouter le bouton d'abonnement/désabonnement selon l'état actuel
      if (isSubscribed) {
        secondRowButtons.push({
          type: "reply",
          reply: {
            id: `unsub_ticket_${ticketId}`,
            title: "🔕 Désabonner"
          }
        });
      } else {
        secondRowButtons.push({
          type: "reply",
          reply: {
            id: `sub_ticket_${ticketId}`,
            title: "🔔 S'abonner"
          }
        });
      }
      
      // Ajouter le bouton de retour au menu principal
      secondRowButtons.push({
        type: "reply",
        reply: {
          id: `back_to_menu`,
          title: "🏠 Menu principal"
        }
      });
      
      // Envoyer le message avec la première ligne de boutons
      await whatsappService.sendButtonsMessage(
        phoneNumber,
        "Détails du ticket",
        message,
        buttons
      );
      
      // Attendre un court instant pour que le premier message soit bien reçu
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Envoyer la seconde ligne de boutons
      await whatsappService.sendButtonsMessage(
        phoneNumber,
        "Actions supplémentaires",
        "Choisissez parmi les options suivantes :",
        secondRowButtons
      );
    } catch (error) {
      console.error(`Erreur lors de l'affichage des détails du ticket ${ticketId} pour ${phoneNumber}:`, error);
      const whatsappService = require('./whatsappService');
      await whatsappService.sendMessage(
        phoneNumber,
        `❌ Une erreur s'est produite lors de l'affichage des détails du ticket #${ticketId}. Veuillez réessayer plus tard.`
      );
    }
  }
};

module.exports = ticketTrackingService;
