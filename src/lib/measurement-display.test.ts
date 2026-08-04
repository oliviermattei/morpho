// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  deltaLineClasses,
  thirdLine,
  verdictGlyph,
} from "./measurement-display";
import type { ViewEntry } from "./body-map-view";

describe("verdictGlyph", () => {
  it("marks progress and setbacks, and stays silent otherwise", () => {
    expect(verdictGlyph("favorable")).toBe("▲ ");
    expect(verdictGlyph("adverse")).toBe("▼ ");
    // A neutral verdict is neither — the IMC carries one on every
    // comparison (body-map-view decision 5).
    expect(verdictGlyph("neutral")).toBe("");
    expect(verdictGlyph(null)).toBe("");
  });
});

describe("deltaLineClasses", () => {
  it("colours a verdict, and falls back to muted for neutral or absent", () => {
    expect(deltaLineClasses("favorable")).toBe("text-progress-favorable");
    expect(deltaLineClasses("adverse")).toBe("text-progress-adverse");
    expect(deltaLineClasses("neutral")).toBe("text-muted-foreground");
    expect(deltaLineClasses(null)).toBe("text-muted-foreground");
  });
});

describe("thirdLine", () => {
  const entry = (over: Partial<ViewEntry>): ViewEntry => ({
    state: "compared",
    valueText: "88,6 cm",
    deltaText: "−7,4 cm",
    verdict: "favorable",
    ...over,
  });

  it("names the state when there is nothing to compare", () => {
    expect(thirdLine(entry({ state: "none" }))).toBe("Aucune mesure");
    expect(thirdLine(entry({ state: "single" }))).toBe("1 mesure");
  });

  it("prefixes the delta with its glyph once compared", () => {
    expect(thirdLine(entry({}))).toBe("▲ −7,4 cm");
    expect(thirdLine(entry({ verdict: "adverse", deltaText: "+2,1 cm" }))).toBe(
      "▼ +2,1 cm",
    );
  });

  it("renders a neutral delta bare, with no glyph", () => {
    expect(thirdLine(entry({ verdict: "neutral", deltaText: "−1,0" }))).toBe(
      "−1,0",
    );
  });
});
