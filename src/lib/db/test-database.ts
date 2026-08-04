import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { resolve } from "node:path";

const MIGRATIONS_FOLDER = resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "drizzle",
);

export interface SeededUser {
  id: string;
  email: string;
}

export interface TestDatabase {
  db: PgliteDatabase;
  seedUser(overrides?: Partial<SeededUser>): Promise<SeededUser>;
}

/**
 * ADR 009: an in-process Postgres (PGlite), no secret required, so the
 * cross-user isolation tests (task 8) and the constraint tests in
 * test-database.test.ts stay inside `npm run check` on a fresh clone.
 *
 * This is a fixture, not a migration: neon_auth."user" is created directly
 * here with raw SQL, never through drizzle-kit. In production,
 * schemaFilter: ["public"] keeps every generated migration out of
 * neon_auth (locked by src/lib/db/schema.test.ts) — this fixture must not
 * contradict that by routing through the same migration mechanism. Only
 * `id` and `email` are declared: nothing here reads more of Neon Auth's
 * schema than the FK and task 8's tests need.
 *
 * The migration applied below is the real, generated one
 * (drizzle/*.sql) — not hand-copied DDL. If a statement in it doesn't run
 * on PGlite's Postgres build, ADR 009's explicit fallback applies: a
 * dedicated Neon database behind a separate `npm run check:db`, never
 * bending the schema to please PGlite.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client);

  await client.exec(`
    CREATE SCHEMA neon_auth;
    CREATE TABLE neon_auth."user" (
      id uuid PRIMARY KEY,
      email text NOT NULL
    );
  `);

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  async function seedUser(
    overrides: Partial<SeededUser> = {},
  ): Promise<SeededUser> {
    const user: SeededUser = {
      id: overrides.id ?? crypto.randomUUID(),
      email: overrides.email ?? `${crypto.randomUUID()}@example.test`,
    };
    await client.query(
      'INSERT INTO neon_auth."user" (id, email) VALUES ($1, $2)',
      [user.id, user.email],
    );
    return user;
  }

  return { db, seedUser };
}
