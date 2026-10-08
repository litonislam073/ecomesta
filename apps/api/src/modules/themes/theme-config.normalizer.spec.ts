import { BadRequestException } from '@nestjs/common';
import { THEME_FONT_FAMILIES } from '@ecomesta/utils';
import {
  OPTIONAL_URL_FIELDS,
  mergeThemeConfiguration,
  normalizeThemeConfiguration,
} from './theme-config.normalizer';

describe('optional URL clearing (TE-02)', () => {
  const OPTIONAL: Array<[string, string]> = Object.entries(OPTIONAL_URL_FIELDS).flatMap(
    ([section, fields]) => fields.map((field): [string, string] => [section, field]),
  );

  it('covers exactly the optional URL fields of the config schema', () => {
    expect(OPTIONAL).toEqual([
      ['branding', 'logoUrl'],
      ['branding', 'faviconUrl'],
      ['announcement', 'href'],
      ['hero', 'ctaHref'],
      ['hero', 'imageUrl'],
      ['seo', 'ogImageUrl'],
    ]);
  });

  it.each(OPTIONAL)('%s.%s: empty and whitespace-only normalize to the clear marker', (section, field) => {
    for (const blank of ['', '   ', '\t\n']) {
      expect(normalizeThemeConfiguration({ [section]: { [field]: blank } })).toEqual({
        [section]: { [field]: '' },
      });
    }
  });

  it.each(OPTIONAL)('%s.%s: unsafe or malformed values are still rejected', (section, field) => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/plain,x',
      'ftp://example.com/x',
      '//evil.example.com/x',
      'not a url',
      'https://x.example.com/"><script>alert(1)</script>',
      `https://x.example.com/${'a'.repeat(2100)}`,
    ]) {
      expect(() => normalizeThemeConfiguration({ [section]: { [field]: bad } })).toThrow(
        BadRequestException,
      );
    }
  });

  it.each(OPTIONAL)('%s.%s: null is still ignored, not treated as a clear', (section, field) => {
    expect(normalizeThemeConfiguration({ [section]: { [field]: null } })).toEqual({ [section]: {} });
  });

  it('keeps required URLs (menu hrefs, social URLs) non-empty', () => {
    for (const config of [
      { header: { menuItems: [{ label: 'A', href: '' }] } },
      { footer: { menuItems: [{ label: 'A', href: '   ' }] } },
      { footer: { socialLinks: [{ network: 'x', url: '' }] } },
    ]) {
      expect(() => normalizeThemeConfiguration(config)).toThrow(BadRequestException);
    }
  });

  it('merge removes a cleared URL and keeps every sibling and other section', () => {
    const base = {
      branding: { brandName: 'Acme', logoUrl: '/logo.png', faviconUrl: '/fav.ico' },
      hero: { headline: 'Welcome', ctaHref: '/products', imageUrl: '/hero.jpg' },
      announcement: { text: 'Hi', href: '/sale' },
    };
    const merged = mergeThemeConfiguration(base, normalizeThemeConfiguration({ branding: { logoUrl: '' } }));
    expect(merged).toEqual({
      branding: { brandName: 'Acme', faviconUrl: '/fav.ico' },
      hero: base.hero,
      announcement: base.announcement,
    });
    expect(base.branding.logoUrl).toBe('/logo.png'); // base not mutated

    const next = mergeThemeConfiguration(merged, normalizeThemeConfiguration({ hero: { ctaHref: '' } }));
    expect(next.hero).toEqual({ headline: 'Welcome', imageUrl: '/hero.jpg' });
    expect(next.branding).toEqual({ brandName: 'Acme', faviconUrl: '/fav.ico' });
  });

  it('merge never stores the clear marker, even for a new section or a never-set field', () => {
    expect(mergeThemeConfiguration({}, normalizeThemeConfiguration({ seo: { ogImageUrl: '' } }))).toEqual({ seo: {} });
    expect(
      mergeThemeConfiguration({ hero: { headline: 'x' } }, normalizeThemeConfiguration({ hero: { imageUrl: ' ' } })),
    ).toEqual({ hero: { headline: 'x' } });
  });

  it('text fields keep their existing behaviour (empty string is stored)', () => {
    expect(
      mergeThemeConfiguration({ hero: { headline: 'x' } }, normalizeThemeConfiguration({ hero: { headline: '' } })),
    ).toEqual({ hero: { headline: '' } });
  });
});

describe('font whitelist (TE-06)', () => {
  const FONT_FIELDS = ['headingFont', 'bodyFont'] as const;
  const WHITELIST = ['Inter', 'Work Sans', 'IBM Plex Sans', 'Source Sans 3', 'Georgia', 'Fraunces', 'System'];
  const INVALID: unknown[] = [
    'Comic Sans MS',
    'Roboto',
    'inter',
    'INTER',
    ' Inter ',
    'Inter ',
    '',
    '   ',
    'a'.repeat(500),
    '<b>Inter</b>',
    '<script>alert(1)</script>',
    "Inter'; } body { display:none } x{",
    'url(https://evil.example.com/font.woff)',
    'var(--font)',
    'Inter, sans-serif',
    "'Inter', system-ui, sans-serif",
    'Georgia, Fraunces',
    'expression(alert(1))',
    123,
    true,
    ['Inter'],
    { name: 'Inter' },
  ];

  it('the API list is exactly the editor/storefront list', () => {
    expect([...THEME_FONT_FAMILIES]).toEqual(WHITELIST);
  });

  it.each(FONT_FIELDS)('%s: accepts every whitelisted family unchanged', (field) => {
    for (const font of WHITELIST) {
      expect(normalizeThemeConfiguration({ typography: { [field]: font } })).toEqual({
        typography: { [field]: font },
      });
    }
  });

  it.each(FONT_FIELDS)('%s: rejects anything else with a 400, naming the allowed families', (field) => {
    for (const value of INVALID) {
      let error: unknown;
      try {
        normalizeThemeConfiguration({ typography: { [field]: value } });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        `configuration.typography.${field} must be one of: ${WHITELIST.join(', ')}`,
      );
    }
  });

  it('a request with valid changes plus one bad font is rejected as a whole', () => {
    expect(() =>
      normalizeThemeConfiguration({
        hero: { headline: 'Fine' },
        typography: { headingFont: 'Inter', bodyFont: 'Papyrus' },
      }),
    ).toThrow(BadRequestException);
  });

  it('null is still ignored, not a way to set a font', () => {
    expect(normalizeThemeConfiguration({ typography: { headingFont: null } })).toEqual({ typography: {} });
  });

  it('stored configurations are read back without re-validating the font', () => {
    expect(
      normalizeThemeConfiguration({ typography: { headingFont: 'Legacy Font' } }, { stored: true }),
    ).toEqual({ typography: { headingFont: 'Legacy Font' } });
    // Markup is still refused even when reading stored data.
    expect(() =>
      normalizeThemeConfiguration({ typography: { headingFont: '<b>x</b>' } }, { stored: true }),
    ).toThrow(BadRequestException);
  });
});

describe('homepage content sections', () => {
  const sections = (list: unknown[]) =>
    normalizeThemeConfiguration({ homepage: { sections: list } }).homepage?.sections;

  it('keeps rich text and image banner content, dropping empty optional fields', () => {
    expect(
      sections([
        { type: 'rich_text', id: 'about-1', title: 'About us', text: 'Line one\nLine two', buttonLabel: '', enabled: true },
        {
          type: 'image_banner',
          id: 'banner-2',
          title: 'Eid sale',
          imageUrl: 'https://cdn.example/eid.jpg',
          buttonLabel: 'Shop',
          buttonHref: '/products',
        },
      ]),
    ).toEqual([
      { type: 'rich_text', id: 'about-1', title: 'About us', text: 'Line one\nLine two', enabled: true },
      {
        type: 'image_banner',
        id: 'banner-2',
        title: 'Eid sale',
        imageUrl: 'https://cdn.example/eid.jpg',
        buttonLabel: 'Shop',
        buttonHref: '/products',
      },
    ]);
  });

  it('keeps the deal of the day settings', () => {
    expect(
      sections([
        { type: 'deal_of_day', title: 'Flash sale', productId: '11111111-1111-4111-8111-11111111111A', showCountdown: false },
        { type: 'deal_of_day', productId: '' },
      ]),
    ).toEqual([
      { type: 'deal_of_day', title: 'Flash sale', productId: '11111111-1111-4111-8111-11111111111a', showCountdown: false },
      { type: 'deal_of_day' },
    ]);
    expect(() => sections([{ type: 'deal_of_day', productId: 'abc' }])).toThrow(BadRequestException);
    expect(() => sections([{ type: 'deal_of_day', showCountdown: 'yes' }])).toThrow(BadRequestException);
  });

  it('refuses markup, unsafe links and odd ids', () => {
    expect(() => sections([{ type: 'rich_text', text: '<b>hi</b>' }])).toThrow(BadRequestException);
    expect(() => sections([{ type: 'image_banner', imageUrl: 'javascript:alert(1)' }])).toThrow(BadRequestException);
    expect(() => sections([{ type: 'image_banner', buttonHref: '//evil.example' }])).toThrow(BadRequestException);
    expect(() => sections([{ type: 'rich_text', id: 'a b' }])).toThrow(BadRequestException);
    expect(() => sections([{ type: 'rich_text', text: 'x'.repeat(1001) }])).toThrow(BadRequestException);
  });
});

describe('hero offer badge', () => {
  const hero = (input: Record<string, unknown>) => normalizeThemeConfiguration({ hero: input }).hero;

  it('keeps the mode and the three short lines', () => {
    expect(hero({ badgeMode: 'custom', badgeTop: 'EID', badgeMain: '50%', badgeBottom: 'OFF' })).toEqual({
      badgeMode: 'custom',
      badgeTop: 'EID',
      badgeMain: '50%',
      badgeBottom: 'OFF',
    });
    expect(hero({ badgeMode: 'hidden' })).toEqual({ badgeMode: 'hidden' });
  });

  it('refuses unknown modes, long lines and markup', () => {
    expect(() => hero({ badgeMode: 'blink' })).toThrow(BadRequestException);
    expect(() => hero({ badgeMain: 'x'.repeat(13) })).toThrow(BadRequestException);
    expect(() => hero({ badgeTop: 'y'.repeat(21) })).toThrow(BadRequestException);
    expect(() => hero({ badgeBottom: '<b>' })).toThrow(BadRequestException);
  });
});
