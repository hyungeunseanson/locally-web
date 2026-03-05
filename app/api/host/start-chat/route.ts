import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestId, expId } = await req.json();

    if (!guestId || !expId) {
      return NextResponse.json({ error: 'Missing guestId or expId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 현재 유저가 해당 체험의 호스트인지 검증
    const { data: exp } = await supabaseAdmin
      .from('experiences')
      .select('host_id')
      .eq('id', String(expId))
      .maybeSingle();

    if (!exp || String(exp.host_id) !== String(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 기존 문의 조회 (게스트+호스트+체험 기준)
    const { data: existing } = await supabaseAdmin
      .from('inquiries')
      .select('id')
      .eq('user_id', guestId)
      .eq('host_id', user.id)
      .eq('experience_id', String(expId))
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ inquiryId: existing.id });
    }

    // 문의 없음 → service role로 생성 (RLS 우회: user_id = 게스트 ID)
    const { data: newInquiry, error: insertError } = await supabaseAdmin
      .from('inquiries')
      .insert([{
        user_id: guestId,
        host_id: user.id,
        experience_id: String(expId),
        content: '',
        type: 'general',
      }])
      .select()
      .maybeSingle();

    if (insertError || !newInquiry) {
      console.error('[start-chat] insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
    }

    return NextResponse.json({ inquiryId: newInquiry.id });
  } catch (err) {
    console.error('[start-chat] unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
