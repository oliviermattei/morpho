"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Clock, Home, Plus, User } from "lucide-react";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * ADR 020: the redesign's navigation — four destinations at the thumb
 * and a central action button, replacing AppHeader's top dropdown.
 *
 * The design draws the bar as a fixed 390px-wide SVG whose top edge dips
 * into a notch around the button. Authored at one width, that path is
 * wrong on every other screen — stretched or truncated. But only the
 * notch itself has a fixed size: the button never grows. So the bar's
 * background is three pieces in a row — a flexible left half, a fixed
 * NOTCH_W-wide SVG, a flexible right half — and the seam is invisible
 * because all three carry the same 1px border along y = 0.5: `border-t`
 * on the halves, a stroked path in the middle.
 *
 * The path's geometry is derived once in NOTCH, from the button: the
 * cut-out circle is centred on the button's own centre (NOTCH_CX,
 * NOTCH_CY — 4px below the bar's top edge, the button being 56px tall and
 * pulled up 24px) with NOTCH_GAP of clearance around it, and it meets the
 * flat border through a FILLET_R convex fillet on each side, tangent to
 * both. Tangency is what makes it read as one continuous line rather than
 * three shapes; see notchPath() for the two contact points.
 *
 * `pb-[env(safe-area-inset-bottom)]` is not cosmetic: without it the
 * whole row sits under the iPhone home indicator once the PWA is
 * installed and running fullscreen (s10).
 */

const BUTTON_SIZE = 56;
const BUTTON_LIFT = 24; // -top-6 on the button below
const NOTCH_GAP = 6; // clearance between the button and the cut-out edge
const NOTCH_R = BUTTON_SIZE / 2 + NOTCH_GAP;
const NOTCH_CY = BUTTON_SIZE / 2 - BUTTON_LIFT; // 4px below the bar's top edge
const FILLET_R = 10;
const NOTCH_W = 120;
const NOTCH_H = 44; // > NOTCH_CY + NOTCH_R: the arc's lowest point must fit
const NOTCH_CX = NOTCH_W / 2;
const STROKE = 1;
const BASELINE = STROKE / 2; // the border's centreline, so the 1px stroke
// lands on the same row of pixels as the halves' border-t

/**
 * The notch's top contour, left edge to right edge of the SVG piece.
 *
 * Each fillet is a FILLET_R circle tangent to the baseline (contact at
 * `fx`) and externally tangent to the cut-out circle (contact at
 * `cx`/`cy`) — the distance between their centres is therefore
 * NOTCH_R + FILLET_R, which fixes `fx`. Sharing a tangent at both ends is
 * what removes any visible corner where the three arcs meet.
 */
function notchTopPath(): string {
  const dy = FILLET_R - NOTCH_CY;
  const dx = Math.sqrt((NOTCH_R + FILLET_R) ** 2 - dy ** 2);
  const fx = NOTCH_CX - dx;
  const cx = fx + (FILLET_R * dx) / (NOTCH_R + FILLET_R);
  const cy = BASELINE + FILLET_R - (FILLET_R * dy) / (NOTCH_R + FILLET_R);
  const r = (n: number) => Number(n.toFixed(3));

  return [
    `M 0 ${BASELINE}`,
    `L ${r(fx)} ${BASELINE}`,
    // Down into the notch, convex — the flat line bending away.
    `A ${FILLET_R} ${FILLET_R} 0 0 1 ${r(cx)} ${r(cy)}`,
    // Around the button, concave, passing under it (sweep 0).
    `A ${NOTCH_R} ${NOTCH_R} 0 0 0 ${r(NOTCH_W - cx)} ${r(cy)}`,
    `A ${FILLET_R} ${FILLET_R} 0 0 1 ${r(NOTCH_W - fx)} ${BASELINE}`,
    `L ${NOTCH_W} ${BASELINE}`,
  ].join(" ");
}

const NOTCH_TOP = notchTopPath();
// Same contour, closed along the bottom of the box: the fill below the
// line. Only NOTCH_TOP is stroked, so the closing edges stay invisible.
const NOTCH_FILL = `${NOTCH_TOP} L ${NOTCH_W} ${NOTCH_H} L 0 ${NOTCH_H} Z`;

const DESTINATIONS = [
  { href: "/", label: "Accueil", Icon: Home },
  { href: routes.charts, label: "Graphes", Icon: BarChart3 },
  { href: routes.history, label: "Historique", Icon: Clock },
  { href: routes.profile, label: "Profil", Icon: User },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  // "/" would prefix-match every route, so it is compared exactly. The
  // others match their sub-routes too, so /historique/<id> still lights
  // up "Historique" while the user edits a session.
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Fill + top border, in three pieces: the halves stretch, the notch
          does not. Both halves must stay `flex-1` — that is what keeps the
          SVG centred on the button, whatever the screen width. */}
      <div aria-hidden="true" className="absolute inset-0 flex">
        <div className="flex-1 border-t border-border bg-card" />

        <div className="relative shrink-0" style={{ width: NOTCH_W }}>
          <svg
            viewBox={`0 0 ${NOTCH_W} ${NOTCH_H}`}
            width={NOTCH_W}
            height={NOTCH_H}
            className="absolute top-0 left-0 block"
          >
            <path d={NOTCH_FILL} className="fill-card" />
            <path
              d={NOTCH_TOP}
              fill="none"
              className="stroke-border"
              strokeWidth={STROKE}
            />
          </svg>
          {/* Below the SVG box the notch is over; the fill just continues. */}
          <div
            className="absolute inset-x-0 bottom-0 bg-card"
            style={{ top: NOTCH_H }}
          />
        </div>

        <div className="flex-1 border-t border-border bg-card" />
      </div>

      <div className="relative mx-auto grid h-16 max-w-[430px] grid-cols-5 items-center px-2">
        {DESTINATIONS.slice(0, 2).map(({ href, label, Icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(pathname, href)}
          />
        ))}

        {/* The middle column stays empty — the button below is absolutely
            positioned so it can overflow the bar's top edge. */}
        <div aria-hidden="true" />

        {DESTINATIONS.slice(2).map(({ href, label, Icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(pathname, href)}
          />
        ))}

        <Link
          href={routes.entry}
          aria-label="Saisir une mesure"
          className="absolute -top-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      // min-h-11 rather than the icon's own size: the design system's
      // §Cible tactile floor is 44px, and a 23px icon is not a tap
      // target.
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 2} aria-hidden="true" />
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
}
