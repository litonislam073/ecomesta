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
  TextColorsField,
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

const NEW_CARD = { label: "", title: "New card", imageUrl: "", href: "/products" };

/** Kenakata's two picture cards beside the hero: text, link and picture for each. */
function SideCardsFields({
  storeId,
  value,
  onChange,
  disabled,
}: {
  storeId: string | null;
  value: Hero;
  onChange: (patch: Hero) => void;
  disabled?: boolean;
}) {
  const cards = value.cards ?? [];
  const setCard = (index: number, patch: Partial<(typeof cards)[number]>) =>
    onChange({ ...value, cards: cards.map((card, i) => (i === index ? { ...card, ...patch } : card)) });
  return (
    <fieldset className="space-y-4 rounded-md border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">Side cards</legend>
      <p className="text-xs text-[var(--color-muted)]">
        Up to two picture cards beside the hero. The demo pictures are placeholders — upload your own or choose from your gallery.
        {value.cards === undefined ? " Without cards, your first two categories are shown." : ""}
      </p>
      {cards.map((card, index) => (
        <div key={index} className="space-y-3 rounded-md bg-[var(--color-bg)] p-3" role="group" aria-label={`Side card ${index + 1}`}>
          <TextField label="Small label" placeholder="Electronics" value={card.label ?? ""} disabled={disabled} onChange={(label) => setCard(index, { label })} />
          <TextField label="Title" placeholder="Gadgets for everyday" value={card.title ?? ""} disabled={disabled} onChange={(title) => setCard(index, { title })} />
          <TextField
            label="Link"
            hint="https URL or path starting with /"
            value={card.href ?? ""}
            disabled={disabled}
            onChange={(href) => setCard(index, { href })}
          />
          <ImageField
            label={`Card ${index + 1} picture`}
            purpose="general"
            storeId={storeId}
            value={card.imageUrl ?? ""}
            disabled={disabled}
            onChange={(imageUrl) => setCard(index, { imageUrl })}
            note="Shown on the right of the card. Square or portrait, about 600 × 600 px."
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, cards: cards.filter((_, i) => i !== index) })}
            className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
          >
            Remove card {index + 1}
          </button>
        </div>
      ))}
      {cards.length < 2 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...value, cards: [...cards, { ...NEW_CARD }] })}
          className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
        >
          + Add a card
        </button>
      ) : null}
    </fieldset>
  );
}

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
        <TextColorsField
          title="Text colours"
          fields={[
            ...(themeSlug === "kenakata" || themeSlug === "shopease"
              ? [{ label: "Small line", hint: "The short line above the headline (your tagline).", key: "eyebrowColor" as const }]
              : []),
            { label: "Heading", hint: "The big headline.", key: "headingColor" as const },
            { label: "Text", hint: "The sentence under the headline.", key: "textColor" as const },
          ]}
          value={value}
          disabled={disabled}
          onChange={(key, color) => onChange({ ...value, [key]: color })}
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
        {themeSlug === "kenakata" ? (
          <SideCardsFields storeId={storeId} value={value} onChange={onChange} disabled={disabled} />
        ) : null}
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
