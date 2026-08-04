import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementChartsPanel } from "./MeasurementChartsPanel";
import { MEASUREMENT_CATALOG } from "@/lib/measurements";
import type { BmiSeriesResult } from "@/lib/db/measurement-series";
import type { SeriesPoint } from "@/lib/measurement-series";
import type { MeasurementKind } from "@/lib/measurements";

function emptySeriesByKind(
  overrides: Partial<Record<MeasurementKind, SeriesPoint[]>> = {},
): Record<MeasurementKind, SeriesPoint[]> {
  const base = Object.fromEntries(
    MEASUREMENT_CATALOG.map(
      (entry): [MeasurementKind, SeriesPoint[]] => [entry.kind, []],
    ),
  ) as unknown as Record<MeasurementKind, SeriesPoint[]>;
  return { ...base, ...overrides };
}

const NO_BMI: BmiSeriesResult = { status: "heightMissing" };

/**
 * The panel no longer has a selector: every measure is on screen at
 * once — four in the "Poids et indices" carousel, seven stacked under
 * "Mensurations". So an assertion about ONE measure has to be scoped to
 * its own card, or it would match another card's copy of the same text
 * ("Dernière valeur" now appears eleven times).
 *
 * Each card is identified by its own <h3>, which carries the measure's
 * label straight from MEASUREMENT_CATALOG.
 */
function cardFor(label: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: label, level: 3 });
  const card = heading.closest('[data-slot="card"]');
  if (card === null) {
    throw new Error(`cardFor: no card wraps the "${label}" heading`);
  }
  return card as HTMLElement;
}

// Plan task 6, one of the two named acceptance-critical checks: the
// selector must never repeat a hardcoded copy of the catalog. Overriding
// one label at the module level and observing the rendered trigger
// change is the only proof that isn't circumstantial.
describe("MeasurementChartsPanel — labels are read from measurements.ts, never recopied", () => {
  it("a label changed in MEASUREMENT_CATALOG changes what the panel shows", async () => {
    vi.resetModules();
    vi.doMock("@/lib/measurements", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("@/lib/measurements")>();
      const patchedCatalog = actual.MEASUREMENT_CATALOG.map((entry) =>
        entry.kind === "weight_kg" ? { ...entry, label: "Poids-test" } : entry,
      );
      return { ...actual, MEASUREMENT_CATALOG: patchedCatalog };
    });

    const { MeasurementChartsPanel: PatchedPanel } = await import(
      "./MeasurementChartsPanel"
    );
    const weightSeries: SeriesPoint[] = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 76 },
    ];

    render(
      <PatchedPanel
        seriesByKind={emptySeriesByKind({ weight_kg: weightSeries })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    // Scoped to the card heading: the label legitimately appears more
    // than once now (the card title, and the live region announcing the
    // current carousel slide), so a bare getByText would be ambiguous.
    expect(
      screen.getByRole("heading", { name: "Poids-test", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Poids", level: 3 }),
    ).toBeNull();

    vi.doUnmock("@/lib/measurements");
    vi.resetModules();
  });
});

describe("MeasurementChartsPanel — empty states", () => {
  it("no session at all: one invitation, and not a single measure card", () => {
    render(
      <MeasurementChartsPanel seriesByKind={emptySeriesByKind()} bmi={NO_BMI} targetWeightKg={null} />,
    );

    expect(screen.getByText("Aucune session enregistrée")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Saisir ma première session" }),
    ).toHaveAttribute("href", "/saisie");
    // "No session at all" is one fact about the account: it is stated
    // once, instead of eleven cards each repeating their own empty state.
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("a measure never recorded, with other sessions existing: that card alone shows its empty state", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          chest_cm: [{ t: Date.UTC(2026, 0, 1), value: 100 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    // The weight has no data here; the chest does, and both cards are on
    // screen at the same time — so the empty state is asserted inside the
    // weight's own card, not globally.
    const weightCard = cardFor("Poids");
    expect(
      within(weightCard).getByText("Aucune mesure de poids"),
    ).toBeInTheDocument();
    expect(
      within(weightCard).getByRole("link", { name: "Saisir une session" }),
    ).toHaveAttribute("href", "/saisie");
    // The chest card is unaffected and shows its value.
    expect(within(cardFor("Poitrine")).getByText("100 cm")).toBeInTheDocument();
  });

  it("IMC without a reference height: the distinct title, description and action — never the generic 'no data' message", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={{ status: "heightMissing" }}
        targetWeightKg={null}
      />,
    );

    // No selection step any more — the IMC card is simply on screen.
    const bmiCard = cardFor("IMC");
    expect(
      within(bmiCard).getByText("Taille non renseignée"),
    ).toBeInTheDocument();
    expect(
      within(bmiCard).getByRole("link", { name: "Renseigner ma taille" }),
    ).toHaveAttribute("href", "/profil");
    expect(within(bmiCard).queryByText(/Aucune mesure/)).toBeNull();
  });
});

describe("MeasurementChartsPanel — legend counts", () => {
  it("a complete series (every session carries this measure): 'N mesures.', no 'sur M sessions'", () => {
    const series: SeriesPoint[] = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 75 },
      { t: Date.UTC(2026, 2, 1), value: 76 },
    ];
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({ weight_kg: series })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    expect(screen.getByText(/— 3 mesures\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/sur \d+ sessions/)).toBeNull();
  });

  it("a sparse series (some sessions never carried this measure): 'N mesures sur M sessions.'", () => {
    const weightSeries: SeriesPoint[] = [
      { t: Date.UTC(2026, 0, 1), value: 74 },
      { t: Date.UTC(2026, 1, 1), value: 75 },
    ];
    // A third, distinct session date that never recorded weight.
    const chestSeries: SeriesPoint[] = [
      { t: Date.UTC(2026, 2, 1), value: 100 },
    ];
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: weightSeries,
          chest_cm: chestSeries,
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    expect(screen.getByText(/— 2 mesures sur 3 sessions\.$/)).toBeInTheDocument();
  });

  it("a single point: the dedicated message, not a count", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    expect(
      screen.getByText(
        "Une seule mesure enregistrée : pas encore de tendance à lire.",
      ),
    ).toBeInTheDocument();
  });
});

describe("MeasurementChartsPanel — reading another measure never triggers a network call", () => {
  it("renders every measure's series from the props alone, without calling fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [
            { t: Date.UTC(2026, 0, 1), value: 74 },
            { t: Date.UTC(2026, 1, 1), value: 75 },
          ],
          chest_cm: [
            { t: Date.UTC(2026, 0, 1), value: 100 },
            { t: Date.UTC(2026, 1, 1), value: 101 },
          ],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    // R7 unchanged, and now stronger: both series are rendered from the
    // single page-load query, at the same time. There is no selection
    // left that could have fetched anything.
    expect(within(cardFor("Poids")).getByText("75 kg")).toBeInTheDocument();
    expect(within(cardFor("Poitrine")).getByText("101 cm")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("MeasurementChartsPanel — the header block ('Dernière valeur')", () => {
  it("shows the last point's formatted value and full date", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [
            { t: Date.UTC(2026, 0, 1), value: 74 },
            { t: Date.UTC(2026, 2, 30), value: 74.1 },
          ],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    expect(screen.getByText("Dernière valeur")).toBeInTheDocument();
    expect(screen.getByText("74,1 kg")).toBeInTheDocument();
    expect(screen.getByText("30 mars 2026")).toBeInTheDocument();
  });
});

describe("MeasurementChartsPanel — the two sections", () => {
  it("shows all 11 measures, split into 'Poids et indices' and 'Mensurations'", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={{ status: "ok", series: [] }}
        targetWeightKg={null}
      />,
    );

    // The same 11 measures the selector used to list, now all rendered:
    // 4 in the carousel, 7 stacked below it.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(11);

    const carousel = screen.getByRole("region", { name: "Poids et indices" });
    expect(within(carousel).getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(within(carousel).getByRole("heading", { name: "IMC" })).toBeInTheDocument();

    const mensurations = screen.getByRole("region", { name: "Mensurations" });
    expect(
      within(mensurations).getAllByRole("heading", { level: 3 }),
    ).toHaveLength(7);
  });

  it("opens on the weight — the measure the page is primarily about", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={{ status: "ok", series: [] }}
        targetWeightKg={null}
      />,
    );

    const carousel = screen.getByRole("region", { name: "Poids et indices" });
    const [first] = within(carousel).getAllByRole("heading", { level: 3 });
    expect(first).toHaveTextContent("Poids");
    // And the position indicator agrees it is the current slide.
    expect(
      within(carousel).getByRole("button", { name: "Poids" }),
    ).toHaveAttribute("aria-current", "true");
  });
});

// s08 task 7: the target row and the reference line, on the weight
// series only.
describe("MeasurementChartsPanel — target weight row and reference line (s08 task 7)", () => {
  it("shows the target and the signed gap when a target is set and weight is selected", () => {
    const { container } = render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={72}
      />,
    );

    // "Cible 72 kg" appears twice by design: once in the row (chiffré),
    // once as the reference line's own label inside the chart.
    expect(screen.getAllByText(/Cible 72 kg/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/écart \+2,1 kg/)).toBeInTheDocument();
    expect(container.querySelector(".recharts-reference-line")).not.toBeNull();
  });

  it('shows "Cible atteinte." when the rounded gap is exactly 0, and the gap reads 0,0 kg (never -0,0 kg)', () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 70 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={70}
      />,
    );

    expect(screen.getByText(/écart 0,0 kg/)).toBeInTheDocument();
    expect(screen.queryByText(/-0,0 kg/)).toBeNull();
    expect(screen.getByText("Cible atteinte.")).toBeInTheDocument();
  });

  it("renders no target row and no 'Cible atteinte.' note without a note when the target is not reached", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={72}
      />,
    );

    expect(screen.queryByText("Cible atteinte.")).toBeNull();
  });
});

// s08 task 8, the negative cases — "trap 9: it's the negative test that
// counts, not the one confirming presence on weight".
describe("MeasurementChartsPanel — target weight, the negative cases (s08 task 8)", () => {
  it("(a) a target is set, but on another measure's card: no row, no reference line", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
          chest_cm: [{ t: Date.UTC(2026, 2, 30), value: 100 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={72}
      />,
    );

    const chestCard = cardFor("Poitrine");
    expect(within(chestCard).queryByText(/Cible/)).toBeNull();
    expect(within(chestCard).queryByText(/écart/)).toBeNull();
    expect(chestCard.querySelector(".recharts-reference-line")).toBeNull();
  });

  // Criterion 5 by name: the target induces a BMI mechanically (a
  // lower weight lowers the BMI too), which makes this the exact
  // "logical" addition an agent could make spontaneously — forbidden.
  it("(a) a target is set, but on the IMC card: no row, no reference line, even though it derives from weight", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
        })}
        bmi={{ status: "ok", series: [{ t: Date.UTC(2026, 2, 30), value: 23.6 }] }}
        targetWeightKg={72}
      />,
    );

    const bmiCard = cardFor("IMC");
    expect(within(bmiCard).queryByText(/Cible/)).toBeNull();
    expect(within(bmiCard).queryByText(/écart/)).toBeNull();
    expect(bmiCard.querySelector(".recharts-reference-line")).toBeNull();
  });

  it("(b) no target at all: the rendered card is byte-for-byte s07's — no row, no reference line", () => {
    const { container } = render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [
            { t: Date.UTC(2026, 0, 1), value: 74 },
            { t: Date.UTC(2026, 1, 1), value: 76 },
          ],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    expect(screen.queryByText(/Cible/)).toBeNull();
    expect(screen.queryByText(/écart/)).toBeNull();
    expect(container.querySelector(".recharts-reference-line")).toBeNull();
  });

  it("(c) a target is set, but weight was never recorded: no row, no reference line, no crash on an absent last point", () => {
    const { container } = render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          chest_cm: [{ t: Date.UTC(2026, 0, 1), value: 100 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={72}
      />,
    );

    // Default selection is weight_kg — empty for this user.
    expect(screen.getByText("Aucune mesure de poids")).toBeInTheDocument();
    expect(screen.queryByText(/Cible/)).toBeNull();
    expect(screen.queryByText(/écart/)).toBeNull();
    expect(container.querySelector(".recharts-reference-line")).toBeNull();
  });
});
