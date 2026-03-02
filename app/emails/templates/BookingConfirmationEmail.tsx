import * as React from 'react';
import { Text, Section, Hr, Row, Column } from '@react-email/components';
import EmailLayout from '../components/EmailLayout';
import CTAButton from '../components/CTAButton';

interface BookingConfirmationEmailProps {
    hostName: string;
    guestName: string;
    experienceTitle: string;
    guestsCount: number;
    bookingDate: string;
    bookingTime: string;
    dashboardLink: string;
}

export default function BookingConfirmationEmail({
    hostName = 'Locally 호스트',
    guestName = '게스트',
    experienceTitle = '로컬라이프 체험',
    guestsCount = 2,
    bookingDate = '2026-03-01',
    bookingTime = '14:00',
    dashboardLink = 'https://locally.vercel.app/host/dashboard',
}: BookingConfirmationEmailProps) {
    return (
        <EmailLayout previewText={`🎉 새로운 예약이 도착했습니다: ${experienceTitle}`} headerTitle="Locally">
            <Text style={greeting}>안녕하세요, {hostName}님! 😊</Text>
            <Text style={introText}>
                기쁜 소식입니다! 회원님의 <b>[{experienceTitle}]</b> 체험에 새로운 예약이 확정되었습니다.
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
                    <Column style={labelCol}>예약 일자</Column>
                    <Column style={valueCol}>
                        {bookingDate} <br /> {bookingTime}
                    </Column>
                </Row>
            </Section>

            <Text style={helperText}>
                예약된 시간에 늦지 않게 준비해주세요. 게스트와 사전에 채팅으로 인사해보는 것도 추천드립니다.
            </Text>

            <CTAButton href={dashboardLink}>예약 세부 정보 확인하기</CTAButton>
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
