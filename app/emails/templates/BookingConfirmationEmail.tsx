import * as React from 'react';
import { Text, Section, Hr, Row, Column } from '@react-email/components';
import EmailLayout from '../components/EmailLayout';
import CTAButton from '../components/CTAButton';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

interface BookingConfirmationEmailProps {
    hostName?: string;
    guestName?: string;
    experienceTitle?: string;
    guestsCount?: number;
    bookingDate?: string;
    bookingTime?: string;
    totalAmount?: number;
    dashboardLink?: string;
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
}: BookingConfirmationEmailProps) {
    return (
        <EmailLayout previewText={`새 게스트가 찾아왔어요 🎉 ${experienceTitle}`}>
            <Text style={greeting}>안녕하세요, {hostName}님 👋</Text>
            <Text style={introText}>
                <b>[{experienceTitle}]</b> 체험에 새 게스트가 찾아왔어요! 함께하는 시간이 정말 특별해질 거예요 🎉
            </Text>

            {/* 영수증 / 예약 정보 형태 박스 */}
            <Section style={receiptBox}>
                <Row style={receiptRow}>
                    <Column style={labelCol}>게스트명</Column>
                    <Column style={valueCol}>{guestName}</Column>
                </Row>
                <Hr style={receiptHr} />
                <Row style={receiptRow}>
                    <Column style={labelCol}>참여 인원</Column>
                    <Column style={valueCol}>{guestsCount}명</Column>
                </Row>
                <Hr style={receiptHr} />
                <Row style={receiptRow}>
                    <Column style={labelCol}>총 결제 금액</Column>
                    <Column style={valueCol}>₩{totalAmount?.toLocaleString() || 0}</Column>
                </Row>
                <Hr style={receiptHr} />
                <Row style={receiptRow}>
                    <Column style={labelCol}>예약 일자</Column>
                    <Column style={valueCol}>
                        {bookingDate} <br /> {bookingTime}
                    </Column>
                </Row>
            </Section>

            <Text style={helperText}>
                게스트가 설레는 마음으로 기다리고 있어요. 채팅으로 먼저 인사를 건네보시고, 멋진 체험 준비해주세요 🙌
            </Text>

            <CTAButton href={dashboardLink}>예약 상세 확인하기</CTAButton>
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
    color: '#374151',
    lineHeight: '1.6',
    marginBottom: '24px',
};

const receiptBox = {
    backgroundColor: '#f9fafb',
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

const receiptHr = {
    borderColor: '#e5e7eb',
    margin: '12px 0',
};

const helperText = {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
};
