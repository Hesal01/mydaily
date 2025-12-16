import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBhDg9UNCwlR_uajbIBy4SVMhw5C_uUHxM",
  authDomain: "mydaily-8d939.firebaseapp.com",
  projectId: "mydaily-8d939",
  storageBucket: "mydaily-8d939.firebasestorage.app",
  messagingSenderId: "520125574328",
  appId: "1:520125574328:web:f9522112b56689247cd84d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const users = [
  { id: 'user_1', token: 'Kx7mN3pQw9vL2yR', displayOrder: 1 },
  { id: 'user_2', token: 'Ht4jF8sB6nM1cZ5', displayOrder: 2 },
  { id: 'user_3', token: 'Pw9xD2kG7rT5vN3', displayOrder: 3 },
  { id: 'user_4', token: 'Jm6bY4hC8qL1wS9', displayOrder: 4 },
  { id: 'user_5', token: 'Vn2tR7fK5pX3gM8', displayOrder: 5 },
  { id: 'user_6', token: 'Qc9sW1mH6jB4yD7', displayOrder: 6 },
  { id: 'user_7', token: 'Lf5vN8rT2kP9xG3', displayOrder: 7 },
  { id: 'user_8', token: 'Zb7hM4wC1sY6qJ9', displayOrder: 8 },
  { id: 'user_9', token: 'Xk3gR9nF5tL2vP8', displayOrder: 9 },
  { id: 'user_10', token: 'Dy6cB1mW7hQ4sN2', displayOrder: 10 },
];

async function seed() {
  console.log('Seeding users...');

  for (const user of users) {
    await setDoc(doc(db, 'users', user.id), {
      token: user.token,
      displayOrder: user.displayOrder
    });
    console.log(`✓ ${user.id} créé`);
  }

  console.log('\n✅ Done! Voici les liens:');
  users.forEach(u => {
    console.log(`User ${u.displayOrder}: https://mydaily-8d939.web.app/?token=${u.token}`);
  });
}

seed().then(() => process.exit(0)).catch(console.error);
