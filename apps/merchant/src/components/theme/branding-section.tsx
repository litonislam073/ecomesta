"use client";

import type { StoreThemeConfig, ThemeBorderRadius } from "@ecomesta/types";
import { ImageField } from "@/components/media/image-field";
import { Card } from "@/components/ui/card";
import {
  ColorField,
  SelectField,
  TextField,
} from "@/components/theme/theme-fields";

type Branding = NonNullable<StoreThemeConfig["branding"]>;

const BORDER_RADIUS_OPTIONS: readonly ThemeBorderRadius[] = [
  "none",
  "sm",
  "md",
  "lg",
  "full",
];

const COLOR_FIELDS: Array<[keyof Branding, string]> = [
  ["primaryColor", "Primary color"],
  ["secondaryColor", "Secondary color"],
  ["accentColor", "Accent color"],
  ["backgroundColor", "Background color"],
  ["surfaceColor", "Surface color"],
  ["textColor", "Text color"],
  ["mutedTextColor", "Muted text color"],
];

/** One-click palettes: every color at once, still editable afterwards. */
export const COLOR_PRESETS: { name: string; colors: Partial<Branding> }[] = [
  {
    name: "Ocean",
    colors: {
      primaryColor: "#2563eb",
      secondaryColor: "#1e293b",
      accentColor: "#f59e0b",
      backgroundColor: "#ffffff",
      surfaceColor: "#f8fafc",
      textColor: "#0f172a",
      mutedTextColor: "#64748b",
    },
  },
  {
    name: "Sunset",
    colors: {
      primaryColor: "#f26522",
      secondaryColor: "#0f2b20",
      accentColor: "#f26522",
      backgroundColor: "#ffffff",
      surfaceColor: "#fbf3ec",
      textColor: "#111827",
      mutedTextColor: "#6b7280",
    },
  },
  {
    name: "Forest",
    colors: {
      primaryColor: "#15803d",
      secondaryColor: "#14281d",
      accentColor: "#ca8a04",
      backgroundColor: "#ffffff",
      surfaceColor: "#f0f7f2",
      textColor: "#10231a",
      mutedTextColor: "#5b6b62",
    },
  },
  {
    name: "Rose",
    colors: {
      primaryColor: "#db2777",
      secondaryColor: "#3b0d24",
      accentColor: "#db2777",
      backgroundColor: "#ffffff",
      surfaceColor: "#fdf2f7",
      textColor: "#1f1020",
      mutedTextColor: "#7a6170",
    },
  },
  {
    name: "Royal",
    colors: {
      primaryColor: "#7c3aed",
      secondaryColor: "#1e1b4b",
      accentColor: "#f59e0b",
      backgroundColor: "#ffffff",
      surfaceColor: "#f5f3ff",
      textColor: "#1e1b4b",
      mutedTextColor: "#6b6b80",
    },
  },
  {
    name: "Mono",
    colors: {
      primaryColor: "#111111",
      secondaryColor: "#333333",
      accentColor: "#111111",
      backgroundColor: "#ffffff",
      surfaceColor: "#f5f5f5",
      textColor: "#111111",
      mutedTextColor: "#737373",
    },
  },
];

export function BrandingSection({
  storeId,
  value,
  saved,
  onChange,
  disabled,
  part = "all",
}: {
  /** Store whose gallery uploads go to; null while no store is selected. */
  storeId: string | null;
  value: Branding;
  /** Last saved branding, for color validation. */
  saved?: Branding;
  onChange: (patch: Branding) => void;
  disabled?: boolean;
  /** The theme editor shows brand and colors as separate panels. */
  part?: "all" | "identity" | "colors";
}) {
  const identity = part !== "colors";
  const colors = part !== "identity";
  return (
    <Card
      title={
        part === "identity"
          ? "Logo & brand"
          : part === "colors"
            ? "Colors"
            : "Branding"
      }
      description={
        part === "identity"
          ? "Your store name, tagline, logo and browser icon."
          : part === "colors"
            ? "Pick a ready palette, then fine-tune any color."
            : "Logo, name, and the palette the storefront renders with."
      }
    >
      <div className="grid gap-4">
        {colors ? (
          <fieldset>
            <legend className="text-sm font-medium text-[var(--color-ink)]">
              Color presets
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const active = Object.entries(preset.colors).every(
                  ([key, color]) =>
                    (
                      value[key as keyof Branding] as string | undefined
                    )?.toLowerCase() === color,
                );
                return (
                  <button
                    key={preset.name}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`${preset.name} color preset`}
                    onClick={() => onChange({ ...value, ...preset.colors })}
                    className={`rounded-lg border p-1.5 text-left text-xs font-medium transition-colors disabled:opacity-60 ${
                      active
                        ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    <span
                      className="flex h-6 overflow-hidden rounded"
                      aria-hidden="true"
                    >
                      {[
                        preset.colors.primaryColor,
                        preset.colors.secondaryColor,
                        preset.colors.surfaceColor,
                        preset.colors.accentColor,
                      ].map((c, i) => (
                        <span
                          key={i}
                          className="flex-1"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="mt-1 block text-[var(--color-ink)]">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {identity ? (
          <>
            <TextField
              label="Brand name"
              value={value.brandName ?? ""}
              disabled={disabled}
              onChange={(brandName) => onChange({ ...value, brandName })}
            />
            <TextField
              label="Tagline"
              value={value.tagline ?? ""}
              disabled={disabled}
              onChange={(tagline) => onChange({ ...value, tagline })}
            />
            <ImageField
              label="Logo"
              purpose="logo"
              storeId={storeId}
              value={value.logoUrl ?? ""}
              disabled={disabled}
              onChange={(logoUrl) => onChange({ ...value, logoUrl })}
            />
            <ImageField
              label="Favicon"
              purpose="favicon"
              storeId={storeId}
              value={value.faviconUrl ?? ""}
              disabled={disabled}
              onChange={(faviconUrl) => onChange({ ...value, faviconUrl })}
            />
          </>
        ) : null}
        {colors ? (
          <>
            {COLOR_FIELDS.map(([key, label]) => (
              <ColorField
                key={key}
                label={label}
                value={value[key] as string | undefined}
                saved={saved?.[key] as string | undefined}
                disabled={disabled}
                onChange={(next) => onChange({ ...value, [key]: next })}
              />
            ))}
            <SelectField
              label="Border radius"
              value={value.borderRadius ?? "md"}
              options={BORDER_RADIUS_OPTIONS}
              disabled={disabled}
              onChange={(borderRadius) => onChange({ ...value, borderRadius })}
            />
          </>
        ) : null}
      </div>
    </Card>
  );
}
