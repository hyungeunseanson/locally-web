-- =============================================================================
-- Migration: Add source attribution fields to analytics events and search logs
-- =============================================================================

ALTER TABLE public.search_logs
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS referrer text,
ADD COLUMN IF NOT EXISTS referrer_host text,
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS landing_path text;

ALTER TABLE public.analytics_events
ADD COLUMN IF NOT EXISTS referrer text,
ADD COLUMN IF NOT EXISTS referrer_host text,
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS landing_path text;
