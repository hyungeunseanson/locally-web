import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import nodemailer from 'nodemailer';
import * as React from 'react';
import { render } from '@react-email/render';
import BookingConfirmationEmail from '@/app/emails/templates/BookingConfirmationEmail';
import BookingCancellationEmail from '@/app/emails/templates/BookingCancellationEmail';
import {
    buildBookingCancellationTemplateEmailCopy,
    buildBookingConfirmationTemplateEmailCopy,
    buildLocalizedBookingCancellationTemplateEmailCopy,
    buildLocalizedBookingConfirmationTemplateEmailCopy,
} from '@/app/utils/bookingTemplateEmailCopy';

type SendEmailBody = {
    type?: string;
    hostId?: string;
    guestName?: string;
    experienceTitle?: string;
    guestsCount?: number;
    bookingDate?: string;
    bookingTime?: string;
    cancelReason?: string;
    refundAmount?: number;
    totalAmount?: number;
    targetEmail?: string;
    targetRole?: string;
    requestId?: string;
    content?: string;
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
    // [Security] 내부 서버-to-서버 전용 라우트 — 외부 호출 차단
    const internalSecret = request.headers.get('x-internal-secret');
    const expectedInternalSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedInternalSecret) {
        console.error('[Email API] INTERNAL_API_SECRET is not configured.');
        return NextResponse.json({ error: 'Internal secret is not configured' }, { status: 500 });
    }

    if (!internalSecret || internalSecret !== expectedInternalSecret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: SendEmailBody = {};
    try {
        body = await request.json();
        const { type, hostId, guestName, experienceTitle, guestsCount, bookingDate, bookingTime, cancelReason, refundAmount, totalAmount, targetEmail, targetRole, requestId, content } = body;

        if ((!hostId && !targetEmail) || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch host's email
        let hostEmail = '';
        let hostProfile: { email?: string | null; full_name?: string | null } | null = null;

        if (hostId) {
            // [Fix] profiles.name → profiles.full_name (profiles 테이블에 name 컬럼 없음 — 42703 방지)
            const { data } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', hostId)
                .maybeSingle();
            hostProfile = data;
        }

        if (hostProfile?.email) {
            hostEmail = hostProfile.email;
        } else if (hostId) {
            const { data: authData } = await supabase.auth.admin.getUserById(hostId);
            if (authData?.user?.email) hostEmail = authData.user.email;
        }

        if (!hostEmail && !targetEmail) {
            throw new Error(`Email not found for host ${hostId}`);
        }

        const finalEmail = targetEmail || hostEmail;

        // Render HTML based on email type
        let emailHtml = '';
        let subject = '';

        if (type === 'booking_confirmation') {
            const templateCopy = hostId
                ? await buildLocalizedBookingConfirmationTemplateEmailCopy({
                    supabaseAdmin: supabase,
                    userId: hostId,
                    experienceTitle,
                })
                : buildBookingConfirmationTemplateEmailCopy('ko', {
                    experienceTitle,
                });

            subject = templateCopy.subject;
            emailHtml = await render(
                React.createElement(BookingConfirmationEmail, {
                    hostName: hostProfile?.full_name || templateCopy.fallbackHostName,
                    guestName: guestName || templateCopy.fallbackGuestName,
                    experienceTitle: experienceTitle || templateCopy.fallbackExperienceTitle,
                    guestsCount: guestsCount || 1,
                    totalAmount: totalAmount || 0,
                    bookingDate: bookingDate || templateCopy.fallbackBookingDate,
                    bookingTime: bookingTime || '',
                    dashboardLink: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/host/dashboard`,
                    copy: templateCopy,
                })
            );
        } else if (type === 'booking_cancellation') {
            const templateCopy = hostId
                ? await buildLocalizedBookingCancellationTemplateEmailCopy({
                    supabaseAdmin: supabase,
                    userId: hostId,
                    experienceTitle,
                })
                : buildBookingCancellationTemplateEmailCopy('ko', {
                    experienceTitle,
                });

            subject = templateCopy.subject;
            emailHtml = await render(
                React.createElement(BookingCancellationEmail, {
                    hostName: hostProfile?.full_name || templateCopy.fallbackHostName,
                    experienceTitle: experienceTitle || templateCopy.fallbackExperienceTitle,
                    cancelReason: cancelReason || templateCopy.fallbackCancelReason,
                    refundAmount: refundAmount || 0,
                    dashboardLink: `${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard`,
                    copy: templateCopy,
                })
            );
        } else if (type === 'proxy_comment_notify') {
            subject = `[Locally] 전화 대행 예약에 새로운 답변이 등록되었습니다`;
            const headerText = targetRole === 'admin' ? '관리자님, 새로운 답변이 등록되었습니다.' : '고객님, 요청하신 예약에 답변이 등록되었습니다.';
            emailHtml = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${headerText}</h2>
                <div style="padding: 16px; background-color: #f9fafb; border-radius: 8px; margin: 16px 0;">
                  <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(String(content || ''))}</p>
                </div>
                <p>로컬리 웹사이트에서 확인해주세요.</p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/proxy-bookings/${requestId}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">예약 확인하기</a>
              </div>
            `;
        } else {
            throw new Error(`Invalid email type: ${type}`);
        }

        // Send email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        await transporter.sendMail({
            from: `"Locally Team" <${process.env.GMAIL_USER}>`,
            to: finalEmail,
            subject,
            html: emailHtml,
        });

        console.log(`✅ [Email API] Successfully sent ${type} email`);
        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
        console.error('🔥 [Email API] Email Sending Failed:', error);

        // Phase 3: 명확한 DB 에러 로그 기록 (notifications 테이블에 system_error 로 저장)
        try {
            const supabase = createAdminClient();

            let errorHostId = body?.hostId || null;
            if (!errorHostId && body?.targetEmail) {
                // [Fix] listUsers() 전체 테이블 스캔 제거 — profiles 조회로만 처리
                const { data: userProfile } = await supabase.from('profiles').select('id').eq('email', body.targetEmail).maybeSingle();
                if (userProfile?.id) {
                    errorHostId = userProfile.id;
                }
            }

            if (!errorHostId) {
                console.warn('🔥 [Email API] Could not resolve user_id for system_error notification. Skipping DB log to prevent Null Constraint violation.');
                return NextResponse.json({ error: errorMessage }, { status: 500 });
            }

            await supabase.from('notifications').insert({
                user_id: errorHostId,
                type: 'system_error',
                title: '🚨 이메일 발송 시스템 장애',
                message: `이메일 렌더링 또는 전송이 실패했습니다: ${errorMessage}`,
                link: '',
                is_read: false
            });
            console.log('✅ [Email API] Logged failure to DB');
        } catch (logError) {
            console.error('🔥 [Email API] Failed to log error to DB:', logError);
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
