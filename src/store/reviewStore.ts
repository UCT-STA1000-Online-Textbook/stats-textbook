/**
 * Review-mode state: which comment box is open, and the reviewer's saved
 * name and passcode.
 *
 * The comment buttons (highlighted text, viz header, quiz questions, the
 * Feedback button) call `openComment()` with what the comment is about;
 * `ReviewDialog` reads `target` and shows the box while it is set.
 *
 * The name and passcode are remembered in this browser (localStorage) once a
 * comment has gone through, so a reviewer types them only once. Only those
 * two fields are saved; the open box is not. See `src/lib/review.ts` for how
 * review mode is switched on.
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FeedbackTarget } from "@/lib/review";

interface ReviewState {
  /** What the open comment box is about; null when no box is open. */
  target: FeedbackTarget | null;
  /** Reviewer's name or initials, remembered after their first comment. */
  name: string;
  /** Reviewer passcode, remembered once the server has accepted it. */
  passcode: string;
  /** Open the comment box for `target`. */
  openComment: (target: FeedbackTarget) => void;
  /** Close the comment box. */
  closeComment: () => void;
  /** Remember the name and passcode that just worked. */
  remember: (name: string, passcode: string) => void;
  /** Forget a passcode the server turned down, so the box asks for it again. */
  forgetPasscode: () => void;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set) => ({
      target: null,
      name: "",
      passcode: "",
      openComment: (target) => set({ target }),
      closeComment: () => set({ target: null }),
      remember: (name, passcode) => set({ name, passcode }),
      forgetPasscode: () => set({ passcode: "" }),
    }),
    {
      name: "sta1000-reviewer",
      partialize: (s) => ({ name: s.name, passcode: s.passcode }),
      // Same pattern as the other stores: ThreePanelShell rehydrates after
      // mount, so the first client render matches the prerendered page.
      skipHydration: true,
    }
  )
);
