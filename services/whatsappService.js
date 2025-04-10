const axios = require('axios');

// Configuration des timeouts et retry
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 secondes
const TIMEOUT = 10000; // 10 secondes

// Fonction utilitaire pour attendre un délai
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// WhatsApp Cloud API service
const whatsappService = {
  /**
   * Send a message to a WhatsApp user with retry mechanism
   * @param {string} to - The recipient's phone number
   * @param {string} message - The message to send
   * @returns {Promise} - Response from WhatsApp API
   */
  sendMessage: async (recipientPhone, message) => {
    let retries = 0;
    let lastError = null;

    while (retries <= MAX_RETRIES) {
      try {
        if (retries > 0) {
          console.log(`Retry attempt ${retries}/${MAX_RETRIES} for sending message to ${recipientPhone}`);
          await sleep(RETRY_DELAY * retries); // Délai exponentiel
        }
        
        console.log(`Attempting to send message to ${recipientPhone}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
        
        // Vérifier que le numéro de téléphone est au format international
        if (!recipientPhone.startsWith('+') && !recipientPhone.match(/^\d+$/)) {
          console.warn(`Warning: Phone number ${recipientPhone} may not be in the correct format`);
        }

        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientPhone,
          type: "text",
          text: {
            body: message
          }
        };

        console.log(`Sending payload to WhatsApp API: ${JSON.stringify(payload)}`);
        
        const response = await axios.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
          },
          timeout: TIMEOUT // Définir un timeout pour la requête
        });

        console.log(`Message sent successfully to ${recipientPhone}, response:`, JSON.stringify(response.data));
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Déterminer si l'erreur est récupérable (timeout, erreur réseau, etc.)
        const isRecoverableError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNABORTED' || 
          error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' ||
          (error.response && (error.response.status >= 500 || error.response.status === 429));
        
        console.error(`Error sending message to ${recipientPhone} (Attempt ${retries + 1}/${MAX_RETRIES + 1}):`, 
                     error.response ? 
                     `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` : 
                     `${error.message} (Code: ${error.code})`);
        
        // Si l'erreur n'est pas récupérable, ne pas réessayer
        if (!isRecoverableError) {
          console.log(`Non-recoverable error for ${recipientPhone}, not retrying:`, error.message);
          break;
        }
        
        retries++;
        
        // Si c'était la dernière tentative, arrêter
        if (retries > MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached for ${recipientPhone}. Giving up.`);
          break;
        }
      }
    }
    
    // Si toutes les tentatives ont échoué, lancer l'erreur
    if (lastError) {
      // Vérifier si l'erreur est liée à un problème d'authentification
      if (lastError.response && lastError.response.status === 401) {
        console.error("Authentication error with WhatsApp API. Check your token.");
      }
      
      // Vérifier si l'erreur est liée à un problème de numéro de téléphone
      if (lastError.response && lastError.response.status === 400 && 
          lastError.response.data && lastError.response.data.error && 
          (lastError.response.data.error.message.includes("phone") || 
           lastError.response.data.error.message.includes("recipient"))) {
        console.error(`Invalid phone number format or recipient not registered: ${recipientPhone}`);
      }
      
      throw lastError;
    }
  },

  /**
   * Send a template message to a WhatsApp user with retry mechanism
   * @param {string} to - The recipient's phone number
   * @param {string} templateName - The name of the template
   * @param {Array} components - Template components (optional)
   * @returns {Promise} - Response from WhatsApp API
   */
  sendTemplateMessage: async (to, templateName, components = []) => {
    let retries = 0;
    let lastError = null;

    while (retries <= MAX_RETRIES) {
      try {
        if (retries > 0) {
          console.log(`Retry attempt ${retries}/${MAX_RETRIES} for sending template message to ${to}`);
          await sleep(RETRY_DELAY * retries);
        }
        
        const response = await axios({
          method: 'POST',
          url: `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT,
          data: {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'template',
            template: {
              name: templateName,
              language: {
                code: 'fr'
              },
              components: components
            }
          }
        });
        
        console.log('Template message sent successfully:', response.data);
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Déterminer si l'erreur est récupérable
        const isRecoverableError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNABORTED' || 
          error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' ||
          (error.response && (error.response.status >= 500 || error.response.status === 429));
        
        console.error(`Error sending template message to ${to} (Attempt ${retries + 1}/${MAX_RETRIES + 1}):`, 
                     error.response?.data || `${error.message} (Code: ${error.code})`);
        
        if (!isRecoverableError) {
          console.log(`Non-recoverable error for template message to ${to}, not retrying:`, error.message);
          break;
        }
        
        retries++;
        
        if (retries > MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached for template message to ${to}. Giving up.`);
          break;
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
  },

  // Send interactive buttons message with retry mechanism
  sendButtonsMessage: async (recipientPhone, bodyText, buttons, headerText = "GLPI Support") => {
    let retries = 0;
    let lastError = null;

    while (retries <= MAX_RETRIES) {
      try {
        if (retries > 0) {
          console.log(`Retry attempt ${retries}/${MAX_RETRIES} for sending button message to ${recipientPhone}`);
          await sleep(RETRY_DELAY * retries);
        }
        
        console.log(`Attempting to send button message to ${recipientPhone}`);
        
        // Vérifier que le numéro de téléphone est au format international
        if (!recipientPhone.startsWith('+') && !recipientPhone.match(/^\d+$/)) {
          console.warn(`Warning: Phone number ${recipientPhone} may not be in the correct format`);
        }

        // Vérifier que buttons est un tableau
        if (!Array.isArray(buttons)) {
          console.error(`Error: buttons must be an array, but got ${typeof buttons}:`, buttons);
          throw new Error(`buttons.map is not a function (Code: undefined)`);
        }
        
        // Vérifier que nous n'avons pas plus de 3 boutons (limite de WhatsApp)
        if (buttons.length > 3) {
          console.warn(`Warning: WhatsApp only supports up to 3 buttons, but ${buttons.length} were provided`);
          buttons = buttons.slice(0, 3);
        }
        
        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        // Format buttons according to WhatsApp API requirements
        const formattedButtons = buttons.map(button => {
          // Vérifier que le bouton a un id et un titre
          let buttonId, buttonTitle;
          
          if (button.reply && button.reply.id && button.reply.title) {
            // Si le bouton est déjà au format WhatsApp
            buttonId = button.reply.id;
            buttonTitle = button.reply.title;
          } else {
            // Si le bouton est au format simple
            buttonId = button.id || `btn_${Math.random().toString(36).substring(2, 10)}`;
            buttonTitle = button.title || "Option";
          }
          
          return {
            type: "reply",
            reply: {
              id: buttonId,
              title: buttonTitle.substring(0, 20) // WhatsApp limite les titres à 20 caractères
            }
          };
        });

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientPhone,
          type: "interactive",
          interactive: {
            type: "button",
            header: {
              type: "text",
              text: headerText.substring(0, 60) // WhatsApp a des limites sur la longueur du texte
            },
            body: {
              text: bodyText.substring(0, 1024) // WhatsApp limite le corps à 1024 caractères
            },
            action: {
              buttons: formattedButtons
            }
          }
        };

        console.log("Sending button message with payload:", JSON.stringify(payload));

        const response = await axios.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
          },
          timeout: TIMEOUT
        });

        console.log(`Button message sent successfully to ${recipientPhone}, response:`, JSON.stringify(response.data));
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Déterminer si l'erreur est récupérable
        const isRecoverableError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNABORTED' || 
          error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' ||
          (error.response && (error.response.status >= 500 || error.response.status === 429));
        
        console.error(`Error sending button message to ${recipientPhone} (Attempt ${retries + 1}/${MAX_RETRIES + 1}):`, 
                     error.response ? 
                     `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` : 
                     `${error.message} (Code: ${error.code})`);
        
        if (!isRecoverableError) {
          console.log(`Non-recoverable error for button message to ${recipientPhone}, not retrying:`, error.message);
          
          // Si l'erreur est liée aux boutons, essayer d'envoyer un message texte simple à la place
          if (error.response && error.response.status === 400) {
            try {
              console.log(`Attempting to send fallback text message to ${recipientPhone}`);
              const fallbackMessage = `${bodyText}\n\nOptions (répondez avec l'une de ces options):\n${buttons.map(b => `- ${b.title}`).join('\n')}`;
              
              await whatsappService.sendMessage(recipientPhone, fallbackMessage);
              console.log(`Fallback message sent successfully to ${recipientPhone}`);
              return { success: true, fallback: true };
            } catch (fallbackError) {
              console.error(`Error sending fallback message to ${recipientPhone}:`, fallbackError.message);
            }
          }
          
          break;
        }
        
        retries++;
        
        if (retries > MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached for button message to ${recipientPhone}. Giving up.`);
          
          // Essayer d'envoyer un message texte simple comme dernier recours
          try {
            console.log(`Attempting to send last resort fallback text message to ${recipientPhone}`);
            const fallbackMessage = `${bodyText}\n\nOptions (répondez avec l'une de ces options):\n${buttons.map(b => `- ${b.title}`).join('\n')}`;
            
            await whatsappService.sendMessage(recipientPhone, fallbackMessage);
            console.log(`Last resort fallback message sent successfully to ${recipientPhone}`);
            return { success: true, fallback: true };
          } catch (fallbackError) {
            console.error(`Error sending last resort fallback message to ${recipientPhone}:`, fallbackError.message);
          }
          
          break;
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
  },

  // Send a list message with retry mechanism
  sendListMessage: async (recipientPhone, headerText, bodyText, buttonText, items) => {
    let retries = 0;
    let lastError = null;

    while (retries <= MAX_RETRIES) {
      try {
        if (retries > 0) {
          console.log(`Retry attempt ${retries}/${MAX_RETRIES} for sending list message to ${recipientPhone}`);
          await sleep(RETRY_DELAY * retries);
        }
        
        console.log(`Attempting to send list message to ${recipientPhone}`);
        
        // Vérifier que le numéro de téléphone est au format international
        if (!recipientPhone.startsWith('+') && !recipientPhone.match(/^\d+$/)) {
          console.warn(`Warning: Phone number ${recipientPhone} may not be in the correct format`);
        }
        
        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        // Limiter le nombre d'éléments
        if (items.length > 10) {
          console.warn(`Warning: WhatsApp has a limit on the number of items. Truncating from ${items.length} to 10.`);
          items = items.slice(0, 10);
        }
        
        // Créer une section avec les éléments fournis
        const section = {
          title: "Options disponibles",
          rows: items.map(item => ({
            id: item.id,
            title: item.title.substring(0, 24), // WhatsApp limite les titres d'élément à 24 caractères
            description: item.description ? item.description.substring(0, 72) : undefined // WhatsApp limite les descriptions à 72 caractères
          }))
        };

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientPhone,
          type: "interactive",
          interactive: {
            type: "list",
            header: {
              type: "text",
              text: headerText.substring(0, 60) // WhatsApp limite les en-têtes à 60 caractères
            },
            body: {
              text: bodyText.substring(0, 1024) // WhatsApp limite le corps à 1024 caractères
            },
            footer: {
              text: "Sélectionnez une option"
            },
            action: {
              button: buttonText || "Voir les options",
              sections: [section]
            }
          }
        };

        console.log(`Sending list message with payload: ${JSON.stringify(payload)}`);

        const response = await axios.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
          },
          timeout: TIMEOUT
        });

        console.log(`List message sent successfully to ${recipientPhone}, response:`, JSON.stringify(response.data));
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Déterminer si l'erreur est récupérable
        const isRecoverableError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNABORTED' || 
          error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' ||
          (error.response && (error.response.status >= 500 || error.response.status === 429));
        
        console.error(`Error sending list message to ${recipientPhone} (Attempt ${retries + 1}/${MAX_RETRIES + 1}):`, 
                     error.response ? 
                     `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` : 
                     `${error.message} (Code: ${error.code})`);
        
        if (!isRecoverableError) {
          console.log(`Non-recoverable error for list message to ${recipientPhone}, not retrying:`, error.message);
          
          // Si l'erreur est liée à la liste, essayer d'envoyer un message texte simple à la place
          if (error.response && error.response.status === 400) {
            try {
              console.log(`Attempting to send fallback text message to ${recipientPhone}`);
              
              // Créer un message texte formaté avec les options
              let fallbackMessage = `${bodyText}\n\nOptions disponibles:\n`;
              
              items.forEach(item => {
                fallbackMessage += `- ${item.title}${item.description ? `: ${item.description}` : ''}\n`;
              });
              
              await whatsappService.sendMessage(recipientPhone, fallbackMessage);
              console.log(`Fallback message sent successfully to ${recipientPhone}`);
              return { success: true, fallback: true };
            } catch (fallbackError) {
              console.error(`Error sending fallback message to ${recipientPhone}:`, fallbackError.message);
            }
          }
          
          break;
        }
        
        retries++;
        
        if (retries > MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached for list message to ${recipientPhone}. Giving up.`);
          
          // Essayer d'envoyer un message texte simple comme dernier recours
          try {
            console.log(`Attempting to send last resort fallback text message to ${recipientPhone}`);
            
            let fallbackMessage = `${bodyText}\n\nOptions disponibles:\n`;
            
            items.forEach(item => {
              fallbackMessage += `- ${item.title}${item.description ? `: ${item.description}` : ''}\n`;
            });
            
            await whatsappService.sendMessage(recipientPhone, fallbackMessage);
            console.log(`Last resort fallback message sent successfully to ${recipientPhone}`);
            return { success: true, fallback: true };
          } catch (fallbackError) {
            console.error(`Error sending last resort fallback message to ${recipientPhone}:`, fallbackError.message);
          }
          
          break;
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
  }
};

module.exports = whatsappService;
