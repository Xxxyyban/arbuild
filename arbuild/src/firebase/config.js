import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8AFpFEsw-v9AjQhonmM8rYp5WQNz0TD0",
  authDomain: "arbuild-cdd.firebaseapp.com",
  projectId: "arbuild-cdd",
  storageBucket: "arbuild-cdd.firebasestorage.app",
  messagingSenderId: "482240204095",
  appId: "1:482240204095:web:e1df348daa4f3dbf55578a",
  measurementId: "G-FWQ1R38F6P",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
// Restrict Google Sign-In to the school domain
googleProvider.setCustomParameters({
  hd: "cdd.edu.ph",
});

export const ALLOWED_DOMAIN = "cdd.edu.ph";
