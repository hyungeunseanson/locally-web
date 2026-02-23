
-- 1. Create search_logs table
CREATE TABLE IF NOT EXISTS public.search_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    keyword TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    route TEXT DEFAULT 'main',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create analytics_events table (for Funnel: view, click, payment_init)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT,
    event_type TEXT NOT NULL, -- 'view', 'click', 'payment_init'
    target_id TEXT, -- experience_id or other target
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: RLS policies
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for everyone" ON public.search_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read for admin" ON public.search_logs FOR SELECT USING (true); -- In a real app, restrict to admin role.

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for everyone" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read for admin" ON public.analytics_events FOR SELECT USING (true);
  