import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { StoreThemeConfig } from '@ecomesta/types';
import { HeroSection } from '@/components/theme/hero-section';

type Hero = NonNullable<StoreThemeConfig['hero']>;

function Harness({ initial, themeSlug, onChange }: { initial: Hero; themeSlug: string; onChange: (hero: Hero) => void }) {
  const [hero, setHero] = useState<Hero>(initial);
  return (
    <HeroSection
      storeId="store-1"
      themeSlug={themeSlug}
      value={hero}
      onChange={(next) => {
        setHero(next);
        onChange(next);
      }}
    />
  );
}

const demo: Hero = {
  headline: 'Shop smart.',
  cards: [
    { label: 'Electronics', title: 'Gadgets for everyday', imageUrl: '/demo-catalog/wireless-headphones.jpg', href: '/products' },
    { label: 'Fashion', title: 'New season picks', imageUrl: '/demo-catalog/casual-sneakers.jpg', href: '/products' },
  ],
};

describe('Hero → side cards (Kenakata)', () => {
  it('edits each card’s text, link and picture; the demo picture can be replaced', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={demo} themeSlug="kenakata" onChange={onChange} />);

    const second = screen.getByRole('group', { name: 'Side card 2' });
    await user.clear(within(second).getByLabelText(/^Title/));
    await user.type(within(second).getByLabelText(/^Title/), 'Eid collection');
    const picture = within(second).getByLabelText(/^Card 2 picture URL/);
    expect(picture).toHaveValue('/demo-catalog/casual-sneakers.jpg');
    expect(within(second).getByRole('button', { name: 'Choose from gallery' })).toBeEnabled();
    await user.clear(picture);
    await user.type(picture, 'https://cdn.example.com/eid.jpg');

    const last = onChange.mock.calls.at(-1)![0] as Hero;
    expect(last.cards?.[1]).toMatchObject({ title: 'Eid collection', imageUrl: 'https://cdn.example.com/eid.jpg', label: 'Fashion' });
    expect(last.cards?.[0]).toEqual(demo.cards![0]);
  });

  it('removes and adds cards, never more than two', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={demo} themeSlug="kenakata" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: '+ Add a card' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove card 1' }));
    expect((onChange.mock.calls.at(-1)![0] as Hero).cards).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '+ Add a card' }));
    expect((onChange.mock.calls.at(-1)![0] as Hero).cards).toHaveLength(2);
  });

  it('is only offered for Kenakata', () => {
    render(<Harness initial={demo} themeSlug="shopease" onChange={vi.fn()} />);
    expect(screen.queryByText('Side cards')).toBeNull();
  });
});

describe('Hero → text colours', () => {
  const colorBox = (label: string) => screen.getAllByRole('textbox').find((el) => el.closest('label')?.textContent?.startsWith(label));

  it('has a separate colour for the small line, heading and text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={demo} themeSlug="kenakata" onChange={onChange} />);
    await user.type(colorBox('Heading color')!, '#111111');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ headingColor: '#111111' }));
    expect((onChange.mock.calls.at(-1)![0] as Hero).textColor).toBeUndefined();
    await user.type(colorBox('Small line color')!, '#222222');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ eyebrowColor: '#222222', headingColor: '#111111' }));
  });

  it('hides the small line colour on themes without a small line', () => {
    render(<Harness initial={demo} themeSlug="default" onChange={vi.fn()} />);
    expect(colorBox('Small line color')).toBeUndefined();
    expect(colorBox('Heading color')).toBeDefined();
  });

  it('sets the banner text colour and can go back to the theme colour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={demo} themeSlug="kenakata" onChange={onChange} />);
    const field = colorBox('Text color')!;
    await user.type(field, '#ffee00');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ textColor: '#ffee00' }));
    await user.click(screen.getByRole('button', { name: 'Use theme colour' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ textColor: '' }));
    expect(screen.queryByRole('button', { name: 'Use theme colour' })).toBeNull();
  });
});
