import { motion } from 'motion/react';

interface JuiceBackgroundProps {
  /** "light" tints sit over ivory sections, "dark" glow over near-black sections. */
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Ambient motion-graphics layer built from the brand logo palette:
 * slow-drifting blurred "juice" blobs plus a faint grain/sheen.
 * Purely decorative — pointer-events disabled, respects reduced-motion via CSS.
 */
export default function JuiceBackground({ variant = 'light', className = '' }: JuiceBackgroundProps) {
  const opacity = variant === 'dark' ? 0.5 : 0.6;

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {/* Drifting colour blobs */}
      <div
        className="juice-blob blob-a"
        style={{ top: '-6%', left: '-4%', width: 360, height: 360, background: 'var(--color-mango)', opacity }}
      />
      <div
        className="juice-blob blob-b"
        style={{ top: '8%', right: '-6%', width: 320, height: 320, background: 'var(--color-dragon)', opacity }}
      />
      <div
        className="juice-blob blob-c"
        style={{ bottom: '-8%', left: '18%', width: 380, height: 380, background: 'var(--color-berry)', opacity: opacity * 0.85 }}
      />
      <div
        className="juice-blob blob-a"
        style={{ bottom: '4%', right: '12%', width: 280, height: 280, background: 'var(--color-leaf)', opacity: opacity * 0.8 }}
      />
      <div
        className="juice-blob blob-b"
        style={{ top: '40%', left: '42%', width: 300, height: 300, background: 'var(--color-crimson)', opacity: opacity * 0.7 }}
      />

      {/* Gentle sheen sweep */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: variant === 'dark' ? 0.08 : 0.14 }}
        transition={{ duration: 2 }}
        style={{
          background:
            variant === 'dark'
              ? 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.18), transparent 60%)'
              : 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.7), transparent 55%)',
        }}
      />
    </div>
  );
}
