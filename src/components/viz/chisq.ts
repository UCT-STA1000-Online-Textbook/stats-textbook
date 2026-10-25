/**
 * Chi-squared distribution maths for the goodness-of-fit unit
 * (`m5-goodness-of-fit`) and its `GoodnessOfFit` viz. The companion of
 * `tdist.ts`, whose log-gamma function it shares.
 *
 * The unit replaces the textbook's printed χ² tables with Excel, so the panel
 * has to produce the numbers Excel does: CHISQ.DIST.RT and CHISQ.INV.RT, to
 * the three or four decimals the read-outs print. The cumulative function is
 * the regularised lower incomplete gamma function P(k/2, x/2); the inverse is
 * found by bisection, as `tInv` does for t.
 */

import { logGamma } from "./tdist";

/** Density f(x) of the χ²-distribution with `df` degrees of freedom. */
export function chiSqPdf(x: number, df: number): number {
  if (x <= 0) return 0;
  const k = df / 2;
  return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.LN2 - logGamma(k));
}

/**
 * Regularised lower incomplete gamma function P(a, x), by its series for
 * x < a + 1 and by a continued fraction (modified Lentz) otherwise, as in
 * Numerical Recipes (`gammp`). Each converges fast on its own side.
 */
function lowerGammaRegularised(a: number, x: number): number {
  if (x <= 0) return 0;
  const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * front;
  }
  const TINY = 1e-300;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-15) break;
  }
  return 1 - front * h;
}

/**
 * Area to the right of x under the χ²-distribution with `df` degrees of
 * freedom: Excel's =CHISQ.DIST.RT(x, df).
 */
export function chiSqRightTail(x: number, df: number): number {
  return 1 - lowerGammaRegularised(df / 2, x / 2);
}

/**
 * The value with probability p to its right: Excel's =CHISQ.INV.RT(p, df),
 * so the 5% point of χ²₄ is `chiSqInvRT(0.05, 4)` = 9.488.
 */
export function chiSqInvRT(p: number, df: number): number {
  let lo = 0;
  let hi = 1000;
  // 70 halvings of a width-1000 interval leave it far below 1e-12.
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (chiSqRightTail(mid, df) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
