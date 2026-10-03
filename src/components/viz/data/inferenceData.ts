/**
 * Presets for the Module 5 inference visualisations, one list per viz:
 *
 *   - `SAMPLE_MEAN_PRESETS` for `SamplingDistribution` (WU1),
 *   - `CI_PRESETS` for `ConfidenceIntervals` (WU2),
 *   - `ZTEST_PRESETS` for `ZTest` (WU3 and WU4).
 *
 * Each preset carries the figures printed in its worked example, so the panel
 * and the page agree.
 *
 * The WU1 populations are ones the student has already met in Module 4, so
 * the only new idea on screen is what happens to the *mean of a sample* drawn
 * from them. The three shapes are chosen for what they teach about the
 * central limit theorem:
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

/**
 * A worked example the `ConfidenceIntervals` viz can open at (Module 5, WU2,
 * `m5-confidence-intervals`).
 *
 * The examples give σ, n and one observed x̄, but never the true μ: if we
 * knew μ we would not need an interval. The simulation has to pick one so it
 * can check which intervals catch it, so each preset sets `trueMu` close to
 * the example's x̄ and says so in `source`.
 */
export interface CiPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example this is, and the true μ the simulation assumes. */
  source: string;
  /** Known population standard deviation σ. */
  sigma: number;
  /** The population mean the simulated samples are drawn from. */
  trueMu: number;
  /** The sample mean the worked example observed, shown before any runs. */
  exampleMean: number;
  /** Sample size the viz opens at: the example's n. */
  startN: number;
  /**
   * The visible stretch of the x-axis. Fixed while n and the level change,
   * so narrower intervals are *seen* to be narrower.
   */
  view: [number, number];
  /** Spacing of the axis ticks. */
  tickStep: number;
  /** Axis caption naming what one value in the population measures. */
  axisLabel: string;
  /** What taking one sample is, in the language of the example. */
  drawOne: (n: number) => string;
}

/** Worked examples for `ConfidenceIntervals`, from Module 5, WU2. */
export const CI_PRESETS: CiPreset[] = [
  {
    id: "travel",
    label: "Travel times",
    // Same true mean as the Module 5 WU1 travel preset, so the two units
    // tell one story about the same population.
    source: "Example 1A, true mean set to 18",
    sigma: 1.4,
    trueMu: 18,
    exampleMean: 17.96,
    startN: 40,
    view: [16.6, 19.4],
    tickStep: 0.5,
    axisLabel: "mean travelling time, in minutes",
    drawOne: (n) => `Time ${n} trips`,
  },
  {
    id: "fuel",
    label: "Fuel",
    source: "Example 2B, true mean set to 6.8",
    sigma: 1.7,
    trueMu: 6.8,
    exampleMean: 6.73,
    startN: 47,
    view: [5.4, 8.2],
    tickStep: 0.5,
    axisLabel: "mean fuel used, in litres per 100 km",
    drawOne: (n) => `Test ${n} drivers`,
  },
  {
    id: "sport",
    label: "Sport spend",
    source: "Example 3C, true mean set to R170",
    sigma: 37.6,
    trueMu: 170,
    exampleMean: 168.15,
    startN: 58,
    view: [140, 200],
    tickStep: 10,
    axisLabel: "mean winter spend on sporting equipment, in rand",
    drawOne: (n) => `Ask ${n} pupils`,
  },
];

/**
 * The data a z-test is run on. A one-sample test compares one sample mean
 * with a claimed μ₀; a two-sample test compares two independent sample
 * means, with H₀: μ₁ − μ₂ = 0. All population standard deviations are known
 * (the Module 5 assumption until the unknown-σ unit).
 */
export type ZTestDesign =
  | { kind: "one"; mu0: number; sigma: number; n: number; xbar: number }
  | {
      kind: "two";
      n1: number;
      n2: number;
      sigma1: number;
      sigma2: number;
      xbar1: number;
      xbar2: number;
    };

/** Direction of H₁: μ < μ₀ ("lower"), μ > μ₀ ("upper"), or μ ≠ μ₀ ("two"). */
export type Tail = "lower" | "upper" | "two";

/** A worked example the `ZTest` viz can open at. */
export interface ZTestPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /**
   * The unit the example belongs to. The viz only offers the chips from the
   * same unit as the preset it opened with, so WU3 and WU4 each see their
   * own four examples.
   */
  unit: "testing-mu" | "two-means";
  /** Which worked example this is, shown in the read-out header. */
  source: string;
  /**
   * How the example reaches its decision: the classical six steps with a
   * rejection region ("critical"), or the modified procedure that reports a
   * p-value ("p-value").
   */
  approach: "critical" | "p-value";
  tail: Tail;
  /** Significance level the example uses. Ignored for the p-value approach. */
  alpha: number;
  design: ZTestDesign;
  /** Decimals used to print the example's figures, matching the text. */
  dp: number;
  /**
   * Keep trailing zeros when printing the figures (R286.50, not R286.5).
   * Otherwise they are dropped, so μ₀ = 100 does not print as 100.0.
   */
  keepZeros?: boolean;
  /** What taking one sample (or pair of samples) is, in the example's words. */
  drawOne: string;
}

/** Worked examples for `ZTest`, from Module 5 WU3 (`m5-testing-mu`). */
export const ZTEST_PRESETS: ZTestPreset[] = [
  {
    id: "batteries",
    label: "Batteries",
    unit: "testing-mu",
    source: "Example 6A: battery life",
    approach: "critical",
    tail: "lower",
    alpha: 0.05,
    design: { kind: "one", mu0: 100, sigma: 12, n: 50, xbar: 95.5 },
    dp: 1,
    drawOne: "Test 50 batteries",
  },
  {
    id: "typist",
    label: "Typist",
    unit: "testing-mu",
    source: "Example 7B: the new typist",
    approach: "critical",
    tail: "lower",
    alpha: 0.01,
    design: { kind: "one", mu0: 30, sigma: 10, n: 30, xbar: 26.5 },
    dp: 1,
    drawOne: "Count 30 days",
  },
  {
    id: "checkout",
    label: "Checkout",
    unit: "testing-mu",
    source: "Example 8C: the new till",
    approach: "critical",
    tail: "lower",
    alpha: 0.01,
    design: { kind: "one", mu0: 4.1, sigma: 1.3, n: 64, xbar: 3.8 },
    dp: 1,
    drawOne: "Time 64 customers",
  },
  {
    id: "tomatoes",
    label: "Tomatoes",
    unit: "testing-mu",
    source: "Example 9B: the new fertilizer",
    approach: "critical",
    tail: "two",
    alpha: 0.05,
    design: { kind: "one", mu0: 2.5, sigma: 0.53, n: 35, xbar: 2.65 },
    dp: 2,
    drawOne: "Harvest 35 plots",
  },
];
