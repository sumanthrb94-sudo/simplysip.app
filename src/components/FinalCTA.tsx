import { motion } from 'motion/react';

interface FinalCTAProps {
  onSubscribe: () => void;
}

export default function FinalCTA({ onSubscribe }: FinalCTAProps) {
  return (
    <section className="py-28 sm:py-40 px-4 sm:px-6 bg-[#FBFAF7] text-center">
      <div className="max-w-3xl mx-auto">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight mb-10 sm:mb-12 text-[#1D1C1A] leading-[1.1] font-display"
        >
          Drink Clean.<br />
          Feel Light.<br />
          Live Fresh.
        </motion.h2>
        
        <motion.button 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={onSubscribe}
          className="px-10 py-4 bg-[#1D1C1A] text-white rounded-full font-semibold tracking-[0.2em] uppercase text-[11px] hover:bg-black transition-colors duration-300"
        >
          Order Now
        </motion.button>
      </div>
    </section>
  );
}
