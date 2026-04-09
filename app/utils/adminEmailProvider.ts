import { appendFile } from 'fs/promises';
import nodemailer from 'nodemailer';

type SendAdminEmailParams = {
  to: string;
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  ctaLabel?: string;
};

type SendAdminEmailResult = {
  success: boolean;
  sent: boolean;
  provider: 'resend' | 'gmail' | 'mock' | 'none';
  skipped?: 'provider_not_configured' | 'recipient_missing';
};

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function hasGmailConfig() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getMockCapturePath() {
  const value = process.env.MOCK_ADMIN_ALERT_EMAILS_FILE;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAbsoluteLink(link?: string | null) {
  if (!link) return `${getSiteUrl()}/`;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  const normalized = link.startsWith('/') ? link : `/${link}`;
  return `${getSiteUrl()}${normalized}`;
}

function renderAdminEmailShell(params: {
  title: string;
  bodyHtml: string;
  ctaLink?: string | null;
  ctaLabel?: string;
}) {
  const cta = params.ctaLink
    ? `<a href="${escapeHtml(buildAbsoluteLink(params.ctaLink))}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">${escapeHtml(params.ctaLabel || '확인하기')}</a>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6;">
      <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(params.title)}</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
        ${params.bodyHtml}
      </div>
      ${cta ? `<div style="margin-top:20px;">${cta}</div>` : ''}
    </div>
  `;
}

async function sendWithResend(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Resend send failed: ${response.status} ${payload}`);
  }
}

async function sendWithGmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Locally Team" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

async function sendWithMockFile(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const capturePath = getMockCapturePath();
  if (!capturePath) return false;

  await appendFile(
    capturePath,
    `${JSON.stringify({
      to: params.to,
      subject: params.subject,
      html: params.html,
    })}\n`,
    'utf8'
  );

  return true;
}

export async function sendImmediateAdminEmail(
  params: SendAdminEmailParams
): Promise<SendAdminEmailResult> {
  if (!params.to?.trim()) {
    return {
      success: true,
      sent: false,
      provider: 'none',
      skipped: 'recipient_missing',
    };
  }

  const html = renderAdminEmailShell({
    title: params.title,
    bodyHtml: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(params.message)}</p>`,
    ctaLink: params.link || null,
    ctaLabel: params.ctaLabel || '운영 대시보드 보기',
  });

  if (await sendWithMockFile({
    to: params.to,
    subject: params.subject,
    html,
  })) {
    return {
      success: true,
      sent: true,
      provider: 'mock',
    };
  }

  if (hasResendConfig()) {
    await sendWithResend({
      to: params.to,
      subject: params.subject,
      html,
    });

    return {
      success: true,
      sent: true,
      provider: 'resend',
    };
  }

  if (hasGmailConfig()) {
    await sendWithGmail({
      to: params.to,
      subject: params.subject,
      html,
    });

    return {
      success: true,
      sent: true,
      provider: 'gmail',
    };
  }

  return {
    success: true,
    sent: false,
    provider: 'none',
    skipped: 'provider_not_configured',
  };
}
