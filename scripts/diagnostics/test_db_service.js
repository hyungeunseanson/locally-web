const { createClient } = require('@supabase/supabase-js');
require('./loadEnv.cjs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
    const { data, error } = await supabase.from('bookings').select('status, id, amount');
    if (error) {
        console.error('DB Error:', error);
    } else {
        const statuses = new Set(data.map(b => b.status));
        console.log('Unique statuses in DB:', Array.from(statuses));
        console.log('Total bookings:', data.length);
    }
})();
