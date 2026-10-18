import type { Metadata } from 'next';
import type { PublicPlan } from '@ecomesta/types';
import {
  SOCIAL_LINKS,
  SUPPORT_PHONE,
  hasBanglaVersion,
  toBanglaPath,
  toEnglishPath,
  type MarketingLocale,
} from '@ecomesta/ui/marketing';
import {
  DEFAULT_OG_IMAGE_PATH,
  ORGANIZATION_LOGO,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  contactEmail,
  googleSiteVerification,
  siteUrl,
} from '@/lib/marketing/site';

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  /** Bangla pages live under /bn and point at their English twin. */
  locale?: MarketingLocale;
  /** Share image path (1200×630); the site-wide default when omitted. */
  image?: string;
}

/** hreflang links for a page that exists in English and Bangla; undefined otherwise. */
export function languageAlternates(path: string): Record<string, string> | undefined {
  const english = toEnglishPath(path) ?? path;
  if (!hasBanglaVersion(english)) return undefined;
  return {
    'en-BD': absoluteUrl(english),
    'bn-BD': absoluteUrl(toBanglaPath(english)),
    'x-default': absoluteUrl(english),
  };
}

export function buildMetadata({
  path,
  title,
  description,
  type = 'website',
  publishedTime,
  modifiedTime,
  locale = 'en',
  image: imagePath = DEFAULT_OG_IMAGE_PATH,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const languages = languageAlternates(path);
  const image = absoluteUrl(imagePath);
  const verification = googleSiteVerification();

  return {
    metadataBase: new URL(siteUrl()),
    title: { absolute: title },
    description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: locale === 'bn' ? 'bn_BD' : 'en_BD',
      ...(languages ? { alternateLocale: locale === 'bn' ? 'en_BD' : 'bn_BD' } : {}),
      images: [{ url: image, width: 1200, height: 630, alt: SITE_NAME }],
      ...(type === 'article'
        ? { type: 'article', publishedTime, modifiedTime }
        : { type: 'website' }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = () => `${absoluteUrl('/')}#organization`;
const WEBSITE_ID = () => `${absoluteUrl('/')}#website`;

export function organizationJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(ORGANIZATION_LOGO.path),
      width: ORGANIZATION_LOGO.width,
      height: ORGANIZATION_LOGO.height,
    },
    description: SITE_DESCRIPTION,
    areaServed: 'BD',
    telephone: SUPPORT_PHONE.e164,
    email: contactEmail(),
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SUPPORT_PHONE.e164,
      email: contactEmail(),
      contactType: 'customer support',
      areaServed: 'BD',
      availableLanguage: ['bn', 'en'],
    },
    sameAs: SOCIAL_LINKS.map((social) => social.href),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID() },
  };
}

/** Monthly price of each plan, in BDT, from the same data the pricing page shows. */
export function planOffersJsonLd(plans: PublicPlan[]): JsonLd[] {
  return plans.map((plan) => ({
    '@type': 'Offer',
    name: plan.name,
    price: String(plan.monthlyPrice),
    priceCurrency: plan.currency,
    url: absoluteUrl('/pricing'),
    category: 'subscription',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: String(plan.monthlyPrice),
      priceCurrency: plan.currency,
      unitCode: 'MON',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    },
  }));
}

export function softwareApplicationJsonLd(plans?: PublicPlan[] | null): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Ecommerce platform',
    operatingSystem: 'Web',
    url: absoluteUrl('/'),
    description: SITE_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID() },
    ...(plans?.length ? { offers: planOffersJsonLd(plans) } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export interface Faq {
  question: string;
  answer: string;
}

export function faqJsonLd(faqs: Faq[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function articleJsonLd(input: {
  path: string;
  title: string;
  description: string;
  publishedTime: string;
  modifiedTime: string;
  /** Article image path; the site-wide share image when omitted. */
  image?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.publishedTime,
    dateModified: input.modifiedTime,
    mainEntityOfPage: absoluteUrl(input.path),
    image: absoluteUrl(input.image ?? DEFAULT_OG_IMAGE_PATH),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID(),
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl(ORGANIZATION_LOGO.path) },
    },
  };
}
