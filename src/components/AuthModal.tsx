import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createUserWithEmailAndPassword, sendSignInLinkToEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebaseConfig';

interface AuthModalProps {
  isOpen: boolean;
  mode: "login" | "signup";
  onClose: () => void;
  onModeChange: (mode: "login" | "signup") => void;
}

export default function AuthModal({ isOpen, mode, onClose, onModeChange }: AuthModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const upsertUserDoc = async (user: any, extra: Record<string, unknown> = {}) => {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.displayName || fullName || "",
        phone: phone || user.phoneNumber || "",
        email: user.email || email || "",
        provider: user.providerData?.[0]?.providerId || "password",
        lastLoginAt: Date.now(),
        ...extra
      },
      { merge: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError("Full name is required.");
        return;
      }
      if (phone && !/^\d{10}$/.test(phone)) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
          await updateProfile(cred.user, { displayName: fullName });
        }
        await upsertUserDoc(cred.user, { createdAt: Date.now() });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await upsertUserDoc(cred.user);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await upsertUserDoc(result.user);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailLink = async () => {
    setError(null);
    if (!isEmailValid) {
      setError("Enter a valid email to receive a login link.");
      return;
    }
    setIsSubmitting(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const actionCodeSettings = {
        url: appUrl,
        handleCodeInApp: true
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("simplysip_email_link", email);
      setLinkSent(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send login link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPassword("");
      setLinkSent(false);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    mode === "login"
      ? isEmailValid && password.trim().length > 0
      : fullName.trim().length > 0 && isEmailValid && password.trim().length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="w-full max-w-md bg-white rounded-[2rem] p-8 border border-black/5 shadow-[0_50px_120px_-80px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63]">
              {mode === "login" ? "Login" : "Sign Up"}
            </div>
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-[0.3em] text-[#6F6A63]"
            >
              Close
            </button>
          </div>

          <div className="inline-flex rounded-full border border-black/10 bg-[#F4F1EC] p-1 mb-6">
            <button
              onClick={() => onModeChange("login")}
              className={`px-4 py-2 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase transition-colors ${
                mode === "login" ? "bg-[#1D1C1A] text-white" : "text-[#6F6A63]"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => onModeChange("signup")}
              className={`px-4 py-2 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase transition-colors ${
                mode === "signup" ? "bg-[#1D1C1A] text-white" : "text-[#6F6A63]"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-base focus:outline-none focus:border-black transition-colors font-light"
              />
            )}
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-base focus:outline-none focus:border-black transition-colors font-light"
            />
            {mode === "signup" && (
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  if (numericValue.length <= 10) {
                    setPhone(numericValue);
                  }
                }}
                className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-base focus:outline-none focus:border-black transition-colors font-light"
              />
            )}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-base focus:outline-none focus:border-black transition-colors font-light"
            />
            {error && (
              <div className="text-xs text-red-500 font-medium">
                {error}
              </div>
            )}
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="w-full py-4 bg-[#1A1A1A] text-white font-semibold tracking-[0.1em] hover:bg-black transition-all duration-500 uppercase text-[11px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1A1A1A]"
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Continue" : "Create Account"}
          </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#6F6A63]">Or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          <button
            type="button"
            onClick={handleEmailLink}
            disabled={isSubmitting || !isEmailValid}
            className="w-full py-3.5 border border-black/10 rounded-full font-semibold tracking-[0.2em] uppercase text-[10px] text-[#1D1C1A] hover:border-black/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Email Me a Login Link
          </button>
          {linkSent && (
            <div className="mt-3 text-[11px] text-[#6F6A63] text-center">
              Link sent. Check your email to finish sign-in.
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#6F6A63]">Or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-3.5 border border-black/10 rounded-full font-semibold tracking-[0.2em] uppercase text-[10px] text-[#1D1C1A] hover:border-black/20 transition-colors"
          >
            Continue with Google
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
