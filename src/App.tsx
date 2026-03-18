import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Header from './components/Header';
import Hero from './components/Hero';
import Menu from './components/Menu';
import Subscription from './components/Subscription';
import Story from './components/Story';
import Checkout from './components/Checkout';
import StickyCTA from './components/StickyCTA';
import AdminDashboard from './components/AdminDashboard';
import FinalCTA from './components/FinalCTA';
import AuthModal from './components/AuthModal';
import ProfilePanel from './components/ProfilePanel';
import { isSignInWithEmailLink, onAuthStateChanged, signInWithEmailLink, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Product, UserProfile, Order } from './types';
import { seedMenu } from './data/seedMenu';
import { getOfferPrice } from './pricing';

export default function App() {
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "sumanthbolla97@gmail.com";
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [menuTotal, setMenuTotal] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "monthly">("weekly");
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Partial<UserProfile> | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [localUserOrders, setLocalUserOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const cartCount = Object.values(cart).reduce((sum: number, qty: number) => sum + qty, 0);
  const subscriptionTotal =
    ((cart.sub_weekly ?? 0) ? 799 : 0) + ((cart.sub_monthly ?? 0) ? 2599 : 0);
  const combinedTotal = menuTotal + subscriptionTotal;

  useEffect(() => {
    // Ensure page always starts from top
    window.scrollTo(0, 0);
  }, []);

  const requireAuth = () => {
    if (!user) {
      setAuthMode("login");
      setIsAuthOpen(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubscription = (plan: "weekly" | "monthly") => {
    if (!requireAuth()) return;
    setCart((prev) => {
      const next = { ...prev };
      delete next.sub_weekly;
      delete next.sub_monthly;
      next[plan === "weekly" ? "sub_weekly" : "sub_monthly"] = 1;
      return next;
    });
    setSelectedPlan(plan);
    setIsPlanOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleRemoveItem = (id: string) => {
    if (!requireAuth()) return;
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleIncrementItem = (id: string) => {
    if (!requireAuth()) return;
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + 1
    }));
  };

  const handleDecrementItem = (id: string) => {
    if (!requireAuth()) return;
    setCart((prev) => {
      const next = { ...prev };
      const current = next[id] ?? 0;
      if (current <= 1) {
        delete next[id];
      } else {
        next[id] = current - 1;
      }
      return next;
    });
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsAuthOpen(false);
        (async () => {
          try {
            const adminSnap = await getDoc(doc(db, "admins", currentUser.uid));
            setIsAdmin(adminSnap.exists());
          } catch (err) {
            console.warn("Failed to load admin status:", err);
            setIsAdmin(false);
          }
        })();
      } else {
        setIsAdminOpen(false);
        setIsCartHydrated(false);
        setIsAdmin(false);
        setUserProfile(null);
        setCart({});
        window.localStorage.removeItem("simplysip_cart");
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const hydrateCart = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        if (data?.cart && Object.keys(data.cart).length > 0) {
          // Normalize cart data to ensure all values are numbers
          const normalizedCart = Object.fromEntries(
            Object.entries(data.cart).map(([k, v]) => [k, Number(v) || 0])
          );
          setCart(normalizedCart);
        } else {
          // Fallback to localStorage if no cart in database
          const localCart = window.localStorage.getItem("simplysip_cart");
          if (localCart) {
            try {
              const parsedCart = JSON.parse(localCart);
              const normalizedCart = Object.fromEntries(
                Object.entries(parsedCart).map(([k, v]) => [k, Number(v) || 0])
              );
              setCart(normalizedCart);
            } catch (err) {
              console.warn("Failed to parse local cart:", err);
              setCart({});
            }
          } else {
            setCart({});
          }
        }
      } catch (err) {
        console.warn("Failed to hydrate cart from database, trying localStorage:", err);
        // Fallback to localStorage
        const localCart = window.localStorage.getItem("simplysip_cart");
        if (localCart) {
          try {
            const parsedCart = JSON.parse(localCart);
            const normalizedCart = Object.fromEntries(
              Object.entries(parsedCart).map(([k, v]) => [k, Number(v) || 0])
            );
            setCart(normalizedCart);
          } catch (parseErr) {
            console.warn("Failed to parse local cart:", parseErr);
            setCart({});
          }
        } else {
          setCart({});
        }
      } finally {
        setIsCartHydrated(true);
      }
    };
    hydrateCart();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    return onSnapshot(
      userRef,
      (snapshot) => {
        setUserProfile(snapshot.data() || null);
      },
      (err) => {
        console.warn("Failed to load user profile:", err);
      }
    );
  }, [user]);

  useEffect(() => {
    const menuRef = collection(db, "menu");
    const unsubscribe = onSnapshot(
      menuRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const data: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          setMenuItems(data);
        } else {
          // Fallback or seed if necessary
          setMenuItems(seedMenu.map((item, i) => ({ ...item, id: String(i + 1) } as Product)));
        }
      },
      (err) => {
        console.error("Menu realtime update failed:", err);
        // Fallback to static seed data on error
        setMenuItems(seedMenu.map((item, i) => ({ ...item, id: String(i + 1) } as Product)));
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      return;
    }

    const ordersQuery = query(collection(db, 'orders'), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      if (!snapshot.empty) {
        const myOrders: Order[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        setUserOrders(myOrders);
        setLocalUserOrders((prev) => prev.filter((lo) => !myOrders.some((mo) => mo.id === lo.id)));
      } else {
        setUserOrders([]);
      }
    }, (error) => {
      console.error("Failed to load user orders:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !isCartHydrated) return;
    
    // Immediate localStorage backup for cart persistence
    window.localStorage.setItem("simplysip_cart", JSON.stringify(cart));
    
    const saveCart = async (cartData: Record<string, number>, retryCount = 0) => {
      try {
        await updateDoc(doc(db, "users", user.uid), { 
          cart: cartData, 
          cartUpdatedAt: Date.now(),
          cartVersion: Date.now()  // Add version for conflict resolution
        });
      } catch (err) {
        console.error(`Failed to persist cart (attempt ${retryCount + 1}):`, err);
        if (retryCount < 3) {
          // Exponential backoff retry
          setTimeout(() => saveCart(cartData, retryCount + 1), Math.pow(2, retryCount) * 1000);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      saveCart(cart);
    }, 500);  // Keep debounce for rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [cart, user, isCartHydrated]);

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem("simplysip_email_link") || window.prompt("Confirm your email to complete sign-in");
      if (!email) return;
      signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem("simplysip_email_link");
          setIsAuthOpen(false);
        })
        .catch((err) => {
          console.error("Email link sign-in failed:", err);
        });
    }
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsProfileOpen(false);
  };

  const handleAddressUpdate = async (addressData: any) => {
    if (!user) return;
    const payload = { ...addressData, updatedAt: Date.now() };
    await updateDoc(doc(db, "users", user.uid), payload);
    setUserProfile((prev: any) => ({ ...(prev || {}), ...payload }));
  };

  const handleOrderPlaced = (newOrder: Order) => {
    setLocalUserOrders((prev) => {
      if (prev.some((o) => o.id === newOrder.id)) return prev;
      return [newOrder, ...prev];
    });
  };

  const handleOpenCheckout = () => {
    if (!user) {
      setAuthMode("login");
      setIsAuthOpen(true);
    } else {
      setIsCheckoutOpen(true);
    }
  };

  const displayOrders: Order[] = Array.from(
    new Map([...localUserOrders, ...userOrders].map((o) => [o.id, o])).values()
  ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="relative min-h-screen bg-[#FBFAF7] selection:bg-[#1D1C1A] selection:text-white">
      <AnimatePresence mode="wait">
        {isAdminOpen ? (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <AdminDashboard onBack={() => setIsAdminOpen(false)} />
          </motion.div>
        ) : isCheckoutOpen ? (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Checkout 
              onBack={() => setIsCheckoutOpen(false)} 
              user={user ? ({
                ...(userProfile || {}),
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                phoneNumber: user.phoneNumber
              } as UserProfile) : null}
              menuItems={menuItems}
              cart={cart}
              onClearCart={() => setCart({})}
              onRemoveItem={handleRemoveItem}
              onIncrementItem={handleIncrementItem}
              onDecrementItem={handleDecrementItem}
              onAddressUpdate={handleAddressUpdate}
              onOrderPlaced={handleOrderPlaced}
            />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Header 
              user={user}
              onAuth={() => {
                setAuthMode("login");
                setIsAuthOpen(true);
              }}
              onLogout={handleLogout}
              isAdmin={isAdmin}
              onAdminOpen={() => setIsAdminOpen(true)}
              onProfileToggle={() => setIsProfileOpen(true)}
            />
            <Hero onSubscribe={() => setIsPlanOpen(true)} />
            <Menu 
              cart={cart}
              menuItems={menuItems}
              onIncrement={handleIncrementItem}
              onDecrement={handleDecrementItem}
              onCheckout={handleOpenCheckout}
              onCartTotalChange={setMenuTotal}
            />
            <Subscription 
              onSubscribe={(plan) => handleSubscription(plan)}
              selectedPlan={selectedPlan}
              onPlanChange={(plan) => setSelectedPlan(plan)}
            />
            <Story />
            <FinalCTA onSubscribe={handleOpenCheckout} />
            <StickyCTA 
              onSubscribePlan={handleSubscription}
              selectedPlan={selectedPlan}
              onPlanChange={setSelectedPlan}
              onCheckout={handleOpenCheckout}
              cartCount={cartCount as number}
            />

            {isPlanOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full max-w-lg bg-white rounded-[2rem] p-8 border border-black/5 shadow-[0_50px_120px_-80px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63]">Select Plan</div>
                    <button
                      onClick={() => setIsPlanOpen(false)}
                      className="text-xs uppercase tracking-[0.3em] text-[#6F6A63]"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => handleSubscription("weekly")}
                      className="w-full text-left border border-black/10 rounded-3xl p-5 hover:border-black/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm uppercase tracking-[0.3em] text-[#6F6A63] mb-1">Weekly Plan</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-[#A7A29C] line-through font-medium">{"\u20B9"}999</span>
                            <span className="text-lg font-semibold text-[#1D1C1A] font-display">{"\u20B9"}799 / week</span>
                          </div>
                          <div className="text-xs text-[#6F6A63]">7 cold-pressed juices (200 ml each)</div>
                        </div>
                        <span className="pointer-events-none inline-flex items-center justify-center min-w-[140px] px-5 sm:px-6 py-2.5 bg-[#1D1C1A] text-white rounded-full font-semibold tracking-[0.2em] uppercase text-[10px]">
                          Subscribe Now
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSubscription("monthly")}
                      className="w-full text-left border border-black/10 rounded-3xl p-5 hover:border-black/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm uppercase tracking-[0.3em] text-[#6F6A63]">Monthly Plan</span>
                            <span className="bg-[#1D1C1A] text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-[0.2em]">Best Value</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-[#A7A29C] line-through font-medium">{"\u20B9"}3599</span>
                            <span className="text-lg font-semibold text-[#1D1C1A] font-display">{"\u20B9"}2599 / month</span>
                          </div>
                          <div className="text-xs text-[#6F6A63]">30 cold-pressed juices (200 ml each)</div>
                        </div>
                        <span className="pointer-events-none inline-flex items-center justify-center min-w-[140px] px-5 sm:px-6 py-2.5 bg-[#1D1C1A] text-white rounded-full font-semibold tracking-[0.2em] uppercase text-[10px]">
                          Subscribe Now
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            <AuthModal
              isOpen={isAuthOpen}
              mode={authMode}
              onClose={() => setIsAuthOpen(false)}
              onModeChange={(mode) => setAuthMode(mode)}
            />
            
            <ProfilePanel
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              user={user}
              userProfile={userProfile}
              orders={displayOrders}
              onLogout={handleLogout}
              onAddressUpdate={handleAddressUpdate}
              isAdmin={isAdmin}
              onAdminOpen={() => {
                setIsProfileOpen(false);
                setIsAdminOpen(true);
              }}
            />

            {/* Hidden Admin Trigger in Footer */}
            <footer className="py-12 text-center text-xs font-medium tracking-wide text-gray-400 bg-white">
              <p>(c) 2026 SIMPLY SIP. All rights reserved. 
                <button 
                  onClick={() => {
                    if (!isAdmin) return;
                    setIsAdminOpen(true);
                  }}
                  className={`transition-opacity ml-2 font-bold ${isAdmin ? 'opacity-100 text-black' : 'opacity-0 hover:opacity-100'}`}
                >
                  Admin
                </button>
              </p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
