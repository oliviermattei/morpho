// @vitest-environment node
//
// PGlite-backed (ADR 009, plan P3): the upsert and the cross-user
// isolation of getProfile/saveHeight are proven on real SQL, inside
// `npm run check`, not asserted by reading the code. One instance shared
// per file (beforeAll) — same cost rationale as
// src/lib/db/test-database.test.ts and src/lib/measurement-sessions.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./db/test-database";
import { getProfile, saveHeight, saveTargetWeight } from "./profile";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 30_000);

describe("getProfile — no row yet", () => {
  it("returns null when the user has never saved a height", async () => {
    const user = await testDb.seedUser();

    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toBeNull();
  });
});

describe("saveHeight / getProfile — upsert (task 6)", () => {
  it("creates the profile row on first save", async () => {
    const user = await testDb.seedUser();

    await saveHeight(testDb.db, user.id, 175);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: 175, targetWeightKg: null , sex: null, transformationStartedOn: null });
  });

  it("updates the same row on a second save, without duplicating it", async () => {
    const user = await testDb.seedUser();

    await saveHeight(testDb.db, user.id, 175);
    await saveHeight(testDb.db, user.id, 178);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: 178, targetWeightKg: null , sex: null, transformationStartedOn: null });
  });

  it("writes NULL when the height is cleared — R7, never a stale value left behind", async () => {
    const user = await testDb.seedUser();

    await saveHeight(testDb.db, user.id, 175);
    await saveHeight(testDb.db, user.id, null);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: null, targetWeightKg: null , sex: null, transformationStartedOn: null });
  });
});

// s08 task 5: the twin of saveHeight, for target_weight_kg — same
// upsert shape, same onConflictDoUpdate target, on the same row.
describe("saveTargetWeight / getProfile — upsert (s08 task 5)", () => {
  it("creates the profile row on first save", async () => {
    const user = await testDb.seedUser();

    await saveTargetWeight(testDb.db, user.id, 72);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: null, targetWeightKg: 72 , sex: null, transformationStartedOn: null });
  });

  it("updates the same row on a second save, without duplicating it", async () => {
    const user = await testDb.seedUser();

    await saveTargetWeight(testDb.db, user.id, 72);
    await saveTargetWeight(testDb.db, user.id, 70.5);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: null, targetWeightKg: 70.5 , sex: null, transformationStartedOn: null });
  });

  it("writes NULL when the target is cleared — the only path back to 'no target' (criterion 4)", async () => {
    const user = await testDb.seedUser();

    await saveTargetWeight(testDb.db, user.id, 72);
    await saveTargetWeight(testDb.db, user.id, null);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: null, targetWeightKg: null , sex: null, transformationStartedOn: null });
  });

  // The two fields live on the same row (one preference mechanism, per
  // the story's own scope note) but must not clobber each other: saving
  // one leaves the other exactly as it was.
  it("saving the target does not touch an already-saved height, and vice versa", async () => {
    const user = await testDb.seedUser();

    await saveHeight(testDb.db, user.id, 175);
    await saveTargetWeight(testDb.db, user.id, 72);
    const profile = await getProfile(testDb.db, user.id);

    expect(profile).toEqual({ userId: user.id, heightCm: 175, targetWeightKg: 72 , sex: null, transformationStartedOn: null });
  });
});

// Plan task 6, P3: isolation is tested automatically, inside npm run
// check — the same requirement s03's criterion 7 already set the pattern
// for (src/lib/measurement-sessions.test.ts).
describe("getProfile / saveHeight — cross-user isolation", () => {
  it("A never sees B's height, and B never sees A's", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();

    await saveHeight(testDb.db, userA.id, 175);
    await saveHeight(testDb.db, userB.id, 190);

    const profileA = await getProfile(testDb.db, userA.id);
    const profileB = await getProfile(testDb.db, userB.id);

    expect(profileA?.heightCm).toBe(175);
    expect(profileB?.heightCm).toBe(190);
  });

  it("A never sees B's target weight, and B never sees A's (s08 task 5)", async () => {
    const userA = await testDb.seedUser();
    const userB = await testDb.seedUser();

    await saveTargetWeight(testDb.db, userA.id, 72);
    await saveTargetWeight(testDb.db, userB.id, 90);

    const profileA = await getProfile(testDb.db, userA.id);
    const profileB = await getProfile(testDb.db, userB.id);

    expect(profileA?.targetWeightKg).toBe(72);
    expect(profileB?.targetWeightKg).toBe(90);
  });
});
