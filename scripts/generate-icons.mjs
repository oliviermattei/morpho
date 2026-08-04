#!/usr/bin/env node
// s10 plan task 3, decision 8: a ONE-SHOT script, never wired to any npm
// script and never added to package.json — `sharp` is already present
// transitively (installed by next@16.2.12), which is enough to run this
// once and commit the result. The five generated PNGs are what ships;
// this script only documents how to regenerate them. Contrepartie
// assumée (decision 8): the glyph's exact rendering depends on the
// fonts installed on the machine that runs this script.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = resolve(import.meta.dirname, "..", "public", "icons");

// The dark --background conversion (decision 6/7, docs/design-system.md
// § Identité PWA) — the same value the manifest and the splash screen
// use, never a color invented for the icon alone.
const BACKGROUND = "#0a0a0a";
const GLYPH_COLOR = "#ffffff";
const FONT_FAMILY =
  "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * decision 7: the lowercase "m" glyph, centered, on the dark background
 * — never the full "morpho" word-mark (illegible at icon size) and
 * never a logo asset (design-system.md § Navigation: "Pas de logo").
 * `glyphScale` is a fraction of `size`; the maskable variant uses a
 * smaller one so the glyph stays inside the 80%-of-side safe circle
 * Android's own mask applies.
 */
function iconSvg({ size, glyphScale }) {
  const fontSize = Math.round(size * glyphScale);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}" />
  <text
    x="50%"
    y="52%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="${FONT_FAMILY}"
    font-size="${fontSize}"
    font-weight="600"
    fill="${GLYPH_COLOR}"
  >m</text>
</svg>`;
}

const ICONS = [
  { name: "icon-32.png", size: 32, glyphScale: 0.62 },
  { name: "icon-192.png", size: 192, glyphScale: 0.58 },
  { name: "icon-512.png", size: 512, glyphScale: 0.58 },
  // Maskable (decision 7): glyph confined to the central 80%-of-side
  // safe circle — a smaller scale than the "any" variants above.
  { name: "icon-512-maskable.png", size: 512, glyphScale: 0.42 },
  // apple-touch-icon: opaque, square corners — iOS applies its own mask
  // (decision 7); same glyph scale as the other "any" icons.
  { name: "apple-touch-icon-180.png", size: 180, glyphScale: 0.58 },
];

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    const svg = iconSvg(icon);
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(resolve(OUTPUT_DIR, icon.name), buffer);
    console.log(`wrote public/icons/${icon.name} (${icon.size}x${icon.size})`);
  }
}

await main();
