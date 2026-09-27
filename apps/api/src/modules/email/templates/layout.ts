export interface EmailBrand {
  logoUrl: string;
  appUrl: string;
  merchantUrl: string;
  supportEmail: string | null;
}

export interface DetailRow {
  label: string;
  value: string;
  href?: string;
}

export interface EmailContent {
  subject: string;
  preheader: string;
  heading: string;
  intro: string[];
  details?: DetailRow[];
  cta?: { label: string; url: string };
  /** Plain-text paragraphs after the button. */
  outro?: string[];
  secondaryLink?: { lead: string; label: string; url: string };
  notice?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  bg: '#f3f5f4',
  surface: '#ffffff',
  ink: '#14201c',
  muted: '#5f6f68',
  accent: '#0f6b5c',
  border: '#d7e0dc',
  noticeBg: '#f1f8f5',
};

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Subjects are headers: no line breaks or control characters, bounded length. */
export function safeSubject(value: string): string {
  return Array.from(value, (ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function safeHref(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'mailto:') {
    throw new Error('Email links must use http(s) or mailto');
  }
  return escapeHtml(parsed.toString());
}

function paragraph(text: string, extra = ''): string {
  const lines = text.split(/\r?\n/).map(escapeHtml).join('<br>');
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${COLORS.ink};${extra}">${lines}</p>`;
}

function button(cta: { label: string; url: string }): string {
  const href = safeHref(cta.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" bgcolor="${COLORS.accent}" style="border-radius:8px;">
      <a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
    </td>
  </tr>
</table>`;
}

function detailsTable(rows: DetailRow[]): string {
  const body = rows
    .map((row) => {
      const value = row.href
        ? `<a href="${safeHref(row.href)}" target="_blank" rel="noopener" style="color:${COLORS.accent};text-decoration:underline;word-break:break-all;">${escapeHtml(row.value)}</a>`
        : escapeHtml(row.value);
      return `<tr>
      <td class="detail-label" style="padding:10px 12px 10px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${COLORS.muted};vertical-align:top;white-space:nowrap;">${escapeHtml(row.label)}</td>
      <td style="padding:10px 0;font-family:${FONT};font-size:15px;line-height:20px;color:${COLORS.ink};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${COLORS.border};border-bottom:1px solid ${COLORS.border};">${body}</table>`;
}

export function renderEmail(content: EmailContent, brand: EmailBrand): RenderedEmail {
  const subject = safeSubject(content.subject);
  const year = new Date().getUTCFullYear();
  const support = brand.supportEmail;

  const parts: string[] = [];
  parts.push(
    `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:${COLORS.ink};">${escapeHtml(content.heading)}</h1>`,
  );
  for (const text of content.intro) parts.push(paragraph(text));
  if (content.details?.length) parts.push(detailsTable(content.details));
  if (content.cta) parts.push(button(content.cta));
  for (const text of content.outro ?? []) parts.push(paragraph(text));
  if (content.secondaryLink) {
    parts.push(
      `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:22px;color:${COLORS.ink};">${escapeHtml(content.secondaryLink.lead)} <a href="${safeHref(content.secondaryLink.url)}" target="_blank" rel="noopener" style="color:${COLORS.accent};font-weight:600;text-decoration:underline;">${escapeHtml(content.secondaryLink.label)}</a></p>`,
    );
  }
  if (content.notice) {
    parts.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr><td style="padding:14px 16px;background:${COLORS.noticeBg};border-radius:8px;font-family:${FONT};font-size:14px;line-height:21px;color:${COLORS.muted};">${escapeHtml(content.notice)}</td></tr></table>`,
    );
  }

  const supportLine = support
    ? `Need help? Contact us at <a href="mailto:${escapeHtml(support)}" style="color:${COLORS.accent};text-decoration:underline;">${escapeHtml(support)}</a>.`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .card { padding: 24px 20px !important; border-radius: 0 !important; }
    .outer { padding: 0 !important; }
    .detail-label { white-space: normal !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
  <tr>
    <td class="outer" align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
        <tr>
          <td style="padding:0 4px 20px;">
            <a href="${safeHref(brand.appUrl)}" target="_blank" rel="noopener"><img src="${safeHref(brand.logoUrl)}" width="168" height="32" alt="Ecomesta" style="display:block;border:0;outline:none;height:32px;width:168px;"></a>
          </td>
        </tr>
        <tr>
          <td class="card" style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;padding:32px;">
            ${parts.join('\n            ')}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.muted};">
            ${supportLine ? `<p style="margin:0 0 8px;">${supportLine}</p>` : ''}
            <p style="margin:0 0 8px;"><a href="${safeHref(brand.appUrl)}" style="color:${COLORS.muted};text-decoration:underline;">Ecomesta website</a> &nbsp;·&nbsp; <a href="${safeHref(`${brand.merchantUrl}/dashboard`)}" style="color:${COLORS.muted};text-decoration:underline;">Merchant dashboard</a></p>
            <p style="margin:0;">&copy; ${year} Ecomesta. You are receiving this email because of activity on your Ecomesta account.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = renderText(content, brand, year);
  return { subject, html, text };
}

function renderText(content: EmailContent, brand: EmailBrand, year: number): string {
  const lines: string[] = [content.heading, ''];
  for (const text of content.intro) lines.push(text, '');
  for (const row of content.details ?? []) {
    lines.push(`${row.label}: ${row.href && row.href !== row.value ? `${row.value} (${row.href})` : row.value}`);
  }
  if (content.details?.length) lines.push('');
  if (content.cta) lines.push(`${content.cta.label}: ${content.cta.url}`, '');
  for (const text of content.outro ?? []) lines.push(text, '');
  if (content.secondaryLink) {
    lines.push(`${content.secondaryLink.lead} ${content.secondaryLink.label}: ${content.secondaryLink.url}`, '');
  }
  if (content.notice) lines.push(content.notice, '');
  lines.push('--');
  if (brand.supportEmail) lines.push(`Need help? Contact us at ${brand.supportEmail}.`);
  lines.push(`Ecomesta: ${brand.appUrl}`);
  lines.push(`(c) ${year} Ecomesta`);
  return lines.join('\n');
}
