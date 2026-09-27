/**
 * Phase 16 storefront theming — config contract.
 *
 * The stored JSON is a closed schema: only the keys described here survive
 * `normalizeThemeConfiguration`. Keep this file free of NestJS imports so the
 * Prisma seed can reuse the built-in theme definitions.
 */

export const THEME_BORDER_RADII = ['none', 'sm', 'md', 'lg', 'full'] as const;
export type ThemeBorderRadius = (typeof THEME_BORDER_RADII)[number];

export const THEME_HEADER_LAYOUTS = ['classic', 'centered', 'minimal'] as const;
export type ThemeHeaderLayout = (typeof THEME_HEADER_LAYOUTS)[number];

export const THEME_HERO_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type ThemeHeroAlignment = (typeof THEME_HERO_ALIGNMENTS)[number];

export const THEME_SECTION_TYPES = [
  'featured_categories',
  'featured_products',
  'rich_text',
  'custom',
] as const;
export type ThemeSectionType = (typeof THEME_SECTION_TYPES)[number];

export const THEME_SOCIAL_NETWORKS = [
  'facebook',
  'instagram',
  'twitter',
  'x',
  'youtube',
  'tiktok',
  'linkedin',
  'other',
] as const;
export type ThemeSocialNetwork = (typeof THEME_SOCIAL_NETWORKS)[number];

export interface ThemeBrandingConfig {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderRadius?: ThemeBorderRadius;
}

export interface ThemeTypographyConfig {
  headingFont?: string;
  bodyFont?: string;
  baseFontSize?: number;
  headingLetterSpacing?: number;
}

export interface ThemeAnnouncementConfig {
  enabled?: boolean;
  text?: string;
  href?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface ThemeMenuItem {
  label: string;
  href: string;
}

export interface ThemeHeaderConfig {
  layout?: ThemeHeaderLayout;
  sticky?: boolean;
  showSearch?: boolean;
  showCart?: boolean;
  menuItems?: ThemeMenuItem[];
}

export interface ThemeHeroConfig {
  enabled?: boolean;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  alignment?: ThemeHeroAlignment;
  overlayOpacity?: number;
}

export interface ThemeHomepageSection {
  type: ThemeSectionType;
  title?: string;
  enabled?: boolean;
}

export interface ThemeHomepageConfig {
  featuredCategories?: string[];
  featuredProducts?: string[];
  sections?: ThemeHomepageSection[];
}

export interface ThemeSocialLink {
  network: ThemeSocialNetwork;
  url: string;
}

export interface ThemeFooterConfig {
  tagline?: string;
  copyright?: string;
  showPaymentIcons?: boolean;
  menuItems?: ThemeMenuItem[];
  socialLinks?: ThemeSocialLink[];
}

export interface ThemeSeoConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImageUrl?: string;
}

export interface StoreThemeConfig {
  branding?: ThemeBrandingConfig;
  typography?: ThemeTypographyConfig;
  announcement?: ThemeAnnouncementConfig;
  header?: ThemeHeaderConfig;
  hero?: ThemeHeroConfig;
  homepage?: ThemeHomepageConfig;
  footer?: ThemeFooterConfig;
  seo?: ThemeSeoConfig;
}

export const THEME_CONFIG_SECTIONS = [
  'branding',
  'typography',
  'announcement',
  'header',
  'hero',
  'homepage',
  'footer',
  'seo',
] as const;
export type ThemeConfigSection = (typeof THEME_CONFIG_SECTIONS)[number];

/** Shared field caps — also used by the DTO decorators. */
export const THEME_LIMITS = {
  brandName: 120,
  tagline: 200,
  title: 200,
  description: 1000,
  announcementText: 280,
  fontName: 80,
  label: 80,
  href: 2048,
  url: 2048,
  keyword: 60,
  menuItems: 12,
  socialLinks: 8,
  featuredIds: 24,
  sections: 10,
  keywords: 20,
  baseFontSizeMin: 12,
  baseFontSizeMax: 24,
} as const;

export const DEFAULT_THEME_SLUG = 'default';
export const MINIMAL_THEME_SLUG = 'minimal';

export const DEFAULT_THEME_CONFIGURATION: StoreThemeConfig = {
  branding: {
    brandName: 'Your Store',
    tagline: 'Everything you need, delivered.',
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    accentColor: '#f59e0b',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8fafc',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    borderRadius: 'md',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSize: 16,
  },
  announcement: {
    enabled: false,
    text: 'Free shipping on orders over $50',
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
  },
  header: {
    layout: 'classic',
    sticky: true,
    showSearch: true,
    showCart: true,
    menuItems: [
      { label: 'Shop', href: '/products' },
      { label: 'Categories', href: '/categories' },
    ],
  },
  hero: {
    enabled: true,
    headline: 'Shop the new arrivals',
    subheadline:
      'Curated products, fast delivery, and support you can actually reach.',
    ctaLabel: 'Browse products',
    ctaHref: '/products',
    alignment: 'left',
    overlayOpacity: 0.35,
  },
  homepage: {
    featuredCategories: [],
    featuredProducts: [],
    sections: [
      { type: 'featured_categories', title: 'Shop by category', enabled: true },
      { type: 'featured_products', title: 'Featured products', enabled: true },
    ],
  },
  footer: {
    tagline: 'Built with Ecomesta.',
    copyright: '',
    showPaymentIcons: true,
    menuItems: [],
    socialLinks: [],
  },
  seo: {
    title: '',
    description: '',
    keywords: [],
  },
};

export const MINIMAL_THEME_CONFIGURATION: StoreThemeConfig = {
  branding: {
    brandName: 'Your Store',
    tagline: 'Less noise. Better products.',
    primaryColor: '#111111',
    secondaryColor: '#555555',
    accentColor: '#111111',
    backgroundColor: '#ffffff',
    surfaceColor: '#ffffff',
    textColor: '#111111',
    mutedTextColor: '#777777',
    borderRadius: 'none',
  },
  typography: {
    headingFont: 'Work Sans',
    bodyFont: 'IBM Plex Sans',
    baseFontSize: 15,
  },
  announcement: {
    enabled: false,
    text: '',
    backgroundColor: '#ffffff',
    textColor: '#111111',
  },
  header: {
    layout: 'minimal',
    sticky: false,
    showSearch: false,
    showCart: true,
    menuItems: [{ label: 'Shop', href: '/products' }],
  },
  hero: {
    enabled: true,
    headline: 'A quieter way to shop',
    subheadline: 'A small catalogue, chosen carefully.',
    ctaLabel: 'View catalogue',
    ctaHref: '/products',
    alignment: 'center',
    overlayOpacity: 0,
  },
  homepage: {
    featuredCategories: [],
    featuredProducts: [],
    sections: [
      { type: 'featured_products', title: 'Catalogue', enabled: true },
    ],
  },
  footer: {
    tagline: '',
    copyright: '',
    showPaymentIcons: false,
    menuItems: [],
    socialLinks: [],
  },
  seo: {
    title: '',
    description: '',
    keywords: [],
  },
};

export interface BuiltInThemeDefinition {
  slug: string;
  name: string;
  version: string;
  description: string;
  previewImageUrl: string | null;
  configuration: StoreThemeConfig;
}

/** Seeded by `prisma/seed.ts` and self-healed by `ThemesService`. */
export const BUILT_IN_THEMES: BuiltInThemeDefinition[] = [
  {
    slug: DEFAULT_THEME_SLUG,
    name: 'Default',
    version: '1.0.0',
    description:
      'Balanced storefront layout with hero banner, featured categories and products.',
    previewImageUrl: null,
    configuration: DEFAULT_THEME_CONFIGURATION,
  },
  {
    slug: MINIMAL_THEME_SLUG,
    name: 'Minimal',
    version: '1.0.0',
    description:
      'Typography-led layout with muted chrome for small, focused catalogues.',
    previewImageUrl: null,
    configuration: MINIMAL_THEME_CONFIGURATION,
  },
];

export function builtInThemeConfiguration(slug: string): StoreThemeConfig {
  const match = BUILT_IN_THEMES.find((theme) => theme.slug === slug);
  return structuredCloneConfig(match?.configuration ?? {});
}

/** Small local clone so seeds and services never share mutable defaults. */
export function structuredCloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
