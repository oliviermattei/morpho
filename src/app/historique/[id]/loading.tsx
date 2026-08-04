import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { MeasurementSessionFormSkeleton } from "@/components/MeasurementSessionFormSkeleton";

/**
 * s09 plan task 8, état 6 of the Design: reuses
 * MeasurementSessionFormSkeleton verbatim (it already reproduces the
 * exact field shape — same source, s03/s05) rather than a second one,
 * plus a disabled delete button in the danger zone's position: nothing
 * destructive is actionable until the session has actually been read.
 * No spinner anywhere.
 */
export default function SessionEditLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-6">
      <Skeleton className="h-5 w-28" />

      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      <MeasurementSessionFormSkeleton />

      <FieldSeparator />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Button type="button" variant="destructive" className="h-11 w-full" disabled>
          Supprimer la session
        </Button>
      </div>
    </main>
  );
}
