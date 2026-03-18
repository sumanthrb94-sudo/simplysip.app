import { signInWithPopup } from "firebase/auth";
import { ref, update } from "firebase/database";
import { auth, db, googleProvider } from "../firebaseConfig";

interface GoogleLoginButtonProps {
  onLoginSuccess: (user: any) => void;
}

const GoogleLoginButton = ({ onLoginSuccess }: GoogleLoginButtonProps) => {

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // The signed-in user info.
      const user = result.user;
      // This gives you a Google Access Token. You can use it to access the Google API.
      // const credential = GoogleAuthProvider.credentialFromResult(result);
      // const token = credential.accessToken;
      await update(ref(db, `users/${user.uid}`), {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        provider: user.providerData?.[0]?.providerId || "google",
        lastLoginAt: Date.now()
      });
      onLoginSuccess(user);
    } catch (error) {
      console.error("Authentication error:", error);
      // Handle Errors here.
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
