require('./loadEnv.cjs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: qData } = await supabase.from('inquiries').select('*').limit(3);
    console.log("Inquiries sample: ", JSON.stringify(qData, null, 2));
}
check();
