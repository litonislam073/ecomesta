import type { Metadata } from 'next';
import {
  DEFAULT_OG_IMAGE_PATH,
  ORGANIZATION_LOGO,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
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
}

export function buildMetadata({
  path,
  title,
  description,
  type = 'website',
  publishedTime,
  modifiedTime,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(DEFAULT_OG_IMAGE_PATH);
  const verification = googleSiteVerification();

  return {
    metadataBase: new URL(siteUrl()),
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_BD',
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

export function softwareApplicationJsonLd(): JsonLd {
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
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.publishedTime,
    dateModified: input.modifiedTime,
    mainEntityOfPage: absoluteUrl(input.path),
    image: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID(),
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl(ORGANIZATION_LOGO.path) },
    },
  };
}
