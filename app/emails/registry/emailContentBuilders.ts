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
  return [date, time].filter(Boolean).join('\n');
}

function stripLocallyPrefix(subject: string) {
  return subject.replace(/^\[Locally\]\s*/u, '').trim();
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
      subject: copy.subject,
      preheader: copy.message,
      title: copy.title,
      description: copy.message,
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
    subject: copy.subject,
    preheader: copy.previewText,
    title: stripLocallyPrefix(copy.subject),
    description: `${copy.greetingPrefix}${resolvedRecipientName}${copy.greetingSuffix} ${copy.introText}`,
    ctaLabel: copy.ctaLabel,
    ctaUrl: buildAbsoluteUrl(payload.ctaUrl),
    summaryItems: buildSummaryItems([
      { label: labels.experience, value: payload.experienceTitle, emphasis: true },
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
      {
        label: copy.bookingDateLabel,
        value: buildScheduleValue(payload.bookingDate, payload.bookingTime),
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
      subject: copy.subject,
      preheader: copy.message,
      title: copy.title,
      description: copy.message,
      statusLabel: stripLocallyPrefix(copy.subject),
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
    subject: copy.subject,
    preheader: copy.previewText,
    title: stripLocallyPrefix(copy.subject),
    description: `${copy.greetingPrefix}${resolvedRecipientName}${copy.greetingSuffix} ${copy.introPrefix} [${payload.experienceTitle}] ${copy.introSuffix}`,
    statusLabel: stripLocallyPrefix(copy.previewText),
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
    subject: copy.subject,
    preheader: payload.messagePreview,
    title: copy.title,
    description: buildInquiryDescription(locale, payload.threadTitle),
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
      return 'Host application';
    case 'zh':
      return 'Host application';
    case 'ko':
    default:
      return 'Host application';
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
    subject: copy.subject,
    preheader: splitMessage.primary || copy.message,
    eyebrow: buildHostApplicationEyebrow(locale),
    title: stripEmojiPrefix(copy.title),
    description: splitMessage.primary || copy.message,
    statusLabel: stripEmojiPrefix(copy.subject),
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
    subject: copy.subject,
    preheader: copy.message,
    eyebrow: locale === 'ko' ? 'Service request' : 'Service request',
    title: copy.title,
    description: copy.message,
    statusLabel: copy.title,
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
    subject: copy.subject,
    preheader: payload.preheader || copy.message,
    eyebrow: payload.eyebrow,
    title: copy.title,
    bodyText: copy.message,
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
    subject: payload.subject,
    preheader: payload.preheader || payload.message,
    eyebrow: payload.eyebrow,
    title: payload.title,
    bodyText: payload.message,
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
