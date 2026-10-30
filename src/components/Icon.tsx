const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7',
  cart: 'M3 4h2l2.4 11h10.8L21 7H6.2M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gut: 'M7 4c-2 2-2 5 0 6s5 1 5 4-4 3-4 6M16 4c2 2 1 5-1 6',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 017.5-2',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  swap: 'M7 7h13l-4-4M17 17H4l4 4',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 100-16 8 8 0 000 16z',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-8-6-13-2 3-3 5-3 7-1-1-2-2-2-4-2 2-3 5-3 7 0 5 3 10 7 10z',
  drop: 'M12 3s7 7 7 12a7 7 0 01-14 0c0-5 7-12 7-12z',
  heart: 'M20.8 6.6a5 5 0 00-8.8-2.1 5 5 0 00-8.8 2.1C2.4 11 12 20 12 20s9.6-9 8.8-13.4z',
  share: 'M4 12v8h16v-8M12 3v13M7 8l5-5 5 5',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  chef: 'M6 14v6h12v-6M6 14a4 4 0 01-.5-8A5 5 0 0112 3a5 5 0 016.5 3 4 4 0 01-.5 8z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  cloud: 'M7 18a5 5 0 01-.5-10A6 6 0 0118 9a4.5 4.5 0 01-.5 9z',
  cloudOff: 'M3 3l18 18M7 18a5 5 0 01-1.6-9.7M10.5 6.2A6 6 0 0118 9a4.5 4.5 0 012.2 8.4',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-5M12 8h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  scale: 'M4 20h16M6 20l2-14h8l2 14M12 10l2-2',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 3v13M7 11l5 5 5-5M4 21h16',
  upload: 'M12 21V8M7 13l5-5 5 5M4 3h16',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  leaf: 'M5 21c0-9 5-15 15-16-1 10-7 15-15 16zM5 21l8-8',
  bell: 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  airfryer: 'M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM4 9h16M8 6h.01M12 14a3 3 0 100-.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'
};

export function Icon({ name, size = 20, className = '', label }: { name: keyof typeof P | string; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
