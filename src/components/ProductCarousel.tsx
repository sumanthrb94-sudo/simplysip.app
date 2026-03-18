import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export default function ProductCarousel() {
  const [carouselItems, setCarouselItems] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => setCarouselItems(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <section className="py-24 bg-[#1A1A1A] text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-16 md:mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center md:text-left"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-semibold mb-4 block">Our Juices</span>
          <h2 className="text-5xl md:text-7xl font-serif font-light tracking-tight mb-6">The Collection.</h2>
          <div className="w-12 h-[1px] bg-white/20 mx-auto md:mx-0"></div>
        </motion.div>
      </div>
      
      <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 md:px-12 pb-12 gap-6 md:gap-10">
        {carouselItems.map((item, index) => (
          <motion.div 
            key={item.id || index}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="snap-center shrink-0 w-[85vw] md:w-[450px] flex flex-col group cursor-grab active:cursor-grabbing"
          >
            <div className="aspect-[3/4] w-full bg-[#2A2A2A] overflow-hidden mb-6 relative">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105 opacity-90 group-hover:opacity-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-700" />
            </div>
            <div className="flex items-center justify-between px-2">
              <h3 className="text-2xl font-serif tracking-wide">{item.name}</h3>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50">{item.day}</span>
            </div>
          </motion.div>
        ))}
        {/* Spacer for end alignment */}
        <div className="shrink-0 w-1 md:w-6" />
      </div>
    </section>
  );
}
