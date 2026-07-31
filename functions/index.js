const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Animal emojis for each user
const ANIMALS = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];

// Habit emojis
const HABIT_EMOJIS = {
  sun: '☀️',
  doubleSun: '☀️☀️',
  book: '📖',
  doubleBook: '📖📖',
  three: '3️⃣',
  network: '🌐',
  study: '📚'
};

/**
 * Triggered when a habit document is updated
 * Sends push notification to all users when a habit is activated
 */
exports.onHabitUpdate = functions.firestore
  .document('habits/{habitId}')
  .onWrite(async (change, context) => {
    console.log('=== onHabitUpdate triggered ===');

    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    console.log('Before:', JSON.stringify(before));
    console.log('After:', JSON.stringify(after));

    if (!after) {
      console.log('Document deleted, skipping');
      return null;
    }

    const userId = after.userId;
    const date = after.date;
    console.log('UserId:', userId, 'Date:', date);

    // Skip notifications for past dates
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      console.log('Past date, skipping notification');
      return null;
    }

    // Find which habits were just activated (false -> true)
    const activatedHabits = [];
    const habitKeys = ['sun', 'doubleSun', 'book', 'doubleBook', 'three', 'network', 'study'];

    const beforeCompletions = before?.completions || {};
    const afterCompletions = after?.completions || {};

    for (const habit of habitKeys) {
      const wasFalse = !beforeCompletions[habit];
      const isTrue = afterCompletions[habit] === true;
      if (wasFalse && isTrue) {
        activatedHabits.push(habit);
      }
    }

    console.log('Activated habits:', activatedHabits);

    if (activatedHabits.length === 0) {
      console.log('No habits activated, skipping');
      return null;
    }

    // Add to notification queue instead of sending directly (batching)
    const queueRef = db.collection('notificationQueue').doc(`${date}_${userId}`);

    await queueRef.set({
      userId,
      date,
      habits: admin.firestore.FieldValue.arrayUnion(...activatedHabits),
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('Added to notification queue:', activatedHabits);
    return null;
  });

const DEFAULT_SALON_ID = 'salon_1';

/** Appartenances d'un doc user, tolérant au format d'avant les salons multiples. */
function readSalonIds(userData) {
  if (Array.isArray(userData?.salonIds) && userData.salonIds.length > 0) return userData.salonIds;
  if (typeof userData?.salonId === 'string') return [userData.salonId];
  return [DEFAULT_SALON_ID];
}

/**
 * Habitudes suivies par un salon, ou null s'il les suit toutes. Les salons
 * d'avant ce champ n'ont pas `habitIds` et ne filtrent donc rien.
 */
function readHabitIds(salonDoc) {
  const ids = salonDoc && salonDoc.exists ? salonDoc.data().habitIds : null;
  return Array.isArray(ids) && ids.length > 0 ? ids : null;
}

/**
 * Badge d'une personne, tel qu'affiché dans la grille du salon visé : son badge
 * propre à ce salon, sinon son badge global, sinon son emoji animal. Une même
 * personne peut donc s'annoncer « MI » dans un salon et 🐆 dans un autre.
 * `animalIndex` fait foi ; on ne retombe sur le numéro dans l'id que pour les
 * docs du salon d'origine qui n'ont pas encore le champ.
 */
function badgeFor(userData, userId, salonId) {
  const perSalon = salonId && userData && userData.labels && userData.labels[salonId];
  if (perSalon && String(perSalon).trim()) return String(perSalon).trim();
  const label = userData && userData.label && String(userData.label).trim();
  if (label) return label;
  const index = Number.isInteger(userData?.animalIndex)
    ? userData.animalIndex
    : parseInt(String(userId).replace('user_', ''), 10) - 1;
  return ANIMALS[index] || '🐾';
}

/**
 * Helper function to send batched notification.
 * Ne notifie que les salons de la personne : un salon ne doit jamais apprendre
 * l'activité d'un autre, même par une notif push. Quelqu'un présent dans
 * plusieurs salons prévient les membres de chacun — sa journée y est visible
 * partout — et les tokens sont dédupliqués pour ceux qui se recroisent.
 */
async function sendBatchedNotification(userId, habits) {
  const authorDoc = await db.collection('users').doc(userId).get();
  if (!authorDoc.exists) {
    console.log('Unknown user, skipping:', userId);
    return null;
  }
  const authorData = authorDoc.data();
  const salonIds = readSalonIds(authorData);

  // Get FCM tokens from the members of every salon, except the one who activated
  const [snapshots, salonDocs] = await Promise.all([
    Promise.all(
      salonIds.map(salonId =>
        db.collection('users').where('salonIds', 'array-contains', salonId).get()
      )
    ),
    Promise.all(salonIds.map(salonId => db.collection('salons').doc(salonId).get()))
  ]);

  // Chaque salon n'annonce que les habitudes qu'il suit : quelqu'un présent
  // dans deux salons coche partout, mais un salon n'apprend jamais l'activité
  // qui ne le concerne pas. Le badge de l'auteur varie lui aussi d'un salon à
  // l'autre, d'où un regroupement par (badge, habitudes annoncées) plutôt qu'un
  // multicast unique. Un token déjà vu dans un salon précédent n'est pas repris
  // — une seule notif par personne, même pour qui partage deux salons.
  const seen = new Set();
  const groups = new Map();
  snapshots.forEach((snapshot, i) => {
    const tracked = readHabitIds(salonDocs[i]);
    const shown = tracked ? habits.filter(h => tracked.includes(h)) : habits;
    if (shown.length === 0) return;

    const badge = badgeFor(authorData, userId, salonIds[i]);
    const key = `${badge}|${shown.join(',')}`;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.fcmToken || doc.id === userId || seen.has(data.fcmToken)) return;
      seen.add(data.fcmToken);
      if (!groups.has(key)) groups.set(key, { badge, shown, tokens: [] });
      groups.get(key).tokens.push(data.fcmToken);
    });
  });

  if (groups.size === 0) {
    console.log('No tokens found for user:', userId);
    return null;
  }

  try {
    const responses = await Promise.all(
      Array.from(groups.values(), ({ badge, shown, tokens }) => messaging.sendEachForMulticast({
        notification: {
          title: `${badge} a complété ${shown.length > 1 ? 'des habitudes' : 'une habitude'}!`,
          body: shown.map(h => HABIT_EMOJIS[h]).join(' ')
        },
        tokens: tokens
      }))
    );
    const successCount = responses.reduce((total, r) => total + r.successCount, 0);
    const failureCount = responses.reduce((total, r) => total + r.failureCount, 0);
    console.log(`Sent ${successCount} notifications for ${userId}, ${failureCount} failures`);
    return responses;
  } catch (error) {
    console.error('Error sending batched notification:', error);
    return null;
  }
}

/**
 * Scheduled function to process notification queue
 * Runs every minute and sends batched notifications
 */
exports.processNotificationQueue = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const now = Date.now();
    const BATCH_DELAY_MS = 10000; // 10 seconds minimum delay

    // Get queue entries older than 10 seconds
    const cutoffTime = new Date(now - BATCH_DELAY_MS);
    const queueSnapshot = await db.collection('notificationQueue')
      .where('queuedAt', '<', cutoffTime)
      .get();

    if (queueSnapshot.empty) {
      console.log('Notification queue empty');
      return null;
    }

    console.log(`Processing ${queueSnapshot.size} queued notifications`);

    // Process each queued notification
    for (const doc of queueSnapshot.docs) {
      const data = doc.data();
      console.log(`Processing queue for user ${data.userId}:`, data.habits);

      await sendBatchedNotification(data.userId, data.habits);
      await doc.ref.delete();
    }

    return null;
  });

/**
 * Triggered when a congratulation is written.
 * Sends a push notification to the recipient only (1 -> 1, no multicast).
 * The deterministic doc id ({date}_{to}_{from}) keeps a single doc per
 * sender -> recipient per day; each clap bumps `count`. We push on every
 * count increase (spam), but skip writes that don't add a clap (e.g. the
 * recipient marking it seen) so we never notify on those.
 * (Kept as onWrite under the original name to update the function in place.)
 */
exports.onCongratsCreate = functions.firestore
  .document('congratulations/{congratsId}')
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data) {
      return null;
    }

    const before = change.before.exists ? change.before.data() : null;
    const beforeCount = before ? (before.count || 0) : 0;
    const afterCount = data.count || 0;
    if (afterCount <= beforeCount) {
      // No new clap (seen toggle, deletion, or unrelated edit) -> no push.
      return null;
    }

    const from = data.from;
    const to = data.to;
    const emoji = data.emoji || '👏';

    if (!from || !to) {
      console.log('Congrats missing from/to, skipping');
      return null;
    }

    // Get the recipient's FCM token only
    const [fromDoc, toDoc] = await Promise.all([
      db.collection('users').doc(from).get(),
      db.collection('users').doc(to).get()
    ]);

    // Garde-fou : un bravo ne traverse jamais la frontière d'un salon. Les deux
    // doivent partager au moins un salon.
    const fromSalons = readSalonIds(fromDoc.exists ? fromDoc.data() : null);
    const toSalons = readSalonIds(toDoc.exists ? toDoc.data() : null);
    if (!fromSalons.some(id => toSalons.includes(id))) {
      console.log('Cross-salon congrats, skipping', from, '->', to);
      return null;
    }

    const token = toDoc.exists ? toDoc.data().fcmToken : null;

    if (!token) {
      console.log('No FCM token for recipient', to);
      return null;
    }

    // Le bravo part d'un salon précis : c'est ce badge-là que le destinataire
    // reconnaît dans sa grille.
    const fromBadge = badgeFor(fromDoc.exists ? fromDoc.data() : null, from, data.salonId);

    const message = {
      notification: {
        title: `${fromBadge} t'a félicité ! ${emoji}`,
        body: 'Bravo pour ta journée 💪'
      },
      data: {
        type: 'congrats',
        fromUser: String(from)
      },
      token: token
    };

    try {
      await messaging.send(message);
      console.log(`Congrats notification sent to ${to} from ${from}`);
    } catch (error) {
      console.error('Error sending congrats notification:', error);
    }

    return null;
  });
