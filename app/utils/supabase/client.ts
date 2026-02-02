// app/utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 🚨 안전 장치: 키가 없어도 앱이 죽지 않게 가짜 클라이언트 반환
  if (!supabaseUrl || !supabaseKey) {
    if (typeof window !== 'undefined') {
      console.error("⚠️ Supabase 환경 변수가 없습니다. (안전 모드 실행)");
    }
    return createBrowserClient('https://missing.com', 'missing');
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}