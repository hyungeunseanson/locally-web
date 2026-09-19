import { appendFile } from 'fs/promises';
import nodemailer from 'nodemailer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EmailAudience,
  EmailSendRequest,
  EmailTemplateId,
  EmailTransportPolicy,
} from '@/app/emails/registry/emailTypes';
import { renderEmailTemplate } from '@/app/emails/render/renderEmailTemplate';
import { OFFICIAL_SUPPORT_EMAIL } from '@/app/utils/officialSender';

type AdminClient = SupabaseClient;

type SendTemplatedEmailResult = {
  success: boolean;
  sent: boolean;
  provider: 'resend' | 'gmail' | 'cloudflare' | 'mock' | 'none';
  skipped?: 'provider_not_configured' | 'recipient_missing';
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

const LOCAL_DEV_FALLBACK_MAIL_CAPTURE_PATH = '/tmp/locally-mock-nodemailer.jsonl';
const CLOUDFLARE_EMAIL_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_EMAIL_FROM_NAME = 'Locally';

export type EmailEnv = Partial<Record<
  | 'RESEND_API_KEY'
  | 'RESEND_FROM_EMAIL'
  | 'GMAIL_USER'
  | 'GMAIL_APP_PASSWORD'
  | 'ADMIN_GMAIL_USER'
  | 'ADMIN_GMAIL_APP_PASSWORD'
  | 'EMAIL_TRANSPORT_PROVIDER'
  | 'CLOUDFLARE_ACCOUNT_ID'
  | 'CLOUDFLARE_EMAIL_API_TOKEN'
  | 'MOCK_ADMIN_ALERT_EMAILS_FILE'
  | 'NODE_ENV',
  string
>>;

export type EmailTransportProvider = 'gmail' | 'cloudflare';

export function resolveEmailTransportProvider(
  env: EmailEnv = process.env
): EmailTransportProvider {
  return env.EMAIL_TRANSPORT_PROVIDER?.trim().toLowerCase() === 'cloudflare'
    ? 'cloudflare'
    : 'gmail';
}

function hasResendConfig(env: EmailEnv = process.env) {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

function hasGmailConfig(env: EmailEnv = process.env) {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

function hasCloudflareEmailConfig(env: EmailEnv = process.env) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_EMAIL_API_TOKEN?.trim());
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

function getMockCapturePath(env: EmailEnv = process.env) {
  const value = env.MOCK_ADMIN_ALERT_EMAILS_FILE;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (env.NODE_ENV !== 'production') {
    return LOCAL_DEV_FALLBACK_MAIL_CAPTURE_PATH;
  }

  return null;
}

export async function resolveRecipientEmail(params: {
  supabaseAdmin: AdminClient;
  userId: string;
  audience: EmailAudience;
  explicitEmail?: string | null;
}) {
  const {
    supabaseAdmin,
    userId,
    audience,
    explicitEmail,
  } = params;

  if (audience === 'host') {
    const { data: hostApplication, error: hostApplicationError } =
      await supabaseAdmin
        .from('host_applications')
        .select('email')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (hostApplicationError) {
      throw hostApplicationError;
    }

    const hostNotificationEmail = hostApplication?.email?.trim();
    if (hostNotificationEmail) return hostNotificationEmail;
  }

  const normalizedExplicitEmail = explicitEmail?.trim();
  if (normalizedExplicitEmail) return normalizedExplicitEmail;

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
}, env: EmailEnv = process.env) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCloudflareSendResult(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    ['delivered', 'permanent_bounces', 'queued'].every((key) =>
      Array.isArray(value[key])
    )
  );
}

function formatCloudflareErrorCodes(value: unknown) {
  if (!Array.isArray(value)) return '';

  const codes = value
    .map((error) => {
      if (!isRecord(error)) return null;
      const code = error.code;
      return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
    })
    .filter((code): code is string => Boolean(code))
    .slice(0, 3);

  return codes.length > 0 ? ` (error codes: ${codes.join(', ')})` : '';
}

export async function sendWithCloudflareEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}, env: EmailEnv = process.env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Email Sending is not configured');
  }

  let response: Response;
  try {
    response = await fetch(
      `${CLOUDFLARE_EMAIL_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: params.to,
          from: {
            address: OFFICIAL_SUPPORT_EMAIL,
            name: CLOUDFLARE_EMAIL_FROM_NAME,
          },
          reply_to: OFFICIAL_SUPPORT_EMAIL,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      }
    );
  } catch {
    throw new Error('Cloudflare Email Sending request failed');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Cloudflare Email Sending returned invalid JSON (${response.status})`);
  }

  if (
    !response.ok ||
    !isRecord(payload) ||
    payload.success !== true ||
    !Array.isArray(payload.errors) ||
    payload.errors.length > 0 ||
    !Array.isArray(payload.messages) ||
    !isCloudflareSendResult(payload.result)
  ) {
    const errorCodes = isRecord(payload)
      ? formatCloudflareErrorCodes(payload.errors)
      : '';
    throw new Error(`Cloudflare Email Sending failed (${response.status})${errorCodes}`);
  }
}

async function sendWithMockFile(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}, env: EmailEnv = process.env) {
  const capturePath = getMockCapturePath(env);
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
    env?: EmailEnv;
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
    (request.recipient.userId && request.audience === 'host') ||
      (request.recipient.userId && !request.recipient.email) ||
      (request.recipient.userId && !request.locale)
  );
  const supabaseAdmin =
    options?.supabaseAdmin || (needsAdminClient
      ? (await import('@/app/utils/supabase/admin')).createAdminClient()
      : null);
  const recipientEmail =
    request.recipient.userId && supabaseAdmin
      ? await resolveRecipientEmail({
          supabaseAdmin,
          userId: request.recipient.userId,
          audience: request.audience,
          explicitEmail: request.recipient.email,
        })
      : request.recipient.email || '';

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
  const emailEnvironment = options?.env ?? process.env;
  const gmailSender = resolveGmailSenderProfile(transportPolicy, emailEnvironment);
  const prefersDedicatedAdminGmail =
    transportPolicy === 'opsAdmin' && hasAdminGmailConfig(emailEnvironment);

  if (transportPolicy === 'opsAdmin' && (await sendWithMockFile({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    from: gmailSender?.from,
  }, emailEnvironment))) {
    return {
      success: true,
      sent: true,
      provider: 'mock',
      ...rendered,
    };
  }

  if (resolveEmailTransportProvider(emailEnvironment) === 'cloudflare') {
    if (!hasCloudflareEmailConfig(emailEnvironment)) {
      return {
        success: true,
        sent: false,
        provider: 'none',
        skipped: 'provider_not_configured',
        ...rendered,
      };
    }

    await sendWithCloudflareEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }, emailEnvironment);

    return {
      success: true,
      sent: true,
      provider: 'cloudflare',
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

  if (transportPolicy === 'opsAdmin' && hasResendConfig(emailEnvironment)) {
    await sendWithResend({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }, emailEnvironment);

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
