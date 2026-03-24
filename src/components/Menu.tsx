import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Star } from 'lucide-react';
import { Product as ProductData } from '../types';
import { getOfferPrice, getMrp } from '../pricing';

interface MenuProps {
  cart: Record<string, number>;
  menuItems: ProductData[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onCheckout: () => void;
  onCartTotalChange: (total: number) => void;
}

function IngredientTicker({ desc }: { desc?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    if (!desc) return;
    const update = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;
      const overflow = content.scrollWidth > container.clientWidth;
      setShouldScroll(overflow);
      if (overflow) {
        const travel = Math.max(0, content.scrollWidth - container.clientWidth);
        const seconds = Math.min(18, Math.max(8, travel / 20));
        setDistance(travel);
        setDuration(seconds);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [desc]);

  if (!desc) return null;
  const parts = desc
    .split(/\u2022/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div ref={containerRef} className="mt-2 text-[11px] sm:text-xs text-[#6F6A63] max-w-full overflow-hidden whitespace-nowrap">
      <div
        ref={contentRef}
        className={`inline-flex items-center ${shouldScroll ? "marquee" : ""}`}
        style={
          shouldScroll
            ? ({
                "--marquee-distance": `${distance}px`,
                "--marquee-duration": `${duration}s`
              } as CSSProperties)
            : undefined
        }
      >
        {parts.map((part, index) => (
          <span key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 && (
              <span className="mx-1 text-[#C6A05A]">{"\u2605"}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

const defaultBenefits = ["Detox support", "Gut health", "Skin glow", "Immunity boost"];
const buildProduct = (item: any, index: number): ProductData => {
  const parts = (item.desc || "")
    .split(/\u2022|,/)
    .map((part: string) => part.trim())
    .filter(Boolean);
  const sweetness = item.sweetness ?? ((index % 5) + 1);
  return {
    ...item,
    id: String(item.id ?? index),
    tagline: item.tagline || item.desc || "Cold-pressed blend crafted for daily balance",
    bestSeller: item.bestSeller ?? index === 0,
    sweetness,
    nutrition: item.nutrition ?? {
      calories: 90 + (index % 6) * 15,
      vitamin: `${50 + (index % 5) * 10}%`,
      preservatives: "None"
    },
    benefits: item.benefits || defaultBenefits,
    ingredients: parts.length > 0 ? parts : ["Green Apple", "Spinach", "Ginger", "Lime"]
  };
};

function SweetnessScale({ value }: { value: number }) {
  const clamped = Math.max(1, Math.min(5, value));
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {Array.from({ length: 5 }, (_, idx) => (
        <span
          key={idx}
          className={`h-1.5 w-3 rounded-full ${idx < clamped ? "bg-green-600" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

function MenuCard({
  product,
  onClick,
  onIncrement,
  onDecrement,
  qty
}: {
  product: ProductData;
  onClick: (product: ProductData) => void;
  onIncrement: (product: ProductData) => void;
  onDecrement: (product: ProductData) => void;
  qty: number;
}) {
  return (
    <div className="group text-left w-full">
      <button type="button" onClick={() => onClick(product)} className="w-full text-left">
        <div className="relative aspect-[4/5] sm:aspect-[3/4] w-full bg-[#FBFAF7] rounded-[2rem] overflow-hidden mb-3 sm:mb-6 shadow-[0_35px_80px_-60px_rgba(0,0,0,0.35)] border border-black/5 transition-transform duration-500 group-hover:-translate-y-1">
          {product.bestSeller && (
            <div className="absolute top-4 left-4 z-10 bg-[#1D1C1A] text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full">
              Best Seller
            </div>
          )}
          <img
            src={product.image}
            alt={product.name}
            className={`w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105 ${(product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'grayscale opacity-60' : ''}`}
            referrerPolicy="no-referrer"
          />
          {(product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="bg-white/95 px-4 py-3 rounded-2xl shadow-xl border border-black/5 transform -rotate-2 max-w-[80%] text-center">
                <span className="text-[10px] font-black uppercase tracking-tight text-[#1D1C1A] leading-tight block">Preparing new batch!</span>
                <span className="text-[8px] font-medium text-gray-500 block mt-1">High demand for this blend 🥤</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-2 text-center flex flex-col flex-1 min-w-0">
          <h4 className="text-base sm:text-xl font-semibold tracking-tight text-[#1D1C1A] font-display whitespace-nowrap overflow-hidden text-ellipsis">
            {product.name}
          </h4>
          <div className="flex items-baseline justify-center gap-3 mt-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#6F6A63] border border-black/10 rounded-full min-w-[72px] h-6 px-2 flex items-center justify-center">
              {product.discountPercent ? `${product.discountPercent}% Off` : "Special Offer"}
            </span>
            <span className="text-[11px] sm:text-sm text-[#A7A29C] line-through font-medium">
              {"\u20B9"}{product.mrp}
            </span>
            <span className="text-sm sm:text-lg font-semibold text-[#1D1C1A]">
              {"\u20B9"}{product.offerPrice}
            </span>
          </div>
          <IngredientTicker desc={product.desc} />
          {product.inventory !== undefined && product.inventory > 0 && product.inventory <= 10 && product.inStock !== false && (
            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-amber-600">Only {product.inventory} left in stock</p>
          )}
        </div>
      </button>
      <div className="mt-4 flex items-center justify-center h-9">
        {qty > 0 ? (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDecrement(product); }}
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-[#1D1C1A] text-base font-semibold text-[#1D1C1A] hover:bg-black/5 transition-colors"
              aria-label={`Decrease ${product.name}`}
            >
              -
            </button>
            <span className="text-sm font-semibold text-[#1D1C1A] w-6 text-center">{qty}</span>
            <button
              type="button"
              disabled={product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)}
              onClick={(e) => { e.stopPropagation(); onIncrement(product); }}
              className={`h-9 w-9 flex items-center justify-center rounded-full border-2 border-[#1D1C1A] bg-[#1D1C1A] text-base font-semibold text-white transition-colors ${ (product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
              aria-label={`Increase ${product.name}`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)}
            onClick={(e) => { e.stopPropagation(); onIncrement(product); }}
            className={`h-9 px-6 rounded-full border-2 border-[#1D1C1A] text-[11px] font-bold tracking-[0.15em] uppercase transition-colors ${ (product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50' : 'text-[#1D1C1A] hover:bg-[#1D1C1A] hover:text-white'}`}
          >
            {(product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'Preparing Batch' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
}

function CartState({ count, total, onCheckout }: { count: number; total: number; onCheckout: () => void }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-center">
      <div className="bg-white/90 backdrop-blur border border-black/5 rounded-full px-5 sm:px-6 py-3 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)] text-sm font-medium text-[#1D1C1A] flex items-center gap-4">
        <span>
          Cart: {count} item{count > 1 ? "s" : ""} {"\u2022"} {"\u20B9"}{total}
        </span>
        <button
          onClick={onCheckout}
          className="px-4 py-2 bg-[#1D1C1A] text-white rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase hover:bg-black transition-colors"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}

function ProductPanel({
  product,
  isOpen,
  onClose,
  onIncrement,
  onDecrement,
  qty
}: {
  product: ProductData | null;
  isOpen: boolean;
  onClose: () => void;
  onIncrement: (product: ProductData) => void;
  onDecrement: (product: ProductData) => void;
  qty: number;
}) {
  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        />
      )}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center pointer-events-none sm:p-6">
        <motion.div
          key="product-panel"
          className="bg-white w-full sm:max-w-4xl h-[85vh] sm:h-[80vh] sm:max-h-[800px] rounded-t-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row pointer-events-auto"
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 250 }}
        >
            {/* Image Area */}
            <div className="relative w-full h-[40%] min-h-[280px] sm:min-h-0 sm:h-full sm:w-[45%] shrink-0 bg-[#F4F4F5] overflow-hidden group">
              {/* Subtle top gradient on mobile to ensure the close button remains visible against any image */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-transparent z-10 pointer-events-none sm:hidden" />
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover object-[center_50%] scale-[1.15] sm:scale-105 drop-shadow-2xl mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.20] sm:group-hover:scale-[1.10]"
              />
              <button 
                onClick={onClose} 
                className="absolute top-4 right-4 sm:hidden h-8 w-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-md text-gray-900 z-20"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0 relative bg-white w-full sm:w-[55%]">
              <div className="hidden sm:flex absolute top-4 right-4 z-10">
                <button 
                  onClick={onClose} 
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-track]:bg-transparent">
                
                {/* Title & Tags */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {product.bestSeller && (
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-100 rounded">
                        Bestseller
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-green-800 bg-green-100 rounded">
                      Cold Pressed
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {product.tagline}
                  </p>
                </div>

                {/* Price (In-flow) */}
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-gray-900">{"\u20B9"}{product.offerPrice}</span>
                  {product.mrp && (
                    <span className="text-sm text-gray-400 line-through mb-1">{"\u20B9"}{product.mrp}</span>
                  )}
                  {product.mrp && (
                     <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded mb-1 ml-1">
                       {product.discountPercent || Math.round(((product.mrp - product.offerPrice) / product.mrp) * 100)}% OFF
                     </span>
                  )}
                </div>

                <hr className="border-gray-100" />

                {/* Ingredients */}
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">What's inside</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.ingredients.map(ing => (
                      <span key={ing} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Benefits */}
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Why you'll love it</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {product.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <Star size={14} className="text-green-600 fill-green-600 shrink-0" />
                        <span className="font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nutrition Grid */}
                <div className="pb-4">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Nutritional Profile</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Energy</span>
                      <span className="text-sm font-bold text-gray-900">{product.nutrition.calories} kcal</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Vitamins</span>
                      <span className="text-sm font-bold text-gray-900">{product.nutrition.vitamin}</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Sweetness</span>
                      <SweetnessScale value={product.sweetness} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Zomato-style Sticky Bottom Bar */}
              <div className="shrink-0 p-4 sm:p-5 bg-white border-t border-gray-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] flex items-center justify-between gap-4 z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Item Total</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-gray-900">{"\u20B9"}{product.offerPrice * (qty || 1)}</span>
                    {product.mrp && qty > 0 && (
                      <span className="text-xs text-gray-400 line-through">{"\u20B9"}{product.mrp * qty}</span>
                    )}
                  </div>
                </div>

                <div className="min-w-[130px] sm:min-w-[150px]">
                  {qty > 0 ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl h-12 px-2 shadow-sm">
                      <button
                        onClick={() => onDecrement(product)}
                        className="w-10 h-10 flex items-center justify-center text-green-700 font-bold text-xl hover:bg-green-100 rounded-lg transition-colors"
                      >
                        -
                      </button>
                      <span className="text-green-800 font-bold text-sm">{qty}</span>
                      <button
                        disabled={product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)}
                        onClick={() => onIncrement(product)}
                        className={`w-10 h-10 flex items-center justify-center font-bold text-xl rounded-lg transition-colors ${ (product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'text-gray-300 cursor-not-allowed' : 'text-green-700 hover:bg-green-100'}`}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)}
                      onClick={() => onIncrement(product)}
                      className={`w-full h-12 rounded-xl text-sm font-bold tracking-wide transition-colors shadow-sm ${ (product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    >
                      {(product.inStock === false || (product.inventory !== undefined && product.inventory <= 0)) ? 'Preparing Batch' : 'Add to Cart'}
                    </button>
                  )}
                </div>
              </div>
            </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export default function Menu({ cart, menuItems, onIncrement, onDecrement, onCheckout, onCartTotalChange }: MenuProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<string>('');

  const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

  const products = menuItems.map((item, index) =>
    buildProduct(
      {
        ...item,
        mrp: getMrp(item),
        offerPrice: getOfferPrice(item)
      },
      index
    )
  );

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  const groupedProducts = categories.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.category === cat);
    return acc;
  }, {} as Record<string, ProductData[]>);

  useEffect(() => {
    if (categories.length > 0 && !activeSection) {
      setActiveSection('subscriptions'); // Default to subscriptions or first category
    }
  }, [categories, activeSection]);

  useEffect(() => {
    const normalized = Object.fromEntries(
      Object.entries(cart || {}).map(([k, v]) => [k, Number(v) || 0])
    );
    setCartItems(normalized);
  }, [cart]);

  useEffect(() => {
    if (!isPanelOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPanelOpen]);

  useEffect(() => {
    if (isPanelOpen) return;
    if (!selectedProduct) return;
    const timer = window.setTimeout(() => setSelectedProduct(null), 250);
    return () => window.clearTimeout(timer);
  }, [isPanelOpen, selectedProduct]);

  // ScrollSpy to automatically detect which section is in view
  useEffect(() => {
    const handleScroll = () => {
      const allSections = ['subscriptions', ...categories.map(slugify)];
      let current = allSections[0];
      for (const id of allSections) {
        const el = document.getElementById(id) || (id === 'subscriptions' ? document.getElementById('subscription') : null);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250) {
            current = id;
          }
        }
      }
      setActiveSection((prev) => {
        if (prev !== current) {
          const btn = document.getElementById(`nav-btn-${current}`);
          if (btn && btn.parentElement) {
            btn.parentElement.scrollTo({
              left: btn.offsetLeft - btn.parentElement.clientWidth / 2 + btn.clientWidth / 2,
              behavior: 'smooth'
            });
          }
          return current;
        }
        return prev;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  // Intercept hardware back button for the product panel
  useEffect(() => {
    if (isPanelOpen) {
      window.history.pushState({ modal: 'product' }, '');
      const handlePopState = () => setIsPanelOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isPanelOpen]);

  const handleIncrementClick = (product: ProductData) => {
    onIncrement(product.id);
  };

  const handleDecrementClick = (product: ProductData) => {
    onDecrement(product.id);
  };

  const openPanel = (product: ProductData) => {
    setSelectedProduct(product);
    setIsPanelOpen(true);
  };


  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id) || (id === 'subscriptions' ? document.getElementById('subscription') : null);
    if (el) {
      const offset = id === 'subscriptions' ? 40 : 140;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Replaced with dynamic products mapping above
  const cartCount = Object.keys(cartItems).reduce((sum, id) => {
    const isValid = id === 'sub_weekly' || id === 'sub_monthly' || products.some(p => p.id === id);
    return sum + (isValid ? (cartItems[id] ?? 0) : 0);
  }, 0);
  const cartTotal = products.reduce((sum: number, item) => {
    const qty = cartItems[item.id] ?? 0;
    if (!qty) return sum;
    return sum + (getOfferPrice(item) * qty);
  }, 0);
  const subscriptionTotal =
    ((cartItems.sub_weekly ?? 0) * 799) + ((cartItems.sub_monthly ?? 0) * 2599);
  const combinedTotal = cartTotal + subscriptionTotal;

  useEffect(() => {
    onCartTotalChange(combinedTotal);
  }, [combinedTotal, onCartTotalChange]);

  const renderGrid = (items: ProductData[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-10 md:gap-14">
      {items.map((item, index) => (
        <motion.div
          key={item.id || index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
        >
          <MenuCard
            product={item}
            onClick={openPanel}
            onIncrement={handleIncrementClick}
            onDecrement={handleDecrementClick}
            qty={cartItems[item.id] ?? 0}
          />
        </motion.div>
      ))}
    </div>
  );

  return (
    <section id="menu" className="scroll-mt-24 sm:scroll-mt-28 py-16 sm:py-32 px-4 sm:px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 sm:mb-20 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63] mb-3">SIMPLY SIP</p>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight mb-3 text-[#1D1C1A] font-display">Layered flavours and pure expression.</h2>
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-[#6F6A63] font-medium">Limited Launch Offer {"\u2014"} Grab yours now</p>
        </motion.div>

        <div className="sticky top-[70px] sm:top-[85px] z-40 bg-white/80 backdrop-blur-xl border-y border-black/5 py-4 px-4 sm:px-6 -mx-4 sm:mx-0 mb-8 sm:mb-12 flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button 
            id="nav-btn-subscriptions"
            onClick={() => scrollToSection('subscriptions')} 
            className={`px-5 py-3 rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase shrink-0 flex items-center gap-2 transition-all ${
              activeSection === 'subscriptions' 
                ? 'bg-[#1D1C1A] text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]' 
                : 'bg-[#F9F8F6] border border-black/5 text-[#1D1C1A] hover:bg-gray-100'
            }`}
          >
            <Star size={14} className={activeSection === 'subscriptions' ? "text-yellow-400 fill-yellow-400" : "text-gray-400"} /> Subscriptions
          </button>
          
          {categories.map(cat => (
            <button 
              key={cat}
              id={`nav-btn-${slugify(cat)}`}
              onClick={() => scrollToSection(slugify(cat))} 
              className={`px-5 py-3 rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase shrink-0 transition-all ${
                activeSection === slugify(cat)
                  ? 'bg-[#1D1C1A] text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]'
                  : 'bg-[#F9F8F6] border border-black/5 text-[#1D1C1A] hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {menuItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">Loading collection...</div>
        ) : (
          <div className="space-y-16 sm:space-y-20">
            <CartState count={cartCount} total={combinedTotal} onCheckout={onCheckout} />
            {categories.map(cat => (
              <div key={cat} id={slugify(cat)} className="space-y-8 sm:space-y-10 scroll-mt-40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63] mb-3">{cat.includes('Series') || cat.includes('Blends') ? 'Collection' : 'Juice Category'}</p>
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-[#1D1C1A] font-display">
                      {cat}. {cat === 'Signature Blends' ? 'Blends with depth. Clean finish.' : cat === 'Single Fruit Series' ? 'Single fruit. Pure cold-pressed juice.' : 'Freshly crafted for your wellness.'}
                    </h3>
                  </div>
                  <div className="hidden md:block h-px w-48 bg-black/10"></div>
                </div>
                {renderGrid(groupedProducts[cat])}
              </div>
            ))}
          </div>
        )}
      </div>
      <ProductPanel
        product={selectedProduct}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onIncrement={handleIncrementClick}
        onDecrement={handleDecrementClick}
        qty={selectedProduct ? (cartItems[selectedProduct.id] ?? 0) : 0}
      />
    </section>
  );
}
