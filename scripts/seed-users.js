/**
 * Script pour initialiser les utilisateurs dans Firebase
 *
 * INSTRUCTIONS:
 * 1. Va sur https://console.firebase.google.com
 * 2. Crée un nouveau projet (ou utilise un existant)
 * 3. Active Firestore Database
 * 4. Va dans Project Settings > Service Accounts
 * 5. Génère une nouvelle clé privée (télécharge le JSON)
 * 6. Renomme-le en "serviceAccountKey.json" et place-le dans ce dossier
 * 7. Run: node scripts/seed-users.js
 */

const admin = require('firebase-admin');

// Charge la clé de service (à télécharger depuis Firebase Console)
const serviceAccount = require('../mydaily-8d939-firebase-adminsdk-fbsvc-36b50733bb.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Génère un token aléatoire
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// 10 utilisateurs avec tokens uniques
const users = Array.from({ length: 10 }, (_, i) => ({
  id: `user_${i + 1}`,
  token: generateToken(),
  displayOrder: i + 1
}));

async function seedUsers() {
  console.log('Seeding users...\n');

  for (const user of users) {
    await db.collection('users').doc(user.id).set({
      token: user.token,
      displayOrder: user.displayOrder,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`User ${user.displayOrder}: https://mydaily-8d939.web.app/?token=${user.token}`);
  }

  console.log('\n✅ Done! Garde ces URLs quelque part, ce sont les liens d\'accès.');
  console.log('\n📋 Tokens générés:');
  users.forEach(u => console.log(`  User ${u.displayOrder}: ${u.token}`));
}

seedUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
