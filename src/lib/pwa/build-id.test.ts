// @vitest-environment node
//
// s10 plan task 5, trap 7: the upstream example's
// `spawnSync("git", …).stdout.trim() ?? crypto.randomUUID()` is wrong —
// `??` doesn't catch the empty string `git` prints when it fails inside
// a Vercel build container, so the /~offline revision would freeze at
// "" across every deployment, the exact bug criterion 6 exists to catch.
// This module never shells out to git at all: the source is
// `VERCEL_GIT_COMMIT_SHA`, with an `||` fallback (not `??`).
import { describe, expect, it } from "vitest";
import { resolveRevision } from "./build-id";

describe("resolveRevision", () => {
  it("returns the real sha untouched when present", () => {
    expect(resolveRevision({ VERCEL_GIT_COMMIT_SHA: "abc123" })).toBe(
      "abc123",
    );
  });

  it("falls back to a non-empty value when the sha is entirely absent", () => {
    const revision = resolveRevision({});
    expect(revision).toBeTruthy();
    expect(revision.length).toBeGreaterThan(0);
  });

  it("falls back to a non-empty value when the sha is an empty string — the trap `??` misses", () => {
    const revision = resolveRevision({ VERCEL_GIT_COMMIT_SHA: "" });
    expect(revision).toBeTruthy();
  });

  it("falls back to a non-empty value when the sha is whitespace only", () => {
    const revision = resolveRevision({ VERCEL_GIT_COMMIT_SHA: "   " });
    expect(revision).toBeTruthy();
    expect(revision.trim()).not.toBe("");
  });

  it("two calls with no sha do not return the same fallback value", () => {
    const first = resolveRevision({});
    const second = resolveRevision({});
    expect(first).not.toBe(second);
  });
});
