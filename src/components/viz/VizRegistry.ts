/**
 * Registry mapping `vizId` strings to React components.
 *
 * The `vizId` is the contract between MDX content and the right panel:
 *
 *   1. Author writes `<TryThis vizId="venn-diagram" … />` in MDX.
 *   2. `TryThis` calls `vizStore.setViz("venn-diagram", params)`.
 *   3. `VizPanel` looks up `VIZ_REGISTRY["venn-diagram"]` and renders it.
 *
 * Each entry is a `React.lazy(() => import(…))` so that only the components
 * actually used by the active unit are pulled into the bundle.
 *
 * Visualisations are added incrementally as content arrives from the
 * lecturer — do not pre-populate this map with placeholders.
 */

import { lazy } from "react";
import type { ComponentType } from "react";
import type { VizParams } from "@/store/vizStore";

export type VizComponent = ComponentType<{ params: VizParams }>;

export const VIZ_REGISTRY: Record<string, VizComponent> = {
  // M1 — Set theory primer (m1-introducing-probability)
  "venn-diagram": lazy(() => import("./probability/VennDiagram")),
  "set-builder-line": lazy(() => import("./probability/SetBuilderLine")),
  "set-partition": lazy(() => import("./probability/SetPartition")),

  // M1 — Sample spaces, axioms & theorems (m1-set-theory)
  "relative-frequency": lazy(() => import("./probability/RelativeFrequency")),
  "probability-venn": lazy(() => import("./probability/ProbabilityVenn")),
};
