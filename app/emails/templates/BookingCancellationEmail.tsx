import * as React from 'react';
import { Text, Section, Hr, Row, Column } from '@react-email/components';
import EmailLayout from '../components/EmailLayout';
import CTAButton from '../components/CTAButton';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

interface BookingCancellationEmailProps {
    hostName?: string;
    experienceTitle?: string;
    cancelReason?: string;
    refundAmount?: number;
    dashboardLink?: string;
}

export default function BookingCancellationEmail({
    hostName = 'Locally 호스트',
    experienceTitle = '로컬라이프 체험',
    cancelReason = '게스트 개인 사정',
    refundAmount = 0,
    dashboardLink = buildAbsoluteUrl('/host/dashboard'),
}: BookingCancellationEmailProps) {
    return (
        <EmailLayout previewText={`예약 취소 안내 — ${experienceTitle}`}>
            <Text style={greeting}>안녕하세요, {hostName}님.</Text>
            <Text style={introText}>
                아쉬운 소식을 전해드려요. <b>[{experienceTitle}]</b> 체험 예약이 취소되었어요.
            </Text>

            {/* 영수증 / 예약 정보 형태 박스 */}
            <Section style={receiptBox}>
                <Row style={receiptRow}>
                    <Column style={labelCol}>취소 사유</Column>
                    <Column style={valueCol}>{cancelReason}</Column>
                </Row>
                <Hr style={receiptHr} />
                <Row style={receiptRow}>
                    <Column style={labelCol}>게스트 환불액</Column>
                    <Column style={valueColAlert}>₩{refundAmount?.toLocaleString() || 0}</Column>
                </Row>
            </Section>

            <Text style={helperText}>
                일정은 대시보드에서 다시 열어두실 수 있어요. 다음 기회에 더 좋은 인연이 이어지길 바라요. 언제나 응원할게요 💙
            </Text>

            <CTAButton href={dashboardLink}>대시보드 확인하기</CTAButton>
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
