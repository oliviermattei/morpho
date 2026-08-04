// @vitest-environment node
//
// Plan s06 task 3: getBodyMapData composes exactly three reads — the two
// boundary directions plus the profile — no direct access to `profiles`
// (getProfile is s04's function, called as-is) and no fourth read. Mocked
// here the same way src/components/MeasurementSessionFormLoader.test.tsx
// already does for the analogous s05 loader.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../db", () => ({ getDb: getDbMock }));

const { getBoundaryValuesByKindMock } = vi.hoisted(() => ({
  getBoundaryValuesByKindMock: vi.fn(),
}));
vi.mock("./latest-measurements", () => ({
  getBoundaryValuesByKind: getBoundaryValuesByKindMock,
}));

const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }));
vi.mock("../profile", () => ({ getProfile: getProfileMock }));

const DB_STUB = { __stub: "db" };

describe("getBodyMapData", () => {
  beforeEach(() => {
    getDbMock.mockClear();
    getBoundaryValuesByKindMock.mockClear();
    getProfileMock.mockClear();
  });

  it("calls getDb() once, then reads first, last and the profile with that db", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getBoundaryValuesByKindMock.mockImplementation(
      async (_db: unknown, _userId: string, direction: "first" | "last") =>
        direction === "first" ? { weight_kg: { measurementId: "m-first", value: 90 } } : { weight_kg: { measurementId: "m-last", value: 82.4 } },
    );
    getProfileMock.mockResolvedValue({ userId: "user-1", heightCm: 178 });
    const { getBodyMapData } = await import("./body-map");

    const result = await getBodyMapData("user-1");

    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(getBoundaryValuesByKindMock).toHaveBeenCalledWith(
      DB_STUB,
      "user-1",
      "first",
    );
    expect(getBoundaryValuesByKindMock).toHaveBeenCalledWith(
      DB_STUB,
      "user-1",
      "last",
    );
    expect(getProfileMock).toHaveBeenCalledWith(DB_STUB, "user-1");
    expect(result).toEqual({
      first: { weight_kg: { measurementId: "m-first", value: 90 } },
      last: { weight_kg: { measurementId: "m-last", value: 82.4 } },
      heightCm: 178,
    });
  });

  it("reads exactly three times — no accidental fourth read", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getBoundaryValuesByKindMock.mockResolvedValue({});
    getProfileMock.mockResolvedValue(null);
    const { getBodyMapData } = await import("./body-map");

    await getBodyMapData("user-1");

    expect(getBoundaryValuesByKindMock).toHaveBeenCalledTimes(2);
    expect(getProfileMock).toHaveBeenCalledTimes(1);
  });

  it("heightCm is null when the user has no profile row yet", async () => {
    getDbMock.mockReturnValue(DB_STUB);
    getBoundaryValuesByKindMock.mockResolvedValue({});
    getProfileMock.mockResolvedValue(null);
    const { getBodyMapData } = await import("./body-map");

    const result = await getBodyMapData("user-1");

    expect(result.heightCm).toBeNull();
  });
});
