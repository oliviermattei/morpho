// @vitest-environment node
//
// s10 plan task 7: "Aucun setInterval dans le diff du hook" — the probe
// runs on four named triggers only (mount, online, visibilitychange →
// visible, reportNetworkFailure()), never on a timer.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("src/lib/pwa/use-online-status.ts — no polling", () => {
  it("never uses setInterval", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "use-online-status.ts"),
      "utf8",
    );

    expect(source).not.toContain("setInterval");
  });
});
