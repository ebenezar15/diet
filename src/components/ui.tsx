import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useApp } from '@/store/app';

export function Page({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:pb-10 md:pt-8">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
          {subtitle && <p className="text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

export function Section({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ on, onClick, children, label }: { on?: boolean; onClick?: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} className={`chip ${on ? 'chip-on' : ''}`}>
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-4 pb-8 shadow-soft md:rounded-3xl ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'}`}
            initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line md:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">{title}</h2>
              <button className="btn-ghost !px-3" onClick={onClose} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-semibold shadow-soft ${t.tone === 'warn' ? 'bg-chilli text-white' : 'bg-ink text-bg'}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Stat({ label, value, unit, tone = 'ink' }: { label: string; value: string | number; unit?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface2 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-xl font-bold text-${tone}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-display text-lg font-bold">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </label>
  );
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <motion.div className="text-6xl" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }} aria-hidden>
        {emoji}
      </motion.div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="max-w-xs text-muted">{text}</p>
      {action}
    </div>
  );
}

export function FodmapBadge({ level }: { level: 'low' | 'moderate' | 'high' }) {
  const cls = level === 'low' ? 'bg-leaf/15 text-leaf' : level === 'moderate' ? 'bg-turmeric/20 text-turmeric' : 'bg-chilli/15 text-chilli';
  return <span className={`badge ${cls}`}>{level === 'low' ? 'IBS-safe' : level === 'moderate' ? 'Moderate FODMAP' : 'High FODMAP'}</span>;
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`skeleton ${className}`} />;
