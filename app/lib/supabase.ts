import { createClient } from '@supabase/supabase-js';

// .env.local에 저장한 키를 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase 클라이언트 생성 (이걸로 DB랑 대화합니다)
export const supabase = createClient(supabaseUrl, supabaseKey);