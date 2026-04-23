import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let publicServerClient: SupabaseClient | null = null;

export function createPublicServerClient() {
  if (publicServerClient) {
    return publicServerClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[Supabase] 환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 누락되었습니다.');
  }

  publicServerClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return publicServerClient;
}
