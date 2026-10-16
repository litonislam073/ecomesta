import { isValidElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GA4_MEASUREMENT_ID, GoogleAnalyticsScript } from './google-analytics';

describe('GoogleAnalyticsScript', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('loads the Ecomesta GA4 tag in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const tree = GoogleAnalyticsScript() as ReactElement<{ children: ReactElement[] }>;
    const [loader, config] = tree.props.children as ReactElement<{ src?: string; children?: string }>[];
    expect(GA4_MEASUREMENT_ID).toBe('G-3F3EJKLDYK');
    expect(isValidElement(loader) && loader.props.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-3F3EJKLDYK');
    expect(config!.props.children).toContain("gtag('config', 'G-3F3EJKLDYK');");
  });

  it('sends nothing from local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(GoogleAnalyticsScript()).toBeNull();
  });
});
