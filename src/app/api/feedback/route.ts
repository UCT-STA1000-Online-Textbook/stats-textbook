/**
 * POST /api/feedback: files a reviewer's comment as a GitHub issue.
 *
 * This runs on the server (Vercel), never in the browser, because creating an
 * issue needs a GitHub token, and anything sent to the browser can be read by
 * anyone. The browser posts the comment here; this route checks the reviewer
 * passcode, then adds the token and asks GitHub to create the issue.
 *
 * Settings, all stored in Vercel's environment variables:
 *   - NEXT_PUBLIC_REVIEW_MODE   "on" to enable review mode (see src/lib/review.ts).
 *   - FEEDBACK_PASSCODE         the shared reviewer passcode.
 *   - FEEDBACK_GITHUB_TOKEN     a GitHub token allowed to create issues.
 *   - FEEDBACK_GITHUB_REPO      optional "owner/repo"; defaults to this project's repo.
 *
 * Responses: 201 with the new issue's link; 400 for a malformed comment;
 * 401 for a wrong passcode; 404 when review mode is off; 429 when one
 * address sends too much (see `tooMany`); 503 when the settings are missing;
 * 502 when GitHub refuses.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ALL_UNITS } from "@/content/units";
import {
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_IDS,
  MAX_COMMENT,
  MAX_QUOTE,
  REVIEW_MODE,
} from "@/lib/review";

const DEFAULT_REPO = "UCT-STA1000-Online-Textbook/stats-textbook";

/** Every issue gets this label, so reviewer comments are easy to list. */
const FEEDBACK_LABEL = "content-feedback";

/**
 * Optional context text, cut to `keep` characters rather than refused: a long
 * quiz question or heading should not stop a comment going through. Anything
 * far longer than any real page text is still refused.
 */
const trimmed = (keep: number) =>
  z.string().max(5000).transform((s) => s.slice(0, keep)).optional();

/** The shape of a valid comment; anything else is turned away with a 400. */
const PayloadSchema = z.object({
  passcode: z.string().max(200),
  name: z.string().trim().min(1).max(80),
  type: z.enum(FEEDBACK_TYPE_IDS),
  comment: z.string().trim().min(1).max(MAX_COMMENT),
  slug: z.string().max(100),
  kind: z.enum(["text", "viz", "quiz", "general"]),
  quote: trimmed(MAX_QUOTE),
  location: trimmed(200),
  vizId: z.string().max(100).optional(),
  vizParams: trimmed(1000),
});

type Payload = z.infer<typeof PayloadSchema>;

/** Wrong passcodes allowed from one address per window, to stop guessing. */
const MAX_FAILURES = 10;
/** Comments accepted from one address per window, to stop a flood of issues. */
const MAX_FILED = 30;
const WINDOW_MS = 60 * 60 * 1000;

/** Recent wrong-passcode and filed-comment times, per sender address. */
const failures = new Map<string, number[]>();
const filed = new Map<string, number[]>();

/**
 * True when `ip` has already reached `limit` events in the last hour. A rough
 * guard only: Vercel may run several copies of this route, each with its own
 * memory, so the real ceiling is a small multiple of `limit`. That is still
 * enough to turn a script hammering the route into a trickle.
 */
function tooMany(log: Map<string, number[]>, ip: string, limit: number): boolean {
  const now = Date.now();
  const recent = (log.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  log.set(ip, recent);
  return recent.length >= limit;
}

/** Note one event for `ip` in `log`. */
function record(log: Map<string, number[]>, ip: string) {
  log.set(ip, [...(log.get(ip) ?? []), Date.now()]);
}

/**
 * Compare passcodes in constant time, so the response time gives away nothing
 * about how much of a guess was right. Hashing first makes both sides the
 * same length, which `timingSafeEqual` requires.
 */
function passcodeMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Stop "@name" in reviewer text from notifying that GitHub user. A zero-width
 * space after the @ breaks the mention but looks the same on screen.
 */
function noMentions(text: string): string {
  return text.replace(/@/g, "@\u200b");
}

/** Collapse a free-text field onto one line, for the issue title and headers. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Drop backticks so a value cannot break out of its `code` span. */
function codeSafe(text: string): string {
  return text.replace(/`/g, "");
}

/** Build the issue title and body from a validated comment. */
function buildIssue(raw: Payload, unitTitle: string, pageUrl: string) {
  const p = {
    ...raw,
    name: noMentions(raw.name),
    comment: noMentions(raw.comment),
    quote: raw.quote && noMentions(raw.quote),
    location: raw.location && noMentions(raw.location),
  };
  const typeLabel = FEEDBACK_TYPES[p.type].label;
  const summary = oneLine(p.comment);
  const title = `[${unitTitle}] ${typeLabel}: ${
    summary.length > 70 ? `${summary.slice(0, 67)}...` : summary
  }`;

  const lines = [
    `**Type:** ${typeLabel}`,
    `**From:** ${oneLine(p.name)}`,
    `**Unit:** ${unitTitle} (\`${p.slug}\`) · ${pageUrl}`,
  ];
  if (p.location) lines.push(`**Where:** ${oneLine(p.location)}`);
  if (p.vizId) {
    lines.push(
      `**Visualisation:** \`${codeSafe(p.vizId)}\`${p.vizParams ? `, settings \`${codeSafe(p.vizParams)}\`` : ""}`
    );
  }
  if (p.quote) {
    const label = p.kind === "quiz" ? "Question" : "Highlighted text";
    // Prefix every line so a multi-line passage stays inside the quote block.
    lines.push("", `**${label}:**`, ...p.quote.split("\n").map((l) => `> ${l}`));
  }
  lines.push("", "**Comment:**", "", p.comment, "", "<sub>Filed from the textbook's review mode.</sub>");

  return { title, body: lines.join("\n") };
}

export async function POST(request: Request) {
  if (!REVIEW_MODE) return Response.json({ error: "Not found" }, { status: 404 });

  // Trimmed: a stray space or newline pasted into Vercel's settings would
  // otherwise make every passcode look wrong.
  const expectedPasscode = process.env.FEEDBACK_PASSCODE?.trim();
  const token = process.env.FEEDBACK_GITHUB_TOKEN;
  if (!expectedPasscode || !token) {
    return Response.json(
      { error: "Feedback is not set up yet: the passcode or GitHub token is missing." },
      { status: 503 }
    );
  }

  // Vercel puts the sender's address first in x-forwarded-for.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (tooMany(failures, ip, MAX_FAILURES) || tooMany(filed, ip, MAX_FILED)) {
    return Response.json(
      { error: "Too many attempts from this connection. Please try again in an hour." },
      { status: 429 }
    );
  }

  const parsed = PayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That comment could not be read. Please try again." }, { status: 400 });
  }
  const payload = parsed.data;

  if (!passcodeMatches(payload.passcode, expectedPasscode)) {
    record(failures, ip);
    return Response.json({ error: "That passcode was not recognised." }, { status: 401 });
  }

  // Take the unit title from the master list rather than trusting the browser.
  const unit = ALL_UNITS.find((u) => u.slug === payload.slug);
  if (!unit) return Response.json({ error: "Unknown unit." }, { status: 400 });

  const pageUrl = new URL(`/unit/${unit.slug}`, request.url).toString();
  const { title, body } = buildIssue(payload, unit.title, pageUrl);
  const repo = process.env.FEEDBACK_GITHUB_REPO || DEFAULT_REPO;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      labels: [FEEDBACK_LABEL, `feedback: ${payload.type}`],
    }),
  });

  if (!res.ok) {
    // The details go to Vercel's logs for whoever maintains the site; the
    // reviewer only needs to know it did not go through.
    console.error("GitHub refused the feedback issue:", res.status, await res.text());
    return Response.json(
      { error: "The comment could not be filed. Please try again later." },
      { status: 502 }
    );
  }

  record(filed, ip);
  const issue = (await res.json()) as { html_url: string; number: number };
  return Response.json({ url: issue.html_url, number: issue.number }, { status: 201 });
}
