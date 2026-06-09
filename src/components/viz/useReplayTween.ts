/**
 * Shared entrance/transition tween for the default-tier visualisations.
 *
 * Returns an eased 0→1 progress value that restarts from 0 whenever any entry
 * in `deps` changes, then animates to 1 over `durationMs`. Components multiply
 * geometry (slice sweep, bar height/width) by the result so a change of
 * dataset or setting replays a short, lightweight animation. The loop stops as
 * soon as it reaches 1, so it draws no frames while idle.
 *
 * The reset to 0 is applied *during render* (React's "adjust state when an
 * input changes" pattern) rather than in the effect body, so there is no
 * one-frame flash of the finished state and no synchronous setState inside the
 * effect.
 */

"use client";

import { useEffect, useState } from "react";

/** Cubic ease-out: fast start, gentle settle — feels responsive, not floaty. */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * @param deps — restart the tween when any of these values changes.
 * @param durationMs — total tween length; defaults to 550 ms.
 */
export function useReplayTween(deps: unknown[], durationMs = 550): number {
  const key = JSON.stringify(deps);
  const [progress, setProgress] = useState(0);
  const [prevKey, setPrevKey] = useState(key);

  // Reset to the start of the animation the moment the inputs change.
  if (key !== prevKey) {
    setPrevKey(key);
    setProgress(0);
  }

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // Clamp to [0, 1]: a rAF timestamp is the frame's start time, which can
      // be slightly *earlier* than `start` (captured later in the same frame),
      // making `now - start` momentarily negative. Without the lower clamp,
      // `easeOutCubic` would dip below 0 and geometry (bar heights/widths)
      // would briefly go negative.
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setProgress(easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, durationMs]);

  return progress;
}
