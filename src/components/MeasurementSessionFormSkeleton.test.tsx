import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MeasurementSessionForm } from "./MeasurementSessionForm";
import { MeasurementSessionFormSkeleton } from "./MeasurementSessionFormSkeleton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Plan task 3: the skeleton must describe the exact shape of the real
// form's content — same labels, same groups, same order — read from the
// same source (src/lib/measurements.ts). Cross-asserted against the real
// component rather than a hardcoded list, so the two can never silently
// drift apart.
describe("MeasurementSessionFormSkeleton — parity with the real form", () => {
  it("renders the same field labels, in the same order, as MeasurementSessionForm", () => {
    const { container: formContainer } = render(
      <MeasurementSessionForm mode="create" suggestions={{}} />,
    );
    const formLabels = Array.from(
      formContainer.querySelectorAll("label"),
    ).map((label) => label.textContent);

    const { container: skeletonContainer } = render(
      <MeasurementSessionFormSkeleton />,
    );
    const skeletonLabels = Array.from(
      skeletonContainer.querySelectorAll("label"),
    ).map((label) => label.textContent);

    expect(skeletonLabels).toEqual(formLabels);
  });

  it("renders ten value placeholders, one date placeholder, and a disabled submit button — no spinner, nothing covering the screen", () => {
    const { container } = render(<MeasurementSessionFormSkeleton />);

    expect(
      container.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(11);
    expect(container.querySelector('[role="status"]')).toBeNull();

    const submitButton = container.querySelector(
      'button[type="submit"], button[type="button"]',
    );
    expect(submitButton).not.toBeNull();
    expect(submitButton).toBeDisabled();
    expect(submitButton?.className).toMatch(/\bh-11\b/);
  });
});
