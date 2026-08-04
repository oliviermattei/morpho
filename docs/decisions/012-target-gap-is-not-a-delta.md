# ADR 012 — The gap to a weight target is not a progress delta

- Status: accepted
- Date: 2026-08-03
- Scope: story s08

## Context

`docs/design-system.md` §Format numérique declares that a delta is always
qualified by a verdict glyph — `▲` progress, `▼` setback — and §Silhouette
et progression declares `weight_kg`'s favorable direction as `↓` ("perte de
poids", the PRD's objective). Both rules are written for the silhouette's
own deltas: "how has this measurement changed since the first one I ever
recorded".

s08 introduces a second, different number on the same weight: the gap
between the last recorded weight and a target the user chose themselves —
`écart = dernier poids − cible`. Applying the silhouette's convention
literally would color that gap and prefix it with a verdict glyph, exactly
like a progress delta.

That would misread the number. A delta answers "have I progressed since I
started measuring". A target gap answers "where do I stand relative to a
number I picked" — the two are independent. A user two kilograms above
their target could have lost six kilograms in the same month: `+2,1 kg`
above the target is not a setback if the trend is favorable, and the app
has no way to tell which is true from the gap alone. Coloring it, or
prefixing it with `▼`, would assert a verdict the data doesn't support.

## Decision

**The gap to the target carries no verdict glyph and no progress color,
ever** — not `--progress-favorable`, not `--progress-adverse`, not the
`▲`/`▼` glyphs. It renders as a plain signed number
(`+2,1 kg`, `-0,9 kg`, `0,0 kg`), through the same formatter the rest of
the app's signed deltas use (`signDisplay: 'exceptZero'`), but without the
glyph step that formatter's callers apply for progress deltas. "Cible
atteinte" is the only qualifying text, shown exactly when the rounded gap
is `0`, in neutral wording — never "en avance", "en retard", or
"dépassée".

The glyph and the progress-color tokens stay exactly as declared for every
other delta on the silhouette (s06) — this decision narrows their *scope*,
it does not repeal them.

## Considered options

- **Reuse the silhouette's delta convention as-is** (glyph + progress
  color, `weight_kg`'s declared `↓` direction) — rejected. It would assert
  a verdict about the user's actual trend that the gap-to-target number
  cannot support, and it would contradict the design of s08 (state B4:
  "affiché exactement comme un écart positif", rule 6: no vocabulary of
  delay or advance).
- **Give the target gap its own, different color scheme (e.g. a third
  progress token)** — rejected. It would still assert a verdict, just with
  a different color; the actual problem (a single-number gap cannot know
  the recent trend) isn't solved by picking a different palette. It would
  also add a token the design system has no other use for.
- **No verdict, no color, but still glyph-prefixed for visual consistency
  with other deltas** — rejected. The glyph on its own already reads as a
  verdict marker throughout this app (design system: "précédé du glyphe de
  verdict") — reusing it here without the color would still mislead a
  reader who has learned that convention from every other screen.

## Consequences

Easier: the target-gap rendering never needs to know or infer a trend —
it only ever formats one already-computed, already-rounded number
(`formatTargetGap`, s08 task 3), with no branching on direction.

Harder: two visually similar numbers on the same card (a progress delta,
if one were ever added next to a target gap) would need distinct visual
treatment to stay unambiguous. Not a current conflict — s08 never renders
a delta and a target gap side by side — but a future story adding one
must not silently borrow the other's styling.

To watch: if the product ever declares an explicit direction for a target
(e.g. "this is a weight-loss goal"), reopening the glyph/color question is
a new decision, not a silent extension of this one — the target gap's
neutrality is a deliberate scope boundary, not an oversight to fix later
by default.
