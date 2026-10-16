import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DescriptionEditor, prefixLines, wrapSelection } from './description-editor';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DescriptionEditor value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('description editor helpers', () => {
  it('wraps the selection, or inserts a placeholder', () => {
    expect(wrapSelection('a soft dress', 2, 6, '**', 'bold text')).toEqual({ text: 'a **soft** dress', start: 4, end: 8 });
    expect(wrapSelection('ab', 2, 2, '*', 'italic text').text).toBe('ab*italic text*');
  });

  it('turns selected lines into a list and replaces old prefixes', () => {
    expect(prefixLines('red\nblue', 0, 8, () => '- ', 'item').text).toBe('- red\n- blue');
    expect(prefixLines('- red\n- blue', 0, 12, (i) => `${i + 1}. `, 'item').text).toBe('1. red\n2. blue');
    expect(prefixLines('Intro\nSize', 6, 10, () => '## ', 'Heading').text).toBe('Intro\n\n## Size');
  });
});

describe('DescriptionEditor', () => {
  it('formats selected text with the toolbar and previews it', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Soft cotton dress" />);
    const box = screen.getByLabelText('Description') as HTMLTextAreaElement;
    box.setSelectionRange(0, 4);
    await user.click(screen.getByRole('button', { name: 'Bold (Ctrl+B)' }));
    expect(screen.getByTestId('value').textContent).toBe('**Soft** cotton dress');

    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('Soft').tagName).toBe('STRONG');
    expect(screen.getByRole('button', { name: 'Bold (Ctrl+B)' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Write' }));
    expect(screen.getByLabelText('Description')).toHaveValue('**Soft** cotton dress');
  });

  it('adds a bullet list and shows the character count', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Bullet list' }));
    expect(screen.getByTestId('value').textContent).toBe('- List item');
    expect(screen.getByText('11 / 10,000')).toBeInTheDocument();
  });

  it('supports Ctrl+I', async () => {
    const user = userEvent.setup();
    render(<Harness initial="new" />);
    const box = screen.getByLabelText('Description') as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(0, 3);
    await user.keyboard('{Control>}i{/Control}');
    expect(screen.getByTestId('value').textContent).toBe('*new*');
  });
});
