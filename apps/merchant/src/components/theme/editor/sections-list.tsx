'use client';

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import {
  CONTENT_SECTIONS,
  HOME_BLOCKS,
  MAX_HOME_SECTIONS,
  effectiveHomeSections,
  isContentSection,
  newSectionId,
  patchHomeSection,
  sectionKey,
  type ContentSectionType,
  type HomeBlockType,
} from '@/components/theme/homepage-block-panel';

type FixedPanel =
  | 'announcement'
  | 'header'
  | 'hero'
  | 'featured_categories'
  | 'featured_products'
  | 'deal_of_day'
  | 'footer'
  | 'theme'
  | 'identity'
  | 'colors'
  | 'typography'
  | 'seo';

/** A sidebar panel: a fixed one, or `section:<id>` for a rich text / image banner section. */
export type EditorPanel = FixedPanel | `section:${string}`;

export const PANEL_LABELS: Record<FixedPanel, string> = {
  announcement: 'Announcement bar',
  header: 'Header',
  hero: 'Hero banner',
  featured_categories: 'Categories',
  featured_products: 'Products',
  deal_of_day: 'Deal of the day',
  footer: 'Footer',
  theme: 'Theme',
  identity: 'Logo & brand',
  colors: 'Colors',
  typography: 'Typography',
  seo: 'SEO',
};

export const SECTION_PANELS: EditorPanel[] = ['announcement', 'header', 'hero', 'featured_categories', 'featured_products', 'deal_of_day', 'footer'];

/** Panels that belong to the "Sections" tab (and to a section in the preview). */
export function isSectionPanel(panel: string): panel is EditorPanel {
  return (SECTION_PANELS as string[]).includes(panel) || panel.startsWith('section:');
}

/** A panel's title: a section is called by its heading, as in the list. */
export function panelTitle(panel: EditorPanel, draft: StoreThemeConfig): string {
  const sections = effectiveHomeSections(draft.homepage);
  const index = sections.findIndex((section, i) => sectionKey(section, i) === panel);
  const section = sections[index];
  // The deal's heading is a sales line; the section keeps its own name.
  if (section?.type === 'deal_of_day') return PANEL_LABELS.deal_of_day;
  if (section) {
    const title = section.title?.trim();
    if (title) return title;
    if (isContentSection(section.type)) return CONTENT_SECTIONS[section.type].label;
  }
  return panel.startsWith('section:') ? 'Section' : PANEL_LABELS[panel as FixedPanel];
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EYE_OFF = 'M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2';
const UP = 'M12 19V5M6 11l6-6 6 6';
const DOWN = 'M12 5v14M18 13l-6 6-6-6';
const GRIP = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

export const PANEL_ICONS: Record<FixedPanel | ContentSectionType, string> = {
  announcement: 'M4 9v6h3l6 4V5L7 9H4zM17 9a4 4 0 0 1 0 6',
  header: 'M3 5h18v5H3zM3 14h18M3 18h12',
  hero: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  featured_categories: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  featured_products: 'M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  deal_of_day: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  footer: 'M3 5h12M3 9h18M3 14h18v5H3z',
  theme: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.3-1.5-1.6-1.5-3 0-1 .8-1.4 1.8-1.4H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7h.01M15 7.5h.01',
  identity: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z',
  colors: 'M12 3a9 9 0 0 0 0 18 2 2 0 0 0 2-2v-.5a1.5 1.5 0 0 1 1.5-1.5H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 10.5h.01M11 7h.01M16 8.5h.01',
  typography: 'M4 7V5h16v2M9 19h6M12 5v14',
  seo: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-3.5-3.5',
  rich_text: 'M4 6h16M4 10h16M4 14h10M4 18h7',
  image_banner: 'M3 6h18v12H3zM3 15l4-4 4 4 3-3 7 7M15 9h.01',
};

function RowButton({ icon, label, hidden, onClick }: { icon: string; label: string; hidden?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span className={hidden ? 'text-[#b4bcc6]' : 'text-[var(--color-muted)]'}>
        <Icon d={icon} />
      </span>
      <span className={`min-w-0 flex-1 truncate ${hidden ? 'text-[var(--color-muted)] line-through decoration-[#c4ccd4]' : 'text-[var(--color-ink)]'}`}>
        {label}
      </span>
      {hidden ? <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Hidden</span> : null}
    </button>
  );
}

function Row({
  panel,
  label,
  hidden,
  onOpen,
  actions,
}: {
  panel: FixedPanel;
  label?: string;
  hidden?: boolean;
  onOpen: (panel: EditorPanel) => void;
  actions?: ReactNode;
}) {
  return (
    <li className="group flex items-center gap-1 rounded-lg hover:bg-[#f1f4f7]">
      <RowButton icon={PANEL_ICONS[panel]} label={label ?? PANEL_LABELS[panel]} hidden={hidden} onClick={() => onOpen(panel)} />
      {actions ? <span className="flex shrink-0 items-center pr-1">{actions}</span> : null}
    </li>
  );
}

function IconButton({ label, d, onClick, disabled, pressed }: { label: string; d: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon d={d} />
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-2">
      <h3 className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{title}</h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

/** "Add section": the content sections, plus product/category rows that were removed. */
function AddSectionMenu({
  missing,
  full,
  disabled,
  onAdd,
}: {
  missing: HomeBlockType[];
  full: boolean;
  disabled?: boolean;
  onAdd: (type: HomeBlockType | ContentSectionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const options: { type: HomeBlockType | ContentSectionType; label: string; description: string }[] = [
    ...(Object.keys(CONTENT_SECTIONS) as ContentSectionType[]).map((type) => ({ type, ...CONTENT_SECTIONS[type] })),
    ...missing.map((type) => ({ type, label: HOME_BLOCKS[type].label, description: `A row of your ${HOME_BLOCKS[type].plural}.` })),
  ];

  return (
    <li ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || full}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--color-accent)] hover:bg-[#f1f4f7] disabled:opacity-50"
      >
        <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-base leading-none">+</span>
        Add section
      </button>
      {full ? <p className="px-2.5 text-xs text-[var(--color-muted)]">Up to {MAX_HOME_SECTIONS} sections.</p> : null}
      {open ? (
        <ul role="menu" aria-label="Add section" className="absolute left-2 right-2 z-10 mt-1 rounded-lg border border-[var(--color-border)] bg-white p-1 shadow-lg">
          {options.map((option) => (
            <li key={option.type} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAdd(option.type);
                }}
                className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-[#f1f4f7]"
              >
                <span className="mt-0.5 text-[var(--color-muted)]">
                  <Icon d={PANEL_ICONS[option.type]} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[var(--color-ink)]">{option.label}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{option.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Sidebar root: the page's sections, Shopify-style, with show/hide, drag-and-drop order and add/remove. */
export function SectionsList({
  draft,
  disabled,
  onOpen,
  onChange,
}: {
  draft: StoreThemeConfig;
  disabled?: boolean;
  onOpen: (panel: EditorPanel) => void;
  onChange: <K extends keyof StoreThemeConfig>(key: K, value: StoreThemeConfig[K]) => void;
}) {
  const homepage = draft.homepage ?? {};
  const blocks = effectiveHomeSections(homepage);
  const missing = (Object.keys(HOME_BLOCKS) as HomeBlockType[]).filter((type) => !blocks.some((b) => b.type === type));
  const announcementOn = Boolean(draft.announcement?.enabled);
  const heroOn = draft.hero?.enabled !== false;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  function writeSections(sections: ThemeHomepageSection[]) {
    onChange('homepage', { ...homepage, sections });
  }

  /** Moves block `from` so it lands before position `to` (0…length). */
  function moveTo(from: number, to: number) {
    if (to === from || to === from + 1) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, item!);
    writeSections(next);
  }

  function patchAt(index: number, patch: Partial<ThemeHomepageSection>) {
    writeSections(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function add(type: HomeBlockType | ContentSectionType) {
    if (isContentSection(type)) {
      const section: ThemeHomepageSection = { type, id: newSectionId(type), enabled: true, title: CONTENT_SECTIONS[type].label };
      writeSections([...blocks, section]);
      onOpen(`section:${section.id}`);
    } else {
      onChange('homepage', patchHomeSection(homepage, type, { enabled: true }));
      onOpen(type);
    }
  }

  const eye = (on: boolean, name: string, toggle: () => void) => (
    <IconButton label={on ? `Hide ${name}` : `Show ${name}`} d={on ? EYE : EYE_OFF} pressed={!on} disabled={disabled} onClick={toggle} />
  );

  const onDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const after = rect.height > 0 && event.clientY > rect.top + rect.height / 2;
    setDropAt(after ? index + 1 : index);
  };
  const endDrag = () => {
    setDragFrom(null);
    setDropAt(null);
  };

  return (
    <div className="divide-y divide-[var(--color-border)]">
      <Group title="Header">
        <Row
          panel="announcement"
          hidden={!announcementOn}
          onOpen={onOpen}
          actions={eye(announcementOn, 'announcement bar', () =>
            onChange('announcement', { ...draft.announcement, enabled: !announcementOn }),
          )}
        />
        <Row panel="header" onOpen={onOpen} />
      </Group>
      <Group title="Home page">
        <Row
          panel="hero"
          hidden={!heroOn}
          onOpen={onOpen}
          actions={eye(heroOn, 'hero banner', () => onChange('hero', { ...draft.hero, enabled: !heroOn }))}
        />
        {blocks.map((block, index) => {
          const key = sectionKey(block, index);
          const on = block.enabled !== false;
          const content = isContentSection(block.type);
          const deal = block.type === 'deal_of_day';
          const fallback = content
            ? CONTENT_SECTIONS[block.type as ContentSectionType].label
            : deal
              ? PANEL_LABELS.deal_of_day
              : HOME_BLOCKS[block.type as HomeBlockType].label;
          const name = deal ? fallback : block.title?.trim() || fallback;
          const icon = PANEL_ICONS[block.type as HomeBlockType | ContentSectionType | 'deal_of_day'];
          return (
            <li
              key={key}
              data-section-row={key}
              draggable={!disabled}
              onDragStart={(event) => {
                setDragFrom(index);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', key);
              }}
              onDragOver={onDragOver(index)}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFrom !== null && dropAt !== null) moveTo(dragFrom, dropAt);
                endDrag();
              }}
              onDragEnd={endDrag}
              className={`group relative flex items-center gap-0.5 rounded-lg hover:bg-[#f1f4f7] ${dragFrom === index ? 'opacity-40' : ''}`}
            >
              {dropAt === index && dragFrom !== null ? (
                <span aria-hidden="true" className="absolute -top-px left-2 right-2 h-0.5 rounded bg-[var(--color-accent)]" />
              ) : null}
              {dropAt === index + 1 && dragFrom !== null && index === blocks.length - 1 ? (
                <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-0.5 rounded bg-[var(--color-accent)]" />
              ) : null}
              {!disabled ? (
                <span className="cursor-grab pl-1 text-[#b4bcc6] active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                  <Icon d={GRIP} />
                </span>
              ) : null}
              <RowButton icon={icon} label={name} hidden={!on} onClick={() => onOpen(key as EditorPanel)} />
              <span className="flex shrink-0 items-center pr-1">
                <IconButton label={`Move ${name} up`} d={UP} disabled={disabled || index === 0} onClick={() => moveTo(index, index - 1)} />
                <IconButton label={`Move ${name} down`} d={DOWN} disabled={disabled || index === blocks.length - 1} onClick={() => moveTo(index, index + 2)} />
                {eye(on, name, () => patchAt(index, { enabled: !on }))}
              </span>
            </li>
          );
        })}
        <AddSectionMenu missing={missing} full={blocks.length >= MAX_HOME_SECTIONS} disabled={disabled} onAdd={add} />
      </Group>
      <Group title="Footer">
        <Row panel="footer" onOpen={onOpen} />
      </Group>
    </div>
  );
}

/** Sidebar root of the "Theme settings" tab. */
export function SettingsList({ onOpen, themeName }: { onOpen: (panel: EditorPanel) => void; themeName: string }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      <Group title="Theme">
        <Row panel="theme" label={`Theme: ${themeName}`} onOpen={onOpen} />
      </Group>
      <Group title="Style">
        <Row panel="identity" onOpen={onOpen} />
        <Row panel="colors" onOpen={onOpen} />
        <Row panel="typography" onOpen={onOpen} />
      </Group>
      <Group title="Search">
        <Row panel="seo" onOpen={onOpen} />
      </Group>
    </div>
  );
}
