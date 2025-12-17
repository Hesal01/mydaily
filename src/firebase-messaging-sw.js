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
