import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { resolveRecipientLocale, type NotificationLocale } from '@/app/utils/notificationLocale';
import nodemailer from 'nodemailer';

const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

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
  copy_key?: 'review_reply' | 'cancellation_approved';
  copy_params?: Record<string, unknown>;
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

function sanitizeNotificationTitle(rawValue: unknown) {
  if (typeof rawValue !== 'string') return '';

  return rawValue
    .replace(/\r\n?/g, ' ')
    .replace(/\n/g, ' ')
    .replace(CONTROL_CHAR_PATTERN, '')
    .trim();
}

function sanitizeNotificationMessage(rawValue: unknown) {
  if (typeof rawValue !== 'string') return '';

  return rawValue
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL_CHAR_PATTERN, '')
    .trim();
}

function sanitizeNotificationLink(rawValue: unknown) {
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, 'https://locally.local');
    if (parsed.origin !== 'https://locally.local' || !parsed.pathname.startsWith('/')) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNotificationEmailHref(link: string | null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || '';
  if (!siteUrl || !link) return null;
  return `${siteUrl}${link}`;
}

function buildNotificationEmailHtml(message: string, link: string | null) {
  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br/>');
  const href = getNotificationEmailHref(link);
  const cta = href
    ? `<br/><a href="${escapeHtml(href)}">확인하기</a>`
    : '';

  return `<p>${escapedMessage}</p>${cta}`;
}

function buildReviewReplyNotificationCopy(locale: NotificationLocale, replyPreview: string) {
  switch (locale) {
    case 'en':
      return {
        title: 'The host replied to your review',
        message: `There is a new reply to your review: "${replyPreview}"`,
      };
    case 'ja':
      return {
        title: 'ホストがレビューに返信しました',
        message: `レビューに新しい返信が届きました: 「${replyPreview}」`,
      };
    case 'zh':
      return {
        title: '房东回复了你的评价',
        message: `你的评价收到了新回复：「${replyPreview}」`,
      };
    case 'ko':
    default:
      return {
        title: '호스트님이 후기에 답글을 남겼습니다',
        message: `후기에 답글이 달렸습니다: "${replyPreview}"`,
      };
  }
}

function buildCancellationApprovedNotificationCopy(
  locale: NotificationLocale,
  experienceTitle?: string | null
) {
  const normalizedTitle = typeof experienceTitle === 'string' ? experienceTitle.trim() : '';

  switch (locale) {
    case 'en':
      return normalizedTitle
        ? {
            title: 'Your cancellation and refund have been approved',
            message: `The cancellation and refund for "${normalizedTitle}" have been approved.`,
          }
        : {
            title: 'Your cancellation and refund have been approved',
            message: 'Your cancellation and refund have been approved.',
          };
    case 'ja':
      return normalizedTitle
        ? {
            title: 'キャンセルと返金が承認されました',
            message: `「${normalizedTitle}」のキャンセルと返金が承認されました。`,
          }
        : {
            title: 'キャンセルと返金が承認されました',
            message: 'キャンセルと返金が承認されました。',
          };
    case 'zh':
      return normalizedTitle
        ? {
            title: '您的取消和退款已获批准',
            message: `“${normalizedTitle}”的取消和退款已获批准。`,
          }
        : {
            title: '您的取消和退款已获批准',
            message: '您的取消和退款已获批准。',
          };
    case 'ko':
    default:
      return normalizedTitle
        ? {
            title: '취소 및 환불이 승인되었습니다',
            message: `"${normalizedTitle}" 취소 및 환불이 승인되었습니다.`,
          }
        : {
            title: '취소 및 환불이 승인되었습니다',
            message: '취소 및 환불이 승인되었습니다.',
          };
  }
}

function resolveLocalizedSingleRecipientCopy(params: {
  locale: NotificationLocale;
  type?: string;
  copyKey?: NotificationRequestBody['copy_key'];
  copyParams?: NotificationRequestBody['copy_params'];
}) {
  const { locale, type, copyKey, copyParams } = params;

  if (
    type === 'review_reply' &&
    copyKey === 'review_reply' &&
    copyParams &&
    typeof copyParams.replyPreview === 'string'
  ) {
    return buildReviewReplyNotificationCopy(locale, copyParams.replyPreview);
  }

  if (type === 'cancellation_approved' && copyKey === 'cancellation_approved') {
    return buildCancellationApprovedNotificationCopy(
      locale,
      typeof copyParams?.experienceTitle === 'string' ? copyParams.experienceTitle : null
    );
  }

  return null;
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
    // [CRITICAL Fix] 기존 recipientId === actorId는 자기 자신에게만 발송 가능한 잘못된 로직:
    // - 정상 케이스(게스트→호스트)를 항상 403으로 차단
    // - 자기 자신에게 발송하는 것만 허용 (보안 의미 없음)
    // → booking 행 기반으로 actor=게스트, recipient=호스트임을 검증
    if (!bookingId) return false;

    const { data: bookingData } = await supabaseAdmin
      .from('bookings')
      .select('user_id, experiences(host_id)')
      .eq('id', bookingId)
      .maybeSingle();

    const booking = bookingData as BookingOwnershipRow | null;
    const hostId = getRelatedHostId(booking?.experiences);

    return Boolean(booking && booking.user_id === actorId && hostId === recipientId);
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
    const { recipient_id, recipient_ids, title, message, link, type, booking_id, review_id, copy_key, copy_params } = body;
    const safeTitle = sanitizeNotificationTitle(title);
    const safeMessage = sanitizeNotificationMessage(message);
    const safeLink = sanitizeNotificationLink(link);
    const hasExplicitLink = typeof link === 'string' && link.trim().length > 0;
    const safeMassLink = hasExplicitLink ? safeLink : '/notifications';

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
        type: type || 'general',
        title: safeTitle,
        message: safeMessage,
        link: safeMassLink,
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
            subject: `[Locally] ${safeTitle}`,
            html: buildNotificationEmailHtml(safeMessage, safeMassLink),
          }).catch(e => console.error(`❌ 이메일 발송 실패 (${email}):`, e))
        ));
        console.log(`📨 [API] 이메일 ${emails.length}건 발송 시도 완료`);
      }

      return NextResponse.json({ success: true, count: recipient_ids.length });
    }
    // [Fix] 400 guard를 DB insert 전으로 이동 — insert 후 실패 시 이메일 발송 계속되는 문제 방지
    if (!recipient_id) {
      return NextResponse.json({ error: 'recipient_id is required' }, { status: 400 });
    }

    // 2. DB 알림 테이블에 저장
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

    let finalTitle = safeTitle;
    let finalMessage = safeMessage;

    const localizedCopy = resolveLocalizedSingleRecipientCopy({
      locale: await resolveRecipientLocale(supabase, recipient_id),
      type,
      copyKey: copy_key,
      copyParams: copy_params,
    });

    if (localizedCopy) {
      finalTitle = sanitizeNotificationTitle(localizedCopy.title);
      finalMessage = sanitizeNotificationMessage(localizedCopy.message);
    }

    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: recipient_id,
        type: type || 'general',
        title: finalTitle,
        message: finalMessage,
        link: safeLink,
        is_read: false
      });

    if (dbError) {
      console.error('🔥 [Notification API] DB 저장 실패:', dbError);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }
    console.log('✅ [Notification API] DB 저장 성공 (알림창 노출)');

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
          subject: `[Locally] ${finalTitle}`,
          html: buildNotificationEmailHtml(finalMessage, safeLink),
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
