import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSessionForUser } from "@/lib/db/sessions";
import { sessionIdSchema } from "@/lib/measurements";
import { routes } from "@/lib/routes";
import { formatSessionDate } from "@/lib/date";
import { MeasurementSessionForm } from "@/components/MeasurementSessionForm";
import { DeleteSessionDialog } from "@/components/DeleteSessionDialog";
import { FieldSeparator } from "@/components/ui/field";

// Every page calling getAuth() needs this (s01/s02/s03 precedent,
// reproduced by every authenticated screen so far).
export const dynamic = "force-dynamic";

/**
 * s09 plan task 8: the edit screen, the first dynamic segment in the
 * project. Signature annotated EXPLICITLY as `Promise<{ id: string }>`,
 * never `PageProps<'/historique/[id]'>` — that helper is written by the
 * typegen into `.next/types/routes.d.ts`, which doesn't know this route
 * yet the first time this file is typechecked (trap 9).
 *
 * Order (s06 decision 17, reproduced): the auth session is read and
 * redirected on FIRST, outside any try — matching every other
 * authenticated page in this project (defense in depth; the proxy is
 * only a configuration). The segment id is parsed and the session read
 * only after identity is established, so a malformed or forged id never
 * gets a chance to reveal anything to an anonymous visitor.
 */
export default async function SessionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data } = await getAuth().getSession();
  if (!data?.user) {
    redirect(routes.signIn);
  }

  const { id } = await params;
  const parsedId = sessionIdSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const db = getDb();
  const session = await getSessionForUser(db, {
    sessionId: parsedId.data,
    userId: data.user.id,
  });
  // R6: a nonexistent session and someone else's session render the
  // identical not-found.tsx — never a distinct "not yours" message.
  if (!session) {
    notFound();
  }

  const measurementCount = Object.keys(session.measurements).length;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-6">
      <Link
        href={routes.history}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
      >
        ‹ Historique
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Modifier la session
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatSessionDate(session.measuredOn, "UTC")}
        </p>
      </div>

      <MeasurementSessionForm
        mode="edit"
        sessionId={session.id}
        measuredOn={session.measuredOn}
        recorded={session.measurements}
      />

      <FieldSeparator />

      {/* D4: the danger zone — only reached after the primary action,
          preceded by a warning line naming what is lost. */}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Supprimer cette session la retire définitivement de l&apos;historique,
          de la silhouette et des graphes.
        </p>
        <DeleteSessionDialog
          sessionId={session.id}
          measuredOn={session.measuredOn}
          measurementCount={measurementCount}
        />
      </div>
    </main>
  );
}
