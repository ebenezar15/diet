import { useMemo, useState } from 'react';
import type { Ingredient, MealType, Recipe } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useAllMealLogs, useFavourites } from '@/hooks/data';
import { Chip, Sheet, Slider } from '@/components/ui';
import { RecipeArt } from '@/components/viz';
import { logIngredient, logQuick, logRecipe, slotForNow } from '@/lib/logging';
import { nutritionFor } from '@/lib/nutrition';
import { PORTION_HELPERS, household } from '@/lib/units';
import { addDays, create, today } from '@/db/repo';
import type { MealLog } from '@/types';

const SLOTS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function LogSheet() {
  const { catalog, closeLog, toast, logSlot } = useApp();
  const ibs = useIbs();
  const [tab, setTab] = useState<'recipes' | 'foods' | 'quick' | 'recent'>('recipes');
  const [q, setQ] = useState('');
  const [slot, setSlot] = useState<MealType>((logSlot as MealType) || slotForNow());
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [food, setFood] = useState<Ingredient | null>(null);
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(100);
  const [quick, setQuick] = useState({ label: '', kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const allLogs = useAllMealLogs();
  const favs = useFavourites();
  const date = today();

  const recipes = useMemo(() => {
    const s = q.toLowerCase();
    return (catalog?.list ?? []).filter((r) => !s || r.name.toLowerCase().includes(s) || r.localName?.toLowerCase().includes(s) || r.cuisine.toLowerCase().includes(s)).slice(0, 40);
  }, [catalog, q]);
  const foods = useMemo(() => {
    const s = q.toLowerCase();
    return [...(catalog?.ingredients.values() ?? [])].filter((i) => !['spice', 'condiment'].includes(i.category) && (!s || i.name.toLowerCase().includes(s) || i.nameHi?.includes(q) || i.nameTa?.includes(q))).slice(0, 40);
  }, [catalog, q]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return [...allLogs].sort((a, b) => b.loggedAt - a.loggedAt).filter((l) => l.recipeId && !seen.has(l.recipeId) && seen.add(l.recipeId)).slice(0, 10);
  }, [allLogs]);

  const done = (msg: string) => {
    toast(msg);
    closeLog();
  };

  const copyYesterday = async () => {
    const y = allLogs.filter((l) => l.date === addDays(date, -1));
    if (!y.length) return toast('Nothing logged yesterday', 'warn');
    for (const l of y) {
      const { id: _id, createdAt: _c, updatedAt: _u, deviceId: _d, fieldTs: _f, ...rest } = l as MealLog & { fieldTs?: unknown };
      await create<MealLog>('mealLogs', { ...rest, date, loggedAt: Date.now() });
    }
    done(`Copied ${y.length} items from yesterday`);
  };

  return (
    <Sheet open onClose={closeLog} title="Log food" wide>
      <div className="mb-3 flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <Chip key={s} on={slot === s} onClick={() => setSlot(s)}>
            {s}
          </Chip>
        ))}
      </div>
      {recipe ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <RecipeArt recipe={recipe} className="h-16 w-16 rounded-xl" />
            <div>
              <div className="font-bold">{recipe.name}</div>
              <div className="text-sm text-muted">{Math.round((ibs ? recipe.ibsVariant.perServing : recipe.perServing).kcal)} kcal per serving</div>
            </div>
          </div>
          <Slider label="Portion" value={servings} min={0.25} max={3} step={0.25} onChange={setServings} format={(v) => `${v} serving${v === 1 ? '' : 's'} · ${Math.round((ibs ? recipe.ibsVariant.perServing : recipe.perServing).kcal * v)} kcal`} />
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setRecipe(null)}>
              Back
            </button>
            <button
              className="btn-primary flex-1"
              onClick={async () => {
                await logRecipe(recipe, servings, slot, ibs, date);
                done(`Logged ${recipe.name}`);
              }}
            >
              Log it
            </button>
          </div>
        </div>
      ) : food ? (
        <div className="space-y-4">
          <div className="font-bold">{food.name}</div>
          <Slider label="Amount" value={grams} min={5} max={500} step={5} onChange={setGrams} format={(v) => `${v} g ${household(food, v) ? `(${household(food, v)})` : ''}`} />
          <div className="flex flex-wrap gap-2">
            {PORTION_HELPERS.map((p) => (
              <Chip key={p.label} onClick={() => setGrams(p.grams)} label={`${p.label}: ${p.hint}`}>
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="text-sm text-muted">
            {(() => {
              const n = nutritionFor(food, grams);
              return `${Math.round(n.kcal)} kcal · P ${n.protein.toFixed(1)} · C ${n.netCarbs.toFixed(1)} net · F ${n.fat.toFixed(1)} · fibre ${n.fibre.toFixed(1)}`;
            })()}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setFood(null)}>
              Back
            </button>
            <button
              className="btn-primary flex-1"
              onClick={async () => {
                await logIngredient(food, grams, slot, date);
                done(`Logged ${food.name}`);
              }}
            >
              Log it
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
            {(
              [
                ['recipes', 'Recipes'],
                ['foods', 'Foods'],
                ['recent', 'Recent & ★'],
                ['quick', 'Quick add']
              ] as const
            ).map(([k, l]) => (
              <Chip key={k} on={tab === k} onClick={() => setTab(k)}>
                {l}
              </Chip>
            ))}
            <button className="chip ml-auto" onClick={copyYesterday}>
              Copy yesterday
            </button>
          </div>
          {(tab === 'recipes' || tab === 'foods') && <input className="input mb-3" placeholder="Search… (English, தமிழ், हिन्दी)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search" />}
          {tab === 'recipes' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {recipes.map((r) => (
                <button key={r.id} className="card flex items-center gap-2 p-2 text-left" onClick={() => setRecipe(r)}>
                  <RecipeArt recipe={r} className="h-11 w-11 shrink-0 rounded-lg" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="text-xs text-muted">{Math.round(r.perServing.kcal)} kcal · P {Math.round(r.perServing.protein)}g</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {tab === 'foods' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {foods.map((f) => (
                <button key={f.id} className="card p-2 text-left" onClick={() => setFood(f)}>
                  <div className="text-sm font-semibold">{f.name}</div>
                  <div className="text-xs text-muted">
                    {f.n[0]} kcal / 100 g · P {f.n[1]}g {f.nameHi ? `· ${f.nameHi}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
          {tab === 'recent' && (
            <div className="space-y-2">
              {[...favs].map((id) => catalog?.recipes.get(id)).filter(Boolean).map((r) => (
                <button key={r!.id} className="card flex w-full items-center gap-2 p-2 text-left" onClick={() => setRecipe(r!)}>
                  ★ <span className="font-semibold">{r!.name}</span>
                </button>
              ))}
              {recent.map((l) => {
                const r = catalog?.recipes.get(l.recipeId!);
                return r ? (
                  <button key={l.id} className="card flex w-full items-center justify-between p-2 text-left" onClick={() => { setRecipe(r); setServings(l.servings); }}>
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-xs text-muted">{l.servings}×</span>
                  </button>
                ) : null;
              })}
              {!recent.length && !favs.size && <p className="text-muted">Nothing yet — logged recipes and favourites show up here.</p>}
            </div>
          )}
          {tab === 'quick' && (
            <form
              className="grid grid-cols-2 gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await logQuick(quick.label || 'Quick add', quick, slot, date);
                done('Logged');
              }}
            >
              <label className="col-span-2">
                <span className="label">Label</span>
                <input className="input mt-1" value={quick.label} onChange={(e) => setQuick({ ...quick, label: e.target.value })} placeholder="e.g. Office canteen meal" />
              </label>
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <label key={k}>
                  <span className="label">{k}</span>
                  <input className="input mt-1" type="number" inputMode="decimal" min={0} value={quick[k] || ''} onChange={(e) => setQuick({ ...quick, [k]: Number(e.target.value) })} />
                </label>
              ))}
              <button className="btn-primary col-span-2">Log</button>
            </form>
          )}
        </>
      )}
    </Sheet>
  );
}
