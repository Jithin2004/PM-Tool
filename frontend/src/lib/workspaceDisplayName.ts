// ── Workspace Display Name Helper ──────────────────────────────────────────
// Strips any accumulated "[Sandbox] " prefixes from workspace names and
// re-applies the prefix only at render time based on the sandbox flag.
// This prevents the "[Sandbox] [Sandbox] RI" duplication bug caused by
// the DB clone_workspace_to_sandbox RPC prepending the prefix each time.

/**
 * Returns a clean workspace display name.
 * Strips all "[Sandbox] " prefixes, then optionally re-applies one if sandbox is active.
 */
export function getWorkspaceDisplayName(name: string | undefined | null, isSandbox: boolean): string {
  if (!name) return '';
  // Strip any accumulated [Sandbox] prefixes (case-insensitive, greedy)
  const clean = name.replace(/\[Sandbox\]\s*/gi, '').trim();
  return isSandbox ? `[Sandbox] ${clean}` : clean;
}
