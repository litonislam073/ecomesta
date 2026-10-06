const PATHS = {
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18M4 7.5l8 4.5 8-4.5',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6M9 12h6M9 16h3',
  card: 'M3 6h18v12H3V6zm0 4h18M7 15h4',
  truck: 'M3 6h11v10H3V6zm11 4h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zm-7 10v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9',
  tag: 'M3 12V4h8l10 10-8 8L3 12zm5-4.5a1 1 0 100 2 1 1 0 000-2z',
  palette:
    'M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2a5 5 0 005-5c0-3.6-4-6.5-10-6.5zM7.5 12a1 1 0 100-2 1 1 0 000 2zm3-4a1 1 0 100-2 1 1 0 000 2zm4 0a1 1 0 100-2 1 1 0 000 2z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zm-9-9h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  route: 'M6 19a2 2 0 100-4 2 2 0 000 4zm12-10a2 2 0 100-4 2 2 0 000 4zM6 15V9a3 3 0 013-3h3m0 12h3a3 3 0 003-3V9',
  cash: 'M3 7h18v10H3V7zm9 8a3 3 0 100-6 3 3 0 000 6zM6 10v4m12-4v4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3zm-3.5 9l2.5 2.5 4.5-5',
  flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21h11.6a2 2 0 001.7-2.5L14 9V3M7.5 15h9',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconBadge({ name }: { name: IconName }) {
  return (
    <span className="em-hover-icon inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-tint-strong)] text-[var(--color-accent)]">
      <Icon name={name} />
    </span>
  );
}
