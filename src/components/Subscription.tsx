import { useState } from 'react';
import { motion } from 'motion/react';

interface SubscriptionProps {
  onSubscribe: (plan: "weekly" | "monthly") => void;
}

export default function Subscription({ onSubscribe }: SubscriptionProps) {

  return (
    <section id="subscriptions" className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden scroll-mt-10">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2200&auto=format&fit=crop" 
          alt="Luxury wellness lifestyle" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-white/70"></div>
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
            <div className="p-8 sm:p-10 rounded-[2.5rem] border border-black/5 bg-white shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)] text-center flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div>
                <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-3 font-bold">Weekly Plan</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1C1A] font-display mb-2">Weekly Detox</h3>
                <p className="text-sm text-[#6F6A63] font-medium mb-8">7 cold-pressed juices (200 ml each)</p>
                <div className="flex items-baseline justify-center gap-3 mb-8">
                  <span className="text-sm text-[#A7A29C] line-through font-medium">{"\u20B9"}999</span>
                  <span className="text-4xl sm:text-5xl font-bold text-[#1D1C1A]">{"\u20B9"}799</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#6F6A63] font-bold">/ week</span>
                </div>
              </div>
              <button
                onClick={() => onSubscribe('weekly')}
                className="w-full px-8 py-4 bg-[#1D1C1A] text-white rounded-2xl font-bold tracking-[0.2em] uppercase text-[11px] shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:bg-black transition-all"
              >
                Start Weekly Plan
              </button>
            </div>

            {/* Monthly Card */}
            <div className="p-8 sm:p-10 rounded-[2.5rem] border border-white/10 bg-[#1D1C1A] text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)] text-center relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-bl-2xl">
                Best Value
              </div>
              <div>
                <p className="text-[11px] tracking-[0.4em] uppercase text-white/50 mb-3 font-bold">Monthly Plan</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display mb-2">Monthly Cleanse</h3>
                <p className="text-sm text-white/70 font-medium mb-8">30 cold-pressed juices (200 ml each)</p>
                <div className="flex items-baseline justify-center gap-3 mb-8">
                  <span className="text-sm text-white/40 line-through font-medium">{"\u20B9"}3599</span>
                  <span className="text-4xl sm:text-5xl font-bold text-white">{"\u20B9"}2599</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">/ month</span>
                </div>
              </div>
              <button
                onClick={() => onSubscribe('monthly')}
                className="w-full px-8 py-4 bg-white text-[#1D1C1A] rounded-2xl font-bold tracking-[0.2em] uppercase text-[11px] shadow-[0_10px_20px_-10px_rgba(255,255,255,0.2)] hover:bg-gray-100 transition-all"
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
