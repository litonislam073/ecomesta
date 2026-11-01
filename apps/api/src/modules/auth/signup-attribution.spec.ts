import {
  captureAttributionFromVisit,
  deriveSignupChannel,
  formatSignupChannelLabel,
  normalizeSignupAttribution,
  referrerHostFromUrl,
  signupAttributionSubtitle,
} from '@ecomesta/utils';

describe('signup attribution', () => {
  it('parses referrer hosts without www', () => {
    expect(referrerHostFromUrl('https://www.facebook.com/ads')).toBe('facebook.com');
    expect(referrerHostFromUrl('not-a-url')).toBeNull();
  });

  it('derives affiliate before UTM', () => {
    expect(
      deriveSignupChannel({
        affiliateCode: 'ABC12',
        utmSource: 'facebook',
        referrerHost: 'google.com',
      }),
    ).toBe('affiliate');
  });

  it('maps known UTM and referrer hosts', () => {
    expect(deriveSignupChannel({ utmSource: 'facebook' })).toBe('facebook');
    expect(deriveSignupChannel({ referrerHost: 'l.facebook.com' })).toBe('facebook');
    expect(deriveSignupChannel({ utmSource: 'google', utmMedium: 'cpc' })).toBe('google');
    expect(deriveSignupChannel({ referrerHost: 'instagram.com' })).toBe('instagram');
    expect(deriveSignupChannel({ referrerHost: 'youtube.com' })).toBe('youtube');
    expect(deriveSignupChannel({ referrerHost: 'news.example.com' })).toBe('referral');
    expect(deriveSignupChannel({ utmSource: 'newsletter' })).toBe('other');
    expect(deriveSignupChannel({})).toBe('direct');
  });

  it('captures visit params and normalizes for storage', () => {
    const captured = captureAttributionFromVisit({
      search: '?utm_source=Facebook&utm_medium=cpc&utm_campaign=Spring+Sale',
      referrer: 'https://www.google.com/',
      pathname: '/pricing',
    });
    const normalized = normalizeSignupAttribution({
      ...captured,
      affiliateCode: null,
    });
    expect(normalized.channel).toBe('facebook');
    expect(normalized.utmSource).toBe('facebook');
    expect(normalized.utmCampaign).toBe('Spring Sale');
    expect(normalized.referrerHost).toBe('google.com');
    expect(normalized.landingPath).toBe('/pricing');
  });

  it('formats labels and list subtitles', () => {
    expect(formatSignupChannelLabel('affiliate')).toBe('Affiliate');
    expect(formatSignupChannelLabel(null)).toBe('Unknown');
    expect(
      signupAttributionSubtitle({
        signupAffiliateCode: 'PARTNER1',
        signupUtmSource: 'facebook',
      }),
    ).toBe('ref PARTNER1');
    expect(
      signupAttributionSubtitle({
        signupUtmSource: 'facebook',
        signupUtmCampaign: 'spring',
      }),
    ).toBe('facebook · spring');
  });
});
