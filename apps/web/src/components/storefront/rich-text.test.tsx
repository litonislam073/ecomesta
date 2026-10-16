import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextContent, parseRichText, richTextToPlain } from '@ecomesta/ui';

describe('product description formatting', () => {
  it('keeps old plain-text descriptions as paragraphs with line breaks', () => {
    const blocks = parseRichText('First line\nsecond line\n\nNew paragraph');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph']);
    const { container } = render(<RichTextContent text={'First line\nsecond line\n\nNew paragraph'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelector('br')).not.toBeNull();
  });

  it('renders headings, bold, italic and lists', () => {
    render(<RichTextContent text={'## Features\n- **Soft** cotton\n- *Hand* embroidery\n\n1. Wash cold\n2. Dry in shade'} />);
    expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument();
    expect(screen.getByText('Soft').tagName).toBe('STRONG');
    expect(screen.getByText('Hand').tagName).toBe('EM');
    const lists = screen.getAllByRole('list');
    expect(lists.map((l) => l.tagName)).toEqual(['UL', 'OL']);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('never outputs raw HTML and drops unsafe links', () => {
    const { container } = render(<RichTextContent text={'<script>alert(1)</script> [click](javascript:alert(1)) [shop](https://example.com)'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('https://example.com');
    expect(links[0]!.getAttribute('rel')).toContain('noopener');
  });

  it('strips formatting for SEO text', () => {
    expect(richTextToPlain('## Size\n**Free** size, *soft*\n- one\n- two')).toBe('Size Free size, soft one, two');
    expect(richTextToPlain(null)).toBe('');
  });

  it('leaves a lone asterisk or math alone', () => {
    expect(richTextToPlain('2 * 3 = 6 and 5*4')).toBe('2 * 3 = 6 and 5*4');
  });
});
