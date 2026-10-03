// Decimal strings preserve bigint identity across JSON and the rendered snapshot.
export const PHONE_SNAPSHOT_LIMIT = 10_000;
export type PhoneRenderedSnapshot = { inquiryId: string | null; messageIds: string[]; ready: boolean };
export type PhoneReplySnapshot = { proxyRequestId: string; seenCustomerMessageIds: string[] };
export function validPhoneId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807');
}
export function validPhoneRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validPhoneSnapshot(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= PHONE_SNAPSHOT_LIMIT
    && value.every(validPhoneId) && new Set(value).size === value.length;
}

export function renderedPhoneMessageId(value: unknown): string | null {
  // PostgREST may return bigint IDs as JSON numbers. Never acknowledge a rounded ID.
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const id = typeof value === 'number' ? String(value) : value;
  return validPhoneId(id) ? id : null;
}
