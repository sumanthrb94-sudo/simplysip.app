import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const getEnv = (key: string) => {
  const value = import.meta.env[key];
  if (!value) {
    console.warn(`Missing ${key} in environment. Check GitHub Secrets.`);
  }
  return value || "";
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY") || "dummy_api_key",
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || "dummy_domain",
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || "dummy_project_id",
  databaseURL: getEnv("VITE_FIREBASE_DATABASE_URL"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID") || "1:1234567890:web:dummy",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export let analytics: ReturnType<typeof getAnalytics> | null = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
