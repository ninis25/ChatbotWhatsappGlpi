/**
 * Service pour la gestion des menus du chatbot
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
    const message = "📝 *Création de ticket*\n\nVeuillez choisir le mode de création :\n\n" +
                   "🤖 *Mode IA* - Décrivez simplement votre problème en langage naturel\n" +
                   "📋 *Mode guidé* - Création pas à pas avec des questions précises";

    // Boutons pour les différents modes
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
    const message = "🔔 *Gestion des abonnements*\n\n" +
                   "Gérez vos abonnements aux notifications de tickets :\n\n" +
                   "• Voir vos abonnements actuels\n" +
                   "• S'abonner à un nouveau ticket\n" +
                   "• Se désabonner d'un ticket";

    // Boutons pour les différentes options
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
          title: "➕ S'abonner"
        }
      },
      {
        type: "reply",
        reply: {
          id: "remove_subscription",
          title: "➖ Se désabonner"
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
    const message = "🔍 *Suivi de tickets*\n\n" +
                   "Suivez et gérez vos tickets existants :\n\n" +
                   "• Consulter un ticket par son numéro\n" +
                   "• Rechercher des tickets par critères\n" +
                   "• Voir vos tickets récents";

    // Récupérer la session pour vérifier les tickets récents
    const session = await sessionManager.getSession(from) || {};
    const recentTickets = session.recentTickets || [];
    
    // Boutons pour les différentes options
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
      }
    ];
    
    // Ajouter un bouton pour les tickets récents s'il y en a
    if (recentTickets.length > 0) {
      buttons.push({
        type: "reply",
        reply: {
          id: "recent_tickets",
          title: "🕒 Tickets récents"
        }
      });
    }
    
    // Ajouter le bouton de retour au menu principal
    buttons.push({
      type: "reply",
      reply: {
        id: "back_to_menu",
        title: "🏠 Menu principal"
      }
    });

    await whatsappService.sendButtonsMessage(from, message, buttons, "Suivi de tickets");
    
    // Mettre à jour la session
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

module.exports = {
  presentTicketCreationMenu,
  presentSubscriptionsMenu,
  presentTicketTrackingMenu
};
