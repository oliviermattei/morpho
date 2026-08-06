import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LazyVisible } from "./LazyVisible";

// vitest.setup.ts installs a stub that reports every target as
// intersecting on sight — the right default for the rest of the suite,
// where "is the chart in the document" is the question. Here the question
// is the transition itself, so this file swaps in an observer it can fire
// by hand.
interface Controllable {
  fire: (isIntersecting: boolean) => void;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnectCount: number;
}

const observers: Controllable[] = [];
const originalIntersectionObserver = globalThis.IntersectionObserver;

function installControllableObserver() {
  class ControllableObserver {
    private readonly record: Controllable;

    constructor(
      private readonly callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.record = {
        options,
        observed: [],
        disconnectCount: 0,
        fire: (isIntersecting) => {
          const entries = this.record.observed.map(
            (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
          );
          this.callback(entries, this as unknown as IntersectionObserver);
        },
      };
      observers.push(this.record);
    }

    observe(target: Element) {
      this.record.observed.push(target);
    }
    unobserve() {}
    disconnect() {
      this.record.disconnectCount += 1;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver =
    ControllableObserver as unknown as typeof IntersectionObserver;
}

describe("LazyVisible", () => {
  beforeEach(() => {
    observers.length = 0;
    installControllableObserver();
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  it("shows the fallback and nothing else before the element comes into view", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    expect(screen.getByText("placeholder")).toBeInTheDocument();
    expect(screen.queryByText("the chart")).toBeNull();
  });

  it("swaps the fallback for the children once the element intersects", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    act(() => observers[0]!.fire(true));

    expect(screen.getByText("the chart")).toBeInTheDocument();
    expect(screen.queryByText("placeholder")).toBeNull();
  });

  it("ignores a non-intersecting report", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    act(() => observers[0]!.fire(false));

    expect(screen.getByText("placeholder")).toBeInTheDocument();
  });

  // Scrolling back past a chart must not rebuild it — re-mounting on every
  // pass would make scrolling more expensive than the eager render this
  // replaces.
  it("keeps the children mounted after the element leaves the viewport again", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    act(() => observers[0]!.fire(true));
    act(() => observers[0]!.fire(false));

    expect(screen.getByText("the chart")).toBeInTheDocument();
  });

  it("stops observing as soon as it has revealed", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    expect(observers[0]!.disconnectCount).toBe(0);
    act(() => observers[0]!.fire(true));
    expect(observers[0]!.disconnectCount).toBeGreaterThan(0);
  });

  it("asks for the margin it was given, so the reveal happens off-screen", () => {
    render(
      <LazyVisible fallback={<span>placeholder</span>} rootMargin="42px">
        <span>the chart</span>
      </LazyVisible>,
    );

    expect(observers[0]!.options?.rootMargin).toBe("42px");
  });

  it("disconnects on unmount", () => {
    const { unmount } = render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    unmount();

    expect(observers[0]!.disconnectCount).toBeGreaterThan(0);
  });

  // A browser without IntersectionObserver must get the charts, not a
  // page of placeholders that never resolve. It reveals on the next tick
  // rather than on the spot, so the first client render still matches
  // the fallback the server produced.
  it("reveals without an observer when IntersectionObserver does not exist", async () => {
    // @ts-expect-error — deleting a global is the whole point of the test.
    delete globalThis.IntersectionObserver;

    render(
      <LazyVisible fallback={<span>placeholder</span>}>
        <span>the chart</span>
      </LazyVisible>,
    );

    expect(screen.getByText("placeholder")).toBeInTheDocument();
    expect(await screen.findByText("the chart")).toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });
});
