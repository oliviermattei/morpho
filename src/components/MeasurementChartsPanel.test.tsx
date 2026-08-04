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

// Plan task 6, one of the two named acceptance-critical checks: the
// selector must never repeat a hardcoded copy of the catalog. Overriding
// one label at the module level and observing the rendered trigger
// change is the only proof that isn't circumstantial.
describe("MeasurementChartsPanel — labels are read from measurements.ts, never recopied", () => {
  it("a label changed in MEASUREMENT_CATALOG changes what the selector shows", async () => {
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

    expect(screen.getByText("Poids-test")).toBeInTheDocument();
    expect(screen.queryByText("Poids")).toBeNull();

    vi.doUnmock("@/lib/measurements");
    vi.resetModules();
  });
});

describe("MeasurementChartsPanel — empty states", () => {
  it("no session at all: title, description, action, and the selector is disabled", () => {
    render(
      <MeasurementChartsPanel seriesByKind={emptySeriesByKind()} bmi={NO_BMI} targetWeightKg={null} />,
    );

    expect(screen.getByText("Aucune session enregistrée")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Saisir ma première session" }),
    ).toHaveAttribute("href", "/saisie");
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("a measure never recorded, with other sessions existing: title, description, action, and the selector STAYS active", () => {
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          chest_cm: [{ t: Date.UTC(2026, 0, 1), value: 100 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={null}
      />,
    );

    // Default selection is weight_kg, which has no data here.
    expect(screen.getByText("Aucune mesure de poids")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Saisir une session" }),
    ).toHaveAttribute("href", "/saisie");
    expect(screen.getByRole("combobox")).not.toBeDisabled();
  });

  it("IMC without a reference height: the distinct title, description and action — never the generic 'no data' message", async () => {
    const user = userEvent.setup();
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={{ status: "heightMissing" }}
        targetWeightKg={null}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "IMC" }));

    expect(screen.getByText("Taille non renseignée")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Renseigner ma taille" }),
    ).toHaveAttribute("href", "/profil");
    expect(screen.queryByText(/Aucune mesure/)).toBeNull();
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

describe("MeasurementChartsPanel — switching measure never triggers a network call", () => {
  it("changing the selected measure swaps the series without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
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

    expect(screen.getByText("75 kg")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Poitrine" }));

    expect(screen.queryByText("75 kg")).toBeNull();
    expect(screen.getByText("101 cm")).toBeInTheDocument();
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

describe("MeasurementChartsPanel — the select's two groups", () => {
  it("shows all 11 options, split into 'Poids et indices' and 'Mensurations'", async () => {
    const user = userEvent.setup();
    render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 0, 1), value: 74 }],
        })}
        bmi={{ status: "ok", series: [] }}
        targetWeightKg={null}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(11);
    expect(within(listbox).getByText("Poids et indices")).toBeInTheDocument();
    expect(within(listbox).getByText("Mensurations")).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "IMC" })).toBeInTheDocument();
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
  it("(a) a target is set, but another measure is selected: no row, no reference line", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
          chest_cm: [{ t: Date.UTC(2026, 2, 30), value: 100 }],
        })}
        bmi={NO_BMI}
        targetWeightKg={72}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Poitrine" }));

    expect(screen.queryByText(/Cible/)).toBeNull();
    expect(screen.queryByText(/écart/)).toBeNull();
    expect(container.querySelector(".recharts-reference-line")).toBeNull();
  });

  // Criterion 5 by name: the target induces a BMI mechanically (a
  // lower weight lowers the BMI too), which makes this the exact
  // "logical" addition an agent could make spontaneously — forbidden.
  it("(a) a target is set, but IMC is selected: no row, no reference line, even though it derives from weight", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MeasurementChartsPanel
        seriesByKind={emptySeriesByKind({
          weight_kg: [{ t: Date.UTC(2026, 2, 30), value: 74.1 }],
        })}
        bmi={{ status: "ok", series: [{ t: Date.UTC(2026, 2, 30), value: 23.6 }] }}
        targetWeightKg={72}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "IMC" }));

    expect(screen.queryByText(/Cible/)).toBeNull();
    expect(screen.queryByText(/écart/)).toBeNull();
    expect(container.querySelector(".recharts-reference-line")).toBeNull();
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
