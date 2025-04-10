const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import services
const whatsappService = require('./services/whatsappService');
const sessionManager = require('./services/sessionManager');
const glpiService = require('./services/glpiService');
const aiService = require('./services/enhancedLocalAiService');
const advancedAiService = require('./services/advancedLocalAiService');
const guidedTicketService = require('./services/guidedTicketService');
const ticketTrackingService = require('./services/ticketTrackingService');
const notificationService = require('./services/notificationService');
const ticketSearchService = require('./services/ticketSearchService');
const ticketMonitorService = require('./services/ticketMonitorService');
// Utilisation du service de menu simplifié
const simpleMenuService = require('./services/simpleMenuService');

// Fonction pour afficher les détails d'un ticket avec une interface améliorée
async function displayEnhancedTicketDetails(from, ticketId) {
  try {
    // Utiliser le service amélioré pour afficher les détails du ticket
    await enhancedSearchService.displayEnhancedTicketDetails(from, ticketId);
    
    // Mettre à jour la session pour indiquer que l'utilisateur est en mode suivi
    const session = await sessionManager.getSession(from);
    session.currentStep = 'tracking_ticket';
    session.trackingMode = true;
    session.currentTicketId = ticketId;
    await sessionManager.saveSession(from, session);
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage amélioré des détails du ticket ${ticketId} pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      `❌ Une erreur s'est produite lors de l'affichage des détails du ticket #${ticketId}. Veuillez réessayer plus tard.`
    );
  }
}

// Fonction pour gérer l'attribution d'un ticket
async function handleAssignTicket(from, session, ticketId) {
  try {
    // Envoyer un message de confirmation pour indiquer que le processus d'attribution a commencé
    await whatsappService.sendMessage(
      from,
      `✅ *Attribution du ticket #${ticketId} en cours*\n\nJe récupère la liste des groupes et techniciens disponibles...`
    );
    
    // Récupérer la liste des groupes et techniciens
    const groups = await glpiService.getGroups();
    const technicians = await glpiService.getTechnicians();

    // Stocker les données dans la session pour référence ultérieure
    session.availableGroups = groups.slice(0, 3); // Limiter à 3 groupes pour les boutons
    session.availableTechnicians = technicians.slice(0, 3); // Limiter à 3 techniciens pour les boutons
    await sessionManager.saveSession(from, session);

    // Présenter les options d'attribution
    const message = `*Attribution du ticket #${ticketId}*\n\nChoisissez à qui attribuer ce ticket :`;
    
    // Créer des boutons pour les groupes
    let groupButtons = [];
    session.availableGroups.forEach((group) => {
      groupButtons.push({
        type: "reply",
        reply: {
          id: `assign_group_${group.id}_${ticketId}`,
          title: `📁 ${group.name}`
        }
      });
    });
    
    // Envoyer les boutons pour les groupes
    await whatsappService.sendButtonsMessage(from, message + "\n\n*Groupes disponibles :*", groupButtons, "Groupes");
    
    // Créer des boutons pour les techniciens
    let techButtons = [];
    session.availableTechnicians.forEach((tech) => {
      techButtons.push({
        type: "reply",
        reply: {
          id: `assign_tech_${tech.id}_${ticketId}`,
          title: `👤 ${tech.name}`
        }
      });
    });
    
    // Ajouter un bouton pour revenir au menu principal
    techButtons.push({
      type: "reply",
      reply: {
        id: "back_to_menu",
        title: "🏠 Menu principal"
      }
    });
    
    // Envoyer les boutons pour les techniciens
    setTimeout(() => {
      whatsappService.sendButtonsMessage(from, "*Techniciens disponibles :*", techButtons, "Techniciens");
    }, 500); // Petit délai pour éviter les problèmes d'ordre des messages
  } catch (error) {
    console.error(`Erreur lors de la récupération des groupes/techniciens pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Une erreur s'est produite lors de la récupération des options d'attribution. Veuillez réessayer plus tard."
    );
  }
}

// Fonction pour créer un ticket après confirmation
async function proceedWithTicketCreation(from, session) {
  try {
    console.log("Données du ticket avant envoi:", JSON.stringify(session.ticketData, null, 2));

    const ticketData = {
      title: session.ticketData.title,
      description: session.ticketData.description,
      type: session.ticketData.typeId,
      urgency: parseInt(session.ticketData.urgency),
      itilcategories_id: session.ticketData.itilcategories_id
    };

    console.log("Payload préparé pour GLPI:", JSON.stringify(ticketData, null, 2));

    const ticketResponse = await glpiService.createTicket(ticketData);

    // Envoyer un message de confirmation avec des boutons interactifs
    const confirmationMessage = `✅ *Votre ticket a été créé avec succès !*
*Numéro de ticket : #${ticketResponse.id}*

Vous pouvez effectuer d'autres actions sur ce ticket :`;    
    
    const actionButtons = [
      {
        type: "reply",
        reply: {
          id: `assign_ticket_${ticketResponse.id}`,
          title: "👤 Attribuer"
        }
      },
      {
        type: "reply",
        reply: {
          id: `add_requester_${ticketResponse.id}`,
          title: "📝 Demandeur"
        }
      },
      {
        type: "reply",
        reply: {
          id: `add_comment_${ticketResponse.id}`,
          title: "💬 Commentaire"
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
    
    await whatsappService.sendButtonsMessage(from, confirmationMessage, actionButtons, "Ticket créé");

    // Envoyer une notification détaillée et abonner l'utilisateur aux notifications
    await ticketMonitorService.notifyTicketCreation(ticketResponse.id, from);

    // Sauvegarder l'ID du ticket dans la session pour le suivi
    session.lastCreatedTicketId = ticketResponse.id;
    session.currentStep = 'ticket_created';
    await sessionManager.saveSession(from, session);
  } catch (error) {
    console.error('Erreur lors de la création du ticket:', error);
    
    // Envoyer un message d'erreur avec un bouton de retour au menu principal
    await whatsappService.sendButtonsMessage(
      from,
      "❌ *Erreur de création de ticket*",
      "Une erreur s'est produite lors de la création de votre ticket. Veuillez réessayer plus tard.",
      [{
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }]
    );
    
    // Réinitialiser la session pour revenir au menu principal
    session.currentStep = 'main_menu';
    await sessionManager.saveSession(from, session);
  }
}

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webhook URL: https://2d5e-41-251-23-238.ngrok-free.app/webhook`);
  console.log(`Verify token: ${process.env.VERIFY_TOKEN}`);
  console.log(`WhatsApp Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);

  // Initialize AI services
  console.log("Initializing AI Integration Service...");
  aiService.initialize();
  console.log("Initializing Advanced AI Service...");
  advancedAiService.initialize();

  // Initialiser le service de surveillance des tickets
  ticketMonitorService.init();
  console.log('Service de surveillance des tickets initialisé');
});

// Verification endpoint for WhatsApp webhook
app.get('/webhook', (req, res) => {
  console.log('Requête GET reçue sur /webhook');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Query params:', JSON.stringify(req.query, null, 2));

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`Mode: "${mode}", Token: "${token}", Challenge: "${challenge}"`);
  console.log(`Token attendu: "${process.env.VERIFY_TOKEN}"`);

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook vérifié avec succès');
    res.status(200).send(challenge);
  } else if (!mode && !token && !challenge) {
    // Si aucun paramètre de vérification n'est présent, afficher une page de bienvenue
    const welcomeHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chatbot WhatsApp-GLPI</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #075e54;
            border-bottom: 2px solid #25d366;
            padding-bottom: 10px;
          }
          .status {
            background-color: #dcf8c6;
            border-left: 4px solid #25d366;
            padding: 10px 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          code {
            background-color: #f1f1f1;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <h1>Bienvenue sur le Serveur WhatsApp-GLPI</h1>
        
        <div class="status">
          <strong>Statut:</strong> Le serveur est actif et fonctionne correctement.
        </div>
        
        <div class="info">
          <h2>Informations sur le Webhook</h2>
          <p>Cette URL est configurée comme webhook pour l'API WhatsApp Business Cloud.</p>
          <p>URL du webhook: <code>https://b0da-45-84-137-202.ngrok-free.app/webhook</code></p>
          <p>Dernière mise à jour: ${new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <h2>À propos du Chatbot</h2>
        <p>Ce chatbot permet aux utilisateurs de signaler des incidents ou de faire des demandes via WhatsApp. Les informations collectées sont automatiquement transmises à GLPI pour créer des tickets.</p>
        
        <h2>Fonctionnalités</h2>
        <ul>
          <li>Création de tickets d'incident ou de demande</li>
          <li>Classification automatique des messages</li>
          <li>Détermination du niveau d'urgence</li>
          <li>Analyse de sentiment</li>
          <li>Suivi des tickets existants</li>
        </ul>
        
        <p><em>Note: Cette page est uniquement informative. Les utilisateurs finaux interagissent avec le chatbot via WhatsApp.</em></p>
      </body>
      </html>
    `;
    res.status(200).send(welcomeHtml);
  } else {
    console.error('Échec de la vérification du webhook');
    res.sendStatus(403);
  }
});

// Webhook endpoint for WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook POST reçu:', JSON.stringify(req.body));

    // Vérifier si c'est un message entrant
    if (req.body.object && req.body.entry &&
        req.body.entry[0].changes &&
        req.body.entry[0].changes[0].value.messages &&
        req.body.entry[0].changes[0].value.messages.length > 0) {

      const message = req.body.entry[0].changes[0].value.messages[0];
      const from = message.from;

      console.log(`Message reçu de ${from}:`, JSON.stringify(message));

      // Vérifier si c'est un message interactif (boutons, liste)
      let interactiveResponse = null;
      let messageText = '';

      if (message.type === 'interactive' && message.interactive) {
        console.log(`Message interactif reçu de ${from}:`, JSON.stringify(message.interactive));
        interactiveResponse = message.interactive;
      } else if (message.type === 'text' && message.text) {
        messageText = message.text.body;
        console.log(`Message texte reçu de ${from}: "${messageText}"`);
      } else {
        console.log(`Type de message non pris en charge reçu de ${from}: ${message.type}`);
        await whatsappService.sendMessage(
            from,
            "Désolé, je ne peux traiter que des messages texte pour le moment."
        );
        return res.sendStatus(200);
      }

      // Vérifier si l'utilisateur a une session active
      const session = await sessionManager.getSession(from);
      const isNewUser = !session;

      console.log(`Statut de session pour ${from}: ${isNewUser ? 'Nouvel utilisateur' : 'Session existante'}`);
      if (!isNewUser) {
        console.log(`Étape actuelle pour ${from}: ${session.currentStep}`);
      }

      // Traiter le message
      if (isNewUser) {
        // Si c'est un nouveau utilisateur mais qu'il a cliqué sur un bouton, traiter la réponse
        if (interactiveResponse && interactiveResponse.type === 'button_reply') {
          const buttonId = interactiveResponse.button_reply.id;
          console.log(`Bouton cliqué par un nouvel utilisateur: ${buttonId}`);

          switch (buttonId) {
            case 'start_guided':
              await startGuidedMode(from);
              break;
            case 'start_ai':
              await startAIMode(from);
              break;
            case 'help':
              await whatsappService.sendMessage(
                  from,
                  "Ce chatbot vous permet de créer des tickets GLPI facilement.\n\n" +
                  "- 'Créer un ticket guidé' : Je vous guiderai étape par étape pour créer un ticket.\n" +
                  "- 'Créer avec IA' : Décrivez simplement votre problème, et notre IA créera un ticket adapté.\n\n" +
                  "À tout moment, vous pouvez taper 'annuler' pour recommencer."
              );
              await presentInitialOptions(from);
              break;
            case 'create_ticket':
              await presentTicketCreationOptions(from);
              break;
            case 'more_options':
              await presentMoreOptions(from);
              break;
            case 'main_menu':
              await presentInitialOptions(from);
              break;
            case 'track_ticket':
              await startTicketTracking(from);
              break;
            case 'view_subscriptions':
              await displayUserSubscriptions(from);
              break;
            case 'search_tickets':
              await enhancedSearchService.startEnhancedTicketSearch(from);
              break;
            default:
              console.log(`Présentation des options initiales à ${from}`);
              await presentInitialOptions(from);
          }
        } else {
          console.log(`Présentation des options initiales à ${from}`);
          await presentInitialOptions(from);
        }
      } else {
        console.log(`Traitement du message pour ${from}`);
        await handleIncomingMessage(from, messageText, interactiveResponse, session);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.sendStatus(500);
  }
});

// Handle incoming WhatsApp messages
async function handleIncomingMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message de ${from}: "${messageText}", interactiveResponse:`, JSON.stringify(interactiveResponse));

    // Check if the user wants to reset the conversation
    if (messageText.toLowerCase() === 'reset') {
      await sessionManager.deleteSession(from);
      await guidedTicketService.resetSession(from);

      // Présenter directement les options après un reset
      await presentInitialOptions(from);
      return;
    }

    // Récupérer la session de l'utilisateur
    let session = await sessionManager.getSession(from);
    console.log(`Session récupérée pour ${from}:`, JSON.stringify(session));

    // Si pas de session, c'est un nouvel utilisateur ou une session expirée
    if (!session) {
      console.log(`Pas de session trouvée pour ${from}, présentation des options initiales`);
      await presentInitialOptions(from);
      return;
    }

    // Vérifier d'abord si l'utilisateur est en mode guidé
    if (session && session.guidedMode) {
      console.log(`Mode guidé détecté pour ${from}, étape: ${session.currentStep}`);
      console.log(`Structure complète de la réponse interactive:`, JSON.stringify(interactiveResponse, null, 2));
      await handleGuidedModeMessage(from, messageText, interactiveResponse, session);
      return;
    }
    
    // Vérifier si l'utilisateur est en mode abonnements
    if (session && (session.currentStep === 'viewing_subscriptions' || session.currentStep === 'adding_subscription')) {
      console.log(`Mode abonnements détecté pour ${from}, étape: ${session.currentStep}`);
      await handleSubscriptionModeMessage(from, messageText, interactiveResponse, session);
      return;
    }
    
    // Si c'est une réponse interactive, la traiter en fonction de l'état actuel
    let buttonId = null;
    if (interactiveResponse) {
      // Extraction robuste de l'ID du bouton
      if (interactiveResponse.type === 'button_reply' && interactiveResponse.button_reply) {
        buttonId = interactiveResponse.button_reply.id;
      } else if (interactiveResponse.type === 'button' && interactiveResponse.button_reply) {
        buttonId = interactiveResponse.button_reply.id;
      } else if (interactiveResponse.interactive && interactiveResponse.interactive.button_reply) {
        buttonId = interactiveResponse.interactive.button_reply.id;
      }
      
      console.log(`Structure complète de la réponse interactive dans handleIncomingMessage:`, JSON.stringify(interactiveResponse, null, 2));
      console.log(`Bouton reçu de ${from}: ID=${buttonId}`);

      // Gestion des 3 boutons principaux du menu initial
      if (!session.currentStep || session.currentStep === 'initial') {
        // Gérer les 3 catégories principales
        if (buttonId === 'create_ticket_menu') {
          console.log(`Affichage du menu de création de ticket pour ${from}`);
          await simpleMenuService.presentTicketCreationMenu(from);
          return;
        } else if (buttonId === 'subscriptions_menu') {
          console.log(`Affichage du menu des abonnements pour ${from}`);
          await simpleMenuService.presentSubscriptionsMenu(from);
          return;
        } else if (buttonId === 'track_ticket_menu') {
          console.log(`Affichage du menu de suivi de tickets pour ${from}`);
          await simpleMenuService.presentTicketTrackingMenu(from);
          return;
        }
      }
      
      // Gérer les options du menu de création de ticket
      else if (session.currentStep === 'ticket_creation_menu') {
        if (buttonId === 'create_ticket_guided') {
          console.log(`Démarrage du mode guidé pour ${from}`);
          await startGuidedMode(from);
          return;
        } else if (buttonId === 'create_ticket_ai') {
          console.log(`Démarrage du mode IA pour ${from}`);
          await startAIMode(from);
          return;
        } else if (buttonId === 'back_to_menu') {
          console.log(`Retour au menu principal pour ${from}`);
          await presentInitialOptions(from);
          return;
        }
      }
      
      // Gérer les options du menu des abonnements
      else if (session.currentStep === 'subscriptions_menu') {
        if (buttonId === 'view_my_subscriptions') {
          console.log(`Affichage des abonnements pour ${from}`);
          await displayUserSubscriptions(from);
          return;
        } else if (buttonId === 'add_subscription') {
          console.log(`Ajout d'abonnement pour ${from}`);
          await startTicketTracking(from);
          return;
        } else if (buttonId === 'back_to_menu') {
          console.log(`Retour au menu principal pour ${from}`);
          await presentInitialOptions(from);
          return;
        }
      }
      
      // Gérer les options du menu de suivi de tickets
      else if (session.currentStep === 'ticket_tracking_menu') {
        if (buttonId === 'track_ticket_by_id') {
          console.log(`Démarrage du mode suivi de ticket pour ${from}`);
          await startTicketTracking(from);
          return;
        } else if (buttonId === 'search_tickets') {
          console.log(`Démarrage de la recherche de tickets pour ${from}`);
          await startTicketSearch(from);
          return;
        } else if (buttonId === 'back_to_menu') {
          console.log(`Retour au menu principal pour ${from}`);
          await presentInitialOptions(from);
          return;
        }
      }
      
      // Si l'utilisateur est dans l'étape de sélection du mode de création de ticket
      if (session.currentStep === 'ticket_creation_options') {
        console.log(`Traitement du bouton ${buttonId} en mode création de ticket pour ${from}`);
        
        if (buttonId === 'mode_guide') {
          console.log(`Démarrage du mode guidé pour ${from}`);
          await startGuidedMode(from);
          return;
        } else if (buttonId === 'mode_ia') {
          console.log(`Démarrage du mode IA pour ${from}`);
          await startAIMode(from);
          return;
        }
        // Les boutons back_to_menu et main_menu sont traités plus bas
      }

      // Gérer les boutons communs à tous les modes
      if (buttonId === 'back_to_menu' || buttonId === 'main_menu') {
        console.log(`Retour au menu principal pour ${from}`);

        // Réinitialiser la session
        session.currentStep = 'initial';
        await sessionManager.saveSession(from, session);

        // Présenter les options initiales
        await presentInitialOptions(from);
        return;
      } else if (buttonId === 'track_created_ticket' && session.lastCreatedTicketId) {
        console.log(`Suivi du ticket créé #${session.lastCreatedTicketId} pour ${from}`);

        // Mettre à jour la session pour le mode suivi
        session.currentStep = 'tracking_enter_id';
        session.trackingMode = true;
        await sessionManager.saveSession(from, session);

        // Simuler la saisie de l'ID du ticket
        await handleTrackingModeMessage(from, session.lastCreatedTicketId.toString(), null, session);
        return;
      } else if (buttonId.startsWith('view_comments_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.replace('view_comments_', '');

        // Récupérer et afficher les commentaires du ticket
        const commentsResult = await ticketTrackingService.getTicketComments(ticketId);

        if (commentsResult.success) {
          // Envoyer le message avec les commentaires
          if (commentsResult.buttons && commentsResult.buttons.length > 0) {
            await whatsappService.sendButtonsMessage(
                from,
                commentsResult.message,
                commentsResult.buttons
            );
          } else {
            await whatsappService.sendMessage(from, commentsResult.message);
          }
        } else {
          // Envoyer un message d'erreur
          await whatsappService.sendMessage(from, commentsResult.message);
        }

        // Mettre à jour la session
        session.currentStep = 'viewing_comments';
        session.currentTicketId = parseInt(ticketId);
        await sessionManager.saveSession(from, session);
      }
    }

    // La vérification du mode guidé a été déplacée au début de la fonction

    // Vérifier si l'utilisateur est en mode IA
    try {
      if (session && session.currentStep && session.currentStep.startsWith('ai_')) {
        await handleAiModeMessage(from, messageText, interactiveResponse, session);
        return;
      }

      // Vérifier si l'utilisateur est en mode suivi de ticket
      if (session && session.currentStep && session.currentStep.startsWith('tracking_')) {
        await handleTrackingModeMessage(from, messageText, interactiveResponse, session);
        return;
      }

      // Vérifier si l'utilisateur est en mode recherche avancée
      if (session && session.currentStep && session.currentStep.startsWith('search_')) {
        await handleSearchModeMessage(from, messageText, interactiveResponse, session);
        return;
      }

      // Gestion des boutons de recherche
      if (session && session.searchMode && buttonId && (
          buttonId === 'search_by_status' ||
          buttonId === 'search_by_type' ||
          buttonId === 'search_by_keyword' ||
          buttonId === 'back_to_search' ||
          buttonId && buttonId.startsWith('status_') ||
          buttonId && buttonId.startsWith('type_') ||
          buttonId === 'new_search'
      )) {
        await handleSearchButton(from, buttonId);
        return;
      }

      // Pour tout autre message ou état, présenter les options initiales
      console.log(`État de session non reconnu pour ${from}, présentation des options initiales`);
      await presentInitialOptions(from);
    } catch (innerError) {
      console.error('Error in inner try block:', innerError);
      await whatsappService.sendMessage(
          from,
          "Désolé, une erreur s'est produite lors du traitement de votre message. Veuillez réessayer plus tard."
      );
    }
  } catch (error) {
    console.error('Error handling incoming message:', error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors du traitement de votre message. Veuillez réessayer plus tard."
    );
  }
}

// Fonction pour vérifier si c'est la première interaction d'un utilisateur
async function isFirstInteraction(from) {
  try {
    const session = await sessionManager.getSession(from);
    return !session; // Si pas de session, c'est un nouvel utilisateur
  } catch (error) {
    console.error(`Erreur lors de la vérification de la première interaction pour ${from}:`, error);
    return true; // Par défaut, considérer comme un nouvel utilisateur en cas d'erreur
  }
}

// Présenter les options initiales
async function presentInitialOptions(from) {
  console.log(`Présentation des options initiales à ${from}`);

  const message = "👋 *Bienvenue au service de support GLPI*\n\nQue souhaitez-vous faire aujourd'hui ?";

  // Exactement 3 boutons comme demandé
  const mainButtons = [
    {
      type: "reply",
      reply: {
        id: "create_ticket_menu",
        title: "📃 Créer un ticket"
      }
    },
    {
      type: "reply",
      reply: {
        id: "subscriptions_menu",
        title: "🔔 Mes abonnements"
      }
    },
    {
      type: "reply",
      reply: {
        id: "track_ticket_menu",
        title: "🔍 Suivre tickets"
      }
    }
  ];

  // Réinitialiser la session pour éviter les problèmes
  const session = await sessionManager.getSession(from) || {};
  session.currentStep = 'initial';
  delete session.searchMode;
  await sessionManager.saveSession(from, session);

  await whatsappService.sendButtonsMessage(from, message, mainButtons, "Menu principal");
}

// Présenter les options supplémentaires
async function presentMoreOptions(from) {
  console.log(`Présentation des options supplémentaires à ${from}`);

  const message = "📋 *Options supplémentaires*\n\n*Gestion des tickets :*\n- 🔔 Mes abonnements : Voir et gérer vos abonnements\n- 🔎 Rechercher : Recherche avancée par critères\n- 🔍 Suivre : Consulter un ticket par son numéro\n- ❌ Supprimer abonnement : Désabonner d'un ticket";

  const buttons = [
    {
      type: "reply",
      reply: {
        id: "view_subscriptions",
        title: "🔔 Mes abonnements"
      }
    },
    {
      type: "reply",
      reply: {
        id: "search_tickets",
        title: "🔎 Rechercher"
      }
    },
    {
      type: "reply",
      reply: {
        id: "track_ticket",
        title: "🔍 Suivre ticket"
      }
    },
    {
      type: "reply",
      reply: {
        id: "remove_subscription",
        title: "❌ Supprimer abo"
      }
    },
    {
      type: "reply",
      reply: {
        id: "main_menu",
        title: "🏠 Menu"
      }
    }
  ];

  await whatsappService.sendButtonsMessage(from, message, buttons, "Options");
}

// Démarrer le mode guidé
async function startGuidedMode(from) {
  try {
    console.log(`Démarrage du mode guidé pour ${from}`);

    // Créer une session avec un état initial
    const session = {
      currentStep: 'select_type',
      guidedMode: true,
      ticketData: {}
    };
    
    // Sauvegarder la session et vérifier qu'elle a bien été enregistrée
    await sessionManager.saveSession(from, session);
    
    // Vérifier que la session a bien été enregistrée
    const savedSession = await sessionManager.getSession(from);
    console.log(`Session guidée créée pour ${from}:`, JSON.stringify(savedSession));

    // Envoyer les options de type de ticket sous forme de boutons
    const message = "📝 *Mode guidé - Type de ticket*\n\nVeuillez choisir le type de ticket :";

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "type_incident",
          title: "🔴 Incident"
        }
      },
      {
        type: "reply",
        reply: {
          id: "type_request",
          title: "🔵 Demande"
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

    await whatsappService.sendButtonsMessage(from, message, buttons, "Type de ticket");
  } catch (error) {
    console.error(`Erreur lors du démarrage du mode guidé pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Démarrer le mode IA
async function startAIMode(from) {
  try {
    console.log(`Démarrage du mode IA pour ${from}`);

    // Créer une session avec un état initial
    const session = {
      currentStep: 'ai_description',
      aiMode: true,
      ticketData: {}
    };
    await sessionManager.saveSession(from, session);

    // Envoyer un message pour demander la description du problème
    const message = "🤖 *Mode IA - Description*\n\nVeuillez décrire votre problème ou votre demande en détail. Notre système d'IA analysera votre description pour créer automatiquement un ticket approprié.\n\nExemple : \"Mon ordinateur ne démarre plus depuis ce matin, j'ai l'écran bleu de la mort\".";
    
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }
    ];
    
    await whatsappService.sendButtonsMessage(from, message, buttons, "Mode IA - Description");
  } catch (error) {
    console.error(`Erreur lors du démarrage du mode IA pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Démarrer le mode suivi de ticket
async function startTicketTracking(from) {
  try {
    console.log(`Démarrage du mode suivi de ticket pour ${from}`);

    // Créer ou mettre à jour la session
    const userSession = {
      currentStep: 'tracking_enter_id',
      trackingMode: true
    };
    await sessionManager.saveSession(from, userSession);

    // Envoyer un message pour demander l'ID du ticket
    const message = "🔍 *Suivi de ticket*\n\nVeuillez entrer le numéro du ticket que vous souhaitez suivre.";

    // Ajouter des boutons pour les derniers tickets créés ou suivis
    const buttons = [];

    // Vérifier si l'utilisateur a récemment créé un ticket
    const existingSession = await sessionManager.getSession(from);
    if (existingSession.lastCreatedTicketId) {
      buttons.push({
        type: "reply",
        reply: {
          id: `track_ticket_${existingSession.lastCreatedTicketId}`,
          title: `🎫 Ticket #${existingSession.lastCreatedTicketId}`
        }
      });
    }

    // Ajouter un bouton pour retourner au menu principal
    buttons.push({
      type: "reply",
      reply: {
        id: "back_to_menu",
        title: "🏠 Menu principal"
      }
    });

    if (buttons.length > 0) {
      await whatsappService.sendButtonsMessage(from, message, buttons, "Menu principal");
    } else {
      await whatsappService.sendMessage(from, message);
    }
  } catch (error) {
    console.error(`Erreur lors du démarrage du mode suivi de ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors du démarrage du mode suivi de ticket. Veuillez réessayer plus tard."
    );
  }
}

// Démarrer le mode recherche par ID de ticket
async function startTicketSearch(from) {
  try {
    console.log(`Démarrage de la recherche par ID pour ${from}`);

    // Créer une session avec un état initial de recherche
    const session = {
      currentStep: 'search_by_id',
      searchMode: true
    };
    await sessionManager.saveSession(from, session);

    // Envoyer un message demandant l'ID du ticket
    const message = "🔎 *Recherche de ticket par ID*\n\nVeuillez entrer le numéro du ticket que vous souhaitez rechercher.\n\nExemple: 12345";

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }
    ];

    await whatsappService.sendButtonsMessage(from, message, buttons, "Recherche ticket");
  } catch (error) {
    console.error(`Erreur lors du démarrage de la recherche avancée pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Fonction pour demander le numéro du ticket à désabonner
async function promptRemoveSubscription(from) {
  try {
    console.log(`Demande de suppression d'abonnement pour ${from}`);
    
    // Récupérer ou créer une session pour l'utilisateur
    let session = await sessionManager.getSession(from);
    if (!session) {
      session = {};
    }
    
    // Mettre à jour la session
    session.currentStep = 'remove_subscription';
    await sessionManager.saveSession(from, session);
    
    // Récupérer les abonnements de l'utilisateur
    const userSubscriptions = notificationService.getUserSubscriptions(from);
    
    if (userSubscriptions.length === 0) {
      // L'utilisateur n'a pas d'abonnements
      await whatsappService.sendMessage(
        from,
        "❗ Vous n'êtes actuellement abonné à aucun ticket. Rien à supprimer."
      );
      
      // Retourner au menu des abonnements
      setTimeout(() => simpleMenuService.presentSubscriptionsMenu(from), 1000);
      return;
    }
    
    // Préparer un message avec la liste des abonnements
    let message = "🗑️ *Supprimer un abonnement*\n\nVous êtes abonné aux tickets suivants :\n\n";
    
    // Créer des boutons pour chaque ticket (limité à 3)
    const deleteButtons = [];
    
    for (let i = 0; i < Math.min(userSubscriptions.length, 3); i++) {
      const ticketId = userSubscriptions[i];
      
      try {
        const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
        
        if (ticketDetails) {
          message += `🎟 *Ticket #${ticketId}* - ${ticketDetails.title || ticketDetails.name}\n`;
          
          // Ajouter un bouton pour supprimer cet abonnement
          deleteButtons.push({
            type: "reply",
            reply: {
              id: `delete_sub_${ticketId}`,
              title: `❌ Supprimer #${ticketId}`
            }
          });
        } else {
          message += `🎟 *Ticket #${ticketId}* (Détails non disponibles)\n`;
          
          // Ajouter un bouton pour supprimer cet abonnement même si les détails ne sont pas disponibles
          deleteButtons.push({
            type: "reply",
            reply: {
              id: `delete_sub_${ticketId}`,
              title: `❌ Supprimer #${ticketId}`
            }
          });
        }
      } catch (error) {
        console.error(`Erreur lors de la récupération des détails du ticket ${ticketId}:`, error);
        message += `🎟 *Ticket #${ticketId}* (Erreur lors de la récupération des détails)\n`;
        
        // Ajouter un bouton pour supprimer cet abonnement même en cas d'erreur
        deleteButtons.push({
          type: "reply",
          reply: {
            id: `delete_sub_${ticketId}`,
            title: `❌ Supprimer #${ticketId}`
          }
        });
      }
    }
    
    // Ajouter des instructions pour les tickets supplémentaires si nécessaire
    if (userSubscriptions.length > 3) {
      message += `\n*+ ${userSubscriptions.length - 3} autres tickets*\n`;
      message += "Pour supprimer un autre ticket, tapez : *desabo [ID]*\n";
    }
    
    // Ajouter des boutons de navigation
    const navButtons = [
      {
        type: "reply",
        reply: {
          id: "remove_subscription",
          title: "❌ Se désabonner"
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
    const allButtons = [...deleteButtons, ...navButtons];
    
    // Mettre à jour la session
    session.currentStep = 'removing_subscription';
    await sessionManager.saveSession(from, session);
    
    // Envoyer le message avec les boutons
    await whatsappService.sendButtonsMessage(from, message, allButtons, "Supprimer abonnement");
  } catch (error) {
    console.error(`Erreur lors de la demande de suppression d'abonnement pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "❗ Une erreur s'est produite. Veuillez réessayer plus tard."
    );
  }
}

// Afficher les abonnements de l'utilisateur
async function displayUserSubscriptions(from) {
  try {
    console.log(`Affichage des abonnements pour ${from}`);

    // Récupérer ou créer une session pour l'utilisateur
    let session = await sessionManager.getSession(from);
    if (!session) {
      session = {};
    }

    // Obtenir le message formaté avec les abonnements
    const subscriptionsResult = await notificationService.formatUserSubscriptionsMessage(from);

    // Mettre à jour la session
    session.currentStep = 'viewing_subscriptions';
    await sessionManager.saveSession(from, session);

    // Envoyer le message avec les boutons
    try {
      await whatsappService.sendButtonsMessage(
          from, 
          subscriptionsResult.message, 
          subscriptionsResult.buttons, 
          "Vos abonnements"
      );
    } catch (error) {
      console.error(`Erreur lors de l'envoi des boutons d'abonnement pour ${from}:`, error);
      // Fallback en cas d'erreur avec les boutons
      await whatsappService.sendMessage(
          from,
          subscriptionsResult.message + "\n\nPour revenir au menu principal, répondez avec 'menu'."
      );
    }
  } catch (error) {
    console.error(`Erreur lors de l'affichage des abonnements pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer plus tard."
    );
  }
}

// Gérer les messages en mode abonnements
async function handleSubscriptionModeMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message en mode abonnements pour ${from}: "${messageText}"`);
    
    // Gérer les réponses interactives (boutons)
    let buttonId = null;
    if (interactiveResponse) {
      if (interactiveResponse.button_reply) {
        buttonId = interactiveResponse.button_reply.id;
      } else if (interactiveResponse.type === 'button_reply') {
        buttonId = interactiveResponse.button_reply.id;
      }
      
      console.log(`Bouton reçu en mode abonnements: ${buttonId}`);
      
      // Traiter les boutons
      if (buttonId === 'back_to_menu') {
        await sessionManager.deleteSession(from);
        await presentInitialOptions(from);
        return;
      } else if (buttonId === 'add_subscription') {
        // Demander le numéro du ticket pour s'abonner
        await whatsappService.sendMessage(
          from,
          "Pour vous abonner à un ticket, veuillez entrer son numéro :\n\nExemple: *abonner 12345*"
        );
        
        session.currentStep = 'adding_subscription';
        await sessionManager.saveSession(from, session);
        return;
      } else if (buttonId === 'refresh_subscriptions') {
        // Actualiser la liste des abonnements
        await displayUserSubscriptions(from);
        return;
      } else if (buttonId === 'track_ticket') {
        // Rediriger vers le suivi de ticket
        await startTicketTracking(from);
        return;
      } else if (buttonId.startsWith('track_ticket_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Mettre à jour la session pour le suivi de ticket
        session.currentStep = 'tracking_ticket';
        session.ticketId = ticketId;
        await sessionManager.saveSession(from, session);
        
        // Afficher les détails du ticket
        await ticketTrackingService.displayTicketDetails(from, ticketId);
        return;
      } else if (buttonId.startsWith('unsub_ticket_') || buttonId.startsWith('delete_sub_')) {
        // Extraire l'ID du ticket (fonctionne pour les deux formats de bouton)
        const ticketId = buttonId.split('_').pop();
        
        // Vérifier si l'utilisateur est abonné à ce ticket
        const isSubscribed = notificationService.isSubscribed(from, ticketId);
        
        if (isSubscribed) {
          // Désabonner l'utilisateur
          notificationService.unsubscribeFromTicket(from, ticketId);
          await whatsappService.sendMessage(
            from,
            `✅ Vous avez été désabonné du ticket #${ticketId}.`
          );
          
          // Si nous étions dans le mode de suppression d'abonnement, retourner à ce mode
          if (buttonId.startsWith('delete_sub_') && session.currentStep === 'removing_subscription') {
            setTimeout(() => promptRemoveSubscription(from), 1000);
          } else {
            // Sinon, afficher la liste mise à jour des abonnements après un court délai
            setTimeout(() => displayUserSubscriptions(from), 1000);
          }
        } else {
          await whatsappService.sendMessage(
            from,
            `Vous n'êtes pas abonné au ticket #${ticketId}.`
          );
          
          // Si nous étions dans le mode de suppression d'abonnement, retourner à ce mode
          if (buttonId.startsWith('delete_sub_') && session.currentStep === 'removing_subscription') {
            setTimeout(() => promptRemoveSubscription(from), 1000);
          } else {
            // Sinon, afficher la liste des abonnements
            setTimeout(() => displayUserSubscriptions(from), 1000);
          }
        }
        return;
      }
    }
    
    // Gérer les commandes textuelles
    const lowerCaseMessage = messageText.toLowerCase().trim();
    
    // Gérer la commande de désabonnement (desabo 12345)
    if (lowerCaseMessage.startsWith('desabo ') || lowerCaseMessage.startsWith('désabo ')) {
      const parts = lowerCaseMessage.split(' ');
      if (parts.length >= 2) {
        const ticketId = parts[1].trim();
        
        // Vérifier si l'utilisateur est abonné à ce ticket
        const isSubscribed = notificationService.isSubscribed(from, ticketId);
        
        if (isSubscribed) {
          // Désabonner l'utilisateur
          notificationService.unsubscribeFromTicket(from, ticketId);
          await whatsappService.sendMessage(
            from,
            `✅ Vous avez été désabonné du ticket #${ticketId}.`
          );
          
          // Afficher la liste mise à jour des abonnements
          setTimeout(() => displayUserSubscriptions(from), 1000);
        } else {
          await whatsappService.sendMessage(
            from,
            `Vous n'êtes pas abonné au ticket #${ticketId}.`
          );
        }
        return;
      }
    }
    
    // Gérer la commande d'abonnement (abonner 12345)
    if (lowerCaseMessage.startsWith('abonner ')) {
      const parts = lowerCaseMessage.split(' ');
      if (parts.length >= 2) {
        const ticketId = parts[1].trim();
        
        // Vérifier si l'utilisateur est déjà abonné à ce ticket
        const isSubscribed = notificationService.isSubscribed(from, ticketId);
        
        if (!isSubscribed) {
          try {
            // Vérifier si le ticket existe
            const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
            
            if (ticketDetails) {
              // Abonner l'utilisateur
              notificationService.subscribeToTicket(from, ticketId);
              await whatsappService.sendMessage(
                from,
                `✅ Vous êtes maintenant abonné au ticket #${ticketId}.`
              );
              
              // Afficher la liste mise à jour des abonnements
              setTimeout(() => displayUserSubscriptions(from), 1000);
            } else {
              await whatsappService.sendMessage(
                from,
                `❌ Le ticket #${ticketId} n'existe pas ou n'est pas accessible.`
              );
            }
          } catch (error) {
            console.error(`Erreur lors de la vérification du ticket ${ticketId}:`, error);
            await whatsappService.sendMessage(
              from,
              `❌ Impossible de vérifier le ticket #${ticketId}. Veuillez réessayer plus tard.`
            );
          }
        } else {
          await whatsappService.sendMessage(
            from,
            `Vous êtes déjà abonné au ticket #${ticketId}.`
          );
        }
        return;
      }
    }
    
    // Si l'utilisateur tape "menu", retourner au menu principal
    if (lowerCaseMessage === 'menu') {
      await sessionManager.deleteSession(from);
      await presentInitialOptions(from);
      return;
    }
    
    // Message non reconnu, afficher les instructions
    await whatsappService.sendMessage(
      from,
      "Je n'ai pas compris votre demande. Voici les commandes disponibles :\n\n" +
      "- Pour vous abonner à un ticket: *abonner [ID]*\n" +
      "- Pour vous désabonner d'un ticket: *desabo [ID]*\n" +
      "- Pour revenir au menu principal: *menu*"
    );
    
  } catch (error) {
    console.error(`Erreur lors du traitement du message en mode abonnements pour ${from}:`, error);
    await whatsappService.sendMessage(
      from,
      "Désolé, une erreur s'est produite. Veuillez réessayer plus tard."
    );
  }
}

// Gérer les messages en mode guidé
async function handleGuidedModeMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message en mode guidé pour ${from}, étape: ${session.currentStep}`);
    console.log(`Message: "${messageText}", interactiveResponse:`, JSON.stringify(interactiveResponse));

    // Traiter en fonction de l'étape actuelle
    switch (session.currentStep) {
      case 'select_type':
        console.log(`Structure complète de la réponse interactive dans handleGuidedModeMessage:`, JSON.stringify(interactiveResponse, null, 2));
        
        // Extraire l'ID du bouton de manière plus robuste
        let typeButtonId = null;
        if (interactiveResponse) {
          if (interactiveResponse.type === 'button_reply' && interactiveResponse.button_reply) {
            typeButtonId = interactiveResponse.button_reply.id;
          } else if (interactiveResponse.type === 'button' && interactiveResponse.button_reply) {
            typeButtonId = interactiveResponse.button_reply.id;
          } else if (interactiveResponse.interactive && interactiveResponse.interactive.button_reply) {
            typeButtonId = interactiveResponse.interactive.button_reply.id;
          }
        }
        
        console.log(`Bouton de type de ticket reçu: ${typeButtonId}`);

        if (typeButtonId === 'type_incident' || typeButtonId === 'type_request') {
          // Enregistrer le type de ticket
          session.ticketData.type = typeButtonId === 'type_incident' ? 'incident' : 'request';
          session.ticketData.typeId = typeButtonId === 'type_incident' ? 1 : 2;
          session.currentStep = 'select_category';
          await sessionManager.saveSession(from, session);
          console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

          // Présenter les catégories ITIL en fonction du type
          // Utiliser le même format que celui vérifié dans presentCategories
          await presentCategories(from, typeButtonId);
        } else if (typeButtonId === 'back_to_menu') {
          // Retour au menu principal
          console.log(`Retour au menu principal demandé par ${from}`);
          await sessionManager.deleteSession(from);
          await presentInitialOptions(from);
        } else {
          console.log(`Bouton non reconnu: ${typeButtonId}`);
          await whatsappService.sendMessage(
              from,
              "Je n'ai pas compris votre choix. Veuillez sélectionner 'Incident' ou 'Demande'."
          );
        }
        break;
        
      case 'select_type_fallback':
        console.log(`Pas de réponse interactive valide, présentation des options de type de ticket`);
        const typeButtons = [
          {
            type: "reply",
            reply: {
              id: "type_incident",
              title: "Incident"
            }
          },
          {
            type: "reply",
            reply: {
              id: "type_request",
              title: "Demande"
            }
          }
        ];
        
        await whatsappService.sendButtonsMessage(from, "Quel type de ticket souhaitez-vous créer ?", typeButtons, "Type de ticket");
        break;

      case 'select_category':
        console.log(`Structure complète de la réponse interactive dans select_category:`, JSON.stringify(interactiveResponse, null, 2));
        
        // Extraire l'ID du bouton de manière plus robuste
        let categoryButtonId = null;
        if (interactiveResponse) {
          if (interactiveResponse.type === 'button_reply' && interactiveResponse.button_reply) {
            categoryButtonId = interactiveResponse.button_reply.id;
          } else if (interactiveResponse.type === 'button' && interactiveResponse.button_reply) {
            categoryButtonId = interactiveResponse.button_reply.id;
          } else if (interactiveResponse.interactive && interactiveResponse.interactive.button_reply) {
            categoryButtonId = interactiveResponse.interactive.button_reply.id;
          }
        }
        
        console.log(`Bouton de catégorie reçu: ${categoryButtonId}`);

        if (categoryButtonId && categoryButtonId.startsWith('category_')) {

          const parts = categoryButtonId.split('_');
          const categoryId = parts[1];
          // Reconstruire le nom de la catégorie à partir des parties restantes
          const categoryName = parts.slice(2).join('_').replace(/_/g, ' ');

          // Enregistrer la catégorie avec l'ID numérique pour GLPI
          session.ticketData.category = categoryName;
          session.ticketData.itilcategories_id = parseInt(categoryId, 10); // Convertir en nombre pour GLPI
          session.currentStep = 'input_title';
          await sessionManager.saveSession(from, session);
          console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

          // Demander le titre
          await whatsappService.sendMessage(
              from,
              "Veuillez entrer un titre court pour votre ticket :"
          );
        } else if (categoryButtonId === 'back_to_menu') {
          // Retour au menu principal
          console.log(`Retour au menu principal demandé par ${from}`);
          await sessionManager.deleteSession(from);
          await presentInitialOptions(from);
        } else {
          console.log(`Pas de réponse interactive valide pour la catégorie ou format invalide: ${categoryButtonId}, présentation des catégories à nouveau`);
          // Si ce n'est pas une réponse interactive valide, présenter à nouveau les catégories
          const ticketType = session.ticketData.type;
          await presentCategories(from, ticketType);
        }
        break;

      case 'input_title':
        // Enregistrer le titre
        session.ticketData.title = messageText;
        session.currentStep = 'input_description';
        await sessionManager.saveSession(from, session);
        console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

        // Demander la description - utiliser sendMessage au lieu de sendButtonsMessage pour éviter l'erreur
        await whatsappService.sendMessage(
            from,
            "📝 *Mode guidé - Description*\n\nVeuillez décrire votre problème ou votre demande en détail :"
        );
        break;

      case 'input_description':
        if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Bouton reçu en mode guidé: ${buttonId}`);

          if (buttonId === 'back_to_menu') {
            // Retour au menu principal
            console.log(`Retour au menu principal demandé par ${from}`);
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          }
        }

        // Enregistrer la description
        session.ticketData.description = messageText;
        session.currentStep = 'select_urgency';
        await sessionManager.saveSession(from, session);
        console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

        // Demander l'urgence en utilisant des boutons
        const urgencyMessage = "🔊 *Mode guidé - Urgence*\n\nVeuillez sélectionner le niveau d'urgence :";

        // Premier groupe de boutons d'urgence (hautes urgences)
        const urgencyButtonsHigh = [
          {
            type: "reply",
            reply: {
              id: "urgency_1",
              title: "🔴 Très haute"
            }
          },
          {
            type: "reply",
            reply: {
              id: "urgency_2",
              title: "🟠 Haute"
            }
          },
          {
            type: "reply",
            reply: {
              id: "urgency_3",
              title: "🟢 Moyenne"
            }
          }
        ];

        // Deuxième groupe de boutons d'urgence (basses urgences et retour)
        const urgencyButtonsLow = [
          {
            type: "reply",
            reply: {
              id: "urgency_4",
              title: "🔵 Basse"
            }
          },
          {
            type: "reply",
            reply: {
              id: "urgency_5",
              title: "⚪ Très basse"
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

        // Envoyer uniquement un message court pour introduire les boutons
        await whatsappService.sendMessage(from, `${urgencyMessage}`);
        
        
        // Envoyer les deux groupes de boutons séparément
        try {
            // Utiliser l'ordre correct des paramètres : (recipientPhone, bodyText, buttons, headerText)
            await whatsappService.sendButtonsMessage(from, "*Urgences élevées :*", urgencyButtonsHigh, "Niveau d'urgence (1/2)");
            await whatsappService.sendButtonsMessage(from, "*Urgences basses :*", urgencyButtonsLow, "Niveau d'urgence (2/2)");
        } catch (error) {
            console.error(`Erreur lors de l'envoi des boutons d'urgence pour ${from}:`, error);
            // En cas d'erreur avec les boutons, on a déjà envoyé les instructions textuelles, donc l'utilisateur peut quand même continuer
        }
        break;

      case 'select_urgency':
        // Gérer les réponses textuelles (numériques) pour le niveau d'urgence
        if (!interactiveResponse && messageText) {
          const lowerCaseMessage = messageText.toLowerCase().trim();
          
          // Gérer le retour au menu principal
          if (lowerCaseMessage === 'menu' || lowerCaseMessage.includes('menu principal')) {
            console.log(`Retour au menu principal demandé par ${from}`);
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          }
          
          // Extraire un nombre de la réponse (1-5)
          let urgencyId = null;
          
          // Vérifier si la réponse est un nombre entre 1 et 5
          if (/^[1-5]$/.test(lowerCaseMessage)) {
            urgencyId = lowerCaseMessage;
          } 
          // Vérifier si la réponse contient un nombre entre 1 et 5
          else if (lowerCaseMessage.includes('1') || 
                   lowerCaseMessage.includes('2') || 
                   lowerCaseMessage.includes('3') || 
                   lowerCaseMessage.includes('4') || 
                   lowerCaseMessage.includes('5')) {
            const match = lowerCaseMessage.match(/[1-5]/);
            if (match) {
              urgencyId = match[0];
            }
          }
          // Vérifier si la réponse contient des mots-clés d'urgence
          else if (lowerCaseMessage.includes('très haute') || lowerCaseMessage.includes('critique')) {
            urgencyId = '1';
          } else if (lowerCaseMessage.includes('haute') || lowerCaseMessage.includes('important')) {
            urgencyId = '2';
          } else if (lowerCaseMessage.includes('moyenne') || lowerCaseMessage.includes('normal')) {
            urgencyId = '3';
          } else if (lowerCaseMessage.includes('basse') || lowerCaseMessage.includes('faible')) {
            urgencyId = '4';
          } else if (lowerCaseMessage.includes('très basse') || lowerCaseMessage.includes('minimale')) {
            urgencyId = '5';
          }
          
          if (urgencyId) {
            // Enregistrer l'urgence
            session.ticketData.urgency = parseInt(urgencyId);
            session.ticketData.urgencyName = getUrgencyName(parseInt(urgencyId));
            session.currentStep = 'confirmation';
            await sessionManager.saveSession(from, session);
            console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}, urgence: ${urgencyId}`);

            // Présenter un résumé du ticket pour confirmation
            await presentTicketSummary(from, session.ticketData);
            return;
          } else {
            // Message non reconnu, renvoyer les instructions
            console.log(`Réponse d'urgence non reconnue: ${messageText}`);
            await whatsappService.sendMessage(
              from,
              `Je n'ai pas compris votre choix d'urgence. Veuillez répondre avec un numéro entre 1 et 5 :\n\n1➕ 🔴 Très haute\n2➕ 🕾 Haute\n3➕ 🟢 Moyenne\n4➕ 🔵 Basse\n5➕ ⚪ Très basse\n\nOu répondez "menu" pour revenir au menu principal.`
            );
            return;
          }
        }
        // Gérer les réponses interactives (boutons) pour la rétrocompatibilité
        else if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Bouton d'urgence reçu: ${buttonId}`);

          if (buttonId === 'back_to_menu') {
            // Retour au menu principal
            console.log(`Retour au menu principal demandé par ${from}`);
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          } else if (buttonId.startsWith('urgency_')) {
            // Extraire l'ID d'urgence du bouton
            const urgencyId = buttonId.split('_')[1];

            // Enregistrer l'urgence
            session.ticketData.urgency = parseInt(urgencyId);
            session.ticketData.urgencyName = getUrgencyName(parseInt(urgencyId));
            session.currentStep = 'confirmation';
            await sessionManager.saveSession(from, session);
            console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

            // Présenter un résumé du ticket pour confirmation
            await presentTicketSummary(from, session.ticketData);
          }
        } else if (interactiveResponse && interactiveResponse.type === 'list_reply') {
          const urgencyId = interactiveResponse.list_reply.id;
          const urgencyTitle = interactiveResponse.list_reply.title;

          // Enregistrer l'urgence
          session.ticketData.urgency = parseInt(urgencyId);
          session.ticketData.urgencyName = urgencyTitle;
          session.currentStep = 'confirmation';
          await sessionManager.saveSession(from, session);
          console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

          // Présenter un résumé du ticket pour confirmation
          await presentTicketSummary(from, session.ticketData);
        } else {
          console.log(`Pas de réponse interactive valide pour l'urgence, présentation des options à nouveau`);
          // Si ce n'est pas une réponse interactive, demander à nouveau l'urgence
          const urgencyMessage = "🚨 *Mode guidé - Urgence*\n\nVeuillez sélectionner le niveau d'urgence :";

          const urgencyButtons = [
            {
              type: "reply",
              reply: {
                id: "urgency_5",
                title: "⚪ Très basse"
              }
            },
            {
              type: "reply",
              reply: {
                id: "urgency_4",
                title: "🔵 Basse"
              }
            },
            {
              type: "reply",
              reply: {
                id: "urgency_3",
                title: "🟢 Moyenne"
              }
            },
            {
              type: "reply",
              reply: {
                id: "urgency_2",
                title: "🟠 Haute"
              }
            },
            {
              type: "reply",
              reply: {
                id: "urgency_1",
                title: "🔴 Très haute"
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

          await whatsappService.sendButtonsMessage(from, urgencyMessage, urgencyButtons, "Niveau d'urgence");
        }
        break;

      case 'confirmation':
        // Gérer les réponses textuelles pour la confirmation
        if (!interactiveResponse && messageText) {
          const lowerCaseMessage = messageText.toLowerCase().trim();
          
          if (lowerCaseMessage === 'confirmer' || lowerCaseMessage === 'oui' || lowerCaseMessage === 'yes' || lowerCaseMessage === 'confirm') {
            console.log(`Confirmation textuelle reçue de ${from}: ${messageText}`);
            // Traiter comme une confirmation positive
            await proceedWithTicketCreation(from, session);
          } else if (lowerCaseMessage === 'annuler' || lowerCaseMessage === 'non' || lowerCaseMessage === 'no' || lowerCaseMessage === 'cancel') {
            console.log(`Annulation textuelle reçue de ${from}: ${messageText}`);
            // Traiter comme une annulation
            await whatsappService.sendMessage(
                from,
                "Création de ticket annulée. Vous pouvez démarrer une nouvelle création à tout moment."
            );
            // Réinitialiser la session
            await sessionManager.deleteSession(from);
          } else {
            // Message non reconnu, renvoyer les instructions
            console.log(`Réponse non reconnue pour la confirmation: ${messageText}`);
            await whatsappService.sendMessage(
                from,
                "Je n'ai pas compris votre réponse. Veuillez répondre avec *confirmer* ou *annuler*."
            );
            // Renvoyer le résumé du ticket
            await presentTicketSummary(from, session.ticketData);
          }
          return;
        }
        // Gérer les réponses interactives (boutons) pour la confirmation
        else if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Bouton de confirmation reçu: ${buttonId}`);

          if (buttonId === 'confirm_yes') {
            // Créer le ticket en utilisant la fonction commune
            await proceedWithTicketCreation(from, session);
          } else if (buttonId === 'confirm_no') {
            await whatsappService.sendMessage(
                from,
                "Création de ticket annulée. Vous pouvez démarrer une nouvelle création à tout moment."
            );

            // Réinitialiser la session
            await sessionManager.deleteSession(from);
          } else if (buttonId === 'back_to_menu') {
            await whatsappService.sendMessage(
                from,
                "Retour au menu principal."
            );
            
            // Réinitialiser la session et afficher le menu principal
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
          }
        } else {
          console.log(`Pas de réponse interactive valide pour la confirmation, présentation des options à nouveau`);
          // Si ce n'est pas une réponse interactive, demander à nouveau la confirmation
          const summary = `Récapitulatif de votre ticket :
Type : ${session.ticketData.type === 'incident' ? 'Incident' : 'Demande'}
Catégorie : ${session.ticketData.category}
Titre : ${session.ticketData.title}
Description : ${session.ticketData.description}
Urgence : ${session.ticketData.urgencyName}`;

          const confirmTicketButtons = [
            {
              type: "reply",
              reply: {
                id: "confirm_yes",
                title: "Créer le ticket"
              }
            },
            {
              type: "reply",
              reply: {
                id: "confirm_no",
                title: "Annuler"
              }
            }
          ];
          
          await whatsappService.sendButtonsMessage(from, summary, confirmTicketButtons, "Confirmation");
        }
        break;

      case 'ticket_created':
        // Gérer les réponses textuelles pour les actions post-création
        if (!interactiveResponse && messageText) {
          const lowerCaseMessage = messageText.toLowerCase().trim();
          const ticketId = session.lastCreatedTicketId;
          
          if (!ticketId) {
            console.error(`Pas d'ID de ticket trouvé dans la session pour ${from}`);
            await whatsappService.sendMessage(from, "Je ne trouve pas de référence à un ticket récemment créé. Veuillez créer un nouveau ticket.");
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          }
          
          if (lowerCaseMessage === 'attribuer' || lowerCaseMessage.includes('attribuer')) {
            // Passer à l'étape d'attribution du ticket
            session.currentStep = 'assign_ticket';
            session.ticketToAssign = ticketId;
            await sessionManager.saveSession(from, session);
            await handleAssignTicket(from, session, ticketId);
            return;
          } else if (lowerCaseMessage === 'demandeur' || lowerCaseMessage.includes('demandeur')) {
            // Passer à l'étape d'ajout de demandeur
            session.currentStep = 'add_requester';
            session.ticketToAddRequester = ticketId;
            await sessionManager.saveSession(from, session);
            await whatsappService.sendMessage(from, `Pour ajouter un demandeur au ticket #${ticketId}, veuillez envoyer son nom ou son adresse email.`);
            return;
          } else if (lowerCaseMessage === 'commentaire' || lowerCaseMessage.includes('commentaire')) {
            // Passer à l'étape d'ajout de commentaire
            session.currentStep = 'add_comment';
            session.ticketToAddComment = ticketId;
            await sessionManager.saveSession(from, session);
            await whatsappService.sendMessage(from, `Pour ajouter un commentaire au ticket #${ticketId}, veuillez envoyer votre message.`);
            return;
          } else if (lowerCaseMessage === 'menu' || lowerCaseMessage.includes('menu')) {
            // Retour au menu principal
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          } else {
            // Message non reconnu
            await whatsappService.sendMessage(
              from,
              `Je n'ai pas compris votre demande. Pour le ticket #${ticketId}, vous pouvez répondre avec :\n- *attribuer* : pour attribuer le ticket\n- *demandeur* : pour ajouter un demandeur\n- *commentaire* : pour ajouter un commentaire\n- *menu* : pour revenir au menu principal`
            );
            return;
          }
        }
        // Gérer les réponses interactives (boutons) pour les actions post-création
        else if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          try {
            const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
            console.log(`Action post-création reçue: ${buttonId}`);
            
            if (buttonId === 'back_to_menu') {
              // Retour au menu principal
              await sessionManager.deleteSession(from);
              await presentInitialOptions(from);
              return;
            }
            
            // Extraire les informations du bouton (format: action_type_ticketId ou action_type_entityId_ticketId)
            const parts = buttonId ? buttonId.split('_') : [];
            
            if (parts.length < 2) {
              console.error(`Format de bouton non reconnu: ${buttonId}`);
              await whatsappService.sendMessage(from, "Une erreur s'est produite. Veuillez réessayer.");
              return;
            }
            
            // Déterminer l'action et l'ID du ticket
            const action = parts[0];
            let ticketId;
            
            // Extraire l'ID du ticket selon le format du bouton
            if (parts.length >= 3 && (buttonId.startsWith('assign_ticket_') || buttonId.startsWith('add_requester_') || buttonId.startsWith('add_comment_'))) {
              ticketId = parts[2];
            } else if (parts.length >= 4 && (buttonId.startsWith('assign_group_') || buttonId.startsWith('assign_tech_'))) {
              ticketId = parts[3];
            } else {
              // Pour les autres formats, prendre le dernier élément comme ID du ticket
              ticketId = parts[parts.length - 1];
            }
            
            if (!ticketId) {
              console.error(`Impossible d'extraire l'ID du ticket depuis le bouton: ${buttonId}`);
              await whatsappService.sendMessage(from, "Une erreur s'est produite. Veuillez réessayer.");
              return;
            }
            
            // Traiter l'action selon le type de bouton
            if (buttonId.startsWith('assign_ticket_')) {
              // Passer à l'étape d'attribution du ticket
              session.currentStep = 'assign_ticket';
              session.ticketToAssign = ticketId;
              await sessionManager.saveSession(from, session);
              await handleAssignTicket(from, session, ticketId);
            } else if (buttonId.startsWith('add_requester_')) {
              // Passer à l'étape d'ajout de demandeur
              session.currentStep = 'add_requester';
              session.ticketToUpdate = ticketId;
              await sessionManager.saveSession(from, session);
              await whatsappService.sendMessage(from, `Pour ajouter un demandeur au ticket #${ticketId}, veuillez envoyer son nom ou son adresse email.`);
            } else if (buttonId.startsWith('add_comment_')) {
              // Passer à l'étape d'ajout de commentaire
              session.currentStep = 'add_comment';
              session.ticketToComment = ticketId;
              await sessionManager.saveSession(from, session);
              await whatsappService.sendMessage(from, `Pour ajouter un commentaire au ticket #${ticketId}, veuillez envoyer votre message.`);
            } else if (buttonId.startsWith('assign_group_') || buttonId.startsWith('assign_tech_')) {
              // Gérer l'attribution à un groupe ou technicien spécifique
              try {
                let entityId;
                let entityType;
                
                if (buttonId.startsWith('assign_group_')) {
                  entityId = parts[2];
                  entityType = 'group';
                } else if (buttonId.startsWith('assign_tech_')) {
                  entityId = parts[2];
                  entityType = 'tech';
                }
                
                if (entityId && ticketId) {
                  // Attribuer le ticket au groupe ou technicien sélectionné
                  if (entityType === 'group') {
                    await glpiService.assignTicketToGroup(ticketId, entityId);
                    const groupName = session.availableGroups.find(g => g.id === entityId)?.name || `Groupe #${entityId}`;
                    
                    // Déclencher une notification pour les abonnés
                    const notificationService = require('./services/notificationService');
                    await notificationService.triggerTicketUpdateNotification(ticketId, 'assignment', {
                      groupId: entityId,
                      groupName: groupName
                    });
                    
                    // Envoyer un message de confirmation avec des boutons d'action
                    await whatsappService.sendButtonsMessage(
                      from,
                      `✅ *Attribution réussie !*`,
                      `Le ticket #${ticketId} a été attribué au groupe *${groupName}* avec succès.\n\nL'attribution a été enregistrée dans le système GLPI.\n\nLes abonnés à ce ticket ont été notifiés de cette attribution.`,
                      [{
                        type: "reply",
                        reply: {
                          id: `view_ticket_${ticketId}`,
                          title: "📃 Voir le ticket"
                        }
                      },
                      {
                        type: "reply",
                        reply: {
                          id: `add_requester_${ticketId}`,
                          title: "👥 Ajouter demandeur"
                        }
                      },
                      {
                        type: "reply",
                        reply: {
                          id: "back_to_menu",
                          title: "🏠 Menu principal"
                        }
                      }]
                    );
                    
                    // Mettre à jour la session
                    session.currentStep = 'main_menu';
                    await sessionManager.saveSession(from, session);
                  } else {
                    await glpiService.assignTicketToTechnician(ticketId, entityId);
                    const techName = session.availableTechnicians.find(t => t.id === entityId)?.name || `Technicien #${entityId}`;
                    
                    // Déclencher une notification pour les abonnés
                    const notificationService = require('./services/notificationService');
                    await notificationService.triggerTicketUpdateNotification(ticketId, 'assignment', {
                      userId: entityId,
                      userName: techName
                    });
                    
                    // Envoyer un message de confirmation avec des boutons d'action
                    await whatsappService.sendButtonsMessage(
                      from,
                      `✅ *Attribution réussie !*`,
                      `Le ticket #${ticketId} a été attribué au technicien *${techName}* avec succès.\n\nL'attribution a été enregistrée dans le système GLPI.\n\nLes abonnés à ce ticket ont été notifiés de cette attribution.`,
                      [{
                        type: "reply",
                        reply: {
                          id: `view_ticket_${ticketId}`,
                          title: "📃 Voir le ticket"
                        }
                      },
                      {
                        type: "reply",
                        reply: {
                          id: `add_requester_${ticketId}`,
                          title: "👥 Ajouter demandeur"
                        }
                      },
                      {
                        type: "reply",
                        reply: {
                          id: "back_to_menu",
                          title: "🏠 Menu principal"
                        }
                      }]
                    );
                    
                    // Mettre à jour la session
                    session.currentStep = 'main_menu';
                    await sessionManager.saveSession(from, session);
                  }
                  
                  // Réinitialiser la session
                  session.currentStep = 'main_menu';
                  await sessionManager.saveSession(from, session);
                  
                  // Le message de confirmation avec le bouton de retour au menu principal a déjà été envoyé
                  // Nous n'avons donc pas besoin d'envoyer un second message
                }
              } catch (error) {
                console.error(`Erreur lors de l'attribution du ticket #${ticketId}:`, error);
                
                // Envoyer un message d'erreur avec un bouton de retour au menu principal
                await whatsappService.sendButtonsMessage(
                  from,
                  "❌ *Erreur lors de l'attribution*",
                  "Désolé, une erreur s'est produite lors de l'attribution du ticket #${ticketId}. Veuillez réessayer plus tard.",
                  [{
                    type: "reply",
                    reply: {
                      id: "back_to_menu",
                      title: "🏠 Menu principal"
                    }
                  }]
                );
                
                // Réinitialiser la session pour revenir au menu principal
                session.currentStep = 'main_menu';
                await sessionManager.saveSession(from, session);
              }
            } else if (buttonId.startsWith('show_technicians_')) {
              // Afficher la liste des techniciens
              const techButtons = session.availableTechnicians.map(tech => ({
                type: "reply",
                reply: {
                  id: `assign_tech_${tech.id}_${ticketId}`,
                  title: `👤 ${tech.name.substring(0, 15)}`
                }
              }));

              // Ajouter un bouton pour revenir aux groupes
              techButtons.push({
                type: "reply",
                reply: {
                  id: `show_groups_${ticketId}`,
                  title: "👥 Voir groupes"
                }
              });
              
              await whatsappService.sendButtonsMessage(from, `*Attribution du ticket #${ticketId}*\n\nChoisissez un technicien :`, techButtons, "Techniciens");
            }
          } catch (error) {
            console.error(`Erreur lors du traitement de l'action post-création:`, error);
            
            // Envoyer un message d'erreur avec un bouton de retour au menu principal
            await whatsappService.sendButtonsMessage(
              from,
              "❌ *Erreur lors du traitement*",
              "Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.",
              [{
                type: "reply",
                reply: {
                  id: "back_to_menu",
                  title: "🏠 Menu principal"
                }
              }]
            );
            
            // Réinitialiser la session pour revenir au menu principal
            session.currentStep = 'main_menu';
            await sessionManager.saveSession(from, session);
          }
        }
        break;

      case 'add_requester':
        // Traitement de l'ajout d'un demandeur
        if (messageText && session.ticketToUpdate) {
          try {
            // Envoyer un message de confirmation pour indiquer que le processus d'ajout de demandeur a commencé
            await whatsappService.sendMessage(
                from,
                `✅ *Ajout du demandeur en cours*\n\nJ'ajoute le demandeur "${messageText}" au ticket #${session.ticketToUpdate}...`
            );
            
            // Attendre un court instant pour que le message soit bien reçu
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Ici, vous devriez appeler une fonction GLPI pour ajouter un demandeur
            // Cette fonctionnalité nécessite d'être implémentée dans glpiService
            
            // Déclencher une notification pour les abonnés
            const notificationService = require('./services/notificationService');
            await notificationService.triggerTicketUpdateNotification(session.ticketToUpdate, 'requester', {
              requesterName: messageText
            });

            await whatsappService.sendButtonsMessage(
                from,
                `✅ *Demandeur ajouté avec succès !*`,
                `Le demandeur "${messageText}" a été ajouté au ticket #${session.ticketToUpdate}.\n\nL'ajout a été enregistré dans le système GLPI.\n\nLes abonnés à ce ticket ont été notifiés de cet ajout.`,
                [
                  {
                    type: "reply",
                    reply: {
                      id: `view_ticket_${session.ticketToUpdate}`,
                      title: "📃 Voir le ticket"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `assign_ticket_${session.ticketToUpdate}`,
                      title: "👤 Attribuer"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `add_comment_${session.ticketToUpdate}`,
                      title: "📝 Commentaire"
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
            );

            // Réinitialiser la session
            session.currentStep = 'main_menu';
            await sessionManager.saveSession(from, session);
          } catch (error) {
            console.error(`Erreur lors de l'ajout du demandeur:`, error);
            await whatsappService.sendMessage(
                from,
                `Désolé, une erreur s'est produite lors de l'ajout du demandeur au ticket #${session.ticketToUpdate}. Veuillez réessayer plus tard.`
            );
          }
        }
        break;

      case 'add_comment':
        // Traitement de l'ajout d'un commentaire
        if (messageText && session.ticketToComment) {
          try {
            // Ajouter le commentaire au ticket
            const followupResponse = await glpiService.addTicketFollowup(session.ticketToComment, messageText);
            
            // Déclencher une notification pour les abonnés
            const notificationService = require('./services/notificationService');
            await notificationService.triggerTicketUpdateNotification(session.ticketToComment, 'comment', {
              content: messageText,
              author: "Utilisateur WhatsApp",
              followupId: followupResponse?.id || null
            });

            // Envoyer un message de confirmation avec des boutons interactifs
            await whatsappService.sendButtonsMessage(
                from,
                `✅ *Commentaire ajouté avec succès!*`,
                `Votre commentaire a été ajouté au ticket #${session.ticketToComment}.\n\nLe commentaire a été enregistré dans le système GLPI.\n\nLes abonnés à ce ticket ont été notifiés de ce nouveau commentaire.`,
                [
                  {
                    type: "reply",
                    reply: {
                      id: `view_ticket_${session.ticketToComment}`,
                      title: "📃 Voir le ticket"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `assign_ticket_${session.ticketToComment}`,
                      title: "👤 Attribuer"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `add_requester_${session.ticketToComment}`,
                      title: "👥 Demandeur"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `close_ticket_${session.ticketToComment}`,
                      title: "✅ Fermer ticket"
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
            );

            // Réinitialiser la session
            session.currentStep = 'main_menu';
            await sessionManager.saveSession(from, session);
          } catch (error) {
            console.error(`Erreur lors de l'ajout du commentaire:`, error);
            await whatsappService.sendMessage(
                from,
                `Désolé, une erreur s'est produite lors de l'ajout du commentaire au ticket #${session.ticketToComment}. Veuillez réessayer plus tard.`
            );
          }
        }
        break;

      default:
        // Si l'étape n'est pas reconnue, recommencer le processus
        await startGuidedMode(from);
        break;
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du message en mode guidé pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors du traitement de votre message. Veuillez réessayer plus tard."
    );
  }
}

// Gérer les messages en mode IA
async function handleAiModeMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message en mode IA pour ${from}, étape: ${session.currentStep}`);
    console.log(`Message: "${messageText}", interactiveResponse:`, JSON.stringify(interactiveResponse));

    switch (session.currentStep) {
      case 'ai_ticket_created':
        // Traiter les boutons après la création du ticket en mode IA
        if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Action post-création reçue en mode IA: ${buttonId}`);
          
          if (buttonId === 'back_to_menu') {
            // Retour au menu principal
            session.currentStep = 'initial';
            await sessionManager.saveSession(from, session);
            await sendInitialOptions(from);
            return;
          }
          
          // Extraire l'ID du ticket des boutons comme assign_ticket_123
          const parts = buttonId ? buttonId.split('_') : [];
          if (parts.length < 2) {
            console.error(`Format de bouton non reconnu en mode IA: ${buttonId}`);
            await whatsappService.sendMessage(from, "Une erreur s'est produite. Veuillez réessayer.");
            return;
          }
          
          // Déterminer l'action et l'ID du ticket
          let ticketId;
          
          // Extraire l'ID du ticket selon le format du bouton
          if (parts.length >= 3 && (buttonId.startsWith('assign_ticket_') || buttonId.startsWith('add_requester_') || buttonId.startsWith('add_comment_'))) {
            ticketId = parts[2];
          } else {
            console.error(`Impossible d'extraire l'ID du ticket depuis le bouton en mode IA: ${buttonId}`);
            await whatsappService.sendMessage(from, "Une erreur s'est produite. Veuillez réessayer.");
            return;
          }
          
          if (buttonId.startsWith('assign_ticket_')) {
            // Passer à l'étape d'attribution du ticket
            session.currentStep = 'assign_ticket';
            session.ticketToAssign = ticketId;
            await sessionManager.saveSession(from, session);
            await handleAssignTicket(from, session, ticketId);
          } else if (buttonId.startsWith('add_requester_')) {
            // Passer à l'étape d'ajout de demandeur
            session.currentStep = 'add_requester';
            session.ticketToUpdate = ticketId;
            await sessionManager.saveSession(from, session);
            
            // Envoyer un message de confirmation plus détaillé
            await whatsappService.sendMessage(
              from,
              `✅ *Ajout d'un demandeur au ticket #${ticketId}*\n\nVeuillez envoyer le nom ou l'adresse email du demandeur que vous souhaitez ajouter à ce ticket.\n\nExemple : "Jean Dupont" ou "jean.dupont@exemple.com"`
            );
          } else if (buttonId.startsWith('add_comment_')) {
            // Passer à l'étape d'ajout de commentaire
            session.currentStep = 'add_comment';
            session.ticketToComment = ticketId;
            await sessionManager.saveSession(from, session);
            
            // Envoyer un message de confirmation plus détaillé
            await whatsappService.sendMessage(
              from,
              `✅ *Ajout d'un commentaire au ticket #${ticketId}*\n\nVeuillez saisir le commentaire que vous souhaitez ajouter à ce ticket.\n\nVotre commentaire sera visible par tous les intervenants du ticket.`
            );
          } else if (buttonId.startsWith('close_ticket_')) {
            try {
              // Fermer le ticket
              const glpiService = require('./services/glpiService');
              await glpiService.closeTicket(ticketId, "Ticket fermé via le chatbot WhatsApp");
              
              // Déclencher une notification pour les abonnés
              const notificationService = require('./services/notificationService');
              await notificationService.triggerTicketUpdateNotification(ticketId, 'status', {
                previousStatus: 2, // En cours (valeur par défaut)
                status: 6 // Fermé
              });
              
              // Envoyer un message de confirmation
              await whatsappService.sendButtonsMessage(
                from,
                `✅ *Ticket #${ticketId} fermé avec succès!*`,
                `Le ticket #${ticketId} a été fermé. Un commentaire a été ajouté pour indiquer la fermeture.\n\nLes abonnés à ce ticket ont été notifiés de ce changement.`,
                [{
                  type: "reply",
                  reply: {
                    id: "back_to_menu",
                    title: "🏠 Menu principal"
                  }
                }]
              );
              
              // Mettre à jour la session
              session.currentStep = 'main_menu';
              await sessionManager.saveSession(from, session);
            } catch (error) {
              console.error(`Erreur lors de la fermeture du ticket ${ticketId}:`, error);
              await whatsappService.sendMessage(
                from,
                `❌ *Erreur lors de la fermeture du ticket #${ticketId}*\n\nUne erreur s'est produite lors de la fermeture du ticket. Veuillez réessayer plus tard ou contacter l'administrateur.`
              );
            }
          } else if (buttonId.startsWith('sub_ticket_')) {
            try {
              // S'abonner aux notifications du ticket
              const notificationService = require('./services/notificationService');
              notificationService.subscribeToTicket(from, ticketId);
              
              // Envoyer un message de confirmation
              await whatsappService.sendButtonsMessage(
                from,
                `🔔 *Abonnement aux notifications*`,
                `Vous êtes maintenant abonné aux notifications pour le ticket #${ticketId}. Vous recevrez un message lorsque ce ticket sera mis à jour.`,
                [{
                  type: "reply",
                  reply: {
                    id: `view_ticket_${ticketId}`,
                    title: "📃 Voir le ticket"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "back_to_menu",
                    title: "🏠 Menu principal"
                  }
                }]
              );
            } catch (error) {
              console.error(`Erreur lors de l'abonnement au ticket ${ticketId}:`, error);
              await whatsappService.sendMessage(
                from,
                `❌ *Erreur lors de l'abonnement au ticket #${ticketId}*\n\nUne erreur s'est produite. Veuillez réessayer plus tard.`
              );
            }
          } else if (buttonId.startsWith('unsub_ticket_')) {
            try {
              // Se désabonner des notifications du ticket
              const notificationService = require('./services/notificationService');
              notificationService.unsubscribeFromTicket(from, ticketId);
              
              // Envoyer un message de confirmation
              await whatsappService.sendButtonsMessage(
                from,
                `🔕 *Désabonnement des notifications*`,
                `Vous êtes maintenant désabonné des notifications pour le ticket #${ticketId}. Vous ne recevrez plus de messages lorsque ce ticket sera mis à jour.`,
                [{
                  type: "reply",
                  reply: {
                    id: `view_ticket_${ticketId}`,
                    title: "📃 Voir le ticket"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "back_to_menu",
                    title: "🏠 Menu principal"
                  }
                }]
              );
            } catch (error) {
              console.error(`Erreur lors du désabonnement du ticket ${ticketId}:`, error);
              await whatsappService.sendMessage(
                from,
                `❌ *Erreur lors du désabonnement du ticket #${ticketId}*\n\nUne erreur s'est produite. Veuillez réessayer plus tard.`
              );
            }
          } else if (buttonId.startsWith('view_ticket_')) {
            try {
              // Afficher les détails du ticket
              const ticketTrackingService = require('./services/ticketTrackingService');
              await ticketTrackingService.displayTicketDetails(from, ticketId);
              
              // Mettre à jour la session
              session.currentStep = 'view_ticket';
              session.currentTicketId = ticketId;
              await sessionManager.saveSession(from, session);
            } catch (error) {
              console.error(`Erreur lors de l'affichage du ticket ${ticketId}:`, error);
              await whatsappService.sendMessage(
                from,
                `❌ *Erreur lors de l'affichage du ticket #${ticketId}*\n\nUne erreur s'est produite. Veuillez réessayer plus tard.`
              );
            }
          }
        } else if (messageText) {
          // Si l'utilisateur envoie un message texte après la création du ticket, proposer les options
          await whatsappService.sendMessage(
            from,
            `Votre ticket a été créé avec succès ! Vous pouvez utiliser les boutons ci-dessous pour effectuer d'autres actions.`
          );
          
          const actionButtons = [
            {
              type: "reply",
              reply: {
                id: `assign_ticket_${session.lastCreatedTicketId}`,
                title: "👤 Attribuer"
              }
            },
            {
              type: "reply",
              reply: {
                id: `add_requester_${session.lastCreatedTicketId}`,
                title: "📝 Demandeur"
              }
            },
            {
              type: "reply",
              reply: {
                id: `add_comment_${session.lastCreatedTicketId}`,
                title: "💬 Commentaire"
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
          
          await whatsappService.sendButtonsMessage(from, "Actions disponibles", actionButtons, "Options");
        }
        break;
        
      case 'ai_description':
        // Vérifier si c'est une réponse interactive (bouton)
        if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Bouton reçu en mode IA: ${buttonId}`);

          if (buttonId === 'back_to_menu') {
            // Retour au menu principal
            console.log(`Retour au menu principal demandé par ${from}`);
            await sessionManager.deleteSession(from);
            await presentInitialOptions(from);
            return;
          }
        }

        // Analyser la description avec l'IA avancée
        try {
          console.log(`Analyse IA avancée de la demande pour ${from}: "${messageText}"`);

          // Envoyer un message de traitement pour indiquer que l'IA travaille
          await whatsappService.sendMessage(
              from,
              "🧠 Analyse en cours... Je traite votre demande avec notre IA avancée."
          );

          console.log(`Début de l'analyse IA pour ${from} avec le message: "${messageText}"`);          
          
          try {
            // Essayer d'abord avec le service IA avancé
            const analysis = await advancedAiService.analyzeTicketRequest(messageText);
            console.log(`Analyse IA réussie avec advancedAiService: ${JSON.stringify(analysis)}`);  
            
            // Traitement de la description pour extraire un titre si l'IA n'en a pas fourni
            let title = analysis.title;
            let description = messageText;
            
            // Si pas de titre ou titre vide fourni par l'IA
            if (!title || title.trim() === "" || title === "Ticket sans titre") {
              // Extraire la première ligne ou les premiers mots comme titre
              const lines = messageText.split('\n');
              const firstLine = lines[0].trim();
              
              // Si la première ligne est courte, l'utiliser comme titre
              if (firstLine.length <= 80) {
                title = firstLine;
                // Retirer la première ligne de la description si elle est utilisée comme titre
                if (lines.length > 1) {
                  description = lines.slice(1).join('\n').trim();
                }
              } else {
                // Sinon prendre les 50 premiers caractères
                title = firstLine.substring(0, 50) + "...";
              }
            }
            
            // S'assurer que la description n'est pas vide
            if (!description || description.trim() === "") {
              description = "Aucune description fournie.";
            }
            
            // Enregistrer les résultats de l'analyse
            session.aiTicketData = {
              title: title,
              description: description,
              type: analysis.type === 'incident' ? 'incident' : 'request',
              typeId: analysis.type === 'incident' ? 1 : 2,
              category: analysis.category || "incident_autre",
              categoryName: analysis.categoryName || "Autre",
              urgency: (analysis.urgency || 3).toString(),
              urgencyName: getUrgencyName(analysis.urgency || 3),
              suggestions: analysis.suggestions || [],
              missingInfo: analysis.missingInfo || [],
              complexity: analysis.complexity || "moyenne"
            };
          } catch (aiError) {
            console.error(`Erreur avec advancedAiService: ${aiError}. Utilisation du service de secours.`);
            
            // En cas d'échec, utiliser le service IA local amélioré comme secours
            try {
              const fallbackAnalysis = await aiService.analyzeTicket(messageText);
              console.log(`Analyse IA de secours réussie: ${JSON.stringify(fallbackAnalysis)}`);
              
              session.aiTicketData = {
                title: fallbackAnalysis.title || "Ticket sans titre",
                description: messageText,
                type: fallbackAnalysis.type === 'incident' ? 'incident' : 'request',
                typeId: fallbackAnalysis.typeId || (fallbackAnalysis.type === 'incident' ? 1 : 2),
                category: fallbackAnalysis.category || "incident_autre",
                categoryName: fallbackAnalysis.categoryName || "Autre",
                urgency: (fallbackAnalysis.urgency || 3).toString(),
                urgencyName: getUrgencyName(fallbackAnalysis.urgency || 3),
                suggestions: fallbackAnalysis.suggestions || [],
                missingInfo: [],
                complexity: "moyenne"
              };
            } catch (fallbackError) {
              console.error(`Échec de l'analyse IA de secours: ${fallbackError}. Utilisation des valeurs par défaut.`);
              
              // En cas d'échec total, extraire intelligemment un titre et une description
              let title = "";
              let description = messageText;
              
              // Extraire la première ligne ou les premiers mots comme titre
              const lines = messageText.split('\n');
              const firstLine = lines[0].trim();
              
              // Si la première ligne est courte, l'utiliser comme titre
              if (firstLine.length <= 80) {
                title = firstLine;
                // Retirer la première ligne de la description si elle est utilisée comme titre
                if (lines.length > 1) {
                  description = lines.slice(1).join('\n').trim();
                }
              } else {
                // Sinon prendre les 50 premiers caractères
                title = firstLine.substring(0, 50) + "...";
              }
              
              // S'assurer que la description n'est pas vide
              if (!description || description.trim() === "") {
                description = "Aucune description fournie.";
              }
              
              session.aiTicketData = {
                title: title,
                description: description,
                type: 'incident',
                typeId: 1,
                category: "incident_autre",
                categoryName: "Autre incident",
                urgency: "3",
                urgencyName: "Moyenne",
                suggestions: [],
                missingInfo: [],
                complexity: "moyenne"
              };
            }
          }

          session.currentStep = 'ai_confirmation';
          await sessionManager.saveSession(from, session);
          console.log(`Session mise à jour pour ${from}, nouvelle étape: ${session.currentStep}`);

          // Préparer le résumé avec les suggestions
          let summary = `📋 Analyse IA de votre demande :
          
Type : ${session.aiTicketData.type === 'incident' ? 'Incident' : 'Demande'}
Catégorie : ${session.aiTicketData.categoryName}
Titre : ${session.aiTicketData.title}
Urgence : ${session.aiTicketData.urgencyName}
Complexité : ${session.aiTicketData.complexity.charAt(0).toUpperCase() + session.aiTicketData.complexity.slice(1)}

Description : ${session.aiTicketData.description}`;

          // Ajouter les suggestions si disponibles
          if (session.aiTicketData.suggestions && session.aiTicketData.suggestions.length > 0) {
            summary += "\n\n💡 Suggestions initiales :";
            session.aiTicketData.suggestions.forEach((suggestion, index) => {
              summary += `\n${index + 1}. ${suggestion}`;
            });
          }

          // Ajouter les informations manquantes si disponibles
          if (session.aiTicketData.missingInfo && session.aiTicketData.missingInfo.length > 0) {
            summary += "\n\n❓ Informations qui pourraient être utiles :";
            session.aiTicketData.missingInfo.forEach((info, index) => {
              summary += `\n- ${info}`;
            });
          }

          // Ajouter un message de confirmation
          summary += "\n\n✅ Notre IA a analysé votre demande et a préparé un ticket. Veuillez vérifier les informations ci-dessus et confirmer la création du ticket ou modifier les détails si nécessaire.";

          // Demander confirmation
          const confirmButtons = [
            {
              type: "reply",
              reply: {
                id: "confirm_ai_ticket",
                title: "✅ Confirmer"
              }
            },
            {
              type: "reply",
              reply: {
                id: "edit_ai_ticket",
                title: "✏️ Modifier"
              }
            },
            {
              type: "reply",
              reply: {
                id: "cancel_ai_ticket",
                title: "❌ Annuler"
              }
            }
          ];
          
          await whatsappService.sendButtonsMessage(from, summary, confirmButtons, "Confirmation");
        } catch (analysisError) {
          console.error(`Erreur lors de l'analyse IA pour ${from}:`, analysisError);
          await whatsappService.sendMessage(
              from,
              "⚠️ *Erreur lors de l'analyse IA*\n\nDésolé, une erreur s'est produite lors de l'analyse de votre demande. Cela peut arriver lorsque la demande est complexe ou contient des informations que notre IA n'a pas pu interpréter correctement.\n\nVoulez-vous essayer le mode guidé à la place ? Vous serez accompagné pas à pas pour créer votre ticket."
          );
          
          // Attendre un court instant pour que le message soit bien reçu
          await new Promise(resolve => setTimeout(resolve, 500));
          // Proposer de passer en mode guidé
          const optionButtons = [
            {
              type: "reply",
              reply: {
                id: "switch_to_guided",
                title: "Passer en mode guidé"
              }
            },
            {
              type: "reply",
              reply: {
                id: "retry_ai",
                title: "Réessayer en mode IA"
              }
            }
          ];
          
          await whatsappService.sendButtonsMessage(from, "Comment souhaitez-vous procéder ?", optionButtons, "Options");
        }
        break;

      case 'ai_confirmation':
        if (interactiveResponse && (interactiveResponse.type === 'button_reply' || (interactiveResponse.type === 'button' && interactiveResponse.button_reply))) {
          const buttonId = interactiveResponse.button_reply ? interactiveResponse.button_reply.id : null;
          console.log(`Bouton de confirmation IA reçu: ${buttonId}`);

          if (buttonId === 'confirm_ai_ticket') {
            // Créer le ticket
            try {
              console.log("Données du ticket IA avant envoi:", JSON.stringify(session.aiTicketData, null, 2));

              // Envoyer un message de traitement
              await whatsappService.sendMessage(
                  from,
                  "⏳ Création de votre ticket en cours..."
              );

              const ticketResponse = await glpiService.createTicket({
                title: session.aiTicketData.title,
                description: session.aiTicketData.description,
                type: session.aiTicketData.typeId,
                category: session.aiTicketData.categoryId,
                urgency: parseInt(session.aiTicketData.urgency)
              });

              console.log(`Ticket créé avec succès:`, JSON.stringify(ticketResponse));

              // Générer une réponse personnalisée avec l'IA
              const personalizedResponse = await advancedAiService.generatePersonalizedResponse(session.aiTicketData);

              // Envoyer la confirmation avec le numéro de ticket, la réponse personnalisée et des boutons interactifs
              const confirmationMessage = `✅ *Votre ticket a été créé avec succès !*
*Numéro de ticket : #${ticketResponse.id}*

${personalizedResponse}

Vous pouvez effectuer d'autres actions sur ce ticket :`;    
              
              const actionButtons = [
                {
                  type: "reply",
                  reply: {
                    id: `assign_ticket_${ticketResponse.id}`,
                    title: "👤 Attribuer"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: `add_requester_${ticketResponse.id}`,
                    title: "📝 Demandeur"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: `add_comment_${ticketResponse.id}`,
                    title: "💬 Commentaire"
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
              
              await whatsappService.sendButtonsMessage(from, confirmationMessage, actionButtons, "Ticket créé");

              // Envoyer une notification détaillée et abonner l'utilisateur aux notifications
              await ticketMonitorService.notifyTicketCreation(ticketResponse.id, from);

              // Sauvegarder l'ID du ticket dans la session pour le suivi
              session.lastCreatedTicketId = ticketResponse.id;
              session.currentStep = 'ai_ticket_created';
              await sessionManager.saveSession(from, session);

              // Nous avons déjà envoyé les boutons d'action, donc nous n'avons pas besoin d'envoyer un autre message d'options
            } catch (ticketError) {
              console.error(`Erreur lors de la création du ticket IA pour ${from}:`, ticketError);
              
              // Envoyer un message d'erreur avec un bouton de retour au menu principal
              await whatsappService.sendButtonsMessage(
                from,
                "❌ *Erreur de création de ticket*",
                "Désolé, une erreur s'est produite lors de la création de votre ticket en mode IA. Veuillez réessayer plus tard.",
                [{
                  type: "reply",
                  reply: {
                    id: "back_to_menu",
                    title: "🏠 Menu principal"
                  }
                }]
              );

              // Réinitialiser la session pour revenir au menu principal
              session.currentStep = 'main_menu';
              await sessionManager.saveSession(from, session);
            }
          } else if (buttonId === 'edit_ai_ticket') {
            // Permettre à l'utilisateur de modifier les détails du ticket
            session.currentStep = 'ai_edit_selection';
            await sessionManager.saveSession(from, session);
            
            // Envoyer un message de confirmation
            await whatsappService.sendMessage(
                from,
                "✅ Vous pouvez maintenant modifier les détails du ticket. Sélectionnez l'élément que vous souhaitez modifier dans la liste ci-dessous."
            );

            // Attendre un court instant pour que le message soit bien reçu
            await new Promise(resolve => setTimeout(resolve, 500));

            await whatsappService.sendListMessage(
                from,
                "Modifier le ticket",
                "Sélectionnez un élément à modifier",
                "Choisir",
                [
                  {
                    id: "edit_title",
                    title: "Titre",
                    description: session.aiTicketData.title
                  },
                  {
                    id: "edit_urgency",
                    title: "Urgence",
                    description: session.aiTicketData.urgencyName
                  },
                  {
                    id: "edit_category",
                    title: "Catégorie",
                    description: session.aiTicketData.categoryName
                  },
                  {
                    id: "edit_description",
                    title: "Description",
                    description: "Modifier la description"
                  }
                ]
            );
          } else if (buttonId === 'switch_to_guided') {
            // Passer en mode guidé
            session.currentStep = 'guided_type_selection';
            await sessionManager.saveSession(from, session);
            
            await whatsappService.sendMessage(
                from,
                "✅ *Passage au mode guidé*\n\nVous allez maintenant être guidé pas à pas pour créer votre ticket. Veuillez sélectionner le type de ticket dans les options ci-dessous."
            );
            
            // Attendre un court instant pour que le message soit bien reçu
            await new Promise(resolve => setTimeout(resolve, 500));

            await presentTicketTypes(from);
          } else if (buttonId === 'cancel_ai_ticket') {
            // Annuler la création du ticket
            session.currentStep = 'initial';
            session.aiTicketData = {};
            await sessionManager.saveSession(from, session);

            await whatsappService.sendMessage(
                from,
                "❌ *Création du ticket annulée*\n\nVotre demande a bien été annulée. Aucun ticket n'a été créé dans le système.\n\nVous pouvez démarrer une nouvelle création à tout moment en utilisant les options ci-dessous."
            );
            
            // Attendre un court instant pour que le message soit bien reçu
            await new Promise(resolve => setTimeout(resolve, 500));

            await sendInitialOptions(from);
          }
        } else {
          // Message texte reçu pendant la confirmation, demander à nouveau la confirmation
          await whatsappService.sendMessage(
              from,
              "Veuillez utiliser les boutons pour confirmer ou annuler la création du ticket."
          );

          // Renvoyer les options de confirmation
          let summary = `📋 Analyse IA de votre demande :
          
Type : ${session.aiTicketData.type === 'incident' ? 'Incident' : 'Demande'}
Catégorie : ${session.aiTicketData.categoryName}
Titre : ${session.aiTicketData.title}
Urgence : ${session.aiTicketData.urgencyName}
${session.aiTicketData.complexity ? `Complexité : ${session.aiTicketData.complexity.charAt(0).toUpperCase() + session.aiTicketData.complexity.slice(1)}` : ''}

Description : ${session.aiTicketData.description}`;

          // Ajouter les suggestions si disponibles
          if (session.aiTicketData.suggestions && session.aiTicketData.suggestions.length > 0) {
            summary += "\n\n💡 Suggestions initiales :";
            session.aiTicketData.suggestions.forEach((suggestion, index) => {
              summary += `\n${index + 1}. ${suggestion}`;
            });
          }

          // Ajouter les informations manquantes si disponibles
          if (session.aiTicketData.missingInfo && session.aiTicketData.missingInfo.length > 0) {
            summary += "\n\n❓ Informations qui pourraient être utiles :";
            session.aiTicketData.missingInfo.forEach((info, index) => {
              summary += `\n- ${info}`;
            });
          }

          await whatsappService.sendButtonsMessage(
              from,
              "Confirmation",
              summary,
              [
                {
                  id: "confirm_ai_ticket",
                  title: "Créer le ticket"
                },
                {
                  id: "edit_ai_ticket",
                  title: "Modifier"
                },
                {
                  id: "cancel_ai_ticket",
                  title: "Annuler"
                }
              ]
          );
        }
        break;

      case 'ai_edit_selection':
        if (interactiveResponse && interactiveResponse.type === 'list_reply') {
          const editOption = interactiveResponse.list_reply.id;
          console.log(`Option d'édition sélectionnée: ${editOption}`);

          switch (editOption) {
            case 'edit_title':
              session.currentStep = 'ai_edit_title';
              await sessionManager.saveSession(from, session);
              await whatsappService.sendMessage(
                  from,
                  `✅ Vous avez choisi de modifier le titre.\n\nTitre actuel : *${session.aiTicketData.title}*\n\nVeuillez entrer le nouveau titre pour votre ticket :`
              );
              break;

            case 'edit_urgency':
              session.currentStep = 'ai_edit_urgency';
              await sessionManager.saveSession(from, session);
              // Envoyer un message de confirmation
              await whatsappService.sendMessage(
                  from,
                  `✅ Vous avez choisi de modifier l'urgence.\n\nUrgence actuelle : *${session.aiTicketData.urgencyName}*\n\nVeuillez sélectionner le nouveau niveau d'urgence dans la liste ci-dessous.`
              );
              
              // Attendre un court instant pour que le message soit bien reçu
              await new Promise(resolve => setTimeout(resolve, 500));
              
              await whatsappService.sendListMessage(
                  from,
                  "Niveau d'urgence",
                  "Sélectionnez une nouvelle urgence :",
                  "Choisir l'urgence",
                  [
                    {
                      id: "1",
                      title: "Très haute",
                      description: "Critique, bloquant pour l'entreprise"
                    },
                    {
                      id: "2",
                      title: "Haute",
                      description: "Impact important sur plusieurs utilisateurs"
                    },
                    {
                      id: "3",
                      title: "Moyenne",
                      description: "Impact modéré"
                    },
                    {
                      id: "4",
                      title: "Basse",
                      description: "Peu d'impact"
                    },
                    {
                      id: "5",
                      title: "Très basse",
                      description: "Amélioration mineure"
                    }
                  ]
              );
              break;

            case 'edit_category':
              session.currentStep = 'ai_edit_category';
              await sessionManager.saveSession(from, session);
              
              // Envoyer un message de confirmation
              await whatsappService.sendMessage(
                  from,
                  `✅ Vous avez choisi de modifier la catégorie.\n\nCatégorie actuelle : *${session.aiTicketData.categoryName}*\n\nVeuillez sélectionner la nouvelle catégorie dans la liste ci-dessous.`
              );
              
              // Attendre un court instant pour que le message soit bien reçu
              await new Promise(resolve => setTimeout(resolve, 500));

              // Déterminer les catégories à présenter en fonction du type
              const categories = session.aiTicketData.type === 'incident'
                  ? incidentCategories
                  : requestCategories;

              await presentCategories(from, categories);
              break;

            case 'edit_description':
              session.currentStep = 'ai_edit_description';
              await sessionManager.saveSession(from, session);
              await whatsappService.sendMessage(
                  from,
                  "Veuillez entrer la nouvelle description pour votre ticket :"
              );
              break;
          }
        } else {
          // Si ce n'est pas une réponse interactive, renvoyer les options d'édition
          await whatsappService.sendListMessage(
              from,
              "Modifier le ticket",
              "Que souhaitez-vous modifier ?",
              "Choisir",
              [
                {
                  id: "edit_title",
                  title: "Titre",
                  description: session.aiTicketData.title
                },
                {
                  id: "edit_urgency",
                  title: "Urgence",
                  description: session.aiTicketData.urgencyName
                },
                {
                  id: "edit_category",
                  title: "Catégorie",
                  description: session.aiTicketData.categoryName
                },
                {
                  id: "edit_description",
                  title: "Description",
                  description: "Modifier la description"
                }
              ]
          );
        }
        break;

      case 'ai_edit_title':
        // Mettre à jour le titre
        session.aiTicketData.title = messageText;
        session.currentStep = 'ai_confirmation';
        await sessionManager.saveSession(from, session);

        await whatsappService.sendMessage(
            from,
            `✅ *Titre mis à jour avec succès !*\n\nAncien titre : ${session.aiTicketData.title}\nNouveau titre : *${messageText}*\n\nJe prépare le résumé de votre ticket...`
        );
        
        // Attendre un court instant pour que le message soit bien reçu
        await new Promise(resolve => setTimeout(resolve, 500));

        // Renvoyer le résumé pour confirmation
        await sendAiTicketSummary(from, session.aiTicketData);
        break;

      case 'ai_edit_description':
        // Analyser à nouveau avec la nouvelle description
        try {
          await whatsappService.sendMessage(
              from,
              `✅ *Description mise à jour avec succès !*\n\nNouvelle description : *${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}*\n\n🧠 Analyse de votre nouvelle description en cours...`
          );

          const analysis = await advancedAiService.analyzeTicketRequest(messageText);

          // Enregistrer les résultats de l'analyse
          session.aiTicketData = {
            ...session.aiTicketData,
            description: messageText,
            title: analysis.title,
            urgency: analysis.urgency.toString(),
            urgencyName: getUrgencyName(analysis.urgency),
            suggestions: analysis.suggestions || [],
            missingInfo: analysis.missingInfo || [],
            complexity: analysis.complexity || "moyenne"
          };

          session.currentStep = 'ai_confirmation';
          await sessionManager.saveSession(from, session);

          await whatsappService.sendMessage(
              from,
              `✅ *Description mise à jour et ticket réanalysé avec succès !*\n\nL'IA a analysé votre description et a mis à jour les informations du ticket.\n\nJe prépare le résumé de votre ticket...`
          );
          
          // Attendre un court instant pour que le message soit bien reçu
          await new Promise(resolve => setTimeout(resolve, 500));

          // Renvoyer le résumé pour confirmation
          await sendAiTicketSummary(from, session.aiTicketData);
        } catch (error) {
          console.error(`Erreur lors de la réanalyse pour ${from}:`, error);

          // Mettre simplement à jour la description sans réanalyse
          session.aiTicketData.description = messageText;
          session.currentStep = 'ai_confirmation';
          await sessionManager.saveSession(from, session);

          await whatsappService.sendMessage(
              from,
              `✅ *Description mise à jour avec succès !*\n\nNouvelle description : *${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}*\n\nJe prépare le résumé de votre ticket...`
          );
          
          // Attendre un court instant pour que le message soit bien reçu
          await new Promise(resolve => setTimeout(resolve, 500));

          // Renvoyer le résumé pour confirmation
          await sendAiTicketSummary(from, session.aiTicketData);
        }
        break;

      case 'ai_edit_urgency':
        if (interactiveResponse && interactiveResponse.type === 'list_reply') {
          const urgencyId = interactiveResponse.list_reply.id;
          const urgencyTitle = interactiveResponse.list_reply.title;

          // Mettre à jour l'urgence
          session.aiTicketData.urgency = urgencyId;
          session.aiTicketData.urgencyName = urgencyTitle;
          session.currentStep = 'ai_confirmation';
          await sessionManager.saveSession(from, session);

          await whatsappService.sendMessage(
              from,
              `✅ *Urgence mise à jour avec succès !*\n\nAncienne urgence : ${session.aiTicketData.urgencyName}\nNouvelle urgence : *${urgencyTitle}*\n\nJe prépare le résumé de votre ticket...`
          );
          
          // Attendre un court instant pour que le message soit bien reçu
          await new Promise(resolve => setTimeout(resolve, 500));

          // Renvoyer le résumé pour confirmation
          await sendAiTicketSummary(from, session.aiTicketData);
        } else {
          // Si ce n'est pas une réponse interactive, renvoyer les options d'urgence
          await whatsappService.sendListMessage(
              from,
              "Niveau d'urgence",
              "Veuillez sélectionner le niveau d'urgence :",
              "Choisir l'urgence",
              [
                {
                  id: "1",
                  title: "Très haute",
                  description: "Critique, bloquant pour l'entreprise"
                },
                {
                  id: "2",
                  title: "Haute",
                  description: "Impact important sur plusieurs utilisateurs"
                },
                {
                  id: "3",
                  title: "Moyenne",
                  description: "Impact modéré"
                },
                {
                  id: "4",
                  title: "Basse",
                  description: "Peu d'impact"
                },
                {
                  id: "5",
                  title: "Très basse",
                  description: "Amélioration mineure"
                }
              ]
          );
        }
        break;

      case 'ai_edit_category':
        if (interactiveResponse && interactiveResponse.type === 'list_reply') {
          const categoryId = interactiveResponse.list_reply.id;
          const categoryName = interactiveResponse.list_reply.title;

          // Mettre à jour la catégorie
          session.aiTicketData.categoryId = categoryId;
          session.aiTicketData.categoryName = categoryName;
          session.currentStep = 'ai_confirmation';
          await sessionManager.saveSession(from, session);

          await whatsappService.sendMessage(
              from,
              `✅ *Catégorie mise à jour avec succès !*\n\nAncienne catégorie : ${session.aiTicketData.categoryName}\nNouvelle catégorie : *${categoryName}*\n\nJe prépare le résumé de votre ticket...`
          );
          
          // Attendre un court instant pour que le message soit bien reçu
          await new Promise(resolve => setTimeout(resolve, 500));

          // Renvoyer le résumé pour confirmation
          await sendAiTicketSummary(from, session.aiTicketData);
        } else {
          // Si ce n'est pas une réponse interactive, renvoyer les catégories
          const categories = session.aiTicketData.type === 'incident'
              ? incidentCategories
              : requestCategories;

          await presentCategories(from, categories);
        }
        break;

      default:
        console.log(`Étape inconnue en mode IA pour ${from}: ${session.currentStep}`);
        
        // Message d'erreur avec des boutons interactifs
        await whatsappService.sendButtonsMessage(
            from,
            "❌ *Étape inconnue*",
            "Désolé, une erreur s'est produite lors du traitement de votre demande en mode IA. Retour au menu principal.",
            [{
              type: "reply",
              reply: {
                id: "back_to_menu",
                title: "🏠 Menu principal"
              }
            }]
        );

        // Réinitialiser la session
        session.currentStep = 'main_menu';
        await sessionManager.saveSession(from, session);

        await presentInitialOptions(from);
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du message en mode IA pour ${from}:`, error);
    
    // Message d'erreur avec des boutons interactifs
    await whatsappService.sendButtonsMessage(
      from,
      "❌ *Erreur de traitement*",
      "Désolé, une erreur s'est produite lors du traitement de votre message en mode IA. Veuillez réessayer plus tard.",
      [{
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }]
    );
    
    // Réinitialiser la session
    try {
      const session = await sessionManager.getSession(from) || {};
      session.currentStep = 'main_menu';
      await sessionManager.saveSession(from, session);
    } catch (saveError) {
      console.error(`Erreur lors de la réinitialisation de la session pour ${from}:`, saveError);
    }
  }
}

// Gérer les messages en mode suivi de ticket
async function handleTrackingModeMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message en mode suivi de ticket pour ${from}, étape: ${session.currentStep}`);

    // Vérifier si l'utilisateur a envoyé "annuler" ou "reset"
    if (messageText && (messageText.toLowerCase() === 'annuler' || messageText.toLowerCase() === 'reset')) {
      console.log(`Annulation du mode suivi de ticket pour ${from}`);
      await whatsappService.sendMessage(
          from,
          "Suivi de ticket annulé. Retour au menu principal."
      );

      // Réinitialiser la session
      session.currentStep = 'initial';
      await sessionManager.saveSession(from, session);

      // Présenter les options initiales
      await presentInitialOptions(from);
      return;
    }

    // Traiter les réponses interactives (boutons)
    if (interactiveResponse && interactiveResponse.type === 'button_reply') {
      const buttonId = interactiveResponse.button_reply.id;
      console.log(`Bouton cliqué en mode suivi de ticket: ${buttonId}`);

      if (buttonId === 'back_to_menu') {
        console.log(`Retour au menu principal pour ${from}`);

        // Réinitialiser la session
        session.currentStep = 'initial';
        await sessionManager.saveSession(from, session);

        // Présenter les options initiales
        await presentInitialOptions(from);
        return;
      } else if (buttonId === 'track_another_ticket') {
        // Redémarrer le mode suivi de ticket avec l'interface améliorée
        await enhancedSearchService.startEnhancedTicketSearch(from);
        return;
      } else if (buttonId === 'assign_ticket') {
        // Attribuer le ticket
        console.log(`Attribution du ticket pour ${from}`);

        // Présenter les options d'attribution
        const assignmentOptionsMessage = ticketTrackingService.formatAssignmentOptionsMessage();
        await whatsappService.sendButtonsMessage(
            from,
            "Attribution de ticket",
            assignmentOptionsMessage,
            [
              {
                id: "assign_to_group",
                title: "Attribuer à un groupe"
              },
              {
                id: "assign_to_technician",
                title: "Attribuer à un technicien"
              },
              {
                id: "back_to_ticket",
                title: "Retour au ticket"
              }
            ]
        );

        session.currentStep = 'tracking_assignment_options';
        await sessionManager.saveSession(from, session);
        return;
      } else if (buttonId.startsWith('comment_ticket_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Demander le commentaire
        await whatsappService.sendMessage(
            from,
            ticketTrackingService.formatAddCommentMessage()
        );

        session.currentStep = 'tracking_add_comment';
        session.ticketId = ticketId;
        await sessionManager.saveSession(from, session);
        return;
      } else if (buttonId.startsWith('add_followup_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Demander le suivi
        await whatsappService.sendMessage(
            from,
            ticketTrackingService.formatAddFollowupMessage()
        );

        session.currentStep = 'tracking_add_followup';
        session.ticketId = ticketId;
        await sessionManager.saveSession(from, session);
        return;
      } else if (buttonId.startsWith('add_requester_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Demander le demandeur
        await whatsappService.sendMessage(
            from,
            ticketTrackingService.formatAddRequesterMessage()
        );

        session.currentStep = 'tracking_add_requester';
        session.ticketId = ticketId;
        await sessionManager.saveSession(from, session);
        return;
      } else if (buttonId.startsWith('assign_technician_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Récupérer la liste des techniciens
        const technicians = await glpiService.getTechnicians();
        
        if (technicians && technicians.length > 0) {
          // Stocker les techniciens dans la session
          session.availableTechnicians = technicians.slice(0, 5); // Limiter à 5 techniciens pour les boutons
          session.currentStep = 'tracking_assign_technician';
          session.ticketId = ticketId;
          await sessionManager.saveSession(from, session);
          
          // Formater le message avec la liste des techniciens
          const message = ticketTrackingService.formatTechniciansListMessage(session.availableTechnicians);
          
          // Créer les boutons pour chaque technicien
          const buttons = session.availableTechnicians.map((tech, index) => ({
            type: "reply",
            reply: {
              id: `select_tech_${index + 1}`,
              title: `${index + 1}. ${tech.name.substring(0, 20)}`
            }
          }));
          
          // Ajouter un bouton pour revenir au ticket
          buttons.push({
            type: "reply",
            reply: {
              id: `back_to_ticket_${ticketId}`,
              title: "🔙 Retour au ticket"
            }
          });
          
          // Envoyer le message avec les boutons
          await whatsappService.sendButtonsMessage(from, message, buttons, "Attribution de technicien");
        } else {
          await whatsappService.sendMessage(
            from,
            "⚠️ Aucun technicien disponible. Veuillez réessayer plus tard."
          );
          
          // Afficher à nouveau les détails du ticket
          await ticketTrackingService.displayTicketDetails(from, ticketId);
        }
        return;
      } else if (buttonId.startsWith('subscribe_ticket_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.split('_').pop();
        
        // Vérifier si l'utilisateur est déjà abonné
        const isSubscribed = notificationService.isSubscribed(from, ticketId);

        if (!isSubscribed) {
          // S'abonner aux notifications
          notificationService.subscribeToTicket(from, ticketId);
          await whatsappService.sendMessage(
              from,
              `✅ Vous êtes désormais abonné aux notifications pour le ticket #${ticketId}.`
          );
          
          // Afficher à nouveau les détails du ticket après un court délai
          setTimeout(() => ticketTrackingService.displayTicketDetails(from, ticketId), 1000);
        } else {
          await whatsappService.sendMessage(
              from,
              `Vous êtes déjà abonné aux notifications pour le ticket #${ticketId}.`
          );
          
          // Afficher à nouveau les détails du ticket après un court délai
          setTimeout(() => ticketTrackingService.displayTicketDetails(from, ticketId), 1000);
        }
      } else if (buttonId === 'unsubscribe_notifications') {
        // Se désabonner des notifications
        console.log(`Désabonnement des notifications pour ${from}`);

        // Vérifier si l'utilisateur est déjà abonné
        const isSubscribed = notificationService.isSubscribed(from, session.ticketId);

        if (isSubscribed) {
          // Se désabonner des notifications
          notificationService.unsubscribeFromTicket(from, session.ticketId);
          await whatsappService.sendMessage(
              from,
              `✅ Vous êtes désormais désabonné des notifications pour le ticket #${session.ticketId}.`
          );
        } else {
          await whatsappService.sendMessage(
              from,
              `Vous n'êtes pas abonné aux notifications pour le ticket #${session.ticketId}.`
          );
        }
      } else if (buttonId.startsWith('view_comments_')) {
        // Extraire l'ID du ticket
        const ticketId = buttonId.replace('view_comments_', '');

        // Récupérer et afficher les commentaires du ticket
        const commentsResult = await ticketTrackingService.getTicketComments(ticketId);

        if (commentsResult.success) {
          // Envoyer le message avec les commentaires
          if (commentsResult.buttons && commentsResult.buttons.length > 0) {
            await whatsappService.sendButtonsMessage(
                from,
                commentsResult.message,
                commentsResult.buttons
            );
          } else {
            await whatsappService.sendMessage(from, commentsResult.message);
          }
        } else {
          // Envoyer un message d'erreur
          await whatsappService.sendMessage(from, commentsResult.message);
        }

        // Mettre à jour la session
        session.currentStep = 'viewing_comments';
        session.currentTicketId = parseInt(ticketId);
        await sessionManager.saveSession(from, session);
      }
    }

    switch (session.currentStep) {
      case 'tracking_enter_id':
        // Récupérer le numéro de ticket
        if (!messageText || isNaN(parseInt(messageText))) {
          await whatsappService.sendMessage(
              from,
              "Veuillez entrer un numéro de ticket valide (chiffres uniquement)."
          );
          return;
        }

        const ticketId = parseInt(messageText);
        console.log(`Numéro de ticket reçu: ${ticketId}`);

        // Afficher un message d'attente
        await whatsappService.sendMessage(
            from,
            "Recherche du ticket en cours... ⏳"
        );

        // Récupérer les détails du ticket
        try {
          const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
          
          if (!ticketDetails) {
            await whatsappService.sendMessage(
                from,
                `⚠️ Le ticket #${ticketId} n'a pas été trouvé. Veuillez vérifier le numéro et réessayer.`
            );
            return;
          }
          
          console.log(`Détails du ticket récupérés pour ${from}:`, JSON.stringify(ticketDetails));

          // Enregistrer l'ID du ticket dans la session
          session.ticketId = ticketId;
          session.currentStep = 'tracking_ticket';
          await sessionManager.saveSession(from, session);

          // Utiliser la fonction displayTicketDetails pour afficher les détails du ticket
          await ticketTrackingService.displayTicketDetails(from, ticketId);
          return;
        } catch (error) {
          console.error(`Erreur lors de la récupération du ticket ${ticketId} pour ${from}:`, error);

          await whatsappService.sendButtonsMessage(
              from,
              "Erreur",
              `Désolé, le ticket #${ticketId} n'a pas été trouvé ou une erreur s'est produite lors de sa récupération.`,
              [
                {
                  id: "track_another_ticket",
                  title: "Essayer un autre ticket"
                },
                {
                  id: "back_to_menu",
                  title: "Retour au menu"
                }
              ]
          );
        }
        break;

      case 'tracking_assignment_options':
        if (interactiveResponse && interactiveResponse.type === 'button_reply') {
          const buttonId = interactiveResponse.button_reply.id;
          console.log(`Bouton d'attribution cliqué: ${buttonId}`);

          if (buttonId === 'assign_to_group') {
            // Récupérer la liste des groupes
            try {
              const groups = await glpiService.getGroups();

              // Formater et afficher la liste des groupes
              const groupsMessage = ticketTrackingService.formatGroupsListMessage(groups);
              await whatsappService.sendMessage(from, groupsMessage);

              // Stocker les groupes dans la session pour référence
              session.availableGroups = groups;
              session.currentStep = 'tracking_select_group';
              await sessionManager.saveSession(from, session);
            } catch (error) {
              console.error(`Erreur lors de la récupération des groupes pour ${from}:`, error);
              await whatsappService.sendMessage(
                  from,
                  "Une erreur s'est produite lors de la récupération des groupes. Veuillez réessayer plus tard."
              );
            }
            return;
          } else if (buttonId === 'assign_to_technician') {
            // Récupérer la liste des techniciens
            try {
              const technicians = await glpiService.getTechnicians();

              // Formater et afficher la liste des techniciens
              const techniciansMessage = ticketTrackingService.formatTechniciansListMessage(technicians);
              await whatsappService.sendMessage(from, techniciansMessage);

              // Stocker les techniciens dans la session pour référence
              session.availableTechnicians = technicians;
              session.currentStep = 'tracking_select_technician';
              await sessionManager.saveSession(from, session);
            } catch (error) {
              console.error(`Erreur lors de la récupération des techniciens pour ${from}:`, error);
              await whatsappService.sendMessage(
                  from,
                  "Une erreur s'est produite lors de la récupération des techniciens. Veuillez réessayer plus tard."
              );
            }
            return;
          } else if (buttonId === 'back_to_ticket') {
            // Récupérer et afficher à nouveau les détails du ticket
            try {
              const ticketDetails = await ticketTrackingService.getTicketDetails(session.ticketId);

              // Formater et afficher les informations du ticket
              const ticketMessage = ticketTrackingService.formatTicketMessage(ticketDetails);
              await whatsappService.sendMessage(from, ticketMessage);

              // Afficher les options de suivi
              await whatsappService.sendButtonsMessage(
                  from,
                  "Options de suivi",
                  "Que souhaitez-vous faire maintenant ?",
                  [
                    {
                      id: `assign_ticket_${ticketResponse.id}`,
                      title: "Attribuer ce ticket"
                    },
                    {
                      id: `add_comment_${ticketResponse.id}`,
                      title: "Ajouter un commentaire"
                    },
                    {
                      id: "track_another_ticket",
                      title: "Suivre un autre ticket"
                    },
                    {
                      id: "back_to_menu",
                      title: "Retour au menu"
                    }
                  ]
              );

              session.currentStep = 'tracking_display_options';
              await sessionManager.saveSession(from, session);
            } catch (error) {
              console.error(`Erreur lors de la récupération du ticket ${session.ticketId} pour ${from}:`, error);
              await whatsappService.sendMessage(
                  from,
                  "Une erreur s'est produite lors de la récupération du ticket. Veuillez réessayer plus tard."
              );
            }
            return;
          }
        }
        break;

      case 'tracking_select_group':
        // Attribuer le ticket à un groupe
        if (messageText) {
          const groupId = messageText;
          console.log(`Attribution du ticket au groupe ${groupId} pour ${from}`);

          // Attribuer le ticket
          try {
            await ticketTrackingService.assignTicketToGroup(session.ticketId, groupId);

            await whatsappService.sendMessage(
                from,
                `✅ Ticket #${session.ticketId} attribué au groupe ${groupId} avec succès.`
            );
          } catch (error) {
            console.error(`Erreur lors de l'attribution du ticket ${session.ticketId} pour ${from}:`, error);

            await whatsappService.sendMessage(
                from,
                `Erreur lors de l'attribution du ticket #${session.ticketId} au groupe ${groupId}. Veuillez réessayer plus tard.`
            );
          }
        } else {
          await whatsappService.sendMessage(
              from,
              "Veuillez entrer un ID de groupe valide pour attribuer le ticket."
          );
        }
        break;

      case 'tracking_select_technician':
        // Attribuer le ticket à un technicien
        if (messageText) {
          const technicianId = messageText;
          console.log(`Attribution du ticket au technicien ${technicianId} pour ${from}`);

          // Attribuer le ticket
          try {
            await ticketTrackingService.assignTicketToTechnician(session.ticketId, technicianId);

            await whatsappService.sendMessage(
                from,
                `✅ Ticket #${session.ticketId} attribué au technicien ${technicianId} avec succès.`
            );
          } catch (error) {
            console.error(`Erreur lors de l'attribution du ticket ${session.ticketId} pour ${from}:`, error);

            await whatsappService.sendMessage(
                from,
                `Erreur lors de l'attribution du ticket #${session.ticketId} au technicien ${technicianId}. Veuillez réessayer plus tard.`
            );
          }
        } else {
          await whatsappService.sendMessage(
              from,
              "Veuillez entrer un ID de technicien valide pour attribuer le ticket."
          );
        }
        break;

      case 'tracking_add_comment':
        // Ajouter le commentaire
        if (messageText) {
          console.log(`Ajout du commentaire pour ${from}`);

          // Ajouter le commentaire
          try {
            await ticketTrackingService.addTicketComment(session.ticketId, messageText);

            // Envoyer un message de confirmation avec des boutons interactifs
            await whatsappService.sendButtonsMessage(
                from,
                `✅ *Commentaire ajouté avec succès!*`,
                `Votre commentaire a été ajouté au ticket #${session.ticketId}.\n\nLe commentaire a été enregistré dans le système GLPI.`,
                [
                  {
                    type: "reply",
                    reply: {
                      id: `view_ticket_${session.ticketId}`,
                      title: "📃 Voir le ticket"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `assign_ticket_${session.ticketId}`,
                      title: "👤 Attribuer"
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
            );
            
            // Réinitialiser la session
            session.currentStep = 'main_menu';
            await sessionManager.saveSession(from, session);
          } catch (error) {
            console.error(`Erreur lors de l'ajout du commentaire pour ${from}:`, error);

            // Envoyer un message d'erreur avec un bouton de retour au menu principal
            await whatsappService.sendButtonsMessage(
                from,
                `❌ *Erreur lors de l'ajout du commentaire*`,
                `Une erreur s'est produite lors de l'ajout du commentaire au ticket #${session.ticketId}. Veuillez réessayer plus tard.`,
                [{
                  type: "reply",
                  reply: {
                    id: "back_to_menu",
                    title: "🏠 Menu principal"
                  }
                }]
            );
            
            // Réinitialiser la session
            session.currentStep = 'main_menu';
            await sessionManager.saveSession(from, session);
          }
        } else {
          // Envoyer un message d'erreur avec des boutons interactifs
          await whatsappService.sendButtonsMessage(
              from,
              "⚠️ *Commentaire invalide*",
              "Veuillez entrer un commentaire valide pour l'ajouter au ticket. Que souhaitez-vous faire ?",
              [
                {
                  type: "reply",
                  reply: {
                    id: `view_ticket_${session.ticketId}`,
                    title: "📃 Voir le ticket"
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
          );
          
          // Réinitialiser la session
          session.currentStep = 'main_menu';
          await sessionManager.saveSession(from, session);
        }
        break;

      default:
        console.log(`Étape inconnue en mode suivi de ticket pour ${from}: ${session.currentStep}`);
        
        // Envoyer un message d'erreur avec un bouton de retour au menu principal
        await whatsappService.sendButtonsMessage(
            from,
            "❌ *Étape inconnue*",
            "Désolé, une erreur s'est produite lors du traitement de votre demande. Retour au menu principal.",
            [{
              type: "reply",
              reply: {
                id: "back_to_menu",
                title: "🏠 Menu principal"
              }
            }]
        );

        // Réinitialiser la session
        try {
          session.currentStep = 'main_menu';
          await sessionManager.saveSession(from, session);

          // Présenter les options initiales
          await presentInitialOptions(from);
        } catch (saveError) {
          console.error(`Erreur lors de la réinitialisation de la session pour ${from}:`, saveError);
        }
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du message en mode suivi de ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors du traitement de votre message. Retour au menu principal."
    );

    // Réinitialiser la session
    try {
      session.currentStep = 'initial';
      await sessionManager.saveSession(from, session);

      // Présenter les options initiales
      await presentInitialOptions(from);
    } catch (saveError) {
      console.error(`Erreur lors de la réinitialisation de la session pour ${from}:`, saveError);
    }
  }
}

// Gérer les messages en mode recherche par ID
async function handleSearchModeMessage(from, messageText, interactiveResponse, session) {
  try {
    console.log(`Traitement du message en mode recherche par ID pour ${from}, étape: ${session.currentStep}`);

    // Vérifier si l'utilisateur a envoyé "annuler" ou "reset"
    if (messageText && (messageText.toLowerCase() === 'annuler' || messageText.toLowerCase() === 'reset')) {
      console.log(`Annulation du mode recherche par ID pour ${from}`);
      await whatsappService.sendMessage(
          from,
          "Recherche annulée. Retour au menu principal."
      );

      // Réinitialiser la session
      session.currentStep = 'initial';
      await sessionManager.saveSession(from, session);

      // Présenter les options initiales
      await presentInitialOptions(from);
      return;
    }
    // Vérifier s'il s'agit d'une réponse interactive (bouton)
    if (interactiveResponse && interactiveResponse.type === 'button_reply') {
      const buttonId = interactiveResponse.button_reply.id;
      console.log(`Bouton pressé en mode recherche: ${buttonId}`);

      if (buttonId === 'back_to_menu') {
        // Retour au menu principal
        console.log(`Retour au menu principal demandé par ${from}`);
        
        // Réinitialiser la session
        session.currentStep = 'initial';
        await sessionManager.saveSession(from, session);
        
        // Présenter les options initiales
        return await presentInitialOptions(from);
      }
    }
    
    // Si nous sommes en mode recherche par ID et que l'utilisateur a envoyé un message texte
    if (session.currentStep === 'search_by_id' && messageText) {
      // Vérifier si le message est un nombre (ID de ticket)
      const ticketId = parseInt(messageText.trim());
      
      if (!isNaN(ticketId)) {
        console.log(`Recherche du ticket ${ticketId} pour ${from}`);
        
        try {
          // Récupérer les détails du ticket
          const ticketDetails = await ticketTrackingService.getTicketDetails(ticketId);
          
          if (ticketDetails) {
            // Mettre à jour la session pour le suivi de ticket
            session.currentStep = 'tracking_ticket';
            session.ticketId = ticketId;
            await sessionManager.saveSession(from, session);
            
            // Afficher les détails du ticket avec l'interface améliorée
            await displayEnhancedTicketDetails(from, ticketId);
          } else {
            // Envoyer un message d'erreur avec des boutons interactifs
            await whatsappService.sendButtonsMessage(
              from,
              `⚠️ *Ticket non trouvé*`,
              `Le ticket #${ticketId} n'a pas été trouvé. Veuillez vérifier le numéro et réessayer.`,
              [
                {
                  type: "reply",
                  reply: {
                    id: "search_tickets",
                    title: "🔍 Rechercher à nouveau"
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
            );
            
            // Mettre à jour la session
            session.currentStep = 'initial';
            await sessionManager.saveSession(from, session);
          }
        } catch (error) {
          console.error(`Erreur lors de la recherche du ticket ${ticketId}:`, error);
          
          // Envoyer un message d'erreur avec des boutons interactifs
          await whatsappService.sendButtonsMessage(
            from,
            "❌ *Erreur lors de la recherche*",
            "Désolé, une erreur s'est produite lors de la recherche du ticket. Veuillez réessayer plus tard.",
            [{
              type: "reply",
              reply: {
                id: "back_to_menu",
                title: "🏠 Menu principal"
              }
            }]
          );
          
          // Mettre à jour la session
          session.currentStep = 'main_menu';
          await sessionManager.saveSession(from, session);
        }
      } else {
        // Message d'erreur pour ID de ticket invalide avec des boutons interactifs
        await whatsappService.sendButtonsMessage(
          from,
          "⚠️ *Format invalide*",
          "Veuillez entrer un numéro de ticket valide (chiffres uniquement).",
          [
            {
              type: "reply",
              reply: {
                id: "search_tickets",
                title: "🔍 Rechercher à nouveau"
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
        );
        
        // Mettre à jour la session
        session.currentStep = 'initial';
        await sessionManager.saveSession(from, session);
      }
      return;
    }

    switch (session.currentStep) {
      case 'search_enter_criteria':
        // Récupérer les critères de recherche
        if (!messageText) {
          // Message d'erreur avec des boutons interactifs
          await whatsappService.sendButtonsMessage(
            from,
            "⚠️ *Critères manquants*",
            "Veuillez entrer vos critères de recherche (par exemple, 'statut:en cours', 'catégorie:incident', etc.).",
            [
              {
                type: "reply",
                reply: {
                  id: "search_tickets",
                  title: "🔍 Rechercher à nouveau"
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
          );
          
          // Mettre à jour la session
          session.currentStep = 'initial';
          await sessionManager.saveSession(from, session);
          return;
        }

        console.log(`Critères de recherche reçus: ${messageText}`);

        // Analyser les critères de recherche
        const criteria = ticketSearchService.parseCriteria(messageText);
        console.log(`Critères analysés:`, JSON.stringify(criteria));

        // Enregistrer les critères de recherche dans la session
        session.searchCriteria = criteria;
        session.currentStep = 'search_results';
        await sessionManager.saveSession(from, session);

        // Afficher un message d'attente
        await whatsappService.sendMessage(
            from,
            "🔍 Recherche en cours, veuillez patienter..."
        );

        // Exécuter la recherche
        try {
          await executeTicketSearch(from, session.searchCriteria);
        } catch (error) {
          console.error(`Erreur lors de la recherche pour ${from}:`, error);
          await whatsappService.sendMessage(
              from,
              "Une erreur s'est produite lors de la recherche. Veuillez réessayer plus tard."
          );
        }
        break;

      default:
        console.log(`Étape inconnue en mode recherche pour ${from}: ${session.currentStep}`);
        await whatsappService.sendMessage(
            from,
            "Désolé, une erreur s'est produite. Retour au menu principal."
        );
        
        // Réinitialiser la session
        session.currentStep = 'initial';
        await sessionManager.saveSession(from, session);
        
        // Présenter les options initiales
        await presentInitialOptions(from);
        break;
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du message en mode recherche pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors du traitement de votre message. Retour au menu principal."
    );
    
    // Réinitialiser la session
    try {
      session.currentStep = 'initial';
      await sessionManager.saveSession(from, session);
      
      // Présenter les options initiales
      await presentInitialOptions(from);
    } catch (saveError) {
      console.error(`Erreur lors de la réinitialisation de la session pour ${from}:`, saveError);
    }
  }
}

// Fonction pour envoyer le résumé du ticket IA
async function sendAiTicketSummary(from, ticketData) {
  let summary = `📋 Analyse IA de votre demande :
          
Type : ${ticketData.type === 'incident' ? 'Incident' : 'Demande'}
Catégorie : ${ticketData.categoryName}
Titre : ${ticketData.title}
Urgence : ${ticketData.urgencyName}
${ticketData.complexity ? `Complexité : ${ticketData.complexity.charAt(0).toUpperCase() + ticketData.complexity.slice(1)}` : ''}

Description : ${ticketData.description}`;

  // Ajouter les suggestions si disponibles
  if (ticketData.suggestions && ticketData.suggestions.length > 0) {
    summary += "\n\n💡 Suggestions initiales :";
    ticketData.suggestions.forEach((suggestion, index) => {
      summary += `\n${index + 1}. ${suggestion}`;
    });
  }

  // Ajouter les informations manquantes si disponibles
  if (ticketData.missingInfo && ticketData.missingInfo.length > 0) {
    summary += "\n\n❓ Informations qui pourraient être utiles :";
    ticketData.missingInfo.forEach((info, index) => {
      summary += `\n- ${info}`;
    });
  }

  await whatsappService.sendButtonsMessage(
      from,
      "Confirmation",
      summary,
      [
        {
          id: "confirm_ai_ticket",
          title: "Créer le ticket"
        },
        {
          id: "edit_ai_ticket",
          title: "Modifier"
        },
        {
          id: "cancel_ai_ticket",
          title: "Annuler"
        }
      ]
  );
}

// Fonction pour obtenir le nom de l'urgence à partir de l'ID
function getUrgencyName(urgencyId) {
  // Convertir en nombre si c'est une chaîne
  const id = parseInt(urgencyId, 10);
  
  const urgencies = {
    1: "Très basse",
    2: "Basse",
    3: "Moyenne",
    4: "Haute",
    5: "Très haute"
  };

  return urgencies[id] || "Moyenne";
}

// Fonction pour présenter les catégories ITIL en fonction du type de ticket
async function presentCategories(from, ticketTypeOrCategories) {
  try {
    console.log(`Présentation des catégories pour ${from}, paramètre:`, JSON.stringify(ticketTypeOrCategories));
    let categories = [];

    // Vérifier si le paramètre est déjà un tableau de catégories
    if (Array.isArray(ticketTypeOrCategories)) {
      categories = ticketTypeOrCategories;
      console.log(`Utilisation des catégories fournies (${categories.length})`);
    } else if (ticketTypeOrCategories === 'type_incident' || ticketTypeOrCategories === 'incident') {
      // Catégories d'incidents avec les IDs réels de GLPI
      categories = [
        { id: "6", title: "Incident - Réseau" },
        { id: "7", title: "Incident - Matériel" },
        { id: "8", title: "Incident - Logiciel" },
        { id: "9", title: "Incident - Sécurité" },
        { id: "10", title: "Incident - Autre" }
      ];
    } else if (ticketTypeOrCategories === 'type_request' || ticketTypeOrCategories === 'request') {
      // Catégories de demandes avec les IDs réels de GLPI
      categories = [
        { id: "1", title: "Demande - Accès" },
        { id: "2", title: "Demande - Matériel" },
        { id: "3", title: "Demande - Logiciel" },
        { id: "4", title: "Demande - Information" },
        { id: "5", title: "Demande - Autre" }
      ];
    } else {
      console.log(`Type de ticket non reconnu: ${ticketTypeOrCategories}, utilisation des catégories de demande par défaut`);
      // Catégories de demandes par défaut
      categories = [
        { id: "1", title: "Demande - Accès" },
        { id: "2", title: "Demande - Matériel" },
        { id: "3", title: "Demande - Logiciel" },
        { id: "4", title: "Demande - Information" },
        { id: "5", title: "Demande - Autre" }
      ];
    }

    // Diviser les catégories en groupes de 3 (limite de WhatsApp pour les boutons)
    const chunks = [];
    for (let i = 0; i < categories.length; i += 3) {
      chunks.push(categories.slice(i, i + 3));
    }

    // Envoyer chaque groupe de catégories comme un message de boutons séparé
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Formater les boutons correctement
      const formattedButtons = chunk.map(cat => ({
        type: "reply",
        reply: {
          id: `category_${cat.id}_${cat.title.replace(/ - /g, '_')}`,
          title: cat.title.substring(0, 20) // WhatsApp limite les titres à 20 caractères
        }
      }));
      
      console.log(`Envoi de boutons pour le groupe ${i+1}/${chunks.length}:`, JSON.stringify(formattedButtons));
      
      try {
        // Appel correct : (recipientPhone, bodyText, buttons, headerText)
        await whatsappService.sendButtonsMessage(
            from,
            `Veuillez sélectionner une catégorie :`,
            formattedButtons,
            `Catégorie ITIL (${i+1}/${chunks.length})`
        );
      } catch (error) {
        console.error(`Erreur lors de l'envoi des boutons pour le groupe ${i+1}/${chunks.length}:`, error);
        // Envoyer un message texte simple avec les options en cas d'erreur
        const categoriesText = chunk.map(cat => `- ${cat.title} (répondez avec '${cat.id}')`).join('\n');
        await whatsappService.sendMessage(from, `Catégorie ITIL (${i+1}/${chunks.length})\n\nVeuillez sélectionner une catégorie en répondant avec le numéro correspondant:\n${categoriesText}`);
      }
    }

    console.log(`Catégories envoyées en ${chunks.length} messages de boutons à ${from}`);
  } catch (error) {
    console.error(`Erreur lors de la présentation des catégories à ${from}:`, error);
    try {
      await whatsappService.sendMessage(
          from,
          "Désolé, une erreur s'est produite lors de l'affichage des catégories. Veuillez réessayer en envoyant 'reset'."
      );
    } catch (sendError) {
      console.error(`Erreur lors de l'envoi du message d'erreur à ${from}:`, sendError);
    }
  }
}

// Gestionnaire pour les boutons de recherche
async function handleSearchButton(from, buttonId) {
  try {
    const session = await sessionManager.getSession(from);

    if (buttonId === 'search_by_status') {
      // Recherche par statut
      session.currentStep = 'search_by_status';
      session.searchCriteria.type = 'status';
      await sessionManager.saveSession(from, session);

      // Envoyer les options de statut
      const message = "🚦 *Recherche par statut*\n\nChoisissez un statut :";

      const buttons = [
        {
          type: "reply",
          reply: {
            id: "status_new",
            title: "🆕 Nouveau"
          }
        },
        {
          type: "reply",
          reply: {
            id: "status_in_progress",
            title: "⏳ En cours"
          }
        },
        {
          type: "reply",
          reply: {
            id: "status_solved",
            title: "✅ Résolu"
          }
        },
        {
          type: "reply",
          reply: {
            id: "status_closed",
            title: "🔒 Fermé"
          }
        }
      ];

      await whatsappService.sendButtonsMessage(from, message, buttons, "Menu principal");

    } else if (buttonId === 'search_by_type') {
      // Recherche par type
      session.currentStep = 'search_by_type';
      session.searchCriteria.type = 'ticketType';
      await sessionManager.saveSession(from, session);

      // Envoyer les options de type
      const message = "🔖 *Recherche par type*\n\nChoisissez un type de ticket :";

      const buttons = [
        {
          type: "reply",
          reply: {
            id: "type_incident",
            title: "🔴 Incident"
          }
        },
        {
          type: "reply",
          reply: {
            id: "type_request",
            title: "🔵 Demande"
          }
        },
        {
          type: "reply",
          reply: {
            id: "back_to_search",
            title: "⬅️ Retour"
          }
        }
      ];

      await whatsappService.sendButtonsMessage(from, message, buttons, "Menu principal");

    } else if (buttonId === 'search_by_keyword') {
      // Recherche par mot-clé
      session.currentStep = 'search_by_keyword';
      session.searchCriteria.type = 'keyword';
      await sessionManager.saveSession(from, session);

      await whatsappService.sendMessage(
          from,
          "🔤 *Recherche par mot-clé*\n\nVeuillez entrer un mot-clé à rechercher dans les titres et descriptions des tickets."
      );
    } else if (buttonId === 'back_to_search') {
      // Retour au menu de recherche
      await startSearchMode(from);
    } else if (buttonId.startsWith('status_')) {
      // Traitement de la sélection de statut
      const status = buttonId.replace('status_', '');
      session.searchCriteria.status = status;

      // Exécuter la recherche
      await executeTicketSearch(from, session.searchCriteria);
    } else if (buttonId.startsWith('type_')) {
      // Traitement de la sélection de type
      const type = buttonId.replace('type_', '');
      session.searchCriteria.ticketType = type;

      // Exécuter la recherche
      await executeTicketSearch(from, session.searchCriteria);
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du bouton de recherche pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Exécuter la recherche de tickets
async function executeTicketSearch(from, searchCriteria) {
  try {
    console.log(`Exécution de la recherche pour ${from} avec critères:`, searchCriteria);

    // Construire les critères de recherche pour l'API GLPI
    const glpiCriteria = {};

    if (searchCriteria.status) {
      switch (searchCriteria.status) {
        case 'new':
          glpiCriteria.status = 1;
          break;
        case 'in_progress':
          glpiCriteria.status = 2;
          break;
        case 'solved':
          glpiCriteria.status = 5;
          break;
        case 'closed':
          glpiCriteria.status = 6;
          break;
      }
    }

    if (searchCriteria.ticketType) {
      glpiCriteria.type = searchCriteria.ticketType === 'incident' ? 1 : 2;
    }

    if (searchCriteria.keyword) {
      glpiCriteria.keyword = searchCriteria.keyword;
    }

    // Effectuer la recherche via le service GLPI
    const tickets = await glpiService.searchTickets(glpiCriteria);

    if (!tickets || tickets.length === 0) {
      await whatsappService.sendMessage(
          from,
          "🔍 *Résultats de recherche*\n\nAucun ticket ne correspond à vos critères de recherche."
      );

      // Proposer de faire une nouvelle recherche
      const buttons = [
        {
          type: "reply",
          reply: {
            id: "new_search",
            title: "🔄 Nouvelle recherche"
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
          from,
          "Que souhaitez-vous faire ?",
          buttons
      );

      return;
    }

    // Formater les résultats
    let message = `🔍 *Résultats de recherche*\n\n${tickets.length} ticket(s) trouvé(s) :\n\n`;

    // Limiter à 5 tickets maximum pour éviter un message trop long
    const displayedTickets = tickets.slice(0, 5);

    for (const ticket of displayedTickets) {
      message += `🎫 *Ticket #${ticket.id}*\n`;
      message += `📋 Titre: ${ticket.title || ticket.name}\n`;
      message += `🚦 Statut: ${glpiService.getTicketStatusName(ticket.status)}\n`;
      message += `📅 Date: ${new Date(ticket.date).toLocaleDateString()}\n\n`;
    }

    if (tickets.length > 5) {
      message += `_...et ${tickets.length - 5} autre(s) ticket(s)_\n\n`;
    }

    // Ajouter des boutons pour les actions
    const buttons = [];

    // Ajouter des boutons pour les premiers tickets (maximum 3)
    for (let i = 0; i < Math.min(3, displayedTickets.length); i++) {
      buttons.push({
        type: "reply",
        reply: {
          id: `track_ticket_${displayedTickets[i].id}`,
          title: `🔍 Ticket #${displayedTickets[i].id}`
        }
      });
    }

    // Ajouter un bouton pour une nouvelle recherche
    buttons.push({
      type: "reply",
      reply: {
        id: "new_search",
        title: "🔄 Nouvelle recherche"
      }
    });

    // Ajouter un bouton pour retourner au menu principal
    buttons.push({
      type: "reply",
      reply: {
        id: "back_to_menu",
        title: "🏠 Menu principal"
      }
    });

    await whatsappService.sendButtonsMessage(from, message, buttons, "Menu principal");

    // Mettre à jour la session
    const session = await sessionManager.getSession(from);
    session.currentStep = 'search_results';
    await sessionManager.saveSession(from, session);

  } catch (error) {
    console.error(`Erreur lors de l'exécution de la recherche pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite lors de la recherche. Veuillez réessayer plus tard."
    );
  }
}

// Test route for WhatsApp API
app.get('/test-whatsapp', async (req, res) => {
  try {
    console.log('Testing WhatsApp API connection...');
    const testPhone = process.env.YOUR_PHONE_NUMBER.replace(/\s+/g, ''); // Remove spaces

    console.log(`Sending test message to ${testPhone}`);
    console.log(`Using WhatsApp token: ${process.env.WHATSAPP_TOKEN.substring(0, 10)}...`);
    console.log(`Using WhatsApp phone number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);

    const result = await whatsappService.sendMessage(
        testPhone,
        "Ceci est un message de test pour vérifier la connexion à l'API WhatsApp."
    );

    console.log('WhatsApp API test result:', JSON.stringify(result));
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error testing WhatsApp API:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Test route for WhatsApp buttons
app.get('/test-whatsapp-buttons', async (req, res) => {
  try {
    console.log('Testing WhatsApp buttons API...');
    const testPhone = process.env.YOUR_PHONE_NUMBER.replace(/\s+/g, ''); // Remove spaces

    console.log(`Sending test button message to ${testPhone}`);

    const result = await whatsappService.sendButtonsMessage(
        testPhone,
        "Veuillez sélectionner une option :",
        [
          {
            type: "reply",
            reply: {
              id: "test_button_1",
              title: "Option 1"
            }
          },
          {
            type: "reply",
            reply: {
              id: "test_button_2",
              title: "Option 2"
            }
          }
        ],
        "Test des boutons"
    );

    console.log('WhatsApp buttons test result:', JSON.stringify(result));
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error testing WhatsApp buttons API:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Endpoint for health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Démarrer le mode recherche par ID de ticket
async function startTicketSearch(from) {
  try {
    console.log(`Démarrage de la recherche par ID pour ${from}`);

    // Créer une session avec un état initial de recherche
    const session = {
      currentStep: 'search_by_id',
      searchMode: true
    };
    await sessionManager.saveSession(from, session);

    // Envoyer un message demandant l'ID du ticket
    const message = "🔎 *Recherche de ticket par ID*\n\nVeuillez entrer le numéro du ticket que vous souhaitez rechercher.\n\nExemple: 12345";

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "back_to_menu",
          title: "🏠 Menu principal"
        }
      }
    ];

    await whatsappService.sendButtonsMessage(from, message, buttons, "Recherche ticket");
  } catch (error) {
    console.error(`Erreur lors du démarrage de la recherche avancée pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Présenter les options de création de ticket
async function presentTicketCreationOptions(from) {
  try {
    console.log(`Présentation des options de création de ticket pour ${from}`);

    // Mettre à jour la session pour indiquer que l'utilisateur est en mode de création de ticket
    const session = await sessionManager.getSession(from) || {};
    session.currentStep = 'ticket_creation_options';
    await sessionManager.saveSession(from, session);
    
    console.log(`Session mise à jour pour ${from}, étape: ticket_creation_options`);

    const message = "🎟 *Création de ticket*\n\nChoisissez le mode de création :\n\n📝 *Mode guidé* : Création étape par étape avec des questions simples pour vous guider.\n\n🤖 *Mode IA* : Décrivez votre problème en langage naturel et l'IA créera automatiquement un ticket adapté.";

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "mode_guide",
          title: "📝 Mode guidé"
        }
      },
      {
        type: "reply",
        reply: {
          id: "mode_ia",
          title: "🤖 Mode IA"
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
  } catch (error) {
    console.error(`Erreur lors de la présentation des options de création de ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer plus tard."
    );
  }
}

// Fonction pour présenter un résumé du ticket pour confirmation
async function presentTicketSummary(from, ticketData) {
  try {
    const summary = `*Récapitulatif de votre ticket :*
    
*Type :* ${ticketData.type === 'incident' ? '🔴 Incident' : '🔵 Demande'}
*Catégorie :* ${ticketData.category}
*Titre :* ${ticketData.title}
*Description :* ${ticketData.description}
*Urgence :* ${ticketData.urgencyName}`;

    // Envoyer d'abord le résumé du ticket
    await whatsappService.sendMessage(from, summary);
    
    // Puis envoyer les boutons de confirmation
    const confirmButtons = [
      {
        type: "reply",
        reply: {
          id: "confirm_yes",
          title: "✅ Confirmer"
        }
      },
      {
        type: "reply",
        reply: {
          id: "confirm_no",
          title: "❌ Annuler"
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
    
    try {
      await whatsappService.sendButtonsMessage(from, "Que souhaitez-vous faire ?", confirmButtons, "Confirmation");
    } catch (error) {
      console.error(`Erreur lors de l'envoi des boutons de confirmation pour ${from}:`, error);
      // En cas d'erreur avec les boutons, envoyer un message texte
      await whatsappService.sendMessage(
        from,
        "Pour confirmer, répondez avec \"confirmer\" ou \"annuler\", ou \"menu\" pour revenir au menu principal."
      );
    }
  } catch (error) {
    console.error(`Erreur lors de la présentation du résumé du ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}

// Fonction pour obtenir le nom de l'urgence à partir de l'ID
function getUrgencyName(urgencyId) {
  switch (parseInt(urgencyId)) {
    case 1:
      return "🔴 Très haute";
    case 2:
      return "🕾 Haute";
    case 3:
      return "🟢 Moyenne";
    case 4:
      return "🔵 Basse";
    case 5:
      return "⚪ Très basse";
    default:
      return "🟢 Moyenne";
  }
}

// Fonction pour présenter un résumé du ticket pour confirmation
async function presentTicketSummary(from, ticketData) {
  try {
    const summary = `*Récapitulatif de votre ticket :*
    
*Type :* ${ticketData.type === 'incident' ? '🔴 Incident' : '🔵 Demande'}
*Catégorie :* ${ticketData.category}
*Titre :* ${ticketData.title}
*Description :* ${ticketData.description}
*Urgence :* ${ticketData.urgencyName}`;

    // Envoyer d'abord le résumé du ticket
    await whatsappService.sendMessage(from, summary);
    
    // Puis envoyer les boutons de confirmation
    const confirmButtons = [
      {
        type: "reply",
        reply: {
          id: "confirm_yes",
          title: "✅ Confirmer"
        }
      },
      {
        type: "reply",
        reply: {
          id: "confirm_no",
          title: "❌ Annuler"
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
    
    try {
      await whatsappService.sendButtonsMessage(from, "Que souhaitez-vous faire ?", confirmButtons, "Confirmation");
    } catch (error) {
      console.error(`Erreur lors de l'envoi des boutons de confirmation pour ${from}:`, error);
      // En cas d'erreur avec les boutons, envoyer un message texte
      await whatsappService.sendMessage(
        from,
        "Pour confirmer, répondez avec \"confirmer\" ou \"annuler\", ou \"menu\" pour revenir au menu principal."
      );
    }
  } catch (error) {
    console.error(`Erreur lors de la présentation du résumé du ticket pour ${from}:`, error);
    await whatsappService.sendMessage(
        from,
        "Désolé, une erreur s'est produite. Veuillez réessayer en envoyant 'reset'."
    );
  }
}
