import { useApp } from '@/store/app';
import { useActiveFast, useNow } from '@/hooks/data';
import { create, update } from '@/db/repo';
import { IF_PROTOCOLS } from '@/lib/targets';
import { Ring, celebrate } from '@/components/viz';
import { Section } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { FastingSession } from '@/types';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function FastingCard() {
  const { profile, toast } = useApp();
  const fast = useActiveFast();
  const now = useNow(1000);
  const proto = IF_PROTOCOLS[profile!.ifProtocol];
  const active = fast && !fast.end ? fast : null;

  // Without an active session, show where we are in the daily window.
  const start = profile!.ifStartHour;
  const end = (start + proto.eatH) % 24;
  const d = new Date(now);
  const h = d.getHours() + d.getMinutes() / 60;
  const inWindow = start < end ? h >= start && h < end : h >= start || h < end;

  const startFast = () => create<FastingSession>('fastingSessions', { start: Date.now(), end: null, targetHours: proto.fastH });
  const endFast = async () => {
    if (!active) return;
    await update<FastingSession>('fastingSessions', active.id, { end: Date.now() });
    const hrs = (Date.now() - active.start) / 3600000;
    if (hrs >= active.targetHours) {
      celebrate();
      toast(`Fast complete: ${hrs.toFixed(1)} h 🎉`);
    } else toast(`Fast ended at ${hrs.toFixed(1)} h`);
  };

  const elapsed = active ? now - active.start : 0;
  const target = (active?.targetHours ?? proto.fastH) * 3600000;

  return (
    <Section title={`Fasting · ${proto.label}`}>
      <div className="flex items-center gap-4">
        <Ring value={active ? elapsed : 0} max={target} size={110} stroke={10} color="rgb(var(--plum))" label="Fasting progress">
          {active ? (
            <>
              <div className="font-mono text-sm font-bold">{fmt(Math.max(0, target - elapsed))}</div>
              <div className="text-[10px] font-semibold text-muted">to go</div>
            </>
          ) : (
            <div className="px-2 text-xs font-semibold text-muted">{inWindow ? 'Eating window' : 'Fasting hours'}</div>
          )}
        </Ring>
        <div className="flex-1 space-y-2 text-sm">
          {active ? (
            <div>
              Fasting for <b className="font-mono">{fmt(elapsed)}</b>
              {elapsed > 12 * 3600000 && <div className="text-xs text-muted">Past 12 h: insulin is low, fat burning is up.</div>}
            </div>
          ) : (
            <div>
              Window: <b>{start}:00 – {end}:00</b>
            </div>
          )}
          <button className={active ? 'btn-ghost w-full' : 'btn-primary w-full'} onClick={active ? endFast : startFast}>
            <Icon name={active ? 'pause' : 'play'} size={18} /> {active ? 'End fast' : 'Start fast'}
          </button>
        </div>
      </div>
    </Section>
  );
}
