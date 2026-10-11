/**
 * Student ratings of the visualisations: 1 to 5 stars and an optional comment,
 * one rating per viz id. A student who rates the same viz again replaces
 * their earlier rating rather than adding a second one.
 *
 * Ratings are saved in the student's own browser (localStorage) only, so for
 * now nobody else can see them. `rateViz()` is the swap point for the Phase 2
 * backend: replace its body with a `fetch('/api/feedback/...')` and the
 * `VizRating` component that calls it does not need to change.
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** One student's rating of one visualisation. */
export interface VizRatingRecord {
  /** Whole stars, 1 (poor) to 5 (excellent). */
  stars: number;
  /** Free-text comment; an empty string when the student left none. */
  comment: string;
  /** ISO timestamp of the most recent save. */
  ratedAt: string;
}

interface FeedbackState {
  /** Ratings keyed by viz id (the same ids as `VIZ_REGISTRY`). */
  ratings: Record<string, VizRatingRecord>;
  /** Save (or replace) the rating for one viz. */
  rateViz: (vizId: string, stars: number, comment: string) => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      ratings: {},

      rateViz: (vizId, stars, comment) =>
        set((state) => ({
          ratings: {
            ...state.ratings,
            [vizId]: {
              stars,
              comment: comment.trim(),
              ratedAt: new Date().toISOString(),
            },
          },
        })),
    }),
    {
      name: "sta1000-viz-feedback",
      // Same reason as progressStore: unit pages are prerendered with no
      // ratings, so loading localStorage before hydration would cause a
      // mismatch. ThreePanelShell rehydrates this store after mount.
      skipHydration: true,
    }
  )
);
