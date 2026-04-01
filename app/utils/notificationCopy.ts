import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  resolveRecipientLocale,
  type NotificationLocale,
} from '@/app/utils/notificationLocale';

type AdminClient = ReturnType<typeof createAdminClient>;

type ReviewType = 'host_unavailable' | 'minimum_participants_unmet';

type BookingNewHostParams = {
  experienceTitle: string;
  guestName: string;
  state: 'pending' | 'processing';
};

type BookingConfirmedHostParams = {
  experienceTitle: string;
  guestName: string;
};

type BookingConfirmedGuestParams = {
  experienceTitle: string;
};

type BookingReviewPendingParams = {
  experienceTitle: string;
  reviewType: ReviewType;
  recipient: 'guest' | 'host';
};

type BookingCancelledParams = {
  experienceTitle: string;
  refundAmount: number;
  recipient: 'guest' | 'host';
};

type BookingAdminForceCancelledGuestParams = {
  experienceTitle: string;
  refundAmount: number;
};

type BookingHostFaultCancelledParams = {
  experienceTitle: string;
  refundAmount: number;
  recipient: 'guest' | 'host';
  reviewType: ReviewType;
};

type BookingReviewRejectedParams = {
  experienceTitle: string;
  reviewType: ReviewType;
  recipient: 'guest' | 'host';
};

type InquiryNewMessageParams = {
  actorDisplayName: string;
  displayContent: string;
};

type ReviewNewHostParams = {
  experienceTitle: string;
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

type ServiceHostSelectionParams = {
  requestTitle: string;
};

type ServiceCancelRequestedParams = {
  requestTitle: string;
};

type ServiceCancelledParams = {
  requestTitle: string;
  refundAmount?: number | null;
};

type MembershipParams = {
  status: 'member' | 'circle';
};

type HostApplicationStatusParams = {
  comment?: string;
};

export type NotificationCopyKey =
  | 'booking.new.host'
  | 'booking.confirmed.host'
  | 'booking.confirmed.guest'
  | 'booking.bank_confirmed.host'
  | 'booking.bank_confirmed.guest'
  | 'booking.review_pending'
  | 'booking.cancelled'
  | 'booking.cancelled.admin_force.guest'
  | 'booking.cancelled.host_fault'
  | 'booking.review_rejected'
  | 'inquiry.new_message'
  | 'review.new.host'
  | 'service.request_new.host'
  | 'service.payment_confirmed.customer'
  | 'service.application_new.customer'
  | 'service.host_selected'
  | 'service.host_rejected'
  | 'service.cancel_requested'
  | 'service.cancelled'
  | 'membership.member_welcome'
  | 'membership.circle_welcome'
  | 'host_application.approved'
  | 'host_application.revision'
  | 'host_application.rejected';

type NotificationCopyParams = {
  'booking.new.host': BookingNewHostParams;
  'booking.confirmed.host': BookingConfirmedHostParams;
  'booking.confirmed.guest': BookingConfirmedGuestParams;
  'booking.bank_confirmed.host': BookingConfirmedHostParams;
  'booking.bank_confirmed.guest': BookingConfirmedGuestParams;
  'booking.review_pending': BookingReviewPendingParams;
  'booking.cancelled': BookingCancelledParams;
  'booking.cancelled.admin_force.guest': BookingAdminForceCancelledGuestParams;
  'booking.cancelled.host_fault': BookingHostFaultCancelledParams;
  'booking.review_rejected': BookingReviewRejectedParams;
  'inquiry.new_message': InquiryNewMessageParams;
  'review.new.host': ReviewNewHostParams;
  'service.request_new.host': ServiceRequestNewHostParams;
  'service.payment_confirmed.customer': ServicePaymentConfirmedCustomerParams;
  'service.application_new.customer': ServiceApplicationNewCustomerParams;
  'service.host_selected': ServiceHostSelectionParams;
  'service.host_rejected': ServiceHostSelectionParams;
  'service.cancel_requested': ServiceCancelRequestedParams;
  'service.cancelled': ServiceCancelledParams;
  'membership.member_welcome': MembershipParams;
  'membership.circle_welcome': MembershipParams;
  'host_application.approved': HostApplicationStatusParams;
  'host_application.revision': HostApplicationStatusParams;
  'host_application.rejected': HostApplicationStatusParams;
};

type NotificationCopy = {
  title: string;
  message: string;
};

type LocalizedNotificationInsertInput<K extends NotificationCopyKey> = {
  supabaseAdmin: AdminClient;
  userId: string;
  type: string;
  link: string;
  key: K;
  copyParams: NotificationCopyParams[K];
};

const NUMBER_FORMAT_LOCALE: Record<NotificationLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

function formatKrw(amount: number, locale: NotificationLocale) {
  return `₩${Math.max(0, amount).toLocaleString(NUMBER_FORMAT_LOCALE[locale])}`;
}

function getRefundText(refundAmount: number, locale: NotificationLocale) {
  if (refundAmount > 0) {
    const formatted = formatKrw(refundAmount, locale);
    switch (locale) {
      case 'en':
        return `Refund amount: ${formatted}`;
      case 'ja':
        return `返金額: ${formatted}`;
      case 'zh':
        return `退款金额：${formatted}`;
      case 'ko':
      default:
        return `환불 금액: ${formatted}`;
    }
  }

  switch (locale) {
    case 'en':
      return 'The booking was cancelled before payment was completed.';
    case 'ja':
      return '決済完了前に予約がキャンセルされました。';
    case 'zh':
      return '该预约已在付款完成前取消。';
    case 'ko':
    default:
      return '결제 전 예약이 취소되었습니다.';
  }
}

function getServiceRefundText(
  refundAmount: number | null | undefined,
  locale: NotificationLocale
) {
  if (typeof refundAmount !== 'number') {
    return '';
  }

  if (refundAmount > 0) {
    const formatted = formatKrw(refundAmount, locale);
    switch (locale) {
      case 'en':
        return ` Refund amount: ${formatted}`;
      case 'ja':
        return ` 返金額: ${formatted}`;
      case 'zh':
        return ` 退款金额：${formatted}`;
      case 'ko':
      default:
        return ` 환불 금액: ${formatted}`;
    }
  }

  switch (locale) {
    case 'en':
      return ' No refund amount.';
    case 'ja':
      return ' 返金額はありません。';
    case 'zh':
      return ' 无退款金额。';
    case 'ko':
    default:
      return ' 환불 금액은 없습니다.';
  }
}

function getReviewTypeLabel(reviewType: ReviewType, locale: NotificationLocale) {
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

function buildBookingNewHostCopy(
  locale: NotificationLocale,
  params: BookingNewHostParams
): NotificationCopy {
  const { experienceTitle, guestName, state } = params;

  if (state === 'pending') {
    switch (locale) {
      case 'en':
        return {
          title: '⏳ New booking (bank transfer pending)',
          message: `A bank transfer booking from ${guestName} was received for '${experienceTitle}'.`,
        };
      case 'ja':
        return {
          title: '⏳ 新しい予約（入金待ち）',
          message: `「${experienceTitle}」に${guestName}さんの銀行振込予約が入りました。`,
        };
      case 'zh':
        return {
          title: '⏳ 新预约（待转账）',
          message: `「${experienceTitle}」收到来自${guestName}的银行转账预约。`,
        };
      case 'ko':
      default:
        return {
          title: '⏳ 새로운 예약 (입금 대기)',
          message: `'${experienceTitle}'에 ${guestName}님의 무통장 입금 대기 예약이 접수되었습니다.`,
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: '🎉 New booking (payment in progress)',
        message: `A new payment from ${guestName} is in progress for '${experienceTitle}'.`,
      };
    case 'ja':
      return {
        title: '🎉 新しい予約（決済進行中）',
        message: `「${experienceTitle}」に${guestName}さんの新しい決済が進行中です。`,
      };
    case 'zh':
      return {
        title: '🎉 新预约（支付进行中）',
        message: `「${experienceTitle}」中来自${guestName}的新支付正在进行中。`,
      };
    case 'ko':
    default:
      return {
        title: '🎉 새로운 예약 (결제 진행중)',
        message: `'${experienceTitle}'에 ${guestName}님의 새로운 결제가 진행되고 있습니다!`,
      };
  }
}

function buildBookingConfirmedHostCopy(
  locale: NotificationLocale,
  params: BookingConfirmedHostParams
): NotificationCopy {
  const { experienceTitle, guestName } = params;

  switch (locale) {
    case 'en':
      return {
        title: '🎉 New booking confirmed!',
        message: `The booking from ${guestName} for '${experienceTitle}' has been confirmed.`,
      };
    case 'ja':
      return {
        title: '🎉 新しい予約が確定しました！',
        message: `「${experienceTitle}」の${guestName}さんの予約が確定しました。`,
      };
    case 'zh':
      return {
        title: '🎉 新预约已确认！',
        message: `「${experienceTitle}」中来自${guestName}的预约已确认。`,
      };
    case 'ko':
    default:
      return {
        title: '🎉 새로운 예약 도착!',
        message: `[${experienceTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
      };
  }
}

function buildBookingBankConfirmedHostCopy(
  locale: NotificationLocale,
  params: BookingConfirmedHostParams
): NotificationCopy {
  const { experienceTitle, guestName } = params;

  switch (locale) {
    case 'en':
      return {
        title: '💰 Payment received',
        message: `The bank transfer from ${guestName} for '${experienceTitle}' has been confirmed.`,
      };
    case 'ja':
      return {
        title: '💰 入金確認完了',
        message: `「${experienceTitle}」の${guestName}さんの入金確認が完了しました。`,
      };
    case 'zh':
      return {
        title: '💰 已确认收款',
        message: `已确认「${experienceTitle}」中来自${guestName}的转账。`,
      };
    case 'ko':
    default:
      return {
        title: '💰 입금 확인 완료!',
        message: `'${experienceTitle}' ${guestName}님의 입금 확인이 완료되었습니다.`,
      };
  }
}

function buildBookingConfirmedGuestCopy(
  locale: NotificationLocale,
  params: BookingConfirmedGuestParams
): NotificationCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: '✅ Your booking is confirmed',
        message: `Your payment for '${experienceTitle}' is complete and the booking is confirmed.`,
      };
    case 'ja':
      return {
        title: '✅ 予約が確定しました',
        message: `「${experienceTitle}」の決済が完了し、予約が確定しました。`,
      };
    case 'zh':
      return {
        title: '✅ 预约已确认',
        message: `「${experienceTitle}」的付款已完成，预约已确认。`,
      };
    case 'ko':
    default:
      return {
        title: '✅ 예약이 확정되었습니다',
        message: `'${experienceTitle}' 결제가 완료되어 예약이 확정되었습니다.`,
      };
  }
}

function buildBookingBankConfirmedGuestCopy(
  locale: NotificationLocale,
  params: BookingConfirmedGuestParams
): NotificationCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: '✅ Booking confirmation',
        message: `The bank transfer for '${experienceTitle}' has been confirmed and your booking is now confirmed.`,
      };
    case 'ja':
      return {
        title: '✅ 予約確定のお知らせ',
        message: `「${experienceTitle}」の入金が確認され、予約が確定しました。`,
      };
    case 'zh':
      return {
        title: '✅ 预约确认通知',
        message: `已确认「${experienceTitle}」的转账，预约现已确认。`,
      };
    case 'ko':
    default:
      return {
        title: '✅ 예약 확정 알림',
        message: `'${experienceTitle}' 입금이 확인되어 예약이 확정되었습니다.`,
      };
  }
}

function buildBookingReviewPendingCopy(
  locale: NotificationLocale,
  params: BookingReviewPendingParams
): NotificationCopy {
  const { experienceTitle, recipient, reviewType } = params;

  if (recipient === 'guest') {
    if (reviewType === 'minimum_participants_unmet') {
      switch (locale) {
        case 'en':
          return {
            title: 'Your cancellation review request was received.',
            message: `Your cancellation request for '${experienceTitle}' due to minimum participants not being met has been submitted for admin review.`,
          };
        case 'ja':
          return {
            title: '最低催行人数未達によるキャンセル審査依頼を受け付けました。',
            message: `「${experienceTitle}」の最低催行人数未達によるキャンセル依頼は、現在運営チームで確認中です。`,
          };
        case 'zh':
          return {
            title: '已收到最低成团人数未达的取消审核请求。',
            message: `「${experienceTitle}」因未达到最低成团人数的取消请求已提交给运营团队审核。`,
          };
        case 'ko':
        default:
          return {
            title: '최소 진행 인원 미달 취소 요청이 접수되었습니다.',
            message: `'${experienceTitle}' 예약의 최소 진행 인원 미달 취소 요청이 운영팀 검토 대기 상태로 접수되었습니다.`,
          };
      }
    }

    switch (locale) {
      case 'en':
        return {
          title: 'Your cancellation review request was received.',
          message: `Your cancellation request for '${experienceTitle}' has been submitted for admin review.`,
        };
      case 'ja':
        return {
          title: 'キャンセル審査依頼を受け付けました。',
          message: `「${experienceTitle}」のキャンセル依頼は、現在運営チームで確認中です。`,
        };
      case 'zh':
        return {
          title: '已收到取消审核请求。',
          message: `「${experienceTitle}」的取消请求已提交给运营团队审核。`,
        };
      case 'ko':
      default:
        return {
          title: '취소 요청이 접수되었습니다.',
          message: `'${experienceTitle}' 예약이 운영팀 검토 대기 상태로 접수되었습니다.`,
        };
    }
  }

  if (reviewType === 'minimum_participants_unmet') {
    switch (locale) {
      case 'en':
        return {
          title: 'Cancellation review request: minimum participants not met',
          message: `The guest requested admin review for '${experienceTitle}' due to minimum participants not being met.`,
        };
      case 'ja':
        return {
          title: '最低催行人数未達のキャンセル審査依頼',
          message: `「${experienceTitle}」について、ゲストが最低催行人数未達を理由に運営チームへ審査を依頼しました。`,
        };
      case 'zh':
        return {
          title: '最低成团人数未达取消审核请求',
          message: `关于「${experienceTitle}」，游客以未达到最低成团人数为由请求运营团队审核取消。`,
        };
      case 'ko':
      default:
        return {
          title: '최소 진행 인원 미달 취소 검토 요청',
          message: `'${experienceTitle}' 예약에 대해 고객이 최소 진행 인원 미달 사유로 운영팀 검토를 요청했습니다.`,
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: 'Cancellation review request: host unavailable',
        message: `The guest requested admin review for '${experienceTitle}'.`,
      };
    case 'ja':
      return {
        title: 'ホスト都合によるキャンセル審査依頼',
        message: `「${experienceTitle}」について、ゲストが運営チームへ審査を依頼しました。`,
      };
    case 'zh':
      return {
        title: '房东无法接待取消审核请求',
        message: `关于「${experienceTitle}」，游客已向运营团队提交审核请求。`,
      };
    case 'ko':
    default:
      return {
        title: '호스트 진행 불가 취소 검토 요청',
        message: `'${experienceTitle}' 예약에 대해 고객이 운영팀 검토를 요청했습니다.`,
      };
  }
}

function buildBookingCancelledCopy(
  locale: NotificationLocale,
  params: BookingCancelledParams
): NotificationCopy {
  const { experienceTitle, refundAmount, recipient } = params;
  const refundText = getRefundText(refundAmount, locale);

  if (recipient === 'host') {
    switch (locale) {
      case 'en':
        return {
          title: '😢 The booking was cancelled.',
          message: `[${experienceTitle}] The booking was cancelled. ${refundText}`,
        };
      case 'ja':
        return {
          title: '😢 予約がキャンセルされました。',
          message: `[${experienceTitle}] 予約がキャンセルされました。${refundText}`,
        };
      case 'zh':
        return {
          title: '😢 预约已取消。',
          message: `[${experienceTitle}] 预约已取消。${refundText}`,
        };
      case 'ko':
      default:
        return {
          title: '😢 예약이 취소되었습니다.',
          message: `[${experienceTitle}] 예약이 취소되었습니다. ${refundText}`,
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: 'The booking was cancelled.',
        message: `Your booking for '${experienceTitle}' was cancelled. ${refundText}`,
      };
    case 'ja':
      return {
        title: '予約がキャンセルされました。',
        message: `「${experienceTitle}」の予約がキャンセルされました。${refundText}`,
      };
    case 'zh':
      return {
        title: '预约已取消。',
        message: `「${experienceTitle}」的预约已取消。${refundText}`,
      };
    case 'ko':
    default:
      return {
        title: '예약이 취소되었습니다.',
        message: `'${experienceTitle}' 예약이 취소되었습니다. ${refundText}`,
      };
  }
}

function buildBookingAdminForceCancelledGuestCopy(
  locale: NotificationLocale,
  params: BookingAdminForceCancelledGuestParams
): NotificationCopy {
  const { experienceTitle, refundAmount } = params;
  const refundText = getRefundText(refundAmount, locale);

  switch (locale) {
    case 'en':
      return {
        title: 'The booking was cancelled.',
        message: `Your booking for '${experienceTitle}' was cancelled by the admin team. ${refundText}`,
      };
    case 'ja':
      return {
        title: '予約がキャンセルされました。',
        message: `「${experienceTitle}」の予約は運営チームによりキャンセルされました。${refundText}`,
      };
    case 'zh':
      return {
        title: '预约已取消。',
        message: `「${experienceTitle}」的预约已由运营团队取消。${refundText}`,
      };
    case 'ko':
    default:
      return {
        title: '예약이 취소되었습니다.',
        message: `'${experienceTitle}' 예약이 관리자에 의해 취소되었습니다. ${refundText}`,
      };
  }
}

function buildBookingHostFaultCancelledCopy(
  locale: NotificationLocale,
  params: BookingHostFaultCancelledParams
): NotificationCopy {
  const { experienceTitle, refundAmount, recipient, reviewType } = params;
  const refundText = getRefundText(refundAmount, locale);
  const reasonLabel = getReviewTypeLabel(reviewType, locale);

  if (recipient === 'host') {
    switch (locale) {
      case 'en':
        return {
          title: '😢 The booking was cancelled.',
          message: `[${experienceTitle}] The booking was cancelled due to ${reasonLabel}. ${refundText}`,
        };
      case 'ja':
        return {
          title: '😢 予約がキャンセルされました。',
          message: `[${experienceTitle}] 予約は${reasonLabel}のためキャンセル処理されました。${refundText}`,
        };
      case 'zh':
        return {
          title: '😢 预约已取消。',
          message: `[${experienceTitle}] 该预约因${reasonLabel}已被取消处理。${refundText}`,
        };
      case 'ko':
      default:
        return {
          title: '😢 예약이 취소되었습니다.',
          message: `[${experienceTitle}] 예약이 ${reasonLabel} 사유로 취소 처리되었습니다. ${refundText}`,
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: `The booking was cancelled due to ${reasonLabel}.`,
        message: `Your booking for '${experienceTitle}' was cancelled due to ${reasonLabel}. ${refundText}`,
      };
    case 'ja':
      return {
        title: `${reasonLabel}のため予約がキャンセルされました。`,
        message: `「${experienceTitle}」の予約は${reasonLabel}のためキャンセルされました。${refundText}`,
      };
    case 'zh':
      return {
        title: `预约因${reasonLabel}已取消。`,
        message: `「${experienceTitle}」的预约因${reasonLabel}已取消。${refundText}`,
      };
    case 'ko':
    default:
      return {
        title: `${reasonLabel}로 예약이 취소되었습니다.`,
        message: `[${experienceTitle}] 예약이 ${reasonLabel} 사유로 취소되었습니다. ${refundText}`,
      };
    }
}

function buildBookingReviewRejectedCopy(
  locale: NotificationLocale,
  params: BookingReviewRejectedParams
): NotificationCopy {
  const { experienceTitle, recipient, reviewType } = params;

  if (recipient === 'guest') {
    if (reviewType === 'minimum_participants_unmet') {
      switch (locale) {
        case 'en':
          return {
            title: 'The minimum-participants cancellation request was declined.',
            message: `Your booking for '${experienceTitle}' will stay active. Please contact the host directly if needed.`,
          };
        case 'ja':
          return {
            title: '最低催行人数未達によるキャンセル依頼は却下されました。',
            message: `「${experienceTitle}」の予約は維持されます。必要であればホストに直接ご連絡ください。`,
          };
        case 'zh':
          return {
            title: '最低成团人数未达的取消请求已被驳回。',
            message: `「${experienceTitle}」的预约将继续保留，如有需要请直接与房东沟通。`,
          };
        case 'ko':
        default:
          return {
            title: '최소 진행 인원 미달 취소 요청이 반려되었습니다.',
            message: `'${experienceTitle}' 예약은 유지되며, 필요 시 호스트와 직접 소통해주세요.`,
          };
      }
    }

    switch (locale) {
      case 'en':
        return {
          title: 'The host-unavailable cancellation request was declined.',
          message: `Your booking for '${experienceTitle}' will stay active. Please contact the host directly if needed.`,
        };
      case 'ja':
        return {
          title: 'ホスト都合によるキャンセル依頼は却下されました。',
          message: `「${experienceTitle}」の予約は維持されます。必要であればホストに直接ご連絡ください。`,
        };
      case 'zh':
        return {
          title: '房东无法接待的取消请求已被驳回。',
          message: `「${experienceTitle}」的预约将继续保留，如有需要请直接与房东沟通。`,
        };
      case 'ko':
      default:
        return {
          title: '호스트 진행 불가 취소 요청이 반려되었습니다.',
          message: `'${experienceTitle}' 예약은 유지되며, 필요 시 호스트와 직접 소통해주세요.`,
        };
    }
  }

  if (reviewType === 'minimum_participants_unmet') {
    switch (locale) {
      case 'en':
        return {
          title: 'The minimum-participants cancellation request was declined.',
          message: `The booking for '${experienceTitle}' remains active. Please coordinate with the guest directly.`,
        };
      case 'ja':
        return {
          title: '最低催行人数未達によるキャンセル依頼は却下されました。',
          message: `「${experienceTitle}」の予約は維持されます。ゲストと直接ご調整ください。`,
        };
      case 'zh':
        return {
          title: '最低成团人数未达的取消请求已被驳回。',
          message: `「${experienceTitle}」的预约将继续保留，请直接与游客沟通。`,
        };
      case 'ko':
      default:
        return {
          title: '최소 진행 인원 미달 취소 요청이 반려되었습니다.',
          message: `'${experienceTitle}' 예약은 유지됩니다. 고객과 직접 소통해주세요.`,
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: 'The host-unavailable cancellation request was declined.',
        message: `The booking for '${experienceTitle}' remains active. Please coordinate with the guest directly.`,
      };
    case 'ja':
      return {
        title: 'ホスト都合によるキャンセル依頼は却下されました。',
        message: `「${experienceTitle}」の予約は維持されます。ゲストと直接ご調整ください。`,
      };
    case 'zh':
      return {
        title: '房东无法接待的取消请求已被驳回。',
        message: `「${experienceTitle}」的预约将继续保留，请直接与游客沟通。`,
      };
    case 'ko':
    default:
      return {
        title: '호스트 진행 불가 취소 요청이 반려되었습니다.',
        message: `'${experienceTitle}' 예약은 유지됩니다. 고객과 직접 소통해주세요.`,
      };
  }
}

function buildInquiryNewMessageCopy(
  locale: NotificationLocale,
  params: InquiryNewMessageParams
): NotificationCopy {
  const { actorDisplayName, displayContent } = params;

  switch (locale) {
    case 'en':
      return {
        title: `💬 New message from ${actorDisplayName}`,
        message: displayContent,
      };
    case 'ja':
      return {
        title: `💬 ${actorDisplayName}さんから新しいメッセージ`,
        message: displayContent,
      };
    case 'zh':
      return {
        title: `💬 来自${actorDisplayName}的新消息`,
        message: displayContent,
      };
    case 'ko':
    default:
      return {
        title: `💬 ${actorDisplayName}님의 새 메시지`,
        message: displayContent,
      };
  }
}

function buildReviewNewHostCopy(
  locale: NotificationLocale,
  params: ReviewNewHostParams
): NotificationCopy {
  const { experienceTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: 'A new review was posted',
        message: `A new review was left for '${experienceTitle}'.`,
      };
    case 'ja':
      return {
        title: '新しいレビューが登録されました',
        message: `「${experienceTitle}」に新しいレビューが投稿されました。`,
      };
    case 'zh':
      return {
        title: '已收到新评价',
        message: `「${experienceTitle}」收到了新的评价。`,
      };
    case 'ko':
    default:
      return {
        title: '새 후기가 등록되었습니다',
        message: `'${experienceTitle}'에 새 후기가 작성되었습니다.`,
      };
  }
}

function buildServiceRequestNewHostCopy(
  locale: NotificationLocale,
  params: ServiceRequestNewHostParams
): NotificationCopy {
  const { requestTitle, requestCity, durationHours, guestCount } = params;

  switch (locale) {
    case 'en':
      return {
        title: `📋 New custom service request — ${requestCity}`,
        message: `${requestTitle} (${durationHours}h, ${guestCount} guest${guestCount === 1 ? '' : 's'})`,
      };
    case 'ja':
      return {
        title: `📋 新しいカスタムサービス依頼 — ${requestCity}`,
        message: `${requestTitle}（${durationHours}時間、${guestCount}名）`,
      };
    case 'zh':
      return {
        title: `📋 新的定制服务请求 — ${requestCity}`,
        message: `${requestTitle}（${durationHours}小时，${guestCount}人）`,
      };
    case 'ko':
    default:
      return {
        title: `📋 새로운 맞춤 서비스 의뢰 — ${requestCity}`,
        message: `${requestTitle} (${durationHours}시간, ${guestCount}명)`,
      };
  }
}

function buildServicePaymentConfirmedCustomerCopy(
  locale: NotificationLocale,
  params: ServicePaymentConfirmedCustomerParams
): NotificationCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: '✅ Payment completed',
        message: `Payment for '${requestTitle}' is complete, and host recruitment is now starting.`,
      };
    case 'ja':
      return {
        title: '✅ 決済が完了しました',
        message: `「${requestTitle}」の決済が完了し、現地ホストの募集が始まります。`,
      };
    case 'zh':
      return {
        title: '✅ 付款已完成',
        message: `「${requestTitle}」的付款已完成，现已开始招募当地房东。`,
      };
    case 'ko':
    default:
      return {
        title: '✅ 결제가 완료되었습니다',
        message: `'${requestTitle}' 결제가 완료되어 현지 호스트 모집이 시작됩니다.`,
      };
  }
}

function buildServiceApplicationNewCustomerCopy(
  locale: NotificationLocale,
  params: ServiceApplicationNewCustomerParams
): NotificationCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: '📩 A new host has applied',
        message: `A new host applied to '${requestTitle}'.`,
      };
    case 'ja':
      return {
        title: '📩 新しいホスト応募が届きました',
        message: `「${requestTitle}」に新しいホストが応募しました。`,
      };
    case 'zh':
      return {
        title: '📩 有新的房东申请',
        message: `「${requestTitle}」有新的房东提交了申请。`,
      };
    case 'ko':
    default:
      return {
        title: '📩 새로운 호스트 지원자가 있습니다!',
        message: `'${requestTitle}'에 새로운 호스트가 지원했습니다.`,
      };
  }
}

function buildServiceHostSelectedCopy(
  locale: NotificationLocale,
  params: ServiceHostSelectionParams
): NotificationCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: '🎉 You were selected by the guest',
        message: `You were selected for '${requestTitle}'. Payment is already complete, so you can start right away.`,
      };
    case 'ja':
      return {
        title: '🎉 ゲストに選ばれました！',
        message: `「${requestTitle}」で選ばれました。決済はすでに完了しているため、そのまま進行できます。`,
      };
    case 'zh':
      return {
        title: '🎉 你已被游客选中',
        message: `你已在「${requestTitle}」中被选中。付款已完成，可以立即开始准备。`,
      };
    case 'ko':
    default:
      return {
        title: '🎉 고객에게 선택되었습니다!',
        message: `'${requestTitle}' 의뢰에서 선택되셨습니다. 결제는 이미 완료되어 바로 진행됩니다.`,
      };
  }
}

function buildServiceHostRejectedCopy(
  locale: NotificationLocale,
  params: ServiceHostSelectionParams
): NotificationCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: 'Another host was selected.',
        message: `Another host was selected for '${requestTitle}'.`,
      };
    case 'ja':
      return {
        title: '別のホストが選ばれました。',
        message: `「${requestTitle}」では別のホストが選ばれました。`,
      };
    case 'zh':
      return {
        title: '已选择其他房东。',
        message: `「${requestTitle}」已选择其他房东。`,
      };
    case 'ko':
    default:
      return {
        title: '다른 호스트가 선택되었습니다.',
        message: `'${requestTitle}' 의뢰에서 다른 호스트가 선택되었습니다.`,
      };
  }
}

function buildServiceCancelRequestedCopy(
  locale: NotificationLocale,
  params: ServiceCancelRequestedParams
): NotificationCopy {
  const { requestTitle } = params;

  switch (locale) {
    case 'en':
      return {
        title: 'The cancellation request was received.',
        message: `A cancellation request for '${requestTitle}' was received. The admin team will review it shortly.`,
      };
    case 'ja':
      return {
        title: 'キャンセル依頼を受け付けました。',
        message: `「${requestTitle}」のキャンセル依頼を受け付けました。運営チームが確認のうえ対応します。`,
      };
    case 'zh':
      return {
        title: '已收到取消申请。',
        message: `已收到「${requestTitle}」的取消申请，运营团队会尽快审核处理。`,
      };
    case 'ko':
    default:
      return {
        title: '취소 요청이 접수되었습니다.',
        message: `'${requestTitle}' 서비스 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
      };
  }
}

function buildServiceCancelledCopy(
  locale: NotificationLocale,
  params: ServiceCancelledParams
): NotificationCopy {
  const { requestTitle, refundAmount } = params;
  const refundText = getServiceRefundText(refundAmount, locale);

  switch (locale) {
    case 'en':
      return {
        title: 'The service was cancelled.',
        message: `The service '${requestTitle}' was cancelled.${refundText}`,
      };
    case 'ja':
      return {
        title: 'サービスがキャンセルされました。',
        message: `「${requestTitle}」サービスがキャンセルされました。${refundText.trimStart()}`,
      };
    case 'zh':
      return {
        title: '服务已取消。',
        message: `「${requestTitle}」服务已取消。${refundText.trimStart()}`,
      };
    case 'ko':
    default:
      return {
        title: '서비스가 취소되었습니다.',
        message: `'${requestTitle}' 서비스가 취소되었습니다.${refundText}`,
      };
  }
}

function buildMembershipCopy(
  locale: NotificationLocale,
  params: MembershipParams
): NotificationCopy {
  if (params.status === 'circle') {
    switch (locale) {
      case 'en':
        return {
          title: '🌙 Welcome to Tier 2',
          message: 'Thanks for coming back. You now get closer support and earlier updates.',
        };
      case 'ja':
        return {
          title: '🌙 Tier 2へようこそ',
          message: '再びご利用いただきありがとうございます。より近いサポートと先行案内を受けられます。',
        };
      case 'zh':
        return {
          title: '🌙 欢迎来到 Tier 2',
          message: '感谢再次回来。你现在可以获得更贴近的支持和更早的通知。',
        };
      case 'ko':
      default:
        return {
          title: '🌙 Tier 2에 오신 것을 환영합니다',
          message: '다시 찾아와 주셔서 감사합니다. 더 가까운 케어와 우선 안내가 이어집니다.',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: '✨ Tier 1 is now open',
        message: 'Your first purchase is complete, and your connection with Locally has started.',
      };
    case 'ja':
      return {
        title: '✨ Tier 1が開きました',
        message: '最初の購入が完了し、Locallyとのつながりが始まりました。',
      };
    case 'zh':
      return {
        title: '✨ Tier 1 已开启',
        message: '你的首次购买已完成，你与 Locally 的连接已经开始。',
      };
    case 'ko':
    default:
      return {
        title: '✨ Tier 1이 열렸습니다',
        message: '첫 구매가 완료되며 로컬리와의 연결이 시작됐어요.',
      };
  }
}

function buildHostApplicationStatusCopy(
  locale: NotificationLocale,
  key: 'host_application.approved' | 'host_application.revision' | 'host_application.rejected',
  params: HostApplicationStatusParams
): NotificationCopy {
  const trimmedComment = params.comment?.trim();

  if (key === 'host_application.approved') {
    switch (locale) {
      case 'en':
        return {
          title: '🎉 Your host application is approved',
          message: 'Your host application has been approved. You can now use the host dashboard and features.',
        };
      case 'ja':
        return {
          title: '🎉 ホスト承認が完了しました',
          message: 'ホスト申請が承認されました。これからホストダッシュボードと各機能をご利用いただけます。',
        };
      case 'zh':
        return {
          title: '🎉 你的房东申请已通过',
          message: '你的房东申请已获批准，现在可以使用房东后台和相关功能。',
        };
      case 'ko':
      default:
        return {
          title: '🎉 호스트 승인이 완료되었습니다',
          message: '호스트 신청이 승인되었습니다. 이제 호스트 대시보드와 기능을 이용할 수 있습니다.',
        };
    }
  }

  if (key === 'host_application.revision') {
    switch (locale) {
      case 'en':
        return {
          title: '🛠️ Your host application needs revision',
          message: trimmedComment
            ? `Please review the admin comment and update your application.\n\nReason: ${trimmedComment}`
            : 'Please review the admin comment and update your application.',
        };
      case 'ja':
        return {
          title: '🛠️ ホスト申請の補完が必要です',
          message: trimmedComment
            ? `管理者コメントを確認し、申請内容を補完してください。\n\n補完理由: ${trimmedComment}`
            : '管理者コメントを確認し、申請内容を補完してください。',
        };
      case 'zh':
        return {
          title: '🛠️ 你的房东申请需要补充',
          message: trimmedComment
            ? `请查看管理员备注并补充你的申请内容。\n\n补充原因：${trimmedComment}`
            : '请查看管理员备注并补充你的申请内容。',
        };
      case 'ko':
      default:
        return {
          title: '🛠️ 호스트 지원서 보완이 필요합니다',
          message: trimmedComment
            ? `관리자 코멘트를 확인하고 지원서를 보완해 주세요.\n\n보완 사유: ${trimmedComment}`
            : '관리자 코멘트를 확인하고 지원서를 보완해 주세요.',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: '📌 Please review your host application result',
        message: trimmedComment
          ? `This host application was not approved.\n\nReason: ${trimmedComment}`
          : 'This host application was not approved.',
      };
    case 'ja':
      return {
        title: '📌 ホスト申請結果をご確認ください',
        message: trimmedComment
          ? `今回のホスト申請は承認されませんでした。\n\n理由: ${trimmedComment}`
          : '今回のホスト申請は承認されませんでした。',
      };
    case 'zh':
      return {
        title: '📌 请查看你的房东申请结果',
        message: trimmedComment
          ? `本次房东申请未获批准。\n\n原因：${trimmedComment}`
          : '本次房东申请未获批准。',
      };
    case 'ko':
    default:
      return {
        title: '📌 호스트 지원 결과를 확인해 주세요',
        message: trimmedComment
          ? `이번 호스트 신청은 승인되지 않았습니다.\n\n사유: ${trimmedComment}`
          : '이번 호스트 신청은 승인되지 않았습니다.',
      };
  }
}

export function buildNotificationCopy<K extends NotificationCopyKey>(
  key: K,
  locale: NotificationLocale,
  copyParams: NotificationCopyParams[K]
): NotificationCopy {
  switch (key) {
    case 'booking.new.host':
      return buildBookingNewHostCopy(locale, copyParams as NotificationCopyParams['booking.new.host']);
    case 'booking.confirmed.host':
      return buildBookingConfirmedHostCopy(locale, copyParams as NotificationCopyParams['booking.confirmed.host']);
    case 'booking.confirmed.guest':
      return buildBookingConfirmedGuestCopy(locale, copyParams as NotificationCopyParams['booking.confirmed.guest']);
    case 'booking.bank_confirmed.host':
      return buildBookingBankConfirmedHostCopy(locale, copyParams as NotificationCopyParams['booking.bank_confirmed.host']);
    case 'booking.bank_confirmed.guest':
      return buildBookingBankConfirmedGuestCopy(locale, copyParams as NotificationCopyParams['booking.bank_confirmed.guest']);
    case 'booking.review_pending':
      return buildBookingReviewPendingCopy(locale, copyParams as NotificationCopyParams['booking.review_pending']);
    case 'booking.cancelled':
      return buildBookingCancelledCopy(locale, copyParams as NotificationCopyParams['booking.cancelled']);
    case 'booking.cancelled.admin_force.guest':
      return buildBookingAdminForceCancelledGuestCopy(
        locale,
        copyParams as NotificationCopyParams['booking.cancelled.admin_force.guest']
      );
    case 'booking.cancelled.host_fault':
      return buildBookingHostFaultCancelledCopy(locale, copyParams as NotificationCopyParams['booking.cancelled.host_fault']);
    case 'booking.review_rejected':
      return buildBookingReviewRejectedCopy(locale, copyParams as NotificationCopyParams['booking.review_rejected']);
    case 'inquiry.new_message':
      return buildInquiryNewMessageCopy(locale, copyParams as NotificationCopyParams['inquiry.new_message']);
    case 'review.new.host':
      return buildReviewNewHostCopy(locale, copyParams as NotificationCopyParams['review.new.host']);
    case 'service.request_new.host':
      return buildServiceRequestNewHostCopy(locale, copyParams as NotificationCopyParams['service.request_new.host']);
    case 'service.payment_confirmed.customer':
      return buildServicePaymentConfirmedCustomerCopy(
        locale,
        copyParams as NotificationCopyParams['service.payment_confirmed.customer']
      );
    case 'service.application_new.customer':
      return buildServiceApplicationNewCustomerCopy(
        locale,
        copyParams as NotificationCopyParams['service.application_new.customer']
      );
    case 'service.host_selected':
      return buildServiceHostSelectedCopy(locale, copyParams as NotificationCopyParams['service.host_selected']);
    case 'service.host_rejected':
      return buildServiceHostRejectedCopy(locale, copyParams as NotificationCopyParams['service.host_rejected']);
    case 'service.cancel_requested':
      return buildServiceCancelRequestedCopy(locale, copyParams as NotificationCopyParams['service.cancel_requested']);
    case 'service.cancelled':
      return buildServiceCancelledCopy(locale, copyParams as NotificationCopyParams['service.cancelled']);
    case 'membership.member_welcome':
      return buildMembershipCopy(locale, { ...(copyParams as NotificationCopyParams['membership.member_welcome']), status: 'member' });
    case 'membership.circle_welcome':
      return buildMembershipCopy(locale, { ...(copyParams as NotificationCopyParams['membership.circle_welcome']), status: 'circle' });
    case 'host_application.approved':
    case 'host_application.revision':
    case 'host_application.rejected':
      return buildHostApplicationStatusCopy(
        locale,
        key,
        copyParams as NotificationCopyParams['host_application.approved']
      );
    default:
      return {
        title: '',
        message: '',
      };
  }
}

export async function buildLocalizedNotificationInsert<K extends NotificationCopyKey>(
  input: LocalizedNotificationInsertInput<K>
) {
  const locale = await resolveRecipientLocale(input.supabaseAdmin, input.userId);
  const copy = buildNotificationCopy(input.key, locale, input.copyParams);

  return {
    user_id: input.userId,
    type: input.type,
    title: copy.title,
    message: copy.message,
    link: input.link,
    is_read: false as const,
  };
}
