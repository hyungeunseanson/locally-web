import {
  resolveRecipientLocale,
  type NotificationLocale,
} from '@/app/utils/notificationLocale';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type LayoutCopy = {
  helpPrompt: string;
  helpLinkLabel: string;
};

export type BookingConfirmationTemplateCopy = {
  subject: string;
  previewText: string;
  greetingPrefix: string;
  greetingSuffix: string;
  introText: string;
  guestNameLabel: string;
  guestCountLabel: string;
  guestCountSuffix: string;
  totalAmountLabel: string;
  bookingDateLabel: string;
  helperText: string;
  ctaLabel: string;
  fallbackHostName: string;
  fallbackGuestName: string;
  fallbackExperienceTitle: string;
  fallbackBookingDate: string;
  layout: LayoutCopy;
};

export type BookingCancellationTemplateCopy = {
  subject: string;
  previewText: string;
  greetingPrefix: string;
  greetingSuffix: string;
  introPrefix: string;
  introSuffix: string;
  cancelReasonLabel: string;
  refundAmountLabel: string;
  helperText: string;
  ctaLabel: string;
  fallbackHostName: string;
  fallbackExperienceTitle: string;
  fallbackCancelReason: string;
  layout: LayoutCopy;
};

type LocalizedTemplateCopyInput = {
  supabaseAdmin: AdminClient;
  userId: string;
  experienceTitle?: string;
};

function buildLayoutCopy(locale: NotificationLocale): LayoutCopy {
  switch (locale) {
    case 'en':
      return {
        helpPrompt: 'Need anything else?',
        helpLinkLabel: 'Visit the help center ->',
      };
    case 'ja':
      return {
        helpPrompt: 'ご不明な点はありますか？',
        helpLinkLabel: 'ヘルプセンターを見る ->',
      };
    case 'zh':
      return {
        helpPrompt: '还有其他问题吗？',
        helpLinkLabel: '访问帮助中心 ->',
      };
    case 'ko':
    default:
      return {
        helpPrompt: '궁금하신 점이 있으신가요?',
        helpLinkLabel: '도움 센터 방문하기 ->',
      };
  }
}

export function buildBookingConfirmationTemplateEmailCopy(
  locale: NotificationLocale,
  params: { experienceTitle?: string }
): BookingConfirmationTemplateCopy {
  switch (locale) {
    case 'en':
      {
        const fallbackExperienceTitle = 'Locally experience';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 🎉 Booking confirmed. Please message the guest',
        previewText: `A guest is waiting for your message 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: 'Hi, ',
        greetingSuffix: '! 👋',
        introText: 'A new booking is confirmed. Please send the guest a quick hello and preparation details now.',
        guestNameLabel: 'Guest name',
        guestCountLabel: 'Guests',
        guestCountSuffix: '',
        totalAmountLabel: 'Experience booking amount',
        bookingDateLabel: 'Booking date',
        helperText:
          'A fast first message helps the guest feel confident before the experience.',
        ctaLabel: 'View booking and message the guest',
        fallbackHostName: 'Locally host',
        fallbackGuestName: 'Guest',
        fallbackExperienceTitle,
        fallbackBookingDate: 'Schedule TBD',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'ja':
      {
        const fallbackExperienceTitle = 'Locally体験';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 🎉 予約確定。ゲストにメッセージを送ってください',
        previewText: `ゲストがメッセージを待っています 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: 'こんにちは、',
        greetingSuffix: 'さん 👋',
        introText: '予約が確定しました。今すぐゲストへ挨拶と準備案内を送ってください。',
        guestNameLabel: 'ゲスト名',
        guestCountLabel: '参加人数',
        guestCountSuffix: '名',
        totalAmountLabel: '体験予約金額',
        bookingDateLabel: '予約日程',
        helperText:
          '最初のメッセージが早いほど、ゲストは安心して体験を待つことができます。',
        ctaLabel: '予約を確認してメッセージを送る',
        fallbackHostName: 'Locallyホスト',
        fallbackGuestName: 'ゲスト',
        fallbackExperienceTitle,
        fallbackBookingDate: '日程未定',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'zh':
      {
        const fallbackExperienceTitle = 'Locally 体验';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 🎉 预订已确认，请给客人发消息',
        previewText: `客人正在等待你的消息 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: '你好，',
        greetingSuffix: ' 👋',
        introText: '新的预订已确认。请现在向客人发送问候和准备说明。',
        guestNameLabel: '客人姓名',
        guestCountLabel: '参与人数',
        guestCountSuffix: '人',
        totalAmountLabel: '体验预订金额',
        bookingDateLabel: '预订日期',
        helperText:
          '越早发送第一条消息，客人在体验前就越安心。',
        ctaLabel: '查看预订并发送消息',
        fallbackHostName: 'Locally 房东',
        fallbackGuestName: '客人',
        fallbackExperienceTitle,
        fallbackBookingDate: '日期待定',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'ko':
    default:
      {
        const fallbackExperienceTitle = '로컬라이프 체험';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 🎉 예약 확정. 게스트에게 메시지를 보내주세요',
        previewText: `게스트가 호스트님의 메시지를 기다리고 있어요 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: '안녕하세요, ',
        greetingSuffix: '님 👋',
        introText: '예약이 확정되었습니다. 지금 게스트에게 인사와 준비 안내를 보내주세요.',
        guestNameLabel: '게스트명',
        guestCountLabel: '참여 인원',
        guestCountSuffix: '명',
        totalAmountLabel: '체험 예약 금액',
        bookingDateLabel: '예약 일자',
        helperText:
          '첫 메시지가 빠를수록 게스트가 체험 전 더 안심할 수 있어요.',
        ctaLabel: '예약 확인하고 메시지 보내기',
        fallbackHostName: '로컬리 호스트',
        fallbackGuestName: '게스트',
        fallbackExperienceTitle,
        fallbackBookingDate: '일정 미정',
        layout: buildLayoutCopy(locale),
      };
      }
  }
}

export function buildBookingCancellationTemplateEmailCopy(
  locale: NotificationLocale,
  params: { experienceTitle?: string }
): BookingCancellationTemplateCopy {
  switch (locale) {
    case 'en':
      {
        const fallbackExperienceTitle = 'Locally experience';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] Booking cancellation notice',
        previewText: `Booking cancelled - ${resolvedExperienceTitle}`,
        greetingPrefix: 'Hi, ',
        greetingSuffix: '.',
        introPrefix: 'We have some unfortunate news.',
        introSuffix: 'booking was cancelled.',
        cancelReasonLabel: 'Cancellation reason',
        refundAmountLabel: 'Guest refund',
        helperText:
          'You can reopen the schedule in the dashboard later. We hope an even better guest finds you next time.',
        ctaLabel: 'Open dashboard',
        fallbackHostName: 'Locally host',
        fallbackExperienceTitle,
        fallbackCancelReason: 'No reason provided',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'ja':
      {
        const fallbackExperienceTitle = 'Locally体験';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 予約キャンセルのお知らせ',
        previewText: `予約キャンセルのお知らせ - ${resolvedExperienceTitle}`,
        greetingPrefix: 'こんにちは、',
        greetingSuffix: 'さん。',
        introPrefix: '残念なお知らせです。',
        introSuffix: 'の予約はキャンセルされました。',
        cancelReasonLabel: 'キャンセル理由',
        refundAmountLabel: 'ゲスト返金額',
        helperText:
          'ダッシュボードで日程を再び開放できます。次はもっと良いご縁につながることを願っています。',
        ctaLabel: 'ダッシュボードを見る',
        fallbackHostName: 'Locallyホスト',
        fallbackExperienceTitle,
        fallbackCancelReason: '理由なし',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'zh':
      {
        const fallbackExperienceTitle = 'Locally 体验';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 预订取消通知',
        previewText: `预订取消通知 - ${resolvedExperienceTitle}`,
        greetingPrefix: '你好，',
        greetingSuffix: '。',
        introPrefix: '很遗憾通知你，',
        introSuffix: '这笔预订已被取消。',
        cancelReasonLabel: '取消原因',
        refundAmountLabel: '客人退款金额',
        helperText:
          '你之后仍可在后台重新开放日程。希望下一次能迎来更好的缘分。',
        ctaLabel: '查看后台',
        fallbackHostName: 'Locally 房东',
        fallbackExperienceTitle,
        fallbackCancelReason: '无原因',
        layout: buildLayoutCopy(locale),
      };
      }
    case 'ko':
    default:
      {
        const fallbackExperienceTitle = '로컬라이프 체험';
        const resolvedExperienceTitle = params.experienceTitle || fallbackExperienceTitle;
      return {
        subject: '[Locally] 예약 취소 알림',
        previewText: `예약 취소 안내 — ${resolvedExperienceTitle}`,
        greetingPrefix: '안녕하세요, ',
        greetingSuffix: '님.',
        introPrefix: '아쉬운 소식을 전해드려요.',
        introSuffix: '체험 예약이 취소되었어요.',
        cancelReasonLabel: '취소 사유',
        refundAmountLabel: '게스트 환불액',
        helperText:
          '일정은 대시보드에서 다시 열어두실 수 있어요. 다음 기회에 더 좋은 인연이 이어지길 바라요. 언제나 응원할게요 💙',
        ctaLabel: '대시보드 확인하기',
        fallbackHostName: '로컬리 호스트',
        fallbackExperienceTitle,
        fallbackCancelReason: '사유 없음',
        layout: buildLayoutCopy(locale),
      };
      }
  }
}

export async function buildLocalizedBookingConfirmationTemplateEmailCopy(
  params: LocalizedTemplateCopyInput
): Promise<BookingConfirmationTemplateCopy> {
  const locale = await resolveRecipientLocale(params.supabaseAdmin, params.userId);
  return buildBookingConfirmationTemplateEmailCopy(locale, {
    experienceTitle: params.experienceTitle,
  });
}

export async function buildLocalizedBookingCancellationTemplateEmailCopy(
  params: LocalizedTemplateCopyInput
): Promise<BookingCancellationTemplateCopy> {
  const locale = await resolveRecipientLocale(params.supabaseAdmin, params.userId);
  return buildBookingCancellationTemplateEmailCopy(locale, {
    experienceTitle: params.experienceTitle,
  });
}
