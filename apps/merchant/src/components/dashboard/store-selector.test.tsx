import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreSelector } from '@/components/dashboard/store-selector';

const setSelectedStoreId = vi.fn();

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    stores: [
      {
        id: 'store-1',
        tenantId: 't1',
        name: 'Alpha Store',
        slug: 'alpha',
        status: 'ACTIVE',
        currency: 'USD',
        timezone: 'UTC',
        locale: 'en-US',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'store-2',
        tenantId: 't1',
        name: 'Beta Store',
        slug: 'beta',
        status: 'DRAFT',
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        locale: 'en-BD',
        createdAt: '',
        updatedAt: '',
      },
    ],
    selectedStoreId: 'store-1',
    setSelectedStoreId,
    loading: false,
    error: null,
  }),
}));

describe('StoreSelector', () => {
  it('lists accessible stores and changes selection', async () => {
    const user = userEvent.setup();
    render(<StoreSelector />);
    expect(screen.getByLabelText(/selected store/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/selected store/i), 'store-2');
    expect(setSelectedStoreId).toHaveBeenCalledWith('store-2');
  });
});
