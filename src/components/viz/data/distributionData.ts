/**
 * Preset distributions for the Module 3 visualisations (`PmfBarExplorer` and
 * `PdfArea`).
 *
 * Every preset here is taken from a worked example in the unit, so the numbers
 * a student sees in the right panel are the same ones they just read in the
 * text. Where the lecturer changed the figures from the printed book (the tip
 * coins and the car commissions), the values below follow the lecturer.
 *
 * Densities carry an exact antiderivative (`cdf`) rather than being integrated
 * numerically. Every density in this chapter is a low-order polynomial, so the
 * closed form is short, and it means the shaded-area readout agrees with the
 * answers printed in the worked solutions to the last decimal instead of
 * drifting by a rounding error.
 */

/** One point mass of a discrete distribution: the value and its probability. */
export interface PmfPoint {
  x: number;
  p: number;
}

/** A named discrete distribution, ready to plot as a bar graph. */
export interface PmfPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /** The point masses, in increasing order of `x`. */
  points: PmfPoint[];
  /**
   * How to render an x-axis value. Money presets need "R7.00" rather than
   * "7", and the commission preset needs thousands separators.
   */
  format?: (x: number) => string;
  /** Axis caption naming what the random variable measures. */
  axisLabel: string;
  /**
   * Common denominator for the probabilities, when they are all exact
   * fractions over one. Set it and the viz prints "1/6" rather than "0.167",
   * which both matches how the text writes these mass functions and keeps the
   * displayed terms adding up to the displayed total. Without it, rounding
   * makes six printed 0.167s appear to sum to 1.002.
   */
  den?: number;
  /**
   * Decimal places for presets with no exact common denominator. Chosen per
   * preset so that the rounded values still add to exactly 1. Defaults to 3.
   */
  dp?: number;
}

/** Formats a rand amount to two decimals, e.g. `2.5` becomes "R2.50". */
const rand = (x: number) => `R${x.toFixed(2)}`;

/** Formats a whole-rand amount with a space as the thousands separator. */
const randWhole = (x: number) =>
  `R${Math.round(x).toLocaleString("en-ZA").replace(/,/g, " ")}`;

/**
 * The discrete distributions used by `PmfBarExplorer`.
 *
 * Ordered from the most familiar (a fair die) to the least, so a student
 * stepping through the picker meets the easy shapes first.
 */
export const PMF_PRESETS: PmfPreset[] = [
  {
    id: "die",
    den: 6,
    label: "Fair die",
    source: "Example 7A",
    axisLabel: "x = number of dots on the upturned face",
    points: [1, 2, 3, 4, 5, 6].map((x) => ({ x, p: 1 / 6 })),
  },
  {
    id: "coins3",
    den: 8,
    label: "Three coins",
    source: "Example 2A",
    axisLabel: "x = number of heads in three tosses",
    points: [
      { x: 0, p: 1 / 8 },
      { x: 1, p: 3 / 8 },
      { x: 2, p: 3 / 8 },
      { x: 3, p: 1 / 8 },
    ],
  },
  {
    id: "ramp",
    den: 15,
    label: "p(x) = x/15",
    source: "Example 11A",
    axisLabel: "x",
    points: [1, 2, 3, 4, 5].map((x) => ({ x, p: x / 15 })),
  },
  {
    id: "tip",
    den: 10,
    label: "Coin tip",
    source: "Example 3B",
    axisLabel: "x = value of the tip",
    format: rand,
    points: [
      { x: 1.0, p: 0.1 },
      { x: 2.5, p: 0.4 },
      { x: 4.0, p: 0.1 },
      { x: 5.5, p: 0.2 },
      { x: 7.0, p: 0.2 },
    ],
  },
  {
    id: "snooker",
    den: 21,
    label: "Snooker score",
    source: "Example 4B",
    axisLabel: "x = value of the ball potted",
    points: [
      { x: 1, p: 15 / 21 },
      { x: 2, p: 1 / 21 },
      { x: 3, p: 1 / 21 },
      { x: 4, p: 1 / 21 },
      { x: 5, p: 1 / 21 },
      { x: 6, p: 1 / 21 },
      { x: 7, p: 1 / 21 },
    ],
  },
  {
    id: "commission",
    dp: 2,
    label: "Car commission",
    source: "Example 5C",
    axisLabel: "x = commission earned today",
    format: randWhole,
    points: [
      { x: 0, p: 0.25 },
      { x: 10000, p: 0.3 },
      { x: 20000, p: 0.29 },
      { x: 30000, p: 0.12 },
      { x: 40000, p: 0.04 },
    ],
  },
  {
    id: "bargraph",
    dp: 4,
    label: "Bar graph example",
    source: "Example 18A",
    axisLabel: "x",
    points: [
      { x: 0, p: 0.0256 },
      { x: 1, p: 0.1536 },
      { x: 2, p: 0.3456 },
      { x: 3, p: 0.3456 },
      { x: 4, p: 0.1296 },
    ],
  },
];

/** A named continuous distribution, ready to plot as a density curve. */
export interface PdfPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /** The density, written the way it appears in the text. */
  formula: string;
  /** Lower and upper end of the interval on which the density is non-zero. */
  domain: [number, number];
  /** The density itself. Only ever called inside `domain`. */
  f: (x: number) => number;
  /**
   * Exact cumulative area from the lower end of the domain up to `x`, so that
   * Pr[c ≤ X ≤ d] is `cdf(d) - cdf(c)` with no numerical integration.
   */
  cdf: (x: number) => number;
  /** Axis caption naming what the random variable measures. */
  axisLabel: string;
  /** How to render an x-axis value; defaults to two decimals. */
  format?: (x: number) => string;
}

/**
 * The continuous distributions used by `PdfArea`.
 *
 * The flat density comes first because a rectangle is the one case where a
 * student can check the shaded area by eye, which makes the "probability is
 * area" idea land before the curved shapes arrive.
 */
export const PDF_PRESETS: PdfPreset[] = [
  {
    id: "uniform",
    label: "Flat density",
    source: "Example 20A",
    formula: "f(x) = 4,\\quad 0 \\le x \\le 0.25",
    domain: [0, 0.25],
    f: () => 4,
    cdf: (x) => 4 * x,
    axisLabel: "x",
    format: (x) => x.toFixed(3),
  },
  {
    id: "parabola",
    label: "6x(1 − x)",
    source: "Example 23B",
    formula: "f(x) = 6x(1 - x),\\quad 0 \\le x \\le 1",
    domain: [0, 1],
    f: (x) => 6 * x * (1 - x),
    cdf: (x) => 3 * x * x - 2 * x * x * x,
    axisLabel: "x",
  },
  {
    id: "survival",
    label: "Share survival",
    source: "Example 21B",
    formula: "f(x) = 20x^3(1 - x),\\quad 0 \\le x \\le 1",
    domain: [0, 1],
    f: (x) => 20 * x * x * x * (1 - x),
    cdf: (x) => 5 * Math.pow(x, 4) - 4 * Math.pow(x, 5),
    axisLabel: "x = proportion of companies that survive the year",
  },
  {
    id: "petrol",
    label: "Petrol demand",
    source: "Example 22B",
    formula: "f(x) = \\tfrac{1}{2500}(10 - x)^3,\\quad 0 \\le x \\le 10",
    domain: [0, 10],
    f: (x) => Math.pow(10 - x, 3) / 2500,
    // ∫₀ˣ (10−t)³/2500 dt = [10⁴ − (10−x)⁴] / 10 000.
    cdf: (x) => (1e4 - Math.pow(10 - x, 4)) / 1e4,
    axisLabel: "x = weekly demand, in thousands of litres",
    format: (x) => x.toFixed(2),
  },
];
