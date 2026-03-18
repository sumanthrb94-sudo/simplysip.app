import { motion } from 'motion/react';
import { Droplet, Ban, Leaf, GlassWater, Sparkles } from 'lucide-react';

const features = [
  { icon: Droplet, title: "Cold-Pressed Daily" },
  { icon: Ban, title: "No Added Sugar" },
  { icon: Leaf, title: "No Preservatives" },
  { icon: GlassWater, title: "Glass Bottled" },
  { icon: Sparkles, title: "Clean Ingredients" }
];

export default function Story() {
  return (
    <section className="py-24 sm:py-28 px-4 sm:px-6 bg-white border-t border-black/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[11px] tracking-[0.4em] uppercase text-[#6F6A63] mb-4">Why Simply Sip</p>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-[#1D1C1A] font-display">Clean ingredients. Elegant rituals.</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 mb-3 sm:mb-4 flex items-center justify-center text-[#1D1C1A]">
                <feature.icon strokeWidth={1.5} size={24} />
              </div>
              <h3 className="text-xs sm:text-sm font-medium tracking-tight text-[#1D1C1A]">{feature.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
