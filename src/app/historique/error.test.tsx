import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoriqueError from "./error";

// Plan task 6, corrected during revision: reset() only clears the error
// boundary's local state (error-boundary.js:39-48) — it does not re-fetch
// the failed read, so the error would be re-thrown immediately and
// "Réessayer" would be a no-op. unstable_retry() re-fetches and
// re-renders the boundary's children (Next docs, error.md). Both props
// are spied and distinct so the test fails if the button is wired to the
// wrong one.
describe("historique/error.tsx", () => {
  it("calls unstable_retry() on click, never reset()", async () => {
    const user = userEvent.setup();
    const resetSpy = vi.fn();
    const unstableRetrySpy = vi.fn();

    render(
      <HistoriqueError
        error={new Error("boom")}
        reset={resetSpy}
        unstable_retry={unstableRetrySpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(unstableRetrySpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it("shows a plain-language message, in French", () => {
    render(
      <HistoriqueError
        error={new Error("boom")}
        reset={vi.fn()}
        unstable_retry={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Impossible de charger l'historique"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vérifiez votre connexion et réessayez."),
    ).toBeInTheDocument();
  });

  it("never displays the underlying error's message or an HTTP status code", () => {
    render(
      <HistoriqueError
        error={new Error("503 Service Unavailable")}
        reset={vi.fn()}
        unstable_retry={vi.fn()}
      />,
    );

    expect(screen.queryByText(/503/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("503 Service Unavailable"),
    ).not.toBeInTheDocument();
  });

  it("renders the Réessayer button at the 44px touch target (decision 23)", () => {
    render(
      <HistoriqueError
        error={new Error("boom")}
        reset={vi.fn()}
        unstable_retry={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Réessayer" });
    expect(button.className).toMatch(/\bh-11\b/);
  });
});
