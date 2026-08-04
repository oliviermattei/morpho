import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BmiCard } from "./BmiCard";

// Design (docs/designs/s04-profile-height-bmi.md, §States, "Vide"):
// exactly the /profil empty state — no accueil concerns here (R9).
describe("BmiCard — no height (empty state)", () => {
  it('shows the "Pas encore d\'IMC" invitation, with no BMI number anywhere', () => {
    render(<BmiCard heightCm={null} latestWeighIn={null} />);

    expect(screen.getByText("Pas encore d'IMC")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Votre IMC apparaîtra ici dès que votre taille sera enregistrée.",
      ),
    ).toBeInTheDocument();
  });

  it("renders no button in the empty state — the action is the field above", () => {
    render(<BmiCard heightCm={null} latestWeighIn={null} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  // Review finding 4: the height IS set here, so "Votre IMC apparaîtra
  // ici dès que votre taille sera enregistrée" would contradict the
  // field just above it. Design (docs/designs/s04…:116, "Vide — aucune
  // session avec poids") says there is simply no card in this case — the
  // height changes nothing about that.
  it("renders no card at all when the height is set but no weigh-in exists yet", () => {
    const { container } = render(
      <BmiCard heightCm={175} latestWeighIn={null} />,
    );

    expect(screen.queryByText("Pas encore d'IMC")).toBeNull();
    expect(
      screen.queryByText(
        "Votre IMC apparaîtra ici dès que votre taille sera enregistrée.",
      ),
    ).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BmiCard — value state (design §A3)", () => {
  it("shows the current BMI, the weight and date it comes from, and the recalculated session count", () => {
    render(
      <BmiCard
        heightCm={175}
        latestWeighIn={{
          weightKg: 72.4,
          measuredOn: "2026-08-02",
          sessionsWithWeightCount: 14,
        }}
      />,
    );

    expect(screen.getByText("IMC actuel")).toBeInTheDocument();
    expect(screen.getByText("23,6")).toBeInTheDocument();
    expect(screen.getByText(/d'après 72,4 kg/)).toBeInTheDocument();
    expect(screen.getByText(/dimanche 2 août 2026/)).toBeInTheDocument();
    expect(
      screen.getByText("Recalculé sur vos 14 sessions."),
    ).toBeInTheDocument();
  });

  // Criterion 5: same weigh-in, two different heights -> two different
  // BMI values, without any write — computeBmi/formatBmi are the only
  // source (research trap 6).
  it("shows a different BMI when the height changes, for the same weigh-in", () => {
    const { rerender } = render(
      <BmiCard
        heightCm={175}
        latestWeighIn={{
          weightKg: 72.4,
          measuredOn: "2026-08-02",
          sessionsWithWeightCount: 14,
        }}
      />,
    );
    const firstBmi = screen.getByText("23,6");
    expect(firstBmi).toBeInTheDocument();

    rerender(
      <BmiCard
        heightCm={178}
        latestWeighIn={{
          weightKg: 72.4,
          measuredOn: "2026-08-02",
          sessionsWithWeightCount: 14,
        }}
      />,
    );

    expect(screen.queryByText("23,6")).toBeNull();
    expect(screen.getByText("22,9")).toBeInTheDocument();
  });

  it("never renders a classification, threshold or progression color — a number only", () => {
    render(
      <BmiCard
        heightCm={175}
        latestWeighIn={{
          weightKg: 72.4,
          measuredOn: "2026-08-02",
          sessionsWithWeightCount: 14,
        }}
      />,
    );

    for (const forbidden of [
      "surpoids",
      "obésité",
      "obesite",
      "insuffisance",
      "normal",
    ]) {
      expect(screen.queryByText(new RegExp(forbidden, "i"))).toBeNull();
    }
  });
});
