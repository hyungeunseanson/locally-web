const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { rootDir } = require('./loadEnv.cjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Running DDL queries via SQL function or direct REST if available (usually requires psql or supabase CLI).');
    // Since we don't have direct SQL exec via JS client without a custom RPC,
    // we will instruct the developer or run a script using curl / psql if accessible.
    // Let's create an RPC function first, but we can't create an RPC without SQL access...

    console.log('We will generate a .sql file for the migrations.');
    const sql = `
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
  `;

    const outputPath = path.join(rootDir, 'supabase_analytics_migration.sql');
    fs.writeFileSync(outputPath, sql);
    console.log(`Wrote ${outputPath}`);
}

run();
