import { motion } from 'motion/react';
import { LayoutDashboard, User } from 'lucide-react';

interface HeaderProps {
  user: any | null;
  onAuth: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  onAdminOpen: () => void;
  onProfileToggle: () => void;
}

export default function Header({ user, onAuth, onLogout, isAdmin, onAdminOpen, onProfileToggle }: HeaderProps) {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center py-4 sm:py-5 px-4 sm:px-6 md:px-12 bg-white/70 backdrop-blur-2xl border-b border-black/5"
    >
      <div className="flex-1 flex justify-center">
        <button onClick={() => window.location.reload()} className="flex items-baseline cursor-pointer">
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.32em] sm:tracking-[0.38em] text-[#1D1C1A] font-display uppercase">
            SIMPLYSIP
          </div>
          <span className="ml-2 text-xl sm:text-2xl md:text-3xl text-[#1D1C1A] font-script font-semibold tracking-[0.08em] uppercase">
            ELIXIRS
          </span>
        </button>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-6">
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <button
                onClick={onAdminOpen}
                aria-label="Open admin dashboard"
                className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full border border-black/10 text-[#1D1C1A] hover:border-black/20 hover:bg-black/5 transition-colors"
              >
                <LayoutDashboard size={16} />
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
            className="text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-[#6F6A63] hover:text-black transition-colors uppercase"
          >
            Login
          </button>
        )}
      </div>
    </motion.header>
  );
}
