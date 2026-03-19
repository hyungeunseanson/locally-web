import type { SupabaseClient } from '@supabase/supabase-js';

export type AnalyticsTrackingMetadataInput = {
  session_id?: unknown;
  referrer?: unknown;
  referrer_host?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  landing_path?: unknown;
};

export type AnalyticsTrackingMetadataRow = {
  session_id: string | null;
  referrer: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

type AnalyticsEventInsertRow = AnalyticsTrackingMetadataRow & {
  event_type: string;
  target_id: string | null;
  user_id: string | null;
};

type SearchLogInsertRow = AnalyticsTrackingMetadataRow & {
  keyword: string;
  route: string;
  user_id: string | null;
};

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}

export function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function extractAnalyticsTrackingMetadata(
  input: AnalyticsTrackingMetadataInput
): AnalyticsTrackingMetadataRow {
  return {
    session_id: normalizeOptionalText(input.session_id, 200),
    referrer: normalizeOptionalText(input.referrer, 2000),
    referrer_host: normalizeOptionalText(input.referrer_host, 255),
    utm_source: normalizeOptionalText(input.utm_source, 255),
    utm_medium: normalizeOptionalText(input.utm_medium, 255),
    utm_campaign: normalizeOptionalText(input.utm_campaign, 255),
    landing_path: normalizeOptionalText(input.landing_path, 1000),
  };
}

export function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String((error as { code?: string }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';

  return code === '42703' && message.includes(columnName);
}

export async function insertAnalyticsEvent(
  supabaseAdmin: SupabaseClient,
  row: AnalyticsEventInsertRow
) {
  const { error } = await supabaseAdmin.from('analytics_events').insert(row);

  if (
    error
    && (
      isMissingColumnError(error, 'analytics_events.referrer')
      || isMissingColumnError(error, 'analytics_events.referrer_host')
      || isMissingColumnError(error, 'analytics_events.utm_source')
      || isMissingColumnError(error, 'analytics_events.utm_medium')
      || isMissingColumnError(error, 'analytics_events.utm_campaign')
      || isMissingColumnError(error, 'analytics_events.landing_path')
    )
  ) {
    const { error: fallbackError } = await supabaseAdmin.from('analytics_events').insert({
      session_id: row.session_id,
      event_type: row.event_type,
      target_id: row.target_id,
      user_id: row.user_id,
    });

    if (fallbackError) throw fallbackError;
    return;
  }

  if (error) throw error;
}

export async function insertSearchLog(
  supabaseAdmin: SupabaseClient,
  row: SearchLogInsertRow
) {
  const { error } = await supabaseAdmin.from('search_logs').insert(row);

  if (
    error
    && (
      isMissingColumnError(error, 'search_logs.session_id')
      || isMissingColumnError(error, 'search_logs.referrer')
      || isMissingColumnError(error, 'search_logs.referrer_host')
      || isMissingColumnError(error, 'search_logs.utm_source')
      || isMissingColumnError(error, 'search_logs.utm_medium')
      || isMissingColumnError(error, 'search_logs.utm_campaign')
      || isMissingColumnError(error, 'search_logs.landing_path')
    )
  ) {
    const { error: fallbackError } = await supabaseAdmin.from('search_logs').insert({
      keyword: row.keyword,
      route: row.route,
      user_id: row.user_id,
    });

    if (fallbackError) throw fallbackError;
    return;
  }

  if (error) throw error;
}
