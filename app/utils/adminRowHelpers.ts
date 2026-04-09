export type AdminRawRow = Record<string, unknown>;

export function isAdminRawRow(value: unknown): value is AdminRawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toAdminRawRows(value: unknown): AdminRawRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAdminRawRow);
}

export function readStringField(row: AdminRawRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

export function readNumberField(row: AdminRawRow, key: string): number | null {
  const value = row[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readNestedRow(row: AdminRawRow, key: string): AdminRawRow | null {
  const value = row[key];
  return isAdminRawRow(value) ? value : null;
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}
