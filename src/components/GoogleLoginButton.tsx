import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebaseConfig";

interface GoogleLoginButtonProps {
  onLoginSuccess: (user: any) => void;
}

const GoogleLoginButton = ({ onLoginSuccess }: GoogleLoginButtonProps) => {

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // The signed-in user info.
      const user = result.user;
      
      const payload: any = {
        uid: user.uid,
        provider: user.providerData?.[0]?.providerId || "google",
        lastLoginAt: Date.now()
      };
      if (user.displayName) payload.name = user.displayName;
      if (user.email) payload.email = user.email;
      if (user.phoneNumber) payload.phone = user.phoneNumber;

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      onLoginSuccess(user);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // Silent ignore for ghost triggers during development
        console.debug("ADMIN: Ghost popup error suppressed.");
      } else {
        console.error("Authentication error:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button 
      onClick={handleGoogleSignIn} 
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      Sign in with Google
    </button>
  );
};

export default GoogleLoginButton;
