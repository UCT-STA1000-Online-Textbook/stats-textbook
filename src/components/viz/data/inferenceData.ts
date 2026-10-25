/**
 * Presets for the Module 5 inference visualisations, one list per viz:
 *
 *   - `SAMPLE_MEAN_PRESETS` for `SamplingDistribution` (WU1),
 *   - `CI_PRESETS` for `ConfidenceIntervals` (WU2),
 *   - `ZTEST_PRESETS` for `ZTest` (WU3 and WU4),
 *   - `T_PRESETS` for `TDistribution` (WU5),
 *   - `TWO_SAMPLE_PRESETS` for `TwoSampleT` (WU6),
 *   - `PAIRED_PRESETS` for `PairedT` (WU7),
 *   - `GOF_PRESETS` for `GoodnessOfFit` (WU8).
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

/**
 * Worked examples for `ZTest`: Module 5 WU3 (`m5-testing-mu`) and WU4
 * (`m5-comparing-two-means`).
 */
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
  {
    id: "athlete",
    label: "Athlete",
    unit: "two-means",
    source: "Example 10A: the 8 km time trial",
    approach: "critical",
    tail: "upper",
    alpha: 0.05,
    design: { kind: "two", n1: 49, n2: 35, sigma1: 0.78, sigma2: 0.65, xbar1: 30.42, xbar2: 30.26 },
    dp: 2,
    drawOne: "Time 49 + 35 runs",
  },
  {
    id: "drivers",
    label: "Drivers",
    unit: "two-means",
    source: "Example 11B: the two drivers",
    approach: "critical",
    tail: "two",
    alpha: 0.05,
    design: { kind: "two", n1: 38, n2: 43, sigma1: 3.7, sigma2: 4.1, xbar1: 20.3, xbar2: 22.5 },
    dp: 1,
    drawOne: "Time 38 + 43 trips",
  },
  {
    id: "wages",
    label: "Wages",
    unit: "two-means",
    source: "Example 15A: daily wages",
    approach: "p-value",
    tail: "lower",
    alpha: 0.05,
    design: { kind: "one", mu0: 286.5, sigma: 29.47, n: 40, xbar: 271.78 },
    dp: 2,
    keepZeros: true,
    drawOne: "Pay 40 workers",
  },
  {
    id: "eggs",
    label: "Eggs",
    unit: "two-means",
    source: "Example 16B: extra-large eggs",
    approach: "p-value",
    tail: "lower",
    alpha: 0.05,
    design: { kind: "one", mu0: 125, sigma: 6, n: 24, xbar: 123.2 },
    dp: 1,
    drawOne: "Weigh 24 eggs",
  },
];

/** A worked example the `TDistribution` viz can open at. */
export interface TPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example this is, shown in the read-out header. */
  source: string;
  /**
   * What the example does with the t cut-off: build a confidence interval
   * ("interval") or test a claimed mean ("test").
   */
  kind: "interval" | "test";
  /**
   * Which tail(s) the cut-off cuts off. A confidence interval is always
   * "two": the middle 95% (or 99%) of t, with the rest split between the tails.
   */
  tail: Tail;
  /** Total area beyond the cut-off: 0.05 for 95% confidence or a 5% test. */
  alpha: number;
  /**
   * The true mean the simulation samples from. For a test it is μ₀, so every
   * run has H₀ true. For an interval nobody knows μ, so it is set to the
   * example's x̄, as `CI_PRESETS` does.
   */
  mu: number;
  /** The example's sample standard deviation s, used as σ in the simulation. */
  s: number;
  /** The example's sample size; the viz opens at it. */
  n: number;
  /** The example's sample mean x̄. */
  xbar: number;
  /** Decimals for printing a simulated x̄ and s. */
  dp: number;
  /** What taking one sample is, in the example's words, as a function of n. */
  drawOne: (n: number) => string;
  /** What one value in the sample is, plural, for the sample strip's caption. */
  items: string;
}

/**
 * Worked examples for `TDistribution`, used in Module 5, WU5
 * (`m5-unknown-sigma`). The figures are the ones printed in the text.
 */
export const T_PRESETS: TPreset[] = [
  {
    id: "flights",
    label: "Flights",
    source: "Example 1A: flight times, true mean set to 103",
    kind: "interval",
    tail: "two",
    alpha: 0.05,
    mu: 103,
    s: 5,
    n: 10,
    xbar: 103,
    dp: 1,
    drawOne: (n) => `Time ${n} flights`,
    items: "flight times, in minutes",
  },
  {
    id: "bread",
    label: "Bread",
    source: "Example 2B: loaves of bread, true mean set to 696",
    kind: "interval",
    tail: "two",
    alpha: 0.01,
    mu: 696,
    s: 7,
    n: 25,
    xbar: 696,
    dp: 1,
    drawOne: (n) => `Weigh ${n} loaves`,
    items: "loaf masses, in grams",
  },
  {
    id: "turkeys",
    label: "Turkeys",
    source: "Example 4A: the enriched diet",
    kind: "test",
    tail: "upper",
    alpha: 0.05,
    mu: 4.5,
    s: 0.5,
    n: 20,
    xbar: 4.8,
    dp: 2,
    drawOne: (n) => `Weigh ${n} turkeys`,
    items: "turkey masses, in kg",
  },
  {
    id: "batteries",
    label: "Batteries",
    source: "Example 5B: car battery life",
    kind: "test",
    tail: "lower",
    alpha: 0.05,
    mu: 36,
    s: 4,
    n: 6,
    xbar: 30,
    dp: 1,
    drawOne: (n) => `Test ${n} batteries`,
    items: "battery lives, in months",
  },
];

/**
 * A worked example the `TwoSampleT` viz can open at (Module 5, WU6,
 * `m5-two-independent-samples`): two independent samples, both population
 * variances estimated and assumed equal, so the two sample variances are
 * pooled.
 *
 * Group 1 is always the one subtracted from: H₀ is μ₁ − μ₂ = `delta0`.
 */
export interface TwoSamplePreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example this is, shown in the read-out header. */
  source: string;
  /** Direction of H₁ for μ₁ − μ₂, against `delta0`. */
  tail: Tail;
  alpha: number;
  /**
   * The difference μ₁ − μ₂ that H₀ claims. Zero except in Example 13C, where
   * method B is only worth buying if it saves more than a minute.
   */
  delta0: number;
  /** What each group is, in the example's words, for the strip and read-out. */
  names: [string, string];
  n1: number;
  n2: number;
  xbar1: number;
  xbar2: number;
  s1: number;
  s2: number;
  /** Decimals for printing simulated means, matching the example's figures. */
  dp: number;
  /** What taking one pair of samples is, in the example's words. */
  drawOne: string;
  /** Units of one measurement, for the strip's caption. */
  units: string;
  /**
   * Also show Excel's "unequal variances" t-test beside the pooled one. Only
   * the ages data of Example 17B, which the lecturer chose for comparing the
   * two Data Analysis outputs.
   */
  showUnequal?: boolean;
}

/**
 * Worked examples for `TwoSampleT`, Module 5 WU6. The figures are the ones
 * printed in the text, except the ages, whose summary is worked out from the
 * raw data (the book's 45.00 and 3.20 for corporation 2 do not match its own
 * data, which give 44.9 and 3.11).
 */
export const TWO_SAMPLE_PRESETS: TwoSamplePreset[] = [
  {
    id: "wheat",
    label: "Wheat",
    source: "Example 11A: two varieties of wheat",
    tail: "two",
    alpha: 0.05,
    delta0: 0,
    names: ["Variety 1", "Variety 2"],
    n1: 6,
    n2: 5,
    xbar1: 1.6,
    xbar2: 1.9,
    s1: 0.42,
    s2: 0.27,
    dp: 2,
    drawOne: "Harvest 6 + 5 plots",
    units: "tons per plot",
  },
  {
    id: "promotions",
    label: "Promotions",
    source: "Example 12B: free gift or discount",
    tail: "two",
    alpha: 0.05,
    delta0: 0,
    names: ["Free gift", "Discount"],
    n1: 8,
    n2: 9,
    xbar1: 490,
    xbar2: 420,
    s1: 104,
    s2: 92,
    dp: 0,
    drawOne: "Serve 8 + 9 customers",
    units: "rand spent",
  },
  {
    id: "assembly",
    label: "Assembly",
    source: "Example 13C: two assembly methods",
    tail: "upper",
    alpha: 0.05,
    delta0: 1,
    names: ["Method A", "Method B"],
    n1: 17,
    n2: 25,
    xbar1: 7.72,
    xbar2: 6.21,
    s1: 0.67,
    s2: 0.51,
    dp: 2,
    drawOne: "Time 17 + 25 assemblies",
    units: "minutes",
  },
  {
    id: "ages",
    label: "Ages",
    source: "Excel pointer: managers' ages",
    tail: "two",
    alpha: 0.05,
    delta0: 0,
    names: ["Corporation 1", "Corporation 2"],
    n1: 10,
    n2: 10,
    xbar1: 47.8,
    xbar2: 44.9,
    s1: 6.86,
    s2: 3.11,
    dp: 1,
    drawOne: "Ask 10 + 10 managers",
    units: "years",
    showUnequal: true,
  },
];

/** The alternatives the paired examples use: μd > 0, or μd ≠ 0. */
export type PairedTail = Exclude<Tail, "lower">;

/**
 * A worked example the `PairedT` viz can open at (Module 5, WU7,
 * `m5-two-dependent-samples`): matched pairs reduced to one sample of
 * differences d, tested against H₀: μd = 0.
 */
export interface PairedPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example this is, shown in the read-out header. */
  source: string;
  /** Direction of H₁ for μd. None of the unit's examples is lower-tailed. */
  tail: PairedTail;
  alpha: number;
  /** Number of pairs, and so of differences. */
  n: number;
  /** The example's mean difference d̄. */
  dbar: number;
  /** The example's standard deviation of the differences, s_d. */
  sd: number;
  /**
   * The example's differences, where the book prints them all. Example 10A
   * only prints four of its ten pairs, so it has none.
   */
  differences?: number[];
  /** How each difference is formed, e.g. "before − after". */
  dName: string;
  /** Decimals for printing a simulated d̄ and s_d. */
  dp: number;
  /** What taking one sample of pairs is, in the example's words. */
  drawOne: string;
}

/** Worked examples for `PairedT`, Module 5 WU7, with the figures the text prints. */
export const PAIRED_PRESETS: PairedPreset[] = [
  {
    id: "dizzy",
    label: "Dizziness",
    source: "Example 8A: medicine for dizziness",
    tail: "upper",
    alpha: 0.05,
    n: 10,
    dbar: -1.5,
    sd: 3.57,
    differences: [2, -6, -3, 4, 0, -3, -3, -3, 3, -6],
    dName: "before − after",
    dp: 2,
    drawOne: "Treat 10 patients",
  },
  {
    id: "music",
    label: "Music",
    source: "Example 9C: the pace of music",
    tail: "two",
    alpha: 0.05,
    n: 8,
    dbar: 6.5,
    sd: 6.87,
    differences: [9, 8, 18, -6, 7, 1, 8, 7],
    dName: "slow − fast",
    dp: 2,
    drawOne: "Watch 8 shoppers",
  },
  {
    id: "reading",
    label: "Reading",
    source: "Example 10A: two speed-reading methods",
    tail: "two",
    alpha: 0.05,
    n: 10,
    dbar: -40,
    sd: 71.6,
    dName: "method I − method II",
    dp: 1,
    drawOne: "Pair 20 readers",
  },
];

/**
 * The model H₀ says generated the data, in a form the `GoodnessOfFit` viz can
 * both draw from and fit:
 *
 *   - "poisson": counts per item (misprints per page). The last cell is
 *     "`top` or more". With `fit`, each simulated sample's λ is re-estimated
 *     from its own mean, as Example 1A does the second time.
 *   - "normal": measurements grouped at the `cuts`. μ and σ are always
 *     re-estimated from each sample, as in Example 2B.
 *   - "fixed": categories with stated proportions (the T-shirt colours).
 */
export type GofModel =
  | { kind: "poisson"; lambda: number; top: number; fit: boolean }
  | { kind: "normal"; mu: number; sigma: number; cuts: number[] }
  | { kind: "fixed"; probs: number[] };

/** A worked example the `GoodnessOfFit` viz can open at (Module 5, WU8). */
export interface GofPreset {
  id: string;
  /** Short name for the preset picker; one or two words so the row fits. */
  label: string;
  /** Which worked example this is, shown in the read-out header. */
  source: string;
  /** One label per cell, in order. */
  cells: string[];
  /** The example's observed frequencies Oᵢ. */
  observed: number[];
  /** The example's expected frequencies Eᵢ, as the text prints them. */
  expected: number[];
  /** Sample size: the number of items classified. */
  n: number;
  /** Number of parameters estimated from the data, d in k − d − 1. */
  estimated: number;
  alpha: number;
  model: GofModel;
  /**
   * Right-hand end of the D² axis: far enough to show the 5% point and the
   * example's own D².
   */
  maxD2: number;
  /** Decimals for printing a simulated sample's expected frequencies. */
  dp: number;
  /** What taking one sample is, in the example's words. */
  drawOne: string;
  /** What the cells count, for the chart's caption. */
  counts: string;
}

/**
 * Worked examples for `GoodnessOfFit`, Module 5 WU8 (`m5-goodness-of-fit`).
 * Observed and expected frequencies are the ones the text prints, so the
 * read-out's D² matches the page.
 */
export const GOF_PRESETS: GofPreset[] = [
  {
    id: "misprints",
    label: "λ = 1.2",
    // The read-out header is set in capitals, which would turn λ into Λ, so
    // the sources spell the rate out in words.
    source: "Example 1A: misprints, rate of 1.2 given",
    cells: ["0", "1", "2", "3", "4+"],
    observed: [43, 69, 53, 21, 14],
    expected: [60.24, 72.28, 43.38, 17.34, 6.76],
    n: 200,
    estimated: 0,
    alpha: 0.05,
    model: { kind: "poisson", lambda: 1.2, top: 4, fit: false },
    maxD2: 20,
    dp: 2,
    drawOne: "Inspect 200 pages",
    counts: "pages with each number of misprints",
  },
  {
    id: "misprints-fit",
    label: "λ estimated",
    source: "Example 1A: misprints, rate estimated as 1.5",
    cells: ["0", "1", "2", "3", "4+"],
    observed: [43, 69, 53, 21, 14],
    expected: [44.62, 66.94, 50.2, 25.1, 13.14],
    n: 200,
    estimated: 1,
    alpha: 0.05,
    model: { kind: "poisson", lambda: 1.5, top: 4, fit: true },
    maxD2: 15,
    dp: 2,
    drawOne: "Inspect 200 pages",
    counts: "pages with each number of misprints",
  },
  {
    id: "iq",
    label: "IQ",
    source: "Example 2B: I.Q. scores",
    cells: ["< 90", "90 to 110", "110 to 130", "> 130"],
    observed: [18, 87, 104, 21],
    expected: [22.7, 86.8, 92.7, 27.8],
    n: 230,
    estimated: 2,
    alpha: 0.05,
    model: { kind: "normal", mu: 111, sigma: 16.3, cuts: [90, 110, 130] },
    maxD2: 10,
    dp: 1,
    drawOne: "Test 230 students",
    counts: "students in each score band",
  },
  {
    id: "tshirts",
    label: "T-shirts",
    source: "Example 3C: T-shirt colours",
    cells: ["White", "Red", "Blue"],
    observed: [47, 32, 21],
    expected: [50, 25, 25],
    n: 100,
    estimated: 0,
    alpha: 0.05,
    model: { kind: "fixed", probs: [0.5, 0.25, 0.25] },
    maxD2: 15,
    dp: 0,
    drawOne: "Sell 100 T-shirts",
    counts: "T-shirts sold in each colour",
  },
];
