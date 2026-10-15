'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { landingMarkup, type LandingItem } from '@ecomesta/utils';
import { itemText, useLanding } from './landing-context';

/** Stroke icons (24×24) the landing templates draw; unknown names draw a check. */
const ICONS: Record<string, ReactNode> = {
  check: <path d="M5 13l4 4L19 7" />,
  truck: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  ruler: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="1" />
      <path d="M7 9v3M11 9v2M15 9v3M19 9v2" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h10a3 3 0 1 0-3-3" />
      <path d="M3 12h14a3 3 0 1 1-3 3" />
      <path d="M3 16h6" />
    </>
  ),
  leaf: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-5 6-8 10-10" />,
  wash: <path d="M4 9l2 10h12l2-10M3 9h18M8 5c0 2 2 2 2 4M13 5c0 2 2 2 2 4" />,
  fit: <path d="M3 15l12-12 6 6-12 12zM8 10l2 2M11 7l2 2M5 13l2 2" />,
  flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M8 15h8" />,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  cup: <path d="M5 8h12v6a5 5 0 01-5 5h-2a5 5 0 01-5-5zM17 9h2a2 2 0 010 5h-2M8 3v2M12 3v2" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  drop: <path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z" />,
  hand: <path d="M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7a7 7 0 01-7 7H9a5 5 0 01-4-2l-2-3a1.5 1.5 0 012.4-1.8L8 15" />,
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-9-9a4.8 4.8 0 019-3 4.8 4.8 0 019 3c-2 4.6-9 9-9 9z" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4.5 4.5 0 0 0 8 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  star: <path fill="currentColor" stroke="none" d="M12 3l2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.9 6.5 19.7l1.1-6.1L3.2 9.4l6.1-.8L12 3z" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />,
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M16.8 7.2h.01" />
    </>
  ),
  play: <path fill="currentColor" stroke="none" d="M8 5v14l11-7z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  bag: (
    <>
      <path d="M6 7h12l1 13H5L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  moonFill: <path fill="currentColor" stroke="none" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  battery: <path d="M2 7h17v10H2zM22 11v2M6 10v4M10 10v4" />,
  signal: (
    <>
      <path d="M5 12a10 10 0 0114 0M8 15a6 6 0 018 0" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </>
  ),
  box: <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 3h6" />
    </>
  ),
  power: <path d="M12 3v9M6.5 6.5a8 8 0 1011 0" />,
  pan: (
    <>
      <circle cx="10" cy="12" r="7" />
      <path d="M17 12h5M6 12h8" />
    </>
  ),
  touch: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <circle cx="12" cy="16" r="2" />
      <path d="M8 7h8" />
    </>
  ),
  air: <path d="M3 9h11a3 3 0 10-3-3M3 15h14a3 3 0 11-3 3M3 12h7" />,
  tool: <path d="M14.5 6.5a4 4 0 005 5L21 13l-8 8-3-3 8-8zM9 15l-6 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  dots: (
    <>
      <circle cx="8" cy="9" r="2" />
      <circle cx="16" cy="8" r="1.5" />
      <circle cx="13" cy="15" r="2.5" />
      <circle cx="6" cy="16" r="1" />
    </>
  ),
  tone: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 010 16z" fill="currentColor" fillOpacity={0.25} />
    </>
  ),
  lines: <path d="M4 9c3-2 5 2 8 0s5-2 8 0M4 15c3-2 5 2 8 0s5-2 8 0" />,
  pores: (
    <>
      <circle cx="7" cy="7" r="2" />
      <circle cx="16" cy="8" r="2.5" />
      <circle cx="9" cy="16" r="2.5" />
      <circle cx="17" cy="17" r="1.5" />
    </>
  ),
  round: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="7" />
      <path d="M9 14c1.5 1.5 4.5 1.5 6 0" />
    </>
  ),
  fire: <path d="M12 3c1 3 4 5 4 9a4 4 0 01-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8zM8.5 20.5A7 7 0 0112 21a7 7 0 003.5-.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 11-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.5" />,
  star8: (
    <>
      <rect x="6" y="6" width="12" height="12" />
      <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
    </>
  ),
};

export function LpIcon({ name, className = 'h-6 w-6', strokeWidth = 2, style }: { name: string; className?: string; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {ICONS[name] ?? ICONS.check}
    </svg>
  );
}

export function Stars({ rating, className = 'h-5 w-5', dimClass = 'opacity-25' }: { rating: number; className?: string; dimClass?: string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating || 5)));
  return (
    <span className="flex" role="img" aria-label={`৫ এর মধ্যে ${value} স্টার`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <LpIcon key={i} name="star" className={`${className} ${i < value ? '' : dimClass}`} />
      ))}
    </span>
  );
}

/** Text with `==marked==` and `~~underlined~~` words; never HTML. */
export function Marked({ text, markClass, squiggleClass }: { text: string; markClass: string; squiggleClass?: string }) {
  return (
    <>
      {landingMarkup(text).map((piece, index) =>
        piece.style === 'mark' ? (
          <mark key={index} className={markClass}>
            {piece.text}
          </mark>
        ) : piece.style === 'squiggle' ? (
          <span key={index} className={squiggleClass ?? markClass}>
            {piece.text}
          </span>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </>
  );
}

/** Paragraphs separated by an empty line. */
export function Paragraphs({ text, className, markClass }: { text: string; className?: string; markClass: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            <Marked text={p} markClass={markClass} />
          </p>
        ))}
    </>
  );
}

export interface FaqSkin {
  item: string;
  button: string;
  question?: string;
  panel: string;
  chevron: string;
}

export function FaqList({ items, skin, firstOpen = false }: { items: LandingItem[]; skin: FaqSkin; firstOpen?: boolean }) {
  const [open, setOpen] = useState<number | null>(firstOpen ? 0 : null);
  return (
    <>
      {items.map((item, index) => {
        const expanded = open === index;
        const panelId = `lp-faq-${index}`;
        return (
          <div key={index} className={skin.item}>
            <h3>
              <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : index)} className={skin.button}>
                <span className={skin.question}>{itemText(item, 'question')}</span>
                <LpIcon name="chevron" className={`${skin.chevron} shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            <div id={panelId} hidden={!expanded} className={skin.panel}>
              {itemText(item, 'answer')}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** The 11-character YouTube ID of a link (or the ID itself), else null. */
export function youtubeId(value: string): string | null {
  const raw = value.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith('youtu.be')) return /^\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null;
    if (url.hostname.includes('youtube')) {
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      return /\/(?:embed|shorts|live)\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/** A video that loads the YouTube player only after the shopper taps play. */
export function LazyVideo({
  url,
  poster,
  className,
  buttonClass,
  noteClass,
  aspect = 'aspect-video',
  iconClass = 'ml-1 h-9 w-9',
  label = 'ভিডিও চালু করুন',
}: {
  url: string;
  poster: string;
  className: string;
  buttonClass: string;
  noteClass: string;
  /** Tailwind aspect class, e.g. `aspect-[9/16]` for reels. */
  aspect?: string;
  iconClass?: string;
  label?: string;
}) {
  const { preview } = useLanding();
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  return (
    <div className={`relative overflow-hidden ${aspect} ${className}`}>
      {playing && id ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="Video"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <button type="button" aria-label={label} onClick={() => id && setPlaying(true)} className="absolute inset-0 flex items-center justify-center">
            <span className={buttonClass}>
              <LpIcon name="play" className={iconClass} />
            </span>
          </button>
          {!id && preview ? <p className={noteClass}>এডিটরে YouTube ভিডিওর লিংক দিন।</p> : null}
        </>
      )}
    </div>
  );
}

/** Fades content in as it scrolls into view; visible straight away without JavaScript or with reduced motion. */
export function Reveal({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'figure' | 'article' }) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'static' | 'hidden' | 'shown'>('static');
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return;
    setState('hidden');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const motion = state === 'static' ? '' : `transition-all duration-700 ease-out ${state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`;
  const Tag = as;
  return (
    <Tag ref={ref as never} className={`${className} ${motion}`}>
      {children}
    </Tag>
  );
}

/** Whether the mobile order bar should show: after the hero button scrolls away, and not over the order form. */
export function useStickyBar(heroSelector = '[data-hero-cta]') {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector(heroSelector);
    const order = document.querySelector('[data-section="order"]');
    if (!('IntersectionObserver' in window) || !hero || !order) return;
    const seen = { hero: true, order: false };
    const paint = () => setShow(!seen.hero && !seen.order);
    const a = new IntersectionObserver((e) => {
      seen.hero = e[0]!.isIntersecting;
      paint();
    });
    const b = new IntersectionObserver(
      (e) => {
        seen.order = e[0]!.isIntersecting;
        paint();
      },
      { threshold: 0.05 },
    );
    a.observe(hero);
    b.observe(order);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, [heroSelector]);
  return show;
}

/** A picture from settings; nothing when empty. */
export function Pic({ src, alt = '', className, eager }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className={className} />;
}

export function initialsOf(name: string): string {
  const letters = Array.from(name.trim());
  return letters.slice(0, 2).join('');
}
