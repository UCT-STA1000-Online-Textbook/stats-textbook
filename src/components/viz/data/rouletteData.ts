/**
 * The European roulette wheel and the bets a student can place on it, for
 * the `roulette-wheel` visualisation in the "Games of chance" section of
 * `m1-conditional-probability`.
 *
 * A European wheel has 37 pockets: the numbers 1 to 36 (18 red, 18 black)
 * and a single green 0. The student bets R1 a spin on a colour, which pays
 * R2, or on a single number, which pays R36: the figures in the Roulette
 * worked example. Both bets carry the same house advantage of 1/37 = 2.70%.
 */

/** The pocket numbers in the order they sit around a European wheel, starting at 0. */
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/** Number of pockets on the wheel. */
export const POCKET_COUNT = WHEEL_ORDER.length;

/** The 18 red numbers. Every other number from 1 to 36 is black, and 0 is green. */
const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/** The colour of a pocket. */
export type PocketColour = "red" | "black" | "green";

/** The colour of the pocket holding number `n`. */
export function colourOf(n: number): PocketColour {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

/** A bet the student can place: a colour, or a single number from 0 to 36. */
export type RouletteBet = "red" | "black" | number;

/** Whether a spin landing on number `n` wins `bet`. */
export function betWins(bet: RouletteBet, n: number): boolean {
  return typeof bet === "number" ? n === bet : colourOf(n) === bet;
}

/**
 * What the casino pays back on a winning R1 bet, stake included (rand):
 * R2 on a colour, R36 on a single number.
 */
export function betPayout(bet: RouletteBet): number {
  return typeof bet === "number" ? 36 : 2;
}

/**
 * The working for one bet, as printed in the read-out: the chance of a win
 * and the fair payout c/p. A colour covers 18 of the 37 pockets; a number, 1.
 */
export function betOdds(bet: RouletteBet): { pText: string; fairText: string } {
  return typeof bet === "number"
    ? { pText: "1/37", fairText: "37" }
    : // 37/18 = 2.0555…; four decimals, as in the Roulette worked example.
      { pText: "18/37", fairText: "2.0556" };
}

/**
 * Expected loss on each R1 bet, in rand: the house advantage of 1/37. It is
 * the same for every bet: 18/37 × R2 = 1/37 × R36 = R36/37 comes back on
 * average, so R1/37 is lost.
 */
export const HOUSE_EDGE = 1 / 37;
