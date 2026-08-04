/**
 * s10 plan task 5, trap 7: the upstream example's own pattern
 * (`spawnSync("git", …).stdout.trim() ?? crypto.randomUUID()`) is wrong
 * in the dangerous direction — `??` only catches `null`/`undefined`, not
 * the empty string a shelled-out `git` command can print when it fails
 * inside a Vercel build container. This function never shells out at
 * all: the source is `VERCEL_GIT_COMMIT_SHA`, with an `||` fallback
 * (catches empty AND whitespace-only), used by both the /~offline
 * precache entry (task 5) and the version marker (task 7) so the two
 * never drift.
 */
export function resolveRevision(env: Record<string, string | undefined>): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha || crypto.randomUUID();
}
