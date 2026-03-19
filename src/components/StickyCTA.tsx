import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronRight } from 'lucide-react';

interface StickyCTAProps {
  onSubscribePlan?: (plan: "weekly" | "monthly") => void;
  selectedPlan?: "weekly" | "monthly";
  onPlanChange?: (plan: "weekly" | "monthly") => void;
  onCheckout: () => void;
  cartCount: number;
  cartTotal?: number;
}

export default function StickyCTA({ onCheckout, cartCount, cartTotal }: StickyCTAProps) {
  const rupee = "\u20B9";
  const showCart = cartCount > 0;

  return (
    <AnimatePresence>
      {showCart && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.2 }}
          className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[60]"
        >
          <button
            type="button"
            onClick={onCheckout}
            className="w-full flex items-center justify-between bg-[#1D1C1A] text-white p-3 sm:p-4 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] hover:bg-black transition-transform hover:-translate-y-1 active:translate-y-0 border border-white/10"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-white" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">
                  {cartCount} Item{cartCount !== 1 ? 's' : ''} added
                </div>
                {cartTotal !== undefined && (
                  <div className="text-sm sm:text-base font-bold flex items-baseline gap-1">
                    {rupee}{cartTotal} 
                    <span className="text-[8px] sm:text-[9px] text-white/50 font-medium uppercase tracking-wider">plus taxes</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2.5 sm:px-5 sm:py-3 bg-white text-[#1D1C1A] rounded-xl sm:rounded-full">
              View Cart <ChevronRight size={14} className="hidden sm:block" />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
