"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALL_UNITS } from "@/content/units";

export interface QuizAnswer {
  questionId: string;
  selectedOption: number | boolean;
  correct: boolean;
}

export interface UnitProgress {
  slug: string;
  completed: boolean;
  score: number;
  totalQuestions: number;
  attempts: number;
  lastAttemptAt: string | null;
  answers: QuizAnswer[];
}

interface ProgressState {
  units: Record<string, UnitProgress>;
  completeUnit: (slug: string, score: number, total: number, answers: QuizAnswer[]) => void;
  getUnitProgress: (slug: string) => UnitProgress | null;
  getCompletedUnits: () => string[];
  getModuleProgress: (moduleId: string) => { completed: number; total: number };
}

/**
 * Pure selector: progress record for one unit, or null if never attempted.
 *
 * Components must derive progress from a reactive `units` subscription
 * (`useProgressStore((s) => s.units)`) rather than calling the store's getter
 * methods in render — the getters are stable function references, so
 * subscribing to them never re-renders when progress actually changes.
 */
export function selectUnitProgress(
  units: Record<string, UnitProgress>,
  slug: string
): UnitProgress | null {
  return units[slug] ?? null;
}

/** Pure selector: completed / total unit counts for one module. */
export function selectModuleProgress(
  units: Record<string, UnitProgress>,
  moduleId: string
): { completed: number; total: number } {
  const moduleUnits = ALL_UNITS.filter((u) => u.moduleId === moduleId);
  const completed = moduleUnits.filter((u) => units[u.slug]?.completed).length;
  return { completed, total: moduleUnits.length };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      units: {},

      completeUnit: (slug, score, total, answers) => {
        const existing = get().units[slug];
        const isBetter = !existing || score > existing.score;
        set((state) => ({
          units: {
            ...state.units,
            [slug]: {
              slug,
              // Completion, like the score, is best-of-all-attempts: a lower
              // retake must not revoke a previously earned completion.
              completed: score === total || (existing?.completed ?? false),
              score: isBetter ? score : (existing?.score ?? 0),
              totalQuestions: total,
              attempts: (existing?.attempts ?? 0) + 1,
              lastAttemptAt: new Date().toISOString(),
              answers: isBetter ? answers : (existing?.answers ?? []),
            },
          },
        }));
      },

      // Imperative getters for non-render call sites (and the Phase 2 API
      // swap). Render code should use the pure `select*` helpers above with a
      // reactive `units` subscription instead.
      getUnitProgress: (slug) => selectUnitProgress(get().units, slug),

      getCompletedUnits: () =>
        Object.values(get().units)
          .filter((u) => u.completed)
          .map((u) => u.slug),

      getModuleProgress: (moduleId) =>
        selectModuleProgress(get().units, moduleId),
    }),
    {
      name: "sta1000-progress",
      // `generateStaticParams` prerenders unit pages at build time, so the
      // server-rendered HTML always has an empty `units: {}`. The default
      // persist behaviour rehydrates from localStorage synchronously at
      // module load — before React's first client render — which would make
      // that render disagree with the prerendered HTML and trigger a
      // hydration mismatch. `skipHydration` holds the store at its initial
      // state until `rehydrateStores()` (called from a `useEffect` in
      // `ThreePanelShell`, after hydration has completed) restores the saved
      // progress — an ordinary post-mount update, not a hydration error.
      skipHydration: true,
      // Version 1: the first two Module 1 units swapped slugs, so the set
      // theory unit is now `m1-set-theory` and the probability unit is
      // `m1-introducing-probability`. Saved progress from before the swap is
      // filed under the old slugs, so swap those two records once to keep each
      // student's quiz results with the unit they actually took.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Pick<ProgressState, "units">;
        if (version < 1 && state?.units) {
          const oldUnit1 = state.units["m1-introducing-probability"];
          const oldUnit2 = state.units["m1-set-theory"];
          delete state.units["m1-introducing-probability"];
          delete state.units["m1-set-theory"];
          if (oldUnit1) state.units["m1-set-theory"] = { ...oldUnit1, slug: "m1-set-theory" };
          if (oldUnit2) {
            state.units["m1-introducing-probability"] = {
              ...oldUnit2,
              slug: "m1-introducing-probability",
            };
          }
        }
        return state as ProgressState;
      },
    }
  )
);
