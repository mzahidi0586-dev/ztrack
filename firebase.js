import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9kQJzKZsviTlv7O7lN1F0YKppd7yYtR8",
  authDomain: "ztrack-31d5f.firebaseapp.com",
  projectId: "ztrack-31d5f",
  storageBucket: "ztrack-31d5f.firebasestorage.app",
  messagingSenderId: "14957335048",
  appId: "1:14957335048:web:076e2ac585c960fa3eb7bd",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
