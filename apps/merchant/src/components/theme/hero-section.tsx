"use client";

import type {
  StoreThemeConfig,
  ThemeHeroAlignment,
  ThemeHeroBadgeMode,
} from "@ecomesta/types";
import { ImageField } from "@/components/media/image-field";
import { Card } from "@/components/ui/card";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from "@/components/theme/theme-fields";

type Hero = NonNullable<StoreThemeConfig["hero"]>;

const ALIGNMENTS: readonly ThemeHeroAlignment[] = ["left", "center", "right"];

const BADGE_MODES: {
  value: ThemeHeroBadgeMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "auto",
    label: "Automatic",
    hint: 'Your best current discount, e.g. "UP TO 40% OFF".',
  },
  {
    value: "custom",
    label: "Custom text",
    hint: "Your own three short lines.",
  },
  { value: "hidden", label: "Hidden", hint: "No badge on the picture." },
];

/** ShopEase's round offer badge on the hero picture. */
function OfferBadgeFields({
  value,
  onChange,
  disabled,
}: {
  value: Hero;
  onChange: (patch: Hero) => void;
  disabled?: boolean;
}) {
  const mode = value.badgeMode ?? "auto";
  return (
    <fieldset className="space-y-3 rounded-md border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">
        Offer badge
      </legend>
      <div className="space-y-1.5">
        {BADGE_MODES.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 text-sm"
          >
            <input
              type="radio"
              name="hero-badge-mode"
              className="mt-0.5"
              checked={mode === option.value}
              disabled={disabled}
              onChange={() => onChange({ ...value, badgeMode: option.value })}
            />
            <span>
              <span className="block font-medium text-[var(--color-ink)]">
                {option.label}
              </span>
              <span className="block text-xs text-[var(--color-muted)]">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {mode === "custom" ? (
        <div className="grid gap-3">
          <TextField
            label="Top line"
            placeholder="UP TO"
            value={value.badgeTop ?? ""}
            disabled={disabled}
            onChange={(badgeTop) =>
              onChange({ ...value, badgeTop: badgeTop.slice(0, 20) })
            }
          />
          <TextField
            label="Big text"
            placeholder="50%"
            value={value.badgeMain ?? ""}
            disabled={disabled}
            onChange={(badgeMain) =>
              onChange({ ...value, badgeMain: badgeMain.slice(0, 12) })
            }
          />
          <TextField
            label="Bottom line"
            placeholder="OFF"
            value={value.badgeBottom ?? ""}
            disabled={disabled}
            onChange={(badgeBottom) =>
              onChange({ ...value, badgeBottom: badgeBottom.slice(0, 20) })
            }
          />
        </div>
      ) : null}
    </fieldset>
  );
}

export function HeroSection({
  storeId,
  value,
  onChange,
  disabled,
  themeSlug,
}: {
  /** Store whose gallery uploads go to; null while no store is selected. */
  storeId: string | null;
  value: Hero;
  onChange: (patch: Hero) => void;
  disabled?: boolean;
  /** Theme being edited: some hero options exist in one theme only. */
  themeSlug?: string;
}) {
  return (
    <Card
      title="Hero"
      description="The banner at the top of the storefront homepage."
    >
      <div className="grid gap-4">
        <div>
          <ToggleField
            label="Show hero"
            checked={value.enabled ?? false}
            disabled={disabled}
            onChange={(enabled) => onChange({ ...value, enabled })}
          />
        </div>
        <TextField
          label="Headline"

          value={value.headline ?? ""}
          disabled={disabled}
          onChange={(headline) => onChange({ ...value, headline })}
        />
        <TextAreaField
          label="Subheadline"

          value={value.subheadline ?? ""}
          disabled={disabled}
          onChange={(subheadline) => onChange({ ...value, subheadline })}
        />
        <TextField
          label="CTA label"
          value={value.ctaLabel ?? ""}
          disabled={disabled}
          onChange={(ctaLabel) => onChange({ ...value, ctaLabel })}
        />
        <TextField
          label="CTA link"
          hint="https URL or path starting with /"
          value={value.ctaHref ?? ""}
          disabled={disabled}
          onChange={(ctaHref) => onChange({ ...value, ctaHref })}
        />
        <ImageField
          label="Background image"
          purpose="background"
          previewShape="wide"
          storeId={storeId}
          value={value.imageUrl ?? ""}
          disabled={disabled}
          onChange={(imageUrl) => onChange({ ...value, imageUrl })}
        />
        <SelectField
          label="Alignment"
          value={value.alignment ?? "left"}
          options={ALIGNMENTS}
          disabled={disabled}
          onChange={(alignment) => onChange({ ...value, alignment })}
        />
        <NumberField
          label="Overlay opacity"
          hint="0 to 1"
          min={0}
          max={1}
          step={0.05}
          value={value.overlayOpacity}
          disabled={disabled}
          onChange={(overlayOpacity) => onChange({ ...value, overlayOpacity })}
        />
        {themeSlug === "shopease" ? (
          <OfferBadgeFields
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        ) : null}
      </div>
    </Card>
  );
}
