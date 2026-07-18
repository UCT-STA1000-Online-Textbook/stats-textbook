/**
 * Shared assembly of `VizParams` from the flat props MDX components accept.
 *
 * `TryThis` and `KeywordChip` both need to forward viz configuration from MDX
 * attributes into `vizStore.setViz`, but MDX in this project does not
 * reliably evaluate object-literal attributes (`params={{ mode: "A" }}`
 * silently arrives empty when the component sits inside certain MDX
 * contexts, e.g. a blockquote). So every viz-configuring prop is declared
 * flat on the component, and this module builds the `VizParams` record from
 * whichever of them are actually supplied.
 *
 * `VIZ_PARAM_KEYS` is the single whitelist of forwardable prop names — it
 * must cover every param any registered viz component reads (see each
 * component's `params.*` usage under `src/components/viz/`). Extend it
 * whenever a new viz introduces a new param name.
 */

import type { VizParams } from "@/store/vizStore";

/**
 * Flat MDX props that map 1:1 onto params read by registered viz
 * components. Prop names intentionally match the `params.<name>` key each
 * viz reads (see the `@param params.*` JSDoc on each component) so the
 * mapping in `buildVizParams` is a straight pass-through.
 */
export interface VizParamProps {
  /** VennDiagram / SetBuilderLine: initial highlighted region / result. */
  mode?: string;
  /** SetPartition: initial number of partition pieces. */
  n?: number;
  /** HistogramBuilder / CategoricalDisplay: initial dataset id. */
  dataset?: string;
  /** CategoricalDisplay: initial chart type ("pie" | "bar"). */
  chart?: string;
  /** RandomTrials: initial experiment ("coin" | "die"). */
  experiment?: string;
  /** CountingStudio: initial counting rule scenario. */
  scenario?: string;
  /** ProbabilityVenn: initial Pr(A). */
  pA?: number;
  /** ProbabilityVenn: initial Pr(B). */
  pB?: number;
  /** ProbabilityVenn: initial Pr(A ∩ B). */
  pAB?: number;
  /** IndependenceSquare: initial Pr(A). */
  pa?: number;
  /** IndependenceSquare: initial Pr(B|A). */
  pbga?: number;
  /** IndependenceSquare: initial Pr(B|Ā). */
  pbgabar?: number;
  /** BayesGrid: initial prior Pr(C). */
  pc?: number;
  /** BayesGrid: initial Pr(D|C). */
  pdc?: number;
  /** BayesGrid: initial Pr(D|C̄). */
  pdcbar?: number;
}

/** Ordered list of every key `VizParamProps` declares. */
const VIZ_PARAM_KEYS: (keyof VizParamProps)[] = [
  "mode",
  "n",
  "dataset",
  "chart",
  "experiment",
  "scenario",
  "pA",
  "pB",
  "pAB",
  "pa",
  "pbga",
  "pbgabar",
  "pc",
  "pdc",
  "pdcbar",
];

/**
 * Builds a `VizParams` object from a `VizParamProps`-shaped props bag,
 * omitting any prop that wasn't supplied so viz components fall back to
 * their own defaults.
 */
export function buildVizParams(props: VizParamProps): VizParams {
  const params: VizParams = {};
  for (const key of VIZ_PARAM_KEYS) {
    const value = props[key];
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Narrows a loosely-typed `Record<string, unknown>` — such as the
 * `vizHintParams` a quiz question declares in MDX frontmatter, which Zod
 * only validates as `z.record(z.string(), z.unknown())` — down to a
 * `VizParams` the viz store will accept. Keys whose value isn't one of the
 * types `VizParams` supports are dropped rather than coerced, since a
 * malformed param is safer silently ignored than passed through with an
 * unsafe cast.
 */
export function toVizParams(record?: Record<string, unknown>): VizParams {
  if (!record) return {};
  const params: VizParams = {};
  for (const [key, value] of Object.entries(record)) {
    const isPrimitive =
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean";
    const isStringArray =
      Array.isArray(value) && value.every((v) => typeof v === "string");
    const isNumberArray =
      Array.isArray(value) && value.every((v) => typeof v === "number");
    if (isPrimitive || isStringArray || isNumberArray) {
      params[key] = value as VizParams[string];
    }
  }
  return params;
}
