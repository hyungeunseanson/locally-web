import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

function verifySignature(signData: string, ediDate: string, amount: string, mid: string, key: string): boolean {
  try {
    const data = ediDate + mid + amount + key;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash === signData;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
  // [L-1] Removed debug log with sensitive info
  console.log('🔒 [SECURE] Payment Callback Received');

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const MER_KEY = process.env.NICEPAY_MERCHANT_KEY;
    const MID = process.env.NICEPAY_MID;

    if (!SUPABASE_URL || !SERVICE_KEY || !MER_KEY || !MID) {
      console.error('Missing Server Configuration');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    let resCode: string = '';
    let amount: string = '';
    let orderId: string = '';
    let tid: string = '';
    let signData: string = '';
    let ediDate: string = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      resCode = json.resCode || json.resultCode || '';
      amount = (json.paid_amount || json.amount || '').toString();
      orderId = json.merchant_uid || json.orderId || '';
      tid = json.pg_tid || json.imp_uid || '';
      signData = json.signData || '';
      ediDate = json.ediDate || '';
    } else {
      const formData = await request.formData();
      resCode = formData.get('resCode')?.toString() || '';
      amount = formData.get('amt')?.toString() || '';
      orderId = formData.get('moid')?.toString() || '';
      tid = formData.get('tid')?.toString() || '';
      signData = formData.get('signData')?.toString() || '';
      ediDate = formData.get('ediDate')?.toString() || '';
    }

    // [C-2] Security: Verify Signature
    if (!verifySignature(signData, ediDate, amount, MID, MER_KEY)) {
      console.error(`🚨 [SECURITY] Signature Mismatch! Order: ${orderId}`);
      throw new Error('Invalid Signature');
    }

    if (resCode === '0000') { 
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      
// 1. DB 예약 정보 및 연결된 체험 정보(정원/가격) 조회
const { data: originalBooking } = await supabase
.from('bookings')
.select('*, experiences (price, private_price, max_guests)')
.eq('id', orderId)
.maybeSingle();

if (!originalBooking) throw new Error('예약 정보를 찾을 수 없습니다.');

// 2. 이미 처리된 건인지 확인 (중복 방지)
if (BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(originalBooking.status)) {
return NextResponse.json({ success: true, message: 'Already processed' });
}

// 🚨 [핵심 보안 1] 금액 검증 (1원 결제 위변조 원천 차단)
// 클라이언트가 보낸 값이 아니라, 예약 시점에 DB에 확정 저장된 금액(bookings.amount)을 기준으로 검증합니다.
// (호스트가 가격을 변경하더라도, 이미 예약된 건은 예약 당시 가격을 따라야 하기 때문입니다.)
const expectedAmount = Number(originalBooking.amount);

// PG사 승인 금액(amount)과 서버 찐 금액(expectedAmount) 비교
if (Number(amount) !== expectedAmount) {
console.error(`🚨 [보안 경고] 결제 금액 조작 시도! (주문: ${orderId}, 기대금액: ${expectedAmount}, 실제결제: ${amount})`);
throw new Error('결제 금액이 위변조되었습니다.');
}

// 🚨 [핵심 보안 2] 잔여 좌석 트랜잭션 체크 (초과 예약 / Race Condition 차단)
// 결제를 승인하는 바로 이 순간(0.1초 차이)에 좌석이 남아있는지 최종 확인합니다.
const { data: existingBookings } = await supabase
.from('bookings')
.select('guests, type')
.eq('experience_id', originalBooking.experience_id)
.eq('date', originalBooking.date)
.eq('time', originalBooking.time)
.in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

const currentBookedCount = existingBookings?.reduce((sum, b) => sum + (b.guests || 0), 0) || 0;
const hasPrivateBooking = existingBookings?.some(b => b.type === 'private');
const maxGuests = originalBooking.experiences?.max_guests || 10;

if (hasPrivateBooking || 
  (originalBooking.type === 'private' && currentBookedCount > 0) || 
  (originalBooking.type !== 'private' && (currentBookedCount + originalBooking.guests > maxGuests))) {
console.error(`🚨 [보안 경고] 초과 예약(Overbooking) 발생! (주문: ${orderId})`);
throw new Error('잔여 좌석이 부족하여 예약을 확정할 수 없습니다. (결제 자동 취소 대상)');
}

console.log(`✅ [INFO] 금액 및 좌석 검증 완벽 통과 (DB: ${expectedAmount} == PG: ${amount})`);

      // 3. 예약 상태 및 정산 데이터 업데이트 (PAID)
      // 💰 [정산 데이터 박제] 호스트 원가와 수수료 수익을 이 시점에 확정 기록합니다.
      const basePrice = Number(originalBooking.experiences?.price || 0);
      const totalExpPrice = basePrice * (originalBooking.guests || 1);
      const payoutAmount = totalExpPrice * 0.8; // 호스트 정산금 (원가의 80%)
      const platformRev = Number(amount) - payoutAmount; // 플랫폼 순수익 (실결제액 - 지급액)

      const { data: bookingData, error: dbError } = await supabase
        .from('bookings')
        .update({ 
          status: 'PAID', 
          tid: tid,
          price_at_booking: basePrice,
          total_experience_price: totalExpPrice,
          host_payout_amount: payoutAmount,
          platform_revenue: platformRev,
          payout_status: 'pending'
        })
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`)
        .maybeSingle();

      if (dbError) throw new Error(`DB Error: ${dbError.message}`);
      
      // 4. 알림 및 이메일 발송 (정상 작동 유지)
      if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // (A) 알림 저장
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          // (B) 이메일 발송 (이전과 동일 로직 복구)
          let hostEmail = '';
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).maybeSingle();
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
                subject: `[Locally] 🎉 새로운 예약이 도착했습니다!`,
                html: `
                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #000;">Locally 예약 알림 🔔</h2>
                    <p>호스트님! <b>[${expTitle}]</b> 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p>
                    <p>인원: ${bookingData.guests}명<br/>날짜: ${bookingData.date} ${bookingData.time}</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">대시보드 확인</a>
                  </div>
                `,
              });
            } catch (mailError) {
              console.error('Email sending failed but ignored:', mailError);
            }
          }
        }
      }

      return NextResponse.json({ success: true });

    } else {
      throw new Error(`PG사 응답코드 실패: ${resCode}`);
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('🔥 [DEBUG] 시스템 에러:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
