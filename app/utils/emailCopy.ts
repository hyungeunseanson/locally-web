import { createAdminClient } from '@/app/utils/supabase/admin';
import { isOfficialSupportSenderDisplayName } from '@/app/utils/officialSender';
import {
  resolveRecipientLocale,
  type NotificationLocale,
} from '@/app/utils/notificationLocale';

type AdminClient = ReturnType<typeof createAdminClient>;

type ReviewNewHostParams = {
  experienceTitle: string;
};

type ReviewGuestRequestHostParams = {
  experienceTitle: string;
};

type ReviewGuestReceivedGuestParams = {
  experienceTitle: string;
};

type ReviewReplyGuestParams = {
  replyPreview: string;
};

type MembershipParams = {
  status: 'member' | 'circle';
};

type HostApplicationStatusParams = {
  comment?: string;
};

type ExperienceStatusParams = {
  experienceTitle: string;
  comment?: string;
};

type ServiceRequestNewHostParams = {
  requestTitle: string;
  requestCity: string;
  durationHours: number;
  guestCount: number;
};

type ServicePaymentConfirmedCustomerParams = {
  requestTitle: string;
};

type ServiceApplicationNewCustomerParams = {
  requestTitle: string;
};

type ServiceHostSelectedParams = {
  requestTitle: string;
};

type ServiceCancellationParams = {
  requestTitle: string;
  refundAmount?: number | null;
};

type ReviewType = 'host_unavailable' | 'minimum_participants_unmet';

type BookingConfirmedGuestParams = {
  experienceTitle: string;
};

type BookingCancellationApprovedGuestParams = {
  experienceTitle?: string | null;
};

type BookingBankConfirmedHostParams = {
  experienceTitle: string;
  guestName?: string;
};

type BookingBankConfirmedGuestParams = {
  experienceTitle: string;
};

type BookingCancelledHostParams = {
  experienceTitle: string;
  reason?: string | null;
  refundAmount: number;
};

type BookingCancelledGuestParams = {
  experienceTitle: string;
  refundAmount: number;
};

type BookingCancelledAdminForceGuestParams = {
  experienceTitle: string;
  refundAmount: number;
};

type BookingCancelledHostFaultGuestParams = {
  experienceTitle: string;
  refundAmount: number;
  reviewType: ReviewType;
};

type ProxyPaymentParams = {
  requestTitle: string;
};

type ProxyCommentReplyParams = {
  content: string;
};

type InquiryNewMessageParams = {
  actorDisplayName: string;
  displayContent: string;
};

export type EmailCopy = {
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
};

export type EmailCopyKey =
  | 'review.new.host'
  | 'review.reply.guest'
  | 'review.guest_request.host'
  | 'review.guest_received.guest'
  | 'membership.member_welcome'
  | 'membership.circle_welcome'
  | 'host_application.approved'
  | 'host_application.revision'
  | 'host_application.rejected'
  | 'experience.approved'
  | 'experience.revision'
  | 'booking.confirmed.guest'
  | 'booking.cancellation_approved.guest'
  | 'booking.bank_pending.guest'
  | 'booking.bank_confirmed.host'
  | 'booking.bank_confirmed.guest'
  | 'booking.cancelled.host'
  | 'booking.cancelled.guest'
  | 'booking.cancelled.admin_force.guest'
  | 'booking.cancelled.host_fault.guest'
  | 'service.request_new.host'
  | 'service.payment_confirmed.customer'
  | 'service.application_new.customer'
  | 'service.host_selected'
  | 'service.cancel_requested'
  | 'service.cancelled'
  | 'proxy.payment_confirmed'
  | 'proxy.payment_cancelled'
  | 'proxy.payment_refunded'
  | 'proxy.comment_reply'
  | 'inquiry.new_message';

type EmailCopyParams = {
  'review.new.host': ReviewNewHostParams;
  'review.reply.guest': ReviewReplyGuestParams;
  'review.guest_request.host': ReviewGuestRequestHostParams;
  'review.guest_received.guest': ReviewGuestReceivedGuestParams;
  'membership.member_welcome': MembershipParams;
  'membership.circle_welcome': MembershipParams;
  'host_application.approved': HostApplicationStatusParams;
  'host_application.revision': HostApplicationStatusParams;
  'host_application.rejected': HostApplicationStatusParams;
  'experience.approved': ExperienceStatusParams;
  'experience.revision': ExperienceStatusParams;
  'booking.confirmed.guest': BookingConfirmedGuestParams;
  'booking.cancellation_approved.guest': BookingCancellationApprovedGuestParams;
  'booking.bank_pending.guest': BookingBankConfirmedGuestParams;
  'booking.bank_confirmed.host': BookingBankConfirmedHostParams;
  'booking.bank_confirmed.guest': BookingBankConfirmedGuestParams;
  'booking.cancelled.host': BookingCancelledHostParams;
  'booking.cancelled.guest': BookingCancelledGuestParams;
  'booking.cancelled.admin_force.guest': BookingCancelledAdminForceGuestParams;
  'booking.cancelled.host_fault.guest': BookingCancelledHostFaultGuestParams;
  'service.request_new.host': ServiceRequestNewHostParams;
  'service.payment_confirmed.customer': ServicePaymentConfirmedCustomerParams;
  'service.application_new.customer': ServiceApplicationNewCustomerParams;
  'service.host_selected': ServiceHostSelectedParams;
  'service.cancel_requested': ServiceCancellationParams;
  'service.cancelled': ServiceCancellationParams;
  'proxy.payment_confirmed': ProxyPaymentParams;
  'proxy.payment_cancelled': ProxyPaymentParams;
  'proxy.payment_refunded': ProxyPaymentParams;
  'proxy.comment_reply': ProxyCommentReplyParams;
  'inquiry.new_message': InquiryNewMessageParams;
};

type LocalizedEmailCopyInput<K extends EmailCopyKey> = {
  supabaseAdmin: AdminClient;
  userId: string;
  key: K;
  copyParams: EmailCopyParams[K];
};

function buildReviewNewHostEmailCopy(
  locale: NotificationLocale,
  params: ReviewNewHostParams
): EmailCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] A new review was posted',
        title: 'A new review was posted',
        message: `A new review was posted for '${experienceTitle}'.`,
        ctaLabel: 'View review',
      };
    case 'ja':
      return {
        subject: '[Locally] 新しいレビューが投稿されました',
        title: '新しいレビューが投稿されました',
        message: `「${experienceTitle}」に新しいレビューが投稿されました。`,
        ctaLabel: 'レビューを見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 你收到了一条新评价',
        title: '你收到了一条新评价',
        message: `「${experienceTitle}」收到了新的评价。`,
        ctaLabel: '查看评价',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 새 후기가 등록되었습니다',
        title: '새 후기가 등록되었습니다',
        message: `'${experienceTitle}'에 새 후기가 작성되었습니다.`,
        ctaLabel: '후기 확인하기',
      };
  }
}

function buildReviewReplyGuestEmailCopy(
  locale: NotificationLocale,
  params: ReviewReplyGuestParams
): EmailCopy {
  const { replyPreview } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] The host replied to your review',
        title: 'The host replied to your review',
        message: `There is a new reply to your review: "${replyPreview}"`,
        ctaLabel: 'Check review',
      };
    case 'ja':
      return {
        subject: '[Locally] ホストがレビューに返信しました',
        title: 'ホストがレビューに返信しました',
        message: `レビューに新しい返信が届きました: 「${replyPreview}」`,
        ctaLabel: 'レビューを確認',
      };
    case 'zh':
      return {
        subject: '[Locally] 房东回复了你的评价',
        title: '房东回复了你的评价',
        message: `你的评价收到了新回复：「${replyPreview}」`,
        ctaLabel: '查看评价',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 호스트님이 후기에 답글을 남겼습니다',
        title: '호스트님이 후기에 답글을 남겼습니다',
        message: `후기에 답글이 달렸습니다: "${replyPreview}"`,
        ctaLabel: '후기 확인하기',
      };
  }
}

function buildReviewGuestRequestHostEmailCopy(
  locale: NotificationLocale,
  params: ReviewGuestRequestHostParams
): EmailCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Please review your guest',
        title: 'Please review your guest',
        message: `Please leave a guest review for '${experienceTitle}'.`,
        ctaLabel: 'Write guest review',
      };
    case 'ja':
      return {
        subject: '[Locally] ゲストを評価してください',
        title: 'ゲストを評価してください',
        message: `「${experienceTitle}」のゲスト評価を投稿してください。`,
        ctaLabel: 'ゲストを評価',
      };
    case 'zh':
      return {
        subject: '[Locally] 请评价您的客人',
        title: '请评价您的客人',
        message: `请为“${experienceTitle}”的客人留下评价。`,
        ctaLabel: '评价客人',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 게스트 평가를 남겨주세요',
        title: '게스트 평가를 남겨주세요',
        message: `'${experienceTitle}' 체험의 게스트 평가를 남겨주세요.`,
        ctaLabel: '게스트 평가하기',
      };
  }
}

function buildReviewGuestReceivedGuestEmailCopy(
  locale: NotificationLocale,
  params: ReviewGuestReceivedGuestParams
): EmailCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Your host left you a review',
        title: 'Your host left you a review',
        message: `Your host left you a guest review for '${experienceTitle}'.`,
        ctaLabel: 'View my reviews',
      };
    case 'ja':
      return {
        subject: '[Locally] ホストから評価が届きました',
        title: 'ホストから評価が届きました',
        message: `「${experienceTitle}」のホストからゲスト評価が届きました。`,
        ctaLabel: '評価を確認',
      };
    case 'zh':
      return {
        subject: '[Locally] 您的体验达人留下了评价',
        title: '您的体验达人留下了评价',
        message: `“${experienceTitle}”的体验达人为您留下了评价。`,
        ctaLabel: '查看我的评价',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 호스트가 평가를 남겼습니다',
        title: '호스트가 평가를 남겼습니다',
        message: `'${experienceTitle}' 체험의 호스트가 회원님에 대한 평가를 남겼습니다.`,
        ctaLabel: '받은 평가 확인하기',
      };
  }
}

function buildMembershipEmailCopy(
  locale: NotificationLocale,
  params: MembershipParams
): EmailCopy {
  if (params.status === 'circle') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Welcome to Tier 2',
          title: 'You are now Tier 2',
          message:
            'Thank you for coming back. As a Tier 2 guest, you can now receive closer support and earlier guidance.',
          ctaLabel: 'View my tier',
        };
      case 'ja':
        return {
          subject: '[Locally] Tier 2へようこそ',
          title: 'これで Tier 2です',
          message:
            '再びご利用いただきありがとうございます。Tier 2ゲストとして、より近いサポートと先行案内を受けられます。',
          ctaLabel: 'Tierを見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 欢迎来到 Tier 2',
          title: '你现在已是 Tier 2',
          message:
            '感谢再次回来。作为 Tier 2 用户，你现在可以获得更贴近的支持和更早的通知。',
          ctaLabel: '查看我的 Tier',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] Tier 2에 오신 것을 환영합니다',
          title: '이제 Tier 2입니다',
          message:
            '다시 찾아와 주셔서 감사합니다. 이제 Tier 2 게스트로 더 가까운 케어와 우선 안내를 받을 수 있습니다.',
          ctaLabel: '내 티어 보기',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Tier 1 is now open',
        title: 'You are now Tier 1',
        message:
          'Your first purchase is complete, and your connection with Locally has started. Your travel history will keep building here, and you can turn to Locally Care whenever you need help.',
        ctaLabel: 'View my tier',
      };
    case 'ja':
      return {
        subject: '[Locally] Tier 1が開きました',
        title: 'これで Tier 1です',
        message:
          '最初の購入が完了し、Locallyとのつながりが始まりました。旅行の記録が積み重なり、必要なときは Locally Care へつながれます。',
        ctaLabel: 'Tierを見る',
      };
    case 'zh':
      return {
        subject: '[Locally] Tier 1 已开启',
        title: '你现在已是 Tier 1',
        message:
          '你的首次购买已完成，你与 Locally 的连接已经开始。在这里会持续积累你的旅行记录，必要时也可以连接到 Locally Care。',
        ctaLabel: '查看我的 Tier',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] Tier 1이 열렸습니다',
        title: '이제 Tier 1입니다',
        message:
          '첫 구매가 완료되며 로컬리와의 연결이 시작됐어요. 로컬리 안에서 여행 기록이 쌓이고, 필요할 때 Locally Care로 이어갈 수 있습니다.',
        ctaLabel: '내 티어 보기',
      };
  }
}

function buildHostApplicationStatusEmailCopy(
  locale: NotificationLocale,
  key: 'host_application.approved' | 'host_application.revision' | 'host_application.rejected',
  params: HostApplicationStatusParams
): EmailCopy {
  const trimmedComment = params.comment?.trim();

  if (key === 'host_application.approved') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] 🎉 Your host application is approved',
          title: '🎉 Your host application is approved',
          message: 'Your host application has been approved. You can now use the host dashboard and features.',
          ctaLabel: 'Open host dashboard',
        };
      case 'ja':
        return {
          subject: '[Locally] 🎉 ホスト承認が完了しました',
          title: '🎉 ホスト承認が完了しました',
          message: 'ホスト申請が承認されました。これからホストダッシュボードと各機能をご利用いただけます。',
          ctaLabel: 'ホストダッシュボードを開く',
        };
      case 'zh':
        return {
          subject: '[Locally] 🎉 你的房东申请已通过',
          title: '🎉 你的房东申请已通过',
          message: '你的房东申请已获批准，现在可以使用房东后台和相关功能。',
          ctaLabel: '打开房东后台',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 🎉 호스트 승인이 완료되었습니다',
          title: '🎉 호스트 승인이 완료되었습니다',
          message: '호스트 신청이 승인되었습니다. 이제 호스트 대시보드와 기능을 이용할 수 있습니다.',
          ctaLabel: '호스트 대시보드 열기',
        };
    }
  }

  if (key === 'host_application.revision') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] 🛠️ Your host application needs revision',
          title: '🛠️ Your host application needs revision',
          message: trimmedComment
            ? `Please review the admin comment and update your application.\n\nReason: ${trimmedComment}`
            : 'Please review the admin comment and update your application.',
          ctaLabel: 'Open host dashboard',
        };
      case 'ja':
        return {
          subject: '[Locally] 🛠️ ホスト申請の補完が必要です',
          title: '🛠️ ホスト申請の補完が必要です',
          message: trimmedComment
            ? `管理者コメントを確認し、申請内容を補完してください。\n\n補完理由: ${trimmedComment}`
            : '管理者コメントを確認し、申請内容を補完してください。',
          ctaLabel: 'ホストダッシュボードを開く',
        };
      case 'zh':
        return {
          subject: '[Locally] 🛠️ 你的房东申请需要补充',
          title: '🛠️ 你的房东申请需要补充',
          message: trimmedComment
            ? `请查看管理员备注并补充你的申请内容。\n\n补充原因：${trimmedComment}`
            : '请查看管理员备注并补充你的申请内容。',
          ctaLabel: '打开房东后台',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 🛠️ 호스트 지원서 보완이 필요합니다',
          title: '🛠️ 호스트 지원서 보완이 필요합니다',
          message: trimmedComment
            ? `관리자 코멘트를 확인하고 지원서를 보완해 주세요.\n\n보완 사유: ${trimmedComment}`
            : '관리자 코멘트를 확인하고 지원서를 보완해 주세요.',
          ctaLabel: '호스트 대시보드 열기',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] 📌 Please review your host application result',
        title: '📌 Please review your host application result',
        message: trimmedComment
          ? `This host application was not approved.\n\nReason: ${trimmedComment}`
          : 'This host application was not approved.',
        ctaLabel: 'Open host dashboard',
      };
    case 'ja':
      return {
        subject: '[Locally] 📌 ホスト申請結果をご確認ください',
        title: '📌 ホスト申請結果をご確認ください',
        message: trimmedComment
          ? `今回のホスト申請は承認されませんでした。\n\n理由: ${trimmedComment}`
          : '今回のホスト申請は承認されませんでした。',
        ctaLabel: 'ホストダッシュボードを開く',
      };
    case 'zh':
      return {
        subject: '[Locally] 📌 请查看你的房东申请结果',
        title: '📌 请查看你的房东申请结果',
        message: trimmedComment
          ? `本次房东申请未获批准。\n\n原因：${trimmedComment}`
          : '本次房东申请未获批准。',
        ctaLabel: '打开房东后台',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 📌 호스트 지원 결과를 확인해 주세요',
        title: '📌 호스트 지원 결과를 확인해 주세요',
        message: trimmedComment
          ? `이번 호스트 신청은 승인되지 않았습니다.\n\n사유: ${trimmedComment}`
          : '이번 호스트 신청은 승인되지 않았습니다.',
        ctaLabel: '호스트 대시보드 열기',
      };
  }
}

function buildExperienceStatusEmailCopy(
  locale: NotificationLocale,
  key: 'experience.approved' | 'experience.revision',
  params: ExperienceStatusParams
): EmailCopy {
  const { experienceTitle } = params;
  const trimmedComment = params.comment?.trim();

  if (key === 'experience.approved') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] 🎉 Your experience listing was approved',
          title: '🎉 Your experience listing was approved',
          message: `'${experienceTitle}' was approved. You can now review the details and operating status.`,
          ctaLabel: 'View experience',
        };
      case 'ja':
        return {
          subject: '[Locally] 🎉 体験登録が承認されました',
          title: '🎉 体験登録が承認されました',
          message: `「${experienceTitle}」が承認されました。これから詳細内容と運営状態を確認できます。`,
          ctaLabel: '体験を確認',
        };
      case 'zh':
        return {
          subject: '[Locally] 🎉 体验已通过审核',
          title: '🎉 体验已通过审核',
          message: `「${experienceTitle}」已通过审核，现在可以查看详情和运营状态。`,
          ctaLabel: '查看体验',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 🎉 체험 등록이 승인되었습니다',
          title: '🎉 체험 등록이 승인되었습니다',
          message: `'${experienceTitle}' 체험이 승인되었습니다. 이제 상세 내용과 운영 상태를 확인할 수 있습니다.`,
          ctaLabel: '체험 확인하기',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] 🛠️ Your experience listing needs revision',
        title: '🛠️ Your experience listing needs revision',
        message: trimmedComment
          ? `'${experienceTitle}' needs revision. Please review the admin comment and update it.\n\nReason: ${trimmedComment}`
          : `'${experienceTitle}' needs revision. Please review the admin comment and update it.`,
        ctaLabel: 'Edit experience',
      };
    case 'ja':
      return {
        subject: '[Locally] 🛠️ 体験登録の補完が必要です',
        title: '🛠️ 体験登録の補完が必要です',
        message: trimmedComment
          ? `「${experienceTitle}」に補完が必要です。管理者コメントを確認し、修正してください。\n\n補完理由: ${trimmedComment}`
          : `「${experienceTitle}」に補完が必要です。管理者コメントを確認し、修正してください。`,
        ctaLabel: '体験を修正',
      };
    case 'zh':
      return {
        subject: '[Locally] 🛠️ 体验内容需要补充',
        title: '🛠️ 体验内容需要补充',
        message: trimmedComment
          ? `「${experienceTitle}」需要补充。请查看管理员备注并修改。\n\n补充原因：${trimmedComment}`
          : `「${experienceTitle}」需要补充。请查看管理员备注并修改。`,
        ctaLabel: '修改体验',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 🛠️ 체험 등록 보완이 필요합니다',
        title: '🛠️ 체험 등록 보완이 필요합니다',
        message: trimmedComment
          ? `'${experienceTitle}' 체험에 보완이 필요합니다. 관리자 코멘트를 확인하고 수정해 주세요.\n\n보완 사유: ${trimmedComment}`
          : `'${experienceTitle}' 체험에 보완이 필요합니다. 관리자 코멘트를 확인하고 수정해 주세요.`,
        ctaLabel: '체험 보완하기',
      };
  }
}

function formatKrw(amount: number) {
  return `₩${Math.max(0, amount).toLocaleString('en-US')}`;
}

function getBookingReviewTypeLabel(locale: NotificationLocale, reviewType: ReviewType) {
  if (reviewType === 'minimum_participants_unmet') {
    switch (locale) {
      case 'en':
        return 'minimum participants not met';
      case 'ja':
        return '最低催行人数未達';
      case 'zh':
        return '未达到最低成团人数';
      case 'ko':
      default:
        return '최소 진행 인원 미달';
    }
  }

  switch (locale) {
    case 'en':
      return 'host unavailable';
    case 'ja':
      return 'ホスト都合';
    case 'zh':
      return '房东无法接待';
    case 'ko':
    default:
      return '호스트 진행 불가';
  }
}

function buildBookingRefundLine(locale: NotificationLocale, refundAmount: number) {
  const formatted = formatKrw(refundAmount);

  switch (locale) {
    case 'en':
      return `Refund amount: ${formatted}`;
    case 'ja':
      return `返金額: ${formatted}`;
    case 'zh':
      return `退款金额：${formatted}`;
    case 'ko':
    default:
      return `환불액: ${formatted}`;
  }
}

function buildBookingPrePaymentCancellationLine(locale: NotificationLocale) {
  switch (locale) {
    case 'en':
      return 'The booking was cancelled before payment was completed.';
    case 'ja':
      return '決済完了前に予約がキャンセルされました。';
    case 'zh':
      return '预订已在付款完成前取消。';
    case 'ko':
    default:
      return '결제 전 예약이 취소되었습니다.';
  }
}

function buildBookingConfirmedGuestEmailCopy(
  locale: NotificationLocale,
  params: BookingConfirmedGuestParams
): EmailCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Your booking is confirmed',
        title: 'Your booking is confirmed',
        message: `Payment for '${experienceTitle}' is complete and your booking is confirmed.`,
        ctaLabel: 'View my trips',
      };
    case 'ja':
      return {
        subject: '[Locally] 予約が確定しました',
        title: '予約が確定しました',
        message: `「${experienceTitle}」の決済が完了し、予約が確定しました。`,
        ctaLabel: '旅行を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 你的预订已确认',
        title: '你的预订已确认',
        message: `「${experienceTitle}」的付款已完成，预订现已确认。`,
        ctaLabel: '查看我的行程',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 예약이 확정되었습니다',
        title: '예약이 확정되었습니다',
        message: `'${experienceTitle}' 결제가 완료되어 예약이 확정되었습니다.`,
        ctaLabel: '내 여행 보기',
      };
  }
}

function buildBookingBankConfirmedEmailCopy(
  locale: NotificationLocale,
  key: 'booking.bank_confirmed.host' | 'booking.bank_confirmed.guest',
  params: BookingBankConfirmedHostParams | BookingBankConfirmedGuestParams
): EmailCopy {
  const { experienceTitle } = params;
  const guestName = 'guestName' in params ? params.guestName?.trim() : '';

  if (key === 'booking.bank_confirmed.host') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] 💰 Payment confirmed. Please message the guest',
          title: 'Payment confirmed. Message the guest now',
          message: `${guestName || 'The guest'} is waiting after the bank transfer for '${experienceTitle}' was confirmed. Send a quick hello and preparation details now.`,
          ctaLabel: 'View booking and message the guest',
        };
      case 'ja':
        return {
          subject: '[Locally] 💰 入金確認完了。ゲストにメッセージを送ってください',
          title: '入金確認完了。今すぐゲストにメッセージを',
          message: `「${experienceTitle}」予約の入金確認が完了しました。${guestName || 'ゲスト'}さんへ挨拶と準備案内を送ってください。`,
          ctaLabel: '予約を確認してメッセージを送る',
        };
      case 'zh':
        return {
          subject: '[Locally] 💰 收款已确认，请给客人发消息',
          title: '收款已确认。请立即给客人发消息',
          message: `「${experienceTitle}」预订的收款确认已完成。请现在向${guestName || '客人'}发送问候和准备说明。`,
          ctaLabel: '查看预订并发送消息',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 💰 입금 확인 완료. 게스트에게 메시지를 보내주세요',
          title: '입금 확인 완료. 지금 게스트에게 메시지를 보내주세요',
          message: `'${experienceTitle}' 예약의 입금 확인이 완료되었습니다. ${guestName || '게스트'}님에게 인사와 준비 안내를 보내주세요.`,
          ctaLabel: '예약 확인하고 메시지 보내기',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] ✅ Your booking is confirmed',
        title: 'Booking confirmation',
        message: `Bank transfer for '${experienceTitle}' was confirmed and your booking is now finalized.`,
        ctaLabel: 'View my trips',
      };
    case 'ja':
      return {
        subject: '[Locally] ✅ 予約が確定しました',
        title: '予約確定のお知らせ',
        message: `「${experienceTitle}」の入金確認が完了し、予約が確定しました。`,
        ctaLabel: '旅行を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] ✅ 你的预订已确认',
        title: '预订确认通知',
        message: `「${experienceTitle}」的转账已确认，预订现已完成确认。`,
        ctaLabel: '查看我的行程',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] ✅ 예약이 확정되었습니다',
        title: '예약 확정 알림',
        message: `'${experienceTitle}' 입금이 확인되어 예약이 확정되었습니다.`,
        ctaLabel: '내 여행 보기',
      };
  }
}

function buildBookingBankPendingGuestEmailCopy(
  locale: NotificationLocale,
  params: BookingBankConfirmedGuestParams
): EmailCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Your bank transfer booking was received',
        title: 'Booking received · Payment confirmation pending',
        message: `Your bank transfer booking for '${experienceTitle}' was received. It will be confirmed after payment is verified.`,
        ctaLabel: 'View my trips',
      };
    case 'ja':
      return {
        subject: '[Locally] 銀行振込予約を受け付けました',
        title: '予約受付完了 · 入金確認待ち',
        message: `「${experienceTitle}」の銀行振込予約を受け付けました。入金確認後に予約が確定します。`,
        ctaLabel: '旅行を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 已受理你的银行转账预订',
        title: '预订已受理 · 等待确认转账',
        message: `已受理「${experienceTitle}」的银行转账预订。确认到账后，预订将正式确认。`,
        ctaLabel: '查看我的行程',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 무통장 입금 대기 예약이 접수되었습니다',
        title: '예약 접수 완료 · 입금 확인 대기',
        message: `'${experienceTitle}' 무통장 입금 예약이 접수되었습니다. 입금 확인 후 예약이 확정됩니다.`,
        ctaLabel: '내 여행 보기',
      };
  }
}

function buildBookingCancelledEmailCopy(
  locale: NotificationLocale,
  key:
    | 'booking.cancelled.host'
    | 'booking.cancelled.guest'
    | 'booking.cancelled.admin_force.guest'
    | 'booking.cancelled.host_fault.guest',
  params:
    | BookingCancelledHostParams
    | BookingCancelledGuestParams
    | BookingCancelledAdminForceGuestParams
    | BookingCancelledHostFaultGuestParams
): EmailCopy {
  if (key === 'booking.cancelled.host') {
    const { experienceTitle, reason, refundAmount } = params as BookingCancelledHostParams;
    const safeReason =
      typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : locale === 'en'
          ? 'not provided'
          : locale === 'ja'
            ? '未提供'
            : locale === 'zh'
              ? '未提供'
              : '미제공';
    const refundLine = buildBookingRefundLine(locale, refundAmount);

    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Booking cancellation notice (host)',
          title: 'The booking was cancelled',
          message: `The booking for [${experienceTitle}] was cancelled. Reason: ${safeReason}. ${refundLine}`,
          ctaLabel: 'View dashboard',
        };
      case 'ja':
        return {
          subject: '[Locally] 予約キャンセルのご案内（ホスト）',
          title: '予約がキャンセルされました',
          message: `［${experienceTitle}］予約がキャンセルされました。理由: ${safeReason}。${refundLine}`,
          ctaLabel: 'ダッシュボードを見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 预订取消通知（房东）',
          title: '预订已取消',
          message: `［${experienceTitle}］预订已取消。原因：${safeReason}。${refundLine}`,
          ctaLabel: '查看后台',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 예약 취소 안내 (호스트)',
          title: '예약이 취소되었습니다',
          message: `[${experienceTitle}] 예약이 취소되었습니다. 취소 사유: ${safeReason}. ${refundLine}`,
          ctaLabel: '대시보드 보기',
        };
    }
  }

  if (key === 'booking.cancelled.guest') {
    const { experienceTitle, refundAmount } = params as BookingCancelledGuestParams;
    const refundLine = buildBookingRefundLine(locale, refundAmount);

    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Booking cancellation notice',
          title: 'Your booking was cancelled',
          message: `Your booking for '${experienceTitle}' was cancelled.\n${refundLine}`,
          ctaLabel: 'View my trips',
        };
      case 'ja':
        return {
          subject: '[Locally] 予約キャンセルのご案内',
          title: '予約がキャンセルされました',
          message: `「${experienceTitle}」の予約がキャンセルされました。\n${refundLine}`,
          ctaLabel: '旅行を見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 预订取消通知',
          title: '预订已取消',
          message: `「${experienceTitle}」的预订已取消。\n${refundLine}`,
          ctaLabel: '查看我的行程',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 예약 취소 안내',
          title: '예약이 취소되었습니다',
          message: `'${experienceTitle}' 예약이 취소되었습니다.\n${refundLine}`,
          ctaLabel: '내 여행 보기',
        };
    }
  }

  if (key === 'booking.cancelled.admin_force.guest') {
    const { experienceTitle, refundAmount } = params as BookingCancelledAdminForceGuestParams;
    const refundLine =
      refundAmount > 0
        ? buildBookingRefundLine(locale, refundAmount)
        : buildBookingPrePaymentCancellationLine(locale);

    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Booking cancellation notice',
          title: 'Your booking was cancelled',
          message: `Your booking for '${experienceTitle}' was cancelled by the admin.\n${refundLine}`,
          ctaLabel: 'View my trips',
        };
      case 'ja':
        return {
          subject: '[Locally] 予約キャンセルのご案内',
          title: '予約がキャンセルされました',
          message: `「${experienceTitle}」の予約が管理者によりキャンセルされました。\n${refundLine}`,
          ctaLabel: '旅行を見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 预订取消通知',
          title: '预订已取消',
          message: `「${experienceTitle}」的预订已被管理员取消。\n${refundLine}`,
          ctaLabel: '查看我的行程',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 예약 취소 안내',
          title: '예약이 취소되었습니다',
          message: `'${experienceTitle}' 예약이 관리자에 의해 취소되었습니다.\n${refundLine}`,
          ctaLabel: '내 여행 보기',
        };
    }
  }

  const { experienceTitle, refundAmount, reviewType } = params as BookingCancelledHostFaultGuestParams;
  const reasonLabel = getBookingReviewTypeLabel(locale, reviewType);
  const refundLine =
    refundAmount > 0
      ? buildBookingRefundLine(locale, refundAmount)
      : buildBookingPrePaymentCancellationLine(locale);

  switch (locale) {
    case 'en':
      return {
        subject: `[Locally] ${reasonLabel} cancellation notice`,
        title: `Your booking was cancelled due to ${reasonLabel}`,
        message: `Your booking for '${experienceTitle}' was cancelled due to ${reasonLabel}.\n${refundLine}`,
        ctaLabel: 'View my trips',
      };
    case 'ja':
      return {
        subject: `[Locally] ${reasonLabel} キャンセルのご案内`,
        title: `${reasonLabel}により予約がキャンセルされました`,
        message: `「${experienceTitle}」の予約が${reasonLabel}によりキャンセルされました。\n${refundLine}`,
        ctaLabel: '旅行を見る',
      };
    case 'zh':
      return {
        subject: `[Locally] ${reasonLabel} 取消通知`,
        title: `预订因${reasonLabel}而取消`,
        message: `「${experienceTitle}」的预订因${reasonLabel}而取消。\n${refundLine}`,
        ctaLabel: '查看我的行程',
      };
    case 'ko':
    default:
      return {
        subject: `[Locally] ${reasonLabel} 취소 안내`,
        title: `${reasonLabel}로 예약이 취소되었습니다`,
        message: `'${experienceTitle}' 예약이 ${reasonLabel} 사유로 취소되었습니다.\n${refundLine}`,
        ctaLabel: '내 여행 보기',
      };
  }
}

function buildBookingCancellationApprovedGuestEmailCopy(
  locale: NotificationLocale,
  params: BookingCancellationApprovedGuestParams
): EmailCopy {
  const normalizedTitle =
    typeof params.experienceTitle === 'string' ? params.experienceTitle.trim() : '';

  switch (locale) {
    case 'en':
      return normalizedTitle
        ? {
            subject: '[Locally] Your cancellation and refund have been approved',
            title: 'Your cancellation and refund have been approved',
            message: `The cancellation and refund for "${normalizedTitle}" have been approved.`,
            ctaLabel: 'Check trip',
          }
        : {
            subject: '[Locally] Your cancellation and refund have been approved',
            title: 'Your cancellation and refund have been approved',
            message: 'Your cancellation and refund have been approved.',
            ctaLabel: 'Check trip',
          };
    case 'ja':
      return normalizedTitle
        ? {
            subject: '[Locally] キャンセルと返金が承認されました',
            title: 'キャンセルと返金が承認されました',
            message: `「${normalizedTitle}」のキャンセルと返金が承認されました。`,
            ctaLabel: '旅行を確認',
          }
        : {
            subject: '[Locally] キャンセルと返金が承認されました',
            title: 'キャンセルと返金が承認されました',
            message: 'キャンセルと返金が承認されました。',
            ctaLabel: '旅行を確認',
          };
    case 'zh':
      return normalizedTitle
        ? {
            subject: '[Locally] 您的取消和退款已获批准',
            title: '您的取消和退款已获批准',
            message: `“${normalizedTitle}”的取消和退款已获批准。`,
            ctaLabel: '查看行程',
          }
        : {
            subject: '[Locally] 您的取消和退款已获批准',
            title: '您的取消和退款已获批准',
            message: '您的取消和退款已获批准。',
            ctaLabel: '查看行程',
          };
    case 'ko':
    default:
      return normalizedTitle
        ? {
            subject: '[Locally] 취소 및 환불이 승인되었습니다',
            title: '취소 및 환불이 승인되었습니다',
            message: `"${normalizedTitle}" 취소 및 환불이 승인되었습니다.`,
            ctaLabel: '여행 확인하기',
          }
        : {
            subject: '[Locally] 취소 및 환불이 승인되었습니다',
            title: '취소 및 환불이 승인되었습니다',
            message: '취소 및 환불이 승인되었습니다.',
            ctaLabel: '여행 확인하기',
          };
  }
}

function buildServiceRequestNewHostEmailCopy(
  locale: NotificationLocale,
  params: ServiceRequestNewHostParams
): EmailCopy {
  const { requestTitle, requestCity, durationHours, guestCount } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] A new custom service request has arrived',
        title: 'A new custom service request has arrived',
        message: `A new request for '${requestTitle}' was submitted. This request was shared only with hosts active in ${requestCity}. (${durationHours}h, ${guestCount} guest${guestCount === 1 ? '' : 's'})`,
        ctaLabel: 'View request',
      };
    case 'ja':
      return {
        subject: '[Locally] 新しいカスタムサービス依頼が届きました',
        title: '新しいカスタムサービス依頼が届きました',
        message: `「${requestTitle}」の依頼が登録されました。${requestCity}で活動可能なホストにのみ共有された依頼です。（${durationHours}時間、${guestCount}名）`,
        ctaLabel: '依頼を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 你收到了新的定制服务请求',
        title: '你收到了新的定制服务请求',
        message: `「${requestTitle}」请求已提交。该请求仅发送给可在${requestCity}活动的房东。（${durationHours}小时，${guestCount}人）`,
        ctaLabel: '查看请求',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 새로운 맞춤 서비스 의뢰가 도착했습니다',
        title: '새로운 맞춤 서비스 의뢰가 도착했습니다',
        message: `'${requestTitle}' 의뢰가 등록되었습니다. ${requestCity}에서 활동 가능한 호스트에게만 전달된 요청입니다. (${durationHours}시간, ${guestCount}명)`,
        ctaLabel: '의뢰 확인하기',
      };
  }
}

function buildServicePaymentConfirmedCustomerEmailCopy(
  locale: NotificationLocale,
  params: ServicePaymentConfirmedCustomerParams
): EmailCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Your service payment is complete',
        title: 'Payment is complete',
        message: `Payment for '${requestTitle}' is complete, and local host recruitment is now starting.`,
        ctaLabel: 'View request',
      };
    case 'ja':
      return {
        subject: '[Locally] サービスの決済が完了しました',
        title: '決済が完了しました',
        message: `「${requestTitle}」の決済が完了し、現地ホストの募集が始まります。`,
        ctaLabel: '依頼を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 服务付款已完成',
        title: '付款已完成',
        message: `「${requestTitle}」的付款已完成，现已开始招募当地房东。`,
        ctaLabel: '查看请求',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 서비스 결제가 완료되었습니다',
        title: '결제가 완료되었습니다',
        message: `'${requestTitle}' 결제가 완료되어 현지 호스트 모집이 시작됩니다.`,
        ctaLabel: '의뢰 확인하기',
      };
  }
}

function buildServiceApplicationNewCustomerEmailCopy(
  locale: NotificationLocale,
  params: ServiceApplicationNewCustomerParams
): EmailCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] A new host has applied',
        title: 'A new host has applied',
        message: `A new host applied to '${requestTitle}'. Take a look when you can.`,
        ctaLabel: 'View applicants',
      };
    case 'ja':
      return {
        subject: '[Locally] 新しいホスト応募が届きました',
        title: '新しいホスト応募が届きました',
        message: `「${requestTitle}」に新しいホストが応募しました。お時間のあるときにご確認ください。`,
        ctaLabel: '応募者を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 有新的房东申请',
        title: '有新的房东申请',
        message: `「${requestTitle}」有新的房东提交了申请，请尽快查看。`,
        ctaLabel: '查看申请人',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 새로운 호스트 지원자가 있습니다',
        title: '새로운 호스트 지원자가 있습니다',
        message: `'${requestTitle}' 의뢰에 새로운 호스트가 지원했습니다. 빠르게 검토해보세요.`,
        ctaLabel: '지원자 확인하기',
      };
  }
}

function buildServiceHostSelectedEmailCopy(
  locale: NotificationLocale,
  params: ServiceHostSelectedParams
): EmailCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] You were selected by the guest',
        title: 'You were selected by the guest',
        message: `You were selected for '${requestTitle}'. Please get ready to proceed.`,
        ctaLabel: 'View request',
      };
    case 'ja':
      return {
        subject: '[Locally] ゲストに選ばれました',
        title: 'ゲストに選ばれました',
        message: `「${requestTitle}」の依頼で選ばれました。進行の準備をお願いします。`,
        ctaLabel: '依頼を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 你已被游客选中',
        title: '你已被游客选中',
        message: `你已在「${requestTitle}」中被选中，请开始准备后续 진행。`,
        ctaLabel: '查看请求',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 고객에게 선택되었습니다',
        title: '고객에게 선택되었습니다',
        message: `'${requestTitle}' 의뢰에서 선택되셨습니다. 바로 진행을 준비해주세요.`,
        ctaLabel: '의뢰 확인하기',
      };
  }
}

function buildServiceCancelEmailCopy(
  locale: NotificationLocale,
  key: 'service.cancel_requested' | 'service.cancelled',
  params: ServiceCancellationParams
): EmailCopy {
  const { requestTitle, refundAmount } = params;

  if (key === 'service.cancel_requested') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Your service cancellation request was received',
          title: 'Your cancellation request was received',
          message: `A cancellation request for '${requestTitle}' was received. The admin team will review it shortly.`,
          ctaLabel: 'View request',
        };
      case 'ja':
        return {
          subject: '[Locally] サービスのキャンセル依頼を受け付けました',
          title: 'キャンセル依頼を受け付けました',
          message: `「${requestTitle}」サービスのキャンセル依頼を受け付けました。運営チームが確認のうえ対応します。`,
          ctaLabel: '依頼を見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 已收到服务取消申请',
          title: '已收到取消申请',
          message: `已收到「${requestTitle}」服务的取消申请，运营团队会尽快审核处理。`,
          ctaLabel: '查看请求',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 서비스 취소 요청이 접수되었습니다',
          title: '취소 요청이 접수되었습니다',
          message: `'${requestTitle}' 서비스 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
          ctaLabel: '의뢰 확인하기',
        };
    }
  }

  const refundMessage =
    typeof refundAmount === 'number'
      ? refundAmount > 0
        ? {
            ko: `환불 금액: ${formatKrw(refundAmount)}`,
            en: `Refund amount: ${formatKrw(refundAmount)}`,
            ja: `返金額: ${formatKrw(refundAmount)}`,
            zh: `退款金额：${formatKrw(refundAmount)}`,
          }
        : {
            ko: '환불 금액은 없습니다.',
            en: 'There is no refund amount.',
            ja: '返金額はありません。',
            zh: '无退款金额。',
          }
      : null;

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Service cancellation notice',
        title: 'The service was cancelled',
        message: refundMessage
          ? `The service '${requestTitle}' was cancelled. ${refundMessage.en}`
          : `The service '${requestTitle}' was cancelled.`,
        ctaLabel: 'View request',
      };
    case 'ja':
      return {
        subject: '[Locally] サービスキャンセルのご案内',
        title: 'サービスがキャンセルされました',
        message: refundMessage
          ? `「${requestTitle}」サービスがキャンセルされました。${refundMessage.ja}`
          : `「${requestTitle}」サービスがキャンセルされました。`,
        ctaLabel: '依頼を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 服务取消通知',
        title: '服务已取消',
        message: refundMessage
          ? `「${requestTitle}」服务已取消。${refundMessage.zh}`
          : `「${requestTitle}」服务已取消。`,
        ctaLabel: '查看请求',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 서비스 취소 안내',
        title: '서비스가 취소되었습니다',
        message: refundMessage
          ? `'${requestTitle}' 서비스가 취소되었습니다. ${refundMessage.ko}`
          : `'${requestTitle}' 서비스가 취소되었습니다.`,
        ctaLabel: '의뢰 확인하기',
      };
  }
}

function buildProxyPaymentEmailCopy(
  locale: NotificationLocale,
  key: 'proxy.payment_confirmed' | 'proxy.payment_cancelled' | 'proxy.payment_refunded',
  params: ProxyPaymentParams
): EmailCopy {
  const { requestTitle } = params;

  if (key === 'proxy.payment_confirmed') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Your phone booking payment was confirmed',
          title: 'Your phone booking payment was confirmed',
          message: `Payment for '${requestTitle}' was confirmed. The team will continue your booking now.`,
          ctaLabel: 'View request',
        };
      case 'ja':
        return {
          subject: '[Locally] 電話予約の決済が確認されました',
          title: '電話予約の決済が確認されました',
          message: `「${requestTitle}」の決済が確認されました。担当チームが予約進行を続けます。`,
          ctaLabel: '依頼を見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 电话预约付款已确认',
          title: '电话预约付款已确认',
          message: `「${requestTitle}」的付款已确认，团队会继续为你推进预约。`,
          ctaLabel: '查看请求',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 전화 예약 결제가 확인되었습니다',
          title: '전화 예약 결제가 확인되었습니다',
          message: `'${requestTitle}' 요청의 결제가 확인되었습니다. 담당자가 예약 진행을 이어갑니다.`,
          ctaLabel: '요청 확인하기',
        };
    }
  }

  if (key === 'proxy.payment_cancelled') {
    switch (locale) {
      case 'en':
        return {
          subject: '[Locally] Your phone booking payment was cancelled',
          title: 'Your phone booking payment was cancelled',
          message: `Payment for '${requestTitle}' was cancelled, so this request is now closed.`,
          ctaLabel: 'View request',
        };
      case 'ja':
        return {
          subject: '[Locally] 電話予約の決済がキャンセルされました',
          title: '電話予約の決済がキャンセルされました',
          message: `「${requestTitle}」の決済がキャンセルされ、このリクエストは終了しました。`,
          ctaLabel: '依頼を見る',
        };
      case 'zh':
        return {
          subject: '[Locally] 电话预约付款已取消',
          title: '电话预约付款已取消',
          message: `「${requestTitle}」的付款已取消，该请求现已结束。`,
          ctaLabel: '查看请求',
        };
      case 'ko':
      default:
        return {
          subject: '[Locally] 전화 예약 결제가 취소되었습니다',
          title: '전화 예약 결제가 취소되었습니다',
          message: `'${requestTitle}' 요청의 결제가 취소되어 접수가 종료되었습니다.`,
          ctaLabel: '요청 확인하기',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] Your phone booking payment was refunded',
        title: 'Your phone booking payment was refunded',
        message: `Payment for '${requestTitle}' was refunded. Please check the team thread for more details.`,
        ctaLabel: 'View request',
      };
    case 'ja':
      return {
        subject: '[Locally] 電話予約の決済が返金処理されました',
        title: '電話予約の決済が返金処理されました',
        message: `「${requestTitle}」の決済が返金処理されました。詳しくは担当者スレッドをご確認ください。`,
        ctaLabel: '依頼を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 电话预约付款已退款',
        title: '电话预约付款已退款',
        message: `「${requestTitle}」的付款已退款，详情请查看客服对话线程。`,
        ctaLabel: '查看请求',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 전화 예약 결제가 환불 처리되었습니다',
        title: '전화 예약 결제가 환불 처리되었습니다',
        message: `'${requestTitle}' 요청의 결제가 환불 처리되었습니다. 세부 내용은 담당자 스레드에서 확인해주세요.`,
        ctaLabel: '요청 확인하기',
      };
  }
}

function buildProxyCommentReplyEmailCopy(
  locale: NotificationLocale,
  params: ProxyCommentReplyParams
): EmailCopy {
  const trimmedContent = params.content.trim();

  switch (locale) {
    case 'en':
      return {
        subject: '[Locally] There is a new reply to your phone booking request',
        title: 'There is a new reply to your phone booking request',
        message: `The Locally operations team left a reply to your phone booking request.\n\n${trimmedContent}`,
        ctaLabel: 'View reply',
      };
    case 'ja':
      return {
        subject: '[Locally] 電話予約リクエストに新しい返信があります',
        title: '電話予約リクエストに新しい返信があります',
        message: `Locally運営チームが電話予約リクエストに返信しました。\n\n${trimmedContent}`,
        ctaLabel: '返信を見る',
      };
    case 'zh':
      return {
        subject: '[Locally] 你的电话预约请求有新回复',
        title: '你的电话预约请求有新回复',
        message: `Locally 运营团队已回复你的电话预约请求。\n\n${trimmedContent}`,
        ctaLabel: '查看回复',
      };
    case 'ko':
    default:
      return {
        subject: '[Locally] 전화 예약 요청에 새 답변이 도착했습니다',
        title: '전화 예약 요청에 새 답변이 도착했습니다',
        message: `Locally 운영팀이 전화 예약 요청에 답변을 남겼습니다.\n\n${trimmedContent}`,
        ctaLabel: '답변 확인하기',
      };
  }
}

function buildInquiryNewMessageEmailCopy(
  locale: NotificationLocale,
  params: InquiryNewMessageParams
): EmailCopy {
  const { actorDisplayName, displayContent } = params;
  const isOfficialSender = isOfficialSupportSenderDisplayName(actorDisplayName);

  switch (locale) {
    case 'en':
      return {
        subject: `[Locally] New message from ${actorDisplayName}`,
        title: `New message from ${actorDisplayName}`,
        message: displayContent,
        ctaLabel: 'Check message',
      };
    case 'ja':
      return {
        subject: isOfficialSender
          ? `[Locally] ${actorDisplayName}から新しいメッセージが届きました`
          : `[Locally] ${actorDisplayName}さんから新しいメッセージが届きました`,
        title: isOfficialSender
          ? `${actorDisplayName}から新しいメッセージが届きました`
          : `${actorDisplayName}さんから新しいメッセージが届きました`,
        message: displayContent,
        ctaLabel: 'メッセージを確認',
      };
    case 'zh':
      return {
        subject: `[Locally] ${actorDisplayName} 发来了新消息`,
        title: `${actorDisplayName} 发来了新消息`,
        message: displayContent,
        ctaLabel: '查看消息',
      };
    case 'ko':
    default:
      return {
        subject: `[Locally] ${actorDisplayName}님의 새 메시지`,
        title: `${actorDisplayName}님의 새 메시지`,
        message: displayContent,
        ctaLabel: '메시지 확인하기',
      };
  }
}

export function buildEmailCopy<K extends EmailCopyKey>(
  key: K,
  locale: NotificationLocale,
  copyParams: EmailCopyParams[K]
): EmailCopy {
  switch (key) {
    case 'review.new.host':
      return buildReviewNewHostEmailCopy(locale, copyParams as EmailCopyParams['review.new.host']);
    case 'review.reply.guest':
      return buildReviewReplyGuestEmailCopy(
        locale,
        copyParams as EmailCopyParams['review.reply.guest']
      );
    case 'review.guest_request.host':
      return buildReviewGuestRequestHostEmailCopy(
        locale,
        copyParams as EmailCopyParams['review.guest_request.host']
      );
    case 'review.guest_received.guest':
      return buildReviewGuestReceivedGuestEmailCopy(
        locale,
        copyParams as EmailCopyParams['review.guest_received.guest']
      );
    case 'membership.member_welcome':
    case 'membership.circle_welcome':
      return buildMembershipEmailCopy(locale, {
        ...(copyParams as EmailCopyParams['membership.member_welcome']),
        status: key === 'membership.circle_welcome' ? 'circle' : 'member',
      });
    case 'host_application.approved':
    case 'host_application.revision':
    case 'host_application.rejected':
      return buildHostApplicationStatusEmailCopy(
        locale,
        key,
        copyParams as EmailCopyParams['host_application.approved']
      );
    case 'experience.approved':
    case 'experience.revision':
      return buildExperienceStatusEmailCopy(
        locale,
        key,
        copyParams as EmailCopyParams['experience.approved']
      );
    case 'booking.confirmed.guest':
      return buildBookingConfirmedGuestEmailCopy(
        locale,
        copyParams as EmailCopyParams['booking.confirmed.guest']
      );
    case 'booking.cancellation_approved.guest':
      return buildBookingCancellationApprovedGuestEmailCopy(
        locale,
        copyParams as EmailCopyParams['booking.cancellation_approved.guest']
      );
    case 'booking.bank_pending.guest':
      return buildBookingBankPendingGuestEmailCopy(
        locale,
        copyParams as EmailCopyParams['booking.bank_pending.guest']
      );
    case 'booking.bank_confirmed.host':
    case 'booking.bank_confirmed.guest':
      return buildBookingBankConfirmedEmailCopy(
        locale,
        key,
        copyParams as
          | EmailCopyParams['booking.bank_confirmed.host']
          | EmailCopyParams['booking.bank_confirmed.guest']
      );
    case 'booking.cancelled.host':
    case 'booking.cancelled.guest':
    case 'booking.cancelled.admin_force.guest':
    case 'booking.cancelled.host_fault.guest':
      return buildBookingCancelledEmailCopy(
        locale,
        key,
        copyParams as
          | EmailCopyParams['booking.cancelled.host']
          | EmailCopyParams['booking.cancelled.guest']
          | EmailCopyParams['booking.cancelled.admin_force.guest']
          | EmailCopyParams['booking.cancelled.host_fault.guest']
      );
    case 'service.request_new.host':
      return buildServiceRequestNewHostEmailCopy(
        locale,
        copyParams as EmailCopyParams['service.request_new.host']
      );
    case 'service.payment_confirmed.customer':
      return buildServicePaymentConfirmedCustomerEmailCopy(
        locale,
        copyParams as EmailCopyParams['service.payment_confirmed.customer']
      );
    case 'service.application_new.customer':
      return buildServiceApplicationNewCustomerEmailCopy(
        locale,
        copyParams as EmailCopyParams['service.application_new.customer']
      );
    case 'service.host_selected':
      return buildServiceHostSelectedEmailCopy(
        locale,
        copyParams as EmailCopyParams['service.host_selected']
      );
    case 'service.cancel_requested':
    case 'service.cancelled':
      return buildServiceCancelEmailCopy(
        locale,
        key,
        copyParams as EmailCopyParams['service.cancel_requested']
      );
    case 'proxy.payment_confirmed':
    case 'proxy.payment_cancelled':
    case 'proxy.payment_refunded':
      return buildProxyPaymentEmailCopy(
        locale,
        key,
        copyParams as EmailCopyParams['proxy.payment_confirmed']
      );
    case 'proxy.comment_reply':
      return buildProxyCommentReplyEmailCopy(
        locale,
        copyParams as EmailCopyParams['proxy.comment_reply']
      );
    case 'inquiry.new_message':
      return buildInquiryNewMessageEmailCopy(
        locale,
        copyParams as EmailCopyParams['inquiry.new_message']
      );
    default:
      return assertNever(key);
  }
}

export async function buildLocalizedEmailCopy<K extends EmailCopyKey>(
  params: LocalizedEmailCopyInput<K>
): Promise<EmailCopy> {
  const locale = await resolveRecipientLocale(params.supabaseAdmin, params.userId);
  return buildEmailCopy(params.key, locale, params.copyParams);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported email copy key: ${String(value)}`);
}
