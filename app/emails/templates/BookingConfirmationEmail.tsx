import * as React from 'react';
import BookingConfirmedEmailTemplate from './booking/BookingConfirmedEmail';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import type { BookingConfirmationTemplateCopy } from '@/app/utils/bookingTemplateEmailCopy';

interface BookingConfirmationEmailProps {
    hostName?: string;
    guestName?: string;
    experienceTitle?: string;
    guestsCount?: number;
    bookingDate?: string;
    bookingTime?: string;
    totalAmount?: number;
    dashboardLink?: string;
    copy?: BookingConfirmationTemplateCopy;
}

export default function BookingConfirmationEmail({
  hostName = 'Locally 호스트',
  guestName = '게스트',
  experienceTitle = '로컬라이프 체험',
  guestsCount = 1,
  bookingDate = '일정 미정',
  bookingTime = '',
  totalAmount = 0,
  dashboardLink = buildAbsoluteUrl('/host/dashboard'),
  copy,
}: BookingConfirmationEmailProps) {
  const templateCopy: BookingConfirmationTemplateCopy = copy || {
    subject: '[Locally] 🎉 새로운 예약이 도착했습니다!',
    previewText: `새 게스트가 찾아왔어요 🎉 ${experienceTitle}`,
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
    fallbackExperienceTitle: '로컬라이프 체험',
    fallbackBookingDate: '일정 미정',
    layout: {
      helpPrompt: '궁금하신 점이 있으신가요?',
      helpLinkLabel: '도움 센터 방문하기 ->',
    },
  };
  const resolvedHostName = hostName || templateCopy.fallbackHostName;
  const resolvedGuestName = guestName || templateCopy.fallbackGuestName;
  const resolvedExperienceTitle =
    experienceTitle || templateCopy.fallbackExperienceTitle;
  const resolvedBookingDate = bookingDate || templateCopy.fallbackBookingDate;

  return (
    <BookingConfirmedEmailTemplate
      locale="ko"
      subject={templateCopy.subject}
      preheader={templateCopy.previewText}
      title="새 예약이 접수되었습니다"
      description={`${templateCopy.greetingPrefix}${resolvedHostName}${templateCopy.greetingSuffix} [${resolvedExperienceTitle}] ${templateCopy.introText}`}
      summaryTitle="예약 정보"
      statusLabel="예약 접수"
      statusTone="success"
      summaryItems={[
        {
          label: templateCopy.guestNameLabel,
          value: resolvedGuestName,
        },
        {
          label: templateCopy.guestCountLabel,
          value: `${guestsCount}${templateCopy.guestCountSuffix}`,
        },
        {
          label: templateCopy.totalAmountLabel,
          value: `₩${totalAmount?.toLocaleString() || 0}`,
          emphasis: true,
        },
        {
          label: templateCopy.bookingDateLabel,
          value: [resolvedBookingDate, bookingTime].filter(Boolean).join('\n'),
        },
      ]}
      helperText={templateCopy.helperText}
      ctaLabel={templateCopy.ctaLabel}
      ctaUrl={dashboardLink}
      helpPrompt={templateCopy.layout.helpPrompt}
      helpLinkLabel={templateCopy.layout.helpLinkLabel.replace(/\s*->$/u, '')}
      helpLinkHref="/about"
      footerVariant="transactional"
    />
  );
}
