import { NextResponse } from 'next/server';

import { sendImmediateAdminEmail } from '@/app/utils/adminEmailProvider';
import { isCrossSiteBrowserRequest } from '@/app/utils/security/publicWriteGuard';

type PartnershipInquiryBody = {
  companyName?: string;
  email?: string;
  message?: string;
  website?: string;
};

const DEFAULT_PARTNERSHIP_INQUIRY_EMAIL = 'locally.partners@gmail.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNICODE_LETTER_PATTERN = /\p{L}/u;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getPartnershipInquiryRecipientEmail() {
  const configured = typeof process.env.PARTNERSHIP_INQUIRY_EMAIL === 'string'
    ? process.env.PARTNERSHIP_INQUIRY_EMAIL.trim()
    : '';

  return configured || DEFAULT_PARTNERSHIP_INQUIRY_EMAIL;
}

export async function POST(request: Request) {
  try {
    if (isCrossSiteBrowserRequest(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as PartnershipInquiryBody;
    const companyName = readString(body.companyName);
    const email = readString(body.email).toLowerCase();
    const message = readString(body.message);
    const website = readString(body.website);

    if (website) {
      return NextResponse.json({ success: true });
    }

    if (!companyName || !email || !message) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (companyName.length > 120) {
      return NextResponse.json(
        { success: false, error: '브랜드 또는 회사명은 120자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (message.length < 10 || message.length > 4000) {
      return NextResponse.json(
        { success: false, error: '문의 내용은 10자 이상 4000자 이하로 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!UNICODE_LETTER_PATTERN.test(message)) {
      return NextResponse.json(
        { success: false, error: '문의 내용을 확인해주세요.' },
        { status: 400 }
      );
    }

    const replyUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
      `[Locally Partnership] ${companyName}`
    )}`;

    const result = await sendImmediateAdminEmail({
      to: getPartnershipInquiryRecipientEmail(),
      templatedEmail: {
        templateId: 'notice.custom',
        audience: 'admin',
        payload: {
          subject: `[Locally Partnership] ${companyName}`,
          title: '새로운 광고 · 제휴 문의가 도착했습니다',
          message: `브랜드 / 회사명: ${companyName}\n연락 이메일: ${email}\n\n문의 내용\n${message}`,
          ctaLabel: '문의 메일로 답장하기',
          ctaUrl: replyUrl,
          footerVariant: 'opsAdmin',
          statusLabel: 'Partnership Inquiry',
        },
      },
    });

    if (!result.sent) {
      return NextResponse.json(
        { success: false, error: '메일 발송 설정이 준비되지 않았습니다.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      recipient: getPartnershipInquiryRecipientEmail(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
