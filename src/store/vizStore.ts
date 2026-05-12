"use client";

import { create } from "zustand";

export type VizParams = Record<string, string | number | boolean | number[] | string[]>;

interface VizState {
  activeViz: string | null;
  vizParams: VizParams;
  quizOpen: boolean;
  setViz: (vizId: string, params?: VizParams) => void;
  setQuizOpen: (open: boolean) => void;
  resetViz: () => void;
}

export const useVizStore = create<VizState>()((set) => ({
  activeViz: null,
  vizParams: {},
  quizOpen: false,
  setViz: (vizId, params = {}) => set({ activeViz: vizId, vizParams: params }),
  setQuizOpen: (open) => set({ quizOpen: open }),
  resetViz: () => set({ activeViz: null, vizParams: {}, quizOpen: false }),
}));
