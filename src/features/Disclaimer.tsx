import { motion } from 'framer-motion';
import { useState } from 'react';
import { db } from '@/db';
import { alive, create, update } from '@/db/repo';
import { useApp } from '@/store/app';
import { defaultProfile } from '@/lib/profile';
import type { UserProfile } from '@/types';

export const DISCLAIMER_POINTS = [
  'ThaliFit gives general nutrition information. It is not medical advice and does not diagnose or treat any condition.',
  'IBS needs a medical diagnosis first — symptoms like weight loss without trying, blood in stool, anaemia, night-time symptoms or a family history of bowel cancer or coeliac disease need a doctor.',
  'The low-FODMAP diet is meant to be done in phases with a registered dietitian; elimination is short-term (2–6 weeks), not forever.',
  'Combining keto, fasting or aggressive calorie deficits with any medical condition (diabetes, thyroid, kidney disease, pregnancy, eating disorders, medication use) should be supervised by your doctor.',
  'Nutrition values are estimates from IFCT 2017 (NIN) and USDA FoodData Central and will vary with brands and cooking.'
];

export function Disclaimer() {
  const [ticked, setTicked] = useState(false);
  const reload = useApp((s) => s.reloadProfile);
  const accept = async () => {
    const existing = alive(await db.profiles.toArray())[0];
    if (existing) await update<UserProfile>('profiles', existing.id, { disclaimerAcceptedAt: Date.now() });
    else await create<UserProfile>('profiles', { ...defaultProfile(), disclaimerAcceptedAt: Date.now() });
    await reload();
  };
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-coconut to-bg p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="disc-title">
        <div className="mb-2 text-5xl" aria-hidden>
          🍛
        </div>
        <h1 id="disc-title" className="text-3xl font-extrabold">
          Welcome to ThaliFit
        </h1>
        <p className="mt-1 text-muted">Before we start, please read this carefully.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {DISCLAIMER_POINTS.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-1 text-turmeric" aria-hidden>
                ●
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <label className="mt-5 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl bg-surface2 p-3 font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--turmeric))]" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />I understand and will work with my doctor / dietitian.
        </label>
        <button className="btn-primary mt-4 w-full" disabled={!ticked} onClick={accept}>
          Continue
        </button>
      </motion.div>
    </div>
  );
}
