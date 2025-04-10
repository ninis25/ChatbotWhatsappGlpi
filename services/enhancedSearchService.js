/**
 * Service pour les fonctionnalités de recherche améliorées
 */
const whatsappService = require('./whatsappService');
const sessionManager = require('./sessionManager');
const glpiService = require('./glpiService');
const notificationService = require('./notificationService');

/**
 * Démarre le mode recherche par ID de ticket avec une interface améliorée
 * @param {string} from - Le numéro de téléphone de l'utilisateur
 */
async function startEnhancedTicketSearch(from) {
  try {
    console.log(`Démarrage de la recherche améliorée par ID pour ${from}`);

    // Récupérer la session existante pour vérifier les tickets récents
    let userSession = await sessionManager.getSession(from);
    
    // Créer une session avec un état initial de recherche
    userSession = {
      ...userSession,
      currentStep: 'search_by_id',
      searchMode: true
    };
    await sessionManager.saveSession(from, userSession);

    // Envoyer un message demandant l'ID du ticket avec des instructions claires
    const message = "🔎 *Recherche de ticket par ID*\n\nVeuillez entrer le numéro du ticket que vous souhaitez rechercher.\n\nExemple: 12345\n\nℹ️ Vous pouvez aussi utiliser les boutons ci-dessous pour accéder rapidement à des options.";

    // Préparer les boutons pour une meilleure UX
    const buttons = [];
    
    // Ajouter des boutons pour les tickets récents si disponibles
    if (userSession.lastCreatedTicketId) {
      buttons.push({
        type: "reply",
        reply: {
          id: `search_ticket_${userSession.lastCreatedTicketId}`,
          title: `🎟 Dernier ticket #${userSession.lastCreatedTicketId}`
        }
      });
    }
    
    // Ajouter des boutons pour les tickets récemment consultés
    const recentTickets = userSession.recentTickets || [];
    if (recentTickets.length > 0) {
      // Limiter à 2 tickets récents pour ne pas surcharger l'interface
      const recentTicketButtons = recentTickets.slice(0, 2).map(ticketId => ({
        type: "reply",
        reply: {
          id: `search_ticket_${ticketId}`,
          title: `🔍 Ticket #${ticketId}`
        }
      }));
      buttons.push(...recentTicketButtons);
    }
    
    // Ajouter des boutons pour les options de navigation
    buttons.push(
      {
        type: "reply",
        reply: {
          id: "track_ticket",
          title: "📝 Suivre un ticket"
        }
      },
      {
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }
    );

    await whatsappService.sendButtonsMessage(from, message, buttons, "Recherche ticket");
  } catch (error) {
    console.error(`Erreur lors du démarrage de la recherche améliorée pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

/**
 * Affiche les détails d'un ticket avec des options interactives améliorées
 * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
 * @param {number} ticketId - ID du ticket à afficher
 */
async function displayEnhancedTicketDetails(phoneNumber, ticketId) {
  try {
    // Récupérer les détails du ticket
    const ticketDetails = await glpiService.getTicket(ticketId);
    
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
    let message = `🎫 *Ticket #${ticketId}*\n\n`;
    message += `📋 *Titre:* ${ticketDetails.name}\n`;
    message += `📝 *Description:* ${ticketDetails.content}\n`;
    message += `🔄 *Statut:* ${ticketDetails.status}\n`;
    message += `⏱️ *Urgence:* ${ticketDetails.urgency}\n`;
    message += `📅 *Date d'ouverture:* ${new Date(ticketDetails.date).toLocaleString()}\n`;
    
    if (ticketDetails.technicians && ticketDetails.technicians.length > 0) {
      message += `👨‍💻 *Technicien(s):* ${ticketDetails.technicians.join(', ')}\n`;
    }
    
    // Préparer les boutons d'action (première ligne)
    const actionButtons = [
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
    
    // Préparer les boutons d'attribution (deuxième ligne)
    const assignButtons = [
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
          id: isSubscribed ? `unsubscribe_ticket_${ticketId}` : `subscribe_ticket_${ticketId}`,
          title: isSubscribed ? "🔕 Se désabonner" : "🔔 S'abonner"
        }
      }
    ];
    
    // Préparer les boutons de navigation (troisième ligne)
    const navigationButtons = [
      {
        type: "reply",
        reply: {
          id: `track_another_ticket`,
          title: "🔍 Autre ticket"
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
    
    // Combiner tous les boutons
    const allButtons = [...actionButtons, ...assignButtons, ...navigationButtons];
    
    // Envoyer le message avec les boutons
    await whatsappService.sendButtonsMessage(
      phoneNumber,
      "Détails du ticket",
      message,
      allButtons
    );
    
    // Sauvegarder ce ticket dans la liste des tickets récemment consultés
    const userSession = await sessionManager.getSession(phoneNumber);
    const recentTickets = userSession.recentTickets || [];
    
    // Ajouter le ticket actuel en tête de liste et limiter à 5 tickets
    if (!recentTickets.includes(ticketId)) {
      recentTickets.unshift(ticketId);
      if (recentTickets.length > 5) {
        recentTickets.pop();
      }
    }
    
    // Mettre à jour la session
    userSession.recentTickets = recentTickets;
    await sessionManager.saveSession(phoneNumber, userSession);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage des détails du ticket ${ticketId} pour ${phoneNumber}:`, error);
    await whatsappService.sendMessage(
      phoneNumber,
      `❌ Une erreur s'est produite lors de l'affichage des détails du ticket #${ticketId}. Veuillez réessayer plus tard.`
    );
  }
}

module.exports = {
  startEnhancedTicketSearch,
  displayEnhancedTicketDetails
};
