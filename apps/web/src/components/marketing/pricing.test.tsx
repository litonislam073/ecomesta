import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicPlan } from '@ecomesta/types';
import { billingCyclePrice, type BillingCycleCode } from '@ecomesta/utils';
import PricingPage, { metadata } from '@/app/(marketing)/pricing/page';
import { PricingPlans } from '@/components/marketing/pricing-plans';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MERCHANT = 'https://merchant.ecomesta.example';

function plan(slug: string, name: string, monthly: number, highlighted = false): PublicPlan {
  const cycles: [BillingCycleCode, number, number][] = [
    ['MONTHLY', 1, 0],
    ['SEMI_ANNUAL', 6, 10],
    ['YEARLY', 12, 25],
  ];
  return {
    slug,
    name,
    description: null,
    tagline: `For ${name.toLowerCase()} businesses`,
    features: ['Your store on its own web address'],
    highlighted,
    currency: 'BDT',
    monthlyPrice: monthly,
    trialMonths: 2,
    prices: cycles.map(([billingCycle, months, discountPercent]) => {
      const amount = billingCyclePrice(monthly, billingCycle);
      return { billingCycle, amount, months, discountPercent, effectiveMonthly: amount / months };
    }),
  };
}

const PLANS = [
  plan('starter', 'Starter', 499),
  plan('growth', 'Growth', 999, true),
  plan('business', 'Business', 1999),
];

const card = (name: string) => screen.getByRole('listitem', { name });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Pricing plans', () => {
  it('shows monthly prices first with a 2 months free badge on every plan', () => {
    render(<PricingPlans plans={PLANS} merchantOrigin={MERCHANT} />);
    expect(screen.getByRole('radio', { name: /Monthly/ })).toBeChecked();
    expect(within(card('Starter')).getByText('৳499')).toBeInTheDocument();
    expect(within(card('Growth')).getByText('৳999')).toBeInTheDocument();
    expect(within(card('Business')).getByText('৳1,999')).toBeInTheDocument();
    expect(screen.getAllByText('2 Months Free')).toHaveLength(3);
    expect(within(card('Growth')).getByText('Most Popular')).toBeInTheDocument();
    expect(within(card('Starter')).queryByText('Most Popular')).not.toBeInTheDocument();
  });

  it.each([
    ['6 Months', 'SEMI_ANNUAL', ['৳2,695', '৳5,395', '৳10,795'], '6-months'],
    ['Yearly', 'YEARLY', ['৳4,491', '৳8,991', '৳17,991'], 'yearly'],
  ])('switches to %s prices and CTA links', async (label, _code, prices, slug) => {
    const user = userEvent.setup();
    render(<PricingPlans plans={PLANS} merchantOrigin={MERCHANT} />);
    await user.click(screen.getByRole('radio', { name: new RegExp(label) }));
    expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeChecked();
    ['Starter', 'Growth', 'Business'].forEach((name, i) => {
      expect(within(card(name)).getByText(prices[i]!)).toBeInTheDocument();
    });
    expect(within(card('Growth')).getByRole('link', { name: 'Start 2 Months Free' })).toHaveAttribute(
      'href',
      `${MERCHANT}/register?plan=growth&interval=${slug}`,
    );
  });

  it('never offers an immediate purchase', () => {
    const { container } = render(<PricingPlans plans={PLANS} merchantOrigin={MERCHANT} />);
    expect(container.textContent).not.toMatch(/Pay Now|Buy Now|Subscribe Now/i);
    expect(screen.getAllByRole('link', { name: 'Start 2 Months Free' })).toHaveLength(3);
    expect(screen.getAllByText(/No payment details needed today/)).toHaveLength(3);
  });

  it('keeps the billing toggle keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<PricingPlans plans={PLANS} merchantOrigin={MERCHANT} />);
    screen.getByRole('radio', { name: /Monthly/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /6 Months/ })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Billing period' })).toBeInTheDocument();
  });
});

describe('Pricing page', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ecomesta.example');
  });

  it('renders plans from the API with a single h1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: PLANS }), { status: 200 })),
    );
    render(await PricingPage());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Simple pricing for your growing business');
    expect(screen.getByText('Start your online store free for 2 months. Choose the plan that fits your business.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: /Starter|Growth|Business/ })).toHaveLength(3);
  });

  it('has the pricing SEO title, description and canonical URL', () => {
    expect(metadata.title).toEqual({ absolute: 'Ecomesta Pricing | Online Store Plans in Bangladesh' });
    expect(metadata.description).toBe(
      'Choose an Ecomesta plan for your online business. Start free for 2 months with flexible monthly, 6-month and yearly options.',
    );
    expect(String(metadata.alternates?.canonical)).toMatch(/\/pricing$/);
    expect(metadata.openGraph?.title).toBe('Ecomesta Pricing | Online Store Plans in Bangladesh');
  });
});
