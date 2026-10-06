/**
 * Inline hyperlink that loads a visualisation into the right panel.
 *
 * Accepts flat viz-configuring props (`mode`, `n`, `dataset`, …) rather than
 * a nested params object — MDX fails to parse object literals
 * (`{{ mode: "A" }}`) when the component appears inline inside a markdown
 * blockquote, so `buildVizParams` assembles the params object from the flat
 * props instead. See `vizParams.ts` for the full whitelist.
 */

"use client";

import type { ReactNode } from "react";
import { useVizStore } from "@/store/vizStore";
import { useUiStore } from "@/store/uiStore";
import { buildVizParams, VizParamProps } from "./vizParams";

interface KeywordChipProps extends VizParamProps {
  children: ReactNode;
  /** Key into `VIZ_REGISTRY`. */
  vizId: string;
}

export function KeywordChip({ children, vizId, ...vizParamProps }: KeywordChipProps) {
  const setViz = useVizStore((s) => s.setViz);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  function handleClick() {
    setViz(vizId, buildVizParams(vizParamProps));
    // Opening a viz folds the sidebar to its icon rail (desktop only; the
    // flag is inert below lg) so the viz and the text get the room.
    setSidebarCollapsed(true);
  }

  return (
    <button
      onClick={handleClick}
      className="not-italic font-[inherit] text-blue-600 underline underline-offset-2 decoration-blue-300 hover:text-blue-800 hover:decoration-blue-500 transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
