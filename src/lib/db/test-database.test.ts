// @vitest-environment node
//
// Plan task 2 / ADR 009: this is what proves the PGlite harness actually
// applies the real, generated migration and enforces the constraints it
// declares — not a fixture that merely resembles the schema. One instance
// is shared per file (beforeAll) rather than per test: the Test strategy
// section of the plan is explicit that a fresh PGlite per test is what
// pushed npm run check to 122s in the s01 review (finding A). Each test
// still inserts its own randomUUID()-keyed rows, so nothing needs to be
// torn down between them.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { measurements, measurementSessions, profiles } from "./schema";
import { createTestDatabase, type TestDatabase } from "./test-database";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

describe("createTestDatabase — the real, generated migration applies", () => {
  it("lets a session and its measurements be inserted", async () => {
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

    const rows = await testDb.db
      .select()
      .from(measurements)
      .where(eq(measurements.sessionId, sessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(82.4);
  });

  // Consigned for comparison against Neon's real PostgreSQL 18.4 (plan,
  // "Ce que ce plan ne tranche pas", point 2): PGlite embeds its own
  // Postgres build, so a DDL that passes here is not a guarantee it passes
  // on Neon — only a strong signal. This is what makes the gap visible
  // instead of silent.
  it("records the PGlite Postgres version actually exercised by these tests", async () => {
    const result = await testDb.db.execute<{ version: string }>(
      "select version() as version",
    );
    const version = result.rows[0]?.version;
    console.info("[test-database] PGlite version:", version);
    expect(version).toMatch(/^PostgreSQL \d+/);
  });
});

describe("createTestDatabase — constraints declared by the real migration reject bad data", () => {
  it("rejects two measurements of the same kind in one session (unique constraint)", async () => {
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
      kind: "waist_cm",
      value: 80,
    });

    await expect(
      testDb.db.insert(measurements).values({
        id: crypto.randomUUID(),
        sessionId,
        kind: "waist_cm",
        value: 81,
      }),
    ).rejects.toThrow();
  });

  it("rejects a measurement stored at 0 (check constraint) — vide is not zéro even at the storage level", async () => {
    const user = await testDb.seedUser();
    const sessionId = crypto.randomUUID();
    await testDb.db.insert(measurementSessions).values({
      id: sessionId,
      userId: user.id,
      measuredOn: "2026-08-02",
    });

    await expect(
      testDb.db.insert(measurements).values({
        id: crypto.randomUUID(),
        sessionId,
        kind: "weight_kg",
        value: 0,
      }),
    ).rejects.toThrow();
  });

  it("rejects a session for an unknown user (foreign key to neon_auth.user)", async () => {
    await expect(
      testDb.db.insert(measurementSessions).values({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        measuredOn: "2026-08-02",
      }),
    ).rejects.toThrow();
  });

  // Plan task 5, R6: the physiological range is doubled by a real CHECK,
  // not just the application-level heightInputSchema (src/lib/height.ts).
  it("rejects a height_cm outside 80..260 (check constraint on profiles)", async () => {
    const user = await testDb.seedUser();

    await expect(
      testDb.db.insert(profiles).values({
        userId: user.id,
        heightCm: 300,
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL height_cm — the CHECK must not reject an unset profile", async () => {
    const user = await testDb.seedUser();

    await testDb.db.insert(profiles).values({ userId: user.id });

    const rows = await testDb.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));
    expect(rows[0]?.heightCm).toBeNull();
  });
});
