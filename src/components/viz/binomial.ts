/**
 * Binomial-distribution maths shared by the Module 4 Binomial viz:
 * `BinomialExplorer` (the worked examples) and `MouseMazeSheet` (the
 * mouse-maze spreadsheet simulation).
 */

/**
 * Probability mass function of B(n, p) for every x from 0 to n.
 *
 * Built with the recurrence p(x) = p(x−1) · (n−x+1)/x · p/(1−p) starting from
 * p(0) = (1−p)^n. Computing C(n, x) directly would overflow for larger n, and
 * this also costs one multiply per bar instead of a factorial each.
 */
export function binomialPmf(n: number, p: number): number[] {
  const q = 1 - p;
  const out = new Array<number>(n + 1);
  out[0] = Math.pow(q, n);
  for (let x = 1; x <= n; x++) {
    out[x] = (out[x - 1] * ((n - x + 1) / x) * p) / q;
  }
  return out;
}
