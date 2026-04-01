import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  resolveRecipientLocale,
  type NotificationLocale,
} from '@/app/utils/notificationLocale';

type AdminClient = ReturnType<typeof createAdminClient>;

type ReviewNewHostParams = {
  experienceTitle: string;
};

type MembershipParams = {
  status: 'member' | 'circle';
};

type HostApplicationStatusParams = {
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

type ProxyPaymentParams = {
  requestTitle: string;
};

type ProxyCommentReplyParams = {
  content: string;
};

export type EmailCopy = {
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
};

export type EmailCopyKey =
  | 'review.new.host'
  | 'membership.member_welcome'
  | 'membership.circle_welcome'
  | 'host_application.approved'
  | 'host_application.revision'
  | 'host_application.rejected'
  | 'service.request_new.host'
  | 'service.payment_confirmed.customer'
  | 'service.application_new.customer'
  | 'service.host_selected'
  | 'service.cancel_requested'
  | 'service.cancelled'
  | 'proxy.payment_confirmed'
  | 'proxy.payment_cancelled'
  | 'proxy.payment_refunded'
  | 'proxy.comment_reply';

type EmailCopyParams = {
  'review.new.host': ReviewNewHostParams;
  'membership.member_welcome': MembershipParams;
  'membership.circle_welcome': MembershipParams;
  'host_application.approved': HostApplicationStatusParams;
  'host_application.revision': HostApplicationStatusParams;
  'host_application.rejected': HostApplicationStatusParams;
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

function formatKrw(amount: number) {
  return `₩${Math.max(0, amount).toLocaleString('en-US')}`;
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

export function buildEmailCopy<K extends EmailCopyKey>(
  key: K,
  locale: NotificationLocale,
  copyParams: EmailCopyParams[K]
): EmailCopy {
  switch (key) {
    case 'review.new.host':
      return buildReviewNewHostEmailCopy(locale, copyParams as EmailCopyParams['review.new.host']);
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
