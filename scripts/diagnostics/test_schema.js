require('./loadEnv.cjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
    console.log("Checking profiles table...");
    const { data: pData, error: pErr } = await supabase.from('profiles').select('*').limit(1);
    console.log("Profiles sample:", pData ? Object.keys(pData[0] || {}) : pErr);

    console.log("Checking if search_logs table exists...");
    const { data: sData, error: sErr } = await supabase.from('search_logs').select('*').limit(1);
    console.log("search_logs sample:", sData ? Object.keys(sData[0] || {}) : sErr?.message);

    console.log("Checking users / UTM routes (if tracked)");
    const { data: routeData, error: rErr } = await supabase.from('profiles').select('source').limit(1);
    console.log("Profile source exist?", routeData ? "Yes" : rErr?.message);
})();
