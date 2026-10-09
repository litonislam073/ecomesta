"use client";

import { useState } from "react";

/** A small picture of each built-in theme for the library cards. */
const THEME_LOOKS: Record<
  string,
  { bar: string; hero: string; accent: string; surface: string; text: string }
> = {
  default: {
    bar: "#1e293b",
    hero: "#f8fafc",
    accent: "#2563eb",
    surface: "#ffffff",
    text: "#0f172a",
  },
  minimal: {
    bar: "#ffffff",
    hero: "#ffffff",
    accent: "#111111",
    surface: "#f5f5f5",
    text: "#111111",
  },
  shopease: {
    bar: "#0f2b20",
    hero: "#0f2b20",
    accent: "#f26522",
    surface: "#fbf3ec",
    text: "#ffffff",
  },
};
const FALLBACK_LOOK = {
  bar: "#334155",
  hero: "#f1f5f9",
  accent: "#64748b",
  surface: "#ffffff",
  text: "#0f172a",
};

/** Drawn stand-in for a theme without a screenshot. */
function DrawnThumbnail({ slug, name }: { slug: string; name: string }) {
  const look = THEME_LOOKS[slug] ?? FALLBACK_LOOK;
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white"
    >
      <div className="h-2" style={{ backgroundColor: look.bar }} />
      <div className="flex items-center justify-between px-3 py-2">
        <span
          className="h-2 w-16 rounded"
          style={{
            backgroundColor: look.text === "#ffffff" ? look.bar : look.text,
          }}
        />
        <span
          className="h-3 w-10 rounded"
          style={{ backgroundColor: look.accent }}
        />
      </div>
      <div
        className="mx-3 flex h-20 flex-col justify-center gap-1.5 rounded-md px-3"
        style={{ backgroundColor: look.hero }}
      >
        <span
          className="h-2.5 w-2/3 rounded"
          style={{
            backgroundColor: look.text === "#ffffff" ? "#ffffff" : look.text,
          }}
        />
        <span
          className="h-2.5 w-1/3 rounded"
          style={{ backgroundColor: look.accent }}
        />
        <span
          className="mt-1 h-3 w-14 rounded"
          style={{ backgroundColor: look.accent }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="aspect-square rounded"
            style={{
              backgroundColor: look.surface,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          />
        ))}
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}

/** Screenshots of the built-in themes on a demo store (public/theme-previews). */
export function previewSrc(theme: {
  slug: string;
  previewImageUrl: string | null;
}) {
  return theme.previewImageUrl || `/theme-previews/${theme.slug}.jpg`;
}

/** A real screenshot of the theme, or the drawn stand-in if there is none. */
export function ThemeThumbnail({
  theme,
  large = false,
}: {
  theme: { slug: string; name: string; previewImageUrl: string | null };
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <DrawnThumbnail slug={theme.slug} name={theme.name} />;
  return (
    <div
      className={`group/thumb overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#f1f4f7] ${large ? "aspect-[16/10] lg:aspect-[16/7]" : "aspect-[16/11]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc(theme)}
        alt={`${theme.name} theme preview`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover/thumb:scale-[1.03]"
      />
    </div>
  );
}
