/**
 * Preset distributions for the Module 3 and Module 4 visualisations
 * (`PmfBarExplorer`, `PdfArea`, `UniformExplorer`, `BinomialExplorer`,
 * `PoissonProcess` and `NormalExplorer`).
 *
 * Every preset here is taken from a worked example in the unit, so the numbers
 * a student sees in the right panel are the same ones they just read in the
 * text. Where the lecturer changed the figures from the printed book (the tip
 * coins and the car commissions), the values below follow the lecturer.
 *
 * The Module 3 densities in `PDF_PRESETS` carry an exact antiderivative (`cdf`)
 * rather than being integrated numerically. Every density in that chapter is a
 * low-order polynomial, so the
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

/**
 * A named Uniform distribution, ready to plot as a rectangle.
 *
 * Unlike `PdfPreset`, the endpoints here are not fixed: the student drags
 * `a` and `b` themselves, and the height follows from them. So a preset only
 * supplies where to *start*, plus the fixed window the rectangle is drawn in.
 */
export interface UniformPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /**
   * The visible stretch of the x-axis. It stays fixed while `a` and `b` are
   * dragged, which is the whole point: against an unmoving axis the rectangle
   * is visibly seen to get lower as it gets wider.
   */
  view: [number, number];
  /**
   * Starting endpoints of the interval, both inside `view`. The gap between
   * them must be at least `MIN_WIDTH` of the `view` span (see
   * `UniformExplorer`), which is the narrowest interval it allows; a tighter
   * pair would draw a rectangle taller than the y-axis.
   */
  start: [number, number];
  /** Starting edges of the shaded sub-interval, both inside `start`. */
  shade: [number, number];
  /** Axis caption naming what the random variable measures. */
  axisLabel: string;
  /**
   * What one draw from this distribution *is*, in the language of the
   * example: "Weigh one tub", not "Draw a value". A student should never
   * have to work out what is being sampled.
   */
  drawOne: string;
  /** The same action done 500 times, for the batch button. */
  drawMany: string;
  /** Plural noun for the things drawn, used in the running score. */
  drawNoun: string;
  /**
   * Letter to call the random variable in the read-out. Example 15C works
   * with a final mark Y built from an examination mark X, and printing "X"
   * beside it would contradict the text, so each preset names its own.
   * Defaults to "X".
   */
  variable?: string;
  /** How to render an x-axis value; defaults to one decimal. */
  format?: (x: number) => string;
}

/**
 * Uniform distributions for `UniformExplorer`, one per worked example in
 * Module 4, WU1 (`m4-uniform`).
 */
export const UNIFORM_PRESETS: UniformPreset[] = [
  {
    id: "margarine",
    label: "Margarine",
    source: "Example 12A",
    view: [490, 515],
    start: [495, 510],
    // Pr[X < 500] = 5/15 = 1/3, the answer printed in the text.
    shade: [495, 500],
    axisLabel: "x = mass of a tub, in grams",
    drawOne: "Weigh one tub",
    drawMany: "Weigh 500",
    drawNoun: "tubs",
    format: (x) => x.toFixed(1),
  },
  {
    id: "portfolio",
    label: "Shares",
    source: "Example 14C",
    view: [0, 40],
    start: [5, 35],
    // Pr[X < 13.5] = 8.5/30 = 0.283: the investor does better on fixed deposit.
    shade: [5, 13.5],
    axisLabel: "x = annual return on the portfolio, in %",
    drawOne: "Try one year",
    drawMany: "Try 500 years",
    drawNoun: "years",
    format: (x) => x.toFixed(1),
  },
  {
    id: "final-mark",
    label: "Final mark",
    source: "Example 15C",
    view: [40, 70],
    // Y = 15 + 0.7X with X ~ U(45, 65), so Y ~ U(46.5, 60.5).
    start: [46.5, 60.5],
    // Pr[50 ≤ Y ≤ 60] = 10/14 = 0.714, the third-class pass.
    shade: [50, 60],
    axisLabel: "y = final mark for the course, in %",
    drawOne: "Mark one student",
    drawMany: "Mark 500",
    drawNoun: "students",
    variable: "Y",
    format: (x) => x.toFixed(1),
  },
];

/**
 * A worked example the `BinomialExplorer` can open at, i.e. a choice of the
 * two parameters n and p.
 */
export interface BinomialPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /** Number of trials. */
  n: number;
  /** Probability of success on a single trial. */
  p: number;
  /** What one trial is, e.g. "client called on". Used in the read-out. */
  trial: string;
  /** What counts as a success, e.g. "buys the product". */
  success: string;
  /** Bars selected on opening, as an inclusive range of x values. */
  select: [number, number];
  /**
   * Optional observed counts from a real simulation run, indexed by x, for
   * the viz to draw over the theoretical bars. Only the presets that come
   * from one of the lecturer's tutorial datasets carry this.
   */
  observed?: number[];
}

/**
 * Binomial distributions for `BinomialExplorer`, one per worked example in
 * Module 4, WU2 (`m4-binomial`).
 *
 * The mouse-in-the-maze entry is not from the textbook: it matches the
 * lecturer's Tutorial 6 simulation, which runs 1500 experiments of 8 mice
 * with a 0.3 chance of finding the way out.
 */
export const BINOMIAL_PRESETS: BinomialPreset[] = [
  {
    id: "mouse-maze",
    label: "Mouse maze",
    source: "Tutorial 6 simulation",
    n: 8,
    p: 0.3,
    trial: "mouse released into the maze",
    success: "finds its way out",
    // Opens on "3 or more of the 8 get out" rather than the whole range: the
    // read-out leads with this figure, and Pr[0 ≤ X ≤ 8] = 1 tells nobody
    // anything.
    select: [3, 8],
    // The 1500 experiments in Tutorial 6, counted by how many of the 8 mice
    // got out. Their mean is 2.3867 against a theoretical np of 2.4.
    observed: [89, 307, 434, 389, 183, 86, 9, 2, 1],
  },
  {
    id: "salesperson",
    label: "Salesperson",
    source: "Example 1A",
    n: 6,
    p: 0.2,
    trial: "client called on",
    success: "buys the product",
    // Pr[X ≥ 2] = 0.3446: two or more sales in a session.
    select: [2, 6],
  },
  {
    id: "contracts",
    label: "Contracts",
    source: "Example 2B",
    n: 5,
    p: 0.5,
    trial: "contract tendered for",
    success: "is awarded",
    // Pr[X = 1] = 5/32, the answer printed in the text.
    select: [1, 1],
  },
  {
    id: "pills",
    label: "Pills",
    source: "Example 4B",
    n: 12,
    p: 0.1,
    trial: "pill in the bottle",
    success: "is chipped",
    // Pr[X ≥ 2] = 0.3410 in the text.
    select: [2, 12],
  },
  {
    id: "quality-control",
    label: "Quality",
    source: "Example 5C",
    n: 10,
    p: 0.1,
    trial: "component tested",
    success: "is defective",
    // The consignment is rejected on one or more defectives: Pr[X ≥ 1] = 0.6513.
    select: [1, 10],
  },
];

/**
 * A worked example the `PoissonProcess` viz can open at. One rate λ drives
 * both of its views, because the count of events and the gap between them are
 * two readings of the same underlying Poisson process.
 */
export interface PoissonPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /** Average number of events per unit of time or space. */
  lambda: number;
  /** The unit λ is quoted per, e.g. "km" or "day". */
  unit: string;
  /**
   * How to name a length of that unit in the gaps view, e.g. "km of road".
   * Kept separate from `unit` because simply adding an "s" gives "kms", and
   * because a rate quoted per 4 pages makes the gap unit a block of 4 pages,
   * not a page.
   */
  span: string;
  /** Plural name for the events being counted, e.g. "potholes". */
  event: string;
  /** Bars selected on opening in the counting view, as an inclusive range. */
  select: [number, number];
  /**
   * Optional observed counts from a real simulation run, indexed by x, for
   * the viz to draw over the theoretical bars. Only the pothole preset, which
   * comes from the lecturer's Tutorial 7 dataset, carries this.
   */
  observed?: number[];
}

/**
 * Poisson processes for `PoissonProcess`, one per worked example in Module 4,
 * WU3 (`m4-poisson-exponential`).
 *
 * The pothole entry is not from the textbook: it matches the lecturer's
 * Tutorial 7 simulation, whose 5000 one-kilometre samples average 3.0
 * potholes per km.
 */
export const POISSON_PRESETS: PoissonPreset[] = [
  {
    id: "potholes",
    label: "Potholes",
    source: "Tutorial 7 simulation",
    lambda: 3,
    unit: "km",
    span: "km of road",
    event: "potholes",
    select: [0, 3],
    // The 5000 one-kilometre samples in Tutorial 7, counted by how many
    // potholes each held. Their mean is 3.0064 against a λ of 3.
    observed: [247, 759, 1140, 1101, 812, 480, 283, 116, 40, 14, 5, 2, 0, 0, 1],
  },
  {
    id: "trucks",
    label: "Trucks",
    source: "Example 6A",
    lambda: 2.4,
    unit: "day",
    span: "days",
    event: "breakdowns",
    // Pr[X > 2] = 0.4303: the two standby trucks are not enough.
    select: [3, 12],
  },
  {
    id: "ledger-errors",
    label: "Ledger",
    source: "Example 7B",
    lambda: 3,
    unit: "4 pages",
    span: "blocks of 4 pages",
    event: "errors",
    // Pr[X ≥ 2] = 0.8008 in the text.
    select: [2, 14],
  },
  {
    id: "beercans",
    label: "Beercans",
    source: "Example 9C",
    lambda: 3.2,
    unit: "km",
    span: "km of road",
    event: "beercans",
    // Pr[X ≤ 2] = 0.3799, the "40% or fewer" figure in part (c).
    select: [0, 2],
  },
  {
    id: "computer",
    label: "Computer",
    source: "Example 10A",
    lambda: 1.5,
    unit: "week",
    span: "weeks",
    event: "breakdowns",
    select: [0, 0],
  },
  {
    id: "cable-flaws",
    label: "Cable",
    source: "Example 14C",
    lambda: 4.4,
    unit: "km",
    span: "km of cable",
    event: "flaws",
    select: [0, 0],
  },
];

/**
 * One component of a Normal random variable that is built as a sum, such as
 * a single chore in Example 21B. The viz draws each part separately and adds
 * them, so the sum's distribution is seen to come out Normal rather than
 * being asserted.
 */
export interface NormalPart {
  /** Short name shown in the breakdown of a single run, e.g. "Shower". */
  name: string;
  mu: number;
  sigma: number;
}

/**
 * A worked example the `NormalExplorer` can open at: a Normal distribution,
 * the fixed stretch of axis it is drawn against, and the area shaded on
 * opening.
 */
export interface NormalPreset {
  id: string;
  /** Short name for the preset picker. */
  label: string;
  /** Which worked example this comes from, shown under the chart. */
  source: string;
  /** Mean of the distribution on opening. */
  mu: number;
  /** Standard deviation on opening (not the variance). */
  sigma: number;
  /**
   * How σ is written in the Excel formula shown in the read-out, when it is
   * not a tidy number: Example 21B works with SQRT(38.5), not 6.2048, and the
   * text warns against typing a rounded value into a formula. Defaults to the
   * number itself.
   */
  sigmaExcel?: string;
  /**
   * The visible stretch of the x-axis. Fixed while μ and σ are dragged, so
   * the curve is seen to move and flatten against an unmoving scale.
   */
  view: [number, number];
  /**
   * Edges of the shaded area on opening. `null` stands for an infinite edge:
   * `[null, 250]` shades everything below 250.
   */
  shade: [number | null, number | null];
  /** Granularity of the μ slider and the shading handles, e.g. 0.1. */
  step: number;
  /** Axis caption naming what the random variable measures. */
  axisLabel: string;
  /** Unit to print after a single drawn value, e.g. "g". */
  unit: string;
  /** What one draw is, in the language of the example: "Weigh one tub". */
  drawOne: string;
  /** The same action done 500 times, for the batch button. */
  drawMany: string;
  /** Plural noun for the things drawn, used in the running score. */
  drawNoun: string;
  /** Letter for the random variable in the read-out. Defaults to "X". */
  variable?: string;
  /**
   * When present, μ and σ cannot be changed for this preset and this sentence
   * says why, in place of the sliders. The standard Normal distribution is
   * N(0, 1) by definition, and the chores total takes its μ and σ from the
   * four chores, so a slider on either would contradict the text.
   */
  locked?: string;
  /** The pieces a draw is summed from, for a preset built as a sum. */
  parts?: NormalPart[];
}

/**
 * Normal distributions for `NormalExplorer`, one per worked example in
 * Module 4, WU4 (`m4-normal`).
 */
export const NORMAL_PRESETS: NormalPreset[] = [
  {
    id: "margarine",
    label: "Margarine",
    source: "Example 15A",
    mu: 251,
    sigma: 3,
    view: [239, 263],
    // Part (a): Pr[251 ≤ X ≤ 253] = 0.2475, the Excel figure in the text.
    shade: [251, 253],
    step: 0.1,
    axisLabel: "x = margarine in a 250 g tub, in grams",
    unit: "g",
    drawOne: "Weigh one tub",
    drawMany: "Weigh 500",
    drawNoun: "tubs",
  },
  {
    id: "t-shirts",
    label: "T-shirts",
    source: "Example 17B",
    mu: 92,
    sigma: 5,
    view: [72, 112],
    // Size M, 87 to 94 cm: the largest share of customers, 0.4968.
    shade: [87, 94],
    step: 0.5,
    axisLabel: "x = chest measurement, in cm",
    unit: "cm",
    drawOne: "Measure one customer",
    drawMany: "Measure 500",
    drawNoun: "customers",
  },
  {
    id: "cooldrink",
    label: "Cooldrink",
    source: "Example 20C",
    mu: 215,
    sigma: 10,
    view: [175, 255],
    // Part (a): a 225 ml cup overflows with probability 0.1587.
    shade: [225, null],
    step: 0.5,
    axisLabel: "x = cooldrink poured into a cup, in ml",
    unit: "ml",
    drawOne: "Pour one cup",
    drawMany: "Pour 500",
    drawNoun: "cups",
  },
  {
    id: "chores",
    label: "Chores",
    source: "Example 21B",
    mu: 34,
    sigma: Math.sqrt(38.5),
    sigmaExcel: "SQRT(38.5)",
    view: [9, 59],
    // Part (a): up at 07h20 leaves 40 minutes, and Pr[X > 40] = 0.1668.
    shade: [40, null],
    step: 0.1,
    axisLabel: "x = time for all four chores, in minutes",
    unit: "min",
    drawOne: "Time one morning",
    drawMany: "Time 500",
    drawNoun: "mornings",
    locked:
      "μ and σ come from the four chores: μ = 5 + 4 + 10 + 15 = 34 and σ² = 0.5² + 1² + 3.5² + 5² = 38.5.",
    parts: [
      { name: "Shower", mu: 5, sigma: 0.5 },
      { name: "Dress", mu: 4, sigma: 1 },
      { name: "Breakfast", mu: 10, sigma: 3.5 },
      { name: "Drive", mu: 15, sigma: 5 },
    ],
  },
  {
    id: "standard",
    label: "N(0, 1)",
    source: "Example 24A",
    mu: 0,
    sigma: 1,
    view: [-4, 4],
    // The upper 10% point: Pr[Z ≥ 1.28] = 0.1003.
    shade: [1.28, null],
    step: 0.01,
    axisLabel: "z = standard deviations from the mean",
    unit: "",
    drawOne: "Draw one z",
    drawMany: "Draw 500",
    drawNoun: "values",
    variable: "Z",
    locked: "The standard Normal distribution has μ = 0 and σ = 1 by definition.",
  },
];
