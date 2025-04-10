/**
 * Service de création guidée de tickets pour le chatbot WhatsApp-GLPI
 * Ce service permet de guider l'utilisateur à travers un processus de création de ticket
 * en utilisant des boutons et des listes interactives
 */

const whatsappService = require('./whatsappService');
const glpiService = require('./glpiService');
const aiIntegrationService = require('./aiIntegrationService');

// États possibles dans le flux de création guidée
const GUIDED_STATES = {
  INITIAL: 'initial',
  TYPE_SELECTION: 'type_selection',
  CATEGORY_SELECTION: 'category_selection',
  URGENCY_SELECTION: 'urgency_selection',
  TITLE_INPUT: 'title_input',
  DESCRIPTION_INPUT: 'description_input',
  CONFIRMATION: 'confirmation'
};

// Stockage des sessions utilisateur
// Format: { 'phone_number': { state: 'state_name', data: {} } }
const userSessions = {};

const guidedTicketService = {
  /**
   * Démarre un flux de création guidée de ticket
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   * @param {string} initialMessage - Message initial de l'utilisateur
   */
  startGuidedCreation: async (phone, initialMessage) => {
    // Initialiser la session utilisateur
    userSessions[phone] = {
      state: GUIDED_STATES.TYPE_SELECTION,
      data: {
        initialMessage,
        type: null,
        category: null,
        urgency: null,
        title: null,
        description: null
      }
    };

    // Envoyer les options de type de ticket
    await guidedTicketService.sendTypeOptions(phone);
  },

  /**
   * Envoie les options de type de ticket (Incident ou Demande)
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  sendTypeOptions: async (phone) => {
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "incident",
          title: "Incident"
        }
      },
      {
        type: "reply",
        reply: {
          id: "request",
          title: "Demande"
        }
      }
    ];

    await whatsappService.sendButtonsMessage(
      phone,
      "Création de ticket",
      "Veuillez sélectionner le type de ticket que vous souhaitez créer :",
      buttons
    );
  },

  /**
   * Envoie les options de catégorie en fonction du type de ticket
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   * @param {string} type - Type de ticket ('incident' ou 'request')
   */
  sendCategoryOptions: async (phone, type) => {
    // Mettre à jour l'état de la session
    userSessions[phone].state = GUIDED_STATES.CATEGORY_SELECTION;
    userSessions[phone].data.type = type;

    let sections = [];
    
    if (type === 'incident') {
      sections = [
        {
          title: "Catégories d'incident",
          rows: [
            {
              id: "incident_materiel",
              title: "Matériel",
              description: "Problèmes avec le matériel informatique"
            },
            {
              id: "incident_logiciel",
              title: "Logiciel",
              description: "Problèmes avec les applications ou systèmes"
            },
            {
              id: "incident_reseau",
              title: "Réseau",
              description: "Problèmes de connexion ou de réseau"
            },
            {
              id: "incident_securite",
              title: "Sécurité",
              description: "Problèmes liés à la sécurité informatique"
            }
          ]
        }
      ];
    } else {
      sections = [
        {
          title: "Catégories de demande",
          rows: [
            {
              id: "demande_materiel",
              title: "Matériel",
              description: "Demande de matériel informatique"
            },
            {
              id: "demande_logiciel",
              title: "Logiciel",
              description: "Demande d'installation ou de configuration"
            },
            {
              id: "demande_acces",
              title: "Accès",
              description: "Demande d'accès à un système ou service"
            },
            {
              id: "demande_formation",
              title: "Formation",
              description: "Demande de formation ou d'assistance"
            }
          ]
        }
      ];
    }

    await whatsappService.sendListMessage(
      phone,
      "Catégorie de ticket",
      `Veuillez sélectionner la catégorie pour votre ${type === 'incident' ? 'incident' : 'demande'} :`,
      "Voir les catégories",
      sections
    );
  },

  /**
   * Envoie les options de niveau d'urgence
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  sendUrgencyOptions: async (phone) => {
    // Mettre à jour l'état de la session
    userSessions[phone].state = GUIDED_STATES.URGENCY_SELECTION;

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "1",
          title: "Très haute"
        }
      },
      {
        type: "reply",
        reply: {
          id: "2",
          title: "Haute"
        }
      },
      {
        type: "reply",
        reply: {
          id: "3",
          title: "Moyenne"
        }
      },
      {
        type: "reply",
        reply: {
          id: "4",
          title: "Basse"
        }
      },
      {
        type: "reply",
        reply: {
          id: "5",
          title: "Très basse"
        }
      }
    ];

    // Comme WhatsApp ne supporte que 3 boutons maximum, nous envoyons deux messages
    await whatsappService.sendButtonsMessage(
      phone,
      "Niveau d'urgence (1/2)",
      "Veuillez sélectionner le niveau d'urgence :",
      buttons.slice(0, 3)
    );

    // Attendre un peu pour éviter les problèmes de séquence
    setTimeout(async () => {
      await whatsappService.sendButtonsMessage(
        phone,
        "Niveau d'urgence (2/2)",
        "Ou sélectionnez un niveau d'urgence plus bas :",
        buttons.slice(3, 5)
      );
    }, 1000);
  },

  /**
   * Demande le titre du ticket
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  requestTicketTitle: async (phone) => {
    // Mettre à jour l'état de la session
    userSessions[phone].state = GUIDED_STATES.TITLE_INPUT;

    await whatsappService.sendMessage(
      phone,
      "Veuillez entrer un titre bref pour votre ticket :"
    );
  },

  /**
   * Demande la description du ticket
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  requestTicketDescription: async (phone) => {
    // Mettre à jour l'état de la session
    userSessions[phone].state = GUIDED_STATES.DESCRIPTION_INPUT;

    await whatsappService.sendMessage(
      phone,
      "Veuillez entrer une description détaillée de votre problème ou demande :"
    );
  },

  /**
   * Demande confirmation avant de créer le ticket
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  requestConfirmation: async (phone) => {
    // Mettre à jour l'état de la session
    userSessions[phone].state = GUIDED_STATES.CONFIRMATION;

    const session = userSessions[phone];
    const { type, category, urgency, title, description } = session.data;

    const summaryMessage = `Résumé du ticket :
- Type : ${type === 'incident' ? 'Incident' : 'Demande'}
- Catégorie : ${category}
- Urgence : ${urgency}
- Titre : ${title}
- Description : ${description}

Souhaitez-vous créer ce ticket ?`;

    const buttons = [
      {
        type: "reply",
        reply: {
          id: "confirm",
          title: "Confirmer"
        }
      },
      {
        type: "reply",
        reply: {
          id: "cancel",
          title: "Annuler"
        }
      }
    ];

    await whatsappService.sendButtonsMessage(
      phone,
      "Confirmation",
      summaryMessage,
      buttons
    );
  },

  /**
   * Crée un ticket dans GLPI avec les informations fournies
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  createTicket: async (phone) => {
    const session = userSessions[phone];
    const { type, category, urgency, title, description } = session.data;

    try {
      // Créer le ticket dans GLPI
      const ticketData = {
        name: title,
        content: description,
        type: type === 'incident' ? 1 : 2, // 1 = Incident, 2 = Demande
        urgency: parseInt(urgency),
        category: category
      };

      const ticketResponse = await glpiService.createTicket(ticketData);

      // Envoyer confirmation à l'utilisateur
      await whatsappService.sendMessage(
        phone,
        `Votre ticket a été créé avec succès !
Numéro de ticket : ${ticketResponse.id}
Vous pouvez suivre l'état de votre ticket sur le portail GLPI.`
      );

      // Réinitialiser la session
      delete userSessions[phone];
    } catch (error) {
      console.error('Erreur lors de la création du ticket:', error);
      await whatsappService.sendMessage(
        phone,
        "Une erreur s'est produite lors de la création de votre ticket. Veuillez réessayer plus tard."
      );
    }
  },

  /**
   * Traite un message entrant dans le contexte d'une création guidée
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   * @param {string} message - Message reçu
   * @param {Object} interactive - Données interactives (boutons, listes)
   * @returns {boolean} - True si le message a été traité dans le flux guidé
   */
  handleGuidedMessage: async (phone, message, interactive) => {
    // Vérifier si l'utilisateur est dans un flux guidé
    if (!userSessions[phone]) {
      return false;
    }

    const session = userSessions[phone];

    // Traiter le message en fonction de l'état actuel
    switch (session.state) {
      case GUIDED_STATES.TYPE_SELECTION:
        if (interactive && interactive.button_reply) {
          const type = interactive.button_reply.id;
          await guidedTicketService.sendCategoryOptions(phone, type);
        } else {
          // Si l'utilisateur a envoyé un texte au lieu de cliquer sur un bouton
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('incident')) {
            await guidedTicketService.sendCategoryOptions(phone, 'incident');
          } else if (lowerMessage.includes('demande')) {
            await guidedTicketService.sendCategoryOptions(phone, 'request');
          } else {
            await guidedTicketService.sendTypeOptions(phone);
            return true;
          }
        }
        return true;

      case GUIDED_STATES.CATEGORY_SELECTION:
        if (interactive && interactive.list_reply) {
          const category = interactive.list_reply.id;
          session.data.category = category;
          await guidedTicketService.sendUrgencyOptions(phone);
        } else {
          await whatsappService.sendMessage(
            phone,
            "Veuillez sélectionner une catégorie dans la liste."
          );
        }
        return true;

      case GUIDED_STATES.URGENCY_SELECTION:
        if (interactive && interactive.button_reply) {
          const urgency = interactive.button_reply.id;
          session.data.urgency = urgency;
          await guidedTicketService.requestTicketTitle(phone);
        } else {
          // Si l'utilisateur a envoyé un texte au lieu de cliquer sur un bouton
          const urgencyMap = {
            'très haute': '1',
            'très haut': '1',
            'critique': '1',
            'haute': '2',
            'haut': '2',
            'important': '2',
            'moyenne': '3',
            'moyen': '3',
            'normal': '3',
            'basse': '4',
            'bas': '4',
            'faible': '4',
            'très basse': '5',
            'très bas': '5',
            'minimal': '5'
          };

          const lowerMessage = message.toLowerCase();
          let matched = false;

          for (const [key, value] of Object.entries(urgencyMap)) {
            if (lowerMessage.includes(key)) {
              session.data.urgency = value;
              await guidedTicketService.requestTicketTitle(phone);
              matched = true;
              break;
            }
          }

          if (!matched) {
            await guidedTicketService.sendUrgencyOptions(phone);
          }
        }
        return true;

      case GUIDED_STATES.TITLE_INPUT:
        session.data.title = message;
        await guidedTicketService.requestTicketDescription(phone);
        return true;

      case GUIDED_STATES.DESCRIPTION_INPUT:
        session.data.description = message;
        await guidedTicketService.requestConfirmation(phone);
        return true;

      case GUIDED_STATES.CONFIRMATION:
        if (interactive && interactive.button_reply) {
          if (interactive.button_reply.id === 'confirm') {
            await guidedTicketService.createTicket(phone);
          } else {
            await whatsappService.sendMessage(
              phone,
              "Création de ticket annulée. Vous pouvez démarrer une nouvelle création à tout moment."
            );
            delete userSessions[phone];
          }
        } else {
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('confirm') || lowerMessage.includes('oui') || lowerMessage.includes('ok')) {
            await guidedTicketService.createTicket(phone);
          } else if (lowerMessage.includes('cancel') || lowerMessage.includes('annul') || lowerMessage.includes('non')) {
            await whatsappService.sendMessage(
              phone,
              "Création de ticket annulée. Vous pouvez démarrer une nouvelle création à tout moment."
            );
            delete userSessions[phone];
          } else {
            await guidedTicketService.requestConfirmation(phone);
          }
        }
        return true;

      default:
        return false;
    }
  },

  /**
   * Vérifie si un utilisateur a une session de création guidée active
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   * @returns {boolean} - True si l'utilisateur a une session active
   */
  hasActiveSession: (phone) => {
    return !!userSessions[phone];
  },

  /**
   * Réinitialise la session d'un utilisateur
   * @param {string} phone - Numéro de téléphone de l'utilisateur
   */
  resetSession: (phone) => {
    delete userSessions[phone];
  }
};

module.exports = guidedTicketService;
