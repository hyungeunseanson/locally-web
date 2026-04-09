export type SettlementSyncRawRow = Record<string, unknown>;

export function isSettlementSyncRawRow(value: unknown): value is SettlementSyncRawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toSettlementSyncRawRow(value: unknown): SettlementSyncRawRow | null {
  return isSettlementSyncRawRow(value) ? value : null;
}

export function toSettlementSyncRawRows(value: unknown): SettlementSyncRawRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSettlementSyncRawRow);
}

export function readSettlementSyncString(
  row: SettlementSyncRawRow,
  key: string
): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

export function readSettlementSyncTrimmedString(
  row: SettlementSyncRawRow,
  key: string
): string | null {
  const value = readSettlementSyncString(row, key)?.trim();
  return value ? value : null;
}

export function readSettlementSyncNestedRow(
  row: SettlementSyncRawRow,
  key: string
): SettlementSyncRawRow | null {
  return toSettlementSyncRawRow(row[key]);
}

export function readSettlementSyncNestedRowOrFirst(
  row: SettlementSyncRawRow,
  key: string
): SettlementSyncRawRow | null {
  const value = row[key];

  if (Array.isArray(value)) {
    return value.length > 0 ? toSettlementSyncRawRow(value[0]) : null;
  }

  return toSettlementSyncRawRow(value);
}
