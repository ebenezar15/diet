import { db } from '@/db';
import { alive } from '@/db/repo';

/**
 * Local reminders. Browsers can't schedule notifications for a closed PWA without a push server,
 * so reminders fire while the app is open or running in the background; they use the service
 * worker's showNotification when available so they appear as system notifications.
 */
export function startReminders(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const fired = new Set<string>();
  const tick = async () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const list = alive(await db.reminders.toArray()).filter((r) => r.enabled && r.time === hhmm && r.days.includes(now.getDay()));
    for (const r of list) {
      const key = `${r.id}-${now.toDateString()}-${hhmm}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const reg = await navigator.serviceWorker?.getRegistration();
      const opts = { body: r.label, icon: '/icons/icon-192.png', tag: r.id };
      if (reg) await reg.showNotification('ThaliFit', opts);
      else new Notification('ThaliFit', opts);
    }
  };
  const id = setInterval(() => void tick(), 30_000);
  return () => clearInterval(id);
}

export async function askNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}
