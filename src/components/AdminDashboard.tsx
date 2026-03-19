import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Pencil, MessageCircle, CreditCard, X, MapPin, Phone, User, Clock, Truck, FileText, Banknote, Users, Package, Star, Calendar, TrendingUp, ChevronDown, RotateCcw } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>('orders');
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
      setIsAuthorized(isEmailAdmin);
      
      // Check Firestore as backup without blocking
      getDoc(doc(db, "admins", currentUser.uid))
        .then((snap) => { 
          if (snap.exists()) setIsAuthorized(true); 
          else if (!isEmailAdmin) {
            setIsAuthorized(false);
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

  const handleToggleArchiveMenu = async (id: string, isArchived: boolean) => {
    if (!isArchived && !window.confirm("Are you sure you want to archive this item? It will be hidden from the public menu.")) return;
    try {
      await updateDoc(doc(db, "menu", id), { isArchived: !isArchived, updatedAt: Date.now() });
    } catch (err: any) {
      console.error("Failed to update menu item state:", err);
      alert(`Failed to update item: ${err.message || 'Check database rules.'}`);
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
                  onClick={() => setActiveTab(tab)}
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
              <div className="text-sm font-bold text-white">{toastOrder?.address?.name || "Customer"} • {rupee}{toastOrder?.total}</div>
            </div>
          </motion.button>
        )}

        {activeTab === 'analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Users size={14}/> Total Users</div>
                <div className="text-3xl font-bold text-gray-900">{statsLoading ? "-" : totalUsers}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Package size={14}/> Upcoming Orders</div>
                <div className="text-3xl font-bold text-gray-900">{statsLoading ? "-" : upcomingOrders}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm col-span-2 sm:col-span-1">
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Star size={14}/> Active Subs</div>
                <div className="text-3xl font-bold text-gray-900">{statsLoading ? "-" : subscribers}</div>
              </div>
            </div>

            {/* Revenue Tool */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" /> Daily Revenue Report
              </h2>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Day</label>
                  <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 font-medium">
                    {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Month</label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 font-medium">
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((label, index) => <option key={label} value={index}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Year</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 font-medium">
                    {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Orders Fulfilled</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedStats.count}</div>
                </div>
                <div className="flex-1 bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-emerald-700 uppercase mb-1">Net Revenue</div>
                  <div className="text-2xl font-bold text-emerald-700">
                  {rupee}{Math.round(selectedStats.revenue).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              {/* Order Status Filters */}
              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "paid", "delivered", "cancelled"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-all ${
                      orderFilter === status 
                        ? "bg-gray-900 border-gray-900 text-white" 
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Dev Mock Buttons */}
                <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-gray-200 pr-4">
                  <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">Simulate:</span>
                  {(["A", "B", "C", "D"] as const).map((key) => (
                    <button key={key} onClick={() => createMockOrder(key)} disabled={activeMockKeys.has(key)} className="w-6 h-6 rounded bg-gray-100 text-gray-500 text-[10px] font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">
                      {key}
                    </button>
                  ))}
                </div>
                <button
                  onClick={bulkAcceptPendingOrders}
                  disabled={pendingOrdersCount === 0}
                  className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept All Pending ({pendingOrdersCount})
                </button>
              </div>
            </div>

            {displayOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500 font-medium text-sm">No orders found.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {displayOrders
                  .filter((order) => {
                    if (orderFilter === "all") return true;
                    if (orderFilter === "paid") return (order.paymentStatus || "") === "paid";
                    return (order.orderStatus || order.status || "pending") === orderFilter;
                  })
                  .slice(0, 50)
                  .map((order) => {
                    const status = order.orderStatus || order.status || 'pending';
                    const source = getPaymentSource(order.paymentId);
                    return (
                    <div
                      key={order.id}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col sm:flex-row"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="flex-1 text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono font-bold text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              status === 'delivered' ? 'bg-emerald-50 text-emerald-700' :
                              status === 'cancelled' ? 'bg-red-50 text-red-700' :
                              status === 'out-for-delivery' ? 'bg-blue-50 text-blue-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {status.replace(/-/g, ' ')}
                            </span>
                            {source === 'whatsapp' ? (
                              <MessageCircle size={14} className="text-green-500" />
                            ) : source === 'cod' ? (
                              <Banknote size={14} className="text-orange-500" />
                            ) : (
                              <CreditCard size={14} className="text-blue-500" />
                            )}
                          </div>
                          <div className="text-sm font-bold text-gray-900 mb-0.5">
                            {order.address?.name || "Customer"}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {order.address?.area || "Area"} • {order.items?.length || 0} items
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                          <div className="text-base font-bold text-gray-900">{rupee}{order.total}</div>
                          <div className={`text-[10px] font-bold uppercase ${order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {order.paymentStatus || 'unpaid'}
                          </div>
                        </div>
                      </button>
                      <div className="border-t sm:border-t-0 sm:border-l border-gray-100 bg-gray-50 flex sm:flex-col shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="flex-1 sm:flex-none p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                          title="Delete Order"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Product Management Form */}
            <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl shadow-sm p-5 lg:sticky lg:top-24">
              <div className="mb-5 pb-3 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">{editingMenuId ? "Edit Catalog Item" : "Add Catalog Item"}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage your product inventory and pricing.</p>
              </div>
              <form onSubmit={handleSaveMenu} className="space-y-5">
                {/* Image URL & Live Preview */}
                <div className="flex gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shadow-inner">
                    {image ? (
                      <img src={image} alt="Preview" className="h-full w-full object-cover mix-blend-multiply" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <span className="text-[10px] text-gray-400 font-medium text-center leading-tight px-1">No img</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
                    <input required value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6" />
                  </div>
                </div>

                {/* Name & Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Product Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Citrus Blast" className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as "Signature Blends" | "Single Fruit Series")} className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6 bg-white">
                    <option value="Signature Blends">Signature Blends</option>
                    <option value="Single Fruit Series">Single Fruit Series</option>
                  </select>
                </div>

                {/* Pricing Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">MRP</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-gray-500 sm:text-sm">{rupee}</span>
                      </div>
                      <input required type="number" min="0" value={mrp} onChange={e => setMrp(e.target.value)} className="block w-full rounded-md border-0 py-1.5 pl-7 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6 font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Offer Price</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-gray-500 sm:text-sm">{rupee}</span>
                      </div>
                      <input required type="number" min="0" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="block w-full rounded-md border-0 py-1.5 pl-7 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6 font-mono" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ingredients / Description</label>
                  <textarea required value={desc} onChange={e => setDesc(e.target.value)} placeholder="Orange, Lemon, Mint..." rows={3} className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6 resize-none" />
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-3">
                  <button type="submit" className="flex-1 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 transition-all">
                    {editingMenuId ? "Save Changes" : "Create Product"}
                  </button>
                  {editingMenuId && (
                    <button type="button" onClick={resetMenuForm} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Catalog List */}
            <div className="lg:col-span-8 space-y-3">
              {loading ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200"><p className="text-gray-500 text-sm">Loading catalog...</p></div>
              ) : menuError ? (
                <div className="text-center py-10 bg-red-50 rounded-xl border border-red-200"><p className="text-red-600 text-sm font-medium">{menuError}</p></div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                  <p className="text-gray-500 text-sm mb-4">No products in catalog.</p>
                  <button onClick={handleSeedMenu} disabled={isSeeding} className="px-4 py-2 bg-gray-100 text-gray-900 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-50">
                    {isSeeding ? "Seeding..." : "Seed Default Menu"}
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className={`bg-white border ${item.isArchived ? 'border-red-100 bg-gray-50 opacity-75' : 'border-gray-200'} rounded-lg p-3 flex items-center gap-4 hover:border-gray-300 transition-all shadow-sm`}>
                    <div className={`w-12 h-12 rounded-md overflow-hidden shrink-0 border border-gray-100 ${item.isArchived ? 'grayscale' : 'bg-gray-50'}`}>
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className={`text-sm font-bold truncate ${item.isArchived ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.name}</h3>
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold uppercase tracking-wider shrink-0">{item.category === "Signature Blends" ? "Blend" : "Pure"}</span>
                        {item.isArchived && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-semibold uppercase tracking-wider shrink-0">Archived</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{item.desc}</div>
                    </div>
                    <div className="text-right shrink-0 px-4">
                      <div className={`text-sm font-bold ${item.isArchived ? 'text-gray-500' : 'text-gray-900'}`}>{rupee}{item.offerPrice ?? item.price}</div>
                      {item.mrp && <div className="text-[10px] text-gray-400 line-through">{rupee}{item.mrp}</div>}
                    </div>
                    <div className="flex flex-col gap-1 border-l border-gray-100 pl-3 shrink-0">
                      <button onClick={() => handleEditClick(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleToggleArchiveMenu(item.id, !!item.isArchived)} className={`p-1.5 rounded transition-colors ${item.isArchived ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`} title={item.isArchived ? "Restore to Menu" : "Archive (Hide)"}>
                        {item.isArchived ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
