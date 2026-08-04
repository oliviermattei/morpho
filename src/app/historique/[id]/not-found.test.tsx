import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionNotFound from "./not-found";

// s09 plan R6 (revised): notFound() only ever renders the closest
// not-found.tsx — never the Empty component directly, which the story's
// first draft got wrong. This IS the file the state-12 tests exercise.
describe("historique/[id]/not-found.tsx", () => {
  it("renders the Session introuvable Empty state with a link back to /historique", () => {
    render(<SessionNotFound />);

    expect(
      screen.getByText("Session introuvable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Elle a peut-être été supprimée."),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Retour à l'historique" });
    expect(link).toHaveAttribute("href", "/historique");
    expect(link.className).toMatch(/\bh-11\b/);
  });
});
