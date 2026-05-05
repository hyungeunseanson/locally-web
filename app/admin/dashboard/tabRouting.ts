export function normalizeAdminDashboardTab(tab: string | null | undefined): string | null {
  const normalized = tab?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  // Legacy/admin payout query aliases now live under the official SALES tab.
  if (normalized === 'SETTLEMENT' || normalized === 'PAYOUTS') {
    return 'SALES';
  }

  return normalized;
}
