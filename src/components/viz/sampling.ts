/**
 * Random samplers for the simulation-driven visualisations.
 *
 * The Module 4 distribution viz do not just draw a formula: the student runs
 * the experiment and watches the observed frequencies pile up against the
 * theory, the same idea `RandomTrials` uses for the law of large numbers.
 * These are the draws behind that.
 *
 * Everything here uses `Math.random`, which is fine for teaching: we need
 * plausible randomness on screen, not cryptographic quality or a reproducible
 * seed.
 */

/**
 * One draw from the Binomial distribution B(n, p): the number of successes in
 * n independent trials.
 *
 * Simulated as n actual Bernoulli trials rather than by inverting the
 * cumulative function, because n is small here (at most 20) and because the
 * individual successes and failures are themselves shown on screen: the
 * mouse-maze viz lights up which of the 8 mice got out.
 */
export function sampleBinomialTrials(n: number, p: number): boolean[] {
  const out = new Array<boolean>(n);
  for (let i = 0; i < n; i++) out[i] = Math.random() < p;
  return out;
}

/**
 * One draw from the Exponential distribution with rate λ, by inverting the
 * cumulative function: if U is uniform on (0, 1) then −ln(U)/λ is Exponential.
 *
 * `Math.random()` can return exactly 0, whose log is −∞, so the draw is taken
 * from 1 − U instead, which lies in (0, 1].
 */
export function sampleExponential(lambda: number): number {
  return -Math.log(1 - Math.random()) / lambda;
}

/**
 * One draw from the Uniform distribution on (a, b).
 */
export function sampleUniform(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
