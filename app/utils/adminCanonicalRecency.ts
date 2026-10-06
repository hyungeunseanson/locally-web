/** PostgreSQL timestamps retain microseconds; Date.parse alone loses tie precision. */
export function activityMicros(value?: string | null): bigint {
  if (!value) return BigInt(0);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return BigInt(0);
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d\d(?::?\d\d)?)$/)?.[1] ?? '';
  return BigInt(millis) * BigInt(1000) + BigInt(fraction.padEnd(6, '0').slice(3, 6));
}

export function newerCanonicalActivity(current: string | null | undefined, incoming: string): string {
  return activityMicros(current) > activityMicros(incoming) ? current! : incoming;
}

export function compareCanonicalInquiries(a: {
  id: string | number; canonical_activity_at?: string | null; created_at?: string | null;
}, b: { id: string | number; canonical_activity_at?: string | null; created_at?: string | null }) {
  const aTime = activityMicros(a.canonical_activity_at ?? a.created_at);
  const bTime = activityMicros(b.canonical_activity_at ?? b.created_at);
  if (aTime !== bTime) return aTime > bTime ? -1 : 1;
  const aId = BigInt(a.id), bId = BigInt(b.id);
  return aId === bId ? 0 : aId > bId ? -1 : 1;
}
