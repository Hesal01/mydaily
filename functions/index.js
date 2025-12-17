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
  book: '📖',
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

    // Find which habits had their count increased
    const activatedHabits = [];
    const habitKeys = ['sun', 'book', 'three', 'network'];

    const beforeCompletions = before?.completions || {};
    const afterCompletions = after?.completions || {};

    for (const habit of habitKeys) {
      const beforeCount = beforeCompletions[habit] || 0;
      const afterCount = afterCompletions[habit] || 0;
      if (afterCount > beforeCount) {
        activatedHabits.push(habit);
      }
    }

    console.log('Activated habits:', activatedHabits);

    if (activatedHabits.length === 0) {
      console.log('No habits activated, skipping');
      return null;
    }

    // Get the user who activated the habit
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('User doc not found:', userId);
      return null;
    }

    const userData = userDoc.data();
    const userIndex = parseInt(userId.replace('user_', '')) - 1;
    const userAnimal = ANIMALS[userIndex] || '🐾';

    // Get all FCM tokens from all users
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];

    console.log('Total users in DB:', usersSnapshot.size);

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('User:', doc.id, 'fcmToken:', data.fcmToken ? 'EXISTS' : 'NONE');
      if (data.fcmToken && doc.id !== userId) {
        // Don't notify the user who activated the habit
        tokens.push(data.fcmToken);
      }
    });

    console.log('Tokens to notify:', tokens.length);

    if (tokens.length === 0) {
      console.log('No tokens found, skipping');
      return null;
    }

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
