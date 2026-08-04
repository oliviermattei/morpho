import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

// Unprotected on purpose (s01 acceptance criterion 4): this route proves the
// server can reach Neon, it never returns data. Not cached — every request
// must hit the database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    await sql`select 1`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // Never surface the raw error or the host: it could contain the
    // connection string (research, Trap 3). Same rule applies to the log
    // line below — a fixed message only, never the error itself — so an
    // infra failure is traced without ever risking the secret in
    // production logs (review s01 second pass, finding E).
    console.error("[health] database check failed");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
