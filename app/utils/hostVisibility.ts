export const PUBLIC_HOST_APPLICATION_VISIBLE_STATUSES = ['approved', 'active'] as const;

const PUBLIC_HOST_APPLICATION_VISIBLE_STATUS_SET = new Set<string>(PUBLIC_HOST_APPLICATION_VISIBLE_STATUSES);

type PublicHostApplicationLike = {
  id?: string | number | null;
  user_id?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export function isPublicHostApplicationStatus(status?: string | null): boolean {
  return typeof status === 'string' && PUBLIC_HOST_APPLICATION_VISIBLE_STATUS_SET.has(status);
}

function getComparableId(id?: string | number | null) {
  if (typeof id === 'number') {
    return String(id).padStart(20, '0');
  }

  return typeof id === 'string' ? id : '';
}

function comparePublicHostApplicationRows(
  a: PublicHostApplicationLike,
  b: PublicHostApplicationLike
) {
  const timestampA = Date.parse(a.created_at || '') || 0;
  const timestampB = Date.parse(b.created_at || '') || 0;

  if (timestampA !== timestampB) {
    return timestampB - timestampA;
  }

  return getComparableId(b.id).localeCompare(getComparableId(a.id));
}

export function pickLatestPublicHostApplication<T extends PublicHostApplicationLike>(rows: T[]) {
  return [...rows].sort(comparePublicHostApplicationRows)[0] ?? null;
}

export function pickLatestPublicHostApplicationsByUser<T extends PublicHostApplicationLike>(rows: T[]) {
  const latestByUser = new Map<string, T>();

  for (const row of [...rows].sort(comparePublicHostApplicationRows)) {
    const userId = typeof row.user_id === 'string' ? row.user_id : '';
    if (!userId || latestByUser.has(userId)) {
      continue;
    }

    latestByUser.set(userId, row);
  }

  return latestByUser;
}
