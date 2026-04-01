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
  | 'host_application.rejected';

type EmailCopyParams = {
  'review.new.host': ReviewNewHostParams;
  'membership.member_welcome': MembershipParams;
  'membership.circle_welcome': MembershipParams;
  'host_application.approved': HostApplicationStatusParams;
  'host_application.revision': HostApplicationStatusParams;
  'host_application.rejected': HostApplicationStatusParams;
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
