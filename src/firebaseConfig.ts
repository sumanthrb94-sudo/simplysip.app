import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB-eyrf7rPmNWo4PW84yxRMko1b6WY9SeY",
  authDomain: "simplysip-57db5.firebaseapp.com",
  projectId: "simplysip-57db5",
  storageBucket: "simplysip-57db5.firebasestorage.app",
  messagingSenderId: "167205549894",
  appId: "1:167205549894:web:cade447169e00724fdd747",
  measurementId: "G-8N00V8101Z"
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
