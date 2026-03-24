import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, User, Menu as MenuIcon, X, Star, Droplet, Apple, BookOpen, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeaderProps {
  user: any | null;
  onAuth: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  adminPendingCount?: number;
  onAdminOpen: () => void;
  onProfileToggle: () => void;
  menuItems?: any[];
}

export default function Header({ user, onAuth, onLogout, isAdmin, adminPendingCount, onAdminOpen, onProfileToggle, menuItems = [] }: HeaderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  
  const categories = Array.from(new Set(menuItems.map(item => item.category))).filter((cat): cat is string => Boolean(cat));

  const scrollTo = (id: string) => {
    setIsNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Intercept hardware back button for the drawer
  useEffect(() => {
    if (isNavOpen) {
      window.history.pushState({ modal: 'nav' }, '');
      const handlePopState = () => setIsNavOpen(false);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'nav') window.history.back();
      };
    }
  }, [isNavOpen]);

  return (
    <>
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 md:px-12 bg-white/70 backdrop-blur-2xl border-b border-black/5"
      >
        <div className="flex-1 flex justify-start">
          <button onClick={() => setIsNavOpen(true)} className="p-2 -ml-2 text-[#1D1C1A] hover:bg-black/5 rounded-full transition-colors flex items-center gap-2">
            <MenuIcon size={22} strokeWidth={2.5} />
          </button>
        </div>

        <div className="shrink-0 flex justify-center">
          <button onClick={() => window.location.reload()} className="flex items-baseline cursor-pointer">
            <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.32em] sm:tracking-[0.38em] text-[#1D1C1A] font-display uppercase">
              SIMPLYSIP
            </div>
            <span className="ml-2 text-xl sm:text-2xl md:text-3xl text-[#1D1C1A] font-script font-semibold tracking-[0.08em] uppercase hidden sm:inline-block">
              ELIXIRS
            </span>
          </button>
        </div>
        
        <div className="flex-1 flex justify-end items-center gap-3 sm:gap-6">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <button
                  onClick={onAdminOpen}
                  aria-label="Open admin dashboard"
                  className="relative h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full border border-black/10 text-[#1D1C1A] hover:border-black/20 hover:bg-black/5 transition-colors"
                >
                  <LayoutDashboard size={16} />
                  {!!adminPendingCount && adminPendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] font-bold text-white">
                        {adminPendingCount > 9 ? '9+' : adminPendingCount}
                      </span>
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={onProfileToggle}
                aria-label="Open user profile"
                className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full border border-black/10 text-[#1D1C1A] hover:border-black/20 hover:bg-black/5 transition-colors"
              >
                <User size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onAuth}
              className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#1D1C1A] hover:bg-black hover:text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full border-2 border-[#1D1C1A] transition-colors uppercase"
            >
              Login
            </button>
          )}
        </div>
      </motion.header>

      <AnimatePresence>
        {isNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNavOpen(false)}
              className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 left-0 z-[110] w-[85%] max-w-sm h-full bg-[#FBFAF7] shadow-2xl flex flex-col"
            >
              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                <div className="p-5 sm:p-6 bg-white border-b border-black/5 flex items-center justify-between mb-4 sticky top-0 z-10">
                  <div className="text-xl font-extrabold tracking-[0.38em] text-[#1D1C1A] font-display uppercase">SIMPLYSIP</div>
                  <button onClick={() => setIsNavOpen(false)} className="p-2 bg-[#F9F8F6] rounded-full text-gray-500 hover:text-black hover:bg-gray-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="px-5 sm:px-6 mb-6">
                  {user ? (
                    <div className="bg-white rounded-[2rem] p-5 border border-black/5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center font-bold text-xl font-display shadow-md">
                         {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Welcome Back</p>
                         <p className="text-base font-bold text-[#1D1C1A] leading-tight truncate">{user.displayName || 'User'}</p>
                       </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[2rem] p-5 border border-black/5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] flex items-center justify-between">
                      <div>
                        <p className="text-base font-bold text-[#1D1C1A] leading-tight mb-1">Welcome</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Login to manage orders</p>
                      </div>
                      <button onClick={() => { setIsNavOpen(false); onAuth(); }} className="px-4 py-2 bg-[#1D1C1A] text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors">Login</button>
                    </div>
                  )}
                </div>

                <div className="px-5 sm:px-6 space-y-6 pb-8">
                <button onClick={() => scrollTo('subscriptions')} className="w-full flex items-center justify-between p-6 bg-[#1D1C1A] text-white rounded-3xl shadow-[0_15px_30px_-10px_rgba(0,0,0,0.4)] hover:scale-[1.02] transition-transform">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1"><Star size={12} className="fill-yellow-400"/> Best Value</span>
                    <span className="text-lg font-display font-bold">Only Subscriptions</span>
                  </div>
                </button>
                
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-2 mb-3">Juice Menu</p>
                  
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => scrollTo(slugify(cat))} 
                        className="w-full flex items-center gap-4 p-4 bg-white border border-black/5 rounded-2xl hover:border-black/15 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#F9F8F6] flex items-center justify-center text-[#1D1C1A] group-hover:scale-110 transition-transform">
                          {cat === "Signature Blends" ? <Droplet size={18} /> : cat === "Single Fruit Series" ? <Apple size={18} /> : <Sparkles size={18} />}
                        </div>
                        <span className="font-bold text-[#1D1C1A] text-sm">{cat}</span>
                      </button>
                    ))
                  ) : (
                    <>
                      <button onClick={() => scrollTo('signature')} className="w-full flex items-center gap-4 p-4 bg-white border border-black/5 rounded-2xl hover:border-black/15 transition-colors text-left group">
                        <div className="w-10 h-10 rounded-full bg-[#F9F8F6] flex items-center justify-center text-[#1D1C1A] group-hover:scale-110 transition-transform"><Droplet size={18} /></div>
                        <span className="font-bold text-[#1D1C1A] text-sm">Signature Blends</span>
                      </button>
                      <button onClick={() => scrollTo('pure')} className="w-full flex items-center gap-4 p-4 bg-white border border-black/5 rounded-2xl hover:border-black/15 transition-colors text-left group">
                        <div className="w-10 h-10 rounded-full bg-[#F9F8F6] flex items-center justify-center text-[#1D1C1A] group-hover:scale-110 transition-transform"><Apple size={18} /></div>
                        <span className="font-bold text-[#1D1C1A] text-sm">Single Fruit Series</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-black/5">
                  <button onClick={() => scrollTo('story')} className="w-full flex items-center gap-4 p-4 bg-white border border-black/5 rounded-2xl hover:border-black/15 transition-colors text-left group">
                    <div className="w-10 h-10 rounded-full bg-[#F9F8F6] flex items-center justify-center text-[#1D1C1A] group-hover:scale-110 transition-transform"><BookOpen size={18} /></div>
                    <span className="font-bold text-[#1D1C1A] text-sm">Our Story</span>
                  </button>
                </div>
              </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
