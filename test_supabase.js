require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  try {
    const res = await supabase.from('users_not_exist').select('role').maybeSingle();
    console.log('Result:', res);
  } catch (e) {
    console.error('Crash:', e);
  }
})();
