import * as React from 'react';
import BookingCancelledEmailTemplate from './booking/BookingCancelledEmail';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import type { BookingCancellationTemplateCopy } from '@/app/utils/bookingTemplateEmailCopy';

interface BookingCancellationEmailProps {
    hostName?: string;
    experienceTitle?: string;
    cancelReason?: string;
    refundAmount?: number;
    dashboardLink?: string;
    copy?: BookingCancellationTemplateCopy;
}

export default function BookingCancellationEmail({
  hostName = 'Locally 호스트',
  experienceTitle = '로컬라이프 체험',
  cancelReason = '게스트 개인 사정',
  refundAmount = 0,
  dashboardLink = buildAbsoluteUrl('/host/dashboard'),
  copy,
}: BookingCancellationEmailProps) {
  const templateCopy: BookingCancellationTemplateCopy = copy || {
    subject: '[Locally] 예약 취소 알림',
    previewText: `예약 취소 안내 — ${experienceTitle}`,
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
    fallbackExperienceTitle: '로컬라이프 체험',
    fallbackCancelReason: '사유 없음',
    layout: {
      helpPrompt: '궁금하신 점이 있으신가요?',
      helpLinkLabel: '도움 센터 방문하기 ->',
    },
  };
  const resolvedHostName = hostName || templateCopy.fallbackHostName;
  const resolvedExperienceTitle =
    experienceTitle || templateCopy.fallbackExperienceTitle;
  const resolvedCancelReason = cancelReason || templateCopy.fallbackCancelReason;

  return (
    <BookingCancelledEmailTemplate
      subject={templateCopy.subject}
      preheader={templateCopy.previewText}
      title={templateCopy.subject.replace(/^\[Locally\]\s*/u, '').trim()}
      description={`${templateCopy.greetingPrefix}${resolvedHostName}${templateCopy.greetingSuffix} ${templateCopy.introPrefix} [${resolvedExperienceTitle}] ${templateCopy.introSuffix}`}
      statusLabel={templateCopy.previewText}
      statusTone="danger"
      summaryItems={[
        {
          label: templateCopy.cancelReasonLabel,
          value: resolvedCancelReason,
        },
        {
          label: templateCopy.refundAmountLabel,
          value: `₩${refundAmount?.toLocaleString() || 0}`,
          emphasis: true,
        },
      ]}
      helperText={templateCopy.helperText}
      ctaLabel={templateCopy.ctaLabel}
      ctaUrl={dashboardLink}
      helpPrompt={templateCopy.layout.helpPrompt}
      helpLinkLabel={templateCopy.layout.helpLinkLabel}
      helpLinkHref="/about"
      footerVariant="transactional"
    />
  );
}
