import { useState } from 'react';
import { motion } from 'motion/react';

interface SubscriptionProps {
  onSubscribe: (plan: "weekly" | "monthly") => void;
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
  // Use props if available, else fallback to original hardcoded values (safety)
  const weekly = subscriptionItems?.find(i => i.id === 'sub_weekly') || {
    name: "Weekly Detox",
    mrp: 999,
    offerPrice: 799,
    image: "/images/hero-lineup.webp",
    desc: "7 cold-pressed juices (200 ml each)"
  };
  
  const monthly = subscriptionItems?.find(i => i.id === 'sub_monthly') || {
    name: "Monthly Cleanse",
    mrp: 3599,
    offerPrice: 2599,
    image: "/images/hero.webp",
    desc: "30 cold-pressed juices (200 ml each)"
  };

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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1D1C1A] font-display">Weekly detox. Monthly cleanse.</h2>
            <p className="text-sm sm:text-base text-[#6F6A63] font-light mt-4">Fresh delivery. Every day. No commitment.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Weekly Card */}
            <div className="p-8 sm:p-10 rounded-[2.5rem] border border-black/5 shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)] text-center relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 group">
              {/* Background image */}
              <div className="absolute inset-0 z-0">
                <img src={weekly.image} alt="" className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.65)' }} />
              </div>
              <div className="relative z-10">
                <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-3 font-bold">Weekly Plan</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1C1A] font-display mb-2">{weekly.name}</h3>
                <p className="text-sm text-[#6F6A63] font-medium mb-8">{weekly.desc}</p>
                <div className="flex items-baseline justify-center gap-3 mb-8">
                  <span className="text-sm text-[#A7A29C] line-through font-medium">{rupee}{weekly.mrp}</span>
                  <span className="text-4xl sm:text-5xl font-bold text-[#1D1C1A]">{rupee}{weekly.offerPrice}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#6F6A63] font-bold">/ week</span>
                </div>
              </div>
              <button
                onClick={() => onSubscribe('weekly')}
                className="w-full relative z-10 px-8 py-4 bg-[#1D1C1A] text-white rounded-2xl font-bold tracking-[0.2em] uppercase text-[11px] shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:bg-black transition-all"
              >
                Start Weekly Plan
              </button>
            </div>

            {/* Monthly Card */}
            <div className="p-8 sm:p-10 rounded-[2.5rem] border border-white/10 text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)] text-center relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 group">
              {/* Background image */}
              <div className="absolute inset-0 z-0">
                <img src={monthly.image} alt="" className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0" style={{ background: 'rgba(29,28,26,0.65)' }} />
              </div>
              <div className="absolute top-0 right-0 z-20 bg-yellow-400 text-black text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-bl-2xl">
                Best Value
              </div>
              <div className="relative z-10">
                <p className="text-[11px] tracking-[0.4em] uppercase text-white/50 mb-3 font-bold">Monthly Plan</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display mb-2">{monthly.name}</h3>
                <p className="text-sm text-white/70 font-medium mb-8">{monthly.desc}</p>
                <div className="flex items-baseline justify-center gap-3 mb-8">
                  <span className="text-sm text-white/40 line-through font-medium">{rupee}{monthly.mrp}</span>
                  <span className="text-4xl sm:text-5xl font-bold text-white">{rupee}{monthly.offerPrice}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">/ month</span>
                </div>
              </div>
              <button
                onClick={() => onSubscribe('monthly')}
                className="w-full relative z-10 px-8 py-4 bg-white text-[#1D1C1A] rounded-2xl font-bold tracking-[0.2em] uppercase text-[11px] shadow-[0_10px_20px_-10px_rgba(255,255,255,0.2)] hover:bg-gray-100 transition-all"
              >
                Start Monthly Plan
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
