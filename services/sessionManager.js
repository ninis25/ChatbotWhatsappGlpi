const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');

// Create a cache with TTL of 30 minutes (1800 seconds)
const sessionCache = new NodeCache({ stdTTL: 1800, checkperiod: 60 });

// Path to the sessions file
const SESSIONS_FILE = path.join(__dirname, '../data/sessions.json');

// Ensure the data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  console.log('Création du répertoire de données pour les sessions');
  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

// Initialize sessions file if it doesn't exist
if (!fs.existsSync(SESSIONS_FILE)) {
  console.log('Initialisation du fichier de sessions');
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}), 'utf8');
}

// Load existing sessions into cache at startup
try {
  console.log('Chargement des sessions existantes dans le cache');
  const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  Object.keys(sessions).forEach(userId => {
    sessionCache.set(userId, sessions[userId]);
  });
  console.log(`${Object.keys(sessions).length} sessions chargées dans le cache`);
} catch (error) {
  console.error('Erreur lors du chargement des sessions:', error);
  // Create an empty sessions file if there was an error
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}), 'utf8');
}

// Session manager service
const sessionManager = {
  /**
   * Get a user session or create a new one if it doesn't exist
   * @param {string} userId - The user's WhatsApp number
   * @returns {Object|null} - The user session or null if not found
   */
  getSession: async (userId) => {
    console.log(`Récupération de la session pour l'utilisateur ${userId}`);
    
    // Try to get from cache first
    let session = sessionCache.get(userId);
    
    if (session) {
      console.log(`Session trouvée dans le cache pour ${userId}`);
      return session;
    }
    
    // If not in cache, try to get from file
    try {
      console.log(`Session non trouvée dans le cache pour ${userId}, recherche dans le fichier`);
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      session = sessions[userId];
      
      if (session) {
        // Add to cache
        console.log(`Session trouvée dans le fichier pour ${userId}, ajout au cache`);
        sessionCache.set(userId, session);
        return session;
      }
      
      console.log(`Aucune session trouvée pour ${userId}`);
    } catch (error) {
      console.error(`Erreur lors de la lecture du fichier de sessions pour ${userId}:`, error);
    }
    
    // If no session found, return null
    return null;
  },
  
  /**
   * Save a user session
   * @param {string} userId - The user's WhatsApp number
   * @param {Object} session - The session data to save
   */
  saveSession: async (userId, session) => {
    console.log(`Sauvegarde de la session pour l'utilisateur ${userId}`, JSON.stringify(session));
    
    // Save to cache
    sessionCache.set(userId, session);
    
    // Maximum number of retry attempts
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let success = false;
    
    while (retryCount < MAX_RETRIES && !success) {
      try {
        // Read the current sessions file
        let sessions = {};
        try {
          const fileData = fs.readFileSync(SESSIONS_FILE, 'utf8');
          sessions = JSON.parse(fileData);
        } catch (readError) {
          console.warn(`Erreur lors de la lecture du fichier de sessions, création d'un nouveau fichier:`, readError);
          // Continue with an empty sessions object
        }
        
        // Update the session
        sessions[userId] = session;
        
        // Write back to file
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
        console.log(`Session sauvegardée avec succès pour ${userId} (tentative ${retryCount + 1})`);
        success = true;
      } catch (error) {
        retryCount++;
        console.error(`Erreur lors de la sauvegarde de la session pour ${userId} (tentative ${retryCount}/${MAX_RETRIES}):`, error);
        
        if (retryCount < MAX_RETRIES) {
          // Wait a bit before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 100;
          console.log(`Nouvelle tentative dans ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`Échec de la sauvegarde de la session pour ${userId} après ${MAX_RETRIES} tentatives`);
        }
      }
    }
    
    return success;
  },
  
  /**
   * Reset a user session
   * @param {string} userId - The user's WhatsApp number
   */
  resetSession: async (userId) => {
    console.log(`Réinitialisation de la session pour l'utilisateur ${userId}`);
    const newSession = { currentStep: null, ticketData: {} };
    return await sessionManager.saveSession(userId, newSession);
  },
  
  /**
   * Delete a user session
   * @param {string} userId - The user's WhatsApp number
   */
  deleteSession: async (userId) => {
    console.log(`Suppression de la session pour l'utilisateur ${userId}`);
    
    // Remove from cache
    sessionCache.del(userId);
    
    // Remove from file
    try {
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      delete sessions[userId];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
      console.log(`Session supprimée avec succès pour ${userId}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression de la session pour ${userId}:`, error);
    }
  }
};

module.exports = sessionManager;
