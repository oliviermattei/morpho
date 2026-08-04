// @vitest-environment node
//
// Plan s07 task 3 — R12: without a cross-user test on a real database, a
// forgotten `where user_id` passes typecheck, lint and every unit test.
// PGlite is what makes that failure mode actually falsifiable (ADR 009).
import { beforeAll, describe, expect, it } from "vitest";
import { measurements, measurementSessions, profiles } from "./schema";
import { createTestDatabase, type TestDatabase } from "./test-database";
import { getAllMeasurementSeries } from "./measurement-series";
import { computeBmi } from "../bmi";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

async function seedSession(
  db: TestDatabase["db"],
  userId: string,
  measuredOn: string,
  values: { kind: (typeof measurements.$inferInsert)["kind"]; value: number }[],
): Promise<void> {
  const sessionId = crypto.randomUUID();
  await db.insert(measurementSessions).values({ id: sessionId, userId, measuredOn });
  if (values.length > 0) {
    await db.insert(measurements).values(
      values.map(({ kind, value }) => ({
        id: crypto.randomUUID(),
        sessionId,
        kind,
        value,
      })),
    );
  }
}

describe("getAllMeasurementSeries — cross-user isolation (R12)", () => {
  it("never returns another user's measurements, in either direction", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();
    await seedSession(testDb.db, userA.id, "2026-01-01", [
      { kind: "weight_kg", value: 80 },
    ]);
    await seedSession(testDb.db, userB.id, "2026-01-01", [
      { kind: "weight_kg", value: 65 },
    ]);

    const seriesA = await getAllMeasurementSeries(testDb.db, userA.id);
    const seriesB = await getAllMeasurementSeries(testDb.db, userB.id);

    expect(seriesA.byKind.weight_kg.map((p) => p.value)).toEqual([80]);
    expect(seriesB.byKind.weight_kg.map((p) => p.value)).toEqual([65]);
  });
});

describe("getAllMeasurementSeries — a user with no measurements at all", () => {
  it("returns an empty array for every one of the 10 kinds, never an error", async () => {
    const user = await testDb.seedUser();

    const result = await getAllMeasurementSeries(testDb.db, user.id);

    expect(Object.keys(result.byKind)).toHaveLength(10);
    for (const series of Object.values(result.byKind)) {
      expect(series).toEqual([]);
    }
  });
});

describe("getAllMeasurementSeries — BMI derivation (R9's two distinct empty causes)", () => {
  it("reports heightMissing when the profile has no height, regardless of weight data", async () => {
    const user = await testDb.seedUser();
    await seedSession(testDb.db, user.id, "2026-01-01", [
      { kind: "weight_kg", value: 80 },
    ]);

    const result = await getAllMeasurementSeries(testDb.db, user.id);

    expect(result.bmi).toEqual({ status: "heightMissing" });
  });

  it("derives BMI through src/lib/bmi.ts's computeBmi — never a second formula", async () => {
    const user = await testDb.seedUser();
    await testDb.db
      .insert(profiles)
      .values({ userId: user.id, heightCm: 175 });
    await seedSession(testDb.db, user.id, "2026-01-01", [
      { kind: "weight_kg", value: 80 },
    ]);

    const result = await getAllMeasurementSeries(testDb.db, user.id);

    expect(result.bmi.status).toBe("ok");
    if (result.bmi.status === "ok") {
      expect(result.bmi.series).toHaveLength(1);
      expect(result.bmi.series[0]!.value).toBe(computeBmi(80, 175));
    }
  });

  it("an empty weight series with a height set produces an ok status with an empty BMI series, not heightMissing", async () => {
    const user = await testDb.seedUser();
    await testDb.db
      .insert(profiles)
      .values({ userId: user.id, heightCm: 175 });

    const result = await getAllMeasurementSeries(testDb.db, user.id);

    expect(result.bmi).toEqual({ status: "ok", series: [] });
  });
});
