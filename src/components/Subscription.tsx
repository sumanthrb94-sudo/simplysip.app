import { useState } from 'react';
import { motion } from 'motion/react';

interface SubscriptionProps {
  onSubscribe: (plan: "weekly" | "monthly") => void;
  selectedPlan: "weekly" | "monthly";
  onPlanChange: (plan: "weekly" | "monthly") => void;
}

export default function Subscription({ onSubscribe, selectedPlan, onPlanChange }: SubscriptionProps) {
  const plan = selectedPlan;

  const planData = {
    weekly: {
      label: "Weekly Plan",
      title: "Weekly Detox Plan",
      count: "7 cold-pressed juices (200 ml each)",
      mrp: 999,
      price: 799,
      cadence: "/ week",
      perBottle: "",
      cta: "Start Weekly"
    },
    monthly: {
      label: "Monthly Plan",
      title: "Monthly Cleanse Plan",
      count: "30 cold-pressed juices (200 ml each)",
      mrp: 3599,
      price: 2599,
      cadence: "/ month",
      perBottle: "",
      cta: "Start Monthly"
    }
  } as const;

  const activePlan = planData[plan];

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden">
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

          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-full border border-black/10 bg-white/80 p-1">
              <button
                onClick={() => onPlanChange("weekly")}
                className={`px-6 py-2 rounded-full text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors ${
                  plan === "weekly" ? "bg-[#1D1C1A] text-white" : "text-[#6F6A63]"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => onPlanChange("monthly")}
                className={`px-6 py-2 rounded-full text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors ${
                  plan === "monthly" ? "bg-[#1D1C1A] text-white" : "text-[#6F6A63]"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="p-6 sm:p-8 rounded-[2rem] border border-black/5 bg-white shadow-[0_30px_70px_-55px_rgba(0,0,0,0.35)] text-center">
              <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-3">{activePlan.label}</p>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1C1A] font-display mb-2">{activePlan.title}</h3>
              <p className="text-sm text-[#6F6A63] font-light mb-6">{activePlan.count}</p>
              <div className="flex items-baseline justify-center gap-3 mb-4">
                <span className="text-sm text-[#A7A29C] line-through font-medium">{"\u20B9"}{activePlan.mrp}</span>
                <span className="text-3xl sm:text-4xl font-semibold text-[#1D1C1A]">{"\u20B9"}{activePlan.price}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#6F6A63]">{activePlan.cadence}</span>
              </div>
              {activePlan.perBottle && (
                <p className="text-xs text-[#6F6A63]">{activePlan.perBottle}</p>
              )}
              <button
                onClick={() => onSubscribe(plan)}
                className="mt-8 w-full px-8 py-4 bg-[#1D1C1A] text-white rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] hover:bg-black transition-colors"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
