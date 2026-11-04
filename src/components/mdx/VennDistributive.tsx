/**
 * The worked solution to Example 10B in Module 1, WU1 (`m1-set-theory`): two
 * Venn diagrams showing that (A ∪ B) ∩ C = (A ∩ C) ∪ (B ∩ C).
 *
 * The left diagram builds the left-hand side: A ∪ B shaded pale blue, C
 * hatched, and the region that is both shown dark blue. The right diagram
 * shades A ∩ C and B ∩ C dark blue. The two dark regions are identical,
 * which is the whole point of the example.
 *
 * The regions are cut out with SVG clip paths rather than drawn as hand-made
 * arcs, so each one is exactly the overlap of the circles it names.
 *
 * Usage in MDX: `<VennDistributive />` (no props).
 */

import type { ReactNode } from "react";
import katex from "katex";

/** Renders a TeX string to KaTeX HTML, the same engine the MDX maths uses. */
function tex(source: string): string {
  return katex.renderToString(source, { throwOnError: false });
}

// Circle layout shared by both diagrams, in viewBox units (240 × 190).
const R = 50;
const A = { x: 95, y: 75 };
const B = { x: 145, y: 75 };
const C = { x: 120, y: 120 };

const PALE = "rgb(219, 234, 254)"; // blue-100
const DARK = "rgb(59, 130, 246)"; // blue-500, solid so overlapping pieces stay one colour
const HATCH = "rgb(96, 165, 250)"; // blue-400
const INK = "rgb(51, 65, 85)"; // slate-700

/**
 * One Venn diagram: the sample space S, the outlines of A, B and C, and
 * whatever shaded regions `children` draws underneath the outlines.
 */
function Diagram({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 190" role="img" aria-label={label} className="mx-auto block w-full max-w-[260px]">
      <rect x="4" y="4" width="232" height="182" fill="white" stroke={INK} strokeWidth="1.2" />
      {children}
      {[A, B, C].map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={R} fill="none" stroke={INK} strokeWidth="1.2" />
      ))}
      <g fill={INK} fontSize="14" fontStyle="italic" fontFamily="serif">
        <text x="16" y="24">S</text>
        <text x="40" y="40">A</text>
        <text x="192" y="40">B</text>
        <text x="182" y="168">C</text>
      </g>
    </svg>
  );
}

/** Example 10B solution figure: both sides of the distributive law. */
export function VennDistributive() {
  return (
    <figure className="callout my-6 rounded-xl border border-[color:var(--color-line)] bg-slate-50/50 px-3 py-4">
      {/* The clip paths and hatch pattern are shared by both diagrams. A clip
          path with two circles keeps whatever lies inside either one, so
          "clip-ab" is A ∪ B. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <clipPath id="venn10b-ab">
            <circle cx={A.x} cy={A.y} r={R} />
            <circle cx={B.x} cy={B.y} r={R} />
          </clipPath>
          <clipPath id="venn10b-c">
            <circle cx={C.x} cy={C.y} r={R} />
          </clipPath>
          <pattern id="venn10b-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke={HATCH} strokeWidth="1.5" />
          </pattern>
        </defs>
      </svg>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Diagram label="Venn diagram: A union B shaded pale, C hatched, and their intersection shaded dark">
            <circle cx={A.x} cy={A.y} r={R} fill={PALE} />
            <circle cx={B.x} cy={B.y} r={R} fill={PALE} />
            <circle cx={C.x} cy={C.y} r={R} fill="url(#venn10b-hatch)" />
            <circle cx={C.x} cy={C.y} r={R} fill={DARK} clipPath="url(#venn10b-ab)" />
          </Diagram>
          <div
            className="mt-2 text-center text-[13px]"
            dangerouslySetInnerHTML={{ __html: tex(String.raw`(A \cup B) \cap C`) }}
          />
        </div>
        <div>
          <Diagram label="Venn diagram: A intersect C and B intersect C shaded dark">
            <circle cx={A.x} cy={A.y} r={R} fill={DARK} clipPath="url(#venn10b-c)" />
            <circle cx={B.x} cy={B.y} r={R} fill={DARK} clipPath="url(#venn10b-c)" />
          </Diagram>
          <div
            className="mt-2 text-center text-[13px]"
            dangerouslySetInnerHTML={{ __html: tex(String.raw`(A \cap C) \cup (B \cap C)`) }}
          />
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-[color:var(--color-ink-500)]">
        Left: pale blue is A ∪ B, hatched is C, dark blue is the part that is both. Right: dark blue
        is A ∩ C together with B ∩ C. The two dark regions are the same.
      </figcaption>
    </figure>
  );
}
