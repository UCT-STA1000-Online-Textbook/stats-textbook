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
  resetUnit: (slug: string) => void;
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
              completed: score === total,
              score: isBetter ? score : (existing?.score ?? 0),
              totalQuestions: total,
              attempts: (existing?.attempts ?? 0) + 1,
              lastAttemptAt: new Date().toISOString(),
              answers: isBetter ? answers : (existing?.answers ?? []),
            },
          },
        }));
      },

      getUnitProgress: (slug) => get().units[slug] ?? null,

      getCompletedUnits: () =>
        Object.values(get().units)
          .filter((u) => u.completed)
          .map((u) => u.slug),

      getModuleProgress: (moduleId) => {
        const moduleUnits = ALL_UNITS.filter((u) => u.moduleId === moduleId);
        const completed = moduleUnits.filter(
          (u) => get().units[u.slug]?.completed
        ).length;
        return { completed, total: moduleUnits.length };
      },

      resetUnit: (slug) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [slug]: _, ...rest } = state.units;
          return { units: rest };
        }),
    }),
    { name: "sta1000-progress" }
  )
);
