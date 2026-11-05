/**
 * Zustand store for the right panel: which visualisation is showing, with
 * what params, and whether the quiz is open.
 *
 * Each unit has a default visualisation (its frontmatter `defaultViz`, or
 * else the first `<TryThis>` in its text; see `src/lib/mdx.ts`). The store
 * remembers it so the panel's Reset button returns to that view rather than
 * to an empty panel.
 */

"use client";

import { create } from "zustand";

export type VizParams = Record<string, string | number | boolean | number[] | string[]>;

interface VizState {
  activeViz: string | null;
  vizParams: VizParams;
  quizOpen: boolean;
  /**
   * Monotonic counter bumped on every quiz *open*. `VizPanel` keys
   * `QuizPanel` on it so each open starts from a fresh, unsubmitted state —
   * without it, clicking the reading panel's "Retake quiz" while a submitted
   * quiz is still showing would silently do nothing (quizOpen is already
   * true, and the panel's local answers/submitted state would survive).
   */
  quizOpenNonce: number;
  /**
   * Bumped by every `setViz` and Reset. `VizPanel` adds it to the viz's key,
   * so a "Try this" click or Reset always restarts the viz from its starting
   * state, even when that same viz and params are already on screen (for
   * example, the unit's default, which is its first "Try this").
   */
  loadNonce: number;
  /** The unit's default viz, or null for a unit with no visualisations. */
  defaultViz: string | null;
  /** Params for `defaultViz`. */
  defaultVizParams: VizParams;
  setViz: (vizId: string, params?: VizParams) => void;
  setQuizOpen: (open: boolean) => void;
  /**
   * Records the unit's default viz and shows it. Called once per unit
   * navigation; pass null for a unit with no visualisations.
   */
  loadDefaultViz: (vizId: string | null, params?: VizParams) => void;
  /** Closes the quiz and returns the panel to the unit's default viz. */
  resetViz: () => void;
}

export const useVizStore = create<VizState>()((set) => ({
  activeViz: null,
  vizParams: {},
  quizOpen: false,
  quizOpenNonce: 0,
  loadNonce: 0,
  defaultViz: null,
  defaultVizParams: {},
  setViz: (vizId, params = {}) =>
    set((s) => ({
      activeViz: vizId,
      vizParams: params,
      loadNonce: s.loadNonce + 1,
    })),
  setQuizOpen: (open) =>
    set((s) => ({
      quizOpen: open,
      quizOpenNonce: open ? s.quizOpenNonce + 1 : s.quizOpenNonce,
    })),
  loadDefaultViz: (vizId, params = {}) =>
    set({
      defaultViz: vizId,
      defaultVizParams: params,
      activeViz: vizId,
      vizParams: params,
    }),
  resetViz: () =>
    set((s) => ({
      activeViz: s.defaultViz,
      vizParams: s.defaultVizParams,
      quizOpen: false,
      loadNonce: s.loadNonce + 1,
    })),
}));
