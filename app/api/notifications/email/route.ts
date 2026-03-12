import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import nodemailer from 'nodemailer';

type NotificationRequestBody = {
  recipient_id?: string;
  recipient_ids?: string[];
  title?: string;
  message?: string;
  link?: string;
  type?: string;
  inquiry_id?: number;
  booking_id?: string | number;
  review_id?: string | number;
};

type HostOwnershipRow = {
  host_id: string | null;
};

type ReviewOwnershipRow = {
  user_id: string;
  experiences: HostOwnershipRow | HostOwnershipRow[] | null;
};

type BookingOwnershipRow = {
  user_id: string;
  experiences: HostOwnershipRow | HostOwnershipRow[] | null;
};

type ProfileEmailRow = {
  email: string | null;
};

function getRelatedHostId(relation: HostOwnershipRow | HostOwnershipRow[] | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0]?.host_id ?? null;
  }

  return relation?.host_id ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function canSendSingleRecipientNotification(params: {
  actorId: string;
  recipientId: string;
  type?: string;
  bookingId?: string | number;
  reviewId?: string | number;
}) {
  const { actorId, recipientId, type, bookingId, reviewId } = params;
  const supabaseAdmin = createAdminClient();

  if (!type) return false;

  if (type === 'new_booking' || type === 'booking_cancel_request') {
    return recipientId === actorId;
  }

  if (type === 'review_reply') {
    if (!reviewId) return false;

    const { data: reviewData } = await supabaseAdmin
      .from('reviews')
      .select('user_id, experiences!inner(host_id)')
      .eq('id', reviewId)
      .maybeSingle();

    const review = reviewData as ReviewOwnershipRow | null;
    const hostId = getRelatedHostId(review?.experiences);

    return Boolean(review && hostId === actorId && review.user_id === recipientId);
  }

  if (type === 'cancellation_approved') {
    if (!bookingId) return false;

    const { data: bookingData } = await supabaseAdmin
      .from('bookings')
      .select('user_id, experiences(host_id)')
      .eq('id', bookingId)
      .maybeSingle();

    const booking = bookingData as BookingOwnershipRow | null;
    const hostId = getRelatedHostId(booking?.experiences);

    return Boolean(booking && hostId === actorId && booking.user_id === recipientId);
  }

  return false;
}

export async function POST(request: Request) {
  try {
    console.log('📨 [Notification API] 알림 요청 수신');

    // 🚨 [보안 패치] 누구나 호출하는 것을 방지 (Auth Check)
    const supabaseAuth = await createServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.warn('🚨 Unauthorized access attempt to email API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 관리자 권한 접속 (DB Insert용)
    const supabase = createAdminClient();

    const body = await request.json() as NotificationRequestBody;
    // 🟢 [수정] recipient_ids(배열) 추가로 받기
    const { recipient_id, recipient_ids, title, message, link, type, booking_id, review_id } = body;

    // 🚨 [보안 패치] 다중 발송은 관리자(Admin)만 가능하도록 제한
    if (recipient_ids && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      const { isAdmin } = await resolveAdminAccess(supabase, {
        userId: user.id,
        email: user.email,
      });
      if (!isAdmin) {
        console.error(`🚨 [Security Warning] Unauthorized Mass Email Attempt by ${user.email}`);
        return NextResponse.json({ error: 'Forbidden: Admin Access Required for mass email' }, { status: 403 });
      }

      console.log(`🚀 [API] 다중 발송 시작: ${recipient_ids.length}명`);

      // 1. DB 일괄 저장
      const notificationsData = recipient_ids.map((id: string) => ({
        user_id: id,
        type: type || 'admin_alert',
        title: title,
        message: message,
        link: link || '/notifications',
        is_read: false
      }));

      const { error: dbError } = await supabase.from('notifications').insert(notificationsData);

      if (dbError) console.error('🔥 [API] DB 일괄 저장 실패:', dbError);
      else console.log('✅ [API] DB 일괄 저장 성공');

      // 2. 이메일 대상 조회 (한 번에 조회)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', recipient_ids);

      const emails = (profiles as ProfileEmailRow[] | null)?.flatMap((profile) =>
        profile.email ? [profile.email] : []
      ) || [];

      // 3. 이메일 발송 (병렬 처리)
      if (emails.length > 0) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        // 서버 부하 방지를 위해 Promise.all 사용 (비동기 병렬 발송)
        await Promise.all(emails.map((email: string) =>
          transporter.sendMail({
            from: `"Locally Team" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `[Locally] ${title}`,
            html: `<p>${message}</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>`,
          }).catch(e => console.error(`❌ 이메일 발송 실패 (${email}):`, e))
        ));
        console.log(`📨 [API] 이메일 ${emails.length}건 발송 시도 완료`);
      }

      return NextResponse.json({ success: true, count: recipient_ids.length });
    }
    // 🟢 [추가됨] 2. DB 알림 테이블에 저장 (이게 없어서 알림창에 안 떴던 것!)
    if (recipient_id) {
      const canSend = await canSendSingleRecipientNotification({
        actorId: user.id,
        recipientId: recipient_id,
        type,
        bookingId: booking_id,
        reviewId: review_id,
      });

      if (!canSend) {
        console.error(`🚨 [Security Warning] Unauthorized single notification attempt by ${user.email} (${type || 'unknown'})`);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id: recipient_id, // 받는 사람
          type: type || 'general',
          title: title,
          message: message, // 내용
          link: link,
          is_read: false
        });

      if (dbError) {
        console.error('🔥 [Notification API] DB 저장 실패:', dbError);
      } else {
        console.log('✅ [Notification API] DB 저장 성공 (알림창 노출)');
      }
    }

    if (!recipient_id) {
      return NextResponse.json({ error: 'recipient_id is required' }, { status: 400 });
    }

    // 3. 수신자 이메일 찾기 (기존 로직)
    let emailToSend = '';
    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', recipient_id).maybeSingle();
    if (userProfile?.email) emailToSend = userProfile.email;
    else {
      const { data: authData } = await supabase.auth.admin.getUserById(recipient_id);
      if (authData?.user?.email) emailToSend = authData.user.email;
    }

    if (!emailToSend) {
      console.error('❌ [Notification API] 이메일 없음');
      // DB 저장은 성공했을 수 있으므로 에러 대신 성공 처리하되 로그만 남김 (선택 사항)
      // return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // 4. 메일 발송 — 실패해도 인앱 알림(DB)은 이미 저장됐으므로 성공 응답
    if (emailToSend) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        await transporter.sendMail({
          from: `"Locally Team" <${process.env.GMAIL_USER}>`,
          to: emailToSend,
          subject: `[Locally] ${title}`,
          html: `<p>${message}</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>`,
        });
        console.log('🚀 [Notification API] 이메일 발송 성공');
      } catch (emailError: unknown) {
        // 이메일 실패는 인앱 알림 성공과 무관 — 경고 로그만 남기고 계속 진행
        console.warn('⚠️ [Notification API] 이메일 발송 실패 (인앱 알림은 저장됨):', getErrorMessage(emailError));
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('🔥 [Notification API] 시스템 에러:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
