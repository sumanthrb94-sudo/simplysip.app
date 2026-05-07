import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { resolveProductImage, FALLBACK_PRODUCT_IMAGE } from '../data/seedMenu';

type Plan = 'weekly' | 'monthly';

interface SubscriptionItem {
  id: string;
  name: string;
  mrp: number;
  offerPrice: number;
  desc: string;
  image?: string;
}

interface SubscriptionProps {
  onSubscribe: (subscriptionId: string) => void;
  subscriptionItems?: SubscriptionItem[];
}

const DEFAULT_ITEMS: SubscriptionItem[] = [
  {
    id: "sub_normal_weekly",
    name: "Regular Fruit Bowl - Weekly",
    mrp: 1260,
    offerPrice: 899,
    image: "/images/subscription-normal-fruit-bowl.webp",
    desc: "Fresh fruit bowl (450g) delivered daily for 7 days"
  },
  {
    id: "sub_normal_monthly",
    name: "Regular Fruit Bowl - Monthly",
    mrp: 4799,
    offerPrice: 3299,
    image: "/images/subscription-normal-fruit-bowl.webp",
    desc: "Fresh fruit bowl (450g) delivered daily for 28 days"
  },
  {
    id: "sub_exotic_weekly",
    name: "Exotic Fruit Bowl - Weekly",
    mrp: 1890,
    offerPrice: 1299,
    image: "/images/subscription-exotic-fruit-bowl.webp",
    desc: "Premium exotic fruit bowl (500g) delivered daily for 7 days"
  },
  {
    id: "sub_exotic_monthly",
    name: "Exotic Fruit Bowl - Monthly",
    mrp: 6999,
    offerPrice: 4499,
    image: "/images/subscription-exotic-fruit-bowl.webp",
    desc: "Premium exotic fruit bowl (500g) delivered daily for 28 days"
  }
];

export default function Subscription({ onSubscribe, subscriptionItems }: SubscriptionProps) {
  const items = subscriptionItems && subscriptionItems.length > 0 ? subscriptionItems : DEFAULT_ITEMS;
  const [plan, setPlan] = useState<Plan>('weekly');

  const rupee = "₹";

  const filteredItems = useMemo(
    () => items.filter(item => item.id.toLowerCase().includes(plan)),
    [items, plan]
  );

  // Compare each monthly plan against its weekly counterpart (same id family)
  // and surface the largest "switch to monthly" savings as a nudge on the toggle.
  const maxMonthlySavings = useMemo(() => {
    const weekly = items.filter(i => i.id.toLowerCase().includes('weekly'));
    const monthly = items.filter(i => i.id.toLowerCase().includes('monthly'));
    let best = 0;
    for (const m of monthly) {
      const pairId = m.id.toLowerCase().replace('monthly', 'weekly');
      const w = weekly.find(item => item.id.toLowerCase() === pairId);
      if (!w || !w.offerPrice) continue;
      const fourWeekCost = w.offerPrice * 4;
      if (fourWeekCost <= 0) continue;
      const pct = Math.round(((fourWeekCost - m.offerPrice) / fourWeekCost) * 100);
      if (pct > best) best = pct;
    }
    return best;
  }, [items]);

  const gridColsClass =
    filteredItems.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3'
    : filteredItems.length === 2 ? 'md:grid-cols-2'
    : 'md:grid-cols-1';

  return (
    <section id="subscriptions" className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden scroll-mt-10">
      <div className="absolute inset-0 z-0">
        <img
          src="/images/site-bg.webp"
          alt="Premium SimplySip background"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/90 backdrop-blur-2xl p-8 sm:p-10 md:p-16 rounded-[2.2rem] sm:rounded-[2.5rem] shadow-[0_40px_90px_-60px_rgba(0,0,0,0.4)] border border-black/5"
        >
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-4">Subscribe & Save</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1D1C1A] font-display">Fresh Fruit Bowls. Daily Delivery.</h2>
            <p className="text-sm sm:text-base text-[#6F6A63] font-light mt-4">Choose Regular or Exotic. Free delivery every day.</p>
          </div>

          {/* Plan toggle */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <div
              role="tablist"
              aria-label="Subscription billing cycle"
              className="relative inline-flex p-1 bg-[#F4F2ED] border border-black/5 rounded-full shadow-inner"
            >
              {(['weekly', 'monthly'] as const).map((p) => {
                const active = plan === p;
                return (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPlan(p)}
                    className={`relative z-10 px-5 sm:px-8 py-2.5 rounded-full text-[11px] font-bold tracking-[0.25em] uppercase transition-colors duration-200 flex items-center gap-2 ${
                      active ? 'text-white' : 'text-[#6F6A63] hover:text-[#1D1C1A]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="plan-pill"
                        className="absolute inset-0 bg-[#1D1C1A] rounded-full shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)]"
                        transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                      />
                    )}
                    <span className="relative">{p === 'weekly' ? '7 Days' : '28 Days'}</span>
                    {p === 'monthly' && maxMonthlySavings > 0 && (
                      <span
                        className={`relative inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-[0.1em] ${
                          active ? 'bg-yellow-400 text-black' : 'bg-[#1D1C1A] text-white'
                        }`}
                      >
                        Save {maxMonthlySavings}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`grid ${gridColsClass} gap-6 max-w-5xl mx-auto`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredItems.map((item, index) => {
                const idLc = item.id.toLowerCase();
                const isWeekly = idLc.includes('weekly');
                const isExotic = idLc.includes('exotic');
                const isMonthly = !isWeekly;
                const isDarkBg = isMonthly;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className={`p-6 sm:p-8 rounded-[2rem] border text-center relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 group ${
                      isDarkBg
                        ? 'border-white/10 text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)]'
                        : 'border-black/5 shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]'
                    }`}
                  >
                    {/* Background image */}
                    <div className="absolute inset-0 z-0">
                      <img
                        src={resolveProductImage(item)}
                        alt={item.name}
                        className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallbackApplied) {
                            img.dataset.fallbackApplied = 'true';
                            img.src = FALLBACK_PRODUCT_IMAGE;
                          }
                        }}
                      />
                      <div className="absolute inset-0" style={{ background: isDarkBg ? 'rgba(29,28,26,0.65)' : 'rgba(255,255,255,0.65)' }} />
                    </div>

                    {isMonthly && isExotic && (
                      <div className="absolute top-0 right-0 z-20 bg-yellow-400 text-black text-[9px] font-bold uppercase tracking-widest px-3 py-2 rounded-bl-xl">
                        Best Value
                      </div>
                    )}

                    <div className="relative z-10">
                      <p className={`text-[11px] tracking-[0.4em] uppercase mb-2 font-bold ${isDarkBg ? 'text-white/50' : 'text-[#6F6A63]'}`}>
                        {isWeekly ? '7 Days' : '28 Days'} {isExotic ? '• Exotic' : '• Regular'}
                      </p>
                      <h3 className={`text-xl sm:text-2xl font-bold tracking-tight font-display mb-2 ${isDarkBg ? 'text-white' : 'text-[#1D1C1A]'}`}>{item.name}</h3>
                      <p className={`text-xs sm:text-sm font-medium mb-6 ${isDarkBg ? 'text-white/70' : 'text-[#6F6A63]'}`}>{item.desc}</p>
                      <div className="flex items-baseline justify-center gap-2 mb-6">
                        <span className={`text-xs line-through font-medium ${isDarkBg ? 'text-white/40' : 'text-[#A7A29C]'}`}>{rupee}{item.mrp}</span>
                        <span className={`text-3xl sm:text-4xl font-bold ${isDarkBg ? 'text-white' : 'text-[#1D1C1A]'}`}>{rupee}{item.offerPrice}</span>
                        <span className={`text-[9px] uppercase tracking-[0.15em] font-bold ${isDarkBg ? 'text-white/50' : 'text-[#6F6A63]'}`}>/{isWeekly ? 'week' : 'month'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onSubscribe(item.id)}
                      className={`w-full relative z-10 px-6 py-3 rounded-xl font-bold tracking-[0.2em] uppercase text-[10px] transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] ${
                        isDarkBg
                          ? 'bg-white text-[#1D1C1A] hover:bg-gray-100'
                          : 'bg-[#1D1C1A] text-white hover:bg-black'
                      }`}
                    >
                      Subscribe Now
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredItems.length === 0 && (
            <p className="text-center text-sm text-[#6F6A63]">No {plan} plans available right now.</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
