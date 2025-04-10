/**
 * Service de surveillance des tickets GLPI
 * Permet de détecter les changements dans les tickets et d'envoyer des notifications
 */

const glpiService = require('./glpiService');
const notificationService = require('./notificationService');
const whatsappService = require('./whatsappService');

// Stockage de l'état des tickets
// Format: { ticketId: { lastUpdate: timestamp, status: statusId, ... } }
const ticketStates = {};

const ticketMonitorService = {
  /**
   * Initialiser le service de surveillance
   * @returns {void}
   */
  init: () => {
    console.log('Initialisation du service de surveillance des tickets GLPI');
    
    // Démarrer la surveillance périodique
    setInterval(async () => {
      await ticketMonitorService.checkForUpdates();
    }, 5 * 60 * 1000); // Vérifier toutes les 5 minutes
  },
  
  /**
   * Vérifier les mises à jour des tickets
   * @returns {Promise<void>}
   */
  checkForUpdates: async () => {
    try {
      console.log('Vérification des mises à jour des tickets GLPI');
      
      // Récupérer la liste des tickets surveillés
      const monitoredTickets = notificationService.getAllMonitoredTickets();
      
      if (monitoredTickets.length === 0) {
        console.log('Aucun ticket surveillé');
        return;
      }
      
      console.log(`Vérification de ${monitoredTickets.length} tickets surveillés`);
      
      // Vérifier chaque ticket
      for (const ticketId of monitoredTickets) {
        await ticketMonitorService.checkTicketUpdates(ticketId);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour des tickets:', error);
    }
  },
  
  /**
   * Vérifier les mises à jour d'un ticket spécifique
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<void>}
   */
  checkTicketUpdates: async (ticketId) => {
    try {
      // Récupérer les détails du ticket
      const ticketDetails = await glpiService.getTicket(ticketId);
      
      if (!ticketDetails) {
        console.log(`Ticket #${ticketId} non trouvé`);
        return;
      }
      
      // Vérifier si c'est la première fois que nous surveillons ce ticket
      if (!ticketStates[ticketId]) {
        // Enregistrer l'état initial du ticket
        ticketStates[ticketId] = {
          lastUpdate: new Date(ticketDetails.date_mod).getTime(),
          status: ticketDetails.status,
          assignedUser: ticketDetails.users_id_recipient,
          assignedGroup: ticketDetails.groups_id_assign,
          followups: await ticketMonitorService.getTicketFollowupsCount(ticketId)
        };
        
        console.log(`État initial du ticket #${ticketId} enregistré`);
        return;
      }
      
      // Récupérer l'état précédent du ticket
      const previousState = ticketStates[ticketId];
      
      // Vérifier si le ticket a été modifié depuis la dernière vérification
      const currentUpdateTime = new Date(ticketDetails.date_mod).getTime();
      
      if (currentUpdateTime > previousState.lastUpdate) {
        console.log(`Ticket #${ticketId} modifié depuis la dernière vérification`);
        
        // Vérifier les changements spécifiques
        
        // Changement de statut
        if (ticketDetails.status !== previousState.status) {
          console.log(`Statut du ticket #${ticketId} modifié: ${previousState.status} -> ${ticketDetails.status}`);
          
          // Notifier les abonnés
          await notificationService.notifyTicketSubscribers(ticketId, 'status', {
            status: ticketDetails.status,
            previousStatus: previousState.status
          });
        }
        
        // Changement d'attribution (utilisateur)
        if (ticketDetails.users_id_recipient !== previousState.assignedUser) {
          console.log(`Attribution du ticket #${ticketId} modifiée: ${previousState.assignedUser} -> ${ticketDetails.users_id_recipient}`);
          
          // Notifier les abonnés
          await notificationService.notifyTicketSubscribers(ticketId, 'assignment', {
            userId: ticketDetails.users_id_recipient
          });
        }
        
        // Changement d'attribution (groupe)
        if (ticketDetails.groups_id_assign !== previousState.assignedGroup) {
          console.log(`Attribution du ticket #${ticketId} modifiée: ${previousState.assignedGroup} -> ${ticketDetails.groups_id_assign}`);
          
          // Notifier les abonnés
          await notificationService.notifyTicketSubscribers(ticketId, 'assignment', {
            groupId: ticketDetails.groups_id_assign
          });
        }
        
        // Vérifier les nouveaux commentaires
        const currentFollowupsCount = await ticketMonitorService.getTicketFollowupsCount(ticketId);
        
        if (currentFollowupsCount > previousState.followups) {
          console.log(`Nouveaux commentaires sur le ticket #${ticketId}: ${previousState.followups} -> ${currentFollowupsCount}`);
          
          // Récupérer les nouveaux commentaires
          const newFollowups = await ticketMonitorService.getNewTicketFollowups(ticketId, previousState.followups);
          
          // Notifier pour chaque nouveau commentaire
          for (const followup of newFollowups) {
            await notificationService.notifyTicketSubscribers(ticketId, 'comment', {
              content: followup.content,
              author: followup.users_id_editor ? `ID: ${followup.users_id_editor}` : 'Système'
            });
          }
        }
        
        // Mettre à jour l'état du ticket
        ticketStates[ticketId] = {
          lastUpdate: currentUpdateTime,
          status: ticketDetails.status,
          assignedUser: ticketDetails.users_id_recipient,
          assignedGroup: ticketDetails.groups_id_assign,
          followups: currentFollowupsCount
        };
        
        console.log(`État du ticket #${ticketId} mis à jour`);
      } else {
        console.log(`Aucune modification du ticket #${ticketId} depuis la dernière vérification`);
      }
    } catch (error) {
      console.error(`Erreur lors de la vérification des mises à jour du ticket #${ticketId}:`, error);
    }
  },
  
  /**
   * Obtenir le nombre de commentaires d'un ticket
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<number>} - Nombre de commentaires
   */
  getTicketFollowupsCount: async (ticketId) => {
    try {
      const followups = await glpiService.getTicketFollowups(ticketId);
      return followups.length;
    } catch (error) {
      console.error(`Erreur lors de la récupération des commentaires du ticket #${ticketId}:`, error);
      return 0;
    }
  },
  
  /**
   * Obtenir les nouveaux commentaires d'un ticket
   * @param {number} ticketId - ID du ticket
   * @param {number} previousCount - Nombre de commentaires précédent
   * @returns {Promise<Array>} - Liste des nouveaux commentaires
   */
  getNewTicketFollowups: async (ticketId, previousCount) => {
    try {
      const followups = await glpiService.getTicketFollowups(ticketId);
      
      // Trier les commentaires par date (du plus récent au plus ancien)
      followups.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));
      
      // Récupérer les nouveaux commentaires
      return followups.slice(0, followups.length - previousCount);
    } catch (error) {
      console.error(`Erreur lors de la récupération des nouveaux commentaires du ticket #${ticketId}:`, error);
      return [];
    }
  },
  
  /**
   * Surveiller un nouveau ticket
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<boolean>} - True si le ticket a été ajouté à la surveillance
   */
  monitorTicket: async (ticketId) => {
    try {
      // Vérifier si le ticket existe
      const ticketDetails = await glpiService.getTicket(ticketId);
      
      if (!ticketDetails) {
        console.log(`Ticket #${ticketId} non trouvé, impossible de le surveiller`);
        return false;
      }
      
      // Enregistrer l'état initial du ticket
      ticketStates[ticketId] = {
        lastUpdate: new Date(ticketDetails.date_mod).getTime(),
        status: ticketDetails.status,
        assignedUser: ticketDetails.users_id_recipient,
        assignedGroup: ticketDetails.groups_id_assign,
        followups: await ticketMonitorService.getTicketFollowupsCount(ticketId)
      };
      
      console.log(`Ticket #${ticketId} ajouté à la surveillance`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'ajout du ticket #${ticketId} à la surveillance:`, error);
      return false;
    }
  },
  
  /**
   * Arrêter la surveillance d'un ticket
   * @param {number} ticketId - ID du ticket
   * @returns {boolean} - True si le ticket a été retiré de la surveillance
   */
  stopMonitoring: (ticketId) => {
    if (ticketStates[ticketId]) {
      delete ticketStates[ticketId];
      console.log(`Ticket #${ticketId} retiré de la surveillance`);
      return true;
    }
    
    return false;
  },
  
  /**
   * Notifier le créateur d'un ticket lors de sa création
   * @param {number} ticketId - ID du ticket
   * @param {string} phoneNumber - Numéro de téléphone du créateur
   * @returns {Promise<boolean>} - True si la notification a été envoyée
   */
  notifyTicketCreation: async (ticketId, phoneNumber) => {
    try {
      // Récupérer les détails du ticket
      const ticketDetails = await glpiService.getTicket(ticketId);
      
      if (!ticketDetails) {
        console.log(`Ticket #${ticketId} non trouvé, impossible d'envoyer la notification de création`);
        return false;
      }
      
      // Formater le message de notification
      const message = `✅ *Ticket créé avec succès*\n\n` +
        `📝 *Numéro:* #${ticketId}\n` +
        `📋 *Titre:* ${ticketDetails.name}\n` +
        `🔖 *Type:* ${glpiService.getTicketTypeName(ticketDetails.type)}\n` +
        `🚦 *Statut:* ${glpiService.getTicketStatusName(ticketDetails.status)}\n` +
        `🔥 *Urgence:* ${glpiService.getUrgencyName(ticketDetails.urgency)}\n\n` +
        `Vous êtes maintenant abonné aux notifications pour ce ticket. Vous recevrez automatiquement un message lorsque le statut change, un commentaire est ajouté ou le ticket est attribué.`;
      
      // Créer les boutons pour les actions rapides
      const buttons = [
        {
          type: "reply",
          reply: {
            id: `track_ticket_${ticketId}`,
            title: "📋 Voir détails"
          }
        },
        {
          type: "reply",
          reply: {
            id: `view_comments_${ticketId}`,
            title: "💬 Voir commentaires"
          }
        },
        {
          type: "reply",
          reply: {
            id: `comment_ticket_${ticketId}`,
            title: "📝 Commenter"
          }
        }
      ];
      
      // Envoyer la notification
      await whatsappService.sendButtonsMessage(phoneNumber, message, buttons, "Ticket créé");
      
      // Abonner automatiquement l'utilisateur aux notifications pour ce ticket
      notificationService.subscribeToTicket(phoneNumber, ticketId);
      
      // Commencer à surveiller le ticket
      await ticketMonitorService.monitorTicket(ticketId);
      
      console.log(`Notification de création du ticket #${ticketId} envoyée à ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'envoi de la notification de création du ticket #${ticketId}:`, error);
      return false;
    }
  }
};

module.exports = ticketMonitorService;
