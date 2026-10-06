/**
 * Whether Wide view is in effect right now.
 *
 * Wide view is a request the student makes from the viz panel header
 * (`uiStore.vizWide`), but it only applies while the active visualisation is
 * one that can use the room (`WIDE_CAPABLE`). Deriving it here, rather than
 * resetting the flag whenever the viz changes, means a click on an ordinary
 * `<TryThis>` simply shows the normal layout, and coming back to a
 * wide-capable viz restores Wide view without any effect juggling.
 *
 * Read by `VizPanel` and `ReadingPanel` to size the two columns. The
 * wide-capable viz do not read it: they lay out from the panel's own width
 * with a CSS container query, so they also adapt on large screens.
 */

"use client";

import { useUiStore } from "@/store/uiStore";
import { useVizStore } from "@/store/vizStore";
import { WIDE_CAPABLE } from "@/components/viz/VizRegistry";

/** True when Wide view is requested and the active viz supports it. */
export function useVizWide(): boolean {
  const vizWide = useUiStore((s) => s.vizWide);
  const activeViz = useVizStore((s) => s.activeViz);
  return vizWide && activeViz !== null && WIDE_CAPABLE.has(activeViz);
}
