// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace the following config object with your Firebase project's config
const firebaseConfig = {
    apiKey: "AIzaSyCS9-33BSoZ8pmvthRAXBS0fLVKB-VUGuo",
    authDomain: "fplbotola.firebaseapp.com",
    projectId: "fplbotola",
    storageBucket: "fplbotola.firebasestorage.app",
    messagingSenderId: "925855503539",
    appId: "1:925855503539:web:8bc2b8ffb33d117d818cc6",
    measurementId: "G-KXQBQJSXMH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and export it
const db = getFirestore(app);

export { db };