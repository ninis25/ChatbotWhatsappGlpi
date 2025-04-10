/**
 * Service de gestion des notifications pour les tickets GLPI
 * Permet d'envoyer des notifications aux utilisateurs lorsque des tickets sont mis à jour
 */

const whatsappService = require('./whatsappService');
const sessionManager = require('./sessionManager');
const ticketTrackingService = require('./ticketTrackingService');
const glpiService = require('./glpiService');

// Stockage des abonnements aux tickets
// Format: { phoneNumber: [ticketIds] }
const userSubscriptions = {};

const notificationService = {
  /**
   * S'abonner aux mises à jour d'un ticket
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket
   * @returns {boolean} - True si l'abonnement a réussi
   */
  subscribeToTicket: (phoneNumber, ticketId) => {
    try {
      // Convertir en nombre
      const ticketIdNum = parseInt(ticketId);
      
      if (isNaN(ticketIdNum)) {
        throw new Error("ID de ticket invalide");
      }
      
      // Initialiser le tableau d'abonnements pour cet utilisateur si nécessaire
      if (!userSubscriptions[phoneNumber]) {
        userSubscriptions[phoneNumber] = [];
      }
      
      // Vérifier si l'utilisateur est déjà abonné à ce ticket
      if (!userSubscriptions[phoneNumber].includes(ticketIdNum)) {
        userSubscriptions[phoneNumber].push(ticketIdNum);
        console.log(`Utilisateur ${phoneNumber} abonné au ticket #${ticketIdNum}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'abonnement au ticket ${ticketId}:`, error);
      return false;
    }
  },
  
  /**
   * Se désabonner des mises à jour d'un ticket
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket
   * @returns {boolean} - True si le désabonnement a réussi
   */
  unsubscribeFromTicket: (phoneNumber, ticketId) => {
    try {
      // Convertir en nombre
      const ticketIdNum = parseInt(ticketId);
      
      if (isNaN(ticketIdNum) || !userSubscriptions[phoneNumber]) {
        return false;
      }
      
      // Supprimer le ticket de la liste des abonnements de l'utilisateur
      const index = userSubscriptions[phoneNumber].indexOf(ticketIdNum);
      if (index !== -1) {
        userSubscriptions[phoneNumber].splice(index, 1);
        console.log(`Utilisateur ${phoneNumber} désabonné du ticket #${ticketIdNum}`);
        
        // Supprimer l'utilisateur de la liste si plus aucun abonnement
        if (userSubscriptions[phoneNumber].length === 0) {
          delete userSubscriptions[phoneNumber];
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors du désabonnement du ticket ${ticketId}:`, error);
      return false;
    }
  },
  
  /**
   * Vérifier si un utilisateur est abonné à un ticket
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket
   * @returns {boolean} - True si l'utilisateur est abonné
   */
  isSubscribed: (phoneNumber, ticketId) => {
    const ticketIdNum = parseInt(ticketId);
    
    if (isNaN(ticketIdNum) || !userSubscriptions[phoneNumber]) {
      return false;
    }
    
    return userSubscriptions[phoneNumber].includes(ticketIdNum);
  },
  
  /**
   * Notifier tous les abonnés d'un ticket
   * @param {number} ticketId - ID du ticket
   * @param {string} updateType - Type de mise à jour (status, comment, assignment)
   * @param {Object} updateData - Données de la mise à jour
   * @returns {Promise<boolean>} - True si les notifications ont été envoyées
   */
  notifyTicketSubscribers: async (ticketId, updateType, updateData) => {
    try {
      const ticketIdNum = parseInt(ticketId);
      
      if (isNaN(ticketIdNum)) {
        return false;
      }
      
      // Trouver tous les utilisateurs abonnés à ce ticket
      const subscribers = [];
      for (const [phoneNumber, subscriptions] of Object.entries(userSubscriptions)) {
        if (subscriptions.includes(ticketIdNum)) {
          subscribers.push(phoneNumber);
        }
      }
      
      if (subscribers.length === 0) {
        return false; // Aucun abonné pour ce ticket
      }
      
      // Récupérer les détails du ticket
      const ticketDetails = await ticketTrackingService.getTicketDetails(ticketIdNum);
      
      // Préparer le message de notification en fonction du type de mise à jour
      let notificationMessage = `🔔 *Mise à jour du ticket #${ticketIdNum}*\n\n`;
      
      // Ajouter le titre du ticket
      notificationMessage += `📋 *Titre:* ${ticketDetails.title}\n\n`;
      
      switch (updateType) {
        case 'status':
          notificationMessage += `🚦 *Le statut du ticket a été modifié*\n\n`;
          notificationMessage += `⬅️ Ancien statut: *${glpiService.getTicketStatusName(updateData.previousStatus)}*\n`;
          notificationMessage += `➡️ Nouveau statut: *${glpiService.getTicketStatusName(updateData.status)}*\n`;
          break;
          
        case 'comment':
          notificationMessage += `💬 *Un nouveau commentaire a été ajouté*\n\n`;
          notificationMessage += `"${updateData.content.substring(0, 200)}${updateData.content.length > 200 ? '...' : ''}"\n\n`;
          notificationMessage += `👤 Ajouté par: *${updateData.author || 'Un utilisateur'}*\n`;
          break;
          
        case 'assignment':
          if (updateData.userId) {
            notificationMessage += `👤 *Le ticket a été assigné à un technicien*\n\n`;
            notificationMessage += `Technicien: *${updateData.userName || `ID: ${updateData.userId}`}*\n`;
          } else if (updateData.groupId) {
            notificationMessage += `👥 *Le ticket a été assigné à un groupe*\n\n`;
            notificationMessage += `Groupe: *${updateData.groupName || `ID: ${updateData.groupId}`}*\n`;
          }
          break;
        
        case 'requester':
          notificationMessage += `👤 *Un nouveau demandeur a été ajouté au ticket*\n\n`;
          notificationMessage += `Demandeur: *${updateData.requesterName || 'Non spécifié'}*\n`;
          break;
          
        default:
          notificationMessage += `ℹ️ *Le ticket a été mis à jour*\n`;
      }
      
      // Ajouter la date et l'heure de la mise à jour
      const now = new Date();
      notificationMessage += `\n📅 *Date:* ${now.toLocaleDateString('fr-FR')}`;
      notificationMessage += `\n⏰ *Heure:* ${now.toLocaleTimeString('fr-FR')}`;
      
      // Créer les boutons pour les actions rapides
      const buttons = [
        {
          type: "reply",
          reply: {
            id: `track_ticket_${ticketIdNum}`,
            title: "Voir détails"
          }
        },
        {
          type: "reply",
          reply: {
            id: `view_comments_${ticketIdNum}`,
            title: "Commentaires"
          }
        },
        {
          type: "reply",
          reply: {
            id: `comment_ticket_${ticketIdNum}`,
            title: "Commenter"
          }
        }
      ];
      
      // Envoyer la notification à tous les abonnés
      for (const phoneNumber of subscribers) {
        await whatsappService.sendButtonsMessage(phoneNumber, notificationMessage, buttons, "Mise à jour du ticket");
      }
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'envoi des notifications pour le ticket ${ticketId}:`, error);
      return false;
    }
  },
  
  /**
   * Obtenir la liste des tickets auxquels un utilisateur est abonné
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @returns {Array<number>} - Liste des IDs de tickets
   */
  getUserSubscriptions: (phoneNumber) => {
    // Si l'utilisateur n'a pas d'abonnements, retourner un tableau vide
    if (!userSubscriptions[phoneNumber]) {
      return [];
    }
    
    // Retourner directement la liste des tickets auxquels l'utilisateur est abonné
    return [...userSubscriptions[phoneNumber]];
  },
  
  /**
   * Obtenir la liste des abonnés à un ticket
   * @param {number} ticketId - ID du ticket
   * @returns {Array<string>} - Liste des numéros de téléphone
   */
  getTicketSubscribers: (ticketId) => {
    const ticketIdNum = parseInt(ticketId);
    const subscribers = [];
    
    if (isNaN(ticketIdNum)) {
      return [];
    }
    
    // Parcourir tous les utilisateurs et vérifier s'ils sont abonnés à ce ticket
    for (const [phoneNumber, subscriptions] of Object.entries(userSubscriptions)) {
      if (subscriptions.includes(ticketIdNum)) {
        subscribers.push(phoneNumber);
      }
    }
    
    return subscribers;
  },
  
  /**
   * Formater un message pour afficher les abonnements d'un utilisateur
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @returns {Promise<Object>} - Message formaté et boutons
   */
  formatUserSubscriptionsMessage: async (phoneNumber) => {
    try {
      // Récupérer les abonnements de l'utilisateur
      const userSubscriptions = notificationService.getUserSubscriptions(phoneNumber);
      
      if (userSubscriptions.length === 0) {
        return {
          message: "🔔 *Système d'Abonnements*\n\n*Qu'est-ce que c'est ?*\nLes abonnements vous permettent de suivre automatiquement les mises à jour de vos tickets importants.\n\n*Avantages :*\n• Recevez des notifications instantanées\n• Suivez les changements de statut\n• Soyez informé des nouveaux commentaires\n\n*Statut actuel :*\nVous n'êtes actuellement abonné à aucun ticket.\n\n*Menu Abonnements :*\nChoisissez une des trois options ci-dessous.",
          buttons: [
            {
              type: "reply",
              reply: {
                id: "view_subscriptions",
                title: "🔍 Voir mes abonnements"
              }
            },
            {
              type: "reply",
              reply: {
                id: "add_subscription",
                title: "➕ Ajouter un abonnement"
              }
            },
            {
              type: "reply",
              reply: {
                id: "remove_subscription",
                title: "❌ Supprimer un abonnement"
              }
            },
            {
              type: "reply",
              reply: {
                id: "back_to_menu",
                title: "🏠 Menu principal"
              }
            }
          ]
        };
      }
      
      // Récupérer les détails des tickets
      let message = "🔔 *Vos Abonnements Actifs*\n\n*Fonctionnement :*\nVous recevrez des notifications automatiques pour tous les tickets listés ci-dessous.\n\n*Vos tickets suivis :*\n";
      const ticketButtons = [];
      
      for (const ticketId of userSubscriptions) {
        try {
          const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
          
          if (ticketDetails) {
            // Ajouter les informations du ticket au message
            message += `🎟 *Ticket #${ticketId}*\n`;
            message += `📋 Titre: ${ticketDetails.title || ticketDetails.name}\n`;
            message += `🚦 Statut: ${glpiService.getTicketStatusName(ticketDetails.status)}\n\n`;
            
            // Ajouter des boutons pour ce ticket (limité à 3 tickets)
            if (ticketButtons.length < 3) {
              // Bouton pour consulter le ticket
              ticketButtons.push({
                id: `track_ticket_${ticketId}`,
                title: `🔍 Ticket #${ticketId}`
              });
              
              // Bouton pour se désabonner du ticket
              ticketButtons.push({
                id: `unsub_ticket_${ticketId}`,
                title: `❌ Désabo #${ticketId}`
              });
            }
          } else {
            message += `🎟 *Ticket #${ticketId}* (Détails non disponibles)\n\n`;
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération des détails du ticket ${ticketId}:`, error);
          message += `🎟 *Ticket #${ticketId}* (Erreur lors de la récupération des détails)\n\n`;
        }
      }
      
      // Ajouter un message d'instructions pour la gestion des abonnements
      message += "\n*Menu Abonnements :*\n";
      message += "Choisissez une des trois options ci-dessous.\n";
      
      // Ajouter uniquement les 3 boutons demandés + menu
      const buttons = [
        {
          type: "reply",
          reply: {
            id: "view_subscriptions",
            title: "🔍 Voir mes abonnements"
          }
        },
        {
          type: "reply",
          reply: {
            id: "add_subscription",
            title: "➕ Ajouter un abonnement"
          }
        },
        {
          type: "reply",
          reply: {
            id: "remove_subscription",
            title: "❌ Supprimer un abonnement"
          }
        },
        {
          type: "reply",
          reply: {
            id: "back_to_menu",
            title: "🏠 Menu principal"
          }
        }
      ];
      
      return {
        message,
        buttons
      };
    } catch (error) {
      console.error(`Erreur lors de la formatation du message d'abonnements pour ${phoneNumber}:`, error);
      return {
        message: "❗ Une erreur s'est produite lors de la récupération de vos abonnements. Veuillez réessayer plus tard.",
        buttons: [
          {
            type: "reply",
            reply: {
              id: "back_to_menu",
              title: "Menu principal"
            }
          }
        ]
      };
    }
  },
  
  /**
   * Déclencher une notification pour un ticket mis à jour
   * @param {number} ticketId - ID du ticket
   * @param {string} updateType - Type de mise à jour (status, comment, assignment, requester, close)
   * @param {Object} updateData - Données de la mise à jour
   * @returns {Promise<boolean>} - True si la notification a été envoyée
   */
  triggerTicketUpdateNotification: async (ticketId, updateType, updateData = {}) => {
    try {
      console.log(`Déclenchement d'une notification pour le ticket #${ticketId}, type: ${updateType}`);
      
      // Vérifier s'il y a des abonnés pour ce ticket
      const subscribers = notificationService.getTicketSubscribers(ticketId);
      
      if (subscribers.length === 0) {
        console.log(`Aucun abonné pour le ticket #${ticketId}, notification non envoyée`);
        return false;
      }
      
      // Envoyer la notification aux abonnés
      return await notificationService.notifyTicketSubscribers(ticketId, updateType, updateData);
    } catch (error) {
      console.error(`Erreur lors du déclenchement de la notification pour le ticket ${ticketId}:`, error);
      return false;
    }
  },
  
  /**
   * Vérifier si un utilisateur est abonné à un ticket
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {number} ticketId - ID du ticket
   * @returns {boolean} - True si l'utilisateur est abonné
   */
  isSubscribedToTicket: (phoneNumber, ticketId) => {
    return notificationService.isSubscribed(phoneNumber, ticketId);
  }
};

module.exports = notificationService;
