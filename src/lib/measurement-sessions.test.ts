// @vitest-environment node
//
// PGlite-backed: proves the real ORDER BY, not a hand-rolled sort. One
// instance shared per file (beforeAll), same cost rationale as
// src/lib/db/test-database.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { measurements, measurementSessions } from "./db/schema";
import { createTestDatabase, type TestDatabase } from "./db/test-database";
import {
  getLatestWeighIn,
  listMeasurementSessions,
} from "./measurement-sessions";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

describe("listMeasurementSessions — ordering and shape (task 6)", () => {
  it("returns the given user's sessions, most recent measured_on first", async () => {
    const user = await testDb.seedUser();
    const older = crypto.randomUUID();
    const newer = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: older, userId: user.id, measuredOn: "2026-07-01" },
      { id: newer, userId: user.id, measuredOn: "2026-08-02" },
    ]);
    await testDb.db.insert(measurements).values([
      {
        id: crypto.randomUUID(),
        sessionId: older,
        kind: "weight_kg",
        value: 83.1,
      },
      {
        id: crypto.randomUUID(),
        sessionId: newer,
        kind: "weight_kg",
        value: 82.4,
      },
    ]);

    const sessions = await listMeasurementSessions(testDb.db, user.id);

    expect(sessions.map((s) => s.id)).toEqual([newer, older]);
  });

  it("breaks a measured_on tie by created_at, most recent first", async () => {
    const user = await testDb.seedUser();
    const earlierCreated = crypto.randomUUID();
    const laterCreated = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: earlierCreated,
      userId: user.id,
      measuredOn: "2026-08-02",
      createdAt: new Date("2026-08-02T09:00:00Z"),
    });
    await testDb.db.insert(measurementSessions).values({
      id: laterCreated,
      userId: user.id,
      measuredOn: "2026-08-02",
      createdAt: new Date("2026-08-02T10:00:00Z"),
    });
    await testDb.db.insert(measurements).values([
      {
        id: crypto.randomUUID(),
        sessionId: earlierCreated,
        kind: "weight_kg",
        value: 82,
      },
      {
        id: crypto.randomUUID(),
        sessionId: laterCreated,
        kind: "weight_kg",
        value: 82.2,
      },
    ]);

    const sessions = await listMeasurementSessions(testDb.db, user.id);
    const ids = sessions.map((s) => s.id);

    expect(ids.indexOf(laterCreated)).toBeLessThan(ids.indexOf(earlierCreated));
  });

  it("returns exactly one measurement for a weight-only session", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values({
      id: crypto.randomUUID(),
      sessionId,
      kind: "weight_kg",
      value: 82.4,
    });

    const sessions = await listMeasurementSessions(testDb.db, user.id);
    const session = sessions.find((s) => s.id === sessionId);

    expect(session?.measurements).toEqual([
      { kind: "weight_kg", value: 82.4 },
    ]);
  });

  it("orders a session's measurements in the catalog's declared order, not insertion order", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    // Inserted out of catalog order on purpose.
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId, kind: "muscle_pct", value: 40 },
      { id: crypto.randomUUID(), sessionId, kind: "weight_kg", value: 82 },
      { id: crypto.randomUUID(), sessionId, kind: "chest_cm", value: 100 },
    ]);

    const sessions = await listMeasurementSessions(testDb.db, user.id);
    const session = sessions.find((s) => s.id === sessionId);

    expect(session?.measurements.map((m) => m.kind)).toEqual([
      "weight_kg",
      "chest_cm",
      "muscle_pct",
    ]);
  });
});

// Plan task 8, criterion 7: an explicit cross-access attempt on real SQL,
// not a filter proven only by reading the code. Named entry point so it
// isn't "to find" at execution — this is the PGlite level of the three
// the plan requires (PGlite, handler, page → component).
describe("listMeasurementSessions — cross-user isolation (criterion 7)", () => {
  it("returns only B's own sessions for B, and none of A's — and vice versa", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();

    const aSession1 = crypto.randomUUID();
    const aSession2 = crypto.randomUUID();
    const bSession = crypto.randomUUID();

    await testDb.db.insert(measurementSessions).values([
      { id: aSession1, userId: userA.id, measuredOn: "2026-07-01" },
      { id: aSession2, userId: userA.id, measuredOn: "2026-07-15" },
      { id: bSession, userId: userB.id, measuredOn: "2026-08-02" },
    ]);
    await testDb.db.insert(measurements).values([
      {
        id: crypto.randomUUID(),
        sessionId: aSession1,
        kind: "weight_kg",
        value: 80,
      },
      {
        id: crypto.randomUUID(),
        sessionId: aSession2,
        kind: "weight_kg",
        value: 79,
      },
      {
        id: crypto.randomUUID(),
        sessionId: bSession,
        kind: "weight_kg",
        value: 65,
      },
    ]);

    const bResults = await listMeasurementSessions(testDb.db, userB.id);
    expect(bResults.map((s) => s.id)).toEqual([bSession]);
    expect(
      bResults.some((s) => s.id === aSession1 || s.id === aSession2),
    ).toBe(false);

    const aResults = await listMeasurementSessions(testDb.db, userA.id);
    expect(aResults.map((s) => s.id).sort()).toEqual(
      [aSession1, aSession2].sort(),
    );
    expect(aResults.some((s) => s.id === bSession)).toBe(false);
  });
});

// Plan task 6: the data BmiCard needs — the debt is written down there,
// not discovered in s05: "last known weight" is a special case of
// "last known value per measurement kind" that s05's getLatestValueByKind
// (docs/plans/s05-quick-entry-prefill.md, task 1, selectDistinctOn)
// replaces outright.
describe("getLatestWeighIn (task 6)", () => {
  it("returns null when the user has no session carrying a weight", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values({
      id: crypto.randomUUID(),
      sessionId,
      kind: "biceps_cm",
      value: 34,
    });

    const result = await getLatestWeighIn(testDb.db, user.id);

    expect(result).toBeNull();
  });

  it("returns the most recent weight, its date, and the count of sessions carrying a weight", async () => {
    const user = await testDb.seedUser();
    const older = crypto.randomUUID();
    const newer = crypto.randomUUID();
    const noWeight = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: older, userId: user.id, measuredOn: "2026-07-01" },
      { id: newer, userId: user.id, measuredOn: "2026-08-02" },
      { id: noWeight, userId: user.id, measuredOn: "2026-07-15" },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: older, kind: "weight_kg", value: 73.1 },
      { id: crypto.randomUUID(), sessionId: newer, kind: "weight_kg", value: 72.4 },
      { id: crypto.randomUUID(), sessionId: noWeight, kind: "biceps_cm", value: 34 },
    ]);

    const result = await getLatestWeighIn(testDb.db, user.id);

    expect(result).toEqual({
      weightKg: 72.4,
      measuredOn: "2026-08-02",
      sessionsWithWeightCount: 2,
    });
  });

  it("never returns another user's weight (isolation)", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();
    const sessionA = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionA,
      userId: userA.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values({
      id: crypto.randomUUID(),
      sessionId: sessionA,
      kind: "weight_kg",
      value: 80,
    });

    const result = await getLatestWeighIn(testDb.db, userB.id);

    expect(result).toBeNull();
  });
});
