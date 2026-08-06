import { formatDayCounter } from "@/lib/onboarding";
import { OfflineBanner } from "./OfflineBanner";

/**
 * ADR 020: replaces AppHeader on the home screen. The dropdown menu it
 * used to carry moved into BottomNav — the design puts navigation at the
 * thumb, not at the top of a 800px-tall phone screen — so what is left
 * here is identity and status, and it no longer needs to be sticky.
 *
 * OfflineBanner moves with it, unchanged: s10 mounted it "right under
 * the header", and that is still where it is.
 *
 * The transformation phase used to sit under the day counter. It is gone
 * — a second line of status the screen's own numbers already tell — and
 * with it the `phase` prop. `deriveTransformationPhase` and PHASE_LABELS
 * still exist in lib/home-summary.ts, now with no caller.
 */
export function HomeHeader({ days }: { days: number }) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
        <span className="text-xl font-bold tracking-tight text-foreground">
          morpho
        </span>
        <span className="text-xs font-bold text-foreground">
          {formatDayCounter(days)}
        </span>
      </header>
      <OfflineBanner />
    </>
  );
}
