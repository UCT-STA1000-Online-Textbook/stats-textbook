/**
 * Least-squares straight-line fitting for the Module 5 WU10 regression viz
 * (`LeastSquares` and `SlopeSampling`). It returns the same figures Excel's
 * Data Analysis ▸ Regression prints: the intercept a, the slope b, the
 * correlation r, the sum of squared residuals, and the standard error of b.
 */

/** One observed pair. */
export type Point = { x: number; y: number };

/** The least-squares line through a set of points, with the figures Excel reports. */
export interface Fit {
  /** Intercept a. */
  a: number;
  /** Slope b. */
  b: number;
  /** Sample correlation coefficient r; 0 when every y is the same. */
  r: number;
  /** Sum of squared residuals: the smallest possible for any straight line. */
  sse: number;
  /** Standard error of the slope, se(b), from n − 2 degrees of freedom. */
  seB: number;
}

/** Fits ŷ = a + bx by least squares. Needs at least three points with different x values. */
export function fitLine(points: Point[]): Fit {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  const b = sxy / sxx;
  // When every y is equal, r is 0/0. The flat line then fits perfectly and
  // there is no linear relationship to speak of, so 0 is the honest value.
  const r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  // Rounding can push a perfect fit a hair below zero.
  const sse = Math.max(0, syy - b * sxy);
  return { a: my - b * mx, b, r, sse, seB: Math.sqrt(sse / (n - 2) / sxx) };
}
