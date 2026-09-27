import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StoreUnavailablePage, { metadata } from '@/app/store-unavailable/page';
import { isStoreUnavailableError } from '@/components/storefront/store-unavailable';
import { PublicApiError } from '@/lib/public-api';

afterEach(() => cleanup());

describe('Store unavailable page', () => {
  it('tells shoppers the store is unavailable without naming a reason', () => {
    const { container } = render(<StoreUnavailablePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Store temporarily unavailable');
    expect(screen.getByText('This store is currently unavailable.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/suspend|payment|subscription|billing|trial/i);
  });

  it('is not indexed', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('recognises only the STORE_UNAVAILABLE API error', () => {
    expect(isStoreUnavailableError(new PublicApiError(403, 'STORE_UNAVAILABLE', 'x'))).toBe(true);
    expect(isStoreUnavailableError(new PublicApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(isStoreUnavailableError(new Error('x'))).toBe(false);
  });
});
