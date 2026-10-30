import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { Recipe } from '@/types';

export function Ring({ value, max, size = 120, stroke = 12, color = 'rgb(var(--turmeric))', label, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; label: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(value)} of ${Math.round(max)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? 'rgb(var(--chilli))' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {Math.round(value)} / {Math.round(max)} g
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line/70">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', damping: 22 }} />
      </div>
    </div>
  );
}

/** A thali that fills section by section as calories accumulate. */
export function Plate({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(1, pct));
  const bowls = [
    { cx: 38, cy: 38, color: 'rgb(var(--turmeric))' },
    { cx: 82, cy: 38, color: 'rgb(var(--chilli))' },
    { cx: 38, cy: 82, color: 'rgb(var(--leaf))' },
    { cx: 82, cy: 82, color: 'rgb(var(--sky))' }
  ];
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" role="img" aria-label={`Plate ${Math.round(p * 100)}% full`}>
      <circle cx="60" cy="60" r="56" fill="rgb(var(--surface2))" stroke="rgb(var(--line))" strokeWidth="3" />
      {bowls.map((b, i) => {
        const fill = Math.max(0, Math.min(1, p * 4 - i));
        return (
          <g key={i}>
            <circle cx={b.cx} cy={b.cy} r="17" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="2" />
            <motion.circle cx={b.cx} cy={b.cy} fill={b.color} initial={{ r: 0 }} animate={{ r: 14 * fill }} transition={{ type: 'spring', damping: 14 }} opacity={0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export function WaterGlass({ ml, target }: { ml: number; target: number }) {
  const pct = Math.min(1, target ? ml / target : 0);
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 60 90" className="h-24 w-16" role="img" aria-label={`Water ${ml} of ${target} ml`}>
      <defs>
        <clipPath id="glass">
          <path d="M8 6 L52 6 L46 84 L14 84 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#glass)">
        <rect x="0" y="0" width="60" height="90" fill="rgb(var(--surface2))" />
        <motion.g initial={{ y: 90 }} animate={{ y: 84 - 78 * pct }} transition={{ type: 'spring', damping: 18 }}>
          <motion.path
            d="M-30 4 Q-15 0 0 4 T30 4 T60 4 T90 4 V90 H-30 Z"
            fill="rgb(var(--sky))"
            opacity={0.85}
            animate={reduce ? undefined : { x: [0, -30] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
          />
        </motion.g>
      </g>
      <path d="M8 6 L52 6 L46 84 L14 84 Z" fill="none" stroke="rgb(var(--muted))" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

const PROTEIN_EMOJI: Record<string, string> = { chicken: '🍗', mutton: '🍖', fish: '🐟', prawns: '🦐', crab: '🦀', egg: '🥚', paneer: '🧀', veg: '🥗' };
const CUISINE_HUE: Record<string, number> = {
  Chettinad: 14, 'Tamil Nadu': 32, Kerala: 120, Andhra: 2, Hyderabadi: 280, Karnataka: 45, Goan: 350, Bengali: 52, Punjabi: 22, Mughlai: 300, 'Indo-Chinese': 190, 'Pan-Indian': 38
};

/** Procedural, food-forward artwork for a recipe — zero bytes of images to cache. */
export function RecipeArt({ recipe, className = '' }: { recipe: Pick<Recipe, 'id' | 'protein' | 'cuisine' | 'equipment' | 'course'>; className?: string }) {
  const hue = CUISINE_HUE[recipe.cuisine] ?? 30;
  let h = 0;
  for (const ch of recipe.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const dots = Array.from({ length: 7 }, (_, i) => ({ x: (h * (i + 3) * 13) % 100, y: (h * (i + 7) * 7) % 100, r: 2 + ((h + i) % 4) }));
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${(hue + 30) % 360} 75% 45%))` }} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="white" />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex aspect-square w-[58%] max-w-[120px] items-center justify-center rounded-full bg-white/85 shadow-soft">
          <span className="text-[min(10vw,52px)] leading-none">{recipe.course === 'drink' ? '🥤' : recipe.course === 'dessert' ? '🍮' : PROTEIN_EMOJI[recipe.protein] ?? '🍛'}</span>
        </div>
      </div>
      {recipe.equipment.includes('air-fryer') && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">Air fryer</span>}
    </div>
  );
}

export function celebrate() {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#E8A317', '#C42E20', '#2E7D32', '#F7ECD6'] });
}

/** Illustrated Bristol stool chart types. */
export const BRISTOL = [
  { type: 1, label: 'Separate hard lumps', note: 'Severe constipation' },
  { type: 2, label: 'Lumpy, sausage-shaped', note: 'Mild constipation' },
  { type: 3, label: 'Sausage with cracks', note: 'Normal' },
  { type: 4, label: 'Smooth, soft sausage', note: 'Ideal' },
  { type: 5, label: 'Soft blobs, clear edges', note: 'Lacking fibre' },
  { type: 6, label: 'Mushy, ragged edges', note: 'Mild diarrhoea' },
  { type: 7, label: 'Watery, no solid pieces', note: 'Diarrhoea' }
];

export function BristolIcon({ type }: { type: number }) {
  const fill = type <= 2 ? '#7a4a24' : type <= 4 ? '#9a6232' : type <= 5 ? '#b07a45' : '#c49562';
  return (
    <svg viewBox="0 0 60 30" className="h-8 w-16" aria-hidden>
      {type === 1 && [8, 20, 32, 44].map((x) => <circle key={x} cx={x + 4} cy={15 + (x % 3)} r="5" fill={fill} />)}
      {type === 2 && <path d="M6 15c0-6 6-7 10-5 4-3 9-3 12 0 4-3 10-2 12 1 4-2 10 0 10 5s-6 7-10 5c-4 3-9 3-12 0-4 2-10 2-12-1-4 2-10 1-10-5z" fill={fill} />}
      {type === 3 && (
        <>
          <rect x="4" y="9" width="52" height="12" rx="6" fill={fill} />
          {[16, 28, 40].map((x) => <path key={x} d={`M${x} 9v4`} stroke="#fff6" strokeWidth="1.5" />)}
        </>
      )}
      {type === 4 && <rect x="4" y="9" width="52" height="12" rx="6" fill={fill} />}
      {type === 5 && [8, 24, 40].map((x) => <ellipse key={x} cx={x + 6} cy="15" rx="7" ry="5" fill={fill} />)}
      {type === 6 && <path d="M5 18c3-8 8-4 11-7s7 2 10 0 8-4 11 1 9-2 12 3 4 7-4 7H9c-5 0-6-2-4-4z" fill={fill} />}
      {type === 7 && <path d="M4 20c6-4 12 4 18 0s12 4 18 0 12 4 16 0v4H4z" fill={fill} opacity="0.8" />}
    </svg>
  );
}
