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

export const THEME_HERO_BADGE_MODES = ['auto', 'custom', 'hidden'] as const;
export type ThemeHeroBadgeMode = (typeof THEME_HERO_BADGE_MODES)[number];

export const THEME_SECTION_TYPES = [
  'featured_categories',
  'featured_products',
  'rich_text',
  'image_banner',
  'deal_of_day',
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
  /** Offer badge on the hero image (ShopEase): the store's best discount, custom text, or none. */
  badgeMode?: ThemeHeroBadgeMode;
  /** Custom badge lines, e.g. "UP TO" / "50%" / "OFF". */
  badgeTop?: string;
  badgeMain?: string;
  badgeBottom?: string;
}

export interface ThemeHomepageSection {
  type: ThemeSectionType;
  title?: string;
  enabled?: boolean;
  /** Content sections (rich text, image banner) may appear more than once: a stable id per instance. */
  id?: string;
  /** Body text (plain text; line breaks kept). */
  text?: string;
  buttonLabel?: string;
  buttonHref?: string;
  /** Image banner background. */
  imageUrl?: string;
  /** Deal of the day: the product to feature; unset = the biggest current discount. */
  productId?: string;
  /** Deal of the day: show the countdown to midnight. */
  showCountdown?: boolean;
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
/** Premium theme: included in Business, sold to Starter and Growth businesses. */
export const SHOPEASE_THEME_SLUG = 'shopease';
export const SHOPEASE_THEME_PRICE_BDT = 999;

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

export const SHOPEASE_THEME_CONFIGURATION: StoreThemeConfig = {
  // No placeholder brand name: the header and footer show the store's own name.
  branding: {
    tagline: 'Shop smart. Live better.',
    primaryColor: '#f26522',
    secondaryColor: '#0f2b20',
    accentColor: '#f26522',
    backgroundColor: '#ffffff',
    surfaceColor: '#fbf3ec',
    textColor: '#111827',
    mutedTextColor: '#6b7280',
    borderRadius: 'lg',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSize: 16,
  },
  announcement: {
    enabled: true,
    text: 'Cash on delivery across Bangladesh',
    backgroundColor: '#0f2b20',
    textColor: '#ffffff',
  },
  header: {
    layout: 'classic',
    sticky: true,
    showSearch: true,
    showCart: true,
    menuItems: [
      { label: 'Shop', href: '/products' },
      { label: 'Track order', href: '/track-order' },
    ],
  },
  hero: {
    enabled: true,
    headline: 'Shop More, Save More!',
    subheadline: 'Discover great deals on your favourite products.',
    ctaLabel: 'Explore collection',
    ctaHref: '/products',
    alignment: 'left',
    overlayOpacity: 0,
  },
  homepage: {
    featuredCategories: [],
    featuredProducts: [],
    sections: [
      { type: 'featured_categories', title: 'Shop by category', enabled: true },
      {
        type: 'deal_of_day',
        title: "Grab it before it's gone!",
        text: 'Today only — the offer ends at midnight.',
        buttonLabel: 'Shop the deal',
        showCountdown: true,
        enabled: true,
      },
      { type: 'featured_products', title: 'New arrivals', enabled: true },
    ],
  },
  footer: {
    tagline: 'Your one-stop shop for quality products at great prices.',
    copyright: '',
    showPaymentIcons: true,
    menuItems: [
      { label: 'Shop', href: '/products' },
      { label: 'Track order', href: '/track-order' },
    ],
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
  /** One-time price for businesses whose plan does not include it; null = free / plan feature. */
  priceBdt: number | null;
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
    priceBdt: null,
  },
  {
    slug: MINIMAL_THEME_SLUG,
    name: 'Minimal',
    version: '1.0.0',
    description:
      'Typography-led layout with muted chrome for small, focused catalogues.',
    previewImageUrl: null,
    configuration: MINIMAL_THEME_CONFIGURATION,
    priceBdt: null,
  },
  {
    slug: SHOPEASE_THEME_SLUG,
    name: 'ShopEase',
    version: '1.0.0',
    description:
      'Premium storefront: bold hero with offer badge, trust badges, category cards, deal of the day with countdown and new arrivals.',
    previewImageUrl: null,
    configuration: SHOPEASE_THEME_CONFIGURATION,
    priceBdt: SHOPEASE_THEME_PRICE_BDT,
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
