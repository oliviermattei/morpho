import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Plan task 3: MeasurementSessionFormLoader is the one place on /saisie's
// read path that touches the database — its own module, not an inline
// closure inside a <Suspense>, so a test can call it directly:
// `await MeasurementSessionFormLoader({ userId })`, the same motif
// src/components/SessionHistory.tsx and ProfileContent.tsx already
// establish. A Server Component wrapped in <Suspense> is never resolved
// by Testing Library's render() (React doesn't await an async child on
// the client) — this extraction is what makes it exercisable at all.
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { getLatestValueByKindMock } = vi.hoisted(() => ({
  getLatestValueByKindMock: vi.fn(),
}));
vi.mock("@/lib/db/latest-measurements", () => ({
  getLatestValueByKind: getLatestValueByKindMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const DB_STUB = { __stub: "db" };

describe("MeasurementSessionFormLoader", () => {
  it("reads with getDb() and getLatestValueByKind(db, userId), then renders the form prefilled with the result", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getLatestValueByKindMock.mockResolvedValue({
      weight_kg: 82.4,
      biceps_cm: 34.5,
    });
    const { MeasurementSessionFormLoader } = await import(
      "./MeasurementSessionFormLoader"
    );

    const element = await MeasurementSessionFormLoader({ userId: "user-1" });
    render(element);

    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(getLatestValueByKindMock).toHaveBeenCalledWith(DB_STUB, "user-1");
    expect(screen.getByLabelText("Poids (kg)")).toHaveValue("82,4");
    expect(screen.getByLabelText("Biceps")).toHaveValue("34,5");
  });

  it("renders the other fields empty when getLatestValueByKind returns no value for them", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getLatestValueByKindMock.mockResolvedValue({ weight_kg: 82.4 });
    const { MeasurementSessionFormLoader } = await import(
      "./MeasurementSessionFormLoader"
    );

    const element = await MeasurementSessionFormLoader({ userId: "user-1" });
    render(element);

    expect(screen.getByLabelText("Taille")).toHaveValue("");
  });

  // Plan task 8, decision N9: a read failure is a comfort lost, not a
  // blocking error — no error boundary exists on /saisie, so an unwrapped
  // throw here would take the whole form down with it. The loader must
  // swallow it and hand the form an empty, fully usable state instead.
  it("never lets a read failure escape the Suspense boundary: the form renders empty and usable", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getLatestValueByKindMock.mockRejectedValue(new Error("connection reset"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { MeasurementSessionFormLoader } = await import(
      "./MeasurementSessionFormLoader"
    );

    const element = await MeasurementSessionFormLoader({ userId: "user-1" });
    render(element);

    expect(
      screen.getByText(
        "Vos dernières valeurs n'ont pas pu être chargées. Vous pouvez saisir directement.",
      ),
    ).toBeInTheDocument();
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;
    expect(weightInput.value).toBe("");
    expect(weightInput).not.toBeDisabled();
    expect(weightInput).not.toHaveAttribute("data-prefilled");

    consoleErrorSpy.mockRestore();
  });
});
