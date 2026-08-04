import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import OfflinePage, { dynamic } from "./page";

// s10 plan task 6, decision 15: the fallback for a document request no
// strategy can answer — a route never visited online. Must render
// without ANY database access or session read: this page is precached
// and served with zero network, by definition.
describe("/~offline page", () => {
  it("exports dynamic = 'force-static'", () => {
    expect(dynamic).toBe("force-static");
  });

  it("renders the Empty state title, description and a retry action — no session, no database", () => {
    render(<OfflinePage />);

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    const retry = screen.getByRole("link", { name: "Réessayer" });
    expect(retry).toHaveAttribute("href", "/");
    expect(retry.className).toMatch(/\bh-11\b/);
  });
});
