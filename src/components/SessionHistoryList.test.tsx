import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// s09 plan task 9, R9/D1, amended by ADR 021: each row still opens the
// edit screen and "Modifier" is still gone, but the row is no longer an
// Item-as-Link — it now also carries a share button, so the link is
// stretched and the two controls sit side by side. What R9 refused is
// unchanged: no destructive control here, and no client boundary on this
// file (the share button is a leaf island of its own).
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

  it("nests neither control inside the other — one link, one share button, side by side", () => {
    render(<SessionHistoryList sessions={sessions} heightCm={null} />);

    const item = document.querySelector('[data-slot="item"]') as HTMLElement;
    // The word "Modifier" is gone; a chevron carries the affordance now,
    // and it is decorative (aria-hidden), so the row's accessible name
    // stays the session's date alone.
    expect(within(item).queryByText("Modifier")).toBeNull();

    // ADR 021: the row is no longer `<Item asChild>` around a Link — a
    // <button> inside an <a> is invalid HTML. Exactly one of each, and
    // neither contains the other.
    const links = item.querySelectorAll("a");
    const buttons = item.querySelectorAll("button");
    expect(item.tagName).toBe("DIV");
    expect(links).toHaveLength(1);
    expect(buttons).toHaveLength(1);
    expect(links[0]?.contains(buttons[0] as Node)).toBe(false);
    expect(buttons[0]?.contains(links[0] as Node)).toBe(false);
  });

  // The whole card stays tappable even though the <a> now wraps only the
  // date: a stretched ::after over the positioned Item is what carries
  // it. Asserted on the classes, since jsdom computes no layout.
  it("stretches the link over the whole positioned row", () => {
    render(<SessionHistoryList sessions={sessions} heightCm={null} />);

    const item = document.querySelector('[data-slot="item"]') as HTMLElement;
    expect(item.className).toMatch(/\brelative\b/);
    const link = within(item).getByRole("link", {
      name: /dimanche 2 août 2026/,
    });
    expect(link.className).toMatch(/after:absolute/);
    expect(link.className).toMatch(/after:inset-0/);
  });

  it("stays a Server Component — no client boundary leaks up from this file", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "SessionHistoryList.tsx"),
      "utf8",
    );
    expect(source).not.toContain('"use client"');
  });
});

// ADR 021: one share control per session, naming its own session — with
// several rows on screen, "Partager" alone would give every button the
// same accessible name.
describe("SessionHistoryList — sharing a session (ADR 021)", () => {
  const sessions = [
    {
      id: "session-1",
      measuredOn: "2026-08-02",
      measurements: [{ kind: "weight_kg" as const, value: 82.4 }],
    },
    {
      id: "session-2",
      measuredOn: "2026-07-01",
      measurements: [{ kind: "biceps_cm" as const, value: 34 }],
    },
  ];

  it("gives every row a share button named after its own date", () => {
    render(<SessionHistoryList sessions={sessions} heightCm={null} />);

    expect(
      screen.getByRole("button", {
        name: "Partager la session du dimanche 2 août 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Partager la session du mercredi 1 juillet 2026",
      }),
    ).toBeInTheDocument();
  });

  // The shared text is built server-side from the very row being
  // rendered — including the IMC, which only exists once a height is
  // known. Read back through the button's own click, the one path a user
  // has to it.
  it("shares exactly the values the row displays, IMC included", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Defined on the real navigator rather than through vi.stubGlobal:
    // jsdom ships no `clipboard` at all, and replacing the whole
    // navigator object would take the rest of the DOM's own with it.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <SessionHistoryList
        heightCm={175}
        sessions={[
          {
            id: "session-1",
            measuredOn: "2026-08-02",
            measurements: [
              { kind: "weight_kg", value: 72.4 },
              { kind: "biceps_cm", value: 34 },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Partager la session du dimanche 2 août 2026",
      }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        [
          "Mesures du dimanche 2 août 2026",
          "Poids : 72,4 kg",
          "Biceps : 34 cm",
          "IMC : 23,6",
        ].join("\n"),
      );
    });

    Reflect.deleteProperty(navigator, "clipboard");
  });
});
