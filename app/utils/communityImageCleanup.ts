/** Current community writer uses community/<Auth UUID>/<sanitized filename>. */
export function isOwnedCommunityImagePath(path: string, ownerId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(ownerId)) return false;
  const prefix = 'community/' + ownerId + '/';
  if (!path.startsWith(prefix) || path.includes('..')) return false;
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(path.slice(prefix.length));
}

export async function cleanupOwnedCommunityImages(paths: string[], ownerId: string, deps: {
  hasReferences(path: string): Promise<boolean>;
  removeOwned(paths: string[]): Promise<void>;
}) {
  if (!paths.length) return { status: 'empty' };
  if (paths.some(path => !isOwnedCommunityImagePath(path, ownerId))) return { status: 'denied' };
  const eligible: string[] = [];
  try {
    for (const path of [...new Set(paths)]) {
      if (!await deps.hasReferences(path)) eligible.push(path);
    }
    if (!eligible.length) return { status: 'referenced' };
    await deps.removeOwned(eligible);
    return { status: 'complete', objects: eligible.length };
  } catch {
    // A database/ownership uncertainty must never authorize privileged deletion.
    return { status: 'blocked' };
  }
}
