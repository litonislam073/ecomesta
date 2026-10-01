/** A question and answer shown on FAQ sections (and used by the AI support agent). */
export interface Faq {
  question: string;
  answer: string;
}

export interface ContentSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Rendered as an ordered step diagram. */
  flow?: string[];
}

export interface RelatedLink {
  href: string;
  label: string;
  description: string;
}

export type ContentHub = 'features' | 'payments' | 'shipping' | 'solutions';

export interface ContentPage {
  hub: ContentHub;
  slug: string;
  /** Short label for navigation, cards and breadcrumbs. */
  name: string;
  /** Full `<title>`. */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  /** One-line summary used on hub cards. */
  summary: string;
  highlights: string[];
  sections: ContentSection[];
  faqs: Faq[];
  related: RelatedLink[];
}

export function contentPath(page: Pick<ContentPage, 'hub' | 'slug'>): string {
  return `/${page.hub}/${page.slug}`;
}
