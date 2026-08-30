/**
 * Envoie une notif de test aux appareils d'une personne, et dit ce que FCM
 * répond pour chacun.
 *
 * C'est le seul moyen de trancher entre « l'app n'envoie pas » et « le
 * téléphone n'affiche pas » : les logs des Cloud Functions ne comptent que les
 * succès, ils ne nomment pas l'appareil. Ici on voit, token par token, si
 * l'envoi passe (et donc que le problème est côté réglages du téléphone) ou
 * s'il échoue (et avec quel code).
 *
 * `--dry-run` valide les tokens auprès de FCM sans rien livrer : à utiliser
 * quand on ne veut pas faire sonner le téléphone de quelqu'un. Attention, un
 * token peut passer en dry-run et échouer à l'envoi réel.
 *
 * Usage:
 *   node scripts/test-push.js <userId> [--dry-run]
 *
 * Exemples:
 *   node scripts/test-push.js user_4            # fait vraiment sonner 🐈
 *   node scripts/test-push.js user_4 --dry-run  # vérifie sans livrer
 */

const { admin, db, fail } = require('./lib/admin');

const ANIMALS = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userId = args.find(a => !a.startsWith('--'));

if (!userId) {
  console.error('Usage: node scripts/test-push.js <userId> [--dry-run]');
  process.exit(1);
}

/** Mêmes règles que la Cloud Function : la liste fait foi, le champ seul reste lu. */
function tokensOf(userData) {
  const list = Array.isArray(userData && userData.fcmTokens) ? userData.fcmTokens : [];
  const legacy = userData && userData.fcmToken;
  const all = legacy ? list.concat([legacy]) : list;
  return Array.from(new Set(all.filter(t => typeof t === 'string' && t.length > 0)));
}

(async () => {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) {
    console.error(`Personne inconnue : ${userId}`);
    process.exit(1);
  }

  const data = snap.data();
  const index = Number.isInteger(data.animalIndex)
    ? data.animalIndex
    : parseInt(String(userId).replace('user_', ''), 10) - 1;
  const badge = data.label || ANIMALS[index] || '🐾';
  const tokens = tokensOf(data);

  console.log(`${userId} (${badge}) — ${tokens.length} appareil(s)${dryRun ? ' — dry-run' : ''}`);
  if (tokens.length === 0) {
    console.log("Aucun token : la personne n'a jamais activé les notifs, ou son");
    console.log('appareil a été nettoyé. Elle doit rouvrir l\'app et toucher la puce.');
    process.exit(0);
  }

  let ok = 0;
  for (const token of tokens) {
    const short = token.slice(0, 16) + '…';
    try {
      await admin.messaging().send({
        token,
        notification: {
          title: 'MyDaily — test',
          body: dryRun ? 'validation' : 'Si tu vois ça, les notifs marchent 👌'
        }
      }, dryRun);
      ok++;
      console.log(`  ✅ ${short}`);
    } catch (error) {
      console.log(`  ❌ ${short}  ${error.code}`);
      console.log(`     ${error.message}`);
    }
  }

  console.log(`\n${ok}/${tokens.length} accepté(s) par FCM.`);
  if (ok > 0 && !dryRun) {
    console.log('Accepté ne veut pas dire affiché : si rien n\'apparaît sur le');
    console.log('téléphone, le blocage est dans ses réglages de notifications');
    console.log('(app installée sur l\'écran d\'accueil, notifs autorisées, mode');
    console.log('concentration, résumé programmé).');
  }
  process.exit(0);
})().catch(fail);
