import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SessionHistoryList } from "./SessionHistoryList";

describe("SessionHistoryList — empty state", () => {
  it("renders Empty with its action, pointing to /saisie, at h-11", () => {
    render(<SessionHistoryList sessions={[]} heightCm={null} />);

    expect(
      screen.getByText("Aucune session enregistrée"),
    ).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Saisir mes mesures" });
    expect(action).toHaveAttribute("href", "/saisie");
    expect(action.className).toMatch(/\bh-11\b/);
  });
});

describe("SessionHistoryList — filled state (criterion 6)", () => {
  it("renders sessions in the order given, most recent first", () => {
    render(
      <SessionHistoryList
        heightCm={null}
        sessions={[
          {
            id: "newer",
            measuredOn: "2026-08-02",
            measurements: [{ kind: "weight_kg", value: 82.4 }],
          },
          {
            id: "older",
            measuredOn: "2026-07-01",
            measurements: [{ kind: "weight_kg", value: 83.1 }],
          },
        ]}
      />,
    );

    const items = document.querySelectorAll('[data-slot="item"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("dimanche 2 août 2026");
    expect(items[1]?.textContent).toContain("mercredi 1 juillet 2026");
  });

  it("renders exactly one measurement line for a weight-only session", () => {
    render(
      <SessionHistoryList
        heightCm={null}
        sessions={[
          {
            id: "s1",
            measuredOn: "2026-08-02",
            measurements: [{ kind: "weight_kg", value: 82.4 }],
          },
        ]}
      />,
    );

    const item = document.querySelector('[data-slot="item"]');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText("Poids")).toBeInTheDocument();
    expect(
      within(item as HTMLElement).getByText("82,4 kg"),
    ).toBeInTheDocument();
    expect(item?.textContent).not.toContain("Épaules");
  });

  it("renders every recorded measurement, each with its French label and formatted value", () => {
    render(
      <SessionHistoryList
        heightCm={null}
        sessions={[
          {
            id: "s1",
            measuredOn: "2026-08-02",
            measurements: [
              { kind: "weight_kg", value: 82.4 },
              { kind: "shoulders_cm", value: 118 },
              { kind: "body_fat_pct", value: 18.5 },
            ],
          },
        ]}
      />,
    );

    const item = document.querySelector('[data-slot="item"]') as HTMLElement;
    expect(within(item).getByText("Poids")).toBeInTheDocument();
    expect(within(item).getByText("82,4 kg")).toBeInTheDocument();
    expect(within(item).getByText("Épaules")).toBeInTheDocument();
    expect(within(item).getByText("118 cm")).toBeInTheDocument();
    expect(within(item).getByText("Masse grasse")).toBeInTheDocument();
    expect(within(item).getByText("18,5 %")).toBeInTheDocument();
  });
});

// Design §B, rule 1 and 4: the IMC suffix (task 9). Only a session that
// carries a weight, and only once a height is known.
describe("SessionHistoryList — the IMC suffix (task 9)", () => {
  const sessionsWithWeight = [
    {
      id: "s1",
      measuredOn: "2026-08-02",
      measurements: [{ kind: "weight_kg" as const, value: 72.4 }],
    },
    {
      id: "s2",
      measuredOn: "2026-07-20",
      measurements: [{ kind: "weight_kg" as const, value: 70 }],
    },
    {
      id: "s3",
      measuredOn: "2026-07-05",
      measurements: [{ kind: "biceps_cm" as const, value: 34 }],
    },
  ];

  it("shows no IMC anywhere when the height is unknown, even for a session with a weight", () => {
    render(<SessionHistoryList sessions={sessionsWithWeight} heightCm={null} />);

    expect(screen.queryByText(/IMC/)).toBeNull();
  });

  it("shows the IMC suffix only on the lines that carry a weight", () => {
    render(<SessionHistoryList sessions={sessionsWithWeight} heightCm={175} />);

    const items = document.querySelectorAll('[data-slot="item"]');
    expect(items[0]?.textContent).toMatch(/IMC 23,6/);
    expect(items[1]?.textContent).toMatch(/IMC 22,9/);
    expect(items[2]?.textContent).not.toMatch(/IMC/);
  });

  // "vide ≠ zéro" for the derived value too: no dash, no zero, no NaN on
  // a weightless session, even with a height known.
  it("renders nothing that looks like a dash, a zero, or NaN on a weightless session", () => {
    render(
      <SessionHistoryList
        heightCm={175}
        sessions={[
          {
            id: "s1",
            measuredOn: "2026-07-05",
            measurements: [{ kind: "biceps_cm", value: 34 }],
          },
        ]}
      />,
    );

    const item = document.querySelector('[data-slot="item"]');
    expect(item?.textContent).not.toContain("—");
    expect(item?.textContent).not.toMatch(/IMC\s*0\b/);
    expect(item?.textContent).not.toMatch(/NaN/);
    expect(item?.textContent).not.toMatch(/IMC/);
  });

  // Criterion 5, at the history-list level: changing the reference
  // height changes the BMI on at least two prior sessions, with no write
  // — the same computeBmi call, fed a different heightCm.
  it("recomputes a different IMC on at least two prior sessions when the height changes (criterion 5)", () => {
    const { unmount } = render(
      <SessionHistoryList sessions={sessionsWithWeight} heightCm={175} />,
    );
    const before = Array.from(
      document.querySelectorAll('[data-slot="item"]'),
    ).map((item) => item.textContent);
    unmount();

    render(<SessionHistoryList sessions={sessionsWithWeight} heightCm={178} />);
    const after = Array.from(
      document.querySelectorAll('[data-slot="item"]'),
    ).map((item) => item.textContent);

    // s1 and s2 both carry a weight — both must have changed.
    expect(before[0]).not.toBe(after[0]);
    expect(before[1]).not.toBe(after[1]);
  });
});

// s09 plan task 9, R9/D1: each row opens the edit screen — a Link
// wrapping the whole Item (asChild), "Modifier" as plain text (never a
// nested interactive control: no second AlertDialog trigger, no
// ItemActions button, which would force this Server Component client).
describe("SessionHistoryList — openable rows (s09 task 9)", () => {
  const sessions = [
    {
      id: "session-1",
      measuredOn: "2026-08-02",
      measurements: [{ kind: "weight_kg" as const, value: 82.4 }],
    },
  ];

  it("wraps each row in a link to its edit screen", () => {
    render(<SessionHistoryList sessions={sessions} heightCm={null} />);

    const link = screen.getByRole("link", {
      name: /dimanche 2 août 2026/,
    });
    expect(link).toHaveAttribute("href", "/historique/session-1");
  });

  it('shows "Modifier" as plain text next to the title, never inside a second interactive element', () => {
    render(<SessionHistoryList sessions={sessions} heightCm={null} />);

    const item = document.querySelector('[data-slot="item"]') as HTMLElement;
    expect(within(item).getByText("Modifier")).toBeInTheDocument();
    // asChild merges the Link's own <a> into the Item's root node — the
    // whole row IS the single link, never a second one nested inside it.
    expect(item.tagName).toBe("A");
    expect(item.querySelectorAll("a")).toHaveLength(0);
    expect(item.querySelectorAll("button")).toHaveLength(0);
  });

  it("stays a Server Component — no client boundary leaks up from this file", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "SessionHistoryList.tsx"),
      "utf8",
    );
    expect(source).not.toContain('"use client"');
  });
});
