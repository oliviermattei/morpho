/**
 * The non-chromatic explanation of the ▲/▼ glyphs (plan s06 task 5,
 * design-system.md §Silhouette et progression): "le signe ne suffit pas
 * à porter le verdict" — a reader with a red-green deficiency, or who
 * simply can't tell fill-opacity apart from --muted at a glance, still
 * learns what each glyph means from this text alone.
 */
export function BodyMapLegend() {
  return (
    <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-label-min text-muted-foreground">
      <span>
        <span className="font-semibold text-progress-favorable">▲</span>{" "}
        progrès
      </span>
      <span>
        <span className="font-semibold text-progress-adverse">▼</span> recul
      </span>
      <span>delta depuis la 1re mesure</span>
    </p>
  );
}
