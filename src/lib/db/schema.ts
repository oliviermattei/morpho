import { sql } from "drizzle-orm";
import {
  check,
  date,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Fixture, not a table this project owns: `neon_auth."user"` is created and
 * managed by Neon Auth (ADR 003), never by a Drizzle migration. Only the
 * column the foreign keys below need is declared.
 *
 * Deliberately NOT exported. Plan decision 1 bis, reproduced by spike:
 * drizzle-kit serializes a schema file's *exports* to decide what to
 * migrate — `schemaFilter: ["public"]` does not filter that out. An
 * exported `authUser` here makes `drizzle-kit generate` emit
 * `CREATE TABLE "neon_auth"."user"` despite the filter, which fails
 * `db:migrate` on Neon ("relation already exists") or, on a fresh
 * database, creates a phantom table shadowing Neon Auth's own — the
 * absolute rule this repo cannot break. src/lib/db/schema.test.ts locks
 * this by inspecting the generated SQL, not by trusting schemaFilter.
 */
const authUser = pgSchema("neon_auth").table("user", {
  id: uuid("id").primaryKey(),
});

/**
 * The 10 tracked measurement kinds, in the design's entry order: weight
 * alone first, then the body top to bottom, then the two percentages
 * (docs/plans/s03-log-measurement-session.md, "Plages physiologiques et
 * libellés"). This enum is the single source of that order — src/lib/
 * measurements.ts (task 3) derives its catalog from measurementKind.
 * enumValues rather than redeclaring the list.
 */
export const measurementKind = pgEnum("measurement_kind", [
  "weight_kg",
  "shoulders_cm",
  "chest_cm",
  "biceps_cm",
  "waist_cm",
  "hips_cm",
  "thigh_cm",
  "calf_cm",
  "body_fat_pct",
  "muscle_pct",
]);

/**
 * ADR 020: the redesign draws a sexed silhouette, so the profile has to
 * know which one. Two values, not a free-text field: this drives an
 * asset choice (public/silhouettes/{homme,femme}.svg) and a label
 * geometry table, both of which are enumerable by construction. It is
 * deliberately NOT called "gender" — nothing here is about identity, it
 * selects a drawing.
 */
export const profileSex = pgEnum("profile_sex", ["male", "female"]);

export const measurementSessions = pgTable("measurement_sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  measuredOn: date("measured_on", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => measurementSessions.id, { onDelete: "cascade" }),
    kind: measurementKind("kind").notNull(),
    // ADR 004: numeric columns must be read as numbers, never as the
    // driver's raw string ("72.40") — that string silently breaks every
    // delta and chart axis downstream. precision 5, scale 1 matches the
    // design system's display format (one decimal, e.g. "82,4 kg").
    value: numeric("value", {
      precision: 5,
      scale: 1,
      mode: "number",
    }).notNull(),
  },
  (t) => [
    // A session cannot carry two rows for the same measurement kind.
    unique("measurements_session_kind_unique").on(t.sessionId, t.kind),
    // Vide is not zéro (repo-wide trap): no measurement can ever be stored
    // as 0, at the storage level, not just the app's parsing layer.
    check("measurements_value_positive", sql`${t.value} > 0`),
  ],
);

/**
 * One row per user, holding the reference height that s04's BMI is
 * derived from at read time — never a stored BMI (criterion 5, the
 * story's structural lock). Room left for s08's target_weight_kg as a
 * second nullable column on this same row (plan, "Ce que s04 ne fait
 * pas") — one column per preference, never a key/value table.
 *
 * userId is the primary key (one profile per user) and carries a real
 * .references() toward neon_auth."user" (ADR 015, superseding ADR 014):
 * authUser stays a non-exported const, exactly as
 * measurement_sessions.user_id already does above, and drizzle-kit emits
 * the FK without ever touching neon_auth — ADR 014's claim that exporting
 * authUser was required for this was measured wrong (spike, review
 * finding 1).
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUser.id, { onDelete: "cascade" }),
    // R5/R6: nullable until the user sets it; precision 4, scale 1 covers
    // 0.0-999.9 cm, comfortably wider than the CHECK below. mode: "number"
    // is the same non-negotiable trap guard as measurements.value (ADR 004).
    heightCm: numeric("height_cm", {
      precision: 4,
      scale: 1,
      mode: "number",
    }),
    // s08 task 2, decision 9: precision 5, scale 1 — identical to
    // measurements.value, not a wider precision. A target stored more
    // precisely than the weight it's compared against can make "cible
    // atteinte" and a non-zero displayed gap both true on the same card
    // (re-measured in the plan's own revision: 70.05 vs 70.0 rounds to a
    // "-0" gap while the label still reads "70,1 kg"). Nullable, no
    // default: criterion 4 requires no target to exist unless the user
    // sets one, including at the storage level.
    targetWeightKg: numeric("target_weight_kg", {
      precision: 5,
      scale: 1,
      mode: "number",
    }),
    // ADR 020, onboarding. Nullable at the storage level — the column is
    // added to rows that already exist, and Postgres has no way to
    // invent a value for them. "Mandatory" is enforced one layer up, by
    // the onboarding gate (src/lib/onboarding.ts): a profile missing any
    // of height/sex/start date cannot reach the app's screens. Making
    // the column NOT NULL instead would have meant either a fabricated
    // default (a lie about the user's body) or a migration that fails on
    // the first existing row.
    sex: profileSex("sex"),
    // The day the transformation started — the origin of the home
    // screen's "J+42". `mode: "string"` for the same reason
    // measurement_sessions.measured_on uses it: a calendar day is not an
    // instant, and routing it through a JS Date reintroduces the
    // timezone shift that turns "4 août" into "3 août" for anyone west
    // of UTC.
    transformationStartedOn: date("transformation_started_on", {
      mode: "string",
    }),
  },
  (t) => [
    // Doubles src/lib/height.ts's HEIGHT_MIN_CM/HEIGHT_MAX_CM at the
    // storage level (R6) — a NULL height_cm satisfies this constraint
    // (Postgres never fails a CHECK on NULL), so an unset profile is
    // still insertable.
    check("profiles_height_cm_range", sql`${t.heightCm} between 80 and 260`),
  ],
);
