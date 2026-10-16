import { Fragment, type ReactNode } from 'react';

/**
 * Product descriptions use a small, safe formatting language that the
 * merchant's toolbar writes for them:
 *
 *   ## Heading          **bold**        *italic*
 *   - bullet item       1. numbered item
 *   [link text](https://example.com)
 *
 * Plain text written before formatting existed renders as before: paragraphs
 * separated by blank lines, single line breaks kept. Nothing is ever turned
 * into raw HTML, so a description cannot inject markup or scripts.
 */
export type RichTextInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: RichTextInline[] }
  | { type: 'italic'; children: RichTextInline[] }
  | { type: 'link'; href: string; children: RichTextInline[] }
  | { type: 'break' };

export type RichTextBlock =
  | { type: 'heading'; children: RichTextInline[] }
  | { type: 'paragraph'; children: RichTextInline[] }
  | { type: 'bullets'; items: RichTextInline[][] }
  | { type: 'numbers'; items: RichTextInline[][] };

const HEADING = /^#{1,3}\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return null;
}

export function parseInline(text: string): RichTextInline[] {
  const out: RichTextInline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (rest[0] === '\n') {
      flush();
      out.push({ type: 'break' });
      i += 1;
      continue;
    }
    const bold = /^\*\*(?=\S)([\s\S]*?\S)\*\*/.exec(rest);
    if (bold) {
      flush();
      out.push({ type: 'bold', children: parseInline(bold[1]!) });
      i += bold[0].length;
      continue;
    }
    const italic = /^[*_](?=\S)([^*_\n]*?\S)[*_]/.exec(rest);
    if (italic && (i === 0 || !/\w/.test(text[i - 1]!))) {
      flush();
      out.push({ type: 'italic', children: parseInline(italic[1]!) });
      i += italic[0].length;
      continue;
    }
    const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      const href = safeHref(link[2]!);
      flush();
      if (href) out.push({ type: 'link', href, children: parseInline(link[1]!) });
      else out.push({ type: 'text', text: link[1]! });
      i += link[0].length;
      continue;
    }
    buffer += rest[0];
    i += 1;
  }
  flush();
  return out;
}

export function parseRichText(source: string | null | undefined): RichTextBlock[] {
  const lines = (source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: RichTextBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: 'bullets' | 'numbers'; items: string[] } | null = null;

  const endParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  const endList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      endParagraph();
      endList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      endList();
      blocks.push({ type: 'heading', children: parseInline(heading[1]!.trim()) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    if (bullet || number) {
      endParagraph();
      const type = bullet ? 'bullets' : 'numbers';
      if (list && list.type !== type) endList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet ?? number)![1]!);
      continue;
    }
    endList();
    paragraph.push(line);
  }
  endParagraph();
  endList();
  return blocks;
}

function inlineToPlain(nodes: RichTextInline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text;
      if (node.type === 'break') return ' ';
      return inlineToPlain(node.children);
    })
    .join('');
}

/** The description without formatting marks, for SEO text and previews. */
export function richTextToPlain(source: string | null | undefined): string {
  return parseRichText(source)
    .map((block) =>
      block.type === 'bullets' || block.type === 'numbers'
        ? block.items.map(inlineToPlain).join(', ')
        : inlineToPlain(block.children),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInline(nodes: RichTextInline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.text}</Fragment>;
      case 'break':
        return <br key={index} />;
      case 'bold':
        return <strong key={index} className="font-semibold">{renderInline(node.children)}</strong>;
      case 'italic':
        return <em key={index}>{renderInline(node.children)}</em>;
      case 'link': {
        const external = /^https?:/i.test(node.href);
        return (
          <a
            key={index}
            href={node.href}
            className="underline underline-offset-2"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
          >
            {renderInline(node.children)}
          </a>
        );
      }
    }
  });
}

export interface RichTextContentProps {
  text: string | null | undefined;
  className?: string;
  /** Classes for headings, e.g. a theme's heading font or colour. */
  headingClassName?: string;
}

/** Renders a formatted description. Pure, so it works in server components. */
export function RichTextContent({ text, className, headingClassName }: RichTextContentProps) {
  const blocks = parseRichText(text);
  if (!blocks.length) return null;
  return (
    <div className={['space-y-3 leading-relaxed', className].filter(Boolean).join(' ')}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={index} className={['pt-1 text-base font-semibold', headingClassName].filter(Boolean).join(' ')}>
                {renderInline(block.children)}
              </h3>
            );
          case 'paragraph':
            return <p key={index}>{renderInline(block.children)}</p>;
          case 'bullets':
            return (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
              </ul>
            );
          case 'numbers':
            return (
              <ol key={index} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
              </ol>
            );
        }
      })}
    </div>
  );
}
