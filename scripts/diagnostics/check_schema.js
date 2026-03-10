require('./loadEnv.cjs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: bData } = await supabase.from('bookings').select('*').limit(3);
  console.log("Bookings sample: ", JSON.stringify(bData, null, 2));

  const { data: iData } = await supabase.from('inquiry_messages').select('*').limit(3);
  console.log("Inquiry_messages sample: ", JSON.stringify(iData, null, 2));
}
check();
