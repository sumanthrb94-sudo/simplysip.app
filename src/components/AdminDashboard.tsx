import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { get, onValue, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../firebaseConfig';
import { seedMenu } from '../data/seedMenu';

type OrderFilter = "all" | "pending" | "paid" | "delivered" | "cancelled";

type OrderFormState = {
  orderStatus: string;
  paymentStatus: string;
  deliverySlot: string;
  assignedRider: string;
  notes: string;
};

const snapshotToArray = (snapshot: any) => {
  const val = snapshot.val();
  if (!val) return [];
  return Object.entries(val).map(([id, data]) => ({ id, ...(data as any) }));
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

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
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

  const handleSeedMenu = async () => {
    if (items.length > 0) return;
    setIsSeeding(true);
    try {
      await Promise.all(
        seedMenu.map((item) => {
          const newRef = push(ref(db, "menu"));
          return set(newRef, { ...item, createdAt: Date.now() });
        })
      );
    } catch (err) {
      console.error("Failed to seed menu:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const menuRef = ref(db, "menu");
    const unsubscribeMenu = onValue(
      menuRef,
      (snapshot) => {
        const data = snapshotToArray(snapshot);
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

    const ordersRef = ref(db, "orders");
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      const data = snapshotToArray(snapshot).sort((a: any, b: any) => {
        const aTime = normalizeTimestamp(a.createdAt ?? a.updatedAt) || 0;
        const bTime = normalizeTimestamp(b.createdAt ?? b.updatedAt) || 0;
        return bTime - aTime;
      });
      setOrders(data);
      const ids = new Set(data.map((order: any) => order.id).filter(Boolean));
      setLocalMockOrders((prev) => prev.filter((order) => !ids.has(order.id)));
      if (hasLoadedOrders.current) {
        const newOrder = data.find((order: any) => !seenOrderIds.current.has(order.id));
        if (newOrder) {
          setToastOrder(newOrder);
          window.setTimeout(() => setToastOrder(null), 5000);
        }
      }
      seenOrderIds.current = new Set(data.map((o: any) => o.id));
      hasLoadedOrders.current = true;
    });

    const usersRef = ref(db, "users");
    const unsubscribeUsers = onValue(
      usersRef,
      (snapshot) => {
        const val = snapshot.val();
        setTotalUsers(val ? Object.keys(val).length : 0);
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
          get(ref(db, "menu")),
          get(ref(db, "orders")),
          get(ref(db, "users"))
        ]);
        const menuData = snapshotToArray(menuSnap);
      const ordersData = snapshotToArray(ordersSnap).sort((a: any, b: any) => {
        const aTime = normalizeTimestamp(a.createdAt ?? a.updatedAt) || 0;
        const bTime = normalizeTimestamp(b.createdAt ?? b.updatedAt) || 0;
        return bTime - aTime;
      });
      const usersVal = usersSnap.val();
        setItems(menuData.length > 0 ? menuData : seedMenu.map((item, index) => ({ id: `seed-${index + 1}`, ...item })));
        setOrders(ordersData);
        setTotalUsers(usersVal ? Object.keys(usersVal).length : 0);
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
      const newRef = push(ref(db, "orders"));
      setLocalMockOrders((prev) => {
        const next = [{ id: newRef.key, ...payload }, ...prev];
        const seen = new Set<string>();
        return next.filter((order) => {
          if (!order || !order.id) return false;
          if (seen.has(order.id)) return false;
          seen.add(order.id);
          return true;
        });
      });
      await set(newRef, payload);
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
      await update(ref(db, `orders/${selectedOrder.id}`), payload);
      setOrders((prev) =>
        prev.map((order) => (order.id === selectedOrder.id ? { ...order, ...payload } : order))
      );
      setLocalMockOrders((prev) =>
        prev.map((order) => (order.id === selectedOrder.id ? { ...order, ...payload } : order))
      );
      setSelectedOrder(null);
    } catch (err) {
      console.error("Failed to update order:", err);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
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
    try {
      const newRef = push(ref(db, "menu"));
      await set(newRef, {
        name,
        desc,
        image,
        category,
        mrp: Number(mrp),
        offerPrice: Number(offerPrice),
        price: Number(offerPrice),
        createdAt: Date.now()
      });
      setName('');
      setDesc('');
      setMrp('150');
      setOfferPrice('119');
      setImage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMenu = async (id: string) => {
    try {
      await remove(ref(db, `menu/${id}`));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await remove(ref(db, `orders/${id}`));
    } catch (err) {
      console.error(err);
    } finally {
      setLocalMockOrders((prev) => prev.filter((order) => order.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {toastOrder && (
          <button
            type="button"
            onClick={() => setSelectedOrder(toastOrder)}
            className="fixed top-4 right-4 z-[90] bg-white border border-black/10 rounded-2xl shadow-[0_30px_80px_-50px_rgba(0,0,0,0.45)] px-5 py-4 text-left hover:border-black/20 transition-colors"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-1">New Order</div>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Total Users</div>
            <div className="text-3xl font-semibold text-[#1D1D1F]">
              {statsLoading ? "..." : totalUsers}
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Upcoming Orders</div>
            <div className="text-3xl font-semibold text-[#1D1D1F]">
              {statsLoading ? "..." : upcomingOrders}
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Subscribers</div>
            <div className="text-3xl font-semibold text-[#1D1D1F]">
              {statsLoading ? "..." : subscribers}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(["all", "pending", "paid", "delivered", "cancelled"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setOrderFilter(status)}
              className={`px-4 py-2 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase border ${
                orderFilter === status ? "bg-[#1D1C1A] text-white border-[#1D1C1A]" : "border-black/10 text-[#1D1C1A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="mb-14">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Order Calendar</h2>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
              Select Date
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Day</div>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                >
                  {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Month</div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                >
                  {[
                    "January","February","March","April","May","June","July","August","September","October","November","December"
                  ].map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Year</div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-black/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2">Orders</div>
                <div className="text-2xl font-semibold text-[#1D1D1F]">{selectedStats.count}</div>
              </div>
              <div className="rounded-2xl border border-black/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2">Revenue</div>
                <div className="text-2xl font-semibold text-[#1D1D1F]">
                  {rupee}{Math.round(selectedStats.revenue)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold tracking-tight mb-6 text-[#1D1D1F]">Live Orders</h2>
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
                .map((order) => (
                  <div
                    key={order.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-black/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left hover:border-black/20 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 text-left"
                    >
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">
                          {(order.orderStatus || order.status || "pending")} {bullet} {order.paymentStatus || "unpaid"}
                        </div>
                        <div className="text-sm font-semibold text-[#1D1D1F]">
                          {order.address?.name || "Customer"} {bullet} {rupee}{order.total ?? "-"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.address?.area || "Area"} {bullet} {order.address?.phone || "Phone"}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
                        {order.id}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id)}
                      className="w-full sm:w-auto px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-red-600 border border-red-200 rounded-full hover:border-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full sm:max-w-xl bg-white rounded-[2rem] p-6 sm:p-8 border border-black/5 shadow-[0_50px_120px_-80px_rgba(0,0,0,0.5)] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-1">Order Details</div>
                  <div className="text-lg font-semibold text-[#1D1D1F]">
                    {selectedOrder.address?.name || "Customer"}
                  </div>
                  {selectedOrder.userEmail && (
                    <div className="text-xs text-gray-500">{selectedOrder.userEmail}</div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs uppercase tracking-[0.3em] text-[#6F6A63]"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm text-[#1D1D1F]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Phone</div>
                  <div>{selectedOrder.address?.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Area</div>
                  <div>{selectedOrder.address?.area || "-"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Address</div>
                  <div>{selectedOrder.address?.address || "-"}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Order Status</div>
                  <select
                    value={orderForm.orderStatus}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, orderStatus: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Payment Status</div>
                  <select
                    value={orderForm.paymentStatus}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Delivery Slot</div>
                  <input
                    value={orderForm.deliverySlot}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, deliverySlot: e.target.value }))}
                    placeholder="e.g. Today 6-8 PM"
                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Assigned Rider</div>
                  <input
                    value={orderForm.assignedRider}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, assignedRider: e.target.value }))}
                    placeholder="Rider name"
                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Notes</div>
                  <textarea
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add internal notes"
                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors resize-none min-h-[80px]"
                  />
                </div>
              </div>

              <div className="border-t border-black/10 pt-4 space-y-3">
                {(selectedOrder.items || []).map((item: any, idx: number) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center justify-between text-sm">
                    <div>{item.name} x {item.qty}</div>
                    <div>{rupee}{item.price}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-semibold text-[#1D1D1F] pt-2 border-t border-black/10">
                  <span>Total Paid</span>
                  <span>{rupee}{selectedOrder.total ?? "-"}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sticky bottom-0 bg-white pt-4 border-t border-black/10">
                <button
                  onClick={saveOrderUpdates}
                  disabled={isSavingOrder}
                  className="flex-1 py-3 bg-[#1D1C1A] text-white font-semibold tracking-[0.1em] uppercase text-[11px] rounded-full hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingOrder ? "Saving..." : "Save Updates"}
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-3 border border-black/10 text-[#1D1C1A] font-semibold tracking-[0.1em] uppercase text-[11px] rounded-full hover:border-black/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-black/5 lg:sticky lg:top-6">
              <h2 className="text-2xl font-bold tracking-tight mb-8 text-[#1D1D1F]">Add New Juice</h2>
              <form onSubmit={handleAdd} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as "Signature Blends" | "Single Fruit Series")}
                    className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent"
                  >
                    <option value="Signature Blends">Signature Blends (Blends)</option>
                    <option value="Single Fruit Series">Single Fruit Series (Pure)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">Juice Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Citrus Blast" className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">Ingredients</label>
                  <textarea required value={desc} onChange={e => setDesc(e.target.value)} placeholder="Orange, Lemon, Ginger" className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent min-h-[80px] resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">MRP ({rupee})</label>
                  <input required type="number" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">Offer Price ({rupee})</label>
                  <input required type="number" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 mb-2 uppercase">Image URL</label>
                  <input required value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." className="w-full border-b border-black/10 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-transparent" />
                </div>
                <button type="submit" className="w-full py-4 bg-[#1D1D1F] text-white rounded-full font-medium tracking-wide hover:bg-black transition-colors duration-300 text-sm mt-4">
                  Add Item
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold tracking-tight mb-8 text-[#1D1D1F]">Current Menu</h2>
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
                  className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex items-center gap-8 group"
                >
                  <div className="w-24 h-24 bg-[#F5F5F7] rounded-2xl overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-xs font-semibold tracking-wide uppercase text-gray-400">{item.category || "Menu"}</span>
                      <span className="text-sm font-bold text-[#1D1D1F]">{rupee}{item.offerPrice ?? item.price}</span>
                      {item.mrp && (
                        <span className="text-xs text-gray-400 line-through">{rupee}{item.mrp}</span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-[#1D1D1F] mb-1">{item.name}</h3>
                    <p className="text-sm text-gray-500 font-light truncate max-w-md">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteMenu(item.id)}
                    className="p-4 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
