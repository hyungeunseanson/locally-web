import { appendFile } from 'fs/promises';
import nodemailer from 'nodemailer';
import { createAdminClient } from '@/app/utils/supabase/admin';
import type {
  EmailSendRequest,
  EmailTemplateId,
  EmailTransportPolicy,
} from '@/app/emails/registry/emailTypes';
import { renderEmailTemplate } from '@/app/emails/render/renderEmailTemplate';

type AdminClient = ReturnType<typeof createAdminClient>;

type SendTemplatedEmailResult = {
  success: boolean;
  sent: boolean;
  provider: 'resend' | 'gmail' | 'mock' | 'none';
  skipped?: 'provider_not_configured' | 'recipient_missing';
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

const LOCAL_DEV_FALLBACK_MAIL_CAPTURE_PATH = '/tmp/locally-mock-nodemailer.jsonl';

type EmailEnv = Partial<Record<
  | 'RESEND_API_KEY'
  | 'RESEND_FROM_EMAIL'
  | 'GMAIL_USER'
  | 'GMAIL_APP_PASSWORD'
  | 'ADMIN_GMAIL_USER'
  | 'ADMIN_GMAIL_APP_PASSWORD'
  | 'MOCK_ADMIN_ALERT_EMAILS_FILE'
  | 'NODE_ENV',
  string
>>;

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function hasGmailConfig(env: EmailEnv = process.env) {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

export function hasAdminGmailConfig(env: EmailEnv = process.env) {
  return Boolean(env.ADMIN_GMAIL_USER && env.ADMIN_GMAIL_APP_PASSWORD);
}

type GmailSenderProfile = {
  user: string;
  pass: string;
  from: string;
};

export function resolveGmailSenderProfile(
  policy: EmailTransportPolicy = 'transactional',
  env: EmailEnv = process.env
): GmailSenderProfile | null {
  if (policy === 'opsAdmin' && hasAdminGmailConfig(env)) {
    return {
      user: env.ADMIN_GMAIL_USER!,
      pass: env.ADMIN_GMAIL_APP_PASSWORD!,
      from: `"Locally Admin" <${env.ADMIN_GMAIL_USER!}>`,
    };
  }

  if (hasGmailConfig(env)) {
    return {
      user: env.GMAIL_USER!,
      pass: env.GMAIL_APP_PASSWORD!,
      from: `"Locally Team" <${env.GMAIL_USER!}>`,
    };
  }

  return null;
}

function getMockCapturePath() {
  const value = process.env.MOCK_ADMIN_ALERT_EMAILS_FILE;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (process.env.NODE_ENV !== 'production') {
    return LOCAL_DEV_FALLBACK_MAIL_CAPTURE_PATH;
  }

  return null;
}

async function resolveRecipientEmail(
  supabaseAdmin: AdminClient,
  userId: string
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.email) return profile.email;

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  return authData?.user?.email || '';
}

async function sendWithGmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  sender: GmailSenderProfile;
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: params.sender.user,
      pass: params.sender.pass,
    },
  });

  await transporter.sendMail({
    from: params.sender.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

async function sendWithResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
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
      text: params.text,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Resend send failed: ${response.status} ${payload}`);
  }
}

async function sendWithMockFile(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const capturePath = getMockCapturePath();
  if (!capturePath) return false;

  await appendFile(
    capturePath,
    `${JSON.stringify({
      to: params.to,
      subject: params.subject,
      html: params.html,
      from: params.from,
    })}\n`,
    'utf8'
  );

  return true;
}

function resolveTransportPolicy(policy?: EmailTransportPolicy): EmailTransportPolicy {
  return policy || 'transactional';
}

export async function sendTemplatedEmail<T extends EmailTemplateId>(
  request: EmailSendRequest<T>,
  options?: {
    supabaseAdmin?: AdminClient | null;
  }
): Promise<SendTemplatedEmailResult> {
  if (!request.recipient.email && !request.recipient.userId) {
    return {
      success: true,
      sent: false,
      provider: 'none',
      skipped: 'recipient_missing',
      subject: '',
      preheader: '',
      html: '',
      text: '',
    };
  }

  const needsAdminClient = Boolean(
    (request.recipient.userId && !request.recipient.email) ||
      (request.recipient.userId && !request.locale)
  );
  const supabaseAdmin =
    options?.supabaseAdmin || (needsAdminClient ? createAdminClient() : null);
  const recipientEmail =
    request.recipient.email ||
    (request.recipient.userId && supabaseAdmin
      ? await resolveRecipientEmail(supabaseAdmin, request.recipient.userId)
      : '');

  const rendered = await renderEmailTemplate(request, {
    supabaseAdmin,
  });

  if (!recipientEmail) {
    return {
      success: true,
      sent: false,
      provider: 'none',
      skipped: 'recipient_missing',
      ...rendered,
    };
  }

  const transportPolicy = resolveTransportPolicy(request.transportPolicy);
  const gmailSender = resolveGmailSenderProfile(transportPolicy);
  const prefersDedicatedAdminGmail =
    transportPolicy === 'opsAdmin' && hasAdminGmailConfig();

  if (transportPolicy === 'opsAdmin' && (await sendWithMockFile({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    from: gmailSender?.from,
  }))) {
    return {
      success: true,
      sent: true,
      provider: 'mock',
      ...rendered,
    };
  }

  if (prefersDedicatedAdminGmail && gmailSender) {
    await sendWithGmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      sender: gmailSender,
    });

    return {
      success: true,
      sent: true,
      provider: 'gmail',
      ...rendered,
    };
  }

  if (transportPolicy === 'opsAdmin' && hasResendConfig()) {
    await sendWithResend({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return {
      success: true,
      sent: true,
      provider: 'resend',
      ...rendered,
    };
  }

  if (gmailSender) {
    await sendWithGmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      sender: gmailSender,
    });

    return {
      success: true,
      sent: true,
      provider: 'gmail',
      ...rendered,
    };
  }

  return {
    success: true,
    sent: false,
    provider: 'none',
    skipped: 'provider_not_configured',
    ...rendered,
  };
}
