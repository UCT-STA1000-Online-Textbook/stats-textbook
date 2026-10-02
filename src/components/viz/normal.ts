/**
 * Normal-distribution maths shared by the visualisations that draw or test
 * against a Normal curve: `NormalExplorer` (Module 4), `SamplingDistribution`,
 * `ConfidenceIntervals` and `ZTest` (Module 5).
 *
 * Kept in one place so every panel computes Φ(z) the same way and agrees with
 * Excel's NORM.S.DIST to the four decimals the read-outs print.
 */

/**
 * Cumulative probability Φ(z) of the standard Normal distribution.
 *
 * There is no closed form, so this uses Hart's rational approximation as
 * published by West (2005), which is accurate to about 15 decimal places:
 * far past the four the read-out prints, so the panel agrees with Excel's
 * NORM.S.DIST to the last digit shown.
 */
export function normalCdf(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const x = Math.abs(z);
  let tail: number;
  if (x > 37) {
    tail = 0;
  } else {
    const e = Math.exp((-x * x) / 2);
    if (x < 7.07106781186547) {
      let num = 3.52624965998911e-2 * x + 0.700383064443688;
      num = num * x + 6.37396220353165;
      num = num * x + 33.912866078383;
      num = num * x + 112.079291497871;
      num = num * x + 221.213596169931;
      num = num * x + 220.206867912376;
      let den = 8.83883476483184e-2 * x + 1.75566716318264;
      den = den * x + 16.064177579207;
      den = den * x + 86.7807322029461;
      den = den * x + 296.564248779674;
      den = den * x + 637.333633378831;
      den = den * x + 793.826512519948;
      den = den * x + 440.413735824752;
      tail = (e * num) / den;
    } else {
      // Far tail: a continued fraction converges faster than the rational form.
      let b = x + 0.65;
      b = x + 4 / b;
      b = x + 3 / b;
      b = x + 2 / b;
      b = x + 1 / b;
      tail = e / b / 2.506628274631;
    }
  }
  return z > 0 ? 1 - tail : tail;
}

/** Normal density f(x) for N(μ, σ²). */
export function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}
