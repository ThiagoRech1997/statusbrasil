/**
 * Shields.io-style status badge SVG renderer.
 *
 * Pure: takes a label/value/color triple and emits an SVG string. The route
 * handler at /api/badge/[slug]/v1.svg composes inputs, this module owns the
 * pixels.
 */

export type BadgeColor = "brightgreen" | "yellow" | "red" | "lightgrey";

export interface BadgeOptions {
  label: string;
  value: string;
  color: BadgeColor;
}

const HEIGHT = 20;
const PADDING_X = 6;
// 11px Verdana renders ≈6.5px per glyph for ASCII; rounded up for safety.
const CHAR_WIDTH_PX = 6.5;

const COLOR_HEX: Record<BadgeColor, string> = {
  brightgreen: "#4c1",
  yellow: "#dfb317",
  red: "#e05d44",
  lightgrey: "#9f9f9f",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ASCII-only: callers must keep label/value in 7-bit ASCII. Multibyte glyphs
// would under-count `text.length * CHAR_WIDTH_PX` and clip the rendered text.
// This is OK for our inputs — `Slug` rejects non-ASCII and `formatBadgeValue`
// uses dot-decimals for cross-locale README parity.
function segmentWidth(text: string): number {
  return Math.ceil(text.length * CHAR_WIDTH_PX) + PADDING_X * 2;
}

export function renderBadge({ label, value, color }: BadgeOptions): string {
  const labelW = segmentWidth(label);
  const valueW = segmentWidth(value);
  const totalW = labelW + valueW;
  const labelX = labelW / 2;
  const valueX = labelW + valueW / 2;
  const fill = COLOR_HEX[color];
  const ariaLabel = escapeXml(`${label}: ${value}`);
  const labelText = escapeXml(label);
  const valueText = escapeXml(value);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${HEIGHT}" viewBox="0 0 ${totalW} ${HEIGHT}" role="img" aria-label="${ariaLabel}">` +
    `<title>${ariaLabel}</title>` +
    `<linearGradient id="g" x2="0" y2="100%">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".7"/>` +
    `<stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>` +
    `<stop offset=".9" stop-color="#000" stop-opacity=".3"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity=".5"/>` +
    `</linearGradient>` +
    `<clipPath id="r"><rect width="${totalW}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>` +
    `<g clip-path="url(#r)">` +
    `<rect width="${labelW}" height="${HEIGHT}" fill="#555"/>` +
    `<rect x="${labelW}" width="${valueW}" height="${HEIGHT}" fill="${fill}"/>` +
    `<rect width="${totalW}" height="${HEIGHT}" fill="url(#g)"/>` +
    `</g>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">` +
    `<text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${labelText}</text>` +
    `<text x="${labelX}" y="14">${labelText}</text>` +
    `<text x="${valueX}" y="15" fill="#010101" fill-opacity=".3">${valueText}</text>` +
    `<text x="${valueX}" y="14">${valueText}</text>` +
    `</g>` +
    `</svg>`
  );
}

export function uptimePctToColor(pct: number | null): BadgeColor {
  if (pct == null) return "lightgrey";
  if (pct >= 99) return "brightgreen";
  if (pct >= 95) return "yellow";
  return "red";
}

/**
 * Format the badge value for a service — e.g. "99.7%" or "unknown".
 * Uses dot as decimal separator since SVG badges are language-neutral artifacts
 * embedded in third-party READMEs across locales.
 */
export function formatBadgeValue(uptimePct: number | null): string {
  if (uptimePct == null) return "unknown";
  return `${uptimePct.toFixed(1)}%`;
}
