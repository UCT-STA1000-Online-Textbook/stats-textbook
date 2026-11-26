/**
 * Shared definitions for review mode: the feedback tools that let lecturers
 * and TAs comment on the textbook straight from the site.
 *
 * Review mode is switched on by the `NEXT_PUBLIC_REVIEW_MODE` environment
 * variable (set it to "on" in Vercel). Next.js copies `NEXT_PUBLIC_` values
 * into the page code when the site is built, so changing the switch needs a
 * redeploy before it takes effect. With the switch off, none of the comment
 * buttons appear and `/api/feedback` refuses every request, so students never
 * see any of it.
 *
 * A comment travels from `ReviewDialog` (in the browser) to the route in
 * `src/app/api/feedback/route.ts` (on the server), which checks the reviewer
 * passcode and files the comment as a GitHub issue. The types below are the
 * shape of that message, shared by both ends.
 */

/** True when the site was built with review mode switched on. */
export const REVIEW_MODE = process.env.NEXT_PUBLIC_REVIEW_MODE === "on";

/** The kinds of comment a reviewer can choose from, in the order shown. */
export const FEEDBACK_TYPE_IDS = ["error", "wording", "viz-bug", "idea", "discussion"] as const;

/** One of {@link FEEDBACK_TYPE_IDS}. */
export type FeedbackTypeId = (typeof FEEDBACK_TYPE_IDS)[number];

/**
 * Label and one-line explanation for each comment type. All the hints are
 * shown at once in the comment box, so they are written to be compared side
 * by side: "Idea" is a small change, "Discussion" a bigger one.
 */
export const FEEDBACK_TYPES: Record<FeedbackTypeId, { label: string; hint: string }> = {
  error: { label: "Error", hint: "Something is wrong: a maths slip, a wrong fact, a typo." },
  wording: { label: "Wording", hint: "Correct, but unclear or awkward to read." },
  "viz-bug": {
    label: "Viz bug",
    hint: "A visualisation is broken, looks wrong on your screen, or disagrees with the text.",
  },
  idea: {
    label: "Idea",
    hint: "A small addition we could just make, for example a missing solution or an extra example.",
  },
  discussion: {
    label: "Discussion",
    hint: "A bigger change the lecturers should agree on first, for example reordering sections or units.",
  },
};

/**
 * GitHub label for issues the teaching team must agree on before anyone acts.
 * Discussion comments get it automatically; the team can also add it by hand
 * to any issue, and remove it once a decision is made.
 */
export const NEEDS_DISCUSSION_LABEL = "needs-discussion";

/** Longest comment a reviewer can type. */
export const MAX_COMMENT = 2000;

/** Longest highlighted passage kept with a comment; longer ones are cut. */
export const MAX_QUOTE = 600;

/**
 * What a comment is about. Filled in automatically by whichever button the
 * reviewer used, so they only have to type what is wrong.
 */
export interface FeedbackTarget {
  /**
   * Which button opened the comment box: highlighted text, a visualisation's
   * header, a quiz question, or the general Feedback button.
   */
  kind: "text" | "viz" | "quiz" | "general";
  /** The highlighted text, or the quiz question's wording. */
  quote?: string;
  /** Where on the page, e.g. "Binomial probabilities › Example 2B" or "Quiz question 3". */
  location?: string;
  /** Registry id of the visualisation (viz comments only). */
  vizId?: string;
  /** The visualisation's settings when the comment was made, as JSON (viz comments only). */
  vizParams?: string;
}

/** The message `ReviewDialog` sends to `/api/feedback`. */
export interface FeedbackPayload extends FeedbackTarget {
  passcode: string;
  /** Reviewer's name or initials, as they typed it. */
  name: string;
  type: FeedbackTypeId;
  comment: string;
  /** Slug of the unit the reviewer was reading. */
  slug: string;
}
