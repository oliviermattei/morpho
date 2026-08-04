// @vitest-environment node
//
// PGlite-backed (s09 R12, ADR 009): the story's cross-user isolation test
// (task 5, criterion 6) and the read/write layer here all share the same
// harness, no secret, inside `npm run check`. One instance per file
// (beforeAll), same cost rationale as every other PGlite test in this
// repo (src/lib/measurement-sessions.test.ts, latest-measurements.test.ts).
import { beforeAll, describe, expect, it } from "vitest";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { measurements, measurementSessions } from "./schema";
import { createTestDatabase, type TestDatabase } from "./test-database";
import { MEASUREMENT_CATALOG } from "../measurements";
import { listMeasurementSessions } from "../measurement-sessions";
import { getBoundaryValuesByKind } from "./latest-measurements";
import { getAllMeasurementSeries } from "./measurement-series";
import {
  buildDeleteSessionStatements,
  buildUpdateSessionStatements,
  getSessionForUser,
  mapMeasurementRows,
  sessionForUserQuery,
  updateSessionForUser,
} from "./sessions";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

// Plan task 3(a): the SQL the read is built on carries BOTH the identifier
// filter and the property filter, checked as two independent fragments
// (never a full-string match, which would be brittle against Drizzle's
// own formatting choices).
describe("sessionForUserQuery — SQL shape (task 3, no execution)", () => {
  it("filters on both the session id and the owning user id", () => {
    const sql = sessionForUserQuery(testDb.db, {
      sessionId: "session-1",
      userId: "user-1",
    }).toSQL();

    expect(sql.sql).toContain('"measurement_sessions"."id" =');
    expect(sql.sql).toContain('"measurement_sessions"."user_id" =');
    expect(sql.params).toEqual(
      expect.arrayContaining(["session-1", "user-1"]),
    );
  });

  it("binds both ids as parameters, never concatenates them into the SQL text", () => {
    const forgedId = "'; DROP TABLE measurement_sessions; --";
    const sql = sessionForUserQuery(testDb.db, {
      sessionId: forgedId,
      userId: "user-1",
    }).toSQL();

    expect(sql.sql).not.toContain(forgedId);
    expect(sql.params).toContain(forgedId);
  });
});

// Plan task 3(b), second half: the numeric read boundary. This is the
// guard, exercised directly rather than through PGlite — PGlite's own
// numeric(...,{mode:"number"}) column mapping (schema.test.ts) already
// guarantees real rows never reach this as a string, so the only way to
// prove the guard actually bites is to feed it a malformed row by hand.
describe("mapMeasurementRows — the numeric read boundary", () => {
  it("throws if a value ever arrives as a string instead of a number", () => {
    expect(() =>
      mapMeasurementRows([{ kind: "weight_kg", value: "82.40" as unknown }]),
    ).toThrow();
  });

  it("skips a row whose kind or value is null (the left join's empty side)", () => {
    expect(mapMeasurementRows([{ kind: null, value: null }])).toEqual({});
  });

  it("maps kind to its numeric value otherwise", () => {
    expect(
      mapMeasurementRows([{ kind: "weight_kg", value: 82.4 }]),
    ).toEqual({ weight_kg: 82.4 });
  });
});

describe("getSessionForUser — PGlite integration (task 3)", () => {
  it("returns the session with its recorded measurements as numbers, not strings", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });
    await testDb.db.insert(measurements).values([
      { id: crypto.randomUUID(), sessionId, kind: "weight_kg", value: 82.4 },
      { id: crypto.randomUUID(), sessionId, kind: "waist_cm", value: 90 },
    ]);

    const result = await getSessionForUser(testDb.db, {
      sessionId,
      userId: user.id,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(sessionId);
    expect(result?.measuredOn).toBe("2026-08-02");
    expect(typeof result?.measurements.weight_kg).toBe("number");
    expect(result?.measurements).toEqual({ weight_kg: 82.4, waist_cm: 90 });
  });

  it("exposes no key at all for a kind never recorded on this session", async () => {
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
      value: 70,
    });

    const result = await getSessionForUser(testDb.db, {
      sessionId,
      userId: user.id,
    });

    expect(result?.measurements.chest_cm).toBeUndefined();
    expect("chest_cm" in (result?.measurements ?? {})).toBe(false);
  });

  it("returns null for a session id that doesn't exist", async () => {
    const user = await testDb.seedUser();

    const result = await getSessionForUser(testDb.db, {
      sessionId: crypto.randomUUID(),
      userId: user.id,
    });

    expect(result).toBeNull();
  });

  it("returns null for a session that belongs to someone else — the same shape as not existing (R6)", async () => {
    const owner = await testDb.seedUser();
    const stranger = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: owner.id,
      measuredOn: "2026-08-02",
    });

    const result = await getSessionForUser(testDb.db, {
      sessionId,
      userId: stranger.id,
    });

    expect(result).toBeNull();
  });
});

// Plan task 4: desired-state mutations, every statement carrying its own
// property scope in the same and(...) — P3's named trap, drizzle-orm's
// own db.d.ts:256 warning ("Calling this method without .where() clause
// will delete all rows in a table"). .toSQL() only: R8 bis limits what
// this layer proves to property scope, never atomicity (that's batch(),
// production-only) — the full cross-user proof lives in task 5.
describe("buildUpdateSessionStatements — SQL shape (task 4, no execution)", () => {
  const baseParams = {
    sessionId: "session-1",
    userId: "user-1",
    measuredOn: "2026-08-02",
    values: { weight_kg: 80.5, waist_cm: 90 },
  };

  it("① updateSession's WHERE carries both the id and the owner filter", () => {
    const { updateSession } = buildUpdateSessionStatements(
      testDb.db,
      baseParams,
    );
    const sql = updateSession.toSQL();

    expect(sql.sql).toContain('"measurement_sessions"."id" =');
    expect(sql.sql).toContain('"measurement_sessions"."user_id" =');
    expect(sql.params).toEqual(
      expect.arrayContaining(["session-1", "user-1"]),
    );
  });

  it("① never touches created_at — only measured_on is set", () => {
    const { updateSession } = buildUpdateSessionStatements(
      testDb.db,
      baseParams,
    );
    const sql = updateSession.toSQL().sql.toLowerCase();

    expect(sql).toContain("measured_on");
    expect(sql).not.toContain("created_at");
  });

  it("② the stale-measurements delete carries the kind exclusion AND the scoped ownership subquery", () => {
    const { deleteStaleMeasurements } = buildUpdateSessionStatements(
      testDb.db,
      baseParams,
    );
    expect(deleteStaleMeasurements).not.toBeNull();
    const sql = deleteStaleMeasurements!.toSQL();

    expect(sql.sql.toLowerCase()).toContain("not in");
    expect(sql.sql).toContain('"measurements"."session_id" in');
    expect(sql.sql).toContain('"measurement_sessions"."user_id" =');
  });

  it("② is omitted entirely when values covers all 10 kinds — not included with a vacuous predicate", () => {
    const allKinds = Object.fromEntries(
      MEASUREMENT_CATALOG.map((entry) => [entry.kind, entry.min + 1]),
    );
    const { deleteStaleMeasurements } = buildUpdateSessionStatements(
      testDb.db,
      { ...baseParams, values: allKinds },
    );

    expect(deleteStaleMeasurements).toBeNull();
  });

  it("③ the upsert targets (session_id, kind) and writes excluded.value, never a literal", () => {
    const { upsertMeasurements } = buildUpdateSessionStatements(
      testDb.db,
      baseParams,
    );
    const sql = upsertMeasurements.toSQL().sql.toLowerCase();

    expect(sql).toContain("on conflict");
    expect(sql).toContain('"session_id","kind"'.replace(/"/g, '"'));
    expect(sql).toContain("excluded");
  });

  it("③ carries one row per desired kind in a single insert", () => {
    const { upsertMeasurements } = buildUpdateSessionStatements(
      testDb.db,
      baseParams,
    );
    const sql = upsertMeasurements.toSQL();

    // Two rows of (id, session_id, kind, value) = 8 bound params.
    expect(sql.params).toHaveLength(8);
  });
});

describe("buildDeleteSessionStatements — SQL shape (task 4, no execution)", () => {
  const params = { sessionId: "session-1", userId: "user-1" };

  it("produces exactly two statements, both sealed with the ownership scope", () => {
    const { deleteMeasurements, deleteSession } = buildDeleteSessionStatements(
      testDb.db,
      params,
    );

    const measurementsSql = deleteMeasurements.toSQL();
    expect(measurementsSql.sql).toContain('"measurements"."session_id" in');
    expect(measurementsSql.sql).toContain('"measurement_sessions"."user_id" =');

    const sessionSql = deleteSession.toSQL();
    expect(sessionSql.sql).toContain('"measurement_sessions"."id" =');
    expect(sessionSql.sql).toContain('"measurement_sessions"."user_id" =');
  });

  it("deletes measurements before the session — never relies on ON DELETE CASCADE (R7)", () => {
    const statements = buildDeleteSessionStatements(testDb.db, params);
    expect(Object.keys(statements)).toEqual([
      "deleteMeasurements",
      "deleteSession",
    ]);
  });
});

describe("updateSessionForUser — the layer's own guard (task 4, R5)", () => {
  it("refuses an empty values payload before touching the database — no SQL is ever built", async () => {
    // The guard is checked before `db` is used at all — a value that
    // would throw the instant it was queried proves the ordering.
    const neverTouched = {} as NeonHttpDatabase;

    await expect(
      updateSessionForUser(neverTouched, {
        sessionId: "session-1",
        userId: "user-1",
        measuredOn: "2026-08-02",
        values: {},
      }),
    ).rejects.toThrow();
  });
});

// Plan task 5: the real cross-user proof (criterion 6), the trap-4
// catcher (criterion 2), and the composition with s03/s06/s07's read
// functions on the SAME PGlite database (criterion 5, and the data half
// of criterion 7). R8 bis: these statements are executed ONE BY ONE, the
// same builders task 4 already proved by .toSQL() — never through
// updateSessionForUser/deleteSessionForUser, since batch() only exists
// on NeonHttpDatabase (PGlite has no batch()). This composes property
// scope (proven per-statement) with real execution, which .toSQL() alone
// cannot.
describe("cross-user access — criterion 6", () => {
  it("update and delete instructions built for a stranger touch nothing; the same instructions for the owner succeed", async () => {
    const owner = await testDb.seedUser();
    const stranger = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    const weightId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: owner.id,
      measuredOn: "2026-08-01",
    });
    await testDb.db
      .insert(measurements)
      .values({ id: weightId, sessionId, kind: "weight_kg", value: 80 });

    // Attempt ① and ② as the stranger. ③ (the multi-row upsert) carries
    // no WHERE clause by construction (P2 — an insert cannot) and is
    // deliberately NOT exercised here: in the shipped system it is only
    // ever reached after the route handler's own read guard
    // (getSessionForUser, task 6) has already rejected a forged
    // sessionId/userId pair with a 404 — exercising it here would test a
    // code path that never runs unguarded in production, and would
    // itself write into another user's session.
    const strangerUpdate = buildUpdateSessionStatements(testDb.db, {
      sessionId,
      userId: stranger.id,
      measuredOn: "2026-08-09",
      values: { weight_kg: 999 },
    });
    expect(await strangerUpdate.updateSession).toHaveLength(0);
    if (strangerUpdate.deleteStaleMeasurements) {
      await strangerUpdate.deleteStaleMeasurements;
    }

    const strangerDelete = buildDeleteSessionStatements(testDb.db, {
      sessionId,
      userId: stranger.id,
    });
    await strangerDelete.deleteMeasurements;
    expect(await strangerDelete.deleteSession).toHaveLength(0);

    // A's session and its measurement are untouched, bit for bit.
    const untouchedSession = await testDb.db
      .select()
      .from(measurementSessions)
      .where(eq(measurementSessions.id, sessionId));
    expect(untouchedSession).toHaveLength(1);
    expect(untouchedSession[0].measuredOn).toBe("2026-08-01");

    const untouchedMeasurement = await testDb.db
      .select()
      .from(measurements)
      .where(eq(measurements.sessionId, sessionId));
    expect(untouchedMeasurement).toEqual([
      { id: weightId, sessionId, kind: "weight_kg", value: 80 },
    ]);

    const ownerSessionCountBefore = await listMeasurementSessions(
      testDb.db,
      owner.id,
    );
    expect(ownerSessionCountBefore).toHaveLength(1);

    // Replayed with the real owner — succeeds.
    const ownerUpdate = buildUpdateSessionStatements(testDb.db, {
      sessionId,
      userId: owner.id,
      measuredOn: "2026-08-09",
      values: { weight_kg: 81 },
    });
    expect(await ownerUpdate.updateSession).toHaveLength(1);
    if (ownerUpdate.deleteStaleMeasurements) {
      await ownerUpdate.deleteStaleMeasurements;
    }
    await ownerUpdate.upsertMeasurements;

    const afterOwnerUpdate = await getSessionForUser(testDb.db, {
      sessionId,
      userId: owner.id,
    });
    expect(afterOwnerUpdate?.measuredOn).toBe("2026-08-09");
    expect(afterOwnerUpdate?.measurements.weight_kg).toBe(81);
  });
});

// Plan task 5, criterion 2 + trap 4: after a legitimate update, the
// session count and id are unchanged, AND the measurement id of a kind
// that was already recorded and is resubmitted unchanged stays the SAME
// id — a delete-all/re-insert would fail only here, since it would
// generate a fresh id for every row regardless of whether its value
// changed.
describe("update in place — criterion 2, the delete-all/re-insert trap", () => {
  it("preserves both the session id and every existing measurement's own id, modified or not", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    const weightId = crypto.randomUUID();
    const waistId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-01",
    });
    await testDb.db.insert(measurements).values([
      { id: weightId, sessionId, kind: "weight_kg", value: 80 },
      { id: waistId, sessionId, kind: "waist_cm", value: 90 },
    ]);

    const sessionsBefore = await listMeasurementSessions(testDb.db, user.id);
    expect(sessionsBefore).toHaveLength(1);

    // weight_kg changes, waist_cm is resubmitted at its EXISTING value —
    // exactly what the edit form sends for a field the user never
    // touched (plan task 7(g)).
    const { updateSession, deleteStaleMeasurements, upsertMeasurements } =
      buildUpdateSessionStatements(testDb.db, {
        sessionId,
        userId: user.id,
        measuredOn: "2026-08-01",
        values: { weight_kg: 85, waist_cm: 90 },
      });
    await updateSession;
    // Not null here: `values` covers 2 of the 10 kinds, not all — the
    // statement is still built (and run, harmlessly: this session has no
    // other kind to delete), only genuinely omitted when all 10 are
    // present (task 4's own test covers that branch).
    if (deleteStaleMeasurements) {
      await deleteStaleMeasurements;
    }
    await upsertMeasurements;

    const sessionsAfter = await listMeasurementSessions(testDb.db, user.id);
    expect(sessionsAfter).toHaveLength(1);
    expect(sessionsAfter[0].id).toBe(sessionId);

    const rows = await testDb.db
      .select()
      .from(measurements)
      .where(eq(measurements.sessionId, sessionId));
    const weightRow = rows.find((row) => row.kind === "weight_kg");
    const waistRow = rows.find((row) => row.kind === "waist_cm");

    // The modified kind keeps its id — onConflictDoUpdate updates the
    // matched row in place, it never deletes and re-inserts.
    expect(weightRow?.id).toBe(weightId);
    expect(weightRow?.value).toBe(85);
    // The untouched kind ALSO keeps its id — the assertion a delete-all
    // pass would fail even though its value never changed.
    expect(waistRow?.id).toBe(waistId);
    expect(waistRow?.value).toBe(90);
  });
});

// Plan task 5, criterion 5 (and the data half of criterion 7): composing
// s09's mutations with the read functions s03, s06 and s07 already
// shipped, on the same PGlite database. This is what makes "disparaît de
// la silhouette et des graphes" and "la correction déplace le
// référentiel" actually provable, rather than asserted from reading the
// code.
describe("mutations compose with s03/s06/s07's reads — criterion 5", () => {
  it("a correction to the FIRST session moves the boundary and the first chart point; deleting it removes it from every read", async () => {
    const user = await testDb.seedUser();
    const firstSessionId = crypto.randomUUID();
    const secondSessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values([
      { id: firstSessionId, userId: user.id, measuredOn: "2026-01-01" },
      { id: secondSessionId, userId: user.id, measuredOn: "2026-06-01" },
    ]);
    await testDb.db.insert(measurements).values([
      {
        id: crypto.randomUUID(),
        sessionId: firstSessionId,
        kind: "weight_kg",
        value: 80,
      },
      {
        id: crypto.randomUUID(),
        sessionId: secondSessionId,
        kind: "weight_kg",
        value: 82,
      },
    ]);

    const firstBefore = await getBoundaryValuesByKind(
      testDb.db,
      user.id,
      "first",
    );
    expect(firstBefore.weight_kg?.value).toBe(80);
    const seriesBefore = await getAllMeasurementSeries(testDb.db, user.id);
    expect(seriesBefore.byKind.weight_kg[0]?.value).toBe(80);

    // Correct the FIRST session's weight.
    const { updateSession, deleteStaleMeasurements, upsertMeasurements } =
      buildUpdateSessionStatements(testDb.db, {
        sessionId: firstSessionId,
        userId: user.id,
        measuredOn: "2026-01-01",
        values: { weight_kg: 75 },
      });
    await updateSession;
    // Not null (only 1 of the 10 kinds is present) — run it, harmlessly:
    // this session only ever had weight_kg.
    if (deleteStaleMeasurements) {
      await deleteStaleMeasurements;
    }
    await upsertMeasurements;

    const firstAfterEdit = await getBoundaryValuesByKind(
      testDb.db,
      user.id,
      "first",
    );
    expect(firstAfterEdit.weight_kg?.value).toBe(75);
    const seriesAfterEdit = await getAllMeasurementSeries(testDb.db, user.id);
    expect(seriesAfterEdit.byKind.weight_kg[0]?.value).toBe(75);

    // Now delete the (corrected) first session entirely.
    const { deleteMeasurements, deleteSession } = buildDeleteSessionStatements(
      testDb.db,
      { sessionId: firstSessionId, userId: user.id },
    );
    await deleteMeasurements;
    await deleteSession;

    const sessionsAfterDelete = await listMeasurementSessions(
      testDb.db,
      user.id,
    );
    expect(sessionsAfterDelete.map((session) => session.id)).not.toContain(
      firstSessionId,
    );
    expect(sessionsAfterDelete).toHaveLength(1);

    const firstAfterDelete = await getBoundaryValuesByKind(
      testDb.db,
      user.id,
      "first",
    );
    // The second session is now the only one left — it becomes both the
    // first and the last boundary.
    expect(firstAfterDelete.weight_kg?.value).toBe(82);

    const seriesAfterDelete = await getAllMeasurementSeries(
      testDb.db,
      user.id,
    );
    expect(seriesAfterDelete.byKind.weight_kg).toHaveLength(1);
    expect(seriesAfterDelete.byKind.weight_kg[0]?.value).toBe(82);
  });
});
