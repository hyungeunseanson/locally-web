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
        <EmailLayout previewText={`😢 예약이 취소되었습니다: ${experienceTitle}`} headerTitle="Locally">
            <Text style={greeting}>안녕하세요, {hostName}님.</Text>
            <Text style={introText}>
                아쉽게도 회원님의 <b>[{experienceTitle}]</b> 예약이 취소되었습니다.
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
                관련된 위약금 정산이나 변경된 일정표는 호스트 대시보드에서 바로 확인하실 수 있습니다. 다음 멋진 만남을 기대합니다!
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
    backgroundColor: '#fff1f2',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #fecdd3',
    marginBottom: '24px',
};

const receiptRow = {
    width: '100%',
};

const labelCol = {
    width: '40%',
    color: '#9f1239',
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
    color: '#e11d48',
    fontSize: '14px',
    fontWeight: '800',
    textAlign: 'right' as const,
};

const receiptHr = {
    borderColor: '#fecdd3',
    margin: '12px 0',
};

const helperText = {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
};
