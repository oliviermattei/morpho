import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Plan task 8/9: ProfileContent is the one place on /profil's read path
// that touches the database — its own module, not an inline closure
// inside a <Suspense>, so a test can call it directly:
// `await ProfileContent({ userId })`, the same motif
// src/components/SessionHistory.tsx already established. A Server
// Component wrapped in <Suspense> is never resolved by Testing Library's
// render() (React doesn't await an async child on the client).
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getProfile: getProfileMock }));

const { getLatestWeighInMock } = vi.hoisted(() => ({
  getLatestWeighInMock: vi.fn(),
}));
vi.mock("@/lib/measurement-sessions", () => ({
  getLatestWeighIn: getLatestWeighInMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const DB_STUB = { __stub: "db" };

describe("ProfileContent", () => {
  it("reads with getDb(), getProfile(db, userId) and getLatestWeighIn(db, userId), then renders HeightForm and BmiCard", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getProfileMock.mockResolvedValue({
      userId: "user-1",
      heightCm: 175,
      targetWeightKg: 72,
    });
    getLatestWeighInMock.mockResolvedValue({
      weightKg: 72.4,
      measuredOn: "2026-08-02",
      sessionsWithWeightCount: 14,
    });
    const { ProfileContent } = await import("./ProfileContent");

    const element = await ProfileContent({ userId: "user-1" });
    render(element);

    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(getProfileMock).toHaveBeenCalledWith(DB_STUB, "user-1");
    expect(getLatestWeighInMock).toHaveBeenCalledWith(DB_STUB, "user-1");
    expect(screen.getByLabelText("Taille (cm)")).toHaveValue("175");
    expect(screen.getByText("23,6")).toBeInTheDocument();
  });

  it("passes null to HeightForm and BmiCard when the profile has no height yet", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getProfileMock.mockResolvedValue(null);
    getLatestWeighInMock.mockResolvedValue(null);
    const { ProfileContent } = await import("./ProfileContent");

    const element = await ProfileContent({ userId: "user-1" });
    render(element);

    expect(screen.getByLabelText("Taille (cm)")).toHaveValue("");
    expect(screen.getByText("Pas encore d'IMC")).toBeInTheDocument();
  });

  // s08 task 6: the target field is read from the same profile row —
  // no second query.
  it("passes the persisted target weight to the target field", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getProfileMock.mockResolvedValue({
      userId: "user-1",
      heightCm: null,
      targetWeightKg: 72.5,
    });
    getLatestWeighInMock.mockResolvedValue(null);
    const { ProfileContent } = await import("./ProfileContent");

    const element = await ProfileContent({ userId: "user-1" });
    render(element);

    expect(screen.getByLabelText("Poids cible (kg)")).toHaveValue("72,5");
  });

  it("renders an empty target field when the profile has no target yet", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getProfileMock.mockResolvedValue(null);
    getLatestWeighInMock.mockResolvedValue(null);
    const { ProfileContent } = await import("./ProfileContent");

    const element = await ProfileContent({ userId: "user-1" });
    render(element);

    expect(screen.getByLabelText("Poids cible (kg)")).toHaveValue("");
  });
});
