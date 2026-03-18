﻿import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
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
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, idx) => (
        <span
          key={idx}
          className={`h-1.5 w-6 rounded-full ${idx < clamped ? "bg-[#1D1C1A]" : "bg-black/10"}`}
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
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="px-2 text-center flex flex-col flex-1 min-w-0">
          <h4 className="text-base sm:text-xl font-semibold tracking-tight text-[#1D1C1A] font-display whitespace-nowrap overflow-hidden text-ellipsis">
            {product.name}
          </h4>
          <div className="flex items-baseline justify-center gap-3 mt-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#6F6A63] border border-black/10 rounded-full min-w-[72px] h-6 px-2 flex items-center justify-center">
              25% Off
            </span>
            <span className="text-[11px] sm:text-sm text-[#A7A29C] line-through font-medium">
              {"\u20B9"}{product.mrp}
            </span>
            <span className="text-sm sm:text-lg font-semibold text-[#1D1C1A]">
              {"\u20B9"}{product.offerPrice}
            </span>
          </div>
          <IngredientTicker desc={product.desc} />
        </div>
      </button>
      <div className="mt-4 flex items-center justify-center h-9">
        {qty > 0 ? (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onDecrement(product)}
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-[#1D1C1A] text-base font-semibold text-[#1D1C1A] hover:bg-black/5 transition-colors"
              aria-label={`Decrease ${product.name}`}
            >
              -
            </button>
            <span className="text-sm font-semibold text-[#1D1C1A] w-6 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => onIncrement(product)}
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-[#1D1C1A] bg-[#1D1C1A] text-base font-semibold text-white hover:bg-black transition-colors"
              aria-label={`Increase ${product.name}`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onIncrement(product)}
            className="h-9 px-6 rounded-full border-2 border-[#1D1C1A] text-[11px] font-bold tracking-[0.15em] uppercase text-[#1D1C1A] hover:bg-[#1D1C1A] hover:text-white transition-colors"
          >
            Add to Cart
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
  const panelVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 20 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-backdrop"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        />
      )}
      {isOpen && (
        <motion.div
          key="product-panel"
          className="fixed z-[90] bg-white left-1/2 top-1/2 w-[95vw] sm:w-[90vw] max-w-4xl h-[90vh] sm:h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="relative w-full h-[35%] min-h-[200px] sm:h-full sm:w-1/2 shrink-0 bg-[#F7F5F0]">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <button 
                onClick={onClose} 
                className="absolute top-4 left-4 sm:hidden h-10 w-10 flex items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-md z-10 text-[#1D1C1A]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 relative bg-white w-full sm:w-1/2">
              <div className="hidden sm:flex absolute top-6 right-6 z-10">
                <button 
                  onClick={onClose} 
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F7F5F0] hover:bg-gray-200 transition-colors text-[#1D1C1A]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth">
                <div className="mb-6 sm:pr-10">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="inline-block px-3 py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.25em] font-bold text-[#1D1C1A] bg-[#F7F5F0] rounded-full">
                      Cold Pressed
                    </span>
                    <span className="inline-block px-3 py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.25em] font-bold text-white bg-[#1D1C1A] rounded-full">
                      25% Off
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold text-[#1D1C1A] tracking-tight font-display mb-2">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    {product.tagline}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#F7F5F0] rounded-2xl p-4 sm:p-5">
                    <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-1">Calories</div>
                    <div className="text-lg sm:text-xl font-bold text-[#1D1C1A]">{product.nutrition.calories} kcal</div>
                  </div>
                  <div className="bg-[#F7F5F0] rounded-2xl p-4 sm:p-5">
                    <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-1">Vitamin</div>
                    <div className="text-lg sm:text-xl font-bold text-[#1D1C1A]">{product.nutrition.vitamin}</div>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-4">
                    Ingredients
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {product.ingredients.map(ing => (
                      <span key={ing} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-semibold text-[#1D1C1A]">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-4">
                    Benefits
                  </h4>
                  <ul className="space-y-3">
                    {product.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-semibold text-[#1D1C1A]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1D1C1A]" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-4 p-4 sm:p-5 bg-[#F7F5F0] rounded-2xl mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sweetness</span>
                  <SweetnessScale value={product.sweetness} />
                </div>
              </div>

              <div className="shrink-0 p-4 sm:px-10 sm:py-6 bg-white border-t border-gray-100 flex items-center justify-between gap-4 z-10">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-1">Total Price</div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                    <div className="text-xl sm:text-3xl font-bold text-[#1D1C1A]">
                      {"\u20B9"}{product.offerPrice}
                    </div>
                    {product.mrp && (
                      <div className="text-xs sm:text-sm text-gray-400 line-through font-medium mt-0.5 sm:mt-0">
                        {"\u20B9"}{product.mrp}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {qty > 0 ? (
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => onDecrement(product)}
                        className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full border-2 border-[#1D1C1A] text-lg font-semibold text-[#1D1C1A] flex items-center justify-center hover:bg-black/5 transition-colors"
                      >
                        -
                      </button>
                      <span className="text-base sm:text-lg font-bold w-4 sm:w-6 text-center text-[#1D1C1A]">{qty}</span>
                      <button
                        onClick={() => onIncrement(product)}
                        className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full border-2 border-[#1D1C1A] bg-[#1D1C1A] text-lg font-semibold text-white flex items-center justify-center hover:bg-black transition-colors"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onIncrement(product)}
                      className="px-5 py-3.5 sm:px-8 sm:py-4 bg-[#1D1C1A] text-white rounded-full text-[10px] sm:text-xs font-bold tracking-[0.15em] uppercase hover:bg-black transition-colors whitespace-nowrap"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export default function Menu({ cart, menuItems, onIncrement, onDecrement, onCheckout, onCartTotalChange }: MenuProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});

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
  const layeredFlavours = products.filter((item) => item.category === "Signature Blends");
  const pureExpression = products.filter((item) => item.category === "Single Fruit Series");
  const cartCount = (Object.values(cartItems) as number[]).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = products.reduce((sum: number, item) => {
    const qty = cartItems[item.id] ?? 0;
    if (!qty) return sum;
    return sum + (getOfferPrice(item) * qty);
  }, 0);
  const subscriptionTotal =
    ((cartItems.sub_weekly ?? 0) ? 799 : 0) + ((cartItems.sub_monthly ?? 0) ? 2599 : 0);
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
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-[#6F6A63] font-medium">Flat 25% Off {"\u2014"} Limited Launch Offer</p>
        </motion.div>

        {menuItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">Loading collection...</div>
        ) : (
          <div className="space-y-16 sm:space-y-20">
            <CartState count={cartCount} total={combinedTotal} onCheckout={onCheckout} />
            <div className="space-y-8 sm:space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63] mb-3">Layered Flavours</p>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-[#1D1C1A] font-display">
                    Blends with depth. Clean finish.
                  </h3>
                </div>
                <div className="hidden md:block h-px w-48 bg-black/10"></div>
              </div>
              {renderGrid(layeredFlavours)}
            </div>

            <div className="space-y-8 sm:space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-[#6F6A63] mb-3">Pure Expression</p>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-[#1D1C1A] font-display">
                    Single fruit. Pure cold-pressed juice.
                  </h3>
                </div>
                <div className="hidden md:block h-px w-48 bg-black/10"></div>
              </div>
              {renderGrid(pureExpression)}
            </div>
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
