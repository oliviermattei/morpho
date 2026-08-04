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
        {/* "J+42 depuis le début" — the counter alone never said what it
            counted from, and "J+42 · Stabilisation" read as though the
            two halves were one measurement. The phase moves to its own
            line so neither has to be abbreviated on a narrow phone. */}
        <p className="flex flex-col items-end text-xs leading-tight text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">
              {formatDayCounter(days)}
            </span>{" "}
            depuis le début
          </span>
          <span>{PHASE_LABELS[phase]}</span>
        </p>
      </header>
      <OfflineBanner />
    </>
  );
}
