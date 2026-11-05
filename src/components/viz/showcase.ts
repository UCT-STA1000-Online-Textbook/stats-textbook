/**
 * The showcase-tier (3D) visualisations: the few that load three.js, and
 * cannon-es for physics.
 *
 * They are heavy to download and to run, so a unit never opens on one by
 * itself. When a unit's first `<TryThis>` is in this list, the right panel
 * shows its placeholder until the student clicks a prompt (see
 * `findFirstTryThis` in `src/lib/mdx.ts`). That keeps the 3D code off budget
 * phones and capped data unless the student actually asks for it.
 *
 * Kept apart from `VizRegistry.ts` so the build-time MDX code can read it
 * without pulling in the registry's component imports. Add an id here
 * whenever a new viz imports `three`.
 */
export const SHOWCASE_VIZ: ReadonlySet<string> = new Set([
  "random-trials",
  "counting-studio",
]);
