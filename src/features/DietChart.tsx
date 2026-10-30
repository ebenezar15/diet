import { useMemo, useRef, useState } from 'react';
import { useApp, useIbs } from '@/store/app';
import { useCurrentPlan } from '@/hooks/data';
import { Chip, Empty, Page } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { translate } from '@/i18n';
import { DIET_MODES, IF_PROTOCOLS } from '@/lib/targets';
import { dayTotals } from '@/lib/planner';
import type { MealType } from '@/types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function mealTimes(start: number, eatH: number, slots: MealType[]) {
  const uniq = [...new Set(slots.filter((s) => s !== 'side'))];
  const span = Math.max(1, Math.min(eatH, 14) - 1);
  return Object.fromEntries(
    uniq.map((s, i) => {
      const h = start + (uniq.length > 1 ? (span * i) / (uniq.length - 1) : 0);
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60 / 15) * 15;
      return [s, `${((hh + 11) % 12) + 1}:${String(mm % 60).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`];
    })
  );
}

export default function DietChart() {
  const { profile, catalog, toast } = useApp();
  const ibs = useIbs();
  const plan = useCurrentPlan();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(profile!.name);
  const [goal, setGoal] = useState(`${profile!.weightKg} → ${profile!.goalWeightKg} kg`);
  const [second, setSecond] = useState<'none' | 'ta' | 'hi'>(profile!.language === 'en' ? 'none' : profile!.language);
  const [busy, setBusy] = useState(false);

  const slots = useMemo(() => [...new Set(plan?.days.flat().map((m) => m.slot) ?? [])].sort((a, b) => order(a) - order(b)), [plan]);
  const ifp = IF_PROTOCOLS[profile!.ifProtocol];
  const times = mealTimes(profile!.ifProtocol === 'none' ? 8 : profile!.ifStartHour, profile!.ifProtocol === 'none' ? 13 : ifp.eatH, slots);

  if (!plan || !catalog) return <Page title="Diet chart"><Empty emoji="📄" title="No plan" text="Generate a plan first." /></Page>;
  const label = (k: string) => (second === 'none' ? translate('en', k) : `${translate('en', k)} · ${translate(second, k)}`);

  const exportPng = async () => {
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(ref.current!, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'thalifit-diet-chart.png';
      a.click();
    } catch (e) {
      toast(`Export failed: ${String(e)}`, 'warn');
    }
    setBusy(false);
  };
  const exportPdf = async () => {
    setBusy(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const node = ref.current!;
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth() - 40;
      const h = (node.offsetHeight / node.offsetWidth) * w;
      const pageH = pdf.internal.pageSize.getHeight() - 40;
      let y = 0;
      while (y < h) {
        if (y > 0) pdf.addPage();
        pdf.addImage(url, 'PNG', 20, 20 - y, w, h);
        y += pageH;
      }
      pdf.save('thalifit-diet-chart.pdf');
    } catch (e) {
      toast(`Export failed: ${String(e)}`, 'warn');
    }
    setBusy(false);
  };

  return (
    <Page title="Diet chart" subtitle="Printable & shareable">
      <div className="no-print mb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on chart" aria-label="Name on chart" />
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" aria-label="Goal" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Second language:</span>
          {(
            [
              ['none', 'English only'],
              ['ta', 'தமிழ்'],
              ['hi', 'हिन्दी']
            ] as const
          ).map(([k, l]) => (
            <Chip key={k} on={second === k} onClick={() => setSecond(k)}>
              {l}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => window.print()}>
            <Icon name="print" size={18} /> Print
          </button>
          <button className="btn-ghost" onClick={exportPdf} disabled={busy}>
            <Icon name="download" size={18} /> PDF
          </button>
          <button className="btn-ghost" onClick={exportPng} disabled={busy}>
            <Icon name="download" size={18} /> Image
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div ref={ref} className="print-area card min-w-[760px] bg-white p-6 text-[#2b1d0e]">
          <header className="mb-4 flex items-start justify-between border-b-4 border-[#E8A317] pb-3">
            <div>
              <div className="font-display text-3xl font-extrabold">🍛 ThaliFit Diet Chart</div>
              <div className="text-sm">
                {name && <b>{name} · </b>}
                {goal} · {DIET_MODES[plan.settings.dietMode].label}
                {ibs ? ' · Low-FODMAP' : ''}
                {profile!.ifProtocol !== 'none' ? ` · IF ${ifp.label}` : ''}
              </div>
            </div>
            <div className="text-right text-sm">
              <div>
                <b>{profile!.targets.kcal}</b> kcal/day
              </div>
              <div>
                P {profile!.targets.protein} g · C {profile!.targets.carbs} g · F {profile!.targets.fat} g · Fibre {profile!.targets.fibre} g
              </div>
              <div className="text-xs">Week of {plan.weekStart}</div>
            </div>
          </header>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#FBEFDA]">
                <th className="border border-[#EADAC0] p-1.5 text-left">Day</th>
                {slots.map((s) => (
                  <th key={s} className="border border-[#EADAC0] p-1.5 text-left">
                    {label(s)}
                    {times[s] && <div className="font-normal">{times[s]}</div>}
                  </th>
                ))}
                <th className="border border-[#EADAC0] p-1.5 text-left">Day total</th>
              </tr>
            </thead>
            <tbody>
              {plan.days.map((day, d) => {
                const tot = dayTotals(day, catalog, ibs);
                return (
                  <tr key={d} className="align-top">
                    <td className="border border-[#EADAC0] p-1.5 font-bold">{DAYS[d]}</td>
                    {slots.map((s) => (
                      <td key={s} className="border border-[#EADAC0] p-1.5">
                        {day.filter((m) => m.slot === s).map((m) => {
                          const r = catalog.recipes.get(m.recipeId);
                          if (!r) return null;
                          const n = ibs ? r.ibsVariant.perServing : r.perServing;
                          return (
                            <div key={m.key} className="mb-1">
                              <div className="font-semibold leading-tight">{r.name}</div>
                              {second !== 'none' && r.localName && <div className="italic leading-tight">{r.localName}</div>}
                              <div className="text-[10px] text-[#6e5c46]">
                                {m.servings} srv · {Math.round(n.kcal * m.servings)} kcal · P{Math.round(n.protein * m.servings)} C{Math.round(n.netCarbs * m.servings)} F{Math.round(n.fat * m.servings)}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    ))}
                    <td className="border border-[#EADAC0] bg-[#FFF8EC] p-1.5">
                      <b>{Math.round(tot.kcal)} kcal</b>
                      <div className="text-[10px]">
                        P {Math.round(tot.protein)} · C {Math.round(tot.netCarbs)} · F {Math.round(tot.fat)} · Fib {Math.round(tot.fibre)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <footer className="mt-3 flex justify-between text-[10px] text-[#6e5c46]">
            <span>💧 {Math.round((profile!.weightKg * 35) / 250) / 4} L water/day · 🚶 7–10k steps · Portions are per person.</span>
            <span>Not medical advice — follow your doctor / dietitian.</span>
          </footer>
        </div>
      </div>
    </Page>
  );
}

const order = (s: MealType) => ['breakfast', 'snack', 'lunch', 'dinner', 'side'].indexOf(s);
