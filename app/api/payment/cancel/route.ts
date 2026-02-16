import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer'; // 🟢 추가됨

// 환불률 계산기 (기존 동일)
function calculateRefundRate(tourDateStr: string, tourTimeStr: string, paymentDateStr: string) {
  const now = new Date();
  const tourDate = new Date(`${tourDateStr}T${tourTimeStr}:00`);
  const paymentDate = new Date(paymentDateStr);
  
  const diffTime = tourDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const hoursSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60);

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
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1. 예약 조회
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, experiences(host_id, title)') // 🟢 experiences 정보 추가 조회
      .eq('id', bookingId)
      .single();

    if (error || !booking) return NextResponse.json({ error: '예약 없음' }, { status: 404 });
    if (booking.status === 'cancelled') return NextResponse.json({ error: '이미 취소됨' }, { status: 400 });

    // 2. 환불액 및 정산액 계산
    let refundRate = 0;
    let reasonText = '';

    if (isHostCancel) {
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

    // 💰 [정산 로직] 위약금 분배
    let hostPayout = 0;
    let platformRevenue = 0;

    if (penaltyAmount > 0) {
      const hostPrincipal = Math.floor(penaltyAmount / 1.1); 
      const commission = Math.floor(hostPrincipal * 0.2); 
      
      hostPayout = hostPrincipal - commission; 
      platformRevenue = penaltyAmount - hostPayout; 
    }

    // 3. PG사 취소 요청
    if (refundAmount > 0 && booking.tid) {
        const isPartial = refundAmount < totalAmount ? '1' : '0';
        const formBody = new URLSearchParams({
            TID: booking.tid,
            MID: process.env.NICEPAY_MID || 'nicepay00m', // 🟢 환경변수 확인 필요
            Moid: booking.order_id,
            CancelAmt: refundAmount.toString(),
            CancelMsg: userReason || reasonText,
            PartialCancelCode: isPartial, 
        });

        await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody.toString()
        });
    }

    // 4. DB 업데이트
    await supabase.from('bookings').update({ 
      status: 'cancelled',
      cancel_reason: `${userReason} (${reasonText})`,
      refund_amount: refundAmount,          
      host_payout_amount: hostPayout,       
      platform_revenue: platformRevenue     
    }).eq('id', bookingId);

    // 🟢 5. [추가됨] 알림 및 이메일 발송 로직
    const hostId = booking.experiences?.host_id;
    const expTitle = booking.experiences?.title;

    if (hostId) {
      // (A) 알림 저장
      await supabase.from('notifications').insert({
        user_id: hostId,
        type: 'cancellation',
        title: '😢 예약이 취소되었습니다.',
        message: `[${expTitle}] 예약이 취소되었습니다. 환불액: ₩${refundAmount.toLocaleString()}`,
        link: '/host/dashboard',
        is_read: false
      });

      // (B) 이메일 발송
      console.log('⏳ [DEBUG] 취소 알림 메일 발송 준비...');
      let hostEmail = '';
      const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
      
      if (hostProfile?.email) {
        hostEmail = hostProfile.email;
      } else {
         const { data: authData } = await supabase.auth.admin.getUserById(hostId);
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
          console.log(`🚀 [DEBUG] 취소 메일 발송 성공!`);
        } catch (mailError) {
          console.error('🔥 [DEBUG] 메일 발송 실패:', mailError);
        }
      }
    }

    return NextResponse.json({ success: true, refundAmount, hostPayout });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}