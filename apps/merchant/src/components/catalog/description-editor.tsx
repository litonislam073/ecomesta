'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { RichTextContent } from '@ecomesta/ui';

export const DESCRIPTION_MAX_LENGTH = 10000;

type Edit = { text: string; start: number; end: number };

/** Wraps the selection in `marker` (or inserts a placeholder to type over). */
export function wrapSelection(value: string, start: number, end: number, marker: string, placeholder: string): Edit {
  const selected = value.slice(start, end);
  const lead = selected.match(/^\s*/)?.[0] ?? '';
  const trail = selected.match(/\s*$/)?.[0] ?? '';
  const inner = selected.trim() || placeholder;
  const before = value.slice(0, start) + lead + marker;
  const text = before + inner + marker + trail + value.slice(end);
  return { text, start: before.length, end: before.length + inner.length };
}

/** Starts every selected line with `prefix` (lists, heading). */
export function prefixLines(value: string, start: number, end: number, prefix: (index: number) => string, placeholder: string): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const strip = (line: string) => line.replace(/^\s*(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/, '');
  const body = lines.every((line) => !line.trim())
    ? prefix(0) + placeholder
    : lines.map((line, i) => (line.trim() ? prefix(i) + strip(line) : line)).join('\n');
  // Keep a blank line before a list or heading so it starts its own block.
  const needsGap = lineStart > 0 && value.slice(0, lineStart).trim() !== '' && !/\n\s*\n$/.test(value.slice(0, lineStart));
  const before = value.slice(0, lineStart) + (needsGap ? '\n' : '');
  const text = before + body + value.slice(lineEnd);
  return { text, start: before.length, end: before.length + body.length };
}

const TOOLS: { key: string; label: string; title: string; apply: (v: string, s: number, e: number) => Edit }[] = [
  { key: 'heading', label: 'H', title: 'Heading', apply: (v, s, e) => prefixLines(v, s, e, () => '## ', 'Heading') },
  { key: 'bold', label: 'B', title: 'Bold (Ctrl+B)', apply: (v, s, e) => wrapSelection(v, s, e, '**', 'bold text') },
  { key: 'italic', label: 'I', title: 'Italic (Ctrl+I)', apply: (v, s, e) => wrapSelection(v, s, e, '*', 'italic text') },
  { key: 'bullets', label: '• List', title: 'Bullet list', apply: (v, s, e) => prefixLines(v, s, e, () => '- ', 'List item') },
  { key: 'numbers', label: '1. List', title: 'Numbered list', apply: (v, s, e) => prefixLines(v, s, e, (i) => `${i + 1}. `, 'List item') },
  {
    key: 'link',
    label: 'Link',
    title: 'Link',
    apply: (v, s, e) => {
      const label = v.slice(s, e).trim() || 'link text';
      const before = v.slice(0, s) + '[' + label + '](';
      const url = 'https://';
      return { text: before + url + ')' + v.slice(e), start: before.length, end: before.length + url.length };
    },
  },
];

export function DescriptionEditor({
  value,
  onChange,
  label = 'Description',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  const run = (apply: (v: string, s: number, e: number) => Edit) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = apply(value, start, end);
    onChange(next.text.slice(0, DESCRIPTION_MAX_LENGTH));
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(next.start, next.end);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    const tool = key === 'b' ? TOOLS[1] : key === 'i' ? TOOLS[2] : null;
    if (!tool) return;
    event.preventDefault();
    run(tool.apply);
  };

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium ${active ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`;

  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block">
        {label}
      </label>
      <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-accent)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[#f6f8fa] px-2 py-1.5">
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1">
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                title={tool.title}
                aria-label={tool.title}
                disabled={tab !== 'write'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(tool.apply)}
                className={`min-w-8 rounded px-2 py-1 text-xs text-[var(--color-ink)] hover:bg-white disabled:opacity-40 ${tool.key === 'bold' ? 'font-bold' : tool.key === 'italic' ? 'italic' : 'font-medium'}`}
              >
                {tool.label}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Description view" className="flex gap-1 rounded-md bg-[#eaeef2] p-0.5">
            <button type="button" role="tab" aria-selected={tab === 'write'} className={tabClass(tab === 'write')} onClick={() => setTab('write')}>
              Write
            </button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} className={tabClass(tab === 'preview')} onClick={() => setTab('preview')}>
              Preview
            </button>
          </div>
        </div>
        {tab === 'write' ? (
          <textarea
            id={id}
            ref={ref}
            rows={10}
            maxLength={DESCRIPTION_MAX_LENGTH}
            className="block min-h-48 w-full resize-y bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
            value={value}
            onKeyDown={onKeyDown}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <div className="min-h-48 px-3 py-2 text-[var(--color-ink)]" data-testid="description-preview">
            {value.trim() ? (
              <RichTextContent text={value} />
            ) : (
              <p className="text-[var(--color-muted)]">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-3 text-xs text-[var(--color-muted)]">
        <span>Select text and use the buttons to format it. Leave an empty line to start a new paragraph.</span>
        <span className="shrink-0">
          {value.length.toLocaleString()} / {DESCRIPTION_MAX_LENGTH.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
