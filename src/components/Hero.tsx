import { motion } from 'motion/react';
import JuiceBackground from './JuiceBackground';

interface HeroProps {
  onSubscribe: () => void;
}

const tags = [
  { label: '100% Real Fruits', color: 'var(--color-leaf)' },
  { label: 'Cold-Pressed', color: 'var(--color-crimson)' },
  { label: 'Zero Added Sugar', color: 'var(--color-dragon)' },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero({ onSubscribe }: HeroProps) {
  return (
    <section className="relative min-h-[78svh] sm:min-h-[100svh] w-full flex items-center overflow-hidden bg-[#FBFAF7]">
      <JuiceBackground variant="light" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 w-full">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-black/5 shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full brand-gradient-anim opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 brand-gradient-anim" />
              </span>
              <span className="text-[11px] tracking-[0.35em] uppercase text-[#1D1C1A] font-semibold">
                Cold-Pressed Juice Studio
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight mb-5 sm:mb-6 leading-[1.02] sm:leading-[0.95] font-display"
            >
              <span className="text-[#1D1C1A]">Pure Hydration.</span>
              <br />
              <span className="brand-gradient-text">Pressed Daily.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease }}
              className="text-base md:text-xl font-light text-[#5E5A55] mb-7 tracking-tight max-w-2xl md:max-w-xl"
            >
              A riot of real fruit in every bottle — cold-pressed for urban
              movers who like their energy bright and their sugar real.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.18, ease }}
              className="flex flex-wrap gap-2 justify-center lg:justify-start mb-10"
            >
              {tags.map((t) => (
                <span
                  key={t.label}
                  className="text-[11px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full text-white shadow-sm"
                  style={{ backgroundColor: t.color }}
                >
                  {t.label}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.24, ease }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto"
            >
              <a
                href="#menu"
                className="w-full sm:w-auto px-7 sm:px-8 py-4 bg-white text-[#1D1C1A] border border-black/10 rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] hover:border-black/20 hover:shadow-[0_25px_60px_-40px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center justify-center"
              >
                Explore Menu
              </a>
              <button
                onClick={onSubscribe}
                className="group relative w-full sm:w-auto px-7 sm:px-8 py-4 rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] text-white overflow-hidden shadow-[0_18px_45px_-18px_rgba(236,30,121,0.7)] transition-transform duration-300 hover:scale-[1.03]"
              >
                <span className="absolute inset-0 brand-gradient-anim" />
                <span className="relative">Select Plan</span>
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease }}
            className="relative"
          >
            {/* Animated gradient halo behind the product image */}
            <div className="absolute -inset-3 sm:-inset-4 rounded-[2.6rem] sm:rounded-[3.2rem] brand-gradient-anim opacity-60 blur-xl" />

            <div className="relative aspect-[4/5] sm:aspect-[3/4] rounded-[2.2rem] sm:rounded-[2.8rem] overflow-hidden bg-white shadow-[0_50px_120px_-70px_rgba(0,0,0,0.55)] ring-1 ring-white/40">
              <img
                src="/images/hero.webp"
                alt="Glass bottled. Moisture sealed."
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                fetchPriority="high"
              />
            </div>

            {/* Floating logo badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease }}
              className="fruit-bob absolute -top-5 -right-3 sm:-top-6 sm:-right-5"
              style={{ ['--rot' as string]: '-6deg' }}
            >
              <img
                src="/images/logo-header.png"
                alt="SimplySip Elixirs"
                width={180}
                height={240}
                className="h-20 sm:h-24 w-auto rounded-2xl ring-2 ring-white shadow-xl"
              />
            </motion.div>

            <div className="absolute -bottom-5 sm:-bottom-6 -left-4 sm:-left-6 bg-white/95 backdrop-blur px-5 sm:px-6 py-3 sm:py-4 rounded-2xl border border-black/5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.45)]">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6F6A63] mb-1">Fresh Drop</p>
              <p className="text-sm font-medium text-[#1D1C1A] font-display">Glass bottled. Moisture sealed.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Animated rainbow divider at the section base */}
      <div className="brand-rule absolute bottom-0 left-0 right-0" />
    </section>
  );
}
