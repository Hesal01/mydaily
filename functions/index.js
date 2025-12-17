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
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!after) return null; // Document deleted

    const userId = after.userId;
    const date = after.date;

    // Find which habits were just activated (false -> true)
    const activatedHabits = [];
    const habitKeys = ['sun', 'doubleSun', 'book', 'doubleBook', 'three', 'network'];

    for (const habit of habitKeys) {
      const wasFalse = !before || !before[habit];
      const isTrue = after[habit] === true;
      if (wasFalse && isTrue) {
        activatedHabits.push(habit);
      }
    }

    if (activatedHabits.length === 0) return null;

    // Get the user who activated the habit
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const userIndex = parseInt(userId.replace('user_', '')) - 1;
    const userAnimal = ANIMALS[userIndex] || '🐾';

    // Get all FCM tokens from all users
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken && doc.id !== userId) {
        // Don't notify the user who activated the habit
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) return null;

    // Build notification message
    const habitEmojis = activatedHabits.map(h => HABIT_EMOJIS[h]).join(' ');
    const message = {
      notification: {
        title: `${userAnimal} a complété une habitude!`,
        body: `${habitEmojis}`
      },
      tokens: tokens
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`Sent ${response.successCount} notifications, ${response.failureCount} failures`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        console.log('Failed tokens:', failedTokens);
      }

      return response;
    } catch (error) {
      console.error('Error sending notifications:', error);
      return null;
    }
  });
