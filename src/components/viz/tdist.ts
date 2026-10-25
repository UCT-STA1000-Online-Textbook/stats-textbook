/**
 * Student's t-distribution maths for the unknown-σ unit (`m5-unknown-sigma`)
 * and its `TDistribution` viz. The companion of `normal.ts`.
 *
 * The unit replaces the textbook's printed t-tables with Excel, so the panel
 * has to produce the same numbers Excel does: T.DIST.RT, T.DIST.2T, T.INV and
 * T.INV.2T, to the four decimals the read-outs print. The density and the
 * cumulative function below are exact formulas (through the incomplete beta
 * function); the inverse is found by bisection on the cumulative function,
 * which is slow by numerical standards but instant for one value per render.
 */

/**
 * Natural log of the gamma function, by the Lanczos approximation (g = 7,
 * 9 terms), accurate to about 15 significant figures for x > 0. Needed for
 * the constant in front of the t density and in the incomplete beta function,
 * and shared with `chisq.ts` for the χ² density and incomplete gamma function.
 */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection formula: the series below is only accurate for x ≥ 0.5.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Continued fraction for the regularised incomplete beta function, evaluated
 * by the modified Lentz method (Numerical Recipes, `betacf`).
 */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    // Even step of the fraction.
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    // Odd step.
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b), for 0 ≤ x ≤ 1. */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  // The continued fraction converges fast only on one side of the mean of
  // the Beta(a, b) distribution; on the other side use the symmetry
  // I_x(a, b) = 1 − I_(1−x)(b, a).
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(x, a, b)) / a
    : 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Density f(t) of the t-distribution with `df` degrees of freedom. */
export function tPdf(t: number, df: number): number {
  const logC = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(logC - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

/**
 * Cumulative probability Pr(T ≤ t) for the t-distribution with `df` degrees
 * of freedom: Excel's =T.DIST(t, df, TRUE).
 */
export function tCdf(t: number, df: number): number {
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  // Area in one tail beyond |t|.
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/**
 * The value with probability p to its left: Excel's =T.INV(p, df). So
 * =T.INV.2T(α, df) is `-tInv(α / 2, df)`.
 */
export function tInv(p: number, df: number): number {
  let lo = -1e3;
  let hi = 1e3;
  // 80 halvings of a width-2000 interval leave it far below 1e-12.
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
