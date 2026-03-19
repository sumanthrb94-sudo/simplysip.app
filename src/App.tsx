import { useEffect, useState, useRef, useMemo } from 'react';
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
import { collection, doc, getDoc, onSnapshot, query, updateDoc, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Product, UserProfile, Order } from './types';
import { seedMenu } from './data/seedMenu';
import { getOfferPrice } from './pricing';

export default function App() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [menuTotal, setMenuTotal] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Partial<UserProfile> | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [localUserOrders, setLocalUserOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "monthly">("weekly");
  const initialAuthResolved = useRef(false);
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
    
    // Recover pending orders from local storage to mask network latency
    const localOrdersStr = window.localStorage.getItem('simplysip_local_orders');
    if (localOrdersStr) {
      try {
        setLocalUserOrders(JSON.parse(localOrdersStr));
      } catch (e) {
        console.warn("Failed to parse local orders");
      }
    }
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
        
        // Immediately set admin status synchronously to avoid database hangs
        const email = currentUser.email?.toLowerCase().trim() || "";
        const isEmailAdmin = email === "sumanthbolla97@gmail.com";
        const isLocalAdmin = window.localStorage.getItem('simplysip_local_admin') === 'true';
        setIsAdmin(isEmailAdmin || isLocalAdmin);

        // Background check for Firestore admin badge
        getDoc(doc(db, "admins", currentUser.uid))
          .then((snap) => {
            if (snap.exists()) {
              setIsAdmin(true);
            } else if (!isEmailAdmin) {
              // Revoke invalid local admin status to prevent crash loops
              setIsAdmin(false);
              window.localStorage.removeItem('simplysip_local_admin');
            }
          })
          .catch((err: any) => {
            if (err.code === 'unavailable' || err.message?.includes('offline')) {
              console.debug("Admin check deferred: Client is offline.");
            } else {
              console.warn("Failed to load admin status:", err);
            }
          });

        // Trigger the premium splash screen transition immediately after a login event
        if (initialAuthResolved.current) {
          setShowSplash(true);
          setTimeout(() => setShowSplash(false), 2000);
        }
      } else {
        setIsAdminOpen(false);
        setIsCartHydrated(false);
        setIsAdmin(false);
        setUserProfile(null);
        setCart({});
        window.localStorage.removeItem("simplysip_cart");
        window.localStorage.removeItem("simplysip_local_orders");
      }

      // Handle the very first page load initialization
      if (!initialAuthResolved.current) {
        initialAuthResolved.current = true;
        setTimeout(() => setShowSplash(false), 2000);
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
          setCart(current => Object.keys(current).length > 0 ? { ...normalizedCart, ...current } : normalizedCart);
        } else {
          // Fallback to localStorage if no cart in database
          const localCart = window.localStorage.getItem("simplysip_cart");
          if (localCart) {
            try {
              const parsedCart = JSON.parse(localCart);
              const normalizedCart = Object.fromEntries(
                Object.entries(parsedCart).map(([k, v]) => [k, Number(v) || 0])
              );
              setCart(current => Object.keys(current).length > 0 ? { ...normalizedCart, ...current } : normalizedCart);
            } catch (err) {
              console.warn("Failed to parse local cart:", err);
              setCart(current => Object.keys(current).length > 0 ? current : {});
            }
          } else {
            setCart(current => Object.keys(current).length > 0 ? current : {});
          }
        }
      } catch (err: any) {
        if (err.code === 'unavailable' || err.message?.includes('offline')) {
          console.debug("Client offline. Hydrating cart from localStorage.");
        } else {
          console.warn("Failed to hydrate cart from database, trying localStorage:", err);
        }
        // Fallback to localStorage
        const localCart = window.localStorage.getItem("simplysip_cart");
        if (localCart) {
          try {
            const parsedCart = JSON.parse(localCart);
            const normalizedCart = Object.fromEntries(
              Object.entries(parsedCart).map(([k, v]) => [k, Number(v) || 0])
            );
              setCart(current => Object.keys(current).length > 0 ? { ...normalizedCart, ...current } : normalizedCart);
          } catch (parseErr) {
            console.warn("Failed to parse local cart:", parseErr);
              setCart(current => Object.keys(current).length > 0 ? current : {});
          }
        } else {
            setCart(current => Object.keys(current).length > 0 ? current : {});
        }
      } finally {
        setIsCartHydrated(true);
      }
    };
    hydrateCart();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    // Instantly recover profile from local storage to prevent flicker
    const cachedProfile = window.localStorage.getItem(`simplysip_profile_${user.uid}`);
    if (cachedProfile) {
      try {
        setUserProfile(JSON.parse(cachedProfile));
      } catch (e) {}
    }

    const userRef = doc(db, "users", user.uid);
    return onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data();
        if (data) {
          setUserProfile((prev: any) => {
            // Protect local optimistic updates from stale server reads during quick refreshes
            if (prev?.updatedAt) {
              const serverTime = data.updatedAt || 0;
              // If the server data is older than our local optimistic update, ignore it
              if (serverTime < prev.updatedAt) {
                return prev;
              }
            }
            window.localStorage.setItem(`simplysip_profile_${user.uid}`, JSON.stringify(data));
            return data;
          });
        }
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

    const unsubscribe = onSnapshot(ordersQuery, { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.empty) {
        const myOrders: Order[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        // Only clear the local fallback once the server explicitly confirms the write
        const confirmedOrderIds = new Set(
          snapshot.docs.filter(doc => !doc.metadata.hasPendingWrites).map(doc => doc.id)
        );

        setUserOrders(myOrders);
        setLocalUserOrders((prev) => {
          const updated = prev.filter((lo) => !confirmedOrderIds.has(lo.id));
          window.localStorage.setItem('simplysip_local_orders', JSON.stringify(updated));
          return updated;
        });
      } else {
        setUserOrders([]);
      }
    }, (error) => {
      console.error("Failed to load user orders:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminPendingCount(0);
      return;
    }
    const pendingQuery = query(collection(db, 'orders'), where('orderStatus', '==', 'pending'));
    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      setAdminPendingCount(snapshot.docs.length);
    }, (err) => {
      console.warn("Failed to load pending orders for badge:", err);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!user || !isCartHydrated) return;
    
    // Immediate localStorage backup for cart persistence
    window.localStorage.setItem("simplysip_cart", JSON.stringify(cart));
    
    const saveCart = async (cartData: Record<string, number>, retryCount = 0) => {
      try {
        await setDoc(doc(db, "users", user.uid), { 
          cart: cartData, 
          cartUpdatedAt: Date.now(),
          cartVersion: Date.now()  // Add version for conflict resolution
        }, { merge: true });
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
    // Optimistically update memory and localStorage instantly
    setUserProfile((prev: any) => {
      const next = { ...(prev || {}), ...payload };
      window.localStorage.setItem(`simplysip_profile_${user.uid}`, JSON.stringify(next));
      return next;
    });
    try {
      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    } catch (err) {
      console.error("Firebase address write failed (Check Rules):", err);
      alert("Permission Error: Address saved locally but could not sync to server. Please check your Firebase Database Rules.");
    }
  };

  // Background sync to ensure offline/refreshed profile data reaches server
  useEffect(() => {
    if (!user || !userProfile?.updatedAt) return;
    const syncProfile = async () => {
      try {
        await setDoc(doc(db, "users", user.uid), userProfile, { merge: true });
      } catch (e) {
        console.warn("Background profile sync failed:", e);
      }
    };
    const timeoutId = setTimeout(syncProfile, 4000);
    return () => clearTimeout(timeoutId);
  }, [user, userProfile]);

  // Background sync to ensure offline/refreshed orders reach the server
  useEffect(() => {
    if (!user || localUserOrders.length === 0) return;
    
    const syncPendingOrders = async () => {
      for (const order of localUserOrders) {
        if (userOrders.some(o => o.id === order.id)) continue;
        try {
          await setDoc(doc(db, "orders", order.id), order, { merge: true });
        } catch (e) {
          console.warn("Background sync deferred:", e);
        }
      }
    };
    
    const timeoutId = setTimeout(syncPendingOrders, 3000);
    return () => clearTimeout(timeoutId);
  }, [user, localUserOrders, userOrders]);

  const handleOrderPlaced = (newOrder: Order) => {
    setLocalUserOrders((prev) => {
      if (prev.some((o) => o.id === newOrder.id)) return prev;
      const updated = [newOrder, ...prev];
      window.localStorage.setItem('simplysip_local_orders', JSON.stringify(updated));
      return updated;
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

  // --- NATIVE MOBILE "BACK BUTTON" INTERCEPTORS ---
  useEffect(() => {
    if (isAdminOpen) {
      window.history.pushState({ modal: 'admin' }, '');
      const handlePopState = () => setIsAdminOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'admin') window.history.back();
      };
    }
  }, [isAdminOpen]);

  useEffect(() => {
    if (isCheckoutOpen) {
      window.history.pushState({ modal: 'checkout' }, '');
      const handlePopState = () => setIsCheckoutOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'checkout') window.history.back();
      };
    }
  }, [isCheckoutOpen]);

  useEffect(() => {
    if (isProfileOpen) {
      window.history.pushState({ modal: 'profile' }, '');
      const handlePopState = () => setIsProfileOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'profile') window.history.back();
      };
    }
  }, [isProfileOpen]);

  useEffect(() => {
    if (isAuthOpen) {
      window.history.pushState({ modal: 'auth' }, '');
      const handlePopState = () => setIsAuthOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'auth') window.history.back();
      };
    }
  }, [isAuthOpen]);

  const displayOrders = useMemo(() => Array.from(
    new Map([...localUserOrders, ...userOrders].map((o) => [o.id, o])).values()
  ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [localUserOrders, userOrders]);

  return (
    <div className="relative min-h-screen bg-[#FBFAF7] selection:bg-[#1D1C1A] selection:text-white">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="global-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[200] bg-[#FBFAF7] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <div className="flex items-baseline mb-8 relative pb-4">
                <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[0.38em] text-[#1D1C1A] font-display uppercase">
                  SIMPLYSIP
                </div>
                <span className="ml-2 sm:ml-3 text-2xl sm:text-3xl md:text-4xl text-[#1D1C1A] font-script font-semibold tracking-[0.08em] uppercase">
                  ELIXIRS
                </span>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                  className="absolute bottom-0 left-0 h-px bg-black/10"
                />
              </div>
              <div className="text-[9px] uppercase tracking-[0.4em] text-gray-400 mb-8 font-semibold">
                Curating your experience
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#1D1C1A]"
                    animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isAdminOpen ? (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <AdminDashboard onBack={() => setIsAdminOpen(false)} isAdminUser={isAdmin} />
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
              adminPendingCount={adminPendingCount}
              onAdminOpen={() => setIsAdminOpen(true)}
              onProfileToggle={() => setIsProfileOpen(true)}
            />
            <Hero onSubscribe={() => {
              const el = document.getElementById('subscriptions');
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
            }} />
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
              cartTotal={combinedTotal}
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
                    setIsAdminOpen(true);
                  }}
                  className="transition-opacity ml-2 font-bold opacity-100 text-blue-600 underline"
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
