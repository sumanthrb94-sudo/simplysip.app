import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";

const getEnv = (key: string) => {
  const value = import.meta.env[key];
  if (!value) {
    console.warn(`Missing ${key} in environment. Check your Vite environment variables.`);
  }
  return value || "";
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY") || "dummy_api_key",
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || "dummy_domain",
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || "dummy_project_id",
  databaseURL: getEnv("VITE_FIREBASE_DATABASE_URL") || "",
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || "",
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || "",
  appId: getEnv("VITE_FIREBASE_APP_ID") || "1:1234567890:web:dummy",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

let firebaseInitError: string | null = null;
let firebaseApp: FirebaseApp | null = null;

try {
  firebaseApp = initializeApp(firebaseConfig);
} catch (err) {
  firebaseInitError = err instanceof Error ? err.message : String(err);
  console.error("Firebase initialization failed:", firebaseInitError);
}

export const firebaseConfigError = firebaseInitError;
export const isFirebaseInitialized = Boolean(firebaseApp);

// Export Firestore and Realtime Database instances (may be null if initialization failed)
export const db: Firestore = getFirestore(firebaseApp!);
export const rtdb: Database = getDatabase(firebaseApp!);

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(firebaseApp!);
export const googleProvider = new GoogleAuthProvider();
export let analytics: ReturnType<typeof getAnalytics> | null = null;

if (typeof window !== "undefined" && firebaseApp) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
    }
  });
}
