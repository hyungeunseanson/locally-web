import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import * as React from 'react';
import { render } from '@react-email/render';
import BookingConfirmationEmail from '@/app/emails/templates/BookingConfirmationEmail';
import BookingCancellationEmail from '@/app/emails/templates/BookingCancellationEmail';

export async function POST(request: Request) {
    let body: any = {};
    try {
        body = await request.json();
        const { type, hostId, guestName, experienceTitle, guestsCount, bookingDate, bookingTime, cancelReason, refundAmount, totalAmount, targetEmail, targetRole, requestId, content } = body;

        if ((!hostId && !targetEmail) || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch host's email
        let hostEmail = '';
        const { data: hostProfile } = await supabase.from('profiles').select('email, name').eq('id', hostId).maybeSingle();

        if (hostProfile?.email) {
            hostEmail = hostProfile.email;
        } else {
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
            subject = `[Locally] 🎉 새로운 예약이 도착했습니다!`;
            emailHtml = await render(
                React.createElement(BookingConfirmationEmail, {
                    hostName: hostProfile?.name || '로컬리 호스트',
                    guestName: guestName || '게스트',
                    experienceTitle: experienceTitle || '체험',
                    guestsCount: guestsCount || 1,
                    totalAmount: totalAmount || 0,
                    bookingDate: bookingDate || '일정 미정',
                    bookingTime: bookingTime || '',
                    dashboardLink: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/host/dashboard`
                })
            );
        } else if (type === 'booking_cancellation') {
            subject = `[Locally] 예약 취소 알림`;
            emailHtml = await render(
                React.createElement(BookingCancellationEmail, {
                    hostName: hostProfile?.name || '로컬리 호스트',
                    experienceTitle: experienceTitle || '체험',
                    cancelReason: cancelReason || '사유 없음',
                    refundAmount: refundAmount || 0,
                    dashboardLink: `${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard`
                })
            );
        } else if (type === 'proxy_comment_notify') {
            subject = `[Locally] 전화 대행 예약에 새로운 답변이 등록되었습니다`;
            const headerText = targetRole === 'admin' ? '관리자님, 새로운 답변이 등록되었습니다.' : '고객님, 요청하신 예약에 답변이 등록되었습니다.';
            emailHtml = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${headerText}</h2>
                <div style="padding: 16px; background-color: #f9fafb; border-radius: 8px; margin: 16px 0;">
                  <p style="white-space: pre-wrap; margin: 0;">${content}</p>
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

        console.log(`✅ [Email API] Successfully sent ${type} email to ${finalEmail}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('🔥 [Email API] Email Sending Failed:', error);

        // Phase 3: 명확한 DB 에러 로그 기록 (notifications 테이블에 system_error 로 저장)
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Fix: Do not call request.clone().json() as stream is already read by await request.json()
            // Look up target Email to get the actual user ID if hostId isn't provided
            let errorHostId = body?.hostId || null;
            if (!errorHostId && body?.targetEmail) {
                const { data: userProfile } = await supabase.from('profiles').select('id').eq('email', body.targetEmail).maybeSingle();
                if (userProfile?.id) {
                    errorHostId = userProfile.id;
                } else {
                    const { data: authData } = await supabase.auth.admin.listUsers();
                    const matchedUser = authData?.users?.find((u: any) => u.email === body.targetEmail);
                    if (matchedUser) errorHostId = matchedUser.id;
                }
            }

            if (!errorHostId) {
                console.warn('🔥 [Email API] Could not resolve user_id for system_error notification. Skipping DB log to prevent Null Constraint violation.');
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            await supabase.from('notifications').insert({
                user_id: errorHostId,
                type: 'system_error',
                title: '🚨 이메일 발송 시스템 장애',
                message: `이메일 렌더링 또는 전송이 실패했습니다: ${error?.message || 'Unknown Error'}`,
                link: '',
                is_read: false
            });
            console.log('✅ [Email API] Logged failure to DB');
        } catch (logError) {
            console.error('🔥 [Email API] Failed to log error to DB:', logError);
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
