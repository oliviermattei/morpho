// @vitest-environment node
//
// Plan task 1, decision 1 bis: drizzle-kit serializes a schema file's
// *exports*, not its module-scope consts, to decide what to migrate. The
// generated SQL is the only thing that proves authUser stayed a
// non-exported const — schemaFilter: ["public"] does not guarantee it
// (spike, decision 1 bis).
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { measurementKind, measurements, profiles } from "./schema";

const DRIZZLE_DIR = resolve(import.meta.dirname, "..", "..", "..", "drizzle");
const SCHEMA_FILE = resolve(import.meta.dirname, "schema.ts");

function readGeneratedSql(): string {
  const sqlFiles = readdirSync(DRIZZLE_DIR).filter((name) =>
    name.endsWith(".sql"),
  );
  return sqlFiles
    .map((name) => readFileSync(resolve(DRIZZLE_DIR, name), "utf8"))
    .join("\n");
}

describe("schema — generated migration", () => {
  it("references neon_auth.user's uuid id, without ever creating neon_auth", () => {
    const sql = readGeneratedSql();

    expect(sql).toContain('REFERENCES "neon_auth"."user"("id")');
    // Decision 1 bis: this is what locks the point schemaFilter does not —
    // an exported authUser makes drizzle-kit emit these two lines despite
    // schemaFilter: ["public"].
    expect(sql).not.toContain("CREATE SCHEMA");
    expect(sql).not.toContain('CREATE TABLE "neon_auth"');
  });

  it("emits the unique and check constraints on measurements", () => {
    const sql = readGeneratedSql();

    expect(sql).toContain(
      'CONSTRAINT "measurements_session_kind_unique" UNIQUE',
    );
    expect(sql).toContain(
      'CONSTRAINT "measurements_value_positive" CHECK ("measurements"."value" > 0)',
    );
  });
});

describe("schema — measurements.value is read as a number", () => {
  it("maps the driver's string representation to a number (ADR 004)", () => {
    // The trap: a numeric column without `mode: "number"` returns the raw
    // driver string ("72.40"), which silently breaks every delta and chart
    // axis downstream.
    expect(measurements.value.mapFromDriverValue("72.40")).toBe(72.4);
  });
});

// Plan task 5, corrected by ADR 015 (superseding ADR 014): profiles.user_id
// targets neon_auth."user"(id) with a real database-level FK, exactly like
// measurement_sessions.user_id above — authUser stays a non-exported const,
// so the "no CREATE TABLE neon_auth" guard at the top of this file still
// covers profiles's own migration too.
describe("schema — profiles table (task 5, FK added per ADR 015)", () => {
  it("generates a profiles table with a height_cm CHECK and a cascading FK to neon_auth.user, never a CREATE TABLE for neon_auth", () => {
    const sql = readGeneratedSql();

    expect(sql).toContain('CREATE TABLE "profiles"');
    expect(sql).toContain('"user_id" uuid PRIMARY KEY NOT NULL');
    expect(sql).toContain('"height_cm" numeric(4, 1)');
    expect(sql).toContain('CONSTRAINT "profiles_height_cm_range" CHECK');
    // ADR 015: profiles.user_id now carries the same FK shape as
    // measurement_sessions.user_id — a separate ALTER TABLE statement,
    // cascading, and still no CREATE TABLE/CREATE SCHEMA for neon_auth
    // (asserted at the top of this file already, re-asserted here so this
    // describe block proves it on its own).
    expect(sql).toContain(
      'ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade',
    );
    expect(sql).not.toContain('CREATE TABLE "neon_auth"');
  });

  it("maps height_cm to a number, never the driver's raw string (ADR 004's trap, reproduced for profiles)", () => {
    expect(profiles.heightCm.mapFromDriverValue("175.0")).toBe(175);
  });

  // Criterion 5, made structural rather than merely behavioral: BMI is
  // never a column, in the schema or in any generated migration. Matches
  // a quoted column-name identifier ("bmi", "imc_value", …) — the form
  // every Drizzle column declaration and every generated DDL statement
  // uses — rather than a bare word, which would also flag this file's
  // own docstrings talking *about* BMI.
  it("never declares a bmi/imc column, in the schema source or in any generated migration", () => {
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");
    const sql = readGeneratedSql();
    const columnNamePattern = /"(bmi|imc)\w*"/i;

    expect(schemaSource).not.toMatch(columnNamePattern);
    expect(sql).not.toMatch(columnNamePattern);
  });
});

// Plan s08 task 2, decision 9 (correcting the plan's own first-draft
// numeric(5, 2)): target_weight_kg must share measurements.value's exact
// precision (5, 1) — a target stored to a second decimal that the last
// weight (precision 5, 1) can never match makes "cible atteinte" and a
// non-zero displayed gap true on the same card at once.
describe("schema — profiles.target_weight_kg (s08 task 2)", () => {
  it("generates a nullable numeric(5, 1) column with no default", () => {
    const sql = readGeneratedSql();

    expect(sql).toContain('"target_weight_kg" numeric(5, 1)');
    // Nullable and defaultless: the generated column definition must not
    // carry NOT NULL or DEFAULT for this column specifically. Matched on
    // the column's own line, not the whole file, so a NOT NULL on a
    // different column doesn't produce a false pass.
    const columnLine = sql
      .split("\n")
      .find((line) => line.includes('"target_weight_kg"'));
    expect(columnLine).toBeDefined();
    expect(columnLine).not.toMatch(/NOT NULL/i);
    expect(columnLine).not.toMatch(/DEFAULT/i);
  });

  it("maps the driver's string representation to a number (ADR 004's trap, reproduced for the target)", () => {
    expect(profiles.targetWeightKg.mapFromDriverValue("70.0")).toBe(70);
  });

  it("still never emits a CREATE TABLE for neon_auth", () => {
    const sql = readGeneratedSql();

    expect(sql).not.toContain('CREATE TABLE "neon_auth"');
  });
});

describe("schema — measurement_kind enum", () => {
  it("exposes exactly the 10 expected kinds, in the design's entry order", () => {
    expect(measurementKind.enumValues).toEqual([
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
  });
});
