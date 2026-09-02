/**
 * Retrouve le lien d'accès d'une personne, ou de tout un salon.
 *
 * Le lien n'est pas stocké dans le navigateur — c'est justement lui qui
 * l'oublie, en effaçant la session après environ une semaine sans visite. Il
 * n'existe que sous une forme : le champ `token` du doc user, dans Firestore.
 * Il est donc toujours récupérable, et c'est ce script qui le récupère : la
 * personne qui a perdu sa session n'a plus aucun moyen d'y accéder elle-même.
 *
 * `linkSavedAt` dit si elle a déjà mis son lien de côté depuis l'app. Absent =
 * elle n'a rien pour revenir le jour où le navigateur l'oublie ; c'est à elle
 * qu'il faut renvoyer son lien en priorité.
 *
 * ⚠ Un lien ouvre le compte de son porteur : il se transmet en privé, jamais
 * dans un groupe.
 *
 * Usage:
 *   node scripts/access-link.js <userId>     lien d'une personne
 *   node scripts/access-link.js --salon=<id> tout un salon
 *
 * Exemples:
 *   node scripts/access-link.js user_4
 *   node scripts/access-link.js --salon=salon_1
 */

const { db, fail } = require('./lib/admin');

const APP_URL = 'https://mydaily-8d939.web.app';
const ANIMALS = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

const args = process.argv.slice(2);
const salonArg = args.find(a => a.startsWith('--salon='));
const userId = args.find(a => !a.startsWith('--'));

if (!userId && !salonArg) {
  console.error('Usage: node scripts/access-link.js <userId> | --salon=<salonId>');
  process.exit(1);
}

function line(doc) {
  const u = doc.data();
  const index = Number.isInteger(u.animalIndex)
    ? u.animalIndex
    : parseInt(String(doc.id).replace('user_', ''), 10) - 1;
  const badge = u.label || ANIMALS[index] || '🐾';
  const saved = u.linkSavedAt
    ? `mis de côté le ${u.linkSavedAt.toDate().toISOString().slice(0, 10)}`
    : '⚠ jamais mis de côté';
  return `${doc.id.padEnd(15)} ${badge.padEnd(3)} ${APP_URL}/?token=${u.token}\n${''.padEnd(20)}${saved}`;
}

(async () => {
  if (salonArg) {
    const salonId = salonArg.split('=')[1];
    const snap = await db.collection('users')
      .where('salonIds', 'array-contains', salonId)
      .get();
    if (snap.empty) {
      console.error(`Aucun membre dans ${salonId}`);
      process.exit(1);
    }
    console.log(`${snap.size} membre(s) de ${salonId} — à transmettre en privé\n`);
    snap.docs
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(d => console.log(line(d) + '\n'));
  } else {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) {
      console.error(`Personne inconnue : ${userId}`);
      process.exit(1);
    }
    console.log(line(doc));
  }
  process.exit(0);
})().catch(fail);
