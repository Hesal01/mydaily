/**
 * Qui ne reçoit plus les notifs, et pourquoi.
 *
 * Un token périmé reste en base et FCM continue de l'accepter : les logs des
 * Cloud Functions restent verts pendant que le téléphone n'affiche plus rien.
 * Le seul indice fiable est l'écart entre deux dates :
 *
 *   - la dernière habitude cochée   -> la personne se sert de l'app
 *   - `fcmTokenUpdatedAt`           -> son app a confirmé la permission
 *
 * `saveToken()` n'écrit cette seconde date que si la permission est accordée
 * sur l'appareil. Quelqu'un d'actif dont le token traîne loin derrière a donc
 * perdu sa permission sans que rien ne le signale — il faut qu'il touche la
 * puce « Activer les notifs ».
 *
 * Les docs écrits avant l'ajout du champ n'ont pas de date : ils s'affichent
 * en « inconnu » jusqu'à leur prochaine ouverture de l'app.
 *
 * Usage:
 *   node scripts/notif-audit.js [salonId]
 */

const { db, fail } = require('./lib/admin');

const ANIMALS = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];
const STALE_DAYS = 7;

/**
 * Mise en ligne de `fcmTokenUpdatedAt`. Avant cette date personne n'en a, et
 * l'absence ne prouve rien. Après, elle devient un verdict : quelqu'un qui a
 * coché une habitude depuis — donc qui a ouvert l'app — sans que son token
 * soit daté n'a plus la permission sur son appareil.
 */
const FIELD_LIVE_SINCE = '2026-08-27';

const salonFilter = process.argv[2];

function days(from, to) {
  return Math.floor((to - from) / 86400000);
}

(async () => {
  const [users, habits] = await Promise.all([
    db.collection('users').get(),
    db.collection('habits').orderBy('date', 'desc').limit(1000).get()
  ]);

  const lastActive = new Map();
  habits.forEach(h => {
    const d = h.data();
    if (!lastActive.has(d.userId)) lastActive.set(d.userId, d.date);
  });

  const now = new Date();
  const rows = [];

  users.forEach(doc => {
    const u = doc.data();
    const salons = Array.isArray(u.salonIds) ? u.salonIds : [];
    if (salonFilter && !salons.includes(salonFilter)) return;

    const index = Number.isInteger(u.animalIndex)
      ? u.animalIndex
      : parseInt(String(doc.id).replace('user_', ''), 10) - 1;
    const tokens = Array.from(new Set([...(u.fcmTokens || []), u.fcmToken].filter(Boolean)));
    const refreshed = u.fcmTokenUpdatedAt ? u.fcmTokenUpdatedAt.toDate() : null;
    const active = lastActive.get(doc.id) ? new Date(lastActive.get(doc.id)) : null;

    let verdict;
    if (tokens.length === 0) {
      verdict = '⚪️ jamais activé';
    } else if (!refreshed && active && lastActive.get(doc.id) >= FIELD_LIVE_SINCE) {
      verdict = `🔴 permission perdue — app ouverte le ${lastActive.get(doc.id)}, token jamais confirmé`;
    } else if (!refreshed) {
      verdict = '❔ en attente de sa prochaine ouverture de l\'app';
    } else if (active && days(refreshed, active) > STALE_DAYS) {
      verdict = `🔴 permission perdue — actif il y a ${days(active, now)}j, token vieux de ${days(refreshed, now)}j`;
    } else {
      verdict = `🟢 token rafraîchi il y a ${days(refreshed, now)}j`;
    }

    rows.push({
      id: doc.id,
      badge: u.label || ANIMALS[index] || '🐾',
      salons: salons.join(','),
      devices: tokens.length,
      verdict
    });
  });

  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`${rows.length} personne(s)${salonFilter ? ` dans ${salonFilter}` : ''}\n`);
  rows.forEach(r => console.log(
    r.id.padEnd(15),
    r.badge.padEnd(3),
    `${r.devices} appareil(s)`.padEnd(14),
    r.verdict
  ));

  const broken = rows.filter(r => r.verdict.startsWith('🔴'));
  if (broken.length) {
    console.log(`\n${broken.length} personne(s) à relancer : ouvrir l'app et toucher « Activer les notifs ».`);
  }
  process.exit(0);
})().catch(fail);
