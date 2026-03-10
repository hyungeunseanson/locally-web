import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

const run = async () => {
    const { data, error } = await supabase.from('experiences').select('*, profiles!experiences_host_id_fkey(full_name, email)').limit(1);
    console.log("With !fkey => ", data ? Object.keys(data[0]) : null, data?.[0]?.profiles);
};
run();
