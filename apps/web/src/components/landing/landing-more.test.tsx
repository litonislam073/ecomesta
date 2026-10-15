import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProductDetail, PublicStore } from '@ecomesta/types';
import { defaultLandingContent, type LandingContent, type LandingTemplateKey } from '@ecomesta/utils';
import type { PublicLandingPage } from '@/lib/landing';
import { LandingPageView } from './landing-page-view';
import { axisOf, cells, findVariant, variantAxes } from './landing-kit';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/lp/x', useSearchParams: () => new URLSearchParams() }));

const publicGet = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicGet: (...a: unknown[]) => publicGet(...a), publicPost: vi.fn(() => new Promise(() => {})) };
});

const store = { id: 's1', slug: 'alpha', name: 'Alpha Shop', currency: 'BDT', language: 'bn', locale: 'bn-BD', tracking: null } as unknown as PublicStore;

const base: PublicProductDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Drop Tee',
  slug: 'tee',
  shortDescription: null,
  productType: 'PHYSICAL',
  currency: 'BDT',
  price: '0',
  compareAtPrice: null,
  sku: null,
  available: true,
  images: [{ url: '/tee.jpg', alt: 'Tee' }],
  categories: [],
  hasVariants: true,
  description: null,
  variants: [],
};

const tee: PublicProductDetail = {
  ...base,
  variants: [
    { id: 'b-m', name: 'Black / M', sku: null, price: '890.00', compareAtPrice: '1290.00', available: true },
    { id: 'b-l', name: 'Black / L', sku: null, price: '890.00', compareAtPrice: '1290.00', available: true },
    { id: 'w-m', name: 'White / M', sku: null, price: '890.00', compareAtPrice: '1290.00', available: true },
    { id: 'w-l', name: 'White / L', sku: null, price: '950.00', compareAtPrice: '1350.00', available: false },
  ],
};

const product = (id: string, name: string, price: string, extra: Partial<PublicProductDetail> = {}): PublicProductDetail => ({
  ...base,
  id,
  name,
  slug: id,
  hasVariants: false,
  price,
  compareAtPrice: null,
  variants: [],
  ...extra,
});

function page(template: LandingTemplateKey, products: PublicProductDetail[], edit?: (content: LandingContent) => void): PublicLandingPage {
  const content = defaultLandingContent(template);
  content.productIds = products.map((p) => p.id);
  edit?.(content);
  return { id: 'page-1', title: 'Offer', slug: 'offer', template, content, currency: 'BDT', products, preview: false };
}

function settings(content: LandingContent, type: string) {
  return content.sections.find((s) => s.type === type)!.settings;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  publicGet.mockReset();
  publicGet.mockImplementation(async (path: string) => {
    if (path.includes('payment-providers')) return { success: true, data: { offline: [{ provider: 'COD', method: 'CASH' }], online: [] } };
    return { success: true, data: [] };
  });
});

describe('second template set helpers', () => {
  it('reads colour / size from variant names', () => {
    const p = { variants: tee.variants.map((v) => ({ id: v.id, name: v.name, price: 1, compareAt: null, available: v.available })) } as never;
    expect(variantAxes(p)).toEqual({ first: ['Black', 'White'], second: ['M', 'L'] });
    expect(axisOf('Black / L', 1)).toBe('L');
    expect(findVariant(p, 'White', 'L')!.id).toBe('w-m');
    expect(findVariant(p, 'Black', 'L')!.id).toBe('b-l');
    expect(variantAxes({ variants: [{ name: '500 g' }, { name: '1 kg' }] } as never)).toBeNull();
    expect(cells('৪ লিটার | ৬ লিটার | ')).toEqual(['৪ লিটার', '৬ লিটার']);
  });
});

describe('trend', () => {
  it('splits "Colour / Size" variants into colour and size pickers and keeps the line in sync', async () => {
    render(<LandingPageView page={page('trend', [tee])} store={store} />);
    const hero = document.querySelector('[data-section="hero"]') as HTMLElement;
    const sizes = within(hero).getByRole('group', { name: 'সাইজ বাছুন' });
    expect(within(sizes).getAllByRole('button').map((b) => b.textContent)).toEqual(['M', 'L']);
    await userEvent.click(within(sizes).getByRole('button', { name: 'L' }));
    expect(within(hero).getByText('L', { selector: 'b' })).toBeInTheDocument();
    // White L is sold out: picking White keeps an available size.
    await userEvent.click(within(hero).getByRole('button', { name: 'White' }));
    expect(within(sizes).getByRole('button', { name: 'L' })).toBeDisabled();
    const order = document.querySelector('[data-section="order"]') as HTMLElement;
    expect(within(order).getByText('White / M')).toBeInTheDocument();
  });

  it('shows the stock left from the drop section', () => {
    render(<LandingPageView page={page('trend', [tee], (c) => Object.assign(settings(c, 'drop'), { stockLeft: 12, stockTotal: 50 }))} store={store} />);
    expect(screen.getByText('মাত্র ১২টা বাকি', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24');
  });
});

describe('kids', () => {
  const toys = [product('a0000000-0000-4000-8000-000000000001', 'Rattle', '300'), product('a0000000-0000-4000-8000-000000000002', 'Bag', '900'), product('a0000000-0000-4000-8000-000000000003', 'Science box', '1500')];
  const wrap = product('a0000000-0000-4000-8000-0000000000ff', 'Gift wrap', '50');

  it('filters products by age and adds them to the order', async () => {
    render(
      <LandingPageView
        page={page('kids', [...toys, wrap], (c) => {
          c.productIds = toys.map((t) => t.id);
          settings(c, 'products').ages = [{ ages: '০-১' }, { ages: '৩-৬, ৬+' }, { ages: '৬+' }];
          settings(c, 'gift').productIds = [wrap.id];
        })}
        store={store}
      />,
    );
    const products = document.querySelector('[data-section="products"]') as HTMLElement;
    expect(within(products).getAllByRole('article')).toHaveLength(3);
    await userEvent.click(within(products).getByRole('button', { name: '৬+ বছর' }));
    expect(within(products).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)).toEqual(['Bag', 'Science box']);
    await userEvent.click(within(products).getAllByRole('button', { name: 'যোগ করুন' })[0]!);
    // The gift-wrap button adds the wrap product too.
    await userEvent.click(screen.getByRole('button', { name: 'গিফট র‍্যাপসহ অর্ডার করুন' }));
    const order = document.querySelector('[data-section="order"]') as HTMLElement;
    expect(within(order).getByText('Bag')).toBeInTheDocument();
    expect(within(order).getByText('Gift wrap')).toBeInTheDocument();
  });
});

describe('beauty', () => {
  it('turns the product variants into package cards; picking one selects it in the order form', async () => {
    const serum = { ...base, name: 'Serum', variants: [
      { id: 'one', name: 'সিঙ্গেল', sku: null, price: '990.00', compareAtPrice: '1490.00', available: true },
      { id: 'two', name: 'ডুও', sku: null, price: '1790.00', compareAtPrice: '2980.00', available: true },
    ] };
    render(<LandingPageView page={page('beauty', [serum])} store={store} />);
    const packages = document.querySelector('[data-section="packages"]') as HTMLElement;
    expect(within(packages).getByText('সবচেয়ে জনপ্রিয়')).toBeInTheDocument();
    await userEvent.click(within(packages).getAllByRole('button', { name: 'এটি বেছে নিন' })[1]!);
    expect(screen.getByRole('radio', { name: /ডুও/ })).toBeChecked();
  });
});

describe('home and gadget', () => {
  const fryer = { ...base, name: 'Air fryer', variants: [
    { id: 'l4', name: '৪ লিটার', sku: null, price: '4990.00', compareAtPrice: null, available: true },
    { id: 'l6', name: '৬ লিটার', sku: null, price: '6490.00', compareAtPrice: null, available: true },
  ] };

  it('home: the size guide button picks that size', async () => {
    render(<LandingPageView page={page('home', [fryer])} store={store} />);
    const guide = document.querySelector('[data-section="size_guide"]') as HTMLElement;
    await userEvent.click(within(guide).getByRole('button', { name: '৬ লিটার নিন' }));
    const hero = document.querySelector('[data-section="hero"]') as HTMLElement;
    expect(within(hero).getByRole('button', { name: /৬ লিটার/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('gadget: colour swatches switch the variant and its photo', async () => {
    const buds = { ...base, name: 'Buds', variants: [
      { id: 'blk', name: 'Midnight Black', sku: null, price: '1890.00', compareAtPrice: null, available: true },
      { id: 'wht', name: 'Arctic White', sku: null, price: '1890.00', compareAtPrice: null, available: true },
    ] };
    render(<LandingPageView page={page('gadget', [buds])} store={store} />);
    const hero = document.querySelector('[data-section="hero"]') as HTMLElement;
    await userEvent.click(within(hero).getByRole('button', { name: 'Arctic White' }));
    expect(within(hero).getByText('Arctic White', { selector: 'b' })).toBeInTheDocument();
    expect(within(hero).getByRole('img', { name: 'Buds' })).toHaveAttribute('src', '/landing-demo/gadget/hero-white.jpg');
  });
});
