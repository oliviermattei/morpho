import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(() => "/"),
}));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("links to the four destinations plus the capture action", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Graphes" })).toHaveAttribute(
      "href",
      "/graphes",
    );
    expect(screen.getByRole("link", { name: "Historique" })).toHaveAttribute(
      "href",
      "/historique",
    );
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute(
      "href",
      "/profil",
    );
    expect(
      screen.getByRole("link", { name: "Saisir une mesure" }),
    ).toHaveAttribute("href", "/saisie");
  });

  // design-system.md §Cible tactile: 44px floor. An icon is not a tap
  // target.
  it("gives every entry at least a 44px target", () => {
    render(<BottomNav />);

    for (const name of ["Accueil", "Graphes", "Historique", "Profil"]) {
      expect(
        screen.getByRole("link", { name }).className,
      ).toMatch(/\bmin-h-11\b/);
    }
    expect(
      screen.getByRole("link", { name: "Saisir une mesure" }).className,
    ).toMatch(/\bsize-14\b/);
  });

  it("marks the current destination with aria-current", () => {
    usePathnameMock.mockReturnValue("/graphes");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Graphes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // A sub-route still belongs to its section — editing a session must
  // not un-highlight Historique.
  it("keeps a section active on its sub-routes", () => {
    usePathnameMock.mockReturnValue("/historique/abc-123");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Historique" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  // "/" is a prefix of every path — matching it loosely would light up
  // Accueil on every screen at once.
  it("only marks Accueil active on the home route itself", () => {
    usePathnameMock.mockReturnValue("/profil");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is a labelled navigation landmark", () => {
    usePathnameMock.mockReturnValue("/");
    render(<BottomNav />);

    expect(
      screen.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeInTheDocument();
  });
});
