/**
 * Pointer-drag hook for the SVG-based visualisations.
 *
 * `useSvgDrag` returns a `startDrag` function to call from a draggable SVG
 * element's `onPointerDown`. While the pointer is held it reports the drag
 * displacement converted into the SVG's own `viewBox` coordinate system, so a
 * component can reason in the same units it draws with.
 *
 * Pointer Events unify mouse and touch; the move/up listeners live on `window`
 * so a fast drag that leaves the element (or the SVG) is still tracked, and
 * any in-flight listeners are removed if the component unmounts mid-drag.
 *
 * Draggable elements should set `touch-action: none` so a touch-drag doesn't
 * also scroll the page.
 */

"use client";

import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from "react";

/** Converts a client (screen-pixel) point into the SVG's viewBox coordinates. */
function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Callback invoked on every pointer move with the drag delta in SVG units. */
export type DragMove = (dx: number, dy: number) => void;

/**
 * @param svgRef — ref to the `<svg>` the draggable elements live in.
 * @returns `startDrag(event, onMove)` — call from an element's `onPointerDown`;
 *   `onMove` receives the cumulative (dx, dy) displacement since the drag began,
 *   already scaled into viewBox units.
 */
export function useSvgDrag(svgRef: RefObject<SVGSVGElement | null>) {
  // Holds the teardown for the currently-active drag, so an unmount mid-drag
  // doesn't leak window listeners.
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback(
    (event: PointerEvent, onMove: DragMove) => {
      const svg = svgRef.current;
      if (!svg) return;
      event.preventDefault();

      const origin = clientToSvg(svg, event.clientX, event.clientY);

      const handleMove = (e: globalThis.PointerEvent) => {
        const p = clientToSvg(svg, e.clientX, e.clientY);
        onMove(p.x - origin.x, p.y - origin.y);
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        cleanupRef.current = null;
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      cleanupRef.current = handleUp;
    },
    [svgRef],
  );
}

/** Clamp helper shared by the viz components that consume drag deltas. */
export function clampN(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
