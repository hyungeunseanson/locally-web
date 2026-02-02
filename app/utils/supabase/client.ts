// app/utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // 키가 없을 때 앱이 죽지 않도록 방어
    return createBrowserClient('https://missing.com', 'missing');
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}