'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { HEX_COLOR_PATTERN } from '@/components/theme/theme-utils';

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
 * Hex text entry plus a native swatch. Invalid drafts are flagged here and
 * dropped from the payload by `sanitizeThemeConfig` rather than failing a save.
 */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const current = value ?? '';
  const valid = current === '' || HEX_COLOR_PATTERN.test(current);
  return (
    <div className="space-y-1 text-sm">
      <label className="space-y-1">
        <span className="block font-medium text-[var(--color-ink)]">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            value={current}
            placeholder="#0f172a"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="color"
            aria-label={`${label} swatch`}
            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            value={HEX_COLOR_PATTERN.test(current) ? current : '#000000'}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </label>
      {!valid ? (
        <p className="text-xs text-[var(--color-danger)]">
          Use a hex color such as #fff or #1a2b3c. This value will not be saved.
        </p>
      ) : null}
    </div>
  );
}

export function MenuItemsField({
  label,
  items,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  items: Array<{ label: string; href: string }>;
  onChange: (items: Array<{ label: string; href: string }>) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <TextAreaField
      label={label}
      hint={
        hint ??
        'One item per line as "Label | /path". Extra lines are ignored when incomplete.'
      }
      rows={4}
      disabled={disabled}
      value={items.map((item) => `${item.label} | ${item.href}`).join('\n')}
      onChange={(raw) => {
        const parsed = raw
          .split('\n')
          .map((line) => {
            const [itemLabel, href] = line.split('|');
            return {
              label: (itemLabel ?? '').trim(),
              href: (href ?? '').trim(),
            };
          })
          .filter((item) => item.label !== '' || item.href !== '');
        onChange(parsed);
      }}
    />
  );
}
