-- Analytics 테이블 성능 인덱스
-- analytics-search-intent / analytics-summary API 쿼리 최적화용
-- 적용: Supabase SQL Editor 또는 psql에서 실행

-- analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);

-- search_logs
CREATE INDEX IF NOT EXISTS idx_search_logs_session_id ON public.search_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON public.search_logs(user_id);
