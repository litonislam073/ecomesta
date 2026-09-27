import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AccordionItem,
  AnimatedNumber,
  FadeUp,
  ScaleIn,
  StaggerContainer,
  StaggerItem,
} from '@/components/animations';

afterEach(() => cleanup());

describe('animation primitives', () => {
  it('server-renders content in its final, visible state', () => {
    const html = renderToStaticMarkup(
      <>
        <FadeUp as="h2">Scroll heading</FadeUp>
        <FadeUp on="load" delay={0.1}>
          Hero copy
        </FadeUp>
        <ScaleIn on="load">Hero visual</ScaleIn>
        <StaggerContainer as="ul">
          <StaggerItem as="li">First</StaggerItem>
        </StaggerContainer>
      </>,
    );

    expect(html).toContain('<h2>Scroll heading</h2>');
    expect(html).toContain('Hero copy');
    expect(html).toContain('Hero visual');
    expect(html).toContain('data-stagger-item');
    expect(html).not.toMatch(/opacity:\s*0/);
  });

  it('shows the real final number when motion is unavailable', () => {
    expect(renderToStaticMarkup(<AnimatedNumber value={552} />)).toContain('552');

    render(<AnimatedNumber value={1995} />);
    expect(screen.getByText('1,995')).toBeInTheDocument();
  });

  it('keeps the native details toggle when motion is unavailable', async () => {
    render(
      <AccordionItem summary="Question">
        <p>Answer</p>
      </AccordionItem>,
    );
    const details = screen.getByText('Question').closest('details');
    expect(details).not.toHaveAttribute('open');

    await userEvent.click(screen.getByText('Question'));
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });
});
