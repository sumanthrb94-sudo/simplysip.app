import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, MapPin, LogOut, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Order, UserProfile } from '../types';

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

const rupee = "\u20B9";

function AccordionItem({ title, icon, children, startOpen = false }: { title: string, icon: React.ReactNode, children: React.ReactNode, startOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(startOpen);

  return (
    <div className="border-b border-black/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="text-gray-500">{icon}</div>
          <span className="font-semibold text-[#1D1C1A]">{title}</span>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-6 pt-1 text-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      case 'paid': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  return (
    <div className="border border-black/5 rounded-xl transition-shadow hover:shadow-md">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-left p-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest ${getStatusColor(order.orderStatus)}`}>
                {order.orderStatus || 'pending'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">
                {new Date(order.createdAt).toLocaleString('en-IN', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            <p className="font-semibold text-gray-800">{order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-bold text-lg text-[#1D1C1A]">{rupee}{order.total}</p>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-black/5 px-4 pt-4 pb-5 space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Order Summary</h4>
              {order.items && order.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 max-w-[80%] truncate">{item.name} &times;{item.qty}</span>
                  <span className="font-medium text-gray-800">{rupee}{item.price * item.qty}</span>
                </div>
              ))}
              
              <div className="pt-3 border-t border-black/5 mt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Payment</span>
                  <span className="text-xs text-gray-800 capitalize font-medium">{order.paymentStatus || 'unpaid'}</span>
                </div>
                {order.deliverySlot && (
                  <div>
                    <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Delivery Slot</span>
                    <span className="text-xs text-gray-800 font-medium">{order.deliverySlot}</span>
                  </div>
                )}
                {order.assignedRider && (
                  <div>
                    <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Rider</span>
                    <span className="text-xs text-gray-800 font-medium">{order.assignedRider}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-black/5 mt-3 space-y-1">
                 <p className="text-xs text-gray-500 truncate">
                   <span className="font-semibold">Date & Time:</span> {new Date(order.createdAt).toLocaleString('en-IN', {
                     year: 'numeric', month: 'short', day: 'numeric',
                     hour: '2-digit', minute: '2-digit', hour12: true
                   })}
                 </p>
                 <p className="text-xs text-gray-500 truncate">
                   <span className="font-semibold">Order ID:</span> {order.id}
                 </p>
                 <p className="text-xs text-gray-500 truncate">
                   <span className="font-semibold">Payment ID:</span> {order.paymentId || 'N/A'}
                 </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProfilePanel({
  isOpen,
  onClose,
  user,
  userProfile, // This is actually the full UserProfile from App state
  orders,
  onLogout,
  onAddressUpdate,
  isAdmin,
  onAdminOpen
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any; // This is the firebase auth user object
  userProfile: Partial<UserProfile> | null;
  orders: Order[];
  onLogout: () => void;
  onAddressUpdate: (data: any) => void;
  isAdmin?: boolean;
  onAdminOpen?: () => void;
}) {  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    area: ''
  });
  const [addressType, setAddressType] = useState('Home');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isAddressLocked, setIsAddressLocked] = useState(false);
  const [location, setLocation] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isServiceable, setIsServiceable] = useState<boolean>(true);
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (userProfile) {
      const hasFullAddress = !!(userProfile.name && userProfile.phone && userProfile.address && userProfile.area && userProfile.area !== "Select Area");
      setIsAddressLocked(hasFullAddress);
      setLocation(userProfile.location || "");
      setLocationAccuracy(userProfile.locationAccuracy || null);

      setFormData({
        name: userProfile.name ?? user?.displayName ?? '',
        phone: userProfile.phone ?? user?.phoneNumber ?? '',
        address: userProfile.address || '',
        area: userProfile.area || ''
      });
      setAddressType(userProfile.addressType || 'Home');
    } else {
      setIsAddressLocked(false);
    }
  }, [userProfile, user]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  const stopLocationWatch = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
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
    return minDistance < 40 ? nearestZone : null; // Use same 40km radius as serviceability check
  };

  const checkServiceability = (lat: number, lng: number) => {
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

  const handleSaveAddress = async () => {
    if (!isServiceable) {
      alert("Sorry, your location is outside our service area and cannot be saved.");
      return;
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
      return alert("Please select your delivery area.");
    }
    if (!location) {
      return alert("Please ensure your location is detected before saving.");
    }
    setIsSavingAddress(true);
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
      alert("Address updated!");
    } catch (error) {
      alert("Failed to update address.");
      console.error(error);
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {isOpen && (
        <motion.div
          key="profile-panel"
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 right-0 z-[80] w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
        >
        <div className="flex items-center justify-between p-6 border-b border-black/10 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#1D1C1A]">{user?.displayName || 'My Account'}</h2>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-black">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <AccordionItem title="My Orders" icon={<Package size={20} />}>
            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map(order => (
                  <OrderCard order={order} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No orders yet.</p>
            )}
          </AccordionItem>

          <AccordionItem title="My Address" icon={<MapPin size={20} />}>
            <div className="space-y-4">
              <input
                type="text" name="name" value={formData.name} onChange={handleInputChange}
                placeholder="Full Name"
                disabled={isAddressLocked}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <input
                type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                placeholder="Phone Number"
                disabled={isAddressLocked}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <select
                name="area" value={formData.area} onChange={handleInputChange}
                disabled={isAddressLocked}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black appearance-none disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
              >
                {SERVICEABLE_ZONES.map(zone => (
                  <option key={zone.name} value={zone.name} disabled={zone.name === "Select Area"}>{zone.name}</option>
                ))}
              </select>
              <textarea
                name="address" value={formData.address} onChange={handleInputChange}
                placeholder="Complete Address"
                disabled={isAddressLocked}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:border-black resize-none h-24 disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <div className="flex items-center gap-x-6">
                {['Home', 'Office', 'Other'].map(type => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="radio" name="addressType" value={type}
                      checked={addressType === type}
                      onChange={(e) => setAddressType(e.target.value)}
                      disabled={isAddressLocked}
                      className="h-4 w-4 text-black border-gray-300 focus:ring-black disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-600">{type}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t border-black/5">
                <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-400">Location (Auto-detected)</label>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input 
                    type="text"
                    value={
                      isAddressLocked
                        ? (formData.area && formData.area !== "Select Area" ? formData.area : (location || "Not set"))
                        : isLocating
                          ? "Detecting location..."
                          : location
                            ? isServiceable ? (detectedZone || "Searching for nearest zone...") : "Unserviceable Area"
                            : "Location required"
                    }
                    readOnly
                    disabled={isAddressLocked}
                    className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm focus:outline-none font-light disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="Location required"
                  />
                  {!isAddressLocked && (
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="px-5 py-3 rounded-full border border-black/10 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#1D1C1A] hover:border-black/20 transition-colors"
                    >
                      {isLocating ? "Locating..." : "Retry"}
                    </button>
                  )}
                </div>
                {locationAccuracy !== null && !isAddressLocked && (
                  <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${ locationAccuracy <= 10 ? 'text-green-600' : locationAccuracy <= 50 ? 'text-yellow-600' : locationAccuracy <= 1000 ? 'text-gray-500' : 'text-red-600' }`}>
                    Accuracy: {locationAccuracy}m
                    {locationAccuracy <= 10 && ' (Excellent)'}
                    {locationAccuracy > 10 && locationAccuracy <= 50 && ' (Good)'}
                    {locationAccuracy > 50 && locationAccuracy <= 1000 && ' (Fair)'}
                    {locationAccuracy > 1000 && ' (Poor)'}
                  </div>
                )}
                {locationError && !isAddressLocked && <div className="text-[10px] uppercase tracking-[0.2em] text-red-500">{locationError}</div>}
                {!isServiceable && location && !isAddressLocked && (
                  <div className="mt-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                    Location Unserviceable. We currently only deliver to Cyberabad, Secunderabad, and Hyderabad.
                  </div>
                )}
              </div>

              {isAddressLocked ? (
                <button
                  onClick={() => setIsAddressLocked(false)}
                  className="w-full py-3 border border-black/10 text-[#1D1C1A] font-semibold tracking-wide text-xs rounded-full hover:border-black/20 transition-colors"
                >
                  Edit Address
                </button>
              ) : (
                <button
                  onClick={handleSaveAddress}
                  disabled={isSavingAddress}
                  className="w-full py-3 bg-[#1D1C1A] text-white font-semibold tracking-wide text-xs rounded-full hover:bg-black transition-colors disabled:opacity-60"
                >
                  {isSavingAddress ? 'Saving...' : 'Save Address'}
                </button>
              )}
            </div>
          </AccordionItem>
        </div>

        <div className="p-6 mt-auto shrink-0">
          {isAdmin && onAdminOpen && (
            <button
              onClick={onAdminOpen}
              className="w-full flex items-center justify-center gap-3 py-3 mb-3 bg-[#1D1C1A] text-white font-semibold tracking-wide text-sm rounded-full hover:bg-black transition-colors"
            >
              <LayoutDashboard size={16} />
              Admin Dashboard
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 py-3 border border-black/10 text-[#1D1C1A] font-semibold tracking-wide text-sm rounded-full hover:border-black/20 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}