import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, CreditCard, Banknote, MessageCircle, MapPin, Home, Briefcase, Navigation } from 'lucide-react';
import { collection, addDoc, doc, setDoc, increment, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Product, SubscriptionProduct, Order, UserProfile } from '../types';
import { getMrp, getOfferPrice } from '../pricing';

interface CheckoutProps {
  user: UserProfile | null;
  onBack: () => void;
  cart: Record<string, number>;
  menuItems: Product[];
  onClearCart: () => void;
  onRemoveItem: (id: string) => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
  onAddressUpdate?: (addressData: any) => void;
  onOrderPlaced?: (order: Order) => void;
  onViewOrders?: () => void;
}

const CASHFREE_MODE = (import.meta.env.VITE_CASHFREE_ENV === "production") ? "production" : "sandbox";

const loadCashfreeSDK = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if ((window as any).Cashfree) {
      resolve((window as any).Cashfree({ mode: CASHFREE_MODE }));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve((window as any).Cashfree({ mode: CASHFREE_MODE }));
    script.onerror = () => reject(new Error("Failed to load payment SDK"));
    document.head.appendChild(script);
  });

const SERVICEABLE_ZONES = [
  { name: "Select Area", lat: 0, lng: 0 },
  // Secunderabad
  { name: "Alwal", lat: 17.5182, lng: 78.5089 },
  { name: "Bolarum", lat: 17.5313, lng: 78.5294 },
  { name: "Bowenpally", lat: 17.4714, lng: 78.4863 },
  { name: "Karkhana", lat: 17.4589, lng: 78.5015 },
  { name: "Kompally", lat: 17.5393, lng: 78.4940 },
  { name: "Malkajgiri", lat: 17.4503, lng: 78.5400 },
  { name: "Marredpally", lat: 17.4522, lng: 78.5108 },
  { name: "Sainikpuri", lat: 17.5015, lng: 78.5573 },
  { name: "Tarnaka", lat: 17.4368, lng: 78.5313 },
  { name: "Trimulgherry", lat: 17.4758, lng: 78.5063 },
  // Hyderabad
  { name: "Banjara Hills", lat: 17.4152, lng: 78.4358 },
  { name: "Jubilee Hills", lat: 17.4313, lng: 78.4031 },
  { name: "Ameerpet", lat: 17.4375, lng: 78.4483 },
  { name: "Begumpet", lat: 17.4493, lng: 78.4634 },
  { name: "Somajiguda", lat: 17.4261, lng: 78.4594 },
  { name: "Himayatnagar", lat: 17.3991, lng: 78.4893 },
  // Cyberabad
  { name: "HITEC City", lat: 17.4442, lng: 78.3772 },
  { name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
  { name: "Madhapur", lat: 17.4485, lng: 78.3908 },
  { name: "Kondapur", lat: 17.4614, lng: 78.3640 },
  { name: "Manikonda", lat: 17.4153, lng: 78.3739 },
  { name: "Kukatpally", lat: 17.4858, lng: 78.4018 },
];

const BULLET = "\u2022";

const SUBSCRIPTION_ITEMS: SubscriptionProduct[] = [
  { 
    id: "sub_weekly", 
    name: "Weekly Subscription", 
    mrp: 999, 
    offerPrice: 799,
    desc: "1 cold-pressed juice (200 ml) delivered daily for 7 days"
  },
  { 
    id: "sub_monthly", 
    name: "Monthly Subscription", 
    mrp: 3599, 
    offerPrice: 2599,
    desc: "1 cold-pressed juice (200 ml) delivered daily for 30 days"
  }
];

function IngredientTicker({ desc }: { desc?: string }) {
  if (!desc) return null;

  const parts = desc
    .split(/\u2022/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1 && !desc.match(/\u2022/)) {
    return (
      <p className="text-[11px] text-[#6F6A63] mt-1 line-clamp-2">
        {desc}
      </p>
    );
  }

  return (
    <div className="text-[11px] text-[#6F6A63] mt-1 flex flex-wrap items-center gap-x-1.5">
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          <span>{part}</span>
          {index < parts.length - 1 && (
            <span className="text-[#C6A05A] text-[8px]">{"\u25CF"}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Checkout({ user, onBack, cart, menuItems, onClearCart, onRemoveItem, onIncrementItem, onDecrementItem, onAddressUpdate, onOrderPlaced, onViewOrders }: CheckoutProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || user?.displayName || '',
    phone: user?.phone || (user?.phoneNumber ? user.phoneNumber.replace(/[^0-9]/g, '').slice(-10) : ''),
    address: user?.address || '',
    area: user?.area || ''
  });
  const [addressType, setAddressType] = useState(user?.addressType || 'Home');
  const [isAddressLocked, setIsAddressLocked] = useState(false);
  const [isServiceable, setIsServiceable] = useState<boolean>(true);
  const [location, setLocation] = useState(user?.location || "");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(user?.locationAccuracy || null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const rupee = "\u20B9";
  const [deliverySlot, setDeliverySlot] = useState("As soon as possible");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | 'whatsapp'>('online');
  const [completedMethod, setCompletedMethod] = useState<'online' | 'cod' | 'whatsapp' | null>(null);

  useEffect(() => {
    if (!user) return;
    const nextForm = {
      name: user?.name || user?.displayName || '',
      phone: user?.phone || (user?.phoneNumber ? user.phoneNumber.replace(/[^0-9]/g, '').slice(-10) : ''),
      address: user?.address || '',
      area: user?.area || ''
    };
    setFormData(nextForm);
    setAddressType(user?.addressType || 'Home');
    const hasSavedAddress = Boolean(nextForm.name && nextForm.phone && nextForm.address && nextForm.area && nextForm.area !== "Select Area");
    setIsAddressLocked(hasSavedAddress);
    setLocation(user?.location || "");
    setLocationAccuracy(user?.locationAccuracy || null);
  }, [user?.address, user?.area, user?.phone, user?.name, user?.location, user?.locationAccuracy, user?.displayName, user?.phoneNumber]);

  // Intercept hardware back button to return to cart step instead of closing
  useEffect(() => {
    if (step === 2) {
      window.history.pushState({ modal: 'checkout_payment' }, '');
      const handlePopState = () => setStep(1);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag && ["input", "textarea", "select", "button"].includes(tag)) {
        return;
      }
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touchStart.current.x - touch.clientX;
      const dy = touchStart.current.y - touch.clientY;
      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (isHorizontal && dx > 60) {
        onBack();
      }
      touchStart.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onBack]);

  const checkServiceability = (lat: number, lng: number) => {
    // Hyderabad / Secunderabad / Cyberabad center radius check
    const centerLat = 17.3850;
    const centerLng = 78.4867;
    const R = 6371; // Earth's radius in km
    
    const dLat = (lat - centerLat) * (Math.PI / 180);
    const dLng = (lng - centerLng) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(centerLat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) <= 40; // Serviceable within 40km radius
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const findNearestZone = (lat: number, lng: number) => {
    let nearestZone: { name: string; lat: number; lng: number; } | null = null;
    let minDistance = Infinity;

    SERVICEABLE_ZONES.forEach(zone => {
        if (zone.name === "Select Area") return;
        const distance = getDistance(lat, lng, zone.lat, zone.lng);
        if (distance < minDistance) {
            minDistance = distance;
            nearestZone = zone;
        }
    });
    return minDistance < 40 ? nearestZone : null;
  };

  const stopLocationWatch = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location not supported");
      return;
    }
    stopLocationWatch();
    setIsLocating(true);
    setLocationError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const lat = latitude.toFixed(6);
        const lng = longitude.toFixed(6);
        const acc = Math.round(accuracy);

        setLocation(`Lat ${lat}, Lng ${lng}`);
        setLocationAccuracy(acc);

        const isCurrentlyServiceable = checkServiceability(latitude, longitude);
        setIsServiceable(isCurrentlyServiceable);

        if (isCurrentlyServiceable) {
          const nearestZone = findNearestZone(latitude, longitude);
          if (nearestZone) {
            setDetectedZone(nearestZone.name);
            setFormData(prev => ({ ...prev, area: nearestZone.name }));
          } else {
            setDetectedZone(null);
          }
        } else {
          setDetectedZone(null);
        }

        setIsLocating(false);
        if (acc <= 10) stopLocationWatch();
      },
      (err) => {
        setLocationError(err.message || "Location permission denied");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!isAddressLocked) requestLocation();
    else stopLocationWatch();
    return () => stopLocationWatch();
  }, [isAddressLocked]);

  useEffect(() => {
    if (location) {
      const parts = location.replace(/Lat|Lng/g, '').split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          setIsServiceable(checkServiceability(lat, lng));
        } else {
          setIsServiceable(false);
        }
      } else {
        setIsServiceable(false);
      }
    } else {
      setIsServiceable(false);
    }
  }, [user?.location]);

  const allItems: (Product | SubscriptionProduct)[] = [...SUBSCRIPTION_ITEMS, ...menuItems];
  const cartItems = allItems.filter(item => cart[item.id]);
  const cartCount = cartItems.reduce((sum: number, item) => sum + (cart[item.id] ?? 0), 0);
  const cartTotal = cartItems.reduce((sum: number, item) => {
    const qty = cart[item.id] ?? 0;
    return sum + (getOfferPrice(item) * qty);
  }, 0);
  const cartMrpTotal = cartItems.reduce((sum: number, item) => {
    const qty = cart[item.id] ?? 0;
    return sum + (getMrp(item) * qty);
  }, 0);
  const totalSavings = cartMrpTotal > cartTotal ? cartMrpTotal - cartTotal : 0;
  const deliveryFee = cartTotal >= 250 ? 0 : (cartCount > 0 ? 30 : 0);
  const grandTotal = cartTotal + deliveryFee;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Allow only numbers and limit to 10 digits
      const numericValue = value.replace(/[^0-9]/g, '');
      if (numericValue.length <= 10) {
        setFormData({ ...formData, [name]: numericValue });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSaveAddress = async () => {
    if (!onAddressUpdate) {
      setIsAddressLocked(true);
      return;
    }
    if (location && !isServiceable) {
      return alert("Sorry, your location is outside our service area and cannot be saved.");
    }
    if (!formData.name.trim()) {
      return alert("Please enter your full name.");
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      return alert("Please enter a valid 10-digit phone number.");
    }
    if (!formData.address.trim()) {
      return alert("Please enter your complete address.");
    }
    if (!formData.area || formData.area === "Select Area") {
      return alert("Please select a delivery area.");
    }
    try {
      await onAddressUpdate({
        name: formData.name,
        address: formData.address,
        area: formData.area,
        addressType: addressType,
        phone: formData.phone,
        location: location,
        locationAccuracy: locationAccuracy
      });
      setIsAddressLocked(true);
      alert("Address saved!");
    } catch (err) {
      alert("Failed to save address.");
    }
  };

  const handleEditAddress = () => {
    setIsAddressLocked(false);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartCount) {
      alert("Your cart is empty.");
      return;
    }
    if (location && !isServiceable) {
      alert("Sorry, we currently only deliver to Cyberabad, Secunderabad, and Hyderabad.");
      return;
    }
    if (!formData.name.trim() || !/^\d{10}$/.test(formData.phone) || !formData.address.trim() || !formData.area || formData.area === "Select Area") {
      return alert("Please fill in and save your complete address details.");
    }
    if (!isAddressLocked) {
      return alert("Please click 'Save Address' before proceeding to payment.");
    }

    setStep(2);
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const buildOrderPayload = (paymentId: string, paymentStatus: "paid" | "unpaid" | "refunded", appendNote: string = ""): Omit<Order, 'id'> => {
    const subscriptionType = cart.sub_weekly ? "weekly" : cart.sub_monthly ? "monthly" : null;
    return {
      userId: user?.uid || null,
      userEmail: user?.email || null,
      items: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        qty: cart[item.id] ?? 0,
        price: getOfferPrice(item)
      })),
      subtotal: cartTotal,
      deliveryFee,
      total: grandTotal,
      subscriptionType,
      paymentId,
      paymentStatus,
      orderStatus: "pending",
      deliverySlot,
      assignedRider: "",
      notes: notes ? (appendNote ? `${notes} (${appendNote})` : notes) : (appendNote || ""),
      address: {
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        address: formData.address,
        addressType: addressType
      },
      location: location || null,
      locationAccuracy: locationAccuracy || null,
      createdAt: Date.now()
    };
  };

  const processOrder = async (orderId: string, orderData: Omit<Order, 'id'>, method: 'online' | 'cod' | 'whatsapp') => {
    setOrderId(orderId);
    setCompletedMethod(method);
    if (onOrderPlaced) onOrderPlaced({ id: orderId, ...orderData });
    onClearCart();
    setStep(3);

    try {
      const batch = writeBatch(db);
      
      // Save order
      batch.set(doc(db, "orders", orderId), orderData);
      
      // Decrement inventory for menu items
      orderData.items.forEach((item) => {
        // Only decrement for menu items, not subscriptions
        if (!item.id.startsWith('sub_')) {
          const productRef = doc(db, "menu", item.id);
          batch.update(productRef, {
            inventory: increment(-item.qty)
          });
        }
      });

      await batch.commit();
      console.log("Order and inventory update successful.");
    } catch (dbErr) {
      console.warn("Inventory/Order sync failed. Order might be local only:", dbErr);
    }
  };

  const handlePaymentDone = async () => {
    setIsProcessingPayment(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert("Please sign in to pay online.");
        return;
      }

      const newOrderId = crypto.randomUUID();

      // Step 1: Create Cashfree order session on backend
      const createRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: grandTotal,
          customerName: formData.name,
          customerEmail: user?.email || "",
          customerPhone: formData.phone,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to initiate payment");
      }

      const { payment_session_id } = await createRes.json();

      // Step 2: Open Cashfree checkout modal
      const cashfree = await loadCashfreeSDK();
      setIsProcessingPayment(false);

      const result = await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: "_modal",
      });

      if (result?.error) {
        console.error("Cashfree checkout error:", result.error);
        alert("Payment failed. Please try again.");
        return;
      }

      setIsProcessingPayment(true);

      // Step 3: Verify payment on backend
      const freshToken = await auth.currentUser?.getIdToken();
      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ orderId: newOrderId }),
      });

      if (!verifyRes.ok) {
        throw new Error("Payment verification failed");
      }

      const { success, paymentId } = await verifyRes.json();

      if (!success) {
        alert("Payment could not be verified. If amount was deducted, please contact support with your order reference.");
        return;
      }

      const orderData = buildOrderPayload(paymentId, "paid");
      await processOrder(newOrderId, orderData, 'online');
    } catch (error) {
      console.error('Payment processing failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCOD = async () => {
    setIsProcessingPayment(true);
    try {
      const simulatedOrderId = crypto.randomUUID();
      const orderData = buildOrderPayload(`cod_${Date.now()}`, "unpaid", "Cash on Delivery");
      await processOrder(simulatedOrderId, orderData, 'cod');
    } catch (error) {
      console.error('COD processing failed:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleOrderViaWhatsapp = async () => {
    setIsProcessingPayment(true);
    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const simulatedOrderId = crypto.randomUUID();
      const orderData = buildOrderPayload(`whatsapp_${Date.now()}`, "unpaid", "Ordered via WhatsApp");
      
      const itemsText = cartItems
        .map((item) => {
          const desc = item.desc ? ` (${item.desc})` : "";
          return `${item.name}${desc} x${cart[item.id]} - ${rupee}${getOfferPrice(item)} each`;
        })
        .join("\n");
        
      const locText = location || 'N/A';
      const accuracyText = locationAccuracy ? ` (accuracy ${locationAccuracy}m)` : "";
      const message = `Hi Simply Sip, I placed an order.\n\nItems:\n${itemsText}\n\nSubtotal: ${rupee}${cartTotal}\nDelivery: ${rupee}${deliveryFee}\nTotal: ${rupee}${grandTotal}\n\nName: ${formData.name}\nAddress: ${formData.address}\nArea: ${formData.area}\nLocation: ${locText}${accuracyText}\n\nDelivery Slot: ${deliverySlot}\nNotes: ${notes || 'None'}\n\nOrder via WhatsApp.`;
      
      await processOrder(simulatedOrderId, orderData, 'whatsapp');

      const whatsappUrl = `https://wa.me/917306928735?text=${encodeURIComponent(message)}`;
      
      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }
    } catch (err) {
      console.error("Failed to save order:", err);
      if (whatsappWindow) whatsappWindow.close();
      alert("Failed to place order. Please check your connection and try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="min-h-screen bg-[#F5F2ED] px-4 sm:px-6 py-8 md:py-16 pb-32"
    >
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-black transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Return
        </button>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-8 text-[#1A1A1A] font-display">
          {step === 1 ? "Your Order." : "Complete."}
        </h1>

        {step === 1 ? (
          <form id="checkout-form" onSubmit={handleProceedToPayment} className="space-y-6 sm:space-y-8">
            <div className="bg-white p-6 md:p-8 border border-black/5 rounded-3xl shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]" id="cart-summary">
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Cart Summary</div>
                <div className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">{cartCount} item{cartCount === 1 ? "" : "s"}</div>
              </div>

              {cartCount === 0 ? (
                <div className="text-sm text-gray-500">Your cart is empty.</div>
              ) : (
                <div className="divide-y divide-black/5">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-medium text-[#1A1A1A]">{item.name}</div>
                          <IngredientTicker desc={item.desc} />
                        </div>
                        <div className="text-sm font-semibold text-[#1A1A1A] sm:pl-2 shrink-0">{rupee}{getOfferPrice(item) * cart[item.id]}</div>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="text-xs text-gray-500">
                          <span className="line-through mr-2">{rupee}{getMrp(item)}</span>
                          <span className="text-[#1A1A1A] font-semibold">{rupee}{getOfferPrice(item)}</span>
                        </div>
                        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                          <button
                            type="button"
                            onClick={() => onDecrementItem(item.id)}
                            aria-label={`Decrease ${item.name}`}
                            className="w-7 h-7 rounded-full border border-black/10 text-[#1A1A1A] font-medium hover:border-black/20 transition-colors flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-xs font-medium text-[#1A1A1A] w-6 text-center">{cart[item.id]}</span>
                          <button
                            type="button"
                            onClick={() => onIncrementItem(item.id)}
                            aria-label={`Increase ${item.name}`}
                            className="w-7 h-7 rounded-full border border-black/10 text-[#1A1A1A] font-medium hover:border-black/20 transition-colors flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="w-7 h-7 rounded-full border border-black/10 text-gray-400 hover:text-[#1A1A1A] hover:border-black/20 transition-colors flex items-center justify-center"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-6 border-t border-black/10">
                    <h4 className="text-sm font-bold text-[#1A1A1A] mb-4">Bill Details</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between text-gray-600 font-medium">
                        <span>Item Total</span>
                        <span className="text-[#1A1A1A]">
                          {totalSavings > 0 && <span className="line-through text-gray-400 mr-2 font-normal">{rupee}{cartMrpTotal}</span>}
                          {rupee}{cartTotal}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-600 font-medium">
                        <span>Delivery Fee</span>
                        <span className="text-[#1A1A1A]">
                          {deliveryFee === 0 ? (
                            <>
                              <span className="line-through text-gray-400 mr-2 font-normal">{rupee}30</span>
                              <span className="text-green-600">Free</span>
                            </>
                          ) : (
                            `${rupee}${deliveryFee}`
                          )}
                        </span>
                      </div>

                      {totalSavings > 0 && (
                        <div className="flex items-center justify-between text-green-600 font-medium pt-2 border-t border-dashed border-black/10">
                          <span>Item Discount</span>
                          <span>-{rupee}{totalSavings}</span>
                        </div>
                      )}

                      {deliveryFee === 0 && (
                        <div className="flex items-center justify-between text-green-600 font-medium">
                          <span>Delivery Discount</span>
                          <span>-{rupee}30</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-black/10">
                        <span className="text-base font-bold text-[#1A1A1A]">To Pay</span>
                        <div className="flex items-end gap-2">
                          {(totalSavings > 0 || deliveryFee === 0) && (
                            <span className="text-sm line-through text-gray-400 font-medium mb-0.5">
                              {rupee}{cartMrpTotal + 30}
                            </span>
                          )}
                          <span className="text-2xl font-bold text-[#1A1A1A] leading-none">{rupee}{grandTotal}</span>
                        </div>
                      </div>
                    </div>

                    {(totalSavings > 0 || deliveryFee === 0) && (
                      <div className="mt-5 bg-green-50 border border-green-100 text-green-700 p-3 rounded-2xl text-xs font-bold flex items-center justify-center tracking-wide">
                        You are saving {rupee}{totalSavings + (deliveryFee === 0 ? 30 : 0)} on this order! 🎉
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="mt-5 bg-blue-50 border border-blue-100 text-blue-700 p-3 rounded-2xl text-xs font-bold flex items-center justify-center tracking-wide text-center">
                        Add items worth {rupee}{250 - cartTotal} more to get Free Delivery! 🚚
                      </div>
                    )}

                    <div className="pt-6 mt-6 border-t border-black/10 space-y-5">
                      <div className="text-xs font-semibold tracking-[0.2em] uppercase text-[#1A1A1A]">Order Preferences</div>
                      <div className="space-y-3">
                        <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-400">Preferred Delivery Slot</label>
                        <div className="relative">
                          <select 
                            value={deliverySlot} 
                            onChange={(e) => setDeliverySlot(e.target.value)} 
                            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors appearance-none font-medium"
                          >
                            <option value="As soon as possible">As soon as possible</option>
                            <option value="Morning (7 AM - 10 AM)">Morning (7 AM - 10 AM)</option>
                            <option value="Afternoon (12 PM - 3 PM)">Afternoon (12 PM - 3 PM)</option>
                            <option value="Evening (5 PM - 8 PM)">Evening (5 PM - 8 PM)</option>
                          </select>
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">{"\u25BE"}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-400">Delivery Instructions / Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none h-20 font-medium placeholder:font-light placeholder:text-gray-400" placeholder="E.g., Leave at the door, call upon arrival, gate code..." />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 md:p-8 border border-black/5 rounded-3xl shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]" id="delivery-details">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-[#1A1A1A] font-display">Delivery Details</h3>
              </div>

              {isAddressLocked ? (
                <div className="border border-black/10 rounded-2xl p-5 bg-[#FAFAFA] relative overflow-hidden transition-all hover:border-black/20">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1A1A1A]"></div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center shrink-0 text-[#1A1A1A]">
                      {addressType === 'Office' ? <Briefcase size={18} /> : addressType === 'Home' ? <Home size={18} /> : <MapPin size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <h4 className="text-sm font-bold text-[#1A1A1A]">Deliver to {addressType}</h4>
                        <button
                          type="button"
                          onClick={handleEditAddress}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
                        >
                          Change
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3 truncate whitespace-normal line-clamp-2 pr-4">
                        {formData.address}, {formData.area}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1A1A1A] bg-white border border-black/5 px-3 py-1.5 rounded-xl inline-flex shadow-sm">
                        <span>{formData.name}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span>{formData.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Full Name</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light" placeholder="e.g. John Doe" required />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Phone Number</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light" placeholder="10-digit mobile number" required />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Delivery Area</label>
                    <div className="relative">
                      <select name="area" value={formData.area} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all appearance-none font-medium text-[#1A1A1A]" required>
                        {SERVICEABLE_ZONES.map(zone => (
                          <option key={zone.name} value={zone.name} disabled={zone.name === "Select Area"}>{zone.name}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">{"\u25BE"}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Complete Address</label>
                    <textarea name="address" value={formData.address} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all resize-none h-[100px] font-medium placeholder:text-gray-400 placeholder:font-light" placeholder="House/Flat No, Building Name, Street, Landmark" required />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Save Address As</label>
                    <div className="flex gap-3">
                      {['Home', 'Office', 'Other'].map(type => {
                        const Icon = type === 'Office' ? Briefcase : type === 'Home' ? Home : MapPin;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setAddressType(type)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-sm font-bold tracking-wide ${
                              addressType === type 
                                ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-md shadow-black/10' 
                                : 'border-black/10 bg-white text-gray-500 hover:border-black/30 hover:text-[#1A1A1A]'
                            }`}
                          >
                            <Icon size={16} />
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500 flex items-center gap-1.5">
                        <Navigation size={12} /> Delivery Location
                      </label>
                      {locationAccuracy !== null && !isLocating && (
                        <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                          locationAccuracy <= 50 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {locationAccuracy <= 50 ? 'Accurate' : 'Approximate'}
                        </span>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white text-blue-600 border border-blue-200 rounded-xl font-bold text-sm tracking-wide hover:bg-blue-50 transition-colors shadow-sm mb-3"
                    >
                      <Navigation size={16} className={isLocating ? 'animate-pulse' : ''} />
                      {isLocating ? "Detecting location..." : location ? "Update my location" : "Use my current location"}
                    </button>

                    {locationError && (
                      <div className="text-xs font-bold text-red-500 mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                        {locationError}
                      </div>
                    )}
                    
                    {location && !isLocating && (
                       <div className="bg-white rounded-xl p-3 border border-black/5 text-xs flex items-start gap-2 shadow-sm">
                          <div className={`mt-0.5 shrink-0 ${isServiceable ? 'text-green-500' : 'text-red-500'}`}>
                            <MapPin size={16} />
                          </div>
                          <div>
                             <div className={`font-bold mb-0.5 ${isServiceable ? 'text-[#1A1A1A]' : 'text-red-600'}`}>
                               {isServiceable ? (detectedZone || "Serviceable Area") : "Location Unserviceable"}
                             </div>
                             <div className="text-[10px] text-gray-500 font-mono tracking-wider">{location}</div>
                             {!isServiceable && (
                                <div className="mt-1 text-red-600 opacity-90">
                                  We currently only deliver to Cyberabad, Secunderabad, and Hyderabad within a 40km radius.
                                </div>
                             )}
                          </div>
                       </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button" 
                      onClick={handleSaveAddress} 
                      className="w-full py-4 bg-[#1D1C1A] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]"
                    >
                      Save & Continue
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Proceed to Pay Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 p-4 sm:p-6 z-50 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)]">
              <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-0.5">To Pay</div>
                  <div className="text-2xl font-bold text-[#1A1A1A] leading-none">{rupee}{grandTotal}</div>
                </div>
                <button 
                  type="submit"
                  form="checkout-form"
                  disabled={location ? !isServiceable : false}
                  className="px-8 py-4 bg-[#1D1C1A] text-white font-bold tracking-[0.15em] uppercase text-[11px] rounded-2xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(!location || isServiceable) ? "Proceed to Pay" : "Unserviceable"}
                </button>
              </div>
            </div>
          </form>
        ) : step === 2 ? (
          <div className="space-y-8">
            <div className="bg-white p-6 md:p-8 border border-black/5 rounded-3xl shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-semibold text-[#1A1A1A] font-display">Payment Options</h3>
                <div className="text-lg font-bold text-[#1A1A1A]">{rupee}{grandTotal}</div>
              </div>

              <div className="space-y-4">
                {/* Online Payment */}
                <label className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'online' ? 'border-[#1A1A1A] bg-[#FAFAFA]' : 'border-black/5 hover:border-black/15'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-[#1A1A1A]">Pay Online</div>
                      <div className="text-xs text-gray-500 font-medium mt-0.5">UPI, Cards, NetBanking</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'online' ? 'border-[#1A1A1A] bg-[#1A1A1A]' : 'border-gray-300'}`}>
                    {paymentMethod === 'online' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="paymentMethod" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="hidden" />
                </label>

                {/* Cash on Delivery */}
                <label className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-[#1A1A1A] bg-[#FAFAFA]' : 'border-black/5 hover:border-black/15'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <Banknote size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-[#1A1A1A]">Cash on Delivery</div>
                      <div className="text-xs text-gray-500 font-medium mt-0.5">Pay at your doorstep</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'cod' ? 'border-[#1A1A1A] bg-[#1A1A1A]' : 'border-gray-300'}`}>
                    {paymentMethod === 'cod' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="hidden" />
                </label>

                {/* WhatsApp */}
                <label className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'whatsapp' ? 'border-[#1A1A1A] bg-[#FAFAFA]' : 'border-black/5 hover:border-black/15'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-[#1A1A1A]">Order via WhatsApp</div>
                      <div className="text-xs text-gray-500 font-medium mt-0.5">Fast checkout via chat</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'whatsapp' ? 'border-[#1A1A1A] bg-[#1A1A1A]' : 'border-gray-300'}`}>
                    {paymentMethod === 'whatsapp' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="paymentMethod" value="whatsapp" checked={paymentMethod === 'whatsapp'} onChange={() => setPaymentMethod('whatsapp')} className="hidden" />
                </label>
              </div>
            </div>

            {/* Floating Confirm Payment Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 p-4 sm:p-6 z-50 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)]">
             <div className="max-w-2xl mx-auto">
              <button 
                onClick={() => {
                  if (paymentMethod === 'online') handlePaymentDone();
                  else if (paymentMethod === 'cod') handleCOD();
                  else if (paymentMethod === 'whatsapp') handleOrderViaWhatsapp();
                }}
                disabled={isProcessingPayment}
                className="w-full py-4 bg-[#1D1C1A] text-white font-bold tracking-[0.15em] uppercase text-[11px] rounded-2xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center"
              >
                {isProcessingPayment ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-2 sm:px-6">
                    <span className="tracking-[0.15em]">{paymentMethod === 'cod' ? 'Place Order' : 'Confirm Payment'}</span>
                    <span className="font-bold text-sm tracking-normal">{rupee}{grandTotal}</span>
                  </div>
                )}
              </button>
             </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-10 md:p-16 border border-black/5 rounded-3xl text-center flex flex-col items-center relative overflow-hidden shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-24 h-24 mb-8"
              >
                <motion.div
                  className="absolute inset-0 rounded-full border border-green-500/20"
                  animate={{ scale: [0.9, 1.05, 0.95], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="w-full h-full rounded-full bg-green-500 flex items-center justify-center relative z-10 shadow-xl shadow-green-500/30">
                  <motion.svg
                    width="46"
                    height="46"
                    viewBox="0 0 52 52"
                    fill="none"
                    initial={false}
                  >
                    <motion.circle
                      cx="26"
                      cy="26"
                      r="24"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="2"
                    />
                    <motion.path
                      d="M15 27.5L22.5 35L38 19"
                      stroke="#FFFFFF"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="60"
                      strokeDashoffset="60"
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
                    />
                  </motion.svg>
                </div>
              </motion.div>
              <h3 className="text-2xl font-bold text-[#1A1A1A] mb-2 relative z-10 font-display">
                {completedMethod === 'whatsapp' ? 'Order Drafted!' : 'Order Received!'}
              </h3>
              <p className="text-sm font-medium text-gray-500 mb-8 relative z-10 max-w-[280px]">
                {completedMethod === 'whatsapp' 
                  ? "We've opened WhatsApp to complete your order. Please send the pre-filled message."
                  : completedMethod === 'cod'
                  ? "Your freshly pressed juice is being prepared. Please keep exact cash ready upon delivery."
                  : "Your freshly pressed juice is being prepared. Payment was successful."}
              </p>
              {orderId && (
                <div className="bg-gray-50 border border-gray-100 px-4 py-2 rounded-lg text-xs uppercase tracking-widest text-gray-500 font-bold mb-8">
                  Order ID: <span className="text-gray-900 font-mono">{orderId.slice(-8)}</span>
                </div>
              )}

            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => onViewOrders?.()}
                className="flex-1 py-4 bg-[#1A1A1A] text-white font-bold tracking-[0.15em] hover:bg-black transition-all duration-300 uppercase text-[11px] rounded-2xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:-translate-y-0.5"
              >
                View My Orders
              </button>
              <button 
                onClick={onBack}
                className="flex-1 py-4 bg-white text-[#1A1A1A] border border-black/10 font-bold tracking-[0.15em] hover:bg-gray-50 hover:border-black/20 transition-all duration-300 uppercase text-[11px] rounded-2xl hover:-translate-y-0.5"
              >
                Return to Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
