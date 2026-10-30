import { motion } from 'framer-motion';
import { useSync } from '@/hooks/data';
import { Icon } from '@/components/Icon';
import { useApp } from '@/store/app';

const LABEL = {
  offline: 'Offline',
  pending: 'pending',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
  local: 'On this device'
};

export function SyncBadge({ compact }: { compact?: boolean }) {
  const { state, pending } = useSync();
  const setRoute = useApp((s) => s.setRoute);
  const text = state === 'pending' ? `${pending} ${LABEL.pending}` : LABEL[state];
  const tone = state === 'error' ? 'text-chilli' : state === 'offline' ? 'text-muted' : state === 'synced' ? 'text-leaf' : 'text-ink';
  return (
    <button
      onClick={() => setRoute('/settings')}
      className={`flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface2 px-3 text-xs font-semibold ${tone}`}
      aria-label={`Sync status: ${text}${pending ? `, ${pending} changes waiting` : ''}`}
      title="Sync log"
    >
      <motion.span animate={state === 'syncing' ? { rotate: 360 } : { rotate: 0 }} transition={state === 'syncing' ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
        <Icon name={state === 'offline' ? 'cloudOff' : state === 'syncing' ? 'refresh' : 'cloud'} size={16} />
      </motion.span>
      {(!compact || state === 'pending' || state === 'offline') && <span>{compact && state === 'pending' ? pending : text}</span>}
    </button>
  );
}
