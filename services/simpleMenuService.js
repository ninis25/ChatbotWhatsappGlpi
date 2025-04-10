/**
 * Service pour la gestion des menus simplifiés du chatbot
 */
const whatsappService = require('./whatsappService');
const sessionManager = require('./sessionManager');

/**
 * Affiche le menu de création de ticket avec les options mode guidé et mode IA
 * @param {string} from - Numéro de téléphone de l'utilisateur
 */
async function presentTicketCreationMenu(from) {
  try {
    console.log(`Présentation du menu de création de ticket à ${from}`);

    // Message explicatif pour les différents modes de création de ticket
    const message = "📝 *Création de ticket*\n\nVeuillez choisir le mode de création :";

    // Boutons pour les différents modes (maximum 3 boutons)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "create_ticket_ai",
          title: "🤖 Mode IA"
        }
      },
      {
        type: "reply",
        reply: {
          id: "create_ticket_guided",
          title: "📋 Mode guidé"
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

    await whatsappService.sendButtonsMessage(from, message, buttons, "Création de ticket");
    
    // Mettre à jour la session
    const session = await sessionManager.getSession(from) || {};
    session.currentStep = 'ticket_creation_menu';
    await sessionManager.saveSession(from, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage du menu de création de ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

/**
 * Affiche le menu des abonnements avec les différentes options
 * @param {string} from - Numéro de téléphone de l'utilisateur
 */
async function presentSubscriptionsMenu(from) {
  try {
    console.log(`Présentation du menu des abonnements à ${from}`);

    // Message explicatif pour le menu des abonnements
    const message = "🔔 *Gestion des abonnements*\n\nGérez vos abonnements aux notifications de tickets :";

    // Boutons pour les différentes options (maximum 3 boutons)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "view_my_subscriptions",
          title: "📋 Voir mes abonnements"
        }
      },
      {
        type: "reply",
        reply: {
          id: "add_subscription",
          title: "➕ S'abonner à un ticket"
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

    await whatsappService.sendButtonsMessage(from, message, buttons, "Gestion des abonnements");
    
    // Mettre à jour la session
    const session = await sessionManager.getSession(from) || {};
    session.currentStep = 'subscriptions_menu';
    await sessionManager.saveSession(from, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage du menu des abonnements pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

/**
 * Affiche le menu de suivi de tickets avec les différentes options
 * @param {string} from - Numéro de téléphone de l'utilisateur
 */
async function presentTicketTrackingMenu(from) {
  try {
    console.log(`Présentation du menu de suivi de tickets à ${from}`);

    // Message explicatif pour le menu de suivi de tickets
    const message = "🔍 *Suivi de tickets*\n\nConsultez et gérez vos tickets existants :";

    // Boutons pour les différentes options (maximum 3 boutons)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "track_ticket_by_id",
          title: "🔢 Consulter par numéro"
        }
      },
      {
        type: "reply",
        reply: {
          id: "search_tickets",
          title: "🔎 Rechercher tickets"
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

    await whatsappService.sendButtonsMessage(from, message, buttons, "Suivi de tickets");
    
    // Mettre à jour la session
    const session = await sessionManager.getSession(from) || {};
    session.currentStep = 'ticket_tracking_menu';
    await sessionManager.saveSession(from, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage du menu de suivi de tickets pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

/**
 * Affiche le menu des options de suppression d'abonnement
 * @param {string} from - Numéro de téléphone de l'utilisateur
 */
async function presentUnsubscribeMenu(from) {
  try {
    console.log(`Présentation du menu de suppression d'abonnement à ${from}`);

    // Message explicatif pour la suppression d'abonnement
    const message = "❌ *Supprimer un abonnement*\n\nVeuillez entrer le numéro du ticket auquel vous souhaitez vous désabonner.";

    // Boutons pour les options (maximum 3 boutons)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "view_my_subscriptions",
          title: "📋 Voir mes abonnements"
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

    await whatsappService.sendButtonsMessage(from, message, buttons, "Supprimer abonnement");
    
    // Mettre à jour la session
    const session = await sessionManager.getSession(from) || {};
    session.currentStep = 'remove_subscription';
    await sessionManager.saveSession(from, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage du menu de suppression d'abonnement pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

module.exports = {
  presentTicketCreationMenu,
  presentSubscriptionsMenu,
  presentTicketTrackingMenu,
  presentUnsubscribeMenu
};
