import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, MapPin, LogOut, ChevronDown, LayoutDashboard, Home, Briefcase, Navigation, ShoppingBag, Clock, FileText, Receipt } from 'lucide-react';
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
    <div className="bg-white rounded-[2rem] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border border-black/5 mb-5 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex items-center gap-4 text-[#1D1C1A]">
          <div className="w-10 h-10 rounded-full bg-[#F9F8F6] flex items-center justify-center border border-black/5">{icon}</div>
          <span className="font-bold tracking-tight text-lg">{title}</span>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden bg-white"
          >
            <div className="px-5 sm:px-6 pb-6 pt-1 text-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({ order }: { order: Order; key?: React.Key }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'out-for-delivery': return 'bg-blue-100 text-blue-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  const itemString = order.items?.map((i: any) => `${i.qty}x ${i.name}`).join(', ') || '';

  return (
    <div className="bg-[#FAFAFA] border border-black/5 rounded-2xl transition-all hover:border-black/15 overflow-hidden">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-left p-4 sm:p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm ${getStatusColor(order.orderStatus)}`}>
                {(order.orderStatus || 'pending').replace(/-/g, ' ')}
              </span>
            </div>
            <p className="font-bold text-sm text-[#1A1A1A] line-clamp-1 mb-1 leading-snug">
              {itemString}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold flex items-center gap-1.5">
              <Clock size={10} />
              {new Date(order.createdAt).toLocaleString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end">
            <p className="font-bold text-base text-[#1A1A1A]">{rupee}{order.total}</p>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 mt-2 hover:text-blue-800 transition-colors">
              {isExpanded ? 'Hide' : 'Details'} <ChevronDown size={12} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
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
            <div className="border-t border-black/5 px-4 sm:px-5 pt-4 pb-5 space-y-4 bg-white/50">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5 mb-3">
                  <Receipt size={12} /> Receipt
                </h4>
                <div className="space-y-2.5">
                  {order.items && order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 max-w-[75%]">
                        <span className="w-5 h-5 rounded bg-[#F9F8F6] border border-black/5 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {item.qty}
                        </span>
                        <span className="font-semibold text-[#1A1A1A] truncate">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#1A1A1A]">{rupee}{item.price * item.qty}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-black/10">
                    <span className="text-gray-500 font-medium">Delivery Fee</span>
                    <span className="font-semibold text-[#1A1A1A]">{order.deliveryFee === 0 ? 'Free' : `${rupee}${order.deliveryFee}`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-black/10">
                    <span className="font-bold text-[#1A1A1A]">Total Paid</span>
                    <span className="font-bold text-lg text-[#1A1A1A]">{rupee}{order.total}</span>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-black/5 grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Payment</span>
                  <span className="text-xs text-[#1A1A1A] capitalize font-bold">{order.paymentStatus || 'unpaid'}</span>
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

              <div className="pt-4 border-t border-black/5 space-y-2">
                 <div className="text-xs flex items-center justify-between text-gray-500 bg-white p-2 rounded-lg border border-black/5">
                   <span className="font-semibold uppercase tracking-wider text-[9px]">Order ID</span> 
                   <span className="font-mono tracking-wider text-[#1A1A1A] truncate ml-2">{order.id}</span>
                 </div>
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
        name: userProfile.name || user?.displayName || '',
        phone: userProfile.phone || (user?.phoneNumber ? user.phoneNumber.replace(/[^0-9]/g, '').slice(-10) : ''),
        address: userProfile.address || '',
        area: userProfile.area || ''
      });
      setAddressType(userProfile.addressType || 'Home');
    } else {
      setIsAddressLocked(false);
    }
  }, [userProfile?.address, userProfile?.area, userProfile?.phone, userProfile?.name, userProfile?.location, userProfile?.locationAccuracy, userProfile?.addressType, user?.displayName, user?.phoneNumber]);

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
          className="fixed top-0 right-0 z-[80] w-full max-w-md h-full bg-[#F9F8F6] shadow-2xl flex flex-col"
        >
        <div className="bg-white px-6 pt-10 pb-8 rounded-b-[2.5rem] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] border-b border-black/5 shrink-0 z-10 relative">
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 p-2 bg-[#F9F8F6] rounded-full text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center text-2xl font-bold font-display shadow-lg">
              {(user?.displayName || userProfile?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-1">Welcome back</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#1D1C1A] font-display">
                {user?.displayName || userProfile?.name || 'My Account'}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-[200px]">{user?.email || user?.phoneNumber}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2 [&::-webkit-scrollbar]:hidden">
          <AccordionItem title="My Orders" icon={<ShoppingBag size={20} />} startOpen={true}>
            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((order, idx) => (
                  <OrderCard key={order.id || idx} order={order} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#FAFAFA] rounded-2xl border border-black/5">
                <ShoppingBag size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-bold text-[#1A1A1A]">No orders yet</p>
                <p className="text-xs text-gray-500 mt-1">When you place an order, it will appear here.</p>
              </div>
            )}
          </AccordionItem>

          <AccordionItem title="Delivery Details" icon={<MapPin size={20} />}>
            {isAddressLocked ? (
              <div className="border border-black/10 rounded-2xl p-5 bg-[#FAFAFA] relative overflow-hidden transition-all hover:border-black/20 mt-1">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1A1A1A]"></div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center shrink-0 text-[#1A1A1A]">
                    {addressType === 'Office' ? <Briefcase size={18} /> : addressType === 'Home' ? <Home size={18} /> : <MapPin size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <h4 className="text-sm font-bold text-[#1A1A1A]">{addressType} Address</h4>
                      <button
                        type="button"
                        onClick={() => setIsAddressLocked(false)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
                      >
                        Edit
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
              <div className="space-y-6 pt-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light" placeholder="e.g. John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 ml-1">Phone Number</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-3.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all font-medium placeholder:text-gray-400 placeholder:font-light" placeholder="10-digit mobile number" required />
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
                      disabled={isSavingAddress}
                      className="w-full py-4 bg-[#1D1C1A] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-60"
                    >
                      {isSavingAddress ? 'Saving...' : 'Save Address'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AccordionItem>
        </div>

        <div className="p-5 sm:p-6 mt-auto shrink-0 bg-white border-t border-black/5 relative z-10">
          {isAdmin && onAdminOpen && (
            <button
              onClick={onAdminOpen}
              className="w-full flex items-center justify-center gap-3 py-3.5 mb-3 bg-[#1D1C1A] text-white font-bold tracking-widest text-[11px] uppercase rounded-xl hover:bg-black transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]"
            >
              <LayoutDashboard size={16} />
              Admin Dashboard
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-black/10 text-[#1D1C1A] font-bold tracking-widest text-[11px] uppercase rounded-xl hover:border-black/20 hover:bg-[#FAFAFA] transition-all"
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