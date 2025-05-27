# Chatbot WhatsApp pour GLPI

Ce projet est un chatbot WhatsApp qui permet aux utilisateurs de créer des tickets GLPI directement via WhatsApp. Le bot pose une série de questions et utilise l'API REST de GLPI pour créer automatiquement un ticket.

## Fonctionnalités

- Intégration avec l'API Cloud de WhatsApp Business
- Gestion des sessions utilisateur pour des conversations fluides
- Création de tickets GLPI via l'API REST
- Sélection du type de demande (incident ou demande)
- Sélection parmi 10 catégories prédéfinies (5 pour les incidents, 5 pour les demandes)
- Conversation guidée pour collecter les informations nécessaires (titre, description, urgence)
- Commande "reset" pour recommencer la conversation à tout moment
- Gestion des erreurs améliorée pour diagnostiquer les problèmes de création de tickets

### Fonctionnalités avancées

- **Interface interactive** : Boutons et listes pour faciliter les interactions avec l'utilisateur
- **Analyse IA des tickets** : Classification automatique des tickets par type et catégorie
- **Mode IA direct** : Possibilité de soumettre une description complète et laisser l'IA classifier automatiquement le ticket
- **IA améliorée avec TensorFlow.js** : Modèles d'apprentissage profond pour une classification plus précise
- **Vocabulaire étendu** : Vocabulaire technique, de domaine et spécifique à GLPI pour une meilleure compréhension
- **Analyse de sentiment** : Détection de l'état émotionnel de l'utilisateur pour prioriser les tickets
- **Évaluation de complexité** : Estimation de la complexité du problème pour une meilleure attribution
- **Correction orthographique** : Amélioration des descriptions utilisateur pour une meilleure compréhension

## Prérequis

- Node.js (v14 ou supérieur)
- Compte WhatsApp Business avec accès à l'API Cloud
- Instance GLPI avec API REST activée
- Ngrok ou un service similaire pour exposer votre serveur local (en développement)
- Clé API OpenAI (optionnelle, pour la fonctionnalité d'analyse IA)

## Installation

1. Clonez ce dépôt
2. Installez les dépendances :

```bash
npm install
```

3. Configurez les variables d'environnement dans le fichier `.env` :

```
# WhatsApp Cloud API credentials
WHATSAPP_TOKEN=EAAS5u429eMsBO0asHeiiZArC1N08PhWMVlZAjN9iu45YZB2kQaRSxmBwEjHVIli6Weo0UjYTXPqGxBFaMbHm3k1Kwlx7r0V1BN9f6RZBEIE6hsSj0m1xb8UwU36M4R3KtVIYYlGHbGohIZA0hKXNjUYpkKghcPDZC3xnpgtFLSZATJjFoqZBlzUTRZCA5x3lgKgX8kr4WSdGQFV3qeYbv4BNILZAnPuaMZD
WHATSAPP_PHONE_NUMBER_ID=588794217656779
WHATSAPP_BUSINESS_ACCOUNT_ID=538028799336045

# GLPI API credentials
GLPI_API_URL=http://10.211.55.15/glpi/apirest.php
GLPI_APP_TOKEN=hgdvtCngi4wlpt2zSqQHeAvdjWQDcDe1TmTWeEoG
GLPI_USER_TOKEN=26xhGhnw2HoArd3t0QAJ1fLG28fCyJOBRq1ZzZF7

# Webhook verification token
VERIFY_TOKEN=26fc084ef44bf078eb615c7ce474d8c136e1fd6fda5422cbce648639ab21f73e

# Server configuration
PORT=3000

# OpenAI API configuration (pour l'analyse IA des tickets)
OPENAI_API_KEY=votre_cle_api_openai
```

## Configuration de WhatsApp Cloud API

1. Créez un compte sur [Facebook Developers](https://developers.facebook.com/)
2. Créez une application et configurez l'API WhatsApp Business
3. Configurez les webhooks pour pointer vers votre serveur (URL: `https://votre-domaine.com/webhook`)
4. Utilisez le token de vérification défini dans votre fichier `.env`
5. Sélectionnez l'événement "messages" pour le webhook

### Numéro de test WhatsApp
- Numéro de test: +1 (555) 644-7524

## Configuration de GLPI

1. Assurez-vous que l'API REST est activée dans votre instance GLPI
2. Vérifiez que les tokens d'application et d'utilisateur sont correctement configurés
3. Assurez-vous que l'utilisateur associé au token a les permissions nécessaires pour créer des tickets

## Configuration d'OpenAI (optionnel)

1. Créez un compte sur [OpenAI](https://openai.com/)
2. Générez une clé API dans les paramètres de votre compte
3. Ajoutez cette clé dans votre fichier `.env` (variable `OPENAI_API_KEY`)

## Démarrage

### En développement

1. Démarrez le serveur Node.js :
```bash
cd /Users/anissefouka/Documents/glpi_ticket
node index.js
```

2. Dans un autre terminal, exposez votre serveur avec ngrok :
```bash
ngrok http 3000
```

3. Configurez le webhook WhatsApp avec l'URL ngrok générée :
```
URL: https://xxxx-xx-xx-xx-xx.ngrok-free.app/webhook
```

### En production

Pour démarrer le serveur en production :

```bash
npm start
```

## Utilisation

1. Envoyez un message au numéro WhatsApp Business (+1 (555) 644-7524 pour le test)
2. Le bot vous accueille avec deux options :
   - **Créer un ticket** : Guide étape par étape avec boutons interactifs
   - **Analyse IA** : Analyse automatique de votre description pour créer un ticket

### Mode Création de ticket

1. Sélectionnez "Créer un ticket"
2. Choisissez le type (incident ou demande) via les boutons
3. Sélectionnez une catégorie dans la liste proposée
4. Fournissez un titre pour votre ticket
5. Décrivez votre problème ou demande
6. Sélectionnez un niveau d'urgence via les boutons
7. Le bot crée le ticket et vous envoie une confirmation

### Mode Analyse IA

1. Sélectionnez "Analyse IA"
2. Décrivez votre problème ou demande en détail
3. L'IA analyse votre texte et détermine automatiquement :
   - Le type de ticket (incident ou demande)
   - La catégorie appropriée
4. Le bot crée le ticket avec ces informations et vous envoie une confirmation

### Commandes spéciales

- `reset` : Réinitialise la conversation et recommence depuis le début

## Structure du projet

- `index.js` : Point d'entrée de l'application, contient la logique du serveur et du webhook
- `services/` : Contient les services utilisés par l'application
  - `whatsappService.js` : Gère les interactions avec l'API WhatsApp, y compris les messages interactifs
  - `sessionManager.js` : Gère les sessions utilisateur et leur persistance
  - `glpiService.js` : Gère les interactions avec l'API GLPI, notamment la création de tickets
  - `localAiService.js` : Service d'analyse et de classification des tickets par IA (version de base)
  - `enhancedLocalAiService.js` : Service d'IA amélioré avec vocabulaire étendu et TensorFlow
  - `enhancedTensorflowService.js` : Service TensorFlow.js pour l'apprentissage profond
  - `aiIntegrationService.js` : Service d'intégration entre les différents services d'IA
- `data/` : Stocke les données de session et les vocabulaires
  - `vocabularyBase.js` : Vocabulaire de base pour les incidents et demandes
  - `vocabularyDomain.js` : Vocabulaire spécifique aux différents domaines métier
  - `vocabularyTechnical.js` : Vocabulaire technique pour les termes informatiques
  - `vocabularyGlpi.js` : Vocabulaire spécifique à GLPI et aux processus ITIL
- `scripts/` : Scripts utilitaires
  - `initializeAi.js` : Script d'initialisation des modèles d'IA améliorée
- `models/` : Stocke les modèles TensorFlow entraînés (créé automatiquement)

## Fonctionnement de l'IA améliorée

Le système d'IA améliorée utilise TensorFlow.js pour fournir des capacités d'analyse avancées :

### Modèles d'apprentissage profond
1. **Classification de type de ticket** : Détermine si le ticket est un incident ou une demande
2. **Classification de catégorie** : Identifie la catégorie la plus appropriée parmi les 10 disponibles
3. **Évaluation d'urgence** : Attribue un niveau d'urgence de 1 à 5 en fonction du contenu
4. **Analyse de sentiment** : Détecte l'état émotionnel de l'utilisateur (positif, neutre, négatif)
5. **Évaluation de complexité** : Estime la complexité du problème (simple, modéré, complexe)

### Vocabulaire étendu
Le système utilise plusieurs vocabulaires spécialisés pour améliorer la compréhension :
- **Vocabulaire de base** : Termes généraux liés aux incidents et demandes
- **Vocabulaire de domaine** : Termes spécifiques à différents secteurs d'activité
- **Vocabulaire technique** : Termes informatiques et expressions techniques
- **Vocabulaire GLPI** : Termes spécifiques à GLPI, ITIL et à la gestion des services IT

### Processus d'analyse
1. Le message de l'utilisateur est prétraité (correction orthographique, normalisation)
2. Les modèles TensorFlow analysent le texte pour les différentes classifications
3. En cas de confiance faible, un système de repli basé sur les mots-clés est utilisé
4. Les résultats sont combinés pour fournir une analyse complète du ticket
5. L'utilisateur reçoit un résumé de l'analyse et peut confirmer ou modifier les détails

### Initialisation et entraînement
Pour initialiser et entraîner les modèles d'IA améliorée :

```bash
node scripts/initializeAi.js
```

Ce script charge tous les vocabulaires, initialise les modèles TensorFlow et les entraîne avec les données disponibles. Les modèles entraînés sont sauvegardés dans le dossier `models/` pour une utilisation ultérieure.

## Personnalisation de l'IA

### Ajout de vocabulaire
Vous pouvez étendre les vocabulaires existants en ajoutant des termes dans les fichiers correspondants :
- `data/vocabularyBase.js` : Pour les termes généraux
- `data/vocabularyDomain.js` : Pour les termes spécifiques à un domaine
- `data/vocabularyTechnical.js` : Pour les termes techniques
- `data/vocabularyGlpi.js` : Pour les termes GLPI et ITIL

### Ajustement des modèles
Pour ajuster les paramètres des modèles TensorFlow :
1. Modifiez les fichiers `services/enhancedTensorflowTraining.js` et `services/enhancedTensorflowTraining2.js`
2. Ajustez les paramètres comme le nombre de couches, les taux d'apprentissage, etc.
3. Réentraînez les modèles avec le script d'initialisation

## Catégories disponibles

### Incidents
1. Incident - autre
2. Incident - logiciel
3. Incident - matériel
4. Incident - Réseau
5. Incident - sécurité

### Demandes
1. Demande - Accès
2. Demande - Autre
3. Demande - Information
4. Demande - logiciel
5. Demande - Nouveau matériel

## Dépannage

### Problèmes courants

1. **Le webhook WhatsApp ne se vérifie pas**
   - Vérifiez que le serveur Node.js est en cours d'exécution
   - Vérifiez que ngrok est correctement configuré et fonctionne
   - Assurez-vous que l'URL du webhook est correcte et inclut `/webhook`
   - Confirmez que le token de vérification est identique à celui dans votre fichier `.env`

2. **Erreurs lors de la création de tickets GLPI**
   - Vérifiez les logs du serveur pour des messages d'erreur détaillés
   - Assurez-vous que les tokens GLPI sont valides et n'ont pas expiré
   - Vérifiez que l'URL de l'API GLPI est correcte et accessible

3. **Le chatbot ne répond pas**
   - Vérifiez que le token WhatsApp est valide
   - Assurez-vous que les webhooks sont correctement configurés
   - Redémarrez le serveur Node.js

4. **Les boutons interactifs ne s'affichent pas**
   - Vérifiez que votre numéro WhatsApp Business est approuvé pour les messages interactifs
   - Assurez-vous que le format des boutons est conforme aux spécifications de l'API WhatsApp

5. **L'analyse IA ne fonctionne pas**
   - Vérifiez que la clé API OpenAI est correctement configurée
   - Assurez-vous que le service OpenAI est disponible
   - Consultez les logs pour voir si le système utilise la classification de secours

### Commandes utiles

```bash
# Tester la connexion à l'API GLPI
curl -X GET -H "Content-Type: application/json" -H "Authorization: user_token 26xhGhnw2HoArd3t0QAJ1fLG28fCyJOBRq1ZzZF7" -H "App-Token: hgdvtCngi4wlpt2zSqQHeAvdjWQDcDe1TmTWeEoG" http://10.211.55.15/glpi/apirest.php/initSession

# Tester la création d'un ticket directement
curl -X POST -H "Content-Type: application/json" -H "Session-Token: [TOKEN_DE_SESSION]" -H "App-Token: hgdvtCngi4wlpt2zSqQHeAvdjWQDcDe1TmTWeEoG" -d '{"input": {"name":"Test depuis Curl","content":"Ceci est un test de création de ticket via curl","type":2,"urgency":3,"itilcategories_id":5,"entities_id":0}}' http://10.211.55.15/glpi/apirest.php/Ticket

# Tester le webhook manuellement
curl -X GET "https://votre-url-ngrok.ngrok-free.app/webhook?hub.mode=subscribe&hub.verify_token=26fc084ef44bf078eb615c7ce474d8c136e1fd6fda5422cbce648639ab21f73e&hub.challenge=CHALLENGE_ACCEPTED"

# Tester l'API OpenAI
curl -X POST "https://api.openai.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Classifie ce texte comme incident ou demande: Mon ordinateur ne démarre plus"}],
    "temperature": 0.3,
    "max_tokens": 150
  }'
```

## Licence

MIT réalisé par Anisse Fouka dans le cadre de son stage
