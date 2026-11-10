import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 1. Import getStorage

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

// App Check: only this app, not a script that copies its requests, may use the database and file
// storage. It uses a Fraud Defense (reCAPTCHA Enterprise) site key, the one registered for this web
// app under App Check in the Firebase console (a site key is public: it's safe in the code).
// Enforcement is switched on in the console once nearly every request shows as verified. Empty: off.
const APP_CHECK_SITE_KEY = "6Lf0uxIuAAAAAMIAZcEkhJfsZc_mwmniOEUW1kUL";
export const APP_CHECK_ON = !!APP_CHECK_SITE_KEY;
if (APP_CHECK_ON && typeof window !== "undefined") {
  // on a computer's own dev server, the console prints a debug token to add in the Firebase console
  if (window.location.hostname === "localhost") window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

export const auth = getAuth(app);
// In-memory cache only, no copy on disk: school lab computers are shared, and class data kept in the
// browser would still be readable after someone logs out. Writes made while the connection drops
// (a post, lab progress) are still queued and sent when it comes back, while the page stays open.
export const db = getFirestore(app);
export const storage = getStorage(app); // 2. Initialize and export storage
// shortcut: Firebase Storage isn't set up on arbuild-cdd (it has no bucket; a new one needs the Blaze
// plan), so a class post can't carry files and the Attach file button stays hidden (links still work).
// Once Storage is set up in the Firebase console: set this true and deploy storage.rules.
export const FILES_ON = false;

export const STUDENT_DOMAIN = "cdd.edu.ph";
export const FACULTY_DOMAIN = "udd.edu.ph";
export const ALLOWED_DOMAINS = [STUDENT_DOMAIN, FACULTY_DOMAIN];