import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  updateProfile,
  RecaptchaVerifier
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebaseConfig';
import { X, Phone, ChevronLeft, ArrowRight } from 'lucide-react';

type AuthMode = "login" | "signup";
type AuthFlow = "email" | "phone" | "reset";

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

export default function AuthModal({ isOpen, mode, onClose, onModeChange }: AuthModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [authFlow, setAuthFlow] = useState<AuthFlow>("email");
  const [otpSent, setOtpSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<any>(null);

  const upsertUserDoc = async (user: any, extra: Record<string, unknown> = {}) => {
    const payload: any = {
      uid: user.uid,
      provider: user.providerData?.[0]?.providerId || "password",
      lastLoginAt: Date.now(),
      ...extra
    };
    
    const finalName = user.displayName || fullName;
    if (finalName) payload.name = finalName;
    
    const finalPhone = phone || user.phoneNumber;
    if (finalPhone) payload.phone = finalPhone;
    
    const finalEmail = user.email || email;
    if (finalEmail) payload.email = finalEmail;

    await setDoc(
      doc(db, "users", user.uid),
      payload,
      { merge: true }
    );
  };

  const initRecaptcha = () => {
    if (typeof window === "undefined" || !auth) return;

    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {}
        }
      );
    }
  };

  const handleSendPhoneOtp = async () => {
    setError(null);
    if (!/^[0-9]{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsSubmitting(true);
    initRecaptcha();

    try {
      const phoneNumber = `+91${phone}`;
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifierRef.current as RecaptchaVerifier
      );
      confirmationResultRef.current = confirmationResult;
      setOtpSent(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setError(null);
    if (!verificationCode.trim() || !confirmationResultRef.current) {
      setError("Enter the OTP sent to your phone.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmationResultRef.current.confirm(verificationCode);
      await upsertUserDoc(result.user);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Invalid OTP. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (!isEmailValid) {
      setError("Enter a valid email to send a reset link.");
      return;
    }
    setIsSubmitting(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      await sendPasswordResetEmail(auth, email, {
        url: appUrl,
        handleCodeInApp: true
      });
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
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
      setAuthFlow("email");
      setOtpSent(false);
      setVerificationCode("");
      setResetSent(false);
    }
  }, [isOpen, mode]);

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    authFlow === "email"
      ? mode === "login"
        ? isEmailValid && password.trim().length > 0
        : fullName.trim().length > 0 && isEmailValid && password.trim().length > 0
      : authFlow === "phone"
      ? otpSent
        ? verificationCode.trim().length > 0
        : /^[0-9]{10}$/.test(phone)
      : authFlow === "reset"
      ? isEmailValid
      : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Glassmorphism Backdrop */}
          <motion.div
            key="auth-backdrop-premium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md cursor-pointer"
          />

          {/* Premium Right-Aligned Slide Drawer */}
          <motion.div
            key="auth-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220, mass: 0.8 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white z-[101] shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.3)] flex flex-col"
          >
            {/* Elegant Header Area */}
            <div className="flex items-center justify-between px-8 py-6 sm:px-12 sm:pt-12 sm:pb-8">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center text-gray-400 hover:text-black hover:border-black/30 transition-all bg-[#FAFAFA]"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-12 sm:px-12">
              <div className="mb-10">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1A1A1A] font-display mb-3">
                  {authFlow === "reset" ? "Reset." : authFlow === "phone" ? "Enter OTP." : mode === "login" ? "Welcome" : "Sign Up"}
                  {authFlow === "email" && mode === "login" && <span className="block text-gray-400 font-script font-normal text-3xl sm:text-4xl mt-2 italic">back</span>}
                </h1>
                <p className="text-sm font-medium text-gray-400 leading-relaxed max-w-[280px]">
                  {authFlow === "reset" ? "We'll send you a secure link to get you back in." : authFlow === "phone" ? "Verify your number to secure your account." : mode === "login" ? "Enter your details to access your premium elixirs." : "Join the SimplySip experience today."}
                </p>
              </div>

              {/* Million Dollar Toggle Layout */}
              {authFlow === "email" && (
                <div className="flex gap-4 mb-8 border-b border-black/5 pb-1">
                  <button
                    onClick={() => { onModeChange("login"); setAuthFlow("email"); }}
                    className={`pb-3 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${
                      mode === "login" ? "text-[#1A1A1A]" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Login
                    {mode === "login" && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A1A1A]" />}
                  </button>
                  <button
                    onClick={() => { onModeChange("signup"); setAuthFlow("email"); }}
                    className={`pb-3 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${
                      mode === "signup" ? "text-[#1A1A1A]" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Create Account
                    {mode === "signup" && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A1A1A]" />}
                  </button>
                </div>
              )}

              {/* Enhanced Minimalist Form */}
              <form
                onSubmit={(e) => {
                  if (authFlow === "email") handleSubmit(e);
                  else e.preventDefault();
                }}
                className="space-y-6"
              >
                {authFlow === "email" && mode === "signup" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-none border-0 border-b-2 border-black/10 bg-transparent px-1 py-3 text-base focus:ring-0 focus:outline-none focus:border-[#1A1A1A] transition-colors font-medium placeholder:text-gray-300"
                    />
                  </div>
                )}

                {authFlow !== "phone" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-none border-0 border-b-2 border-black/10 bg-transparent px-1 py-3 text-base focus:ring-0 focus:outline-none focus:border-[#1A1A1A] transition-colors font-medium placeholder:text-gray-300"
                    />
                  </div>
                )}

                {authFlow === "phone" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/[^0-9]/g, '');
                        if (numericValue.length <= 10) setPhone(numericValue);
                      }}
                      className="w-full rounded-none border-0 border-b-2 border-black/10 bg-transparent px-1 py-3 text-base focus:ring-0 focus:outline-none focus:border-[#1A1A1A] transition-colors font-medium placeholder:text-gray-300"
                    />
                  </div>
                )}

                {authFlow === "phone" && otpSent && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">One-Time Password</label>
                    <input
                      type="tel"
                      placeholder="Enter 6-digit OTP"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full rounded-none border-0 border-b-2 border-black/10 bg-transparent px-1 py-3 text-xl focus:ring-0 focus:outline-none focus:border-[#1A1A1A] transition-colors font-bold tracking-[0.5em] placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-base"
                    />
                  </div>
                )}

                {authFlow === "email" && (
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Password</label>
                      {authFlow === "email" && mode === "login" && (
                        <button
                          type="button"
                          onClick={() => setAuthFlow("reset")}
                          className="text-[10px] font-bold text-gray-400 hover:text-[#1D1C1A] uppercase tracking-[0.1em] transition-colors"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-none border-0 border-b-2 border-black/10 bg-transparent px-1 py-3 text-base focus:ring-0 focus:outline-none focus:border-[#1A1A1A] transition-colors font-medium placeholder:text-gray-300"
                    />
                  </div>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-red-500 bg-red-50 p-4 border-l-4 border-red-500">
                    {error}
                  </motion.div>
                )}
                {authFlow === "reset" && resetSent && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-green-700 bg-green-50 p-4 border-l-4 border-green-500">
                    Reset link sent. Check your inbox.
                  </motion.div>
                )}

                <div className="pt-6">
                  {authFlow === "email" && (
                    <button
                      type="submit"
                      disabled={isSubmitting || !canSubmit}
                      className="group relative w-full h-14 bg-[#1A1A1A] text-white rounded-none flex items-center justify-center gap-3 text-xs font-bold tracking-[0.2em] uppercase hover:bg-black transition-all disabled:opacity-40 disabled:hover:bg-[#1A1A1A] overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {isSubmitting ? "Processing..." : mode === "login" ? "Enter Experience" : "Join SimplySip"}
                        {!isSubmitting && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                      </span>
                    </button>
                  )}

                  {authFlow === "phone" && (
                    <button
                      type="button"
                      onClick={otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp}
                      disabled={isSubmitting || !canSubmit}
                      className="group relative w-full h-14 bg-[#1A1A1A] text-white rounded-none flex items-center justify-center gap-3 text-xs font-bold tracking-[0.2em] uppercase hover:bg-black transition-all disabled:opacity-40 disabled:hover:bg-[#1A1A1A] overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {isSubmitting ? "Sending..." : otpSent ? "Verify Code" : "Send OTP"}
                        {!isSubmitting && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                      </span>
                    </button>
                  )}

                  {authFlow === "reset" && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isSubmitting || !canSubmit}
                      className="group relative w-full h-14 bg-[#1A1A1A] text-white rounded-none flex items-center justify-center gap-3 text-xs font-bold tracking-[0.2em] uppercase hover:bg-black transition-all disabled:opacity-40 overflow-hidden"
                    >
                      <span className="relative z-10">
                        {isSubmitting ? "Sending..." : "Send Reset Link"}
                      </span>
                    </button>
                  )}
                </div>
              </form>

              {/* Return to Core Modes */}
              {authFlow !== "email" && (
                <div className="mt-8 text-center border-t border-black/5 pt-8">
                  <button
                    onClick={() => { setAuthFlow("email"); setError(null); }}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors inline-flex items-center gap-2"
                  >
                    <ChevronLeft size={14} /> Back to standard login
                  </button>
                </div>
              )}

              {authFlow === "email" && (
                <>
                  <div className="flex items-center gap-4 my-10">
                    <div className="h-px flex-1 bg-black/5" />
                    <span className="text-[10px] uppercase tracking-[0.4em] text-gray-300 font-bold">Or</span>
                    <div className="h-px flex-1 bg-black/5" />
                  </div>

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting}
                      className="w-full h-14 bg-white border border-black/10 text-[#1A1A1A] rounded-none text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#FAFAFA] hover:border-black/30 transition-all flex items-center justify-center gap-3"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                      Continue with Google
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => { setAuthFlow("phone"); setOtpSent(false); }}
                      className="w-full h-14 bg-white border border-black/10 text-[#1A1A1A] rounded-none text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#FAFAFA] hover:border-black/30 transition-all flex items-center justify-center gap-3"
                    >
                      <Phone size={14} className="text-gray-500" />
                      Continue with Phone
                    </button>
                  </div>
                </>
              )}

              <div id="recaptcha-container" className="hidden" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
