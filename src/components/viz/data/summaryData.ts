/**
 * Datasets for the Module 2 WU2 visualisations (`m2-summary-measures`).
 *
 * Every batch is transcribed from INTROSTAT Chapter 1, so the five-number
 * summaries, means and standard deviations shown on screen match the worked
 * numbers in the unit:
 *
 *   - `FOOTBALL_POINTS`  — Examples 7A & 13A (the running five-number example)
 *   - `GMAT_BY_FACULTY`  — Examples 17B & 25B, side-by-side box plots
 *   - `COMPUTER_USAGE`   — Example 18A, the outliers-and-strays example
 *   - `WHEAT_PROTEIN`    — Example 19C, two data-entry errors to catch
 *   - `PAARL_RAINFALL`   — Example 20C
 *   - `DIVIDEND_YIELDS`  — Examples 21A, 23A & 24A (mean ≈ median)
 *   - `WEEKLY_VOLUME`    — Example 22A (mean ≫ median: the robustness lesson)
 *
 * A dataset is always a *list of named groups*, even when it holds a single
 * batch. `BoxPlotBuilder` draws one box per group, so the single-batch and
 * faculty-comparison cases share one rendering path rather than branching.
 *
 * The GMAT groups are sliced out of `MBA_GMAT` rather than retyped, so the
 * faculty batches cannot drift from Table 1.1 — the source of truth both this
 * unit and `m2-graphical-summaries` quote.
 *
 * Note that INTROSTAT's own printed table in Example 25B disagrees with Table
 * 1.1 for two categories (it gives Commerce a mean of 567.0 and swaps the
 * Medicine and Other sample sizes). The figures derived here follow Table 1.1,
 * which is the data students actually have.
 */

import { MBA_GMAT } from "./exploringData";

/** One named batch of observations within a dataset. */
export interface SummaryGroup {
  /** Shown as the box's axis label, e.g. "Arts". */
  name: string;
  values: number[];
  /**
   * Optional per-observation identifiers, positionally aligned with `values`.
   * `BoxPlotBuilder` labels flagged points with these, which is the whole
   * point of Example 18A — the lecturer wants the *students* named, not just
   * the hours.
   */
  tags?: string[];
}

/** A batch (or set of comparable batches) plotted by `BoxPlotBuilder`. */
export interface SummaryDataset {
  id: string;
  /** Menu label shown in the dataset selector. */
  label: string;
  /** Axis label, e.g. "league points" or "hours". */
  unit: string;
  groups: SummaryGroup[];
  /** One-line interpretation hook shown under the plot. */
  caption: string;
}

/** Wraps a single batch as a one-group dataset. */
function single(
  id: string,
  label: string,
  unit: string,
  values: number[],
  caption: string,
  tags?: string[],
): SummaryDataset {
  return { id, label, unit, groups: [{ name: label, values, tags }], caption };
}

/** Example 7A — points scored by 22 English football clubs, 1983/84 season. */
export const FOOTBALL_POINTS = single(
  "football",
  "Football points (n = 22)",
  "league points",
  [63, 60, 48, 50, 59, 53, 51, 79, 51, 74, 50, 71, 41, 73, 71, 50, 52, 61, 57, 51, 60, 29],
  "Half the clubs scored between 50.25 and 62.5 points: the box holds the central 50%.",
);

/**
 * Table 1.1 split by first degree (Examples 17B & 25B).
 *
 * Table 1.1 lists the 81 students grouped by faculty in this order, so each
 * category is a contiguous slice of `MBA_GMAT.values`.
 */
const FACULTY_SLICES: { name: string; start: number; count: number }[] = [
  { name: "Eng.", start: 0, count: 28 },
  { name: "Sci.", start: 28, count: 16 },
  { name: "Arts", start: 44, count: 16 },
  { name: "Com.", start: 60, count: 10 },
  { name: "Med.", start: 70, count: 5 },
  { name: "Other", start: 75, count: 6 },
];

const GMAT_BY_FACULTY: SummaryDataset = {
  id: "gmat-faculty",
  label: "GMAT by faculty (n = 81)",
  unit: "GMAT score",
  caption:
    "Side-by-side boxes on one scale: medical students have the highest median, arts the lowest.",
  groups: FACULTY_SLICES.map(({ name, start, count }) => ({
    name,
    values: MBA_GMAT.values.slice(start, start + count),
  })),
};

/** Example 18A — computer usage (hours) by 30 students, with their codes. */
const COMPUTER_USAGE = single(
  "usage",
  "Computer usage (n = 30)",
  "hours",
  [53, 2, 36, 7, 25, 20, 38, 36, 33, 48, 84, 154, 31, 35, 44, 48, 69, 95, 4, 60,
   18, 51, 47, 37, 11, 41, 34, 73, 38, 125],
  "One outlier (JR894, 154 hours) and eight strays: exactly the list the lecturer wanted.",
  ["AD483", "AM044", "AS677", "CI144", "CS572", "EK817", "FV246", "GM337", "GR803",
   "HN050", "JK314", "JR894", "JV670", "KM232", "LJ419", "LW032", "MA276", "MJ076",
   "PH544", "PS279", "RR676", "SA831", "SC186", "SS154", "TB864", "VO822", "WG794",
   "WB909", "YG007", "ZP559"],
);

/**
 * Example 19C — protein content (% of mass) of 29 wheat samples.
 * The values 83 and 21.5 are mis-keyed 8.3 and 12.5; the rule should catch both.
 */
const WHEAT_PROTEIN = single(
  "wheat",
  "Wheat protein (n = 29)",
  "protein (% of mass)",
  [9.2, 8.0, 10.9, 11.6, 10.4, 9.5, 8.5, 7.7, 8.0, 11.3, 10.0, 12.8, 8.2, 10.5,
   10.2, 11.9, 8.1, 12.6, 8.4, 9.6, 11.3, 9.7, 10.8, 83, 10.8, 11.5, 21.5, 9.4, 9.7],
  "Both 83 and 21.5 are flagged as outliers: they are a misplaced decimal point and transposed digits.",
);

/** Example 20C — January rainfall (mm) at Paarl, 1884–1905. */
const PAARL_RAINFALL = single(
  "rain",
  "Paarl rainfall (n = 22)",
  "January rainfall (mm)",
  [2.6, 4.9, 16.3, 21.6, 6.1, 0.0, 0.0, 1.1, 37.8, 0.0, 0.0, 52.3, 4.1, 6.4,
   15.8, 27.7, 3.0, 145.1, 39.7, 105.9, 17.8, 10.6],
  "Strongly skewed to the right: four bone-dry Januaries, and one of 145 mm.",
);

/** Example 21A — dividend yields (%) of 15 paper-and-packaging shares. */
const DIVIDEND_YIELDS = single(
  "yields",
  "Dividend yields (n = 15)",
  "dividend yield (%)",
  [3.3, 8.4, 10.7, 6.0, 9.6, 7.6, 7.1, 6.6, 8.6, 5.8, 6.7, 2.9, 7.5, 8.2, 3.0],
  "Mean 6.80% against a median of 7.1%: barely any difference, because the data is near-symmetric.",
);

/**
 * Example 22A — weekly traded volume of the same 15 shares.
 * Listed in the same company order as `DIVIDEND_YIELDS`, reading the printed
 * table column by column, so the two batches stay positionally comparable.
 */
const WEEKLY_VOLUME = single(
  "volume",
  "Weekly volume (n = 15)",
  "shares traded per week",
  [2300, 2100, 3100, 1200, 31800, 0, 100, 111400, 700, 100, 700, 0, 40600, 84100, 45900],
  "Mean 21 607 against a median of 2 100: a few huge trades drag the mean ten times above the middle.",
);

/** Lookup of every WU2 dataset by id, for the selector menu. */
export const SUMMARY_DATASETS: Record<string, SummaryDataset> = {
  [FOOTBALL_POINTS.id]: FOOTBALL_POINTS,
  [GMAT_BY_FACULTY.id]: GMAT_BY_FACULTY,
  [COMPUTER_USAGE.id]: COMPUTER_USAGE,
  [WHEAT_PROTEIN.id]: WHEAT_PROTEIN,
  [PAARL_RAINFALL.id]: PAARL_RAINFALL,
  [DIVIDEND_YIELDS.id]: DIVIDEND_YIELDS,
  [WEEKLY_VOLUME.id]: WEEKLY_VOLUME,
};

/**
 * Small batches for `MeanMedianBalance`, where the student drags observations
 * along a number line. Scaled to a 0–100 axis so one axis serves all of them.
 *
 * Every preset keeps distinct values at least 6 apart. The beam is 370 SVG
 * units wide for 100 data units and a weight is 16 units across, so anything
 * closer than ~4.4 apart overlaps into an ungrabbable blob. Values that are
 * exactly equal are fine — `MeanMedianBalance` stacks those vertically.
 */
export interface BalancePreset {
  id: string;
  label: string;
  values: number[];
  /** What the student should notice once the preset loads. */
  caption: string;
}

export const BALANCE_PRESETS: BalancePreset[] = [
  {
    id: "symmetric",
    label: "Symmetric",
    values: [20, 30, 40, 50, 50, 50, 60, 70, 80],
    caption: "Symmetric and unimodal: the mean and median sit on top of each other.",
  },
  {
    id: "skewed",
    label: "Skewed right",
    values: [10, 16, 22, 28, 35, 44, 58, 76, 96],
    caption: "A long tail to the right drags the mean above the median.",
  },
  {
    id: "outlier",
    label: "One outlier",
    values: [10, 16, 22, 28, 34, 40, 46, 52, 95],
    caption: "Drag the lone high point further right: the mean chases it, the median does not move.",
  },
];
