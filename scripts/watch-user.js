/**
 * Écoute en direct les écritures sur le doc d'une personne, pendant qu'elle
 * ouvre l'app.
 *
 * À quoi ça sert : `saveToken()` réécrit le doc user à chaque ouverture, mais
 * seulement si la permission notifications est accordée sur cet appareil. Le
 * doc qui bouge à la seconde où la personne ouvre l'app est donc la preuve que
 * sa permission est bonne — et un doc qui reste muet, la preuve qu'elle ne
 * l'est plus. C'est la seule façon de le savoir sans se pencher sur son
 * téléphone, parce qu'un token périmé reste en base et que FCM continue de
 * l'accepter : côté serveur, tout paraît vert.
 *
 * Attention : cocher une habitude ou saisir des pages de lecture écrit aussi
 * le doc. Demander une ouverture SANS rien toucher d'autre.
 *
 * Usage:
 *   node scripts/watch-user.js <userId> [minutes]
 *
 * Exemple:
 *   node scripts/watch-user.js user_4 10
 */

const { db, fail } = require('./lib/admin');

const args = process.argv.slice(2);
const userId = args[0];
const minutes = Number(args[1]) || 10;

if (!userId) {
  console.error('Usage: node scripts/watch-user.js <userId> [minutes]');
  process.exit(1);
}

const ref = db.collection('users').doc(userId);

(async () => {
  const start = await ref.get();
  if (!start.exists) {
    console.error(`Personne inconnue : ${userId}`);
    process.exit(1);
  }

  const startedAt = start.updateTime.toDate();
  console.log(`👀 ${userId} — écoute pendant ${minutes} min`);
  console.log(`   dernière écriture avant : ${startedAt.toISOString()}`);
  console.log(`   demande-lui d'ouvrir l'app SANS rien cocher\n`);

  let first = true;
  const stop = ref.onSnapshot(snap => {
    if (first) { first = false; return; } // le premier événement est l'état courant
    const data = snap.data() || {};
    const token = (data.fcmToken || '').slice(0, 16);
    console.log(`✍️  ${snap.updateTime.toDate().toISOString()}  token=${token || 'aucun'}…`);
    console.log('   → le doc bouge : la permission est accordée sur son appareil.');
    console.log('     Le web est sain, c\'est Android qui avale l\'affichage.\n');
  }, err => {
    console.error('Erreur d\'écoute :', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    stop();
    console.log(`\n⏱️  Fin des ${minutes} min.`);
    console.log("Si rien ne s'est affiché alors qu'il a bien ouvert l'app :");
    console.log('la permission notifications n\'est plus accordée chez lui.');
    console.log('Il doit toucher la puce « Activer les notifs » dans la grille.');
    process.exit(0);
  }, minutes * 60 * 1000);
})().catch(fail);
