/**
 * Service pour la gestion des tickets récemment consultés
 */
const whatsappService = require('./whatsappService');
const sessionManager = require('./sessionManager');
const glpiService = require('./glpiService');

/**
 * Affiche les tickets récemment consultés par l'utilisateur
 * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
 */
async function displayRecentTickets(phoneNumber) {
  try {
    console.log(`Affichage des tickets récents pour ${phoneNumber}`);
    
    // Récupérer la session de l'utilisateur
    const session = await sessionManager.getSession(phoneNumber);
    
    // Vérifier si l'utilisateur a des tickets récents
    const recentTickets = session.recentTickets || [];
    
    if (recentTickets.length === 0) {
      // Aucun ticket récent
      await whatsappService.sendMessage(
        phoneNumber,
        "📋 *Tickets récents*\n\nVous n'avez pas encore consulté de tickets. Utilisez l'option 'Consulter par numéro' pour suivre un ticket spécifique."
      );
      
      // Proposer de retourner au menu de suivi
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
            id: "back_to_menu",
            title: "🏠 Menu principal"
          }
        }
      ];
      
      await whatsappService.sendButtonsMessage(
        phoneNumber,
        "Que souhaitez-vous faire ?",
        buttons,
        "Options"
      );
      
      return;
    }
    
    // Récupérer les détails des tickets récents (maximum 5)
    const ticketsToShow = recentTickets.slice(0, 5);
    let message = "📋 *Vos tickets récents*\n\nSélectionnez un ticket pour voir ses détails :\n\n";
    
    // Créer les boutons pour chaque ticket récent
    const buttons = [];
    
    // Pour chaque ticket, récupérer son titre
    for (const ticketId of ticketsToShow) {
      try {
        // Récupérer les informations de base du ticket
        const ticketData = await glpiService.getTicket(ticketId);
        
        if (ticketData) {
          // Ajouter un bouton pour ce ticket
          buttons.push({
            type: "reply",
            reply: {
              id: `view_ticket_${ticketId}`,
              title: `#${ticketId} - ${ticketData.name.substring(0, 20)}${ticketData.name.length > 20 ? '...' : ''}`
            }
          });
          
          // Ajouter les informations du ticket au message
          message += `• *Ticket #${ticketId}*: ${ticketData.name}\n   État: ${ticketData.status}\n\n`;
        }
      } catch (error) {
        console.error(`Erreur lors de la récupération des détails du ticket ${ticketId}:`, error);
        message += `• *Ticket #${ticketId}*: Détails non disponibles\n\n`;
      }
    }
    
    // Ajouter un bouton pour retourner au menu
    buttons.push({
      type: "reply",
      reply: {
        id: "back_to_tracking_menu",
        title: "⬅️ Retour"
      }
    });
    
    // Envoyer le message avec les boutons
    await whatsappService.sendButtonsMessage(
      phoneNumber,
      "Tickets récents",
      message,
      buttons
    );
    
    // Mettre à jour la session
    session.currentStep = 'viewing_recent_tickets';
    await sessionManager.saveSession(phoneNumber, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage des tickets récents pour ${phoneNumber}:`, error);
    await whatsappService.sendMessage(
      phoneNumber,
      "Désolé, une erreur s'est produite lors de l'affichage de vos tickets récents. Veuillez réessayer plus tard."
    );
  }
}

module.exports = {
  displayRecentTickets
};
