/**
 * Number formatting shared by the Module 5 inference viz (`ZTest`,
 * `TDistribution`, `TwoSampleT`, …), so every read-out prints figures the
 * way the text does: a true minus sign, no stray trailing zeros, subscript
 * degrees of freedom.
 */

/** Formats a number with a true minus sign, as the text prints it. */
export function fmt(v: number, dp: number): string {
  const s = v.toFixed(dp);
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
}

/** Prints a figure without trailing zeros: 103, 4.5, 0.5. */
export function trim(v: number): string {
  return fmt(Number(v.toFixed(4)), 4).replace(/\.?0+$/, "");
}

/** Writes a whole number as subscript digits, for t₉ and t₁₉. */
export function sub(n: number): string {
  return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
}

/** Percentage to one decimal: "5.2%". */
export function pct(p: number): string {
  return `${(100 * p).toFixed(1)}%`;
}
