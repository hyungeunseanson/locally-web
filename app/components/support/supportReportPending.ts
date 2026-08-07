export const SUPPORT_REPORT_PENDING_STORAGE_KEY = 'locally_support_report_pending';
export const SUPPORT_REPORT_PENDING_TTL_MS = 15 * 60_000;

type SupportReportPendingPayload = {
  requestedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function markSupportReportPending(storage: StorageLike, now = Date.now()) {
  const payload: SupportReportPendingPayload = { requestedAt: now };
  storage.setItem(SUPPORT_REPORT_PENDING_STORAGE_KEY, JSON.stringify(payload));
}

export function clearSupportReportPending(storage: StorageLike) {
  storage.removeItem(SUPPORT_REPORT_PENDING_STORAGE_KEY);
}

function readValidPendingPayload(storage: StorageLike, now: number) {
  const raw = storage.getItem(SUPPORT_REPORT_PENDING_STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as Partial<SupportReportPendingPayload>;
    const requestedAt = Number(parsed.requestedAt);
    const age = now - requestedAt;
    return Number.isFinite(requestedAt) && age >= 0 && age <= SUPPORT_REPORT_PENDING_TTL_MS;
  } catch {
    return false;
  }
}

export function clearExpiredSupportReportPending(storage: StorageLike, now = Date.now()) {
  if (!readValidPendingPayload(storage, now)) {
    clearSupportReportPending(storage);
  }
}

export function consumeSupportReportPending(storage: StorageLike, now = Date.now()) {
  const isValid = readValidPendingPayload(storage, now);
  clearSupportReportPending(storage);
  return isValid;
}
