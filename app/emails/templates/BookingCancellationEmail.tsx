import * as React from 'react';
import { Text, Section, Hr, Row, Column } from '@react-email/components';
import EmailLayout from '../components/EmailLayout';
import CTAButton from '../components/CTAButton';
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
    const resolvedExperienceTitle = experienceTitle || templateCopy.fallbackExperienceTitle;
    const resolvedCancelReason = cancelReason || templateCopy.fallbackCancelReason;

    return (
        <EmailLayout
            previewText={templateCopy.previewText}
            helpPrompt={templateCopy.layout.helpPrompt}
            helpLinkLabel={templateCopy.layout.helpLinkLabel}
        >
            <Text style={greeting}>{templateCopy.greetingPrefix}{resolvedHostName}{templateCopy.greetingSuffix}</Text>
            <Text style={introText}>
                {templateCopy.introPrefix} <b>[{resolvedExperienceTitle}]</b> {templateCopy.introSuffix}
            </Text>

            {/* 영수증 / 예약 정보 형태 박스 */}
            <Section style={receiptBox}>
                <Row style={receiptRow}>
                    <Column style={labelCol}>{templateCopy.cancelReasonLabel}</Column>
                    <Column style={valueCol}>{resolvedCancelReason}</Column>
                </Row>
                <Hr style={receiptHr} />
                <Row style={receiptRow}>
                    <Column style={labelCol}>{templateCopy.refundAmountLabel}</Column>
                    <Column style={valueColAlert}>₩{refundAmount?.toLocaleString() || 0}</Column>
                </Row>
            </Section>

            <Text style={helperText}>{templateCopy.helperText}</Text>

            <CTAButton href={dashboardLink}>{templateCopy.ctaLabel}</CTAButton>
        </EmailLayout>
    );
}

const greeting = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '16px',
};

const introText = {
    fontSize: '15px',
    color: '#4b5563',
    lineHeight: '1.6',
    marginBottom: '24px',
};

const receiptBox = {
    backgroundColor: '#fafafa',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px',
};

const receiptRow = {
    width: '100%',
};

const labelCol = {
    width: '40%',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500',
};

const valueCol = {
    width: '60%',
    color: '#111827',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'right' as const,
};

const valueColAlert = {
    width: '60%',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '700',
    textAlign: 'right' as const,
};

const receiptHr = {
    borderColor: '#e5e7eb',
    margin: '12px 0',
};

const helperText = {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
};
