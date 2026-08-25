/**
 * Summary statistics for the Module 2 WU2 visualisations — the computational
 * core behind `BoxPlotBuilder` and `MeanMedianBalance`.
 *
 * Quartiles follow Excel's `QUARTILE.INC`, not the rank rules printed in
 * INTROSTAT. This is deliberate and is the convention the course adopts: the
 * lecturer's notes replace the book's half-rank arithmetic with the Excel
 * function students actually use, so every number shown on screen matches what
 * a student gets in a spreadsheet. The two methods genuinely disagree — the
 * football points of Example 13A are (29, 50, 55, 63, 79) by the book's rule
 * but (29, 50.25, 55, 62.5, 79) by `QUARTILE.INC` — so mixing them would leave
 * students unable to reproduce the textbook's own figures.
 *
 * The outlier/stray rule is INTROSTAT's (multiples of the median-to-quartile
 * distance, not the more common 1.5 × IQR), applied to the Excel quartiles.
 */

/** The five-number summary, smallest to largest: (x₍₁₎, x₍l₎, x₍m₎, x₍u₎, x₍n₎). */
export interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** How a single observation is classified by the outlier/stray rule. */
export type PointClass = "normal" | "stray" | "outlier";

/** Cut-offs produced by the outlier/stray rule, in ascending order. */
export interface SpreadBounds {
  outlierLo: number;
  strayLo: number;
  strayHi: number;
  outlierHi: number;
}

/** Outlier/stray classification of a batch, plus the fences to draw whiskers to. */
export interface OutlierReport {
  bounds: SpreadBounds;
  outliers: number[];
  strays: number[];
  /**
   * The smallest and largest observations that are *not* strays. INTROSTAT's
   * convention draws the whiskers out to these rather than to the extremes,
   * which is what isolates the flagged values visually.
   */
  fences: { lo: number; hi: number };
}

/**
 * Excel's `QUARTILE.INC(array, quart)`.
 *
 * Locates the rank `(n − 1)·p + 1` and linearly interpolates between the two
 * neighbouring observations when that rank is fractional — so a quartile need
 * not itself be an observed data value.
 *
 * @param values — the batch; need not be sorted.
 * @param p — percentile fraction in [0, 1] (0.25 for Q1, 0.5 for the median).
 */
export function quartileInc(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];

  const rank = (n - 1) * p + 1;
  const lower = Math.floor(rank);
  const frac = rank - lower;
  // A rank of exactly n lands on the last observation; guard the lookup of
  // `sorted[lower]`, which would be out of bounds there.
  if (lower >= n) return sorted[n - 1];
  return sorted[lower - 1] + frac * (sorted[lower] - sorted[lower - 1]);
}

/** Five-number summary computed with `QUARTILE.INC` for all five positions. */
export function fiveNumberSummary(values: number[]): FiveNumberSummary {
  return {
    min: quartileInc(values, 0),
    q1: quartileInc(values, 0.25),
    median: quartileInc(values, 0.5),
    q3: quartileInc(values, 0.75),
    max: quartileInc(values, 1),
  };
}

/** Arithmetic mean x̄. */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Sample variance s², using the (n − 1) divisor of the notes.
 * Returns NaN for n < 2, where the statistic is undefined.
 */
function sampleVariance(values: number[]): number {
  const n = values.length;
  if (n < 2) return NaN;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
}

/** Sample standard deviation s = √(s²). */
export function sampleSd(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

/** Range R = x₍n₎ − x₍₁₎. */
export function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

/** Interquartile range I = x₍u₎ − x₍l₎, using the Excel quartiles. */
export function interquartileRange(values: number[]): number {
  return quartileInc(values, 0.75) - quartileInc(values, 0.25);
}

/**
 * Applies INTROSTAT's outlier and stray rule to a batch.
 *
 * Outliers lie beyond `x₍m₎ ± 6 ×` (the median-to-quartile distance on that
 * side); strays lie beyond the same distance × 3 but are not outliers. Both
 * comparisons are strict (`>` / `<`), matching the notes — a value sitting
 * exactly on a cut-off is not flagged.
 *
 * Note the rule is asymmetric by construction: it measures the upper side
 * against x₍u₎ − x₍m₎ and the lower side against x₍m₎ − x₍l₎, so a skew batch
 * gets a correspondingly skew pair of cut-offs.
 */
export function classifyPoints(values: number[]): OutlierReport {
  const { q1, median, q3 } = fiveNumberSummary(values);
  const bounds: SpreadBounds = {
    outlierLo: median - 6 * (median - q1),
    strayLo: median - 3 * (median - q1),
    strayHi: median + 3 * (q3 - median),
    outlierHi: median + 6 * (q3 - median),
  };

  const outliers: number[] = [];
  const strays: number[] = [];
  const plain: number[] = [];
  for (const v of values) {
    const cls = classifyValue(v, bounds);
    if (cls === "outlier") outliers.push(v);
    else if (cls === "stray") strays.push(v);
    else plain.push(v);
  }

  const ascending = (a: number, b: number) => a - b;
  outliers.sort(ascending);
  strays.sort(ascending);
  plain.sort(ascending);

  // Whiskers run to the outermost *unflagged* values. If every observation is
  // flagged (possible only for tiny or pathological batches) fall back to the
  // extremes so the plot still draws something sensible.
  const fences =
    plain.length > 0
      ? { lo: plain[0], hi: plain[plain.length - 1] }
      : { lo: Math.min(...values), hi: Math.max(...values) };

  return { bounds, outliers, strays, fences };
}

/** Classifies one value against pre-computed bounds. */
export function classifyValue(v: number, bounds: SpreadBounds): PointClass {
  if (v > bounds.outlierHi || v < bounds.outlierLo) return "outlier";
  if (v > bounds.strayHi || v < bounds.strayLo) return "stray";
  return "normal";
}

/**
 * Formats a statistic for display: integers stay bare, everything else is
 * trimmed to at most `maxDp` decimals with trailing zeros removed, so a
 * quartile reads "50.25" and "62.5" rather than "50.25" and "62.50".
 *
 * The default of 3 decimals exists because interpolated quartiles carry more
 * precision than their data does: the Paarl rainfall is quoted to 1 decimal,
 * yet its upper quartile is exactly 26.175. Rounding that to 2 would make the
 * readout disagree with the worked answer in the unit. Pass a smaller `maxDp`
 * for statistics that don't need the extra digits, such as a mean.
 */
export function fmtStat(v: number, maxDp = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(maxDp).replace(/\.?0+$/, "");
}
