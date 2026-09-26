/**
 * Preset populations for the Module 5 sampling visualisation
 * (`SamplingDistribution`).
 *
 * Each preset is a population the student has already met in Module 4, so the
 * only new idea on screen is what happens to the *mean of a sample* drawn from
 * it. The three shapes are chosen for what they teach about the central limit
 * theorem:
 *
 *   - Normal: the sample mean is exactly Normal for every sample size.
 *   - Uniform: flat, but the sample means turn bell-shaped almost at once.
 *   - Exponential: strongly skewed, so the bell only appears as n grows.
 */

/**
 * The shape of a population, with the parameters that fix it. The viz reads
 * the population mean, standard deviation, density and a random draw from
 * this, so a new shape only needs a case added there.
 */
export type Population =
  | { kind: "normal"; mu: number; sigma: number }
  | { kind: "uniform"; a: number; b: number }
  | { kind: "exponential"; lambda: number };

/** A population the `SamplingDistribution` viz can open at. */
export interface SampleMeanPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example the population comes from, shown in the read-out. */
  source: string;
  population: Population;
  /**
   * The visible stretch of the x-axis, shared by the population chart and the
   * sample-mean chart below it. It never rescales when n changes: against a
   * fixed axis the sample means are *seen* to bunch up as n grows.
   */
  view: [number, number];
  /** Sample size the viz opens at. */
  startN: number;
  /** Axis caption naming what one value in the population measures. */
  axisLabel: string;
  /**
   * What taking one sample *is*, in the language of the example, as a
   * function of n: "Time 40 trips", not "Draw a sample".
   */
  drawOne: (n: number) => string;
  /** What one value in the population is, singular, e.g. "tub". */
  item: string;
  /** How to render a value on the axis and in the read-out. */
  format: (x: number) => string;
}

/**
 * Populations for `SamplingDistribution`, used in Module 5, WU1
 * (`m5-sampling-distribution`).
 */
export const SAMPLE_MEAN_PRESETS: SampleMeanPreset[] = [
  {
    id: "travel",
    label: "Travel times",
    // Example 1A gives σ = 1.4 and n = 40 but, being about estimation, never
    // says what μ is. The simulation has to pick a true value to sample
    // from; 18 sits close to the sample mean the example works out.
    source: "Example 1A, true mean set to 18",
    population: { kind: "normal", mu: 18, sigma: 1.4 },
    view: [13, 23],
    startN: 40,
    axisLabel: "travelling time to university, in minutes",
    drawOne: (n) => `Time ${n} ${n === 1 ? "trip" : "trips"}`,
    item: "trip",
    format: (x) => x.toFixed(2),
  },
  {
    id: "margarine",
    label: "Margarine",
    source: "Module 4, Example 12A: X ~ U(495, 510)",
    population: { kind: "uniform", a: 495, b: 510 },
    view: [492.5, 512.5],
    startN: 5,
    axisLabel: "mass of a tub, in grams",
    drawOne: (n) => `Weigh ${n} ${n === 1 ? "tub" : "tubs"}`,
    item: "tub",
    format: (x) => x.toFixed(1),
  },
  {
    id: "bulbs",
    label: "Light bulbs",
    // λ = 1/1000, so both μ and σ are 1000 hours.
    source: "Module 4, Example 12C: mean life 1000 hours",
    population: { kind: "exponential", lambda: 1 / 1000 },
    // Cuts off the far right tail (about 3% of single bulbs outlast 3500
    // hours). Those draws still count in the tally; they are just off-chart.
    view: [0, 3500],
    startN: 2,
    axisLabel: "lifetime of a bulb, in hours",
    drawOne: (n) => `Test ${n} ${n === 1 ? "bulb" : "bulbs"}`,
    item: "bulb",
    format: (x) => x.toFixed(0),
  },
];
