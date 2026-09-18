/**
 * Random samplers for the simulation-driven visualisations.
 *
 * The Module 4 distribution viz do not just draw a formula: the student runs
 * the experiment and watches the observed results pile up against the theory,
 * the same idea `RandomTrials` uses for the law of large numbers. These are
 * the draws behind that.
 *
 * Everything here uses `Math.random`, which is fine for teaching: we need
 * plausible randomness on screen, not cryptographic quality or a reproducible
 * seed.
 */

/**
 * One draw from the Uniform distribution on (a, b).
 */
export function sampleUniform(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
