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
 * into a notch around the button. That is reproduced here with a ring of
 * page-background colour around the button instead, for one reason: the
 * SVG path is authored at a single width, and a bar that stops at 390px
 * — or one stretched with preserveAspectRatio="none" — is wrong on every
 * other screen. The ring reads identically at any width and costs no
 * geometry.
 *
 * `pb-[env(safe-area-inset-bottom)]` is not cosmetic: without it the
 * whole row sits under the iPhone home indicator once the PWA is
 * installed and running fullscreen (s10).
 */

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
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
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
          className="absolute -top-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-6 ring-background transition-transform active:scale-95"
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
