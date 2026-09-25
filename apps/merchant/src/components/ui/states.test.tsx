import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';

describe('UI states', () => {
  it('renders empty state', () => {
    render(
      <EmptyState title="No customers yet" description="Add your first customer." />,
    );
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ErrorState message="Unauthorized" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
  });

  it('renders loading state', () => {
    render(<LoadingState label="Loading customers" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
