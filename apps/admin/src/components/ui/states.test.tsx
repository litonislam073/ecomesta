import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';

describe('Admin UI states', () => {
  it('renders empty state', () => {
    render(<EmptyState title="No tenants found" description="Widen the filters." />);
    expect(screen.getByText('No tenants found')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ErrorState message="Unauthorized" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
  });

  it('renders loading state', () => {
    render(<LoadingState label="Loading tenants" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides pagination for a single page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('pages forward and back', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={4} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('renders nothing when the confirm dialog is closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Suspend?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('wires confirm and cancel handlers', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        danger
        title="Suspend this tenant?"
        description="Stores stop serving requests."
        confirmLabel="Update status"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Suspend this tenant?');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    expect(onConfirm).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
