/**
 * Cover illustrations for blog posts, drawn as SVG in the Ecomesta brand colours.
 * No text inside the art, so the same picture works for the English and Bangla
 * post and in the social share image (`/og/blog/[slug]`).
 */

const C = {
  navy: '#022857',
  blue: '#0187f0',
  blueDeep: '#0156b6',
  green: '#03a581',
  greenLight: '#7fe0c4',
  tint: '#eef4fc',
  tintStrong: '#dbe8fb',
  greenTint: '#e2f6ef',
  amber: '#f5b83d',
  amberLight: '#ffe3a3',
  coral: '#ff7a59',
  white: '#ffffff',
  line: '#c9d8ee',
};

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

/* ---------- shared pieces ---------- */

function background(id: string, from: string, to: string): string {
  return `
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <pattern id="${id}-dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="2" fill="${C.navy}" fill-opacity="0.07"/>
    </pattern>
    <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${C.navy}" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#${id}-bg)"/>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#${id}-dots)"/>
  <circle cx="1080" cy="80" r="190" fill="${C.blue}" fill-opacity="0.10"/>
  <circle cx="110" cy="560" r="170" fill="${C.green}" fill-opacity="0.12"/>`;
}

function sparkle(x: number, y: number, s: number, color: string): string {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -14 C2 -4 4 -2 14 0 C4 2 2 4 0 14 C-2 4 -4 2 -14 0 C-4 -2 -2 -4 0 -14Z" fill="${color}"/>`;
}

function browser(id: string, x: number, y: number, w: number, h: number, body: string): string {
  return `
  <g filter="url(#${id}-shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${C.white}"/>
  </g>
  <rect x="${x}" y="${y}" width="${w}" height="52" rx="22" fill="${C.tintStrong}"/>
  <rect x="${x}" y="${y + 30}" width="${w}" height="22" fill="${C.tintStrong}"/>
  <circle cx="${x + 30}" cy="${y + 26}" r="7" fill="${C.coral}"/>
  <circle cx="${x + 54}" cy="${y + 26}" r="7" fill="${C.amber}"/>
  <circle cx="${x + 78}" cy="${y + 26}" r="7" fill="${C.green}"/>
  <rect x="${x + 110}" y="${y + 16}" width="${w * 0.5}" height="20" rx="10" fill="${C.white}"/>
  ${body}`;
}

function coin(x: number, y: number, r: number): string {
  return `
  <ellipse cx="${x}" cy="${y + r * 0.18}" rx="${r}" ry="${r * 0.32}" fill="#d9952a"/>
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.32}" fill="${C.amber}"/>
  <ellipse cx="${x}" cy="${y}" rx="${r * 0.62}" ry="${r * 0.19}" fill="none" stroke="#d9952a" stroke-width="4"/>`;
}

function coinStack(x: number, y: number, r: number, count: number): string {
  let out = '';
  for (let i = 0; i < count; i += 1) out += coin(x, y - i * r * 0.3, r);
  return out;
}

function priceTag(x: number, y: number, s: number, color: string): string {
  return `
  <g transform="translate(${x} ${y}) rotate(-14) scale(${s})">
    <path d="M0 0 H120 L160 40 L120 80 H0 Z" fill="${color}"/>
    <circle cx="128" cy="40" r="9" fill="${C.white}"/>
    <rect x="22" y="24" width="70" height="10" rx="5" fill="${C.white}" fill-opacity="0.9"/>
    <rect x="22" y="44" width="46" height="10" rx="5" fill="${C.white}" fill-opacity="0.6"/>
  </g>`;
}

function truck(x: number, y: number, s: number): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="0" y="0" width="190" height="118" rx="14" fill="${C.blueDeep}"/>
    <rect x="22" y="22" width="80" height="12" rx="6" fill="${C.white}" fill-opacity="0.85"/>
    <rect x="22" y="44" width="52" height="12" rx="6" fill="${C.white}" fill-opacity="0.55"/>
    <path d="M190 34 H246 L286 78 V118 H190 Z" fill="${C.blue}"/>
    <path d="M204 46 H240 L268 78 H204 Z" fill="${C.tintStrong}"/>
    <rect x="-6" y="112" width="300" height="14" rx="7" fill="${C.navy}"/>
    <circle cx="58" cy="132" r="26" fill="${C.navy}"/><circle cx="58" cy="132" r="11" fill="${C.line}"/>
    <circle cx="232" cy="132" r="26" fill="${C.navy}"/><circle cx="232" cy="132" r="11" fill="${C.line}"/>
  </g>`;
}

function parcel(x: number, y: number, s: number): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 30 L60 0 L120 30 L60 60 Z" fill="#e8b46a"/>
    <path d="M0 30 V100 L60 130 V60 Z" fill="#cf9548"/>
    <path d="M120 30 V100 L60 130 V60 Z" fill="#b97f36"/>
    <path d="M30 15 L90 45 V68" stroke="${C.white}" stroke-opacity="0.7" stroke-width="8" fill="none"/>
  </g>`;
}

function pin(x: number, y: number, s: number, color: string): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="62" rx="20" ry="6" fill="${C.navy}" fill-opacity="0.15"/>
    <path d="M0 60 C-6 40 -34 24 -34 -2 A34 34 0 0 1 34 -2 C34 24 6 40 0 60Z" fill="${color}"/>
    <circle cx="0" cy="-4" r="13" fill="${C.white}"/>
  </g>`;
}

function phone(id: string, x: number, y: number, w: number, h: number, screen: string): string {
  return `
  <g filter="url(#${id}-shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="34" fill="${C.navy}"/>
  </g>
  <rect x="${x + 12}" y="${y + 14}" width="${w - 24}" height="${h - 28}" rx="24" fill="${C.white}"/>
  <rect x="${x + w / 2 - 28}" y="${y + 22}" width="56" height="10" rx="5" fill="${C.navy}"/>
  ${screen}`;
}

function cashNote(x: number, y: number, s: number, rotate: number): string {
  return `
  <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${s})">
    <rect x="0" y="0" width="230" height="118" rx="14" fill="${C.green}"/>
    <rect x="12" y="12" width="206" height="94" rx="10" fill="none" stroke="${C.greenLight}" stroke-width="5"/>
    <circle cx="115" cy="59" r="30" fill="${C.greenLight}"/>
    <circle cx="115" cy="59" r="16" fill="${C.green}"/>
    <circle cx="44" cy="59" r="9" fill="${C.greenLight}"/>
    <circle cx="186" cy="59" r="9" fill="${C.greenLight}"/>
  </g>`;
}

function bankCard(x: number, y: number, s: number, rotate: number): string {
  return `
  <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${s})">
    <rect x="0" y="0" width="230" height="146" rx="18" fill="${C.blueDeep}"/>
    <rect x="0" y="30" width="230" height="26" fill="${C.navy}"/>
    <rect x="22" y="78" width="44" height="32" rx="6" fill="${C.amber}"/>
    <rect x="22" y="120" width="120" height="10" rx="5" fill="${C.white}" fill-opacity="0.75"/>
    <circle cx="178" cy="104" r="20" fill="${C.coral}" fill-opacity="0.9"/>
    <circle cx="200" cy="104" r="20" fill="${C.amber}" fill-opacity="0.9"/>
  </g>`;
}

function chatBubble(x: number, y: number, w: number, color: string, flip: boolean, lines: number): string {
  const h = 34 + lines * 22;
  const tail = flip
    ? `<path d="M${x + w - 34} ${y + h - 2} L${x + w - 6} ${y + h + 22} L${x + w - 58} ${y + h - 2}Z" fill="${color}"/>`
    : `<path d="M${x + 34} ${y + h - 2} L${x + 6} ${y + h + 22} L${x + 58} ${y + h - 2}Z" fill="${color}"/>`;
  let bars = '';
  for (let i = 0; i < lines; i += 1) {
    const bw = i === lines - 1 ? w * 0.45 : w * 0.72;
    bars += `<rect x="${x + 22}" y="${y + 20 + i * 22}" width="${bw}" height="11" rx="5.5" fill="${C.white}" fill-opacity="${color === C.white ? 0 : 0.85}"/>`;
    if (color === C.white) bars += `<rect x="${x + 22}" y="${y + 20 + i * 22}" width="${bw}" height="11" rx="5.5" fill="${C.line}"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${color}"/>${tail}${bars}`;
}

function storefront(id: string, x: number, y: number, s: number): string {
  const stripes = [0, 1, 2, 3, 4, 5]
    .map((i) => `<path d="M${i * 50} 0 H${i * 50 + 50} V58 C${i * 50 + 50} 74 ${i * 50} 74 ${i * 50} 58Z" fill="${i % 2 ? C.white : C.green}"/>`)
    .join('');
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <g filter="url(#${id}-shadow)"><rect x="10" y="40" width="280" height="220" rx="16" fill="${C.white}"/></g>
    <rect x="0" y="0" width="300" height="20" rx="10" fill="${C.navy}"/>
    <g transform="translate(0 16)">${stripes}</g>
    <rect x="40" y="120" width="96" height="140" rx="10" fill="${C.tintStrong}"/>
    <circle cx="120" cy="192" r="6" fill="${C.blueDeep}"/>
    <rect x="160" y="120" width="104" height="80" rx="10" fill="${C.tint}"/>
    <rect x="176" y="140" width="30" height="40" rx="6" fill="${C.amber}"/>
    <rect x="216" y="152" width="34" height="28" rx="6" fill="${C.blue}"/>
  </g>`;
}

function rocket(x: number, y: number, s: number): string {
  return `
  <g transform="translate(${x} ${y}) rotate(35) scale(${s})">
    <path d="M-30 150 C-40 190 0 230 0 250 C0 230 40 190 30 150Z" fill="${C.amber}"/>
    <path d="M-16 150 C-20 180 0 205 0 215 C0 205 20 180 16 150Z" fill="${C.coral}"/>
    <path d="M-48 120 L-80 170 L-40 160Z" fill="${C.blueDeep}"/>
    <path d="M48 120 L80 170 L40 160Z" fill="${C.blueDeep}"/>
    <path d="M0 -40 C46 0 52 90 40 158 H-40 C-52 90 -46 0 0 -40Z" fill="${C.white}"/>
    <path d="M0 -40 C22 -22 34 0 40 26 H-40 C-34 0 -22 -22 0 -40Z" fill="${C.coral}"/>
    <circle cx="0" cy="66" r="22" fill="${C.blue}"/>
    <circle cx="0" cy="66" r="12" fill="${C.tintStrong}"/>
  </g>`;
}

function checklist(id: string, x: number, y: number, w: number, rows: number, done: number): string {
  let items = '';
  for (let i = 0; i < rows; i += 1) {
    const cy = y + 92 + i * 58;
    const ok = i < done;
    items += `
    <rect x="${x + 30}" y="${cy - 18}" width="36" height="36" rx="10" fill="${ok ? C.green : C.tint}" stroke="${ok ? C.green : C.line}" stroke-width="3"/>
    ${ok ? `<path d="M${x + 39} ${cy} l7 7 l13 -15" stroke="${C.white}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <rect x="${x + 84}" y="${cy - 7}" width="${w - (i % 2 ? 170 : 130)}" height="14" rx="7" fill="${ok ? C.line : C.tintStrong}"/>`;
  }
  const h = 70 + rows * 58;
  return `
  <g filter="url(#${id}-shadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${C.white}"/></g>
  <rect x="${x + w / 2 - 50}" y="${y - 16}" width="100" height="34" rx="12" fill="${C.navy}"/>
  ${items}`;
}

function barChart(x: number, y: number, s: number): string {
  const bars = [60, 95, 80, 130, 170]
    .map((h, i) => `<rect x="${i * 44}" y="${180 - h}" width="30" height="${h}" rx="8" fill="${i === 4 ? C.green : C.blue}" fill-opacity="${i === 4 ? 1 : 0.35 + i * 0.12}"/>`)
    .join('');
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    ${bars}
    <path d="M10 120 L60 90 L104 102 L150 56 L200 20" stroke="${C.navy}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M182 14 L206 16 L200 40" stroke="${C.navy}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

/* ---------- covers ---------- */

function websiteCost(): string {
  const id = 'cost';
  const body = `
    <rect x="300" y="230" width="380" height="150" rx="16" fill="${C.tint}"/>
    <rect x="330" y="262" width="190" height="20" rx="10" fill="${C.navy}" fill-opacity="0.85"/>
    <rect x="330" y="296" width="250" height="14" rx="7" fill="${C.line}"/>
    <rect x="330" y="324" width="120" height="34" rx="12" fill="${C.blueDeep}"/>
    <rect x="300" y="404" width="118" height="96" rx="14" fill="${C.greenTint}"/>
    <rect x="431" y="404" width="118" height="96" rx="14" fill="${C.tintStrong}"/>
    <rect x="562" y="404" width="118" height="96" rx="14" fill="${C.amberLight}"/>`;
  return `${background(id, C.tint, C.greenTint)}
  ${browser(id, 270, 150, 440, 380, body)}
  ${priceTag(770, 150, 1.05, C.green)}
  ${barChart(745, 300, 0.8)}
  ${coinStack(985, 520, 58, 5)}
  ${coinStack(1100, 540, 40, 3)}
  ${sparkle(230, 140, 1.4, C.amber)}
  ${sparkle(1080, 260, 1, C.blue)}
  ${sparkle(700, 560, 0.8, C.green)}`;
}

function deliveryCharges(): string {
  const id = 'delivery';
  return `${background(id, C.greenTint, C.tint)}
  <path d="M200 470 C330 330 420 420 560 300 S800 160 960 210" stroke="${C.navy}" stroke-opacity="0.35" stroke-width="7" stroke-dasharray="4 22" stroke-linecap="round" fill="none"/>
  ${pin(200, 410, 1.2, C.green)}
  ${pin(560, 240, 1, C.blue)}
  ${pin(960, 150, 1.3, C.coral)}
  ${truck(330, 400, 1.15)}
  ${parcel(800, 330, 1.25)}
  ${parcel(930, 380, 0.9)}
  ${sparkle(120, 140, 1.2, C.amber)}
  ${sparkle(1100, 470, 1, C.green)}`;
}

function codVsOnline(): string {
  const id = 'cod';
  const screen = `
    <rect x="808" y="210" width="196" height="96" rx="16" fill="${C.tintStrong}"/>
    <circle cx="850" cy="258" r="22" fill="${C.coral}"/>
    <rect x="884" y="244" width="96" height="12" rx="6" fill="${C.navy}" fill-opacity="0.75"/>
    <rect x="884" y="266" width="64" height="10" rx="5" fill="${C.line}"/>
    <rect x="808" y="326" width="196" height="16" rx="8" fill="${C.line}"/>
    <rect x="808" y="354" width="140" height="16" rx="8" fill="${C.tint}"/>
    <rect x="808" y="430" width="196" height="54" rx="16" fill="${C.green}"/>
    <path d="M884 457 l12 12 l22 -24" stroke="${C.white}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `${background(id, C.amberLight, C.tint)}
  ${cashNote(150, 230, 1.15, -12)}
  ${cashNote(190, 300, 1.15, 4)}
  ${coinStack(470, 500, 46, 3)}
  <circle cx="610" cy="320" r="56" fill="${C.navy}"/>
  <path d="M582 304 H636 M624 292 L638 304 L624 316 M638 336 H584 M596 324 L582 336 L596 348" stroke="${C.white}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${phone(id, 790, 150, 232, 380, screen)}
  ${bankCard(1000, 360, 0.8, 14)}
  ${sparkle(700, 130, 1.2, C.green)}
  ${sparkle(110, 520, 1, C.blue)}`;
}

function facebookToStore(): string {
  const id = 'social';
  return `${background(id, C.tint, C.tintStrong)}
  ${chatBubble(110, 150, 300, C.blue, false, 2)}
  ${chatBubble(190, 290, 260, C.white, true, 2)}
  ${chatBubble(110, 420, 220, C.blue, false, 1)}
  <path d="M500 330 H640" stroke="${C.navy}" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/>
  <path d="M640 300 L686 330 L640 360Z" fill="${C.navy}"/>
  ${storefront(id, 730, 150, 1.25)}
  ${sparkle(470, 180, 1.2, C.amber)}
  ${sparkle(1110, 120, 1, C.green)}
  ${sparkle(560, 520, 0.9, C.coral)}`;
}

function startBusiness(): string {
  const id = 'start';
  return `${background(id, C.tintStrong, C.greenTint)}
  ${checklist(id, 150, 140, 360, 5, 3)}
  ${rocket(820, 170, 1.15)}
  <circle cx="700" cy="520" r="44" fill="${C.white}" fill-opacity="0.9"/>
  <circle cx="770" cy="545" r="32" fill="${C.white}" fill-opacity="0.9"/>
  <circle cx="640" cy="550" r="28" fill="${C.white}" fill-opacity="0.9"/>
  ${coinStack(1020, 520, 44, 4)}
  ${sparkle(600, 150, 1.4, C.amber)}
  ${sparkle(1080, 140, 1.1, C.blue)}
  ${sparkle(560, 360, 0.8, C.green)}`;
}

function generic(): string {
  const id = 'blog';
  const body = `
    <rect x="300" y="230" width="380" height="24" rx="12" fill="${C.navy}" fill-opacity="0.85"/>
    <rect x="300" y="276" width="320" height="14" rx="7" fill="${C.line}"/>
    <rect x="300" y="304" width="350" height="14" rx="7" fill="${C.line}"/>
    <rect x="300" y="350" width="380" height="140" rx="16" fill="${C.greenTint}"/>`;
  return `${background(id, C.tint, C.greenTint)}
  ${browser(id, 270, 150, 440, 380, body)}
  ${barChart(820, 260, 1)}
  ${sparkle(230, 140, 1.3, C.amber)}`;
}

const COVERS: Record<string, () => string> = {
  'ecommerce-website-cost-bangladesh': websiteCost,
  'delivery-charges-bangladesh-online-store': deliveryCharges,
  'cash-on-delivery-vs-online-payment': codVsOnline,
  'facebook-page-to-online-store': facebookToStore,
  'how-to-start-online-business-bangladesh': startBusiness,
};

/** The cover illustration of a post as an SVG document. */
export function blogCoverSvg(slug: string): string {
  const art = (COVERS[slug] ?? generic)();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}" width="${COVER_WIDTH}" height="${COVER_HEIGHT}">${art}</svg>`;
}

/** The cover as a data URI for `<img src>`, so it ships inside the static page. */
export function blogCoverDataUri(slug: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(blogCoverSvg(slug)).toString('base64')}`;
}

/** Path of the PNG share image for a post. */
export function blogShareImagePath(slug: string): string {
  return `/og/blog/${slug}`;
}
