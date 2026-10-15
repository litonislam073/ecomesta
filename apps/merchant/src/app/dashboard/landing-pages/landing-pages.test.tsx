import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { LANDING_TEMPLATES, defaultLandingContent, type LandingPageSummary, type LandingValue } from '@ecomesta/utils';
import LandingPagesPage from '@/app/dashboard/landing-pages/page';
import { LandingFieldsForm } from '@/components/landing/landing-fields';
import { landingPageUrl } from '@/components/landing/landing-utils';

const pushToast = vi.fn();
const push = vi.fn();
let canManage = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({ selectedStoreId: 'store-1', selectedStore: { id: 'store-1', name: 'Alpha', slug: 'alpha' } }),
}));
vi.mock('@/lib/permissions', () => ({ useCanManageStore: () => canManage }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => api.get(...a),
      post: (...a: unknown[]) => api.post(...a),
      patch: (...a: unknown[]) => api.patch(...a),
      delete: (...a: unknown[]) => api.delete(...a),
    },
  };
});

const page = (over: Partial<LandingPageSummary> = {}): LandingPageSummary => ({
  id: 'page-1',
  storeId: 'store-1',
  title: 'Eid offer',
  slug: 'eid-offer',
  template: 'campaign',
  status: 'PUBLISHED',
  hasUnpublishedChanges: false,
  publishedAt: '2026-10-14T00:00:00.000Z',
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
  orderCount: 3,
  ...over,
});

const listResponse = (items: LandingPageSummary[], usage: { allowed: boolean; max: number | null; used: number }) => ({ success: true, data: { items, usage } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  pushToast.mockReset();
  push.mockReset();
  canManage = true;
});

describe('Landing pages list', () => {
  it('Starter: locked with an upgrade link and no create button', async () => {
    api.get.mockResolvedValue(listResponse([], { allowed: false, max: 0, used: 0 }));
    render(<LandingPagesPage />);
    expect(await screen.findByRole('heading', { name: /available on the Growth and Business plans/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upgrade in Plan & billing/ })).toHaveAttribute('href', '/dashboard/billing');
    expect(screen.queryByRole('button', { name: /New landing page/ })).toBeNull();
  });

  it('lists pages with status, orders, edit and live links, and the plan usage', async () => {
    api.get.mockResolvedValue(listResponse([page(), page({ id: 'page-2', title: 'Honey', slug: 'honey', template: 'food', status: 'DRAFT', orderCount: 0 })], { allowed: true, max: 5, used: 2 }));
    render(<LandingPagesPage />);
    expect(await screen.findByText('2 of 5 pages used')).toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]!).getByText('Live')).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/Festival sale · 3 orders/)).toBeInTheDocument();
    expect(within(cards[0]!).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/dashboard/landing-pages/page-1');
    expect(within(cards[0]!).getByRole('link', { name: /View/ })).toHaveAttribute('href', landingPageUrl('alpha', 'eid-offer'));
    expect(within(cards[1]!).getByText('Draft')).toBeInTheDocument();
    expect(within(cards[1]!).queryByRole('link', { name: /View/ })).toBeNull();
  });

  it('at the plan limit: no new pages, with a way out', async () => {
    api.get.mockResolvedValue(listResponse([page()], { allowed: true, max: 1, used: 1 }));
    render(<LandingPagesPage />);
    expect(await screen.findByText(/You have used all 1 landing pages/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New landing page/ })).toBeDisabled();
  });

  it('creates a page from the chosen design and opens the editor', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(listResponse([], { allowed: true, max: null, used: 0 }));
    api.post.mockResolvedValue({ success: true, data: { ...page({ id: 'new-1', template: 'story' }), content: defaultLandingContent('story') } });
    render(<LandingPagesPage />);
    await user.click(await screen.findByRole('button', { name: /New landing page/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('radio')).toHaveLength(10);
    await user.click(within(dialog).getByRole('radio', { name: /Story sales page/ }));
    await user.click(within(dialog).getByRole('button', { name: /Create with Story sales page/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Give the page a name');
    await user.type(within(dialog).getByLabelText(/^Page name/), 'Hair oil');
    await user.click(within(dialog).getByRole('button', { name: /Create with Story sales page/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/landing-pages/new-1'));
    expect(api.post).toHaveBeenCalledWith('/stores/store-1/landing-pages', { title: 'Hair oil', template: 'story' });
  });

  it('shows the 10 designs to preview and start a page from', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(listResponse([], { allowed: true, max: null, used: 0 }));
    render(<LandingPagesPage />);
    const gallery = await screen.findByRole('list', { name: 'Designs' });
    expect(within(gallery).getAllByRole('listitem')).toHaveLength(10);
    await user.click(within(gallery).getAllByRole('button', { name: 'Preview' })[3]!);
    const preview = screen.getByRole('dialog', { name: 'Food & health' });
    expect(within(preview).getByTitle('Food & health preview')).toHaveAttribute('src', expect.stringContaining('/lp-demo/food'));
    await user.click(within(preview).getByRole('button', { name: /mobile/i }));
    expect(within(preview).getByRole('button', { name: /mobile/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(preview).getByRole('button', { name: 'Use this design' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Food & health/ })).toBeChecked();
  });

  it('Starter can preview designs but not use them', async () => {
    api.get.mockResolvedValue(listResponse([], { allowed: false, max: 0, used: 0 }));
    render(<LandingPagesPage />);
    const gallery = await screen.findByRole('list', { name: 'Designs' });
    expect(screen.getByText('Upgrade to Growth or Business to use these designs.')).toBeInTheDocument();
    for (const button of within(gallery).getAllByRole('button', { name: 'Use this design' })) expect(button).toBeDisabled();
    expect(within(gallery).getAllByRole('button', { name: 'Preview' })[0]).toBeEnabled();
  });

  it('deletes a page after confirming', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(listResponse([page()], { allowed: true, max: 5, used: 1 })).mockResolvedValue(listResponse([], { allowed: true, max: 5, used: 0 }));
    api.delete.mockResolvedValue({ success: true });
    render(<LandingPagesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete page' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/stores/store-1/landing-pages/page-1'));
    expect(pushToast).toHaveBeenCalledWith('"Eid offer" deleted.', 'success');
  });

  it('read-only staff can open pages but not create or delete', async () => {
    canManage = false;
    api.get.mockResolvedValue(listResponse([page()], { allowed: true, max: 5, used: 1 }));
    render(<LandingPagesPage />);
    expect(await screen.findByRole('link', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New landing page/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

function FormHarness({ onChange }: { onChange: (v: Record<string, LandingValue>) => void }) {
  const section = LANDING_TEMPLATES.campaign.sections.find((s) => s.type === 'benefits')!;
  const [value, setValue] = useState<Record<string, LandingValue>>(section.defaults);
  return (
    <LandingFieldsForm
      fields={section.fields}
      value={value}
      storeId="store-1"
      products={{ products: [], failed: false }}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('Section settings form', () => {
  it('edits text, and adds, edits, reorders and removes list items', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormHarness onChange={onChange} />);
    const heading = screen.getByLabelText('Heading');
    await user.clear(heading);
    await user.type(heading, 'Why us');
    expect((onChange.mock.calls.at(-1)![0] as Record<string, LandingValue>).title).toBe('Why us');

    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    const group = screen.getByRole('group', { name: 'Item 5' });
    await user.type(within(group).getByLabelText('Title'), 'Gift wrap');
    await user.selectOptions(within(group).getByLabelText('Icon'), 'gift');
    let items = (onChange.mock.calls.at(-1)![0] as Record<string, LandingValue>).items as Record<string, unknown>[];
    expect(items).toHaveLength(5);
    expect(items[4]).toMatchObject({ title: 'Gift wrap', icon: 'gift' });

    await user.click(screen.getByRole('button', { name: 'Move item 5 up' }));
    items = (onChange.mock.calls.at(-1)![0] as Record<string, LandingValue>).items as Record<string, unknown>[];
    expect(items[3]).toMatchObject({ title: 'Gift wrap' });

    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));
    items = (onChange.mock.calls.at(-1)![0] as Record<string, LandingValue>).items as Record<string, unknown>[];
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ title: 'দ্রুত ডেলিভারি' });
  });
});
