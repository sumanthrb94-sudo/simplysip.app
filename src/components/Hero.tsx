import { motion } from 'motion/react';

interface HeroProps {
  onSubscribe: () => void;
}

export default function Hero({ onSubscribe }: HeroProps) {
  return (
    <section className="relative min-h-[75svh] sm:min-h-[100svh] w-full flex items-center overflow-hidden bg-[#FBFAF7]">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),rgba(245,242,236,0.8),rgba(251,250,247,1))]"></div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16 sm:pb-20 w-full">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-6"
            >
              Cold-Pressed Juice Studio
            </motion.p>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight mb-5 sm:mb-6 text-[#1D1C1A] leading-[1.02] sm:leading-[0.95] font-display"
            >
              Pure Hydration.<br />Pressed Daily.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-base md:text-xl font-light text-[#5E5A55] mb-10 sm:mb-12 tracking-tight max-w-2xl md:max-w-xl"
            >
              Clean hydration for urban professionals who move with purpose.
            </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
            className="w-full sm:w-auto px-7 sm:px-8 py-4 bg-[#1D1C1A] text-white rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] hover:bg-black transition-colors duration-300"
          >
            Select Plan
          </button>
        </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="aspect-[4/5] sm:aspect-[3/4] rounded-[2.2rem] sm:rounded-[2.8rem] overflow-hidden bg-white shadow-[0_50px_120px_-70px_rgba(0,0,0,0.45)] border border-black/5">
              <img 
                src="/images/hero.jpeg" 
                alt="Glass bottled. Moisture sealed." 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-5 sm:-bottom-6 -left-4 sm:-left-6 bg-white/95 backdrop-blur px-5 sm:px-6 py-3 sm:py-4 rounded-2xl border border-black/5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.45)]">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6F6A63] mb-1">Fresh Drop</p>
              <p className="text-sm font-medium text-[#1D1C1A] font-display">Glass bottled. Moisture sealed.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
