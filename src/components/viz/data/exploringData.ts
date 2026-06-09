/**
 * Datasets for the Module 2 "Graphical Summaries" visualisations.
 *
 * Every dataset is transcribed verbatim from INTROSTAT Chapter 1 (the source
 * for `m2-graphical-summaries`), so the on-screen frequency tables match the
 * worked numbers in the unit:
 *
 *   - `MBA_FACULTIES` / `MBA_GMAT`  — Table 1.1, Examples 1A & 3A
 *   - `JSE_SECTORS`                 — Table 1.2, Example 2C (aggregated to the
 *                                     seven major-sector indices)
 *   - `SHARE_RISK`                  — Example 4B (75 share standard deviations)
 *   - `EXAM_MARKS`                  — Example 5C (25 exam percentages)
 *   - `TREE_HEIGHTS`                — Example 6C (30 pine-tree heights, metres)
 *
 * Shared by `CategoricalDisplay` (pie/bar) and `HistogramBuilder`. Keeping the
 * raw values here — rather than inside a component — lets both viz, and any
 * future summary-measures viz in WU2, reuse the same authoritative numbers.
 */

/** A colour ramp for categorical slices/bars; index wraps for long lists. */
export const CATEGORY_COLORS = [
  "rgb(37, 99, 235)", // blue-600
  "rgb(217, 119, 6)", // amber-600
  "rgb(5, 150, 105)", // emerald-600
  "rgb(220, 38, 38)", // red-600
  "rgb(124, 58, 237)", // violet-600
  "rgb(8, 145, 178)", // cyan-600
  "rgb(190, 24, 93)", // pink-700
] as const;

/** One labelled category and its count (or percentage). */
export interface Category {
  name: string;
  value: number;
}

/** A qualitative dataset displayed as a pie chart or bar graph. */
export interface CategoricalDataset {
  id: string;
  /** Menu label shown in the dataset selector. */
  label: string;
  /** What a single value means, e.g. "students" or "% of index". */
  valueLabel: string;
  /** True when values are already percentages that should sum to ~100. */
  isPercent?: boolean;
  /** One-line interpretation hook shown under the chart. */
  caption: string;
  categories: Category[];
}

/** A quantitative dataset displayed as a histogram. */
export interface QuantitativeDataset {
  id: string;
  label: string;
  /** Axis unit, e.g. "GMAT score" or "height (m)". */
  unit: string;
  values: number[];
  /** Slider configuration for the class-interval width. */
  width: { min: number; max: number; step: number; default: number };
  caption: string;
}

// --- Qualitative data -------------------------------------------------------

/** Table 1.1 — first-degree faculty of 81 MBA students (Example 1A). */
export const MBA_FACULTIES: CategoricalDataset = {
  id: "mba",
  label: "MBA first degrees",
  valueLabel: "students",
  caption:
    "Engineers form the largest single group — the visual display makes that obvious at a glance.",
  categories: [
    { name: "Engineering", value: 28 },
    { name: "Science", value: 16 },
    { name: "Arts", value: 16 },
    { name: "Commerce", value: 10 },
    { name: "Medicine", value: 5 },
    { name: "Other", value: 6 },
  ],
};

/**
 * Table 1.2 — the JSE All-Share Index aggregated into its seven major sectors
 * (Example 2C). Counting the *number of shares* tells a very different story
 * from the *percentage weighting*: Financial has the most shares but a small
 * weighting, while Mining Financial has few shares yet a large weighting.
 */
export const JSE_BY_COUNT: CategoricalDataset = {
  id: "jse-count",
  label: "JSE sectors — share count",
  valueLabel: "shares",
  caption:
    "By number of shares, Industrial and Financial dominate. But does counting shares measure importance?",
  categories: [
    { name: "Coal", value: 2 },
    { name: "Diamonds", value: 1 },
    { name: "All-Gold", value: 17 },
    { name: "Metals & Minerals", value: 8 },
    { name: "Mining Financial", value: 6 },
    { name: "Financial", value: 35 },
    { name: "Industrial", value: 82 },
  ],
};

/** Same seven sectors, now by their percentage weighting in the index. */
export const JSE_BY_WEIGHT: CategoricalDataset = {
  id: "jse-weight",
  label: "JSE sectors — % weighting",
  valueLabel: "% of index",
  isPercent: true,
  caption:
    "By weighting the picture flips: Mining Financial and All-Gold carry far more of the index than their share counts suggest.",
  categories: [
    { name: "Coal", value: 0.82 },
    { name: "Diamonds", value: 8.27 },
    { name: "All-Gold", value: 18.99 },
    { name: "Metals & Minerals", value: 6.73 },
    { name: "Mining Financial", value: 23.92 },
    { name: "Financial", value: 7.41 },
    { name: "Industrial", value: 33.86 },
  ],
};

// --- Quantitative data ------------------------------------------------------

/** Table 1.1 — the 81 GMAT scores, in student order (Example 3A). */
export const MBA_GMAT: QuantitativeDataset = {
  id: "gmat",
  label: "GMAT scores (n = 81)",
  unit: "GMAT score",
  width: { min: 10, max: 100, step: 10, default: 50 },
  caption:
    "A long tail stretches to the right and the left tail is truncated near 500 — the MBA entry cutoff.",
  values: [
    610, 510, 610, 580, 720, 620, 540, 500, 750, 640, 550, 650, 600, 600, 510,
    570, 620, 590, 660, 550, 560, 630, 540, 560, 650, 540, 680, 710, 600, 550,
    540, 620, 650, 500, 590, 630, 660, 570, 600, 630, 500, 580, 560, 550, 560,
    550, 500, 510, 570, 510, 660, 500, 710, 510, 500, 620, 550, 600, 520, 520,
    550, 520, 560, 560, 600, 540, 550, 650, 510, 560, 590, 700, 640, 680, 580,
    550, 680, 540, 640, 620, 450,
  ],
};

/** Example 4B — standard deviations (% per month) of 75 JSE shares. */
export const SHARE_RISK: QuantitativeDataset = {
  id: "risk",
  label: "Share risk (n = 75)",
  unit: "risk (% per month)",
  width: { min: 1, max: 6, step: 1, default: 2 },
  caption:
    "Two clear peaks — the distribution is bimodal: industrial shares cluster low, gold shares high.",
  values: [
    23, 22, 17, 18, 21, 25, 23, 25, 12, 23, 27, 14, 28, 9, 23, 19, 23, 11, 16,
    11, 15, 15, 12, 12, 12, 21, 13, 11, 13, 13, 27, 20, 17, 8, 13, 28, 14, 9,
    13, 11, 23, 23, 10, 12, 12, 26, 25, 11, 12, 20, 22, 21, 9, 13, 19, 19, 13,
    14, 15, 17, 17, 10, 25, 26, 11, 12, 25, 22, 12, 11, 22, 20, 14, 10, 23,
  ],
};

/** Example 5C — examination marks (%) of 25 students. */
export const EXAM_MARKS: QuantitativeDataset = {
  id: "exam",
  label: "Exam marks (n = 25)",
  unit: "mark (%)",
  width: { min: 2, max: 20, step: 2, default: 10 },
  caption:
    "Practice dataset — choose a sensible class width and describe the shape yourself.",
  values: [
    68, 72, 39, 50, 69, 52, 51, 50, 41, 52, 65, 37, 45, 78, 48, 55, 53, 61, 71,
    42, 57, 34, 57, 66, 87,
  ],
};

/** Example 6C — heights (m) of 30 sampled pine trees. */
export const TREE_HEIGHTS: QuantitativeDataset = {
  id: "trees",
  label: "Tree heights (n = 30)",
  unit: "height (m)",
  width: { min: 0.5, max: 2, step: 0.5, default: 0.5 },
  caption:
    "Practice dataset — note how decimal data still groups into equal-width classes.",
  values: [
    18.3, 19.1, 17.3, 19.4, 17.6, 20.1, 19.9, 20.0, 19.5, 19.3, 17.7, 19.1,
    17.4, 19.3, 18.7, 18.2, 20.0, 17.7, 20.0, 17.5, 18.5, 17.8, 20.1, 19.4,
    20.5, 16.8, 18.8, 19.7, 18.4, 20.4,
  ],
};

/** Lookup of every qualitative dataset by id, for the selector menu. */
export const CATEGORICAL_DATASETS: Record<string, CategoricalDataset> = {
  [MBA_FACULTIES.id]: MBA_FACULTIES,
  [JSE_BY_COUNT.id]: JSE_BY_COUNT,
  [JSE_BY_WEIGHT.id]: JSE_BY_WEIGHT,
};

/** Lookup of every quantitative dataset by id, for the selector menu. */
export const QUANTITATIVE_DATASETS: Record<string, QuantitativeDataset> = {
  [MBA_GMAT.id]: MBA_GMAT,
  [SHARE_RISK.id]: SHARE_RISK,
  [EXAM_MARKS.id]: EXAM_MARKS,
  [TREE_HEIGHTS.id]: TREE_HEIGHTS,
};
