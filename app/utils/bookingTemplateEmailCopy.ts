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
        subject: '[Locally] 🎉 A new booking has arrived!',
        previewText: `A new guest is waiting for you 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: 'Hi, ',
        greetingSuffix: '! 👋',
        introText: 'A new guest booked this experience. It looks like a special moment is about to begin 🎉',
        guestNameLabel: 'Guest name',
        guestCountLabel: 'Guests',
        guestCountSuffix: '',
        totalAmountLabel: 'Total paid',
        bookingDateLabel: 'Booking date',
        helperText:
          'Your guest is already looking forward to it. Send a quick hello in chat and start getting ready for the experience.',
        ctaLabel: 'View booking details',
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
        subject: '[Locally] 🎉 新しい予約が届きました！',
        previewText: `新しいゲストが待っています 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: 'こんにちは、',
        greetingSuffix: 'さん 👋',
        introText: 'この体験に新しいゲストの予約が入りました。いよいよ特別な時間が始まります 🎉',
        guestNameLabel: 'ゲスト名',
        guestCountLabel: '参加人数',
        guestCountSuffix: '名',
        totalAmountLabel: '決済金額合計',
        bookingDateLabel: '予約日程',
        helperText:
          'ゲストはすでに楽しみにしています。チャットで先にあいさつを送り、体験の準備を始めてください。',
        ctaLabel: '予約詳細を見る',
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
        subject: '[Locally] 🎉 你收到了新的预订！',
        previewText: `有新客人正在等你 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: '你好，',
        greetingSuffix: ' 👋',
        introText: '这场体验迎来了新的客人，一段特别的同行时光即将开始 🎉',
        guestNameLabel: '客人姓名',
        guestCountLabel: '参与人数',
        guestCountSuffix: '人',
        totalAmountLabel: '支付总额',
        bookingDateLabel: '预订日期',
        helperText:
          '客人已经满怀期待。先通过聊天打个招呼，然后开始准备这次体验吧。',
        ctaLabel: '查看预订详情',
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
        subject: '[Locally] 🎉 새로운 예약이 도착했습니다!',
        previewText: `새 게스트가 찾아왔어요 🎉 ${resolvedExperienceTitle}`,
        greetingPrefix: '안녕하세요, ',
        greetingSuffix: '님 👋',
        introText: '체험에 새 게스트가 찾아왔어요! 함께하는 시간이 정말 특별해질 거예요 🎉',
        guestNameLabel: '게스트명',
        guestCountLabel: '참여 인원',
        guestCountSuffix: '명',
        totalAmountLabel: '총 결제 금액',
        bookingDateLabel: '예약 일자',
        helperText:
          '게스트가 설레는 마음으로 기다리고 있어요. 채팅으로 먼저 인사를 건네보시고, 멋진 체험 준비해주세요 🙌',
        ctaLabel: '예약 상세 확인하기',
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
