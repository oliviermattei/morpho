import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// Plan task 6: SessionHistory is the one place on the read path that
// touches the database — isolated in its own module precisely so a test
// can call it directly, the way src/app/page.test.tsx already calls
// `await Home()`. A Server Component wrapped in <Suspense> is never
// resolved by Testing Library's render() (React doesn't await an async
// child on the client) — hence this direct-call pattern instead.
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

const { listMeasurementSessionsMock } = vi.hoisted(() => ({
  listMeasurementSessionsMock: vi.fn(),
}));
vi.mock("@/lib/measurement-sessions", () => ({
  listMeasurementSessions: listMeasurementSessionsMock,
}));

// Task 9: the IMC suffix needs the profile's height alongside the
// sessions — SessionHistory is where both reads meet.
const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getProfile: getProfileMock }));

describe("SessionHistory", () => {
  // Also the page → component level of plan task 8's three-level isolation
  // proof (criterion 7): listMeasurementSessions is spied here and must
  // receive exactly the userId this component was given — never a
  // different or default one.
  it("reads with getDb() and listMeasurementSessions(db, userId), then renders the result", async () => {
    const dbStub = { __stub: "db" };
    getDbMock.mockReturnValue(dbStub);
    listMeasurementSessionsMock.mockResolvedValue([
      {
        id: "s1",
        measuredOn: "2026-08-02",
        measurements: [{ kind: "weight_kg", value: 82.4 }],
      },
    ]);
    getProfileMock.mockResolvedValue(null);
    const { SessionHistory } = await import("./SessionHistory");

    const element = await SessionHistory({ userId: "user-1" });
    render(element);

    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(listMeasurementSessionsMock).toHaveBeenCalledWith(
      dbStub,
      "user-1",
    );
    expect(screen.getByText("dimanche 2 août 2026")).toBeInTheDocument();
    expect(screen.getByText("82,4 kg")).toBeInTheDocument();
  });

  it("renders the empty state when there are no sessions", async () => {
    getDbMock.mockReturnValue({});
    listMeasurementSessionsMock.mockResolvedValue([]);
    getProfileMock.mockResolvedValue(null);
    const { SessionHistory } = await import("./SessionHistory");

    const element = await SessionHistory({ userId: "user-1" });
    render(element);

    expect(
      screen.getByText("Aucune session enregistrée"),
    ).toBeInTheDocument();
  });

  // Task 9: the height feeds the IMC suffix on the weight-carrying line.
  it("reads the profile's height and renders the IMC suffix on a session with a weight", async () => {
    const dbStub = { __stub: "db" };
    getDbMock.mockReturnValue(dbStub);
    listMeasurementSessionsMock.mockResolvedValue([
      {
        id: "s1",
        measuredOn: "2026-08-02",
        measurements: [{ kind: "weight_kg", value: 72.4 }],
      },
    ]);
    getProfileMock.mockResolvedValue({ userId: "user-1", heightCm: 175 });
    const { SessionHistory } = await import("./SessionHistory");

    const element = await SessionHistory({ userId: "user-1" });
    render(element);

    expect(getProfileMock).toHaveBeenCalledWith(dbStub, "user-1");
    expect(screen.getByText(/IMC 23,6/)).toBeInTheDocument();
  });

  it("renders no IMC at all when the profile has no height", async () => {
    getDbMock.mockReturnValue({});
    listMeasurementSessionsMock.mockResolvedValue([
      {
        id: "s1",
        measuredOn: "2026-08-02",
        measurements: [{ kind: "weight_kg", value: 72.4 }],
      },
    ]);
    getProfileMock.mockResolvedValue(null);
    const { SessionHistory } = await import("./SessionHistory");

    const element = await SessionHistory({ userId: "user-1" });
    render(element);

    expect(screen.queryByText(/IMC/)).toBeNull();
  });
});
