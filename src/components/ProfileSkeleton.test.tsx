import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProfileSkeleton } from "./ProfileSkeleton";

// Design (docs/designs/s04-profile-height-bmi.md, état "Chargement — cold
// start ~500 ms"): "une barre de libellé, une barre de champ, un bloc de
// carte" — never a full-screen spinner (design-system.md §États).
describe("ProfileSkeleton", () => {
  it("renders at least a label bar, a field bar and a card block", () => {
    const { container } = render(<ProfileSkeleton />);

    const blocks = container.querySelectorAll('[data-slot="skeleton"]');
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it("is hidden from the accessibility tree — it carries no real content", () => {
    const { container } = render(<ProfileSkeleton />);

    expect(container.firstElementChild).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
