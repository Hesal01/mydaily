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

// Batch window in minutes - notifications are grouped within this window
const BATCH_WINDOW_MINUTES = 3;

/**
 * Triggered when a habit document is updated
 * Queues a pending notification instead of sending immediately
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

    // Queue the notification instead of sending immediately
    // This allows batching multiple habit completions from the same user
    const pendingRef = db.collection('pendingNotifications').doc(userId);

    try {
      await db.runTransaction(async (transaction) => {
        const pendingDoc = await transaction.get(pendingRef);

        if (pendingDoc.exists) {
          // Add to existing pending habits
          const existingHabits = pendingDoc.data().habits || [];
          const updatedHabits = [...new Set([...existingHabits, ...activatedHabits])];
          transaction.update(pendingRef, {
            habits: updatedHabits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('Updated pending notification for', userId, ':', updatedHabits);
        } else {
          // Create new pending notification
          transaction.set(pendingRef, {
            userId: userId,
            habits: activatedHabits,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('Created pending notification for', userId, ':', activatedHabits);
        }
      });

      return { queued: true, userId, habits: activatedHabits };
    } catch (error) {
      console.error('Error queuing notification:', error);
      return null;
    }
  });

/**
 * Scheduled function that runs every 3 minutes
 * Sends batched notifications for all pending habit completions
 */
exports.sendBatchedNotifications = functions.pubsub
  .schedule(`every ${BATCH_WINDOW_MINUTES} minutes`)
  .onRun(async (context) => {
    console.log('=== sendBatchedNotifications triggered ===');

    // Get all pending notifications
    const pendingSnapshot = await db.collection('pendingNotifications').get();

    if (pendingSnapshot.empty) {
      console.log('No pending notifications');
      return null;
    }

    console.log('Found', pendingSnapshot.size, 'pending notifications');

    // Get all FCM tokens from all users
    const usersSnapshot = await db.collection('users').get();
    const userTokens = {};

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        userTokens[doc.id] = data.fcmToken;
      }
    });

    console.log('Total users with tokens:', Object.keys(userTokens).length);

    // Process each pending notification
    const batch = db.batch();
    const notifications = [];

    pendingSnapshot.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      const habits = data.habits || [];

      if (habits.length === 0) {
        batch.delete(doc.ref);
        return;
      }

      // Get tokens of all users except the one who completed the habits
      const tokens = Object.entries(userTokens)
        .filter(([uid, token]) => uid !== userId)
        .map(([uid, token]) => token);

      if (tokens.length > 0) {
        const userIndex = parseInt(userId.replace('user_', '')) - 1;
        const userAnimal = ANIMALS[userIndex] || '🐾';
        const habitEmojis = habits.map(h => HABIT_EMOJIS[h]).join(' ');

        // Create summary message
        const habitCount = habits.length;
        const title = habitCount === 1
          ? `${userAnimal} a complété une habitude!`
          : `${userAnimal} a complété ${habitCount} habitudes!`;

        notifications.push({
          notification: {
            title: title,
            body: habitEmojis
          },
          tokens: tokens,
          userId: userId
        });
      }

      // Mark as processed by deleting
      batch.delete(doc.ref);
    });

    // Send all notifications
    for (const notif of notifications) {
      try {
        const response = await messaging.sendEachForMulticast({
          notification: notif.notification,
          tokens: notif.tokens
        });
        console.log(`Sent notification for ${notif.userId}: ${response.successCount} success, ${response.failureCount} failures`);
      } catch (error) {
        console.error('Error sending notification for', notif.userId, ':', error);
      }
    }

    // Commit the batch delete
    await batch.commit();
    console.log('Cleaned up pending notifications');

    return { processed: notifications.length };
  });
