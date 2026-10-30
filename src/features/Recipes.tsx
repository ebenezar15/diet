import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { DietTag, MealType, Recipe } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useFavourites } from '@/hooks/data';
import { Chip, Empty, FodmapBadge, Page } from '@/components/ui';
import { RecipeArt } from '@/components/viz';
import { Icon } from '@/components/Icon';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'side'];
const PROTEINS = ['chicken', 'mutton', 'fish', 'prawns', 'crab', 'egg', 'paneer', 'veg'];
const TAGS: [DietTag, string][] = [
  ['keto', 'Keto'],
  ['hplc', 'High-protein low-carb'],
  ['balanced', 'Balanced']
];

export default function Recipes() {
  const { catalog, setRoute } = useApp();
  const ibs = useIbs();
  const favs = useFavourites();
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState<MealType | null>(null);
  const [protein, setProtein] = useState<string | null>(null);
  const [tag, setTag] = useState<DietTag | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [airFryer, setAirFryer] = useState(false);
  const [safeOnly, setSafeOnly] = useState(ibs);
  const [budget, setBudget] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<'protein' | 'kcal' | 'cost' | 'time'>('protein');
  const cuisines = useMemo(() => [...new Set(catalog?.list.map((r) => r.cuisine))].sort(), [catalog]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    const out = (catalog?.list ?? []).filter((r) => {
      const n = ibs ? r.ibsVariant.perServing : r.perServing;
      return (
        (!s || r.name.toLowerCase().includes(s) || r.localName?.toLowerCase().includes(s) || r.ingredients.some((i) => i.i.includes(s))) &&
        (!meal || r.mealTypes.includes(meal)) &&
        (!protein || r.protein === protein) &&
        (!tag || (ibs ? dietTags(n) : r.dietTags).includes(tag)) &&
        (!cuisine || r.cuisine === cuisine) &&
        (!airFryer || r.equipment.includes('air-fryer')) &&
        (!safeOnly || r.ibsVariant.fodmapStatus === 'low') &&
        (!budget || r.costPerServing <= 60) &&
        (!favOnly || favs.has(r.id))
      );
    });
    const key = (r: Recipe) => {
      const n = ibs ? r.ibsVariant.perServing : r.perServing;
      return sort === 'protein' ? -(n.protein / Math.max(1, n.kcal)) : sort === 'kcal' ? n.kcal : sort === 'cost' ? r.costPerServing : r.prepMin + r.cookMin;
    };
    return out.sort((a, b) => key(a) - key(b));
  }, [catalog, q, meal, protein, tag, cuisine, airFryer, safeOnly, budget, favOnly, favs, sort, ibs]);

  return (
    <Page title="Recipes" subtitle={`${catalog?.list.length ?? 0} Indian recipes · ${catalog?.list.filter((r) => r.equipment.includes('air-fryer')).length ?? 0} air-fryer`}>
      <div className="relative mb-3">
        <Icon name="search" className="absolute left-3 top-3 text-muted" />
        <input className="input pl-10" placeholder="Search dishes, local names or ingredients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
      </div>
      <div className="scrollbar-none -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip on={airFryer} onClick={() => setAirFryer(!airFryer)}>
          🌀 Air fryer
        </Chip>
        <Chip on={safeOnly} onClick={() => setSafeOnly(!safeOnly)}>
          🌿 IBS-safe
        </Chip>
        <Chip on={budget} onClick={() => setBudget(!budget)}>
          ₹ Budget (≤ ₹60)
        </Chip>
        <Chip on={favOnly} onClick={() => setFavOnly(!favOnly)}>
          ★ Favourites
        </Chip>
        {TAGS.map(([t, l]) => (
          <Chip key={t} on={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {l}
          </Chip>
        ))}
      </div>
      <div className="scrollbar-none -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {MEALS.map((m) => (
          <Chip key={m} on={meal === m} onClick={() => setMeal(meal === m ? null : m)}>
            {m === 'side' ? 'sides' : m}
          </Chip>
        ))}
        {PROTEINS.map((p) => (
          <Chip key={p} on={protein === p} onClick={() => setProtein(protein === p ? null : p)}>
            {p}
          </Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={cuisine ?? ''} onChange={(e) => setCuisine(e.target.value || null)} aria-label="Cuisine">
          <option value="">All cuisines</option>
          {cuisines.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
          <option value="protein">Most protein per kcal</option>
          <option value="kcal">Lowest calories</option>
          <option value="cost">Cheapest</option>
          <option value="time">Quickest</option>
        </select>
        <span className="text-sm text-muted">{list.length} found</span>
      </div>
      {!list.length ? (
        <Empty emoji="🔍" title="No recipes match" text="Try removing a filter." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((r, i) => {
            const n = ibs ? r.ibsVariant.perServing : r.perServing;
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="card overflow-hidden text-left"
                onClick={() => setRoute(`/recipes/${r.id}`)}
              >
                <motion.div layoutId={`art-${r.id}`}>
                  <RecipeArt recipe={r} className="aspect-[4/3] w-full" />
                </motion.div>
                <div className="p-2.5">
                  <div className="line-clamp-2 text-sm font-bold leading-tight">{r.name}</div>
                  <div className="truncate text-xs text-muted">
                    {r.localName} · {r.cuisine}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="badge bg-surface2">{Math.round(n.kcal)} kcal</span>
                    <span className="badge bg-chilli/10 text-chilli">P {Math.round(n.protein)}g</span>
                    <span className="badge bg-surface2">{r.prepMin + r.cookMin}′</span>
                    <span className="badge bg-surface2">₹{Math.round(r.costPerServing)}</span>
                  </div>
                  {ibs && (
                    <div className="mt-1">
                      <FodmapBadge level={r.ibsVariant.fodmapStatus} />
                      {r.ibsVariant.substitutions.length > 0 && <span className="ml-1 text-[10px] text-muted">{r.ibsVariant.substitutions.length} swap(s)</span>}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </Page>
  );
}

import { dietTagsFor as dietTags } from '@/lib/nutrition';
