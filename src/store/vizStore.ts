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
  setViz: (vizId: string, params?: VizParams) => void;
  setQuizOpen: (open: boolean) => void;
  resetViz: () => void;
}

export const useVizStore = create<VizState>()((set) => ({
  activeViz: null,
  vizParams: {},
  quizOpen: false,
  quizOpenNonce: 0,
  setViz: (vizId, params = {}) => set({ activeViz: vizId, vizParams: params }),
  setQuizOpen: (open) =>
    set((s) => ({
      quizOpen: open,
      quizOpenNonce: open ? s.quizOpenNonce + 1 : s.quizOpenNonce,
    })),
  resetViz: () => set({ activeViz: null, vizParams: {}, quizOpen: false }),
}));
