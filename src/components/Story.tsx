import { motion } from 'motion/react';
import { Droplet, Sparkles, Activity } from 'lucide-react';

const pillars = [
  {
    icon: Activity,
    title: "Top 1% Sourcing",
    desc: "We exclusively harvest from nutrient-dense, regenerative micro-farms. Only the highest-tier, unblemished organic produce makes it into our sanctuaries.",
    delay: 0.1
  },
  {
    icon: Droplet,
    title: "Zero Oxidation",
    desc: "Extracted under immense hydraulic pressure with absolutely zero heat generation, ensuring every drop remains a biologically active, living elixir.",
    delay: 0.3
  },
  {
    icon: Sparkles,
    title: "Cellular Longevity",
    desc: "Formulated by wellness purists to optimize digestion, ignite natural energy, and elevate your body's restorative functions at a molecular level.",
    delay: 0.5
  }
];

export default function Story() {
  return (
    <section id="story" className="py-24 sm:py-32 bg-[#141414] text-[#FBFAF7] relative overflow-hidden scroll-mt-20">
      {/* Subtle luxury ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-screen-xl opacity-[0.03] pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-[#C6A05A] blur-[150px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-20 sm:mb-28"
        >
          <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] text-[#C6A05A] uppercase mb-6 sm:mb-8">
            The Philosophy of Purity
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-light mb-8 leading-tight tracking-tight">
            An Uncompromising Standard of <span className="italic font-serif text-[#C6A05A]">Vitality.</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-400 font-light leading-relaxed tracking-wide">
            Born from the elite echelons of holistic wellness, Simply Sip isn't just juice—it's a high-performance ritual. We extract the raw essence of the world's most potent botanicals, preserving their delicate living enzymes through state-of-the-art cold-press technology. No heat. No oxidation. Just pure, bioavailable cellular nourishment designed to elevate human potential.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-16">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: pillar.delay, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center mb-6 group-hover:border-[#C6A05A] transition-colors duration-700">
                <pillar.icon strokeWidth={1} size={24} className="text-[#C6A05A]" />
              </div>
              <h3 className="text-lg font-display tracking-widest uppercase text-white mb-4 text-[13px]">{pillar.title}</h3>
              <p className="text-xs sm:text-[13px] text-gray-500 leading-relaxed font-light">{pillar.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
