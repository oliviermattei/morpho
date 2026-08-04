import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SessionHistorySkeleton } from "./SessionHistorySkeleton";

// Design (docs/designs/s03-log-measurement-session.md, état 5): "Trois
// Skeleton à la forme d'un Item (une barre de titre + deux lignes de
// valeurs)" — never a full-screen spinner (design-system.md, cold start
// Neon ~500ms).
describe("SessionHistorySkeleton", () => {
  it("renders exactly three Item-shaped blocks, each with a title bar and two value lines", () => {
    const { container } = render(<SessionHistorySkeleton />);

    const blocks = container.querySelectorAll('[data-slot="history-skeleton-item"]');
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      expect(block.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    }
  });

  it("is hidden from the accessibility tree — it carries no real content", () => {
    const { container } = render(<SessionHistorySkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
