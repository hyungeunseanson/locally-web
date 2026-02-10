import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { recipient_id, title, message, link, type, inquiry_id } = body; // 🟢 inquiry_id 추가됨

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    // 🟢 [핵심] 채팅 메시지일 경우, 10분 쿨타임 체크
    if (type === 'new_message' && inquiry_id) {
      const { data: inquiry } = await supabase
        .from('inquiries')
        .select('last_email_sent_at')
        .eq('id', inquiry_id)
        .single();

      if (inquiry?.last_email_sent_at) {
        const lastSent = new Date(inquiry.last_email_sent_at).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - lastSent) / (1000 * 60);

        // 10분 미만이면 발송 스킵 (로그만 남기고 종료)
        if (diffMinutes < 10) {
          console.log(`⏳ Skipped email for inquiry ${inquiry_id} (Last sent: ${Math.round(diffMinutes)}m ago)`);
          return NextResponse.json({ skipped: true, reason: 'Throttled' });
        }
      }

      // 발송 통과 -> 시간 업데이트
      await supabase
        .from('inquiries')
        .update({ last_email_sent_at: new Date().toISOString() })
        .eq('id', inquiry_id);
    }

    // 2. 수신자 이메일 조회
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipient_id)
      .single();

    if (userError || !userProfile?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    // 3. 실제 이메일 발송 (콘솔 시뮬레이션)
    console.log(`
      📧 [Email Sent]
      To: ${userProfile.email}
      Subject: ${title}
      Body: ${message}
      Type: ${type}
    `);

    return NextResponse.json({ success: true, email: userProfile.email });

  } catch (error) {
    console.error('❌ Email API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}