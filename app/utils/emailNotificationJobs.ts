import nodemailer from 'nodemailer';

import { createAdminClient } from '@/app/utils/supabase/admin';

function isMailerConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
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

function renderEmailShell(params: {
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

async function sendHtmlEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!isMailerConfigured()) return false;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Locally Team" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  return true;
}

export async function resolveUserEmail(userId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.email) return profile.email;

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  return authData?.user?.email || '';
}

export async function sendImmediateGenericEmail(params: {
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  ctaLabel?: string;
}) {
  if (!isMailerConfigured()) return { success: true, sent: false, skipped: 'mailer_not_configured' as const };

  const email = params.recipientEmail || (params.recipientUserId ? await resolveUserEmail(params.recipientUserId) : '');

  if (!email) {
    return { success: true, sent: false, skipped: 'recipient_email_missing' as const };
  }

  const html = renderEmailShell({
    title: params.title,
    bodyHtml: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(params.message)}</p>`,
    ctaLink: params.link || null,
    ctaLabel: params.ctaLabel || '확인하기',
  });

  await sendHtmlEmail({
    to: email,
    subject: params.subject,
    html,
  });

  return { success: true, sent: true };
}
