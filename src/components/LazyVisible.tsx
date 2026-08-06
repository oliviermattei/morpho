"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface LazyVisibleProps {
  children: ReactNode;
  /**
   * Shown in the children's place until they mount. It must reserve the
   * same height, or every reveal shifts the content below it — on a
   * scrolling page that means the reveal moves the very thing the user
   * is reading.
   */
  fallback: ReactNode;
  /**
   * How far ahead of the viewport to start mounting. The default trades
   * a little eagerness for the reveal never being visible: on a phone,
   * 300px is roughly the next flick of the thumb.
   */
  rootMargin?: string;
  className?: string;
}

/**
 * Mounts its children the first time they come near the viewport, and
 * keeps them mounted afterwards.
 *
 * /graphes renders eleven charts — four carousel slides plus seven
 * mensurations — and Recharts is not cheap per instance: each one builds
 * an SVG, an axis scale and a tooltip layer on mount. Mounting all eleven
 * to show the two that fit on a phone screen is most of that work spent
 * on nothing.
 *
 * Note what this does NOT do: it fetches nothing. The series already
 * arrive whole from the Server Component in a single query (R7), so this
 * is purely about when the DOM for them is built — nothing is in flight
 * behind the placeholder, and with the default rootMargin the reveal
 * happens before the slot is ever on screen.
 *
 * Never unmounts once revealed. Scrolling back up must not throw away a
 * chart the user already saw, and re-mounting on every pass would make
 * scrolling more expensive than the eager render this replaces.
 */
export function LazyVisible({
  children,
  fallback,
  rootMargin = "300px",
  className,
}: LazyVisibleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (isRevealed) return;

    const element = containerRef.current;
    if (!element) return;

    // No IntersectionObserver — an old browser, or a rendering path that
    // has no viewport at all — means "reveal everything now". Degrading
    // to a page of permanent placeholders would be worse than the eager
    // render this optimises.
    //
    // Scheduled rather than set right here, for two independent reasons.
    // A synchronous setState in an effect body is a cascading render
    // (react-hooks/set-state-in-effect), and `isRevealed` cannot simply
    // START true either: this component server-renders, where the API is
    // always missing, so the first client render has to produce the same
    // fallback the server did or hydration mismatches.
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setIsRevealed(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsRevealed(true);
        // Disconnected here rather than left to the cleanup: the effect
        // does not re-run on this state change (isRevealed guards the
        // top), so nothing else would stop it observing.
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [isRevealed, rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {isRevealed ? children : fallback}
    </div>
  );
}
