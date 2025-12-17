importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBhDg9UNCwlR_uajbIBy4SVMhw5C_uUHxM",
  authDomain: "mydaily-8d939.firebaseapp.com",
  projectId: "mydaily-8d939",
  storageBucket: "mydaily-8d939.firebasestorage.app",
  messagingSenderId: "520125574328",
  appId: "1:520125574328:web:f9522112b56689247cd84d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestion du clic sur les notifications
self.addEventListener('notificationclick', (event) => {
  // Fermer la notification
  event.notification.close();

  // URL à ouvrir (racine de l'app)
  const urlToOpen = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Chercher si une fenêtre de l'app est déjà ouverte
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Fenêtre trouvée, la mettre au premier plan
          return client.focus();
        }
      }
      // Aucune fenêtre ouverte, en ouvrir une nouvelle
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
