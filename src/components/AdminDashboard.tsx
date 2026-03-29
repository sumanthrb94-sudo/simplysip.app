import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trash2, Pencil, MessageCircle, CreditCard, X, MapPin, Phone, User, Clock, Truck, FileText, Banknote, Users, Package, Star, Calendar, TrendingUp, ChevronDown, RotateCcw, CheckSquare, Square, Upload, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { collection, onSnapshot, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getIdToken } from 'firebase/auth';
import { auth, db, storage } from '../firebaseConfig';
import { seedMenu } from '../data/seedMenu';

type OrderFilter = "all" | "pending" | "paid" | "delivered" | "cancelled";

type OrderFormState = {
  orderStatus: string;
  paymentStatus: string;
  deliverySlot: string;
  assignedRider: string;
  notes: string;
};

const mergeOrders = (dbOrders: any[], mockOrders: any[]) => {
  const seen = new Set<string>();
  const merged: any[] = [];
  dbOrders.forEach((order) => {
    if (!order?.id || seen.has(order.id)) return;
    seen.add(order.id);
    merged.push(order);
  });
  mockOrders.forEach((order) => {
    if (!order?.id || seen.has(order.id)) return;
    seen.add(order.id);
    merged.push(order);
  });
  return merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

const normalizeTimestamp = (value: any) => {
  if (!value) return null;
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      return asNum < 1e12 ? asNum * 1000 : asNum;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const getPaymentSource = (paymentId: string | null | undefined) => {
  if (paymentId?.includes('whatsapp')) return 'whatsapp';
  if (paymentId?.includes('cod')) return 'cod';
  return 'razorpay';
};

// Generates a pleasant "Ding-Ding" chime using the native Web Audio API
let audioCtx: AudioContext | null = null;
const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx!.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playNote(523.25, audioCtx.currentTime, 0.1);       // C5 note
    playNote(659.25, audioCtx.currentTime + 0.15, 0.2); // E5 note
  } catch (e) {
    console.warn('Audio notification failed:', e);
  }
};

export default function AdminDashboard({ onBack, isAdminUser }: { onBack: () => void, isAdminUser?: boolean }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(isAdminUser ?? null);

  // Ensure the UI always starts from the top of the page when opening the admin dashboard.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [items, setItems] = useState<any[]>(
    seedMenu.map((item, index) => ({ id: `seed-${index + 1}`, ...item }))
  );

  const subItems = useMemo(() => items.filter(i => i.category === 'Subscriptions'), [items]);
  const regItems = useMemo(() => items.filter(i => i.category !== 'Subscriptions'), [items]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [upcomingOrders, setUpcomingOrders] = useState(0);
  const [subscribers, setSubscribers] = useState(0);
  const [userCountError, setUserCountError] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [localMockOrders, setLocalMockOrders] = useState<any[]>([]);
  const [toastOrder, setToastOrder] = useState<any | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderFormState>({
    orderStatus: "pending",
    paymentStatus: "unpaid",
    deliverySlot: "",
    assignedRider: "",
    notes: ""
  });
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>(() => {
    const saved = sessionStorage.getItem('simplysip_admin_tab');
    return (saved === 'menu' || saved === 'analytics') ? saved : 'orders';
  });
  const handleTabChange = (tab: 'orders' | 'menu' | 'analytics') => {
    sessionStorage.setItem('simplysip_admin_tab', tab);
    setActiveTab(tab);
  };
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [orderFilter, activeTab]);
  const hasLoadedOrders = useRef(false);
  const dashboardOpenedAt = useRef(Date.now());

  useEffect(() => {
    if (isAdminUser) {
      setIsAuthorized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setIsAuthorized(false);
        return;
      }

      // Check Firestore for admin role with email-based fallback
      const email = currentUser.email?.toLowerCase().trim() || "";
      const isEmailAdmin = email === "sumanthbolla97@gmail.com";
      
      if (isEmailAdmin) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(null); // show loading while checking
        getDoc(doc(db, "admins", currentUser.uid))
          .then((snap) => setIsAuthorized(snap.exists()))
          .catch(() => setIsAuthorized(false));
      }
    });

    return () => unsubscribe();
  }, [isAdminUser]);

  const seenOrderIds = useRef<Set<string>>(new Set());
  const hasAutoSeeded = useRef(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);
  const [activeMockKeys, setActiveMockKeys] = useState<Set<"A" | "B" | "C" | "D">>(new Set());
  const mockUnlockRef = useRef<Record<string, number>>({});
  const [testOrderError, setTestOrderError] = useState<string | null>(null);
  const rupee = "\u20B9";
  const bullet = "\u2022";
  const displayOrders = mergeOrders(orders, localMockOrders);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  // Form state
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<string>("Signature Blends");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [mrp, setMrp] = useState('150');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [offerPrice, setOfferPrice] = useState('120');
  const [image, setImage] = useState('');
  const [inStock, setInStock] = useState(true);
  const [inventory, setInventory] = useState('100');
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [deletingMenuItem, setDeletingMenuItem] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuSaveToast, setMenuSaveToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const showMenuToast = (type: 'success' | 'error', msg: string) => {
    setMenuSaveToast({ type, msg });
    setTimeout(() => setMenuSaveToast(null), 4000);
  };



  // Auto-calculate offerPrice when MRP or Discount changes
  useEffect(() => {
    const m = Number(mrp);
    const d = Number(discountPercent);
    if (m > 0) {
      const calculated = Math.round(m * (1 - d / 100));
      setOfferPrice(String(calculated));
    }
  }, [mrp, discountPercent]);
  
  // Helper to compress images before upload (client-side)
  const compressImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<Blob | File> => {
    return new Promise((resolve) => {
      // Hard timeout of 10s for compression to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn("ADMIN: Compression timed out. Using original file.");
        resolve(file);
      }, 10000);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }

          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              if (blob) {
                console.log(`ADMIN: Compression successful. Size reduced from ${file.size} to ${blob.size}`);
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                resolve(file); 
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          clearTimeout(timeout);
          console.warn("ADMIN: Image loading failed for compression. Fallback to original.");
          resolve(file);
        };
      };
      reader.onerror = () => {
        clearTimeout(timeout);
        console.warn("ADMIN: FileReader failed. Fallback to original.");
        resolve(file);
      };
    });
  };

  const uploadCancelledRef = useRef(false);

  const cancelUpload = () => {
    uploadCancelledRef.current = true;
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;
    e.target.value = '';

    if (!originalFile.type.startsWith('image/')) {
      setUploadError('Invalid file type. Please select an image.');
      return;
    }

    uploadCancelledRef.current = false;
    setUploadError(null);
    setShowUrlFallback(false);
    setIsUploading(true);
    setUploadProgress(0);

    // Compress before upload
    let fileToUpload: Blob | File = originalFile;
    try {
      if (originalFile.type !== 'image/gif') {
        fileToUpload = await compressImage(originalFile);
      }
    } catch { /* skip compression, use original */ }

    if (uploadCancelledRef.current) return;

    try {
      // Get Firebase auth token for the server endpoint
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated. Please sign in again.');
      const idToken = await getIdToken(currentUser);

      // Build multipart form data
      const formData = new FormData();
      formData.append('image', fileToUpload, originalFile.name);

      // POST to our server — same origin, CORS-free
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      if (uploadCancelledRef.current) return;

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);

      setImage(data.url);
      setUploadProgress(100);
      setTimeout(() => setIsUploading(false), 400);
      console.log('ADMIN: Upload complete:', data.url);
    } catch (err: any) {
      if (uploadCancelledRef.current) return;
      console.error('ADMIN: Upload failed:', err);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError(err.message || 'Upload failed.');
      setShowUrlFallback(true);
    }
  };

  const handleSeedMenu = async () => {
    // Check if we already have subscriptions to avoid duplicates
    const hasWeekly = items.some(i => i.id === "sub_weekly");
    const hasMonthly = items.some(i => i.id === "sub_monthly");
    setIsSeeding(true);
    
    // Core shop subscription products
    const initialSubscriptions = [
      { 
        id: "sub_weekly", 
        name: "Weekly Subscription", 
        mrp: 999, 
        offerPrice: 799,
        category: "Subscriptions",
        image: "/images/hero-lineup.png",
        desc: "1 cold-pressed juice (200 ml) delivered daily for 7 days"
      },
      { 
        id: "sub_monthly", 
        name: "Monthly Subscription", 
        mrp: 3599, 
        offerPrice: 2599,
        category: "Subscriptions",
        image: "/images/hero.jpeg",
        desc: "1 cold-pressed juice (200 ml) delivered daily for 30 days"
      }
    ];

    try {
      const batch = writeBatch(db);
      
      // Seed regular products only if catalog is empty
      if (items.length === 0) {
        seedMenu.forEach((item) => {
          const newRef = doc(collection(db, "menu"));
          batch.set(newRef, { ...item, createdAt: Date.now() });
        });
      }

      // Seed core subscription products if missing
      initialSubscriptions.forEach((sub) => {
        if (sub.id === "sub_weekly" && hasWeekly) return;
        if (sub.id === "sub_monthly" && hasMonthly) return;
        const subRef = doc(db, "menu", sub.id);
        batch.set(subRef, { ...sub, createdAt: Date.now() });
      });

      await batch.commit();
      console.log("ADMIN: Seeded subscriptions successfully.");
    } catch (err) {
      console.error("Failed to seed menu:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const menuRef = collection(db, "menu");
    const unsubscribeMenu = onSnapshot(
      menuRef,
      (snapshot) => {
        console.log("ADMIN: Menu snapshot received, docs count:", snapshot.size);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Only fallback to seedMenu if NO data exists in Firestore "menu" collection
        if (data.length > 0) {
           setItems(data);
        } else {
           setItems(seedMenu.map((item, index) => ({ id: `seed-${index + 1}`, ...item })));
        }
        setMenuError(null);
        setLoading(false);
        const hasSubscriptions = data.some(i => i.id === "sub_weekly" || i.id === "sub_monthly");
        if ((data.length === 0 || !hasSubscriptions) && !hasAutoSeeded.current) {
          hasAutoSeeded.current = true;
          handleSeedMenu();
        }
      },
      (err) => {
        console.error("Failed to load menu:", err);
        setMenuError("Menu failed to load. Check database rules.");
        setLoading(false);
      }
    );

    const ordersRef = collection(db, "orders");
    const unsubscribeOrders = onSnapshot(
      ordersRef,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
          const aTime = normalizeTimestamp(a.createdAt ?? a.updatedAt) || 0;
          const bTime = normalizeTimestamp(b.createdAt ?? b.updatedAt) || 0;
          return bTime - aTime;
        });
        setOrders(data);
        const ids = new Set(data.map((order: any) => order.id).filter(Boolean));
        setLocalMockOrders((prev) => prev.filter((order) => !ids.has(order.id)));
        if (hasLoadedOrders.current) {
          const newOrder = data.find((order: any) => {
            if (seenOrderIds.current.has(order.id)) return false;
            const createdAt = normalizeTimestamp(order.createdAt) || 0;
            // Only notify for genuinely live orders placed AFTER the dashboard was opened (with a 5s buffer for slight clock skew)
            return createdAt > (dashboardOpenedAt.current - 5000);
          });
          if (newOrder) {
            setToastOrder(newOrder);
            window.setTimeout(() => setToastOrder(null), 5000);
            playNotificationSound(); // Play sound when the toast shows
          }
        }
        seenOrderIds.current = new Set(data.map((o: any) => o.id));
        hasLoadedOrders.current = true;
      },
      (err) => {
        console.error("Failed to load orders:", err);
      }
    );

    const usersRef = collection(db, "users");
    const unsubscribeUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        setTotalUsers(snapshot.docs.length);
        setUserCountError(false);
        setStatsLoading(false);
      },
      (err) => {
        console.error("Failed to load users:", err);
        setUserCountError(true);
        setStatsLoading(false);
      }
    );

    return () => {
      unsubscribeMenu();
      unsubscribeOrders();
      unsubscribeUsers();
    };
  }, []);

  const refreshAll = async () => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (refreshIntervalRef.current) {
      window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setIsRefreshing(true);
    const refreshNow = async () => {
      try {
        const [menuSnap, ordersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "menu")),
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "users"))
        ]);
        const menuData = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const ordersData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
          const aTime = normalizeTimestamp(a.createdAt ?? a.updatedAt) || 0;
          const bTime = normalizeTimestamp(b.createdAt ?? b.updatedAt) || 0;
          return bTime - aTime;
        });
        setItems(menuData.length > 0 ? menuData : seedMenu.map((item, index) => ({ id: `seed-${index + 1}`, ...item })));
        setOrders(ordersData);
        setTotalUsers(usersSnap.docs.length);
      } catch (err) {
        console.error("Manual refresh failed:", err);
      }
    };

    await refreshNow();
    refreshIntervalRef.current = window.setInterval(refreshNow, 1000);
    refreshTimeoutRef.current = window.setTimeout(() => {
      if (refreshIntervalRef.current) {
        window.clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 3000);
  };

  const createMockOrder = async (key: "A" | "B" | "C" | "D") => {
    const lockToken = Date.now();
    mockUnlockRef.current[key] = lockToken;
    setActiveMockKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setTestOrderError(null);
    try {
      const baseTime = Date.now();
      const mockOrders: Record<"A" | "B" | "C" | "D", any> = {
        A: {
          userId: "test-user-1",
          userEmail: "test1@example.com",
          items: [
            { id: "1", name: "Hulk Greens", qty: 1, price: 129 },
            { id: "9", name: "Golden Sunrise", qty: 2, price: 119 }
          ],
          subtotal: 367,
          deliveryFee: 0,
          total: 367,
          paymentStatus: "unpaid",
          orderStatus: "pending",
          deliverySlot: "Today 6-8 PM",
          assignedRider: "Ravi",
          notes: "Mock order for testing",
          address: {
            name: "Test Customer One",
            phone: "9999999991",
            area: "Sainikpuri",
            address: "H.No 12-34, Street 5",
            addressType: "Home"
          },
          location: "Lat 17.438, Lng 78.498",
          locationAccuracy: 25,
          createdAt: baseTime
        },
        B: {
          userId: "test-user-2",
          userEmail: "test2@example.com",
          items: [
            { id: "3", name: "ABC", qty: 1, price: 119 },
            { id: "12", name: "Velvet Vine", qty: 1, price: 129 }
          ],
          subtotal: 248,
          deliveryFee: 30,
          total: 278,
          paymentStatus: "paid",
          orderStatus: "paid",
          deliverySlot: "Tomorrow 7-9 AM",
          assignedRider: "Kiran",
          notes: "Mock order for testing",
          address: {
            name: "Test Customer Two",
            phone: "9999999992",
            area: "Kompally",
            address: "Plot 45, Green View",
            addressType: "Office"
          },
          location: "Lat 17.505, Lng 78.503",
          locationAccuracy: 40,
          createdAt: baseTime + 200
        },
        C: {
          userId: "test-user-3",
          userEmail: "test3@example.com",
          items: [
            { id: "sub_weekly", name: "Weekly Subscription", qty: 1, price: 699 }
          ],
          subtotal: 699,
          deliveryFee: 0,
          total: 699,
          subscriptionType: "weekly",
          paymentStatus: "paid",
          orderStatus: "delivered",
          deliverySlot: "Today 6-7 PM",
          assignedRider: "Zoya",
          notes: "Mock order for testing",
          address: {
            name: "Test Customer Three",
            phone: "9999999993",
            area: "Marredpally",
            address: "12/7, Palm Street",
            addressType: "Home"
          },
          location: "Lat 17.445, Lng 78.508",
          locationAccuracy: 18,
          createdAt: baseTime + 400
        },
        D: {
          userId: "test-user-4",
          userEmail: "test4@example.com",
          items: [
            { id: "7", name: "Coco Fresh", qty: 2, price: 129 },
            { id: "15", name: "Garden Joy", qty: 1, price: 109 }
          ],
          subtotal: 367,
          deliveryFee: 0,
          total: 367,
          paymentStatus: "unpaid",
          orderStatus: "cancelled",
          deliverySlot: "Today 8-10 PM",
          assignedRider: "Manoj",
          notes: "Mock order for testing",
          address: {
            name: "Test Customer Four",
            phone: "9999999994",
            area: "Alwal",
            address: "45/A, Lake Road",
            addressType: "Other"
          },
          location: "Lat 17.494, Lng 78.532",
          locationAccuracy: 32,
          createdAt: baseTime + 600
        }
      };
      const payload = mockOrders[key];
      const newRef = doc(collection(db, "orders"));
      setLocalMockOrders((prev) => {
        const next = [{ id: newRef.id, ...payload }, ...prev];
        const seen = new Set<string>();
        return next.filter((order) => {
          if (!order || !order.id) return false;
          if (seen.has(order.id)) return false;
          seen.add(order.id);
          return true;
        });
      });
      await setDoc(newRef, payload);
    } catch (err) {
      console.error("Failed to create test order:", err);
      setTestOrderError(err instanceof Error ? err.message : "Failed to create test order.");
    } finally {
      window.setTimeout(() => {
        if (mockUnlockRef.current[key] === lockToken) {
          setActiveMockKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, 400);
    }
  };

  useEffect(() => {
    setUpcomingOrders(
      displayOrders.filter((order: any) => {
        const status = order.orderStatus || order.status || "pending";
        return status !== "delivered" && status !== "cancelled";
      }).length
    );
    const subscriberIds = new Set<string>();
    displayOrders.forEach((order: any) => {
      const isPaid = (order.paymentStatus || "") === "paid";
      const hasSubscription =
        Boolean(order.subscriptionType) ||
        (Array.isArray(order.items) && order.items.some((item: any) => item.id === "sub_weekly" || item.id === "sub_monthly"));
      const isCancelled = (order.orderStatus || order.status || "") === "cancelled";
      if (isPaid && hasSubscription && !isCancelled) {
        const identity = order.userId || order.userEmail || order.id;
        subscriberIds.add(identity);
      }
    });
    setSubscribers(subscriberIds.size);
    if (userCountError) {
      const uniqueUsers = new Set(displayOrders.map((order: any) => order.userId).filter(Boolean));
      setTotalUsers(uniqueUsers.size);
    }
  }, [orders, localMockOrders, userCountError]);

  const dailyStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    displayOrders.forEach((order: any) => {
      const timestamp = normalizeTimestamp(order.createdAt ?? order.updatedAt);
      if (!timestamp) return;
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!map[key]) {
        map[key] = { count: 0, revenue: 0 };
      }
      map[key].count += 1;
      const total = Number(order.total ?? 0);
      map[key].revenue += Number.isFinite(total) ? total : 0;
    });
    return map;
  }, [displayOrders]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    Object.keys(dailyStats).forEach((key) => {
      const year = Number(key.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    });
    if (years.size === 0) years.add(now.getFullYear());
    return Array.from(years).sort((a, b) => a - b);
  }, [dailyStats, now]);

  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedDay > daysInSelectedMonth) {
      setSelectedDay(daysInSelectedMonth);
    }
  }, [daysInSelectedMonth, selectedDay]);

  const selectedDateKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  const selectedStats = dailyStats[selectedDateKey] || { count: 0, revenue: 0 };

  useEffect(() => {
    if (!selectedOrder) return;
    setOrderForm({
      orderStatus: selectedOrder.orderStatus || selectedOrder.status || "pending",
      paymentStatus: selectedOrder.paymentStatus || "unpaid",
      deliverySlot: selectedOrder.deliverySlot || "",
      assignedRider: selectedOrder.assignedRider || "",
      notes: selectedOrder.notes || ""
    });
  }, [selectedOrder]);

  // Intercept hardware back button for the order modal
  useEffect(() => {
    if (selectedOrder) {
      window.history.pushState({ modal: 'order' }, '');
      const handlePopState = () => setSelectedOrder(null);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [!!selectedOrder]);

  const saveOrderUpdates = async () => {
    if (!selectedOrder) return;
    setIsSavingOrder(true);
    try {
      const payload = {
        orderStatus: orderForm.orderStatus,
        paymentStatus: orderForm.paymentStatus,
        deliverySlot: orderForm.deliverySlot,
        assignedRider: orderForm.assignedRider,
        notes: orderForm.notes,
        updatedAt: Date.now()
      };
      await updateDoc(doc(db, "orders", selectedOrder.id), payload);
      setLocalMockOrders((prev) =>
        prev.map((order) => (order.id === selectedOrder.id ? { ...order, ...payload } : order))
      );
      setSelectedOrder(null);
    } catch (err) {
      console.error("Failed to update order:", err);
      alert(`Failed to update order: ${(err as Error).message}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedOrderIds.size === 0) return;
    const actionName = newStatus === 'out-for-delivery' ? 'dispatch' : newStatus;
    const isConfirmed = window.confirm(`Are you sure you want to mark ${selectedOrderIds.size} orders as '${actionName}'?`);
    if (!isConfirmed) return;

    setIsSavingOrder(true);
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => {
        const orderRef = doc(db, "orders", id);
        batch.update(orderRef, { orderStatus: newStatus, updatedAt: Date.now() });
      });
      await batch.commit(); 

      setLocalMockOrders((prev) =>
        prev.map((order) => (selectedOrderIds.has(order.id) ? { ...order, orderStatus: newStatus, updatedAt: Date.now() } : order))
      );
      setSelectedOrderIds(new Set());
    } catch (err: any) {
      console.error("Bulk update failed:", err);
      alert(`Failed to bulk update orders: ${err.message}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return;
    const isConfirmed = window.confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedOrderIds.size} orders? This action cannot be undone.`);
    if (!isConfirmed) return;

    setIsSavingOrder(true);
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => {
        const orderRef = doc(db, "orders", id);
        batch.delete(orderRef);
      });
      await batch.commit();

      setLocalMockOrders((prev) => prev.filter((order) => !selectedOrderIds.has(order.id)));
      setSelectedOrderIds(new Set());
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      alert(`Failed to bulk delete orders: ${err.message}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const mrpNum = Number(mrp);
    const offerPriceNum = Number(offerPrice);

    // Inline validation — no blocking alert()
    if (!name.trim()) {
      showMenuToast('error', 'Product Name is required.');
      return;
    }
    if (!desc.trim()) {
      showMenuToast('error', 'Description is required.');
      return;
    }
    if (mrpNum <= 0 || offerPriceNum <= 0) {
      showMenuToast('error', 'MRP and Offer Price must be positive.');
      return;
    }
    if (offerPriceNum > mrpNum) {
      showMenuToast('error', 'Offer Price cannot exceed MRP.');
      return;
    }

    const payload = {
      name: name.trim(),
      desc: desc.trim(),
      image,
      category,
      mrp: mrpNum,
      discountPercent: Number(discountPercent),
      offerPrice: offerPriceNum,
      price: offerPriceNum,
      inStock: Boolean(inStock),
      inventory: Number(inventory),
      updatedAt: Date.now()
    };

    try {
      if (editingMenuId) {
        await updateDoc(doc(db, 'menu', editingMenuId), payload);
        showMenuToast('success', `"${payload.name}" updated and live on menu!`);
      } else {
        await addDoc(collection(db, 'menu'), { ...payload, createdAt: Date.now() });
        showMenuToast('success', `"${payload.name}" is now live on the menu!`);
      }
      resetMenuForm();
      // Scroll catalog into view so admin sees the product appear in real-time
      setTimeout(() => {
        catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err: any) {
      console.error('CRITICAL: Failed to save menu item:', err);
      showMenuToast('error', err.message || 'Save failed. Check database rules.');
    }
  };

  const resetMenuForm = () => {
    setEditingMenuId(null);
    setName('');
    setDesc('');
    setMrp('150');
    setDiscountPercent('20');
    setOfferPrice('120');
    setImage('');
    setCategory("Signature Blends");
    setInStock(true);
    setInventory('100');
    setUploadError(null);
    setShowUrlFallback(false);
    setIsUploading(false);
    setUploadProgress(0);
    uploadCancelledRef.current = false;
  };

  const handleEditClick = (item: any) => {
    setName(item.name || '');
    setDesc(item.desc || '');
    setCategory(item.category || 'Signature Blends');
    setMrp(String(item.mrp || '150'));
    setDiscountPercent(String(item.discountPercent || '0'));
    setOfferPrice(String(item.offerPrice ?? item.price ?? '119'));
    setImage(item.image || '');
    setInStock(item.inStock !== false); // Default to true if undefined
    setInventory(String(item.inventory ?? '100'));
    setEditingMenuId(item.id);
    setUploadError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setShowUrlFallback(false);
    uploadCancelledRef.current = false;
    
    // Only scroll to top for regular products, not subscriptions
    if (item.category !== 'Subscriptions') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleArchiveMenu = async (id: string, isArchived: boolean) => {
    if (!isArchived && !deletingMenuItem && !window.confirm("Are you sure you want to archive this item? It will be hidden from the public menu.")) return;
    try {
      await updateDoc(doc(db, "menu", id), { isArchived: !isArchived, updatedAt: Date.now() });
      setDeletingMenuItem(null);
    } catch (err: any) {
      console.error("Failed to update menu item state:", err);
      alert(`Failed to update item: ${err.message || 'Check database rules.'}`);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY DELETE this product? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "menu", id));
      setDeletingMenuItem(null);
      showMenuToast('success', 'Product permanently removed from database.');
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      alert(`Failed to delete product: ${err.message || 'Check database rules.'}`);
    }
  };

  const handleRestoreStock = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, "menu", id), { inStock: true, inventory: 100, updatedAt: Date.now() });
      showMenuToast('success', `"${name}" is back in stock!`);
    } catch (err: any) {
      console.error("Failed to restore stock:", err);
      showMenuToast('error', `Failed to restore ${name}`);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, "orders", id));
    } catch (err: any) {
      console.error("Failed to delete order:", err);
      alert(`Failed to delete order: ${err.message || 'Check database rules.'}`);
    } finally {
      setLocalMockOrders((prev) => prev.filter((order) => order.id !== id));
    }
  };

  const filteredOrders = useMemo(() => {
    return displayOrders
      .filter((order) => {
        if (orderFilter === "all") return true;
        if (orderFilter === "paid") return (order.paymentStatus || "") === "paid";
        return (order.orderStatus || order.status || "pending") === orderFilter;
      })
      .slice(0, 50);
  }, [displayOrders, orderFilter]);

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-12 bg-[#F5F5F7]">
        <div className="max-w-md bg-white rounded-3xl p-10 shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-sm text-gray-600">You do not have permission to view the admin dashboard. Please log in with an admin account.</p>
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-mono text-left break-all">
            <div>Email: {auth.currentUser?.email || "Not provided (Phone auth?)"}</div>
            <div>UID: {auth.currentUser?.uid}</div>
          </div>
          <button
            onClick={onBack}
            className="mt-3 w-full px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-full font-semibold transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-12 bg-[#F5F5F7]">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-black/10 border-t-black rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const pendingOrdersCount = displayOrders.filter(o => (o.orderStatus || o.status || 'pending') === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 sm:pb-0">
      {/* Minimal Top App Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between h-auto sm:h-16 py-3 sm:py-0 gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-base font-bold tracking-tight">Ops Dashboard</h1>
            </div>
            
            {/* Segmented Control Tabs */}
            <div className="flex p-1 bg-gray-100/80 rounded-lg overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0">
              {(['orders', 'menu', 'analytics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 sm:flex-none min-w-[90px] px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                  {tab === 'orders' && pendingOrdersCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] bg-red-500 text-white rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Toast Notification */}
        {toastOrder && (
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => { setActiveTab('orders'); setSelectedOrder(toastOrder); }}
            className="fixed top-20 sm:top-24 right-4 z-[90] bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 text-left flex items-center gap-4 hover:bg-black transition-colors border border-gray-700"
          >
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <Banknote size={20} className="text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-300 font-medium">New Order Arrived</div>
              <div className="text-sm font-bold text-white">{toastOrder?.address?.name || "Customer"} \u2022 {rupee}{toastOrder?.total}</div>
            </div>
          </motion.button>
        )}

        {activeTab === 'analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* 6-KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Total Revenue', value: rupee + Math.round(displayOrders.filter(o=>(o.paymentStatus||'')==='paid').reduce((s,o)=>s+Number(o.total||0),0)).toLocaleString('en-IN'), sub: 'all-time paid', color: 'emerald' },
                { label: 'Total Orders', value: displayOrders.length, sub: displayOrders.filter(o=>(o.orderStatus||o.status||'')!=='cancelled').length+' active', color: 'blue' },
                { label: 'Avg Order Value', value: rupee+(displayOrders.length?Math.round(displayOrders.reduce((s,o)=>s+Number(o.total||0),0)/displayOrders.length):0), sub: 'across all orders', color: 'violet' },
                { label: 'Paid Rate', value: displayOrders.length?Math.round(displayOrders.filter(o=>(o.paymentStatus||'')==='paid').length/displayOrders.length*100)+'%':'\u2014', sub: 'conversion rate', color: 'amber' },
                { label: 'Active Subs', value: subscribers, sub: 'paying subscribers', color: 'pink' },
                { label: 'Users', value: statsLoading?'\u2026':totalUsers, sub: 'registered accounts', color: 'gray' },
              ].map(({label,value,sub,color})=>(
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 text-${color}-500`}>{label}</div>
                  <div className="text-2xl font-extrabold text-gray-900 font-mono tabular-nums">{value}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            {/* 30-Day Revenue Bar Chart */}
            {(()=>{
              const days=Array.from({length:30},(_,i)=>{
                const d=new Date();d.setDate(d.getDate()-(29-i));
                const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return{key,date:d,rev:dailyStats[key]?.revenue||0,cnt:dailyStats[key]?.count||0};
              });
              const maxRev=Math.max(...days.map(d=>d.rev),1);
              return(
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-900">30-Day Revenue</h2>
                    <span className="text-xs text-gray-400">{rupee}{Math.round(days.reduce((s,d)=>s+d.rev,0)).toLocaleString('en-IN')} total</span>
                  </div>
                  <div className="flex items-end gap-px h-20">
                    {days.map((d,i)=>(
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group" title={`${d.date.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}: ${rupee}${Math.round(d.rev)}, ${d.cnt} orders`}>
                        <div className="w-full bg-emerald-500 group-hover:bg-emerald-400 rounded-sm transition-colors" style={{height:`${Math.max(d.rev/maxRev*100,d.rev>0?4:1)}%`,minHeight:'2px'}}/>
                        {i%6===0&&<div className="text-[7px] text-gray-300 mt-0.5 font-mono">{d.date.getDate()}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Top Products + Daily Picker */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 mb-3">Top Products by Revenue</h2>
                {(()=>{
                  const map:Record<string,{name:string;rev:number;qty:number}>={}
                  displayOrders.forEach(order=>{
                    if(!Array.isArray(order.items))return;
                    order.items.forEach((item:any)=>{
                      const k=item.name||item.id;
                      if(!map[k])map[k]={name:item.name||item.id,rev:0,qty:0};
                      map[k].rev+=Number(item.price||0)*Number(item.qty||1);
                      map[k].qty+=Number(item.qty||1);
                    });
                  });
                  const top=Object.values(map).sort((a,b)=>b.rev-a.rev).slice(0,5);
                  const maxR=Math.max(...top.map(t=>t.rev),1);
                  return top.length===0?<p className="text-xs text-gray-400">No order data yet.</p>:(
                    <div className="space-y-2.5">
                      {top.map((t,i)=>(
                        <div key={t.name} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-300 w-3">{i+1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs font-medium mb-1">
                              <span className="truncate max-w-[140px] text-gray-700">{t.name}</span>
                              <span className="font-mono font-bold text-gray-900">{rupee}{Math.round(t.rev)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${t.rev/maxR*100}%`}}/></div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono w-8 text-right">\u00D7{t.qty}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Calendar size={13} className="text-gray-400"/>Daily Report</h2>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Day</label>
                    <select value={selectedDay} onChange={e=>setSelectedDay(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none font-medium bg-gray-50">
                      {Array.from({length:daysInSelectedMonth},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
                    </select></div>
                  <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Month</label>
                    <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none font-medium bg-gray-50">
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=><option key={m} value={i}>{m}</option>)}
                    </select></div>
                  <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Year</label>
                    <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none font-medium bg-gray-50">
                      {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100"><div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Orders</div><div className="text-2xl font-extrabold text-gray-900">{selectedStats.count}</div></div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100"><div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Revenue</div><div className="text-2xl font-extrabold text-emerald-700">{rupee}{Math.round(selectedStats.revenue).toLocaleString('en-IN')}</div></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Toolbar */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input type="text" placeholder="Search name, area, order ID\u2026" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 font-medium"/>
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  {orderSearch&&<button onClick={()=>setOrderSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-700"><X size={12}/></button>}
                </div>
                <button onClick={()=>{if(selectedOrderIds.size===filteredOrders.length&&filteredOrders.length>0)setSelectedOrderIds(new Set());else setSelectedOrderIds(new Set(filteredOrders.map(o=>o.id)));}} className="px-3 py-2 bg-white border border-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
                  {selectedOrderIds.size===filteredOrders.length&&filteredOrders.length>0?<CheckSquare size={13} className="text-gray-900"/>:<Square size={13}/>}
                  <span className="hidden sm:inline">All</span>
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {(['A','B','C','D'] as const).map(k=>(
                    <button key={k} onClick={()=>createMockOrder(k)} disabled={activeMockKeys.has(k)} className="w-6 h-6 rounded bg-gray-100 text-gray-500 text-[10px] font-bold hover:bg-gray-200 disabled:opacity-40">{k}</button>
                  ))}
                </div>
                <button onClick={refreshAll} disabled={isRefreshing} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50" title="Refresh">
                  <RotateCcw size={14} className={isRefreshing?'animate-spin text-gray-700':'text-gray-400'}/>
                </button>
              </div>
              {/* Status pills with live counts */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all','pending','paid','preparing','out-for-delivery','delivered','cancelled'] as const).map(s=>{
                  const cnt=s==='all'?displayOrders.length:displayOrders.filter(o=>(o.orderStatus||o.status||'pending')===s).length;
                  return(
                    <button key={s} onClick={()=>setOrderFilter(s as any)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                        orderFilter===s?'bg-gray-900 border-gray-900 text-white':'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}>
                      {s.replace(/-/g,' ')}
                      {cnt>0&&<span className={`text-[9px] font-extrabold ${orderFilter===s?'text-white/60':'text-gray-400'}`}>{cnt}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredOrders.length===0?(
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                <Package size={28} className="mx-auto text-gray-200 mb-2"/>
                <p className="text-gray-400 text-sm">{orderSearch?'No orders match your search.':'No orders here.'}</p>
              </div>
            ):(
              <div className="space-y-2 pb-28">
                {filteredOrders.map(order=>{
                  const status=order.orderStatus||order.status||'pending';
                  const source=getPaymentSource(order.paymentId);
                  const isSelected=selectedOrderIds.has(order.id);
                  const PIPE=['pending','preparing','out-for-delivery','delivered'];
                  const pIdx=PIPE.indexOf(status==='cancelled'?'pending':status);
                  const sBadge:Record<string,string>={pending:'bg-amber-50 text-amber-700 border-amber-200',preparing:'bg-blue-50 text-blue-700 border-blue-200','out-for-delivery':'bg-indigo-50 text-indigo-700 border-indigo-200',delivered:'bg-emerald-50 text-emerald-700 border-emerald-200',cancelled:'bg-red-50 text-red-600 border-red-100',paid:'bg-teal-50 text-teal-700 border-teal-200'};
                  return(
                    <div key={order.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${isSelected?'border-gray-900 ring-1 ring-gray-900':'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
                      <div className="flex items-stretch">
                        <button onClick={e=>{e.stopPropagation();setSelectedOrderIds(prev=>{const n=new Set(prev);n.has(order.id)?n.delete(order.id):n.add(order.id);return n;})}} className={`flex items-center justify-center px-3 border-r shrink-0 ${isSelected?'bg-gray-50 border-gray-900/20':'border-gray-100 hover:bg-gray-50'}`}>
                          {isSelected?<CheckSquare size={15} className="text-gray-900"/>:<Square size={15} className="text-gray-300"/>}
                        </button>
                        <button type="button" onClick={()=>setSelectedOrder(order)} className="flex-1 text-left px-4 py-3 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-bold text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${sBadge[status]||sBadge.pending}`}>{status.replace(/-/g,' ')}</span>
                            {source==='whatsapp'?<MessageCircle size={12} className="text-green-500"/>:source==='cod'?<Banknote size={12} className="text-orange-500"/>:<CreditCard size={12} className="text-blue-400"/>}
                            {order.paymentStatus==='paid'&&<span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">PAID</span>}
                          </div>
                          <div className="font-bold text-sm text-gray-900">{order.address?.name||'Customer'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{order.address?.area||'\u2014'} \u00B7 {order.deliverySlot||'No slot'} \u00B7 {order.items?.length||0} items</div>
                          {status!=='cancelled'&&(
                            <div className="flex items-center gap-1 mt-2">
                              {PIPE.map((step,i)=>(
                                <div key={step} className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${i<=pIdx?'bg-gray-900':'bg-gray-200'}`}/>
                                  {i<PIPE.length-1&&<div className={`w-4 h-px ${i<pIdx?'bg-gray-900':'bg-gray-200'}`}/>}
                                </div>
                              ))}
                              <span className="text-[9px] text-gray-400 ml-1 capitalize">{PIPE[pIdx]?.replace(/-/g,' ')}</span>
                            </div>
                          )}
                        </button>
                        <div className="shrink-0 px-4 flex flex-col items-end justify-center border-l border-gray-100">
                          <div className="text-sm font-extrabold text-gray-900 font-mono">{rupee}{order.total}</div>
                          <div className={`text-[9px] font-bold uppercase mt-0.5 ${order.paymentStatus==='paid'?'text-emerald-500':'text-amber-500'}`}>{order.paymentStatus||'unpaid'}</div>
                        </div>
                        <div className="shrink-0 flex flex-col border-l border-gray-100">
                          {status==='pending'&&<button onClick={e=>{e.stopPropagation();updateDoc(doc(db,'orders',order.id),{orderStatus:'preparing',updatedAt:Date.now()});}} className="flex-1 px-3 text-[10px] font-extrabold uppercase text-blue-600 hover:bg-blue-50 transition-colors">PREP</button>}
                          {(status==='preparing'||status==='paid')&&<button onClick={e=>{e.stopPropagation();updateDoc(doc(db,'orders',order.id),{orderStatus:'out-for-delivery',updatedAt:Date.now()});}} className="flex-1 px-3 text-[10px] font-extrabold uppercase text-indigo-600 hover:bg-indigo-50 transition-colors">SHIP</button>}
                          {status==='out-for-delivery'&&<button onClick={e=>{e.stopPropagation();updateDoc(doc(db,'orders',order.id),{orderStatus:'delivered',paymentStatus:'paid',updatedAt:Date.now()});}} className="flex-1 px-3 text-[10px] font-extrabold uppercase text-emerald-600 hover:bg-emerald-50 transition-colors">DONE</button>}
                          {status==='delivered'&&<div className="flex-1 px-3 flex items-center justify-center text-emerald-300"><Star size={11} fill="currentColor"/></div>}
                          <div className="h-px bg-gray-100"/>
                          <button onClick={()=>handleDeleteOrder(order.id)} className="px-3 py-2 text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"><Trash2 size={13}/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {selectedOrderIds.size>0&&activeTab==='orders'&&(
                <motion.div initial={{y:100,opacity:0,x:'-50%'}} animate={{y:0,opacity:1,x:'-50%'}} exit={{y:100,opacity:0,x:'-50%'}}
                  className="fixed bottom-6 left-1/2 z-[90] bg-gray-950 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-800 w-[95%] sm:w-auto">
                  <span className="bg-white text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold">{selectedOrderIds.size}</span>
                  <div className="h-4 w-px bg-gray-700"/>
                  <div className="flex gap-2">
                    {[{label:'Prepare',s:'preparing'},{label:'Dispatch',s:'out-for-delivery'},{label:'Deliver \u2713',s:'delivered'}].map(({label,s})=>(
                      <button key={s} onClick={()=>handleBulkStatusUpdate(s)} disabled={isSavingOrder}
                        className="px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all disabled:opacity-50">{label}</button>
                    ))}
                    <button onClick={handleBulkDelete} disabled={isSavingOrder}
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-red-900/50 hover:bg-red-800 border border-red-700/50 transition-all disabled:opacity-50 text-red-200">Delete</button>
                  </div>
                  <button onClick={()=>setSelectedOrderIds(new Set())} className="ml-1 text-gray-500 hover:text-white"><X size={14}/></button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Slide-over Drawer for Order Details */}
        {selectedOrder && (
          <>
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100]" 
            />
            {/* Side Drawer */}
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl z-[101] flex flex-col border-l border-gray-200"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Order Details</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">#{selectedOrder.id.slice(-6).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      orderForm.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {orderForm.paymentStatus}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white border border-gray-200 text-gray-500 rounded-md hover:bg-gray-100 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300">
                {/* Customer Card */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600"><User size={14} /></div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900">{selectedOrder.address?.name || "Customer"}</div>
                      <div className="text-xs text-gray-500 truncate">{selectedOrder.userEmail || "No email"}</div>
                    </div>
                    {selectedOrder.address?.phone && (
                      <a href={`https://wa.me/91${selectedOrder.address.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-green-100 transition-colors border border-green-200">
                        <MessageCircle size={12} /> Chat
                      </a>
                    )}
                  </div>
                  <div className="h-px bg-gray-200 w-full" />
                  <div className="text-sm text-gray-600 flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-gray-900 block">{selectedOrder.address?.area || "Area"}</span>
                      <span className="text-xs">{selectedOrder.address?.address || "-"}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <Phone size={14} className="shrink-0" />
                    <span className="font-medium text-gray-900">{selectedOrder.address?.phone || "-"}</span>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Order Items</h4>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {(selectedOrder.items || []).map((item: any, idx: number) => (
                      <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-3 bg-white">
                        <div className="flex items-center gap-3">
                          <span className="bg-gray-100 text-gray-900 text-xs font-bold px-2 py-1 rounded">x{item.qty}</span>
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{rupee}{item.price * item.qty}</span>
                      </div>
                    ))}
                    <div className="p-3 bg-gray-50 flex items-center justify-between font-bold text-gray-900">
                      <span>Total</span>
                      <span>{rupee}{selectedOrder.total}</span>
                    </div>
                  </div>
                </div>

                {/* Pipeline Controls */}
                <div>
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Update Status</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['pending', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setOrderForm(prev => ({ ...prev, orderStatus: status }))}
                        className={`px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all border ${
                          orderForm.orderStatus === status 
                            ? 'bg-gray-900 border-gray-900 text-white' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        } ${status === 'cancelled' ? 'col-span-2' : ''}`}
                      >
                        {status.replace(/-/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Delivery Slot</label>
                    <input value={orderForm.deliverySlot} onChange={(e) => setOrderForm(prev => ({ ...prev, deliverySlot: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="e.g. 6-8 PM" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Assign Rider</label>
                    <input value={orderForm.assignedRider} onChange={(e) => setOrderForm(prev => ({ ...prev, assignedRider: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="Rider Name" />
                  </div>
                </div>

                {/* Payment Override */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Status Override</label>
                  <div className="flex bg-gray-100 p-1 rounded-md border border-gray-200">
                    {['unpaid', 'paid', 'refunded'].map((status) => (
                      <button key={status} onClick={() => setOrderForm(prev => ({ ...prev, paymentStatus: status }))} className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded transition-all ${orderForm.paymentStatus === status ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Internal Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Notes</label>
                  <textarea value={orderForm.notes} onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none h-16" placeholder="Ops notes..." />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                <button onClick={saveOrderUpdates} disabled={isSavingOrder} className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors disabled:opacity-50">
                  {isSavingOrder ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {activeTab === 'menu' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Pro Product Editor Panel */}
            <div className="w-full lg:w-[420px] shrink-0">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-24">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 tracking-tight">{editingMenuId ? "Edit Product" : "New Product"}</h2>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{editingMenuId ? "Updating existing item" : "Create catalog entry"}</p>
                  </div>
                  {editingMenuId && (
                    <button onClick={resetMenuForm} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-all">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="p-6">
                  <form onSubmit={handleSaveMenu} className="space-y-6">
                    {/* Media Management Area */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">Product Media</label>
                      </div>
                      
                      <div className="relative group">
                        <div className={`aspect-square w-full rounded-2xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center transition-all ${
                          uploadError ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50 group-hover:border-gray-300 group-hover:bg-gray-100/50'
                        }`}>
                          {image ? (
                            <div className="relative w-full h-full">
                              <img src={image} alt="Preview" className="h-full w-full object-cover mix-blend-multiply" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white text-gray-900 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl transform scale-90 group-hover:scale-100 transition-all active:scale-95">Replace Media</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-4 text-gray-400 hover:text-gray-600 transition-all p-8 text-center group/btn">
                              <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center border border-gray-100 group-hover/btn:scale-110 group-hover/btn:rotate-3 transition-all">
                                <Upload size={24} className="group-hover/btn:text-indigo-500" />
                              </div>
                              <div className="space-y-1">
                                <span className="text-sm font-black text-gray-700 block">Select Product Shot</span>
                                <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">High Quality PNG/JPG up to 5MB</span>
                              </div>
                            </button>
                          )}
                          
                          {isUploading && (
                            <div className="absolute inset-0 bg-white/96 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                              <div className="relative mb-5">
                                {uploadProgress === 100 ? <CheckCircle2 size={40} className="text-emerald-500" /> : <Loader2 size={40} className="text-indigo-600 animate-spin" />}
                              </div>
                              <div className="space-y-2 w-full">
                                <div className="flex justify-between items-end mb-1">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{uploadProgress === 100 ? 'Complete!' : 'Uploading…'}</span>
                                  {uploadProgress === 100 && <span className="text-[11px] font-black font-mono text-emerald-600">100%</span>}
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                  {uploadProgress === 100 ? <div className="h-full w-full bg-emerald-500 rounded-full" /> : <div className="h-full rounded-full bg-indigo-400/40 relative overflow-hidden"><div className="absolute inset-y-0 w-1/2 bg-indigo-600 rounded-full" style={{ animation: 'shimmer-slide 1.4s ease-in-out infinite' }} /></div>}
                                </div>
                              </div>
                            </div>
                          )}

                          {uploadError && !isUploading && (
                            <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-6 text-center">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-red-100 mb-4 text-red-500"><X size={20} /></div>
                              <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest mb-1">Upload Interrupted</h4>
                              <p className="text-[10px] font-medium text-red-600/80 leading-relaxed mb-4">{uploadError}</p>
                              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">Retry</button>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                      </div>

                      {(showUrlFallback || image) && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                             <div className="h-px bg-gray-100 flex-1"></div>
                             <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">Image Reference (URL)</span>
                             <div className="h-px bg-gray-100 flex-1"></div>
                          </div>
                          <div className="relative">
                            <input value={image} onChange={e => {setImage(e.target.value); if(e.target.value) setUploadError(null);}} placeholder="https://external-cdn.com/product-shot.jpg" className={`w-full text-xs font-mono py-3 px-10 bg-white border rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all ${uploadError ? 'border-red-200' : 'border-gray-200 focus:border-indigo-400'}`} />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FileText size={14} /></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live Card Preview */}
                    <div className="pt-2 py-6 border-y border-gray-50">
                       <div className="flex items-center justify-between mb-6">
                          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">Live Card Preview</label>
                          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">Real-time Sync</span>
                       </div>
                       <div className="max-w-[220px] mx-auto scale-90 sm:scale-100 origin-top">
                          <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-2xl shadow-gray-200/50 relative">
                             <div className="relative aspect-[4/5] bg-gray-50">
                                {image ? <img src={image} alt="Preview" className="w-full h-full object-cover mix-blend-multiply transition-opacity duration-500" /> : <div className="w-full h-full flex items-center justify-center text-gray-100 bg-gray-50/50"><Package size={48} strokeWidth={1} /></div>}
                                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                                   <span className={`px-2 py-0.5 ${category === "Signature Blends" ? 'bg-black text-white' : 'bg-indigo-600 text-white'} text-[8px] font-black uppercase tracking-widest rounded shadow-sm w-fit`}>
                                      {category === "Signature Blends" ? "Blend" : "Pure"}
                                   </span>
                                </div>
                                {Number(discountPercent) > 0 && <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-lg">-{discountPercent}%</div>}
                             </div>
                             <div className="p-5 space-y-2">
                                {name && <h4 className="text-sm font-black text-gray-900 leading-tight line-clamp-1">{name}</h4>}
                                {desc && <p className="text-[11px] text-gray-400 font-medium line-clamp-1 leading-relaxed">{desc}</p>}
                                <div className="flex items-end justify-between pt-4 border-t border-gray-50">
                                   <div className="flex flex-col">
                                      {Number(mrp) > Number(offerPrice) && <span className="text-[10px] text-gray-300 line-through font-mono leading-none">{rupee}{mrp}</span>}
                                      <span className="text-xl font-black text-gray-900 font-mono tracking-tighter leading-none mt-1.5">{rupee}{offerPrice}</span>
                                   </div>
                                   <div className="w-8 h-8 rounded-full bg-gray-950 flex items-center justify-center text-white scale-90"><Plus size={14} /></div>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Product Identity</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Citrus Blast)" className="w-full text-sm font-bold py-2.5 px-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                      </div>
                      <div>
                        {isAddingCategory ? (
                          <div className="flex gap-2">
                             <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category Name..." className="flex-1 text-xs font-bold py-2.5 px-3 bg-white border border-indigo-200 rounded-xl" />
                             <button type="button" onClick={() => { if (newCategoryName.trim()) { setCategory(newCategoryName.trim()); setIsAddingCategory(false); setNewCategoryName(""); } else { setIsAddingCategory(false); } }} className="px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Set</button>
                             <button type="button" onClick={() => setIsAddingCategory(false)} className="p-2.5 bg-gray-100 text-gray-500 rounded-xl"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                             <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 text-xs font-bold py-2.5 px-3 bg-white border border-gray-200 rounded-xl">
                               {Array.from(new Set([...items.map(i => i.category), "Signature Blends", "Single Fruit Series", category])).filter(Boolean).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                             </select>
                             <button type="button" onClick={() => setIsAddingCategory(true)} className="p-2.5 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-lg"><Plus size={16} /></button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">MRP ({rupee})</label>
                          <input type="number" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full text-sm font-mono font-bold py-2 px-3 bg-white border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Discount %</label>
                          <div className="relative">
                            <input type="number" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="w-full text-sm font-mono font-bold py-2 px-3 bg-white border border-gray-200 rounded-lg pr-7" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Final Price</span>
                        <span className="text-xl font-black text-emerald-600 font-mono tracking-tighter">{rupee}{offerPrice}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">In Stock Status</label>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{inStock ? 'Available' : 'Sold Out'}</p>
                        </div>
                        <button type="button" onClick={() => setInStock(!inStock)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${inStock ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Inventory</label>
                        <input type="number" value={inventory} onChange={e => setInventory(e.target.value)} className="w-full text-sm font-mono font-bold py-2 px-3 bg-white border border-gray-200 rounded-lg" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</label>
                      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Product highlights..." rows={3} className="w-full text-xs font-medium py-2.5 px-3 bg-white border border-gray-200 rounded-xl resize-none" />
                    </div>

                    <button type="submit" disabled={isUploading} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2">
                      {isUploading ? <Loader2 className="animate-spin" size={16} /> : (editingMenuId ? <CheckCircle2 size={16} /> : <Package size={16} />)}
                      {editingMenuId ? "Commit Changes" : "Deploy to Catalog"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Catalog Grid View */}
            <div className="flex-1" ref={catalogRef}>
              {/* Save Toast */}
              <AnimatePresence>
                {menuSaveToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold shadow-sm ${
                      menuSaveToast.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {menuSaveToast.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <X size={16} className="shrink-0 text-red-500" />}
                    {menuSaveToast.msg}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <h2 className="text-lg font-bold text-gray-900">Live Catalog</h2>
                   <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-500 rounded-full border border-gray-200">{items.filter(i => !i.id.startsWith('sub_')).length} Items</span>
                   <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-600 rounded-full border border-emerald-100">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                     Real-time
                   </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={refreshAll} className={`p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>

              {/* Dedicated Subscription Plans Section */}
              {!loading && subItems.length > 0 && (
                <div className="mb-8 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl relative z-20">
                   <div className="flex items-center justify-between mb-5">
                      <div>
                         <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Subscription Plans</h3>
                         <p className="text-[10px] font-bold text-indigo-500/80 uppercase mt-0.5">Edit Weekly & Monthly prices here</p>
                      </div>
                      <div className="flex gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-200"></div>
                      </div>
                   </div>
                   <div className="flex flex-col gap-4">
                      {subItems.map(sub => {
                        const isEditingThis = editingMenuId === sub.id;
                        return (
                          <div key={sub.id} className={`bg-white border ${isEditingThis ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-indigo-200/50'} rounded-3xl transition-all shadow-sm hover:shadow-xl overflow-hidden relative z-30 group`}>
                             {/* Background Image Layer */}
                             <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                <img src={sub.image || "/images/subscription_premium.jpg"} alt="" className="w-full h-full object-cover" />
                             </div>
                             
                             <div className="relative z-10 p-5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                     <div className={`w-12 h-12 ${isEditingThis ? 'bg-indigo-900' : 'bg-indigo-600'} rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg transition-colors`}>
                                        {sub.image ? (
                                          <img src={sub.image} alt="" className="w-full h-full object-cover rounded-2xl" />
                                        ) : (
                                          <Star size={20} fill="currentColor" />
                                        )}
                                     </div>
                                     <div>
                                        <h4 className="text-base font-black text-gray-900">{sub.name}</h4>
                                        {!isEditingThis && (
                                          <div className="flex items-baseline gap-2 mt-0.5">
                                             <span className="text-sm font-mono font-bold text-indigo-600">{rupee}{sub.offerPrice}</span>
                                             {sub.mrp > sub.offerPrice && <span className="text-[10px] font-mono text-gray-400 line-through">{rupee}{sub.mrp}</span>}
                                          </div>
                                        )}
                                     </div>
                                  </div>
                                  <div className="flex gap-2">
                                     {isEditingThis ? (
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); resetMenuForm(); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                                     ) : (
                                        <div 
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(sub); }}
                                          className="px-5 py-2.5 bg-indigo-600 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xl shadow-indigo-100"
                                        >
                                          <Pencil size={12} /> Edit Plan
                                        </div>
                                     )}
                                  </div>
                                </div>

                                {/* Expandable Edit Bar */}
                                {isEditingThis && (
                                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-5 pt-5 border-t border-indigo-100/50 space-y-6">
                                      {/* Image Edit Section */}
                                      <div className="space-y-3">
                                        <label className="block text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em]">Update Plan Visual</label>
                                        <div className="flex items-center gap-4">
                                          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 overflow-hidden relative group/img">
                                            {image ? (
                                              <img src={image} alt="Preview" className="w-full h-full object-cover mix-blend-multiply" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center text-indigo-300">
                                                <Package size={24} />
                                              </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                              <Upload size={16} className="text-white" />
                                            </div>
                                          </div>
                                          <div className="flex-1 space-y-2">
                                            <button 
                                              type="button" 
                                              onClick={() => fileInputRef.current?.click()}
                                              className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2"
                                            >
                                              <Upload size={12} /> {isUploading ? 'Uploading...' : 'Upload New Image'}
                                            </button>
                                            <p className="text-[9px] text-indigo-400 font-medium">Recommended: 4:5 aspect ratio, clean background.</p>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                         <div>
                                            <label className="block text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em] mb-2">Original MRP ({rupee})</label>
                                            <input type="number" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full text-xs font-mono font-bold py-3 px-4 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                         </div>
                                         <div>
                                            <label className="block text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em] mb-2">Current Live Price ({rupee})</label>
                                            <input type="number" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="w-full text-xs font-mono font-bold py-3 px-4 bg-white border border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm" />
                                         </div>
                                      </div>
                                      <div className="flex justify-end gap-3">
                                         <button 
                                           type="button"
                                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveMenu(e); }}
                                           disabled={loading || isUploading}
                                           className="w-full py-4 bg-black hover:bg-indigo-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl shadow-indigo-200 active:scale-95"
                                         >
                                           {loading ? "Syncing..." : isUploading ? "Waiting for upload..." : "Commit Plan Updates"}
                                         </button>
                                      </div>
                                   </motion.div>
                                )}
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl h-[340px] animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border border-gray-200 border-dashed">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <Package size={24} className="text-gray-300" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Catalog Empty</h3>
                  <p className="text-xs text-gray-500 mb-6">Start by creating your first product or seeding defaults.</p>
                  <button onClick={handleSeedMenu} disabled={isSeeding} className="px-6 py-2.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-black transition-all">
                    {isSeeding ? "Seeding..." : "Seed Default Menu"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regItems.map((item) => {
                    const discount = Math.round(((item.mrp - (item.offerPrice ?? item.price)) / item.mrp) * 100);
                    return (
                      <div key={item.id} className={`group bg-white border ${item.isArchived ? 'border-red-50 opacity-75 grayscale-[0.5]' : (item.inStock === false || item.inventory <= 0) ? 'border-red-200 bg-red-50/30 shadow-none' : 'border-gray-100 hover:border-gray-300 hover:shadow-xl hover:shadow-gray-200/50'} rounded-2xl overflow-hidden transition-all duration-300 flex flex-col relative`}>
                        {(item.inStock === false || item.inventory <= 0) && !item.isArchived && (
                          <div className="absolute top-2 right-2 z-10">
                             <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg animate-pulse">Critical: Stock Out</span>
                          </div>
                        )}
                        {/* Card Media */}
                        <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                            <span className={`px-2 py-0.5 ${item.category === "Signature Blends" ? 'bg-black text-white' : 'bg-emerald-500 text-white'} text-[9px] font-black uppercase tracking-widest rounded shadow-sm w-fit`}>
                              {item.category === "Signature Blends" ? "Blend" : "Pure"}
                            </span>
                            {item.isArchived && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-sm w-fit">Archived</span>
                            )}
                            {(item.inStock === false || item.inventory <= 0) && !item.isArchived && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-sm w-fit">Sold Out</span>
                            )}
                            {item.inventory > 0 && item.inventory <= 10 && item.inStock !== false && !item.isArchived && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-sm w-fit">Low Stock</span>
                            )}
                          </div>
                          {discount > 0 && !item.isArchived && (
                            <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-lg">
                              -{discount}%
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Card Content */}
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-2">
                             <h3 className="text-sm font-black text-gray-900 leading-tight group-hover:text-black transition-colors">{item.name}</h3>
                             <div className="flex gap-1 shrink-0 -mt-1 -mr-1">
                                {(item.inStock === false || item.inventory <= 0) && (
                                   <div className="flex items-center gap-1.5 mr-1">
                                      <div className="px-2 py-1 bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 shadow-sm">
                                         <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                         <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Sold Out</span>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); handleRestoreStock(item.id, item.name); }}
                                        className="px-2 py-1 bg-gray-900 text-white border border-gray-800 rounded-lg flex items-center gap-1 hover:bg-black transition-all shadow-md active:scale-95"
                                      >
                                         <RotateCcw size={10} className="text-white" />
                                         <span className="text-[8px] font-black uppercase tracking-tighter">Restore</span>
                                      </button>
                                   </div>
                                )}
                                <button type="button" onClick={() => handleEditClick(item)} className="p-2 text-black hover:bg-gray-100 rounded-lg transition-all">
                                   <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => {
                                   if (item.isArchived) {
                                     handleToggleArchiveMenu(item.id, true);
                                   } else {
                                     setDeletingMenuItem(item);
                                   }
                                 }} className={`p-2 text-black hover:bg-gray-100 rounded-lg transition-all overflow-hidden`}>
                                   {item.isArchived ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                </button>
                             </div>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium line-clamp-2 mb-4 leading-relaxed flex-1">{item.desc}</p>
                           
                           {/* Action Overlay for Archive vs Permanent Delete */}
                           <AnimatePresence>
                             {deletingMenuItem?.id === item.id && (
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.95 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 exit={{ opacity: 0, scale: 0.95 }}
                                 className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-md p-4 flex flex-col gap-2 rounded-t-2xl border-t border-gray-100 shadow-2xl z-20"
                               >
                                 <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Removal Options</span>
                                    <button type="button" onClick={() => setDeletingMenuItem(null)} className="text-gray-400 hover:text-black p-1"><X size={12}/></button>
                                 </div>
                                 <button 
                                   type="button"
                                   onClick={() => handleToggleArchiveMenu(item.id, false)}
                                   className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                 >
                                   Archive Item
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={() => handleDeletePermanently(item.id)}
                                   className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-200"
                                 >
                                   Delete Permanently
                                 </button>
                               </motion.div>
                             )}
                           </AnimatePresence>
                          
                          <div className="pt-4 border-t border-gray-50 flex items-end justify-between">
                            <div className="flex flex-col">
                              {item.mrp > (item.offerPrice ?? item.price) && (
                                <span className="text-[10px] text-gray-400 line-through font-mono">{rupee}{item.mrp}</span>
                              )}
                              <span className="text-lg font-black text-gray-900 font-mono tracking-tighter">{rupee}{item.offerPrice ?? item.price}</span>
                            </div>
                            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">
                               v.1.0
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
