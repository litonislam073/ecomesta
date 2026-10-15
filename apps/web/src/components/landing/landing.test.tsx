import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProductDetail, PublicStore } from '@ecomesta/types';
import { defaultLandingContent, LANDING_TEMPLATE_KEYS, type LandingTemplateKey } from '@ecomesta/utils';
import type { PublicLandingPage } from '@/lib/landing';
import { LandingPageView } from './landing-page-view';
import { money, toBn } from './landing-context';
import { landingThemeStyle, shade } from './landing-theme';
import { youtubeId } from './landing-bits';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/lp/x', useSearchParams: () => new URLSearchParams() }));

const publicGet = vi.fn();
const publicPost = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicGet: (...a: unknown[]) => publicGet(...a), publicPost: (...a: unknown[]) => publicPost(...a) };
});

const store = { id: 's1', slug: 'alpha', name: 'Alpha Shop', currency: 'BDT', language: 'bn', locale: 'bn-BD', tracking: null } as unknown as PublicStore;

const honey: PublicProductDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sundarban Honey',
  slug: 'honey',
  shortDescription: null,
  productType: 'PHYSICAL',
  currency: 'BDT',
  price: '0',
  compareAtPrice: null,
  sku: null,
  available: true,
  images: [{ url: '/honey.jpg', alt: 'Honey' }],
  categories: [],
  hasVariants: true,
  description: null,
  variants: [
    { id: 'v-500', name: '500 g', sku: null, price: '790.00', compareAtPrice: '950.00', available: true },
    { id: 'v-1kg', name: '1 kg', sku: null, price: '1450.00', compareAtPrice: '1800.00', available: true },
  ],
};

const mug: PublicProductDetail = {
  ...honey,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Clay Mug',
  hasVariants: false,
  price: '450.00',
  compareAtPrice: '600.00',
  variants: [],
};

function landing(template: LandingTemplateKey, over: Partial<PublicLandingPage> = {}): PublicLandingPage {
  return { id: 'page-1', title: 'Offer', slug: 'offer', template, content: defaultLandingContent(template), currency: 'BDT', products: [], preview: true, ...over };
}

const DISTRICTS = [{ id: 'd-dhaka', code: '1', name: 'Dhaka', divisionId: 'div-1' }];
const UPAZILAS = [{ id: 'u-dhan', code: '2', name: 'Dhanmondi', districtId: 'd-dhaka' }];
const quote = (subtotal: number) => ({
  success: true,
  data: {
    currency: 'BDT',
    lines: [{ productId: honey.id, variantId: 'v-500', productName: honey.name, variantName: '500 g', quantity: 1, unitPrice: String(subtotal) }],
    subtotal: String(subtotal),
    couponCode: null,
    couponError: null,
    discountTotal: '0',
    zone: null,
    shippingMethods: [{ id: 'ship-1', name: 'Home delivery', type: 'FLAT', price: '60', amount: '60', description: null, codAllowed: true }],
    shippingMethodId: 'ship-1',
    shippingTotal: '60',
    taxTotal: '0',
    total: String(subtotal + 60),
  },
});

beforeEach(() => {
  // jsdom has no layout: buttons that scroll to the order form just call it.
  Element.prototype.scrollIntoView = vi.fn();
  publicGet.mockReset();
  publicPost.mockReset();
  window.localStorage.clear();
  publicGet.mockImplementation(async (path: string) => {
    if (path.includes('payment-providers')) return { success: true, data: { offline: [{ provider: 'COD', method: 'CASH' }], online: [] } };
    if (path.includes('locations/districts')) return { success: true, data: DISTRICTS };
    if (path.includes('locations/upazilas')) return { success: true, data: UPAZILAS };
    throw new Error(`unexpected GET ${path}`);
  });
});

describe('Landing helpers', () => {
  it('formats taka, Bangla digits, YouTube links and template colours', () => {
    expect(money(1490)).toBe('৳1,490');
    expect(toBn(36)).toBe('৩৬');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('not a video')).toBeNull();
    expect(shade('#ffffff', -0.5)).toEqual([128, 128, 128]);
    const style = landingThemeStyle('single_product', { primary: '#ff0000', accent: null });
    expect(style['--sp-brand']).toBe('255 0 0');
    expect(style['--sp-cta']).toBe('194 65 12');
    expect(style['--font-sans']).toContain('hind-siliguri');
  });
});

describe('Every template renders its demo page', () => {
  it.each(LANDING_TEMPLATE_KEYS)('%s: all sections, the order form and demo products in the editor preview', (template) => {
    const { container } = render(<LandingPageView page={landing(template)} store={store} />);
    const sections = defaultLandingContent(template).sections.map((s) => s.type);
    for (const type of ['hero', 'order', 'footer']) {
      expect(sections).toContain(type);
      expect(container.querySelector(`[data-section="${type}"]`)).not.toBeNull();
    }
    expect(screen.getAllByRole('button', { name: /অর্ডার কনফার্ম করুন/ }).length).toBeGreaterThan(0);
    // The footer names the store when the merchant leaves the brand empty.
    expect(within(container.querySelector('[data-section="footer"]') as HTMLElement).getAllByText(/Alpha Shop|ALPHA SHOP/).length).toBeGreaterThan(0);
  });

  it('hides sections the merchant switched off', () => {
    const page = landing('single_product');
    page.content.sections = page.content.sections.map((s) => (s.type === 'faq' ? { ...s, enabled: false } : s));
    const { container } = render(<LandingPageView page={page} store={store} />);
    expect(container.querySelector('[data-section="faq"]')).toBeNull();
    expect(container.querySelector('[data-section="benefits"]')).not.toBeNull();
  });
});

describe('Ordering from a landing page', () => {
  it('food: packages are the product’s variants; validation, delivery and the order placed with the page', async () => {
    const user = userEvent.setup();
    publicPost.mockImplementation(async (path: string, body: Record<string, unknown>) => {
      if (path.endsWith('/checkout/quote')) {
        const items = body.items as { variantId: string; quantity: number }[];
        return quote(items[0]!.variantId === 'v-1kg' ? 1450 * items[0]!.quantity : 790 * items[0]!.quantity);
      }
      if (path.endsWith('/checkout')) return { success: true, data: { orderNumber: 'EM-100042', publicReference: 'ref-42' } };
      throw new Error(`unexpected POST ${path}`);
    });
    const page = landing('food', { preview: false, products: [honey], content: { ...defaultLandingContent('food'), productIds: [honey.id] } });
    const { container } = render(<LandingPageView page={page} store={store} />);
    const order = container.querySelector('[data-section="order"]') as HTMLElement;

    // Package cards from the variants; choosing one updates the form.
    const packages = container.querySelector('[data-section="packages"]') as HTMLElement;
    expect(within(packages).getByText('500 g')).toBeInTheDocument();
    expect(within(packages).getByText('সেরা মূল্য')).toBeInTheDocument();
    await user.click(within(packages).getAllByRole('button', { name: 'এটি অর্ডার করুন' })[1]!);
    expect(within(order).getByRole('radio', { name: /1 kg/ })).toBeChecked();

    await user.click(within(order).getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }));
    expect(within(order).getByText('আপনার নাম লিখুন')).toBeInTheDocument();
    expect(within(order).getByText('মোবাইল নম্বর লিখুন')).toBeInTheDocument();
    expect(within(order).getByText('জেলা বাছাই করুন', { selector: 'p' })).toBeInTheDocument();

    await user.type(within(order).getByLabelText(/আপনার নাম/), 'Rumana');
    await user.type(within(order).getByLabelText(/মোবাইল নম্বর/), '0171');
    await user.type(within(order).getByLabelText(/পুরো ঠিকানা/), 'House 5, Road 3');
    await user.click(within(order).getByRole('button', { name: 'পরিমাণ বাড়ান' }));
    await waitFor(() => expect(within(order).getByRole('option', { name: 'Dhaka' })).toBeInTheDocument());
    await user.selectOptions(within(order).getByLabelText(/^জেলা/), 'd-dhaka');
    await waitFor(() => expect(within(order).getByRole('option', { name: 'Dhanmondi' })).toBeInTheDocument());
    await user.selectOptions(within(order).getByLabelText(/থানা/), 'u-dhan');
    await user.click(within(order).getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }));
    expect(within(order).getByText(/সঠিক ১১ ডিজিটের নম্বর দিন/)).toBeInTheDocument();
    await user.clear(within(order).getByLabelText(/মোবাইল নম্বর/));
    await user.type(within(order).getByLabelText(/মোবাইল নম্বর/), '+8801711000333');

    await waitFor(() => expect(within(order).getByText('৳2,960')).toBeInTheDocument(), { timeout: 3000 });
    expect(within(order).getByRole('radio', { name: /Home delivery/ })).toBeChecked();
    await user.click(within(order).getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }));

    expect(await screen.findByText(/ধন্যবাদ, Rumana!/)).toBeInTheDocument();
    expect(screen.getByText('EM-100042')).toBeInTheDocument();
    const checkout = publicPost.mock.calls.find(([path]) => String(path).endsWith('/checkout'))!;
    expect(checkout[1]).toMatchObject({
      items: [{ productId: honey.id, variantId: 'v-1kg', quantity: 2 }],
      customer: { name: 'Rumana', phone: '01711000333' },
      shippingAddress: { addressLine1: 'House 5, Road 3', districtId: 'd-dhaka', upazilaId: 'u-dhan', divisionId: 'div-1', country: 'BD' },
      shippingMethodId: 'ship-1',
      paymentProvider: 'COD',
      expectedTotal: '2960',
      landingPageId: 'page-1',
    });
  });

  it('campaign: shoppers add several products to one order; variants must be chosen first', async () => {
    const user = userEvent.setup();
    publicPost.mockResolvedValue(quote(790));
    const page = landing('campaign', { preview: false, products: [honey, mug], content: { ...defaultLandingContent('campaign'), productIds: [honey.id, mug.id] } });
    const { container } = render(<LandingPageView page={page} store={store} />);
    const offers = container.querySelector('[data-section="offer_products"]') as HTMLElement;
    const order = container.querySelector('[data-section="order"]') as HTMLElement;
    expect(within(order).getByText('উপরে থেকে পণ্য যোগ করুন')).toBeInTheDocument();
    // The hero shows the biggest discount among the offers (mug: 25%).
    expect(within(container.querySelector('[data-section="hero"]') as HTMLElement).getByText('২৫')).toBeInTheDocument();

    const [honeyAdd, mugAdd] = within(offers).getAllByRole('button', { name: 'যোগ করুন' });
    await user.click(honeyAdd!);
    expect(within(offers).getByRole('alert')).toHaveTextContent('আগে বাছাই করুন');
    await user.selectOptions(within(offers).getByLabelText(/Sundarban Honey/), 'v-500');
    await user.click(honeyAdd!);
    await user.click(mugAdd!);
    await user.click(mugAdd!);
    const lines = within(order).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(within(lines[1]!).getByText('Clay Mug')).toBeInTheDocument();
    expect(within(lines[1]!).getByText('2')).toBeInTheDocument();
    await user.click(within(lines[0]!).getByRole('button', { name: /বাদ দিন/ }));
    expect(within(order).getAllByRole('listitem')).toHaveLength(1);
  });

  it('demo products in the editor cannot be ordered', async () => {
    const user = userEvent.setup();
    const { container } = render(<LandingPageView page={landing('single_product')} store={store} />);
    const order = container.querySelector('[data-section="order"]') as HTMLElement;
    expect(within(order).getByText('প্রিমিয়াম কটন পাঞ্জাবি')).toBeInTheDocument();
    await user.type(within(order).getByLabelText(/আপনার নাম/), 'Test');
    await user.type(within(order).getByLabelText(/মোবাইল নম্বর/), '01711000333');
    await user.type(within(order).getByLabelText(/পুরো ঠিকানা/), 'House 5, Road 3');
    expect(publicGet).not.toHaveBeenCalled();
    expect(publicPost).not.toHaveBeenCalled();
  });
});
