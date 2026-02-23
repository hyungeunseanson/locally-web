const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mock.com', 'mock_key');
try {
  supabase.from('test').select('*').eq('email', undefined);
  console.log('Success');
} catch (e) {
  console.log('Error thrown:', e.message);
}
