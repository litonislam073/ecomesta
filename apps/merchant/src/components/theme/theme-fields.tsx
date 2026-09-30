'use client';

import { useId, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { HEX_COLOR_PATTERN, colorFieldError } from '@/components/theme/theme-utils';

export function FieldLabel({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1 text-sm ${className}`}>
      <span className="block font-medium text-[var(--color-ink)]">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  disabled,
  hint,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FieldLabel label={label} hint={hint} className={className}>
      <Input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldLabel>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  hint,
  placeholder,
  rows = 3,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <FieldLabel label={label} hint={hint} className={className}>
      <textarea
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] disabled:opacity-60"
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldLabel>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  hint,
  className,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <FieldLabel label={label} hint={hint} className={className}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value === undefined ? '' : String(value)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    </FieldLabel>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
  className,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <FieldLabel label={label} hint={hint} className={className}>
      <Select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </FieldLabel>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-[var(--color-ink)]">{label}</span>
        {hint ? (
          <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * Hex text entry plus a native swatch. An invalid value stays on screen,
 * marked `aria-invalid` with its message linked, and the page refuses to save
 * until it is fixed (TE-05). `saved` is the last saved value of this field.
 */
export function ColorField({
  label,
  value,
  saved,
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  saved?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const errorId = useId();
  const current = value ?? '';
  const error = colorFieldError(value, saved);
  const trimmed = current.trim();
  const swatch = HEX_COLOR_PATTERN.test(trimmed)
    ? trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
      : trimmed.toLowerCase()
    : '#000000';
  return (
    <div className="space-y-1 text-sm">
      <label className="space-y-1">
        <span className="block font-medium text-[var(--color-ink)]">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            value={current}
            placeholder="#0f172a"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={error ? 'border-[var(--color-danger)]' : ''}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="color"
            aria-label={`${label} swatch`}
            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            value={swatch}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </label>
      {error ? (
        <p id={errorId} className="text-xs text-[var(--color-danger)]">
          <span className="font-medium">Invalid color:</span> {error} Fix it to save.
        </p>
      ) : null}
    </div>
  );
}

type MenuItem = { label: string; href: string };

function formatMenuItems(items: MenuItem[]): string {
  return items.map((item) => `${item.label} | ${item.href}`).join('\n');
}

function parseMenuItems(raw: string): MenuItem[] {
  return raw
    .split('\n')
    .map((line) => {
      const [itemLabel, href] = line.split('|');
      return {
        label: (itemLabel ?? '').trim(),
        href: (href ?? '').trim(),
      };
    })
    .filter((item) => item.label !== '' || item.href !== '');
}

/**
 * The textarea keeps the merchant's raw text and only the parsed items flow up,
 * so parsing never rewrites what is being typed (caret, spaces and newlines
 * stay put). The theme page remounts sections with a fresh `key` whenever a
 * new configuration loads, which re-seeds this buffer from `items`.
 */
export function MenuItemsField({
  label,
  items,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  items: MenuItem[];
  onChange: (items: MenuItem[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [raw, setRaw] = useState(() => formatMenuItems(items));
  return (
    <TextAreaField
      label={label}
      hint={
        hint ??
        'One item per line as "Label | /path". Extra lines are ignored when incomplete.'
      }
      rows={4}
      disabled={disabled}
      value={raw}
      onChange={(next) => {
        setRaw(next);
        onChange(parseMenuItems(next));
      }}
    />
  );
}
