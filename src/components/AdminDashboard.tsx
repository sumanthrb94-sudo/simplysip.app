import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Pencil, MessageCircle, CreditCard, X, MapPin, Phone, User, Clock, Truck, FileText, Banknote, Users, Package, Star, Calendar, TrendingUp, ChevronDown } from 'lucide-react';
import { collection, onSnapshot, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
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

      // Immediately authorize synchronously
      const email = currentUser.email?.toLowerCase().trim() || "";
      const isEmailAdmin = email === "sumanthbolla97@gmail.com";
      const isLocalAdmin = window.localStorage.getItem('simplysip_local_admin') === 'true';
      setIsAuthorized(isEmailAdmin || isLocalAdmin);
      
      // Check Firestore as backup without blocking
      getDoc(doc(db, "admins", currentUser.uid))
        .then((snap) => { 
          if (snap.exists()) setIsAuthorized(true); 
          else if (!isEmailAdmin) {
            setIsAuthorized(false);
            window.localStorage.removeItem('simplysip_local_admin');
          }
        })
        .catch((err) => console.warn("Admin status check failed:", err));
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
  const [category, setCategory] = useState<"Signature Blends" | "Single Fruit Series">("Signature Blends");
  const [mrp, setMrp] = useState('150');
  const [offerPrice, setOfferPrice] = useState('119');
  const [image, setImage] = useState('');
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  const handleSeedMenu = async () => {
    if (items.length > 0) return;
    setIsSeeding(true);
    try {
      await Promise.all(
        seedMenu.map((item) => {
          return addDoc(collection(db, "menu"), { ...item, createdAt: Date.now() });
        })
      );
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
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItems(data.length > 0 ? data : seedMenu.map((item, index) => ({ id: `seed-${index + 1}`, ...item })));
        setMenuError(null);
        setLoading(false);
        if (data.length === 0 && !hasAutoSeeded.current) {
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
        if (window.history.state?.modal === 'order') window.history.back();
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

  const bulkAcceptPendingOrders = async () => {
    const pendingOrders = displayOrders.filter(o => (o.orderStatus || o.status || 'pending') === 'pending');
    if (pendingOrders.length === 0) return alert("No pending orders to accept.");

    const isConfirmed = window.confirm(`Are you sure you want to accept ${pendingOrders.length} pending orders?`);
    if (!isConfirmed) return;

    try {
      const batch = writeBatch(db);
      pendingOrders.forEach(order => {
        const orderRef = doc(db, "orders", order.id);
        batch.update(orderRef, { orderStatus: "preparing", updatedAt: Date.now() });
      });
      await batch.commit(); // Sends all updates in exactly 1 network request
      alert(`Successfully accepted ${pendingOrders.length} orders!`);
    } catch (err: any) {
      console.error("Bulk update failed:", err);
      alert(`Failed to bulk update orders: ${err.message}`);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const mrpNum = Number(mrp);
    const offerPriceNum = Number(offerPrice);

    if (mrpNum <= 0 || offerPriceNum <= 0) {
      alert("MRP and Offer Price must be positive numbers.");
      return;
    }
    if (offerPriceNum > mrpNum) {
      alert("Offer Price cannot be greater than MRP.");
      return;
    }
    if (!image.startsWith('http')) {
      alert("Please enter a valid image URL starting with http(s)://");
      return;
    }
    
    const payload = {
      name,
      desc,
      image,
      category,
      mrp: mrpNum,
      offerPrice: offerPriceNum,
      price: offerPriceNum,
      updatedAt: Date.now()
    };

    try {
      if (editingMenuId) {
        await updateDoc(doc(db, "menu", editingMenuId), payload);
        alert("Menu item updated successfully!");
      } else {
        await addDoc(collection(db, "menu"), { ...payload, createdAt: Date.now() });
        alert("Menu item added successfully!");
      }
      resetMenuForm();
    } catch (err: any) {
      console.error("Failed to save menu item:", err);
      alert(`Failed to save item: ${err.message || 'Check database rules.'}`);
    }
  };

  const resetMenuForm = () => {
    setName('');
    setDesc('');
    setCategory('Signature Blends');
    setMrp('150');
    setOfferPrice('119');
    setImage('');
    setEditingMenuId(null);
  };

  const handleEditClick = (item: any) => {
    setName(item.name || '');
    setDesc(item.desc || '');
    setCategory(item.category || 'Signature Blends');
    setMrp(String(item.mrp || '150'));
    setOfferPrice(String(item.offerPrice ?? item.price ?? '119'));
    setImage(item.image || '');
    setEditingMenuId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMenu = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    try {
      await deleteDoc(doc(db, "menu", id));
    } catch (err: any) {
      console.error("Failed to delete menu item:", err);
      alert(`Failed to delete item: ${err.message || 'Check database rules.'}`);
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
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {toastOrder && (
          <button
            type="button"
            onClick={() => setSelectedOrder(toastOrder)}
            className="fixed top-4 right-4 z-[90] bg-white border border-black/10 rounded-2xl shadow-[0_30px_80px_-50px_rgba(0,0,0,0.45)] px-5 py-4 text-left hover:border-black/20 transition-colors"
          >
            <div className="flex items-center justify-between gap-6 mb-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400">New Order</div>
              {(() => {
                const source = getPaymentSource(toastOrder?.paymentId);
                return (
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    source === 'whatsapp' ? 'bg-green-50 text-green-600' : 
                    source === 'cod' ? 'bg-orange-50 text-orange-600' : 
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {source === 'whatsapp' ? <MessageCircle size={10} /> : source === 'cod' ? <Banknote size={10} /> : <CreditCard size={10} />}
                    {source === 'whatsapp' ? 'WhatsApp' : source === 'cod' ? 'COD' : 'Razorpay'}
                  </div>
                );
              })()}
            </div>
            <div className="text-sm font-semibold text-[#1D1D1F]">
              {toastOrder?.address?.name || "Customer"} {bullet} {rupee}{toastOrder?.total ?? "-"}
            </div>
          </button>
        )}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black transition-colors mb-8 sm:mb-12"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-[#1D1D1F]">Admin Dashboard.</h1>
          <div className="flex flex-wrap items-center gap-2">
            {(["A", "B", "C", "D"] as const).map((key) => (
              <button
                key={key}
                onClick={() => createMockOrder(key)}
                disabled={activeMockKeys.has(key)}
                className={`w-10 h-10 rounded-full border text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  activeMockKeys.has(key)
                    ? "border-[#1D1C1A] bg-[#1D1C1A] text-white"
                    : "border-black/10 text-[#1D1C1A] hover:border-black/20"
                }`}
              >
                {activeMockKeys.has(key) ? "..." : key}
              </button>
            ))}
          </div>
          {testOrderError && (
            <div className="mt-2 text-xs text-red-500 font-medium">
              {testOrderError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          <div className="bg-white rounded-[2rem] border border-black/5 p-6 sm:p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:border-black/10 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3 flex items-center gap-2">
              <Users size={14} className="text-blue-500" /> Total Users
            </div>
            <div className="text-4xl font-display font-bold text-[#1D1D1F]">
              {statsLoading ? "..." : totalUsers}
            </div>
          </div>
          <div className="bg-white rounded-[2rem] border border-black/5 p-6 sm:p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:border-black/10 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3 flex items-center gap-2">
              <Package size={14} className="text-orange-500" /> Upcoming Orders
            </div>
            <div className="text-4xl font-display font-bold text-[#1D1D1F]">
              {statsLoading ? "..." : upcomingOrders}
            </div>
          </div>
          <div className="bg-white rounded-[2rem] border border-black/5 p-6 sm:p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:border-black/10 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3 flex items-center gap-2">
              <Star size={14} className="text-yellow-500" /> Subscribers
            </div>
            <div className="text-4xl font-display font-bold text-[#1D1D1F]">
              {statsLoading ? "..." : subscribers}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap bg-white p-1.5 rounded-3xl border border-black/5 shadow-sm gap-1">
            {(["all", "pending", "paid", "delivered", "cancelled"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setOrderFilter(status)}
                className={`flex-1 min-w-[80px] py-3 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all ${
                  orderFilter === status ? "bg-[#1D1C1A] text-white shadow-md" : "text-gray-400 hover:text-[#1D1D1F] hover:bg-gray-50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] font-display flex items-center gap-3">
              <Calendar size={24} className="text-gray-400" /> Daily Revenue
            </h2>
          </div>

          <div className="bg-white border border-black/5 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Day</label>
                <div className="relative">
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold appearance-none"
                  >
                    {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={14} /></span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Month</label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold appearance-none"
                  >
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((label, index) => (
                      <option key={label} value={index}>{label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={14} /></span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Year</label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold appearance-none"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={14} /></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-4">
              <div className="flex-1 bg-[#F9F8F6] rounded-3xl p-6 border border-black/5">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2 flex items-center gap-1.5"><Package size={12}/> Orders Fulfilled</div>
                <div className="text-3xl font-display font-bold text-[#1D1D1F]">{selectedStats.count}</div>
              </div>
              <div className="flex-1 bg-green-50 rounded-3xl p-6 border border-green-100">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-700 mb-2 flex items-center gap-1.5"><TrendingUp size={12}/> Net Revenue</div>
                <div className="text-3xl font-display font-bold text-green-700">
                  {rupee}{Math.round(selectedStats.revenue).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-14">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] font-display">Live Orders</h2>
            <button
              onClick={bulkAcceptPendingOrders}
              disabled={pendingOrdersCount === 0}
              className="px-5 py-2.5 bg-[#1D1C1A] text-white text-[10px] font-semibold tracking-[0.15em] uppercase rounded-full hover:bg-black transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept All Pending ({pendingOrdersCount})
            </button>
          </div>
          {displayOrders.length === 0 ? (
            <p className="text-gray-500 font-medium">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {displayOrders
                .filter((order) => {
                  if (orderFilter === "all") return true;
                  if (orderFilter === "paid") return (order.paymentStatus || "") === "paid";
                  return (order.orderStatus || order.status || "pending") === orderFilter;
                })
                .slice(0, 10)
                .map((order) => {
                  return (
                  <div
                    key={order.id}
                    className="bg-white p-5 rounded-[2rem] border border-black/5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left hover:border-black/15 transition-all hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm ${
                            (order.orderStatus || order.status || 'pending') === 'delivered' ? 'bg-green-100 text-green-800' :
                            (order.orderStatus || order.status || 'pending') === 'cancelled' ? 'bg-red-100 text-red-800' :
                            (order.orderStatus || order.status || 'pending') === 'out-for-delivery' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {(order.orderStatus || order.status || 'pending').replace(/-/g, ' ')}
                          </span>
                          <span className="text-[10px] font-bold text-gray-300">•</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>{order.paymentStatus || 'unpaid'}</span>
                          {(() => {
                            const source = getPaymentSource(order.paymentId);
                            return (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm border ${
                                source === 'whatsapp' ? 'bg-green-50 text-green-600' : 
                                source === 'cod' ? 'bg-orange-50 text-orange-600' : 
                                'bg-blue-50 text-blue-600'
                              }`}>
                                {source === 'whatsapp' ? <MessageCircle size={10} /> : source === 'cod' ? <Banknote size={10} /> : <CreditCard size={10} />}
                                {source === 'whatsapp' ? 'WhatsApp' : source === 'cod' ? 'COD' : 'Razorpay'}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-base font-bold text-[#1D1D1F] mb-0.5">
                          {order.address?.name || "Customer"} {bullet} {rupee}{order.total ?? "-"}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">
                          {order.address?.area || "Area"} {bullet} {order.address?.phone || "Phone"}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
                        ID: {order.id.slice(-8)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id)}
                      className="w-full sm:w-auto px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-[100] bg-[#1D1C1A]/20 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full sm:max-w-xl bg-white rounded-[2.5rem] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between bg-white z-10 shrink-0">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-1">
                    Order #{selectedOrder.id.slice(-6).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#1D1D1F]">
                      {rupee}{selectedOrder.total ?? "-"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                      orderForm.paymentStatus === 'paid' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {orderForm.paymentStatus}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 [&::-webkit-scrollbar]:hidden">
                
                {/* Customer Details */}
                <div className="bg-[#F9F8F6] rounded-3xl p-5 space-y-4 border border-black/5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#1D1D1F]">
                      <User size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1D1D1F]">{selectedOrder.address?.name || "Customer"}</div>
                      <div className="text-[11px] text-gray-500">{selectedOrder.userEmail || "No email provided"}</div>
                    </div>
                  </div>
                  <div className="h-px bg-black/5 w-full"></div>
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-[#1D1D1F] mb-0.5">{selectedOrder.address?.area || "Area"}</div>
                      <div className="text-xs text-gray-500 leading-relaxed">{selectedOrder.address?.address || "-"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Phone size={16} className="text-gray-400 shrink-0" />
                      <div className="text-xs font-semibold text-[#1D1D1F]">{selectedOrder.address?.phone || "-"}</div>
                    </div>
                    {selectedOrder.address?.phone && (
                      <a 
                        href={`https://wa.me/91${selectedOrder.address.phone.replace(/\D/g,'')}`}
                        target="_blank" rel="noreferrer"
                        className="px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] rounded-full text-[10px] font-bold tracking-wider uppercase hover:bg-[#25D366]/20 transition-colors flex items-center gap-1.5"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-4 ml-1">Items</h4>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((item: any, idx: number) => (
                      <div key={`${item.id}-${idx}`} className="flex items-center justify-between bg-white border border-black/5 p-3 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#F9F8F6] flex items-center justify-center text-xs font-bold text-[#1D1D1F]">
                            x{item.qty}
                          </div>
                          <div className="text-sm font-semibold text-[#1D1D1F]">{item.name}</div>
                        </div>
                        <div className="text-sm font-bold text-[#1D1D1F]">{rupee}{item.price * item.qty}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Updates */}
                <div>
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-4 ml-1">Order Pipeline</h4>
                  <div className="flex flex-wrap gap-2">
                    {['pending', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setOrderForm(prev => ({ ...prev, orderStatus: status }))}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${
                          orderForm.orderStatus === status 
                            ? 'bg-[#1D1C1A] text-white shadow-md' 
                            : 'bg-white border border-black/10 text-gray-500 hover:border-black/30'
                        }`}
                      >
                        {status.replace(/-/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">
                      <Clock size={12} /> Delivery Slot
                    </label>
                    <input
                      value={orderForm.deliverySlot}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, deliverySlot: e.target.value }))}
                      placeholder="e.g. Today 6-8 PM"
                      className="w-full rounded-2xl border border-black/5 bg-[#F9F8F6] px-4 py-3 text-sm focus:outline-none focus:border-black/20 focus:bg-white transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">
                      <Truck size={12} /> Assign Rider
                    </label>
                    <input
                      value={orderForm.assignedRider}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, assignedRider: e.target.value }))}
                      placeholder="Rider name"
                      className="w-full rounded-2xl border border-black/5 bg-[#F9F8F6] px-4 py-3 text-sm focus:outline-none focus:border-black/20 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">
                    <FileText size={12} /> Internal Notes
                  </label>
                  <textarea
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add internal notes..."
                    className="w-full rounded-2xl border border-black/5 bg-[#F9F8F6] px-4 py-3 text-sm focus:outline-none focus:border-black/20 focus:bg-white transition-all font-medium resize-none h-20"
                  />
                </div>
                
                {/* Payment toggle */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">
                    Payment Status (Manual Override)
                  </label>
                  <div className="flex bg-[#F9F8F6] p-1 rounded-2xl border border-black/5">
                    {['unpaid', 'paid', 'refunded'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setOrderForm(prev => ({ ...prev, paymentStatus: status }))}
                        className={`flex-1 py-2 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all ${
                          orderForm.paymentStatus === status 
                            ? 'bg-white text-[#1D1D1F] shadow-sm' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-5 border-t border-black/5 bg-white shrink-0 z-10">
                <button
                  onClick={saveOrderUpdates}
                  disabled={isSavingOrder}
                  className="w-full py-4 bg-[#1D1C1A] text-white font-bold tracking-[0.15em] uppercase text-[11px] rounded-2xl hover:bg-black transition-all hover:-translate-y-0.5 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSavingOrder ? "Saving Changes..." : "Save Updates"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-black/5 lg:sticky lg:top-6">
              <h2 className="text-2xl font-bold tracking-tight mb-8 text-[#1D1D1F] font-display">{editingMenuId ? "Edit Juice" : "Add New Juice"}</h2>
              <form onSubmit={handleSaveMenu} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Category</label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as "Signature Blends" | "Single Fruit Series")}
                      className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold text-[#1A1A1A] appearance-none"
                    >
                      <option value="Signature Blends">Signature Blends (Blends)</option>
                      <option value="Single Fruit Series">Single Fruit Series (Pure)</option>
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><ChevronDown size={14} /></span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Juice Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Citrus Blast" className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Ingredients</label>
                  <textarea required value={desc} onChange={e => setDesc(e.target.value)} placeholder="Orange, Lemon, Ginger" className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 min-h-[80px] resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">MRP ({rupee})</label>
                    <input required type="number" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold text-[#1A1A1A]" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Offer Price</label>
                    <input required type="number" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-bold text-[#1A1A1A]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Image URL</label>
                  <input required value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400" />
                </div>
                <div className="flex gap-3 mt-4">
                  <button type="submit" className="flex-1 py-4 bg-[#1D1D1F] text-white rounded-2xl font-bold tracking-widest uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] text-[10px]">
                    {editingMenuId ? "Update Item" : "Add Item"}
                  </button>
                  {editingMenuId && (
                    <button type="button" onClick={resetMenuForm} className="flex-1 py-4 bg-gray-100 text-[#1D1D1F] rounded-2xl font-bold tracking-widest uppercase hover:bg-gray-200 transition-colors text-[10px]">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold tracking-tight mb-8 text-[#1D1D1F] font-display">Current Menu</h2>
            {loading ? (
              <p className="text-gray-500 font-medium">Loading menu...</p>
            ) : menuError ? (
              <p className="text-red-500 font-medium">{menuError}</p>
            ) : items.length === 0 ? (
              <div className="space-y-4">
                <p className="text-gray-500 font-medium">No items found.</p>
                <button
                  onClick={handleSeedMenu}
                  disabled={isSeeding}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-full border border-black/10 text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-[#1D1C1A] hover:border-black/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSeeding ? "Seeding..." : "Seed Default Menu"}
                </button>
              </div>
            ) : (
              items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-black/5 flex items-center gap-6 sm:gap-8 group hover:border-black/15 transition-all"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#F9F8F6] rounded-2xl overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-xs font-semibold tracking-wide uppercase text-gray-400">{item.category || "Menu"}</span>
                      <span className="text-sm font-bold text-[#1D1D1F]">{rupee}{item.offerPrice ?? item.price}</span>
                      {item.mrp && (
                        <span className="text-xs text-gray-400 line-through">{rupee}{item.mrp}</span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-[#1D1D1F] mb-1 font-display">{item.name}</h3>
                    <p className="text-sm text-gray-500 font-light truncate max-w-md">{item.desc}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-3 sm:p-4 text-gray-400 hover:text-blue-500 transition-colors bg-gray-50 hover:bg-blue-50 rounded-full"
                    >
                      <Pencil className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDeleteMenu(item.id)}
                      className="p-3 sm:p-4 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 rounded-full"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
