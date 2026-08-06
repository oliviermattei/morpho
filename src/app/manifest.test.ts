// @vitest-environment node
//
// s10 plan task 3. PNG dimensions are read from the IHDR chunk directly
// (8-byte PNG signature + 4-byte length + 4-byte "IHDR" tag = 16 bytes,
// then width and height as two big-endian uint32) — no image-parsing
// dependency needed for a 12-byte read.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import manifest from "./manifest";

// next/font/google needs the Next.js compiler transform, unavailable
// under Vitest — same mock as src/app/layout.test.tsx, the shape the
// layout actually reads (`.variable`).
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

const { metadata, viewport } = await import("./layout");

const PUBLIC_DIR = resolve(import.meta.dirname, "..", "..", "public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");

function pngDimensions(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath);
  // Signature (8 bytes) + length (4) + "IHDR" (4) = offset 16 for width.
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("PWA icons (s10 decision 7, task 3)", () => {
  const EXPECTED = [
    { file: "icon-32.png", size: 32 },
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
    { file: "icon-512-maskable.png", size: 512 },
    { file: "apple-touch-icon-180.png", size: 180 },
  ];

  it.each(EXPECTED)("$file is a real PNG at $size x $size", ({ file, size }) => {
    const filePath = resolve(ICONS_DIR, file);
    expect(existsSync(filePath)).toBe(true);
    const dimensions = pngDimensions(filePath);
    expect(dimensions).toEqual({ width: size, height: size });
  });

  // Trap 8, second volet: public/**/* is the precache glob (s10 task 5)
  // — anything else under public/ ships to every visitor's device. The
  // list is asserted exactly, not filtered: adding a directory here is a
  // deliberate decision about what every device downloads, and it should
  // have to be written down. ADR 020 added `silhouettes` — two SVGs, one
  // of which the home screen shows on every visit.
  it("public/ contains nothing but icons/*.png and silhouettes/*.svg", () => {
    const entries = readdirSync(PUBLIC_DIR, { withFileTypes: true });
    expect(entries.map((entry) => entry.name).sort()).toEqual([
      "icons",
      "silhouettes",
    ]);

    // English filenames: the repo is public on GitHub, so the assets are
    // named in the language the code is written in. Only the vectors —
    // anything else here is precached into the PWA for nothing.
    const silhouettes = readdirSync(resolve(PUBLIC_DIR, "silhouettes"));
    expect(silhouettes.sort()).toEqual(["man.svg", "woman.svg"]);

    const iconFiles = readdirSync(ICONS_DIR);
    expect(iconFiles.sort()).toEqual(EXPECTED.map((e) => e.file).sort());
    for (const file of iconFiles) {
      expect(statSync(resolve(ICONS_DIR, file)).isFile()).toBe(true);
    }
  });

  it("the create-next-app favicon.ico residue is gone", () => {
    expect(existsSync(resolve(import.meta.dirname, "favicon.ico"))).toBe(false);
  });
});

describe("manifest() — s10 decisions 5, 6, 7", () => {
  const result = manifest();

  it("declares standalone display, id, scope and start_url all at '/'", () => {
    expect(result.display).toBe("standalone");
    expect(result.id).toBe("/");
    expect(result.scope).toBe("/");
    expect(result.start_url).toBe("/");
  });

  it("declares lang fr and dir ltr", () => {
    expect(result.lang).toBe("fr");
    expect(result.dir).toBe("ltr");
  });

  // Decision 6: the single, non-mediatable manifest color is the DARK
  // theme's own --background, sRGB-converted — never chosen freehand.
  it("sets theme_color and background_color to #0a0a0a, the dark --background conversion", () => {
    expect(result.theme_color).toBe("#0a0a0a");
    expect(result.background_color).toBe("#0a0a0a");
  });

  it("declares no orientation — iOS ignores it outside standalone, and stating one would be a false guarantee", () => {
    expect(result.orientation).toBeUndefined();
  });

  it("covers 192, 512 (purpose any) and a maskable icon", () => {
    const purposes = result.icons?.map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(purposes).toContain("192x192:any");
    expect(purposes).toContain("512x512:any");
    expect(purposes).toContain("512x512:maskable");
  });

  it("every icon's src resolves to a file that actually exists under public/", () => {
    for (const icon of result.icons ?? []) {
      const filePath = resolve(PUBLIC_DIR, icon.src.replace(/^\//, ""));
      expect(existsSync(filePath)).toBe(true);
    }
  });
});

// Assertion of CONFIGURATION, not of emission (task 3's own caveat): what
// is actually rendered is Playwright's job (task 8). This only proves
// the objects layout.tsx exports carry the right declarations.
describe("layout.tsx metadata/viewport — s10 decision 4 (iOS tags)", () => {
  it("declares appleWebApp.capable (emits mobile-web-app-capable) and statusBarStyle default", () => {
    expect(metadata.appleWebApp).toMatchObject({
      capable: true,
      statusBarStyle: "default",
      title: "morpho",
    });
  });

  it("declares the legacy apple-mobile-web-app-capable tag via metadata.other — Next's own appleWebApp never emits it", () => {
    expect(metadata.other).toMatchObject({
      "apple-mobile-web-app-capable": "yes",
    });
  });

  it("declares the three PNG icons and the apple touch icon", () => {
    const icons = metadata.icons as {
      icon?: unknown[];
      apple?: unknown[];
    };
    expect(icons.icon?.length).toBeGreaterThanOrEqual(3);
    expect(icons.apple?.length).toBeGreaterThanOrEqual(1);
  });

  it("declares a bi-theme themeColor in viewport — never a single flat color", () => {
    const themeColor = viewport.themeColor as { media: string; color: string }[];
    expect(themeColor).toContainEqual({
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    });
    expect(themeColor).toContainEqual({
      media: "(prefers-color-scheme: dark)",
      color: "#0a0a0a",
    });
  });
});
