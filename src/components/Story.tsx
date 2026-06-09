import { motion } from 'motion/react';
import { Droplet, Sparkles, Activity } from 'lucide-react';

const pillars = [
  {
    icon: Activity,
    title: "Top 1% Sourcing",
    desc: "We exclusively harvest from nutrient-dense, regenerative micro-farms. Only the highest-tier, unblemished organic produce makes it into our sanctuaries.",
    color: "var(--color-mango)",
    delay: 0.1,
  },
  {
    icon: Droplet,
    title: "Zero Oxidation",
    desc: "Extracted under immense hydraulic pressure with absolutely zero heat generation, ensuring every drop remains a biologically active, living elixir.",
    color: "var(--color-dragon)",
    delay: 0.25,
  },
  {
    icon: Sparkles,
    title: "Cellular Longevity",
    desc: "Formulated by wellness purists to optimize digestion, ignite natural energy, and elevate your body's restorative functions at a molecular level.",
    color: "var(--color-leaf)",
    delay: 0.4,
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function Story() {
  return (
    <section id="story" className="py-24 sm:py-32 bg-[#0E0E0E] text-[#FBFAF7] relative overflow-hidden scroll-mt-20">
      {/* Vibrant ambient glows pulled from the logo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[8%] w-[460px] h-[460px] rounded-full bg-[#FFB400] blur-[160px] opacity-[0.14]" />
        <div className="absolute top-[30%] right-[6%] w-[420px] h-[420px] rounded-full bg-[#EC1E79] blur-[160px] opacity-[0.14]" />
        <div className="absolute bottom-[6%] left-[40%] w-[440px] h-[440px] rounded-full bg-[#3B5BDB] blur-[170px] opacity-[0.12]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease }}
          className="text-center max-w-3xl mx-auto mb-20 sm:mb-28"
        >
          <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-6 sm:mb-8 brand-gradient-text">
            The Philosophy of Purity
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-light mb-8 leading-tight tracking-tight">
            An Uncompromising Standard of{' '}
            <span className="italic brand-gradient-text">Vitality.</span>
          </h2>
          <div className="brand-rule w-24 mx-auto mb-8" />
          <p className="text-sm sm:text-base text-gray-400 font-light leading-relaxed tracking-wide">
            Born from the elite echelons of holistic wellness, Simply Sip isn't just juice—it's a high-performance ritual. We extract the raw essence of the world's most potent botanicals, preserving their delicate living enzymes through state-of-the-art cold-press technology. No heat. No oxidation. Just pure, bioavailable cellular nourishment designed to elevate human potential.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-10">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: pillar.delay, ease }}
              className="group relative flex flex-col items-center text-center rounded-3xl p-8 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-500"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${pillar.color}, transparent 80%)`,
                  boxShadow: `0 18px 40px -18px ${pillar.color}`,
                }}
              >
                <pillar.icon strokeWidth={1.5} size={26} style={{ color: pillar.color }} />
              </div>
              <h3 className="text-[13px] font-display tracking-widest uppercase text-white mb-4">{pillar.title}</h3>
              <p className="text-xs sm:text-[13px] text-gray-400 leading-relaxed font-light">{pillar.desc}</p>
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-0 group-hover:w-2/3 rounded-full transition-all duration-500"
                style={{ backgroundColor: pillar.color }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
