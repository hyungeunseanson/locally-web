import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { toZonedTime } from 'date-fns-tz';

const TAX_RATE = 1.1;
const COMMISSION_RATE = 0.2;
const TIMEZONE = 'Asia/Seoul';

// 환불률 계산기 (Timezone Fixed)
function calculateRefundRate(tourDateStr: string, tourTimeStr: string, paymentDateStr: string) {
  const now = toZonedTime(new Date(), TIMEZONE);
  const tourDate = new Date(`${tourDateStr}T${tourTimeStr}:00`); // Assume local time matches server/kst logic or stick to string calc if simple
  // Better: Parse tourDate as KST if it's stored as local string
  const tourDateKST = toZonedTime(new Date(`${tourDateStr}T${tourTimeStr}:00`), TIMEZONE);
  const paymentDate = new Date(paymentDateStr); // UTC usually from DB
  const paymentDateKST = toZonedTime(paymentDate, TIMEZONE);

  const diffTime = tourDateKST.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const hoursSincePayment = (now.getTime() - paymentDateKST.getTime()) / (1000 * 60 * 60);

  if (hoursSincePayment <= 24 && diffDays > 1) return { rate: 100, reason: '24시간 이내 철회' };
  if (diffDays <= 0) return { rate: 0, reason: '당일/지난 일정' };
  if (diffDays === 1) return { rate: 40, reason: '1일 전 취소' };
  if (diffDays >= 2 && diffDays <= 7) return { rate: 70, reason: '2~7일 전 취소' };
  if (diffDays >= 8 && diffDays <= 19) return { rate: 80, reason: '8~19일 전 취소' };
  return { rate: 100, reason: '20일 전 취소' };
}

export async function POST(request: Request) {
  try {
    const { bookingId, reason: userReason, isHostCancel } = await request.json();

    // [C-3] Auth Check
    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 예약 조회
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*, experiences(host_id, title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !booking) return NextResponse.json({ error: '예약 없음' }, { status: 404 });

    // [보안 패치] 관리자인지 확인 (관리자는 모든 예약 취소 가능)
    const [userProfile, whitelistEntry] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle()
    ]);
    const isAdmin = (userProfile.data?.role === 'admin') || !!whitelistEntry.data;

    // [C-3] Ownership Verification
    if (!isAdmin && booking.user_id !== user.id && booking.experiences?.host_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status === 'cancelled') return NextResponse.json({ error: '이미 취소됨' }, { status: 400 });

    // 2. 환불액 및 정산액 계산
    let refundRate = 0;
    let reasonText = '';

    if (isHostCancel) {
      // Ensure it is actually the host canceling
      if (booking.experiences?.host_id !== user.id) {
        return NextResponse.json({ error: 'Only host can perform host cancellation' }, { status: 403 });
      }
      refundRate = 100;
      reasonText = '호스트 사유 취소';
    } else {
      const calc = calculateRefundRate(booking.date, booking.time || '00:00', booking.created_at);
      refundRate = calc.rate;
      reasonText = calc.reason;
    }

    const totalAmount = booking.amount;
    const refundAmount = Math.floor(totalAmount * (refundRate / 100));
    const penaltyAmount = totalAmount - refundAmount;

    // 💰 [정산 로직] 위약금 분배 (개선됨)
    let hostPayout = 0;
    let platformRevenue = 0;

    if (penaltyAmount > 0) {
      // 위약금이 발생했다면, 해당 위약금(penaltyAmount)에서 플랫폼이 20%를 가져가고
      // 나머지(80%)를 호스트수익(hostPayout)으로 명확히 배분.
      hostPayout = Math.floor(penaltyAmount * 0.8);
      platformRevenue = penaltyAmount - hostPayout;
    }

    // 3. PG사 취소 요청
    if (refundAmount > 0 && booking.tid) {
      const MID = process.env.NICEPAY_MID;
      if (!MID) throw new Error('Server Config Error: NICEPAY_MID missing');

      const isPartial = refundAmount < totalAmount ? '1' : '0';
      const formBody = new URLSearchParams({
        TID: booking.tid,
        MID: MID,
        Moid: booking.order_id,
        CancelAmt: refundAmount.toString(),
        CancelMsg: userReason || reasonText,
        PartialCancelCode: isPartial,
      });

      // [H-2] Verify Response (강화된 PG 응답 검열)
      const pgResponse = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });

      if (!pgResponse.ok) {
        throw new Error(`PG Network Timeout: ${pgResponse.status} ${pgResponse.statusText}`);
      }

      const pgResult = await pgResponse.text();
      let pgJson;
      try {
        pgJson = JSON.parse(pgResult.replace(/'/g, '"'));
      } catch (parseError) {
        throw new Error(`PG Format Error: Failed to parse PG response: ${pgResult}`);
      }

      // 🚨 [핵심 보안] PG사에서 승인 취소가 떨어지지 않으면, DB 업데이트 로직으로 절대 못 넘어가게 원천 차단
      if (pgJson.ResultCode !== '2001' && pgJson.ResultCode !== '2211') {
        console.error('🔥 [CRITICAL] PG Cancel Failed (DB Callback Blocked):', pgJson);
        throw new Error(`PG Cancel Failed: [${pgJson.ResultCode}] ${pgJson.ResultMsg}`);
      }

      console.log(`✅ [INFO] PG Cancel Success (Amount: ${refundAmount}) -> Proceeding to DB Update`);
    }

    // 4. DB 업데이트
    await supabaseAdmin.from('bookings').update({
      status: 'cancelled',
      cancel_reason: `${userReason} (${reasonText})`,
      refund_amount: refundAmount,
      host_payout_amount: hostPayout,
      platform_revenue: platformRevenue
    }).eq('id', bookingId);

    // 🟢 5. 알림 및 이메일 발송 로직
    const hostId = booking.experiences?.host_id;
    const expTitle = booking.experiences?.title;

    if (hostId) {
      // (A) 알림 저장
      await supabaseAdmin.from('notifications').insert({
        user_id: hostId,
        type: 'cancellation',
        title: '😢 예약이 취소되었습니다.',
        message: `[${expTitle}] 예약이 취소되었습니다. 환불액: ₩${refundAmount.toLocaleString()}`,
        link: '/host/dashboard',
        is_read: false
      });

      // (B) 이메일 발송
      let hostEmail = '';
      const { data: hostProfile } = await supabaseAdmin.from('profiles').select('email').eq('id', hostId).maybeSingle();

      if (hostProfile?.email) {
        hostEmail = hostProfile.email;
      } else {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(hostId);
        if (authData?.user?.email) hostEmail = authData.user.email;
      }

      if (hostEmail) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });

          await transporter.sendMail({
            from: `"Locally Team" <${process.env.GMAIL_USER}>`,
            to: hostEmail,
            subject: `[Locally] 예약 취소 알림`,
            html: `
              <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #000;">예약 취소 알림 😢</h2>
                <p><b>[${expTitle}]</b> 예약이 취소되었습니다.</p>
                <p>사유: ${userReason}</p>
                <p>환불 금액: ₩${refundAmount.toLocaleString()}</p>
                <br/>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: #f0f0f0; color: #333; padding: 10px 20px; text-decoration: none; border-radius: 5px;">대시보드 확인</a>
              </div>
            `,
          });
        } catch (mailError) {
          console.error('Email sending failed but ignored:', mailError);
        }
      }
    }

    return NextResponse.json({ success: true, refundAmount, hostPayout });

  } catch (error: any) {
    console.error('Cancel Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}