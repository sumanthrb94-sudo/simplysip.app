import { useState } from 'react';
import { motion } from 'motion/react';

interface SubscriptionProps {
  onSubscribe: (subscriptionId: string) => void;
  subscriptionItems?: {
    id: string;
    name: string;
    mrp: number;
    offerPrice: number;
    desc: string;
    image?: string;
  }[];
}

export default function Subscription({ onSubscribe, subscriptionItems }: SubscriptionProps) {
  const defaultItems = [
    {
      id: "sub_normal_weekly",
      name: "Normal Fruit Bowl - Weekly",
      mrp: 1260,
      offerPrice: 899,
      image: "/images/subscription-normal-fruit-bowl.svg",
      desc: "Fresh fruit bowl (450g) delivered daily for 7 days"
    },
    {
      id: "sub_normal_monthly",
      name: "Normal Fruit Bowl - Monthly",
      mrp: 4799,
      offerPrice: 3299,
      image: "/images/subscription-normal-fruit-bowl.svg",
      desc: "Fresh fruit bowl (450g) delivered daily for 30 days"
    },
    {
      id: "sub_exotic_weekly",
      name: "Exotic Fruit Bowl - Weekly",
      mrp: 1890,
      offerPrice: 1299,
      image: "/images/subscription-exotic-fruit-bowl.svg",
      desc: "Premium exotic fruit bowl (500g) delivered daily for 7 days"
    },
    {
      id: "sub_exotic_monthly",
      name: "Exotic Fruit Bowl - Monthly",
      mrp: 6999,
      offerPrice: 4499,
      image: "/images/subscription-exotic-fruit-bowl.svg",
      desc: "Premium exotic fruit bowl (500g) delivered daily for 30 days"
    }
  ];

  const items = subscriptionItems && subscriptionItems.length > 0 ? subscriptionItems : defaultItems;

  const rupee = "\u20B9";

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
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-4">Subscribe & Save</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1D1C1A] font-display">Fresh Fruit Bowls. Daily Delivery.</h2>
            <p className="text-sm sm:text-base text-[#6F6A63] font-light mt-4">Choose Normal or Exotic. Weekly or Monthly. Free delivery every day.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {items.map((item, index) => {
              const isWeekly = item.id.includes('weekly');
              const isExotic = item.id.includes('exotic');
              const isMonthly = !isWeekly;
              const isDarkBg = isMonthly;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`p-6 sm:p-8 rounded-[2rem] border text-center relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 group ${
                    isDarkBg
                      ? 'border-white/10 text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)]'
                      : 'border-black/5 shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)]'
                  }`}
                >
                  {/* Background image */}
                  <div className="absolute inset-0 z-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0" style={{ background: isDarkBg ? 'rgba(29,28,26,0.65)' : 'rgba(255,255,255,0.65)' }} />
                  </div>

                  {/* Best Value badge */}
                  {isMonthly && isExotic && (
                    <div className="absolute top-0 right-0 z-20 bg-yellow-400 text-black text-[9px] font-bold uppercase tracking-widest px-3 py-2 rounded-bl-xl">
                      Best Value
                    </div>
                  )}

                  <div className="relative z-10">
                    <p className={`text-[11px] tracking-[0.4em] uppercase mb-2 font-bold ${isDarkBg ? 'text-white/50' : 'text-[#6F6A63]'}`}>
                      {isWeekly ? '7 Days' : '30 Days'} {isExotic ? '• Exotic' : '• Normal'}
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
          </div>
        </motion.div>
      </div>
    </section>
  );
}
