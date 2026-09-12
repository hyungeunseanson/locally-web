import { NextResponse } from 'next/server';

import { fetchLocallyMembershipSummary } from '@/app/utils/memberStatus';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function GET() {
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const membership = await fetchLocallyMembershipSummary(createAdminClient(), user.id);
    return NextResponse.json({ success: true, membership });
  } catch (error) {
    console.error('[account membership] failed to resolve membership:', error);
    return NextResponse.json({ success: false, error: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
