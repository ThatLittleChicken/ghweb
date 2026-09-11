import firebase from 'firebase/compat/app';
import 'firebase/compat/analytics';


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENTID
};


export default function initFirebase() {
  if (firebase.apps.length || !firebaseConfig.projectId) return
  try {
    firebase.initializeApp(firebaseConfig)
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      firebase.analytics()
    }
  } catch (e) {
    // analytics is best-effort; never take the site down over it
    console.warn('Firebase init failed', e)
  }
}