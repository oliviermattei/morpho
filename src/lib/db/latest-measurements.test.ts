// @vitest-environment node
//
// PGlite-backed: proves the real DISTINCT ON / ORDER BY, not a hand-rolled
// sort. One instance shared per file (beforeAll), same cost rationale as
// src/lib/db/test-database.test.ts and src/lib/measurement-sessions.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq, inArray } from "drizzle-orm";
import { measurements, measurementSessions } from "./schema";
import { createTestDatabase, type TestDatabase } from "./test-database";
import {
  boundaryValuesByKindQuery,
  getBoundaryValuesByKind,
  getLatestValueByKind,
} from "./latest-measurements";
import {
  formatMeasurementValueForInput,
  parseMeasurementInput,
} from "../measurements";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

// Plan task 1, the story's own named trap: "last known value PER
// MEASUREMENT" is not "the last session's values". A measurement that
// exists only in the oldest of a user's two sessions must still surface —
// an implementation that reads only the most recent session's row is
// green on every other test in this file and red only here.
describe("getLatestValueByKind — last value per measurement kind, not per session", () => {
  it("surfaces a measurement that only exists in the user's oldest session", async () => {
    const user = await testDb.seedUser();
    const older = crypto.randomUUID();
    const newer = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: older, userId: user.id, measuredOn: "2026-06-01" },
      { id: newer, userId: user.id, measuredOn: "2026-08-02" },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: older, kind: "calf_cm", value: 39 },
      { id: crypto.randomUUID(), sessionId: newer, kind: "weight_kg", value: 82.4 },
    ]);

    const result = await getLatestValueByKind(testDb.db, user.id);

    expect(result.calf_cm).toBe(39);
    expect(result.weight_kg).toBe(82.4);
  });

  it("never fabricates a value for a measurement the user has never recorded — no key, no 0, no null", async () => {
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

    const result = await getLatestValueByKind(testDb.db, user.id);

    expect("biceps_cm" in result).toBe(false);
    expect(result.biceps_cm).not.toBe(0);
    expect(result.biceps_cm).not.toBeNull();
  });

  it("breaks a measured_on tie by the most recent created_at (first orientation)", async () => {
    const user = await testDb.seedUser();
    const earlierCreated = crypto.randomUUID();
    const laterCreated = crypto.randomUUID();
    const measuredOn = "2026-08-02";
    await testDb.db.insert(measurementSessions).values([
      {
        id: earlierCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T08:00:00Z"),
      },
      {
        id: laterCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T09:00:00Z"),
      },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: earlierCreated, kind: "weight_kg", value: 70 },
      { id: crypto.randomUUID(), sessionId: laterCreated, kind: "weight_kg", value: 75 },
    ]);

    const result = await getLatestValueByKind(testDb.db, user.id);

    expect(result.weight_kg).toBe(75);
  });

  // Symmetric to the previous test — same shape, the numeric values on the
  // early/late sessions swapped. An ORDER BY kind, measured_on DESC alone
  // (no created_at tiebreak) is non-deterministic and can pass the first
  // orientation by luck; swapping which physical value is "later" is what
  // catches that (plan task 1, "ce qui a changé").
  it("breaks a measured_on tie by the most recent created_at (second, swapped orientation)", async () => {
    const user = await testDb.seedUser();
    const earlierCreated = crypto.randomUUID();
    const laterCreated = crypto.randomUUID();
    const measuredOn = "2026-08-02";
    await testDb.db.insert(measurementSessions).values([
      {
        id: earlierCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T08:00:00Z"),
      },
      {
        id: laterCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T09:00:00Z"),
      },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: earlierCreated, kind: "weight_kg", value: 75 },
      { id: crypto.randomUUID(), sessionId: laterCreated, kind: "weight_kg", value: 70 },
    ]);

    const result = await getLatestValueByKind(testDb.db, user.id);

    expect(result.weight_kg).toBe(70);
  });

  // Total order: when measured_on AND created_at both tie, the id is the
  // final tiebreak. The expected winner is established independently, by
  // asking Postgres directly which of the two ids sorts higher — not by
  // assuming a JS string comparison agrees with it.
  it("breaks a measured_on AND created_at tie by the greater id, stably across repeated calls", async () => {
    const user = await testDb.seedUser();
    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    const measuredOn = "2026-08-02";
    const createdAt = new Date("2026-08-02T09:00:00Z");
    await testDb.db.insert(measurementSessions).values([
      { id: idA, userId: user.id, measuredOn, createdAt },
      { id: idB, userId: user.id, measuredOn, createdAt },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: idA, kind: "weight_kg", value: 70 },
      { id: crypto.randomUUID(), sessionId: idB, kind: "weight_kg", value: 75 },
    ]);

    const [{ id: expectedWinningId }] = await testDb.db
      .select({ id: measurementSessions.id })
      .from(measurementSessions)
      .where(inArray(measurementSessions.id, [idA, idB]))
      .orderBy(desc(measurementSessions.id))
      .limit(1);
    const expectedValue = expectedWinningId === idA ? 70 : 75;

    const first = await getLatestValueByKind(testDb.db, user.id);
    const second = await getLatestValueByKind(testDb.db, user.id);

    expect(first.weight_kg).toBe(expectedValue);
    expect(second.weight_kg).toBe(expectedValue);
  });

  it("never returns another user's values for A, and vice versa (explicit cross-access attempt)", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();
    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: sessionA, userId: userA.id, measuredOn: "2026-08-02" },
      { id: sessionB, userId: userB.id, measuredOn: "2026-08-02" },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: sessionA, kind: "weight_kg", value: 80 },
      { id: crypto.randomUUID(), sessionId: sessionB, kind: "weight_kg", value: 65 },
    ]);

    const resultA = await getLatestValueByKind(testDb.db, userA.id);
    const resultB = await getLatestValueByKind(testDb.db, userB.id);

    expect(resultA.weight_kg).toBe(80);
    expect(resultB.weight_kg).toBe(65);
  });

  it("returns real numbers, never the driver's raw numeric string (ADR 004)", async () => {
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

    const result = await getLatestValueByKind(testDb.db, user.id);

    expect(typeof result.weight_kg).toBe("number");
  });
});

// Plan task 7, "the most important test of the story": prefill -> submit
// unmodified -> reread must round-trip exactly, and the reread must pull
// from the NEW session (proving the read side keeps up with the write
// side using the same canonical order as task 1).
describe("prefill round-trip — submitting the plateau unmodified (task 7, criteria 2 and 4)", () => {
  it("re-submitting the prefilled values verbatim stores the same numbers, with no parasite rounding, and the next prefill reads them from the new session", async () => {
    const user = await testDb.seedUser();
    const oldSessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: oldSessionId,
      userId: user.id,
      measuredOn: "2026-06-01",
    });
    await testDb.db.insert(measurements).values([
      {
        id: crypto.randomUUID(),
        sessionId: oldSessionId,
        kind: "weight_kg",
        value: 82.4,
      },
      {
        id: crypto.randomUUID(),
        sessionId: oldSessionId,
        kind: "biceps_cm",
        value: 34.5,
      },
    ]);

    const prefill = await getLatestValueByKind(testDb.db, user.id);

    // Exactly the chain the browser and the server actually run: the
    // number is formatted into the input's string (task 2), never
    // touched by the user, then parsed back at submission time — the
    // same round trip formatMeasurementValueForInput/parseMeasurementInput
    // is proven symmetric on in src/lib/measurements.test.ts, exercised
    // here end to end against the database.
    const submitted: Partial<Record<string, number>> = {};
    for (const [kind, value] of Object.entries(prefill)) {
      const displayed = formatMeasurementValueForInput(value as number);
      const parsed = parseMeasurementInput(displayed);
      expect(parsed.status).toBe("value");
      if (parsed.status === "value") {
        submitted[kind] = parsed.value;
      }
    }

    const newSessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: newSessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values(
      Object.entries(submitted).map(([kind, value]) => ({
        id: crypto.randomUUID(),
        sessionId: newSessionId,
        kind: kind as (typeof measurements.$inferInsert)["kind"],
        value: value as number,
      })),
    );

    const newRows = await testDb.db
      .select()
      .from(measurements)
      .where(eq(measurements.sessionId, newSessionId));
    expect(newRows).toHaveLength(2);
    expect(newRows.find((row) => row.kind === "weight_kg")?.value).toBe(82.4);
    expect(newRows.find((row) => row.kind === "biceps_cm")?.value).toBe(34.5);

    const latestAfter = await getLatestValueByKind(testDb.db, user.id);
    expect(latestAfter.weight_kg).toBe(82.4);
    expect(latestAfter.biceps_cm).toBe(34.5);
  });

  it("clearing a prefilled field before submitting writes no row for that kind — the prior session's value resurfaces on the next prefill, 'cleared this time' is never 'never measured'", async () => {
    const user = await testDb.seedUser();
    const oldSessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: oldSessionId,
      userId: user.id,
      measuredOn: "2026-06-01",
    });
    await testDb.db.insert(measurements).values({
      id: crypto.randomUUID(),
      sessionId: oldSessionId,
      kind: "weight_kg",
      value: 82.4,
    });

    // The server never backfills a cleared field (decision N1, ADR 004):
    // the new session is written with no weight_kg row at all.
    const newSessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: newSessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });

    const rowsForNewSession = await testDb.db
      .select()
      .from(measurements)
      .where(eq(measurements.sessionId, newSessionId));
    expect(rowsForNewSession).toHaveLength(0);

    const latest = await getLatestValueByKind(testDb.db, user.id);
    expect(latest.weight_kg).toBe(82.4);
  });
});

// Plan s06 task 3: getBoundaryValuesByKind extends the ONE selectDistinctOn
// query in the repo with a direction parameter — "first" mirrors "last"
// exactly, per ADR canonical-measurement-ordering, which s05's own R1
// obliges s06 to reproduce with the id tiebreak included (the earlier
// s06 draft stopped at measured_on/created_at, which the ADR forbids).
describe("boundaryValuesByKindQuery — SQL shape (s06 task 3, no execution)", () => {
  it("produces a query containing 'distinct on'", () => {
    const sql = boundaryValuesByKindQuery(testDb.db, "user-1", "last").toSQL();

    expect(sql.sql.toLowerCase()).toContain("distinct on");
  });

  it("orders by kind, measured_on, created_at, id — in that order, all ascending for 'first'", () => {
    const sql = boundaryValuesByKindQuery(testDb.db, "user-1", "first").toSQL();
    const orderByClause = sql.sql
      .toLowerCase()
      .slice(sql.sql.toLowerCase().indexOf("order by"));

    const kindIndex = orderByClause.indexOf("kind");
    const measuredOnIndex = orderByClause.indexOf("measured_on");
    const createdAtIndex = orderByClause.indexOf("created_at");
    const idIndex = orderByClause.lastIndexOf("id");
    expect(kindIndex).toBeGreaterThanOrEqual(0);
    expect(measuredOnIndex).toBeGreaterThan(kindIndex);
    expect(createdAtIndex).toBeGreaterThan(measuredOnIndex);
    expect(idIndex).toBeGreaterThan(createdAtIndex);
    // "first" mirrors "last" exactly in ASC.
    expect(orderByClause).not.toContain("desc");
  });

  it("orders all four expressions descending for 'last'", () => {
    const sql = boundaryValuesByKindQuery(testDb.db, "user-1", "last").toSQL();
    const orderByClause = sql.sql
      .toLowerCase()
      .slice(sql.sql.toLowerCase().indexOf("order by"));

    // 4 order expressions total; only "kind" (the DISTINCT ON leader) has
    // no explicit direction keyword in Postgres's default-ascending SQL,
    // so exactly 3 "desc" occurrences are expected in the ORDER BY clause.
    const descCount = (orderByClause.match(/desc/g) ?? []).length;
    expect(descCount).toBe(3);
  });

  it("binds the user id as a parameter, never concatenates it into the SQL text", () => {
    const forgedUserId = "'; DROP TABLE measurements; --";
    const sql = boundaryValuesByKindQuery(testDb.db, forgedUserId, "last").toSQL();

    expect(sql.sql).not.toContain(forgedUserId);
    expect(sql.params).toContain(forgedUserId);
  });
});

describe("getBoundaryValuesByKind — PGlite integration (s06 task 3)", () => {
  it("returns the measurementId alongside the value", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    const measurementId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values({
      id: measurementId,
      sessionId,
      kind: "weight_kg",
      value: 82.4,
    });

    const last = await getBoundaryValuesByKind(testDb.db, user.id, "last");

    expect(last.weight_kg).toEqual({ measurementId, value: 82.4 });
  });

  it("never returns a value as a string (ADR 004)", async () => {
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

    const first = await getBoundaryValuesByKind(testDb.db, user.id, "first");

    expect(typeof first.weight_kg?.value).toBe("number");
  });

  // "first" must surface the OLDEST measurement of a kind — the mirror
  // image of the "last" trap task 1 already locks. A measurement that
  // exists only in the most recent session must still surface as
  // "first" if it's the only one, but here we test the real mirror: two
  // sessions, "first" reads the older one.
  it("'first' surfaces the oldest session's value, 'last' the newest, for the same kind", async () => {
    const user = await testDb.seedUser();
    const older = crypto.randomUUID();
    const newer = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: older, userId: user.id, measuredOn: "2026-06-01" },
      { id: newer, userId: user.id, measuredOn: "2026-08-02" },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: older, kind: "waist_cm", value: 96 },
      { id: crypto.randomUUID(), sessionId: newer, kind: "waist_cm", value: 88.6 },
    ]);

    const first = await getBoundaryValuesByKind(testDb.db, user.id, "first");
    const last = await getBoundaryValuesByKind(testDb.db, user.id, "last");

    expect(first.waist_cm?.value).toBe(96);
    expect(last.waist_cm?.value).toBe(88.6);
  });

  // Same measurement recorded exactly once: "first" and "last" must
  // return the SAME row (same measurementId) — this is exactly how
  // body-map-view.ts (task 4) distinguishes "single" from "compared"
  // (decision 11), so the identity match is asserted directly here.
  it("returns the same measurementId for 'first' and 'last' when only one measurement of that kind exists", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    const measurementId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values({
      id: measurementId,
      sessionId,
      kind: "calf_cm",
      value: 39,
    });

    const first = await getBoundaryValuesByKind(testDb.db, user.id, "first");
    const last = await getBoundaryValuesByKind(testDb.db, user.id, "last");

    expect(first.calf_cm?.measurementId).toBe(measurementId);
    expect(last.calf_cm?.measurementId).toBe(measurementId);
  });

  // Stability of the "first" boundary on a same-day tie — the bonus
  // integration test the plan calls for now that the PGlite harness is
  // available, mirroring task 1's departage tests but in ASC.
  it("breaks a same-day tie for 'first' by the EARLIEST created_at (mirror of task 1's 'last' departage)", async () => {
    const user = await testDb.seedUser();
    const earlierCreated = crypto.randomUUID();
    const laterCreated = crypto.randomUUID();
    const measuredOn = "2026-08-02";
    await testDb.db.insert(measurementSessions).values([
      {
        id: earlierCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T08:00:00Z"),
      },
      {
        id: laterCreated,
        userId: user.id,
        measuredOn,
        createdAt: new Date("2026-08-02T09:00:00Z"),
      },
    ]);
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId: earlierCreated, kind: "hips_cm", value: 101 },
      { id: crypto.randomUUID(), sessionId: laterCreated, kind: "hips_cm", value: 99 },
    ]);

    const first = await getBoundaryValuesByKind(testDb.db, user.id, "first");
    const second = await getBoundaryValuesByKind(testDb.db, user.id, "first");

    expect(first.hips_cm?.value).toBe(101);
    expect(second.hips_cm?.value).toBe(101);
  });
});
