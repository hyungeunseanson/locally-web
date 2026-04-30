import {
  buildBookingCancellationTemplateEmailCopy,
  buildBookingConfirmationTemplateEmailCopy,
} from '@/app/utils/bookingTemplateEmailCopy';
import { buildEmailCopy } from '@/app/utils/emailCopy';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import { defaultHelpCopyByLocale } from '@/app/emails/theme/variants';
import type {
  BookingCancelledTemplateProps,
  BookingConfirmedTemplateProps,
  EmailLocale,
  EmailSummaryItem,
  HostApplicationStatusTemplateProps,
  InquiryNewMessageTemplateProps,
  NoticeTemplateProps,
  ServicePaymentConfirmedTemplateProps,
  EmailBuilderContext,
} from './emailTypes';

function formatCurrency(amount: number | undefined, locale: EmailLocale) {
  const safeAmount = amount ?? 0;
  const localeMap: Record<EmailLocale, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };

  return `₩${safeAmount.toLocaleString(localeMap[locale])}`;
}

function buildScheduleValue(date: string, time?: string) {
  return [date, time].filter(Boolean).join(' ');
}

function buildBookingLabels(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return {
        experience: 'Experience',
        guest: 'Guest',
        schedule: 'Schedule',
        partySize: 'Guests',
        amount: 'Amount',
        reason: 'Reason',
        refund: 'Refund',
        actor: 'Sender',
        thread: 'Thread',
      };
    case 'ja':
      return {
        experience: '体験',
        guest: 'ゲスト',
        schedule: '日程',
        partySize: '人数',
        amount: '決済金額',
        reason: 'キャンセル理由',
        refund: '返金額',
        actor: '送信者',
        thread: 'スレッド',
      };
    case 'zh':
      return {
        experience: '体验',
        guest: '客人',
        schedule: '日期',
        partySize: '人数',
        amount: '支付金额',
        reason: '取消原因',
        refund: '退款金额',
        actor: '发送者',
        thread: '会话',
      };
    case 'ko':
    default:
      return {
        experience: '체험',
        guest: '게스트',
        schedule: '일정',
        partySize: '인원',
        amount: '결제 금액',
        reason: '취소 사유',
        refund: '환불 금액',
        actor: '보낸 사람',
        thread: '문의',
      };
  }
}

function buildInquiryDescription(locale: EmailLocale, threadTitle?: string) {
  if (threadTitle?.trim()) return threadTitle.trim();

  switch (locale) {
    case 'en':
      return 'A new message arrived. Open the conversation to reply quickly.';
    case 'ja':
      return '新しいメッセージが届きました。会話を開いてすぐに返信できます。';
    case 'zh':
      return '你收到了新消息。打开会话即可快速回复。';
    case 'ko':
    default:
      return '새 메시지가 도착했습니다. 대화를 열어 바로 답장해보세요.';
  }
}

function buildSummaryItems(items: Array<EmailSummaryItem | null | undefined>) {
  return items.filter((item): item is EmailSummaryItem => Boolean(item));
}

function buildBookingSummaryTitle(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Booking details';
    case 'ja':
      return '予約情報';
    case 'zh':
      return '预订信息';
    case 'ko':
    default:
      return '예약 정보';
  }
}

function buildConversationSummaryTitle(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Conversation details';
    case 'ja':
      return '会話情報';
    case 'zh':
      return '对话信息';
    case 'ko':
    default:
      return '대화 정보';
  }
}

function buildMessagePreviewTitle(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Latest message';
    case 'ja':
      return '最新メッセージ';
    case 'zh':
      return '最新消息';
    case 'ko':
    default:
      return '새 메시지';
  }
}

function buildServiceSummaryTitle(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Request details';
    case 'ja':
      return '依頼情報';
    case 'zh':
      return '请求信息';
    case 'ko':
    default:
      return '요청 정보';
  }
}

function buildHostNotificationSummaryTitle(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Notification details';
    case 'ja':
      return '通知内容';
    case 'zh':
      return '通知详情';
    case 'ko':
    default:
      return '알림 정보';
  }
}

function buildHostActionLabels(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return {
        experience: 'Experience',
        request: 'Request',
        status: 'Status',
        city: 'Area',
        duration: 'Duration',
        guestCount: 'Guests',
      };
    case 'ja':
      return {
        experience: '体験',
        request: '依頼',
        status: '状態',
        city: 'エリア',
        duration: '時間',
        guestCount: '人数',
      };
    case 'zh':
      return {
        experience: '体验',
        request: '请求',
        status: '状态',
        city: '地区',
        duration: '时长',
        guestCount: '人数',
      };
    case 'ko':
    default:
      return {
        experience: '체험',
        request: '의뢰',
        status: '상태',
        city: '지역',
        duration: '진행 시간',
        guestCount: '인원',
      };
  }
}

function buildDurationValue(locale: EmailLocale, durationHours: number) {
  switch (locale) {
    case 'en':
      return `${durationHours}h`;
    case 'ja':
      return `${durationHours}時間`;
    case 'zh':
      return `${durationHours}小时`;
    case 'ko':
    default:
      return `${durationHours}시간`;
  }
}

function buildGuestCountValue(locale: EmailLocale, guestCount: number) {
  switch (locale) {
    case 'en':
      return `${guestCount} ${guestCount === 1 ? 'guest' : 'guests'}`;
    case 'ja':
      return `${guestCount}名`;
    case 'zh':
      return `${guestCount}人`;
    case 'ko':
    default:
      return `${guestCount}명`;
  }
}

function buildHostStatusLabel(
  locale: EmailLocale,
  key: 'review' | 'bankConfirmed' | 'newRequest' | 'selected'
) {
  const labels = {
    review: {
      ko: '후기 알림',
      en: 'New review',
      ja: 'レビュー通知',
      zh: '评价通知',
    },
    bankConfirmed: {
      ko: '입금 확인',
      en: 'Payment confirmed',
      ja: '入金確認',
      zh: '收款确认',
    },
    newRequest: {
      ko: '새 의뢰',
      en: 'New request',
      ja: '新規依頼',
      zh: '新请求',
    },
    selected: {
      ko: '선택됨',
      en: 'Selected',
      ja: '選択済み',
      zh: '已选中',
    },
  } as const;

  return labels[key][locale];
}

function buildNoticeBodyCardTitle(locale: EmailLocale, audience: 'guest' | 'host' | 'admin') {
  if (audience === 'admin') {
    switch (locale) {
      case 'en':
        return 'What to check';
      case 'ja':
        return '確認内容';
      case 'zh':
        return '确认内容';
      case 'ko':
      default:
        return '확인 내용';
    }
  }

  switch (locale) {
    case 'en':
      return 'Details';
    case 'ja':
      return 'ご案内内容';
    case 'zh':
      return '详细内容';
    case 'ko':
    default:
      return '안내 내용';
  }
}

function buildBookingConfirmedStatusLabel(locale: EmailLocale, audience: 'guest' | 'host' | 'admin') {
  if (audience === 'host') {
    switch (locale) {
      case 'en':
        return 'New booking';
      case 'ja':
        return '新規予約';
      case 'zh':
        return '新预订';
      case 'ko':
      default:
        return '예약 접수';
    }
  }

  switch (locale) {
    case 'en':
      return 'Confirmed';
    case 'ja':
      return '予約確定';
    case 'zh':
      return '已确认';
    case 'ko':
    default:
      return '예약 확정';
  }
}

function buildBookingCancelledStatusLabel(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Cancelled';
    case 'ja':
      return 'キャンセル';
    case 'zh':
      return '已取消';
    case 'ko':
    default:
      return '예약 취소';
  }
}

function buildHostApplicationStatusLabel(
  locale: EmailLocale,
  status: 'approved' | 'revision' | 'rejected'
) {
  if (status === 'approved') {
    switch (locale) {
      case 'en':
        return 'Approved';
      case 'ja':
        return '承認完了';
      case 'zh':
        return '已通过';
      case 'ko':
      default:
        return '승인 완료';
    }
  }

  if (status === 'revision') {
    switch (locale) {
      case 'en':
        return 'Revision needed';
      case 'ja':
        return '補完が必要';
      case 'zh':
        return '需要补充';
      case 'ko':
      default:
        return '보완 필요';
    }
  }

  switch (locale) {
    case 'en':
      return 'Not approved';
    case 'ja':
      return '未承認';
    case 'zh':
      return '未通过';
    case 'ko':
    default:
      return '미승인';
  }
}

function buildServicePaymentStatusLabel(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Payment complete';
    case 'ja':
      return '決済完了';
    case 'zh':
      return '支付完成';
    case 'ko':
    default:
      return '결제 완료';
  }
}

// Ownership rule:
// - emailTypes.ts owns template ids and payload contracts.
// - emailContentBuilders.ts owns localized subject/preheader/body/CTA derivation.
// - emailTemplates.ts owns the component registration.
// Callers must not inline subject/body/CTA for templated emails.

export function buildBookingConfirmedTemplateProps({
  audience,
  locale,
  payload,
}: EmailBuilderContext<'booking.confirmed'>): BookingConfirmedTemplateProps {
  const labels = buildBookingLabels(locale);
  const helpCopy = defaultHelpCopyByLocale[locale];

  if (audience === 'guest') {
    const copy = buildEmailCopy('booking.confirmed.guest', locale, {
      experienceTitle: payload.experienceTitle,
    });

    return {
      locale,
      subject: copy.subject,
      preheader: copy.message,
      title: copy.title,
      description: copy.message,
      summaryTitle: buildBookingSummaryTitle(locale),
      statusLabel: buildBookingConfirmedStatusLabel(locale, audience),
      statusTone: 'success',
      ctaLabel: copy.ctaLabel,
      ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
      summaryItems: buildSummaryItems([
        { label: labels.experience, value: payload.experienceTitle, emphasis: true },
        { label: labels.schedule, value: buildScheduleValue(payload.bookingDate, payload.bookingTime) },
        { label: labels.partySize, value: String(payload.partySize) },
        { label: labels.amount, value: formatCurrency(payload.amount, locale), emphasis: true },
      ]),
      helpPrompt: helpCopy.helpPrompt,
      helpLinkLabel: helpCopy.helpLinkLabel,
      helpLinkHref: helpCopy.helpLinkHref,
      footerVariant: 'transactional',
    };
  }

  const copy = buildBookingConfirmationTemplateEmailCopy(locale, {
    experienceTitle: payload.experienceTitle,
  });
  const resolvedRecipientName = payload.recipientName || copy.fallbackHostName;

  return {
    locale,
    subject: copy.subject,
    preheader: copy.previewText,
    title:
      locale === 'ko'
        ? '예약 확정. 게스트에게 메시지를 보내주세요'
        : locale === 'ja'
          ? '予約確定。ゲストにメッセージを送ってください'
          : locale === 'zh'
            ? '预订已确认，请给客人发消息'
            : 'Booking confirmed. Please message the guest',
    description: `${copy.greetingPrefix}${resolvedRecipientName}${copy.greetingSuffix} ${copy.introText}`,
    summaryTitle: buildBookingSummaryTitle(locale),
    statusLabel: buildBookingConfirmedStatusLabel(locale, audience),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.experience, value: payload.experienceTitle, emphasis: true },
      {
        label: copy.bookingDateLabel,
        value: buildScheduleValue(payload.bookingDate, payload.bookingTime),
      },
      payload.guestName ? { label: labels.guest, value: payload.guestName } : null,
      {
        label: copy.guestCountLabel,
        value: `${payload.partySize}${copy.guestCountSuffix}`,
      },
      {
        label: copy.totalAmountLabel,
        value: formatCurrency(payload.amount, locale),
        emphasis: true,
      },
    ]),
    helperText: copy.helperText,
    helpPrompt: copy.layout.helpPrompt,
    helpLinkLabel: copy.layout.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildBookingCancelledTemplateProps({
  audience,
  locale,
  payload,
}: EmailBuilderContext<'booking.cancelled'>): BookingCancelledTemplateProps {
  const labels = buildBookingLabels(locale);
  const helpCopy = defaultHelpCopyByLocale[locale];

  if (audience === 'guest') {
    const emailKey =
      payload.variant === 'admin_force'
        ? 'booking.cancelled.admin_force.guest'
        : payload.variant === 'host_fault'
          ? 'booking.cancelled.host_fault.guest'
          : 'booking.cancelled.guest';

    const copy = buildEmailCopy(emailKey, locale, {
      experienceTitle: payload.experienceTitle,
      refundAmount: payload.refundAmount ?? 0,
      reviewType: payload.reviewType ?? 'host_unavailable',
    });

    return {
      locale,
      subject: copy.subject,
      preheader: copy.message,
      title: copy.title,
      description: copy.message,
      summaryTitle: buildBookingSummaryTitle(locale),
      statusLabel: buildBookingCancelledStatusLabel(locale),
      statusTone: 'danger',
      ctaLabel: copy.ctaLabel,
      ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
      summaryItems: buildSummaryItems([
        { label: labels.experience, value: payload.experienceTitle, emphasis: true },
        payload.reason ? { label: labels.reason, value: payload.reason } : null,
        {
          label: labels.refund,
          value: formatCurrency(payload.refundAmount, locale),
          emphasis: true,
        },
      ]),
      helpPrompt: helpCopy.helpPrompt,
      helpLinkLabel: helpCopy.helpLinkLabel,
      helpLinkHref: helpCopy.helpLinkHref,
      footerVariant: 'transactional',
    };
  }

  const copy = buildBookingCancellationTemplateEmailCopy(locale, {
    experienceTitle: payload.experienceTitle,
  });
  const resolvedRecipientName = payload.recipientName || copy.fallbackHostName;
  const resolvedReason = payload.reason || copy.fallbackCancelReason;

  return {
    locale,
    subject: copy.subject,
    preheader: copy.previewText,
    title:
      locale === 'ko'
        ? '예약이 취소되었습니다'
        : locale === 'ja'
          ? '予約がキャンセルされました'
          : locale === 'zh'
            ? '预订已取消'
            : 'The booking was cancelled',
    description: `${copy.greetingPrefix}${resolvedRecipientName}${copy.greetingSuffix} ${copy.introPrefix} [${payload.experienceTitle}] ${copy.introSuffix}`,
    summaryTitle: buildBookingSummaryTitle(locale),
    statusLabel: buildBookingCancelledStatusLabel(locale),
    statusTone: 'danger',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.experience, value: payload.experienceTitle, emphasis: true },
      { label: copy.cancelReasonLabel, value: resolvedReason },
      {
        label: copy.refundAmountLabel,
        value: formatCurrency(payload.refundAmount, locale),
        emphasis: true,
      },
    ]),
    helperText: copy.helperText,
    helpPrompt: copy.layout.helpPrompt,
    helpLinkLabel: copy.layout.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildInquiryNewMessageTemplateProps({
  audience,
  locale,
  payload,
}: EmailBuilderContext<'inquiry.new_message'>): InquiryNewMessageTemplateProps {
  const labels = buildBookingLabels(locale);
  const helpCopy = defaultHelpCopyByLocale[locale];
  const copy = buildEmailCopy('inquiry.new_message', locale, {
    actorDisplayName: payload.actorName,
    displayContent: payload.messagePreview,
  });

  return {
    locale,
    subject: copy.subject,
    preheader: payload.messagePreview,
    title: copy.title,
    description: buildInquiryDescription(locale, payload.threadTitle),
    summaryTitle: buildConversationSummaryTitle(locale),
    messagePreviewTitle: buildMessagePreviewTitle(locale),
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    messagePreview: payload.messagePreview,
    summaryItems: buildSummaryItems([
      { label: labels.actor, value: payload.actorName, emphasis: true },
      payload.threadTitle ? { label: labels.thread, value: payload.threadTitle } : null,
    ]),
    helpPrompt: audience === 'admin' ? undefined : helpCopy.helpPrompt,
    helpLinkLabel: audience === 'admin' ? undefined : helpCopy.helpLinkLabel,
    helpLinkHref: audience === 'admin' ? undefined : helpCopy.helpLinkHref,
    footerVariant: audience === 'admin' ? 'opsAdmin' : 'transactional',
  };
}

function buildHostApplicationKey(status: 'approved' | 'revision' | 'rejected') {
  switch (status) {
    case 'approved':
      return 'host_application.approved' as const;
    case 'revision':
      return 'host_application.revision' as const;
    case 'rejected':
    default:
      return 'host_application.rejected' as const;
  }
}

function stripEmojiPrefix(value: string) {
  return value.replace(/^\[Locally\]\s*/u, '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function splitPrimaryAndNote(message: string) {
  const [primary, ...rest] = message.split('\n\n');
  return {
    primary: primary.trim(),
    note: rest.join('\n\n').trim(),
  };
}

function buildHostApplicationStatusTone(
  status: 'approved' | 'revision' | 'rejected'
) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'revision':
      return 'warning' as const;
    case 'rejected':
    default:
      return 'danger' as const;
  }
}

function buildHostApplicationEyebrow(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return 'Host application';
    case 'ja':
      return 'ホスト申請';
    case 'zh':
      return '房东申请';
    case 'ko':
    default:
      return '호스트 신청';
  }
}

function buildServiceLabels(locale: EmailLocale) {
  switch (locale) {
    case 'en':
      return {
        request: 'Request',
        status: 'Status',
        nextStep: 'Next step',
        nextStepValue: 'Local host recruitment is starting now.',
      };
    case 'ja':
      return {
        request: '依頼',
        status: '状態',
        nextStep: '次のステップ',
        nextStepValue: 'これから現地ホストの募集が始まります。',
      };
    case 'zh':
      return {
        request: '请求',
        status: '状态',
        nextStep: '下一步',
        nextStepValue: '现在将开始招募当地房东。',
      };
    case 'ko':
    default:
      return {
        request: '의뢰',
        status: '상태',
        nextStep: '다음 단계',
        nextStepValue: '이제 현지 호스트 모집이 시작됩니다.',
      };
  }
}

export function buildHostApplicationStatusTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'host_application.status'>): HostApplicationStatusTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const key = buildHostApplicationKey(payload.status);
  const copy = buildEmailCopy(key, locale, {
    comment: payload.note,
  });
  const splitMessage = splitPrimaryAndNote(copy.message);

  return {
    locale,
    subject: copy.subject,
    preheader: splitMessage.primary || copy.message,
    eyebrow: buildHostApplicationEyebrow(locale),
    title: stripEmojiPrefix(copy.title),
    description: splitMessage.primary || copy.message,
    statusLabel: buildHostApplicationStatusLabel(locale, payload.status),
    statusTone: buildHostApplicationStatusTone(payload.status),
    note: payload.note || splitMessage.note || undefined,
    noteTitle:
      payload.status === 'revision'
        ? locale === 'ko'
          ? '보완 사유'
          : locale === 'ja'
            ? '補完理由'
            : locale === 'zh'
              ? '补充原因'
              : 'Reason'
        : payload.status === 'rejected'
          ? locale === 'ko'
            ? '사유'
            : locale === 'ja'
              ? '理由'
              : locale === 'zh'
                ? '原因'
                : 'Reason'
          : undefined,
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildServicePaymentConfirmedTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'service.payment_confirmed'>): ServicePaymentConfirmedTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const copy = buildEmailCopy('service.payment_confirmed.customer', locale, {
    requestTitle: payload.requestTitle,
  });
  const labels = buildServiceLabels(locale);

  return {
    locale,
    subject: copy.subject,
    preheader: copy.message,
    eyebrow:
      locale === 'ko'
        ? '서비스 요청'
        : locale === 'ja'
          ? 'サービス依頼'
          : locale === 'zh'
            ? '服务请求'
            : 'Service request',
    title: copy.title,
    description: copy.message,
    summaryTitle: buildServiceSummaryTitle(locale),
    statusLabel: buildServicePaymentStatusLabel(locale),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.request, value: payload.requestTitle, emphasis: true },
      { label: labels.status, value: copy.title },
      payload.amount != null
        ? { label: labels.nextStep, value: `${labels.nextStepValue}\n${formatCurrency(payload.amount, locale)}` }
        : { label: labels.nextStep, value: labels.nextStepValue },
    ]),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildReviewNewHostTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'review.new_host'>): BookingConfirmedTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const labels = buildHostActionLabels(locale);
  const copy = buildEmailCopy('review.new.host', locale, {
    experienceTitle: payload.experienceTitle,
  });

  return {
    locale,
    subject: copy.subject,
    preheader: copy.message,
    title: copy.title,
    description: copy.message,
    summaryTitle: buildHostNotificationSummaryTitle(locale),
    statusLabel: buildHostStatusLabel(locale, 'review'),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.experience, value: payload.experienceTitle, emphasis: true },
      { label: labels.status, value: copy.title },
    ]),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildBookingBankConfirmedHostTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'booking.bank_confirmed_host'>): BookingConfirmedTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const labels = buildHostActionLabels(locale);
  const copy = buildEmailCopy('booking.bank_confirmed.host', locale, {
    experienceTitle: payload.experienceTitle,
    guestName: payload.guestName,
  });

  return {
    locale,
    subject: copy.subject,
    preheader: copy.message,
    title: copy.title,
    description: copy.message,
    summaryTitle: buildBookingSummaryTitle(locale),
    statusLabel: buildHostStatusLabel(locale, 'bankConfirmed'),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.experience, value: payload.experienceTitle, emphasis: true },
      { label: labels.status, value: copy.title },
    ]),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildServiceRequestNewHostTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'service.request_new_host'>): ServicePaymentConfirmedTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const labels = buildHostActionLabels(locale);
  const copy = buildEmailCopy('service.request_new.host', locale, {
    requestTitle: payload.requestTitle,
    requestCity: payload.requestCity,
    durationHours: payload.durationHours,
    guestCount: payload.guestCount,
  });

  return {
    locale,
    subject: copy.subject,
    preheader: copy.message,
    title: copy.title,
    description: copy.message,
    summaryTitle: buildServiceSummaryTitle(locale),
    statusLabel: buildHostStatusLabel(locale, 'newRequest'),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.request, value: payload.requestTitle, emphasis: true },
      { label: labels.city, value: payload.requestCity },
      { label: labels.duration, value: buildDurationValue(locale, payload.durationHours) },
      { label: labels.guestCount, value: buildGuestCountValue(locale, payload.guestCount) },
    ]),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildServiceHostSelectedTemplateProps({
  locale,
  payload,
}: EmailBuilderContext<'service.host_selected'>): ServicePaymentConfirmedTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const labels = buildHostActionLabels(locale);
  const copy = buildEmailCopy('service.host_selected', locale, {
    requestTitle: payload.requestTitle,
  });

  return {
    locale,
    subject: copy.subject,
    preheader: copy.message,
    title: copy.title,
    description: copy.message,
    summaryTitle: buildServiceSummaryTitle(locale),
    statusLabel: buildHostStatusLabel(locale, 'selected'),
    statusTone: 'success',
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.request, value: payload.requestTitle, emphasis: true },
      { label: labels.status, value: copy.title },
    ]),
    helpPrompt: helpCopy.helpPrompt,
    helpLinkLabel: helpCopy.helpLinkLabel,
    helpLinkHref: helpCopy.helpLinkHref,
    footerVariant: 'transactional',
  };
}

export function buildNoticeCopyTemplateProps({
  audience,
  locale,
  payload,
}: EmailBuilderContext<'notice.copy'>): NoticeTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const footerVariant = payload.footerVariant || (audience === 'admin' ? 'opsAdmin' : 'transactional');
  const copy = buildEmailCopy(
    payload.copyKey as Parameters<typeof buildEmailCopy>[0],
    locale,
    (payload.copyParams || {}) as never
  );

  return {
    locale,
    subject: copy.subject,
    preheader: payload.preheader || copy.message,
    eyebrow: payload.eyebrow,
    title: copy.title,
    bodyText: copy.message,
    bodyCardTitle: buildNoticeBodyCardTitle(locale, audience),
    statusLabel: payload.statusLabel,
    statusTone: payload.statusTone,
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    helpPrompt: footerVariant === 'opsAdmin' ? undefined : helpCopy.helpPrompt,
    helpLinkLabel: footerVariant === 'opsAdmin' ? undefined : helpCopy.helpLinkLabel,
    helpLinkHref:
      footerVariant === 'opsAdmin'
        ? undefined
        : payload.helpLinkHref || helpCopy.helpLinkHref,
    footerVariant,
  };
}

export function buildNoticeCustomTemplateProps({
  audience,
  locale,
  payload,
}: EmailBuilderContext<'notice.custom'>): NoticeTemplateProps {
  const helpCopy = defaultHelpCopyByLocale[locale];
  const footerVariant = payload.footerVariant || (audience === 'admin' ? 'opsAdmin' : 'transactional');

  return {
    locale,
    subject: payload.subject,
    preheader: payload.preheader || payload.message,
    eyebrow: payload.eyebrow,
    title: payload.title,
    bodyText: payload.message,
    bodyCardTitle: buildNoticeBodyCardTitle(locale, audience),
    statusLabel: payload.statusLabel,
    statusTone: payload.statusTone,
    ctaLabel: payload.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    helpPrompt:
      footerVariant === 'opsAdmin'
        ? payload.helpPrompt
        : payload.helpPrompt || helpCopy.helpPrompt,
    helpLinkLabel:
      footerVariant === 'opsAdmin'
        ? payload.helpLinkLabel
        : payload.helpLinkLabel || helpCopy.helpLinkLabel,
    helpLinkHref:
      footerVariant === 'opsAdmin'
        ? payload.helpLinkHref
        : payload.helpLinkHref || helpCopy.helpLinkHref,
    footerVariant,
  };
}
