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

/**
 * One draw from the Normal distribution N(μ, σ²), by the Box–Muller method:
 * two independent Uniform draws are turned into one standard Normal draw,
 * which is then shifted by μ and stretched by σ.
 *
 * As in `sampleExponential`, the first draw is taken from 1 − U so that it
 * can never be 0, whose log is −∞.
 */
export function sampleNormal(mu: number, sigma: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * One draw from the Poisson distribution with mean λ, by Knuth's method:
 * multiply Uniform draws together until the product falls below e^(−λ); the
 * number of draws needed, less one, is Poisson. Its cost grows with λ, which
 * is fine for the small rates used here (a misprint or two per page).
 */
export function samplePoisson(lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = Math.random();
  while (product > limit) {
    k += 1;
    product *= Math.random();
  }
  return k;
}

/**
 * One draw from a list of categories with the given probabilities (which
 * should add to 1), returned as the index of the category chosen. Used for
 * the T-shirt colours in the goodness-of-fit viz.
 */
export function sampleCategory(probs: number[]): number {
  let u = Math.random();
  for (let i = 0; i < probs.length - 1; i++) {
    u -= probs[i];
    if (u < 0) return i;
  }
  // Whatever is left, including any rounding in the probabilities.
  return probs.length - 1;
}
