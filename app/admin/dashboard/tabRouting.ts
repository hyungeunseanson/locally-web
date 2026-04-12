export function normalizeAdminDashboardTab(tab: string | null | undefined): string | null {
  const normalized = tab?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  // Legacy admin payout screen now lives under the official SALES tab.
  if (normalized === 'SETTLEMENT') {
    return 'SALES';
  }

  return normalized;
}

