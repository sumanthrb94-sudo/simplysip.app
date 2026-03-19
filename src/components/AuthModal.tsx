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
import { X, Phone, ChevronLeft } from 'lucide-react';

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
          callback: () => {
            // recaptcha solved
          }
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
        <motion.div
          key="auth-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[#1D1C1A]/20 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            key="auth-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-white rounded-[2.5rem] p-6 sm:p-8 border border-black/5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.3)] relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <div className="text-xl font-extrabold tracking-[0.38em] text-[#1D1C1A] font-display uppercase">
                  SIMPLYSIP
                </div>
                <div className="text-lg text-[#1D1C1A] font-script font-semibold tracking-[0.08em] uppercase -mt-1">
                  ELIXIRS
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F9F8F6] text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {authFlow === "email" ? (
              <div className="flex bg-[#F9F8F6] p-1 rounded-2xl border border-black/5 mb-6">
                <button
                  onClick={() => {
                    onModeChange("login");
                    setAuthFlow("email");
                  }}
                  className={`flex-1 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all ${
                    mode === "login" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onModeChange("signup");
                    setAuthFlow("email");
                  }}
                  className={`flex-1 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all ${
                    mode === "signup" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setAuthFlow("email")}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="mx-auto pr-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#1D1C1A]">
                  {authFlow === "phone" ? "Phone Login" : "Reset Password"}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                if (authFlow === "email") {
                  handleSubmit(e);
                } else {
                  e.preventDefault();
                }
              }}
              className="space-y-4"
            >
              {authFlow === "email" && mode === "signup" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light"
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
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light"
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
                      if (numericValue.length <= 10) {
                        setPhone(numericValue);
                      }
                    }}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light"
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
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light tracking-widest"
                  />
                </div>
              )}

              {authFlow === "email" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light"
                  />
                </div>
              )}

              {error && (
                <div className="text-[11px] font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}
              {authFlow === "reset" && resetSent && (
                <div className="text-[11px] font-bold text-green-600 bg-green-50 p-3 rounded-xl border border-green-100">
                  Reset link sent. Check your inbox.
                </div>
              )}

              <div className="pt-2">
                {authFlow === "email" && (
                  <button
                    type="submit"
                    disabled={isSubmitting || !canSubmit}
                    className="w-full py-4 bg-[#1D1C1A] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting ? "Please wait..." : mode === "login" ? "Login to Account" : "Create Account"}
                  </button>
                )}

                {authFlow === "phone" && (
                  <button
                    type="button"
                    onClick={otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp}
                    disabled={isSubmitting || !canSubmit}
                    className="w-full py-4 bg-[#1D1C1A] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting
                      ? "Please wait..."
                      : otpSent
                      ? "Verify OTP"
                      : "Send OTP"}
                  </button>
                )}

                {authFlow === "reset" && (
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={isSubmitting || !canSubmit}
                    className="w-full py-4 bg-[#1D1C1A] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting ? "Please wait..." : "Send Reset Link"}
                  </button>
                )}
              </div>
            </form>

            {authFlow === "email" && mode === "login" && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAuthFlow("reset")}
                  className="text-[10px] font-bold text-gray-500 hover:text-[#1D1C1A] uppercase tracking-[0.1em] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {authFlow === "email" && (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-black/5" />
                  <span className="text-[9px] uppercase tracking-[0.3em] text-gray-400 font-bold">Or continue with</span>
                  <div className="h-px flex-1 bg-black/5" />
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-white border-2 border-black/5 text-[#1D1C1A] rounded-2xl text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#FAFAFA] hover:border-black/15 transition-all flex items-center justify-center gap-3"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                    Google
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => { setAuthFlow("phone"); setOtpSent(false); }}
                    className="w-full py-3.5 bg-white border-2 border-black/5 text-[#1D1C1A] rounded-2xl text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#FAFAFA] hover:border-black/15 transition-all flex items-center justify-center gap-2"
                  >
                    <Phone size={14} className="text-gray-600" />
                    Phone Number
                  </button>
                </div>
              </>
            )}

            <div id="recaptcha-container" className="hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
