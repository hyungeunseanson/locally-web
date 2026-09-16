export type DashboardUserRole = 'admin' | 'host' | 'guest';

const HOST_APPROVED_STATUSES = new Set(['approved', 'active']);

export function resolveDashboardUserRole(
  userRole?: string | null,
  hostStatus?: string | null,
  hasAdminAccess = false
): DashboardUserRole {
  const normalizedUserRole = userRole?.trim().toLowerCase() || null;
  if (normalizedUserRole === 'admin' || hasAdminAccess) return 'admin';

  const normalizedHostStatus = hostStatus?.trim().toLowerCase() || null;
  if (
    normalizedUserRole === 'host' ||
    (normalizedHostStatus && HOST_APPROVED_STATUSES.has(normalizedHostStatus))
  ) {
    return 'host';
  }

  return 'guest';
}
