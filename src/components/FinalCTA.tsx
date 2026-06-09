import { motion } from 'motion/react';

interface FinalCTAProps {
  onSubscribe: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

export default function FinalCTA({ onSubscribe }: FinalCTAProps) {
  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 bg-[#FBFAF7]">
      <div className="relative max-w-5xl mx-auto">
        {/* The one place we keep the liquid hue */}
        <div className="relative overflow-hidden rounded-[2.5rem] sm:rounded-[3rem] px-6 py-16 sm:px-12 sm:py-24 text-center shadow-[0_50px_110px_-60px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 cta-liquid" />

          <div className="relative z-10">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease }}
              className="text-[11px] tracking-[0.4em] uppercase text-white/85 font-semibold mb-6"
            >
              Your Daily Ritual Awaits
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease }}
              className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight mb-10 sm:mb-12 text-white leading-[1.1] font-display drop-shadow-sm"
            >
              Drink Clean.<br />
              Feel Light.<br />
              Live Fresh.
            </motion.h2>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2, ease }}
              onClick={onSubscribe}
              className="px-10 py-4 bg-white text-[#1D1C1A] rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] hover:scale-[1.04] transition-transform duration-300"
            >
              Order Now
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
}
