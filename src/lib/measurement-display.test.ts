// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deltaLineClasses, thirdLine } from "./measurement-display";
import type { ViewEntry } from "./body-map-view";

describe("deltaLineClasses", () => {
  it("colours a verdict, plain text for a zero delta, muted when absent", () => {
    expect(deltaLineClasses("favorable")).toBe("text-progress-favorable");
    expect(deltaLineClasses("adverse")).toBe("text-progress-adverse");
    expect(deltaLineClasses("neutral")).toBe("text-foreground");
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

  // No glyph, whatever the verdict: the sign the delta already carries
  // says which way it moved, the colour (deltaLineClasses) says whether
  // that is good for this kind.
  it("returns the delta as-is once compared, for every verdict", () => {
    expect(thirdLine(entry({}))).toBe("−7,4 cm");
    expect(thirdLine(entry({ verdict: "adverse", deltaText: "+2,1 cm" }))).toBe(
      "+2,1 cm",
    );
    expect(thirdLine(entry({ verdict: "neutral", deltaText: "−1,0" }))).toBe(
      "−1,0",
    );
  });
});
