/**
 * Inline hyperlink that loads a visualisation into the right panel.
 *
 * Accepts flat `mode` and `n` props rather than a nested params object —
 * MDX fails to parse object literals (`{{ mode: "A" }}`) when the component
 * appears inline inside a markdown blockquote, so we build the params object
 * here instead of receiving it pre-assembled.
 */

"use client";

import type { ReactNode } from "react";
import { useVizStore } from "@/store/vizStore";

interface KeywordChipProps {
  children: ReactNode;
  /** Key into `VIZ_REGISTRY`. */
  vizId: string;
  /** Mode string forwarded to visualisations that accept a `mode` param. */
  mode?: string;
  /** Numeric param forwarded to visualisations that accept an `n` param. */
  n?: number;
}

export function KeywordChip({ children, vizId, mode, n }: KeywordChipProps) {
  const setViz = useVizStore((s) => s.setViz);

  function handleClick() {
    const params: Record<string, string | number> = {};
    if (mode !== undefined) params.mode = mode;
    if (n !== undefined) params.n = n;
    setViz(vizId, params);
  }

  return (
    <button
      onClick={handleClick}
      className="not-italic font-[inherit] text-indigo-600 underline underline-offset-2 decoration-indigo-300 hover:text-indigo-800 hover:decoration-indigo-500 transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
