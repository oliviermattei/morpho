// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectBuildOutputFiles } from "./build-output";

// Review s01, second pass, finding B: with a `.next/` that exists but
// contains only `cache/` — exactly what `next dev` or an interrupted build
// leaves behind — the previous implementation returned an empty list, and
// `expect(offenders).toEqual([])` in both build-scanning checks
// (src/build-connection-leak.check.ts, src/build-leak.test.ts) passed
// having scanned nothing at all. Both criteria 5 and 6 rely on this scan
// actually finding files; a scan that certifies a security criterion must
// never pass vacuously.
describe("collectBuildOutputFiles — never a vacuous pass", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when .next/ exists but only contains cache/ (nothing to scan)", () => {
    tempDir = mkdtempSync(join(tmpdir(), "morpho-next-"));
    mkdirSync(join(tempDir, "cache"), { recursive: true });

    expect(() => collectBuildOutputFiles(tempDir)).toThrow(
      /nothing to scan/i,
    );
  });

  it("throws when .next/ does not exist at all", () => {
    expect(() =>
      collectBuildOutputFiles(join(tmpdir(), "morpho-next-does-not-exist")),
    ).toThrow(/No build found/i);
  });

  it("returns the scanned files when the build output is real", () => {
    tempDir = mkdtempSync(join(tmpdir(), "morpho-next-"));
    mkdirSync(join(tempDir, "static", "chunks"), { recursive: true });
    writeFileSync(join(tempDir, "static", "chunks", "app.js"), "console.log(1)");

    expect(collectBuildOutputFiles(tempDir)).toEqual([
      join(tempDir, "static", "chunks", "app.js"),
    ]);
  });

  it("also finds prerendered HTML and RSC payloads under server/app/", () => {
    tempDir = mkdtempSync(join(tmpdir(), "morpho-next-"));
    mkdirSync(join(tempDir, "server", "app"), { recursive: true });
    writeFileSync(join(tempDir, "server", "app", "page.html"), "<html></html>");
    writeFileSync(join(tempDir, "server", "app", "page.rsc"), "1:...");
    writeFileSync(join(tempDir, "server", "app", "page.meta"), "{}");

    const files = collectBuildOutputFiles(tempDir);

    expect(files).toContain(join(tempDir, "server", "app", "page.html"));
    expect(files).toContain(join(tempDir, "server", "app", "page.rsc"));
    expect(files).not.toContain(join(tempDir, "server", "app", "page.meta"));
  });
});
