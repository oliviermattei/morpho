import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomeLoading from "./loading";

// OfflineBanner calls useRouter(), BottomNav calls usePathname() — both
// are mounted here for real, and jsdom has no router context for either.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

describe("(home)/loading — skeleton, no spinner (plan s06 task 8)", () => {
  // ADR 020 moved the capture control from AppHeader to BottomNav. The
  // invariant is unchanged and is why the bar is mounted for real rather
  // than drawn as a skeleton: the one-tap route to /saisie must stay
  // usable through the ~500 ms Neon cold start.
  it("mounts the real BottomNav — the capture button stays tapable during the cold start", () => {
    render(<HomeLoading />);

    const link = screen.getByRole("link", { name: "Saisir une mesure" });
    expect(link).toHaveAttribute("href", "/saisie");
    expect(link.className).toMatch(/\bsize-14\b/);
  });

  it("renders a skeleton at the silhouette's height, one for the status line, and 4 card skeletons", () => {
    const { container } = render(<HomeLoading />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // 1 header status line + 1 silhouette block + 1 legend + 4 cards.
    expect(skeletons.length).toBe(1 + 1 + 1 + 4);
  });

  it("never renders a full-screen spinner", () => {
    const { container } = render(<HomeLoading />);

    expect(container.querySelector('[data-slot="spinner"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

describe("(home)/loading — the shared BottomNav, not a second definition (decision 21)", () => {
  it("the loading module imports BottomNav from the shared component, not a redeclared bar", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "loading.tsx"),
      "utf8",
    );

    expect(source).toContain('from "@/components/BottomNav"');
  });
});

// Plan s06 decision 18, the trap this task exists to close: a loading.tsx
// at the app segment root would wrap /saisie, /historique and /profil
// too — none of which have their own loading.tsx to override it — and
// the user would see the SILHOUETTE's skeleton as the wait state for the
// capture form the tap unique leads to.
describe("app router segment — no root loading.tsx (decision 18)", () => {
  it("src/app/loading.tsx does not exist — only src/app/(home)/loading.tsx does", () => {
    const appDir = resolve(import.meta.dirname, "..");
    expect(existsSync(resolve(appDir, "loading.tsx"))).toBe(false);
    expect(existsSync(resolve(import.meta.dirname, "loading.tsx"))).toBe(
      true,
    );
  });
});
