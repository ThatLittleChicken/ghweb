import firebase from 'firebase/compat/app';
import 'firebase/compat/analytics';

// Public web-app client config (safe to commit — these identify the app,
// they don't grant access). NEXT_PUBLIC_* env vars override when set.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyA0GzeOFe8LLXjQ8LZrqvUBl7_ORrZGFDA',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ghweb-f209d.firebaseapp.com',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://ghweb-f209d-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ghweb-f209d',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ghweb-f209d.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '536501244116',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:536501244116:web:1e9d94f2b3e7ff99232b41',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENTID || 'G-C5F0JVFGW4',
};

// best-effort custom event logging; never throws
export function logEvent(name: string, params?: Record<string, unknown>) {
  try {
    if (typeof window !== 'undefined' && firebase.apps.length) {
      firebase.analytics().logEvent(name, params);
    }
  } catch (e) { /* analytics blocked or unavailable */ }
}

export default function initFirebase(): void {
  if (firebase.apps.length || !firebaseConfig.projectId) return;
  try {
    firebase.initializeApp(firebaseConfig);
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      // GA4 enhanced measurement auto-tracks page_views, including
      // client-side route changes — no manual events needed
      firebase.analytics();
    }
  } catch (e) {
    // analytics is best-effort; never take the site down over it
    console.warn('Firebase init failed', e);
  }
}
