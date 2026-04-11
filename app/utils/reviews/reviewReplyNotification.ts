import { sendTemplatedEmail } from '@/app/emails/delivery/sendTemplatedEmail';
import type { EmailPayloadMap } from '@/app/emails/registry/emailTypes';
import { resolveRecipientLocale, type NotificationLocale } from '@/app/utils/notificationLocale';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

type HostOwnershipRow = {
  host_id: string | null;
};

type ReviewOwnershipRow = {
  user_id: string | null;
  experiences: HostOwnershipRow | HostOwnershipRow[] | null;
};

type ReviewReplyCopy = {
  title: string;
  message: string;
  ctaLabel: string;
};

const REVIEW_REPLY_PREVIEW_LIMIT = 40;

function getRelatedHostId(relation: HostOwnershipRow | HostOwnershipRow[] | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0]?.host_id ?? null;
  }

  return relation?.host_id ?? null;
}

function truncateReplyPreview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= REVIEW_REPLY_PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, REVIEW_REPLY_PREVIEW_LIMIT)}...`;
}

function resolveReplyPreview(params: {
  replyPreview?: string | null;
  replyText?: string | null;
}) {
  const explicitPreview = typeof params.replyPreview === 'string' ? params.replyPreview.trim() : '';
  if (explicitPreview) return explicitPreview;
  return truncateReplyPreview(params.replyText || '');
}

function normalizeInternalLink(value: string | null | undefined) {
  if (!value || !value.startsWith('/')) return '/guest/trips';
  return value;
}

export function buildReviewReplyNotificationCopy(
  locale: NotificationLocale,
  replyPreview: string
): ReviewReplyCopy {
  switch (locale) {
    case 'en':
      return {
        title: 'The host replied to your review',
        message: `There is a new reply to your review: "${replyPreview}"`,
        ctaLabel: 'Check review',
      };
    case 'ja':
      return {
        title: 'ホストがレビューに返信しました',
        message: `レビューに新しい返信が届きました: 「${replyPreview}」`,
        ctaLabel: 'レビューを確認',
      };
    case 'zh':
      return {
        title: '房东回复了你的评价',
        message: `你的评价收到了新回复：「${replyPreview}」`,
        ctaLabel: '查看评价',
      };
    case 'ko':
    default:
      return {
        title: '호스트님이 후기에 답글을 남겼습니다',
        message: `후기에 답글이 달렸습니다: "${replyPreview}"`,
        ctaLabel: '후기 확인하기',
      };
  }
}

export function buildReviewReplyTemplatePayload(params: {
  replyPreview: string;
  ctaUrl: string;
}): EmailPayloadMap['notice.copy'] {
  return {
    copyKey: 'review.reply.guest',
    copyParams: {
      replyPreview: params.replyPreview,
    },
    ctaUrl: params.ctaUrl,
  };
}

export async function deliverReviewReplyNotification(params: {
  actorId: string;
  recipientId: string;
  reviewId: number | string;
  replyText?: string | null;
  replyPreview?: string | null;
  link?: string | null;
  supabaseAdmin?: AdminSupabaseClient;
}) {
  const supabaseAdmin = params.supabaseAdmin ?? createAdminClient();
  const normalizedReviewId = Number(params.reviewId);
  const preview = resolveReplyPreview({
    replyPreview: params.replyPreview,
    replyText: params.replyText,
  });

  if (!Number.isFinite(normalizedReviewId) || normalizedReviewId <= 0 || !preview) {
    return { allowed: false as const };
  }

  const { data: reviewData, error: reviewError } = await supabaseAdmin
    .from('reviews')
    .select('user_id, experiences!inner(host_id)')
    .eq('id', normalizedReviewId)
    .maybeSingle();

  if (reviewError) {
    throw reviewError;
  }

  const review = reviewData as ReviewOwnershipRow | null;
  const hostId = getRelatedHostId(review?.experiences);

  if (!review || hostId !== params.actorId || review.user_id !== params.recipientId) {
    return { allowed: false as const };
  }

  const locale = await resolveRecipientLocale(supabaseAdmin, params.recipientId);
  const copy = buildReviewReplyNotificationCopy(locale, preview);
  const link = normalizeInternalLink(params.link);

  const { error: notificationError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: params.recipientId,
      type: 'review_reply',
      title: copy.title,
      message: copy.message,
      link,
      is_read: false,
    });

  if (notificationError) {
    throw notificationError;
  }

  try {
    const result = await sendTemplatedEmail({
      templateId: 'notice.copy',
      audience: 'guest',
      recipient: {
        userId: params.recipientId,
      },
      payload: buildReviewReplyTemplatePayload({
        replyPreview: preview,
        ctaUrl: link,
      }),
    }, {
      supabaseAdmin,
    });

    if (result.sent) {
      console.log('[review reply] localized email sent');
    } else {
      console.warn(`[review reply] localized email skipped: ${result.skipped || 'unknown'}`);
    }
  } catch (emailError) {
    console.warn('[review reply] localized email failed (notification saved):', emailError);
  }

  return {
    allowed: true as const,
    title: copy.title,
    message: copy.message,
    link,
    replyPreview: preview,
  };
}
