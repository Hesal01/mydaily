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
  network: '🌐'
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
    const habitKeys = ['sun', 'doubleSun', 'book', 'doubleBook', 'three', 'network'];

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

/**
 * Helper function to send batched notification
 */
async function sendBatchedNotification(userId, habits) {
  const userIndex = parseInt(userId.replace('user_', '')) - 1;
  const userAnimal = ANIMALS[userIndex] || '🐾';

  // Get all FCM tokens from all users except the one who activated
  const usersSnapshot = await db.collection('users').get();
  const tokens = [];

  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.fcmToken && doc.id !== userId) {
      tokens.push(data.fcmToken);
    }
  });

  if (tokens.length === 0) {
    console.log('No tokens found for user:', userId);
    return null;
  }

  // Build notification with all habits
  const habitEmojis = habits.map(h => HABIT_EMOJIS[h]).join(' ');
  const message = {
    notification: {
      title: `${userAnimal} a complété ${habits.length > 1 ? 'des habitudes' : 'une habitude'}!`,
      body: habitEmojis
    },
    tokens: tokens
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Sent ${response.successCount} notifications for ${userId}, ${response.failureCount} failures`);
    return response;
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
