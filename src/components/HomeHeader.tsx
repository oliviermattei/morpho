import { formatDayCounter } from "@/lib/onboarding";
import { PHASE_LABELS, type TransformationPhase } from "@/lib/home-summary";
import { OfflineBanner } from "./OfflineBanner";

/**
 * ADR 020: replaces AppHeader on the home screen. The dropdown menu it
 * used to carry moved into BottomNav — the design puts navigation at the
 * thumb, not at the top of a 800px-tall phone screen — so what is left
 * here is identity and status, and it no longer needs to be sticky.
 *
 * OfflineBanner moves with it, unchanged: s10 mounted it "right under
 * the header", and that is still where it is.
 */
export function HomeHeader({
  days,
  phase,
}: {
  days: number;
  phase: TransformationPhase;
}) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
        <span className="text-xl font-bold tracking-tight text-foreground">
          morpho
        </span>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">
            {formatDayCounter(days)}
          </span>{" "}
          · {PHASE_LABELS[phase]}
        </p>
      </header>
      <OfflineBanner />
    </>
  );
}
