import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionEditLoading from "./loading";

// s09 plan task 8, état 6 of the Design: skeletons shaped like the real
// fields, never a full-screen spinner, and the delete button disabled
// until the session is actually read.
describe("historique/[id]/loading.tsx", () => {
  it("renders no full-screen spinner", () => {
    const { container } = render(<SessionEditLoading />);

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders the form skeleton's field-shaped placeholders", () => {
    const { container } = render(<SessionEditLoading />);

    // 10 measurement fields + the date field, same as
    // MeasurementSessionFormSkeleton's own contract.
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThanOrEqual(11);
  });

  it("renders a disabled delete button — nothing destructive is actionable before the session loads", () => {
    render(<SessionEditLoading />);

    expect(
      screen.getByRole("button", { name: /supprimer/i }),
    ).toBeDisabled();
  });
});
