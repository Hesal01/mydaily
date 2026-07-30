/**
 * Initialisation partagée du Admin SDK pour les scripts d'administration.
 *
 * Deux modes d'authentification, dans cet ordre :
 *   1. la clé de service posée à la racine du repo (elle est gitignorée) ;
 *   2. les identifiants par défaut de l'environnement (ADC), utiles si tu as
 *      déjà `gcloud auth application-default login`.
 *
 * L'absence de credentials ne se voit qu'à la première requête : `fail()`
 * traduit ces erreurs en instructions plutôt qu'en stack trace.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'mydaily-8d939';
const KEY_FILE = 'mydaily-8d939-firebase-adminsdk-fbsvc-36b50733bb.json';
const KEY_PATH = path.join(__dirname, '..', '..', KEY_FILE);

const CREDENTIAL_HELP = `
Deux façons de s'authentifier :

  1. Clé de service (la plus simple)
     Firebase Console > Paramètres du projet > Comptes de service
     > Générer une nouvelle clé privée, puis place le fichier ici :

       ${KEY_PATH}

     (il est déjà dans .gitignore, il ne sera pas commité)

  2. Identifiants par défaut, si tu as gcloud

       gcloud auth application-default login
       gcloud config set project ${PROJECT_ID}
`;

const usingKeyFile = fs.existsSync(KEY_PATH);

if (usingKeyFile) {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
} else {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

const CREDENTIAL_ERROR = /credential|authenticat|UNAUTHENTICATED|PERMISSION_DENIED|Could not load the default|Unable to detect a Project Id/i;

/** Termine le script en expliquant l'erreur, credentials en tête. */
function fail(err) {
  if (!usingKeyFile && CREDENTIAL_ERROR.test(String(err && err.message))) {
    console.error("\n❌ Impossible de s'authentifier auprès de Firebase.");
    console.error(CREDENTIAL_HELP);
  } else {
    console.error('Error:', err);
  }
  process.exit(1);
}

module.exports = { admin, db, fail, PROJECT_ID, usingKeyFile };
