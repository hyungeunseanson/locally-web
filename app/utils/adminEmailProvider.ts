import { sendTemplatedEmail } from '@/app/emails/delivery/sendTemplatedEmail';
import type {
  EmailAudience,
  EmailLocale,
  EmailPayloadMap,
  EmailTemplateId,
  EmailTransportPolicy,
} from '@/app/emails/registry/emailTypes';

type AdminTemplatedEmailInput<T extends EmailTemplateId = EmailTemplateId> = {
  templateId: T;
  audience: EmailAudience;
  locale?: EmailLocale | null;
  payload: EmailPayloadMap[T];
  transportPolicy?: EmailTransportPolicy;
};

type SendAdminEmailParams = {
  to: string;
  subject?: string;
  title?: string;
  message?: string;
  link?: string | null;
  ctaLabel?: string;
  templatedEmail: AdminTemplatedEmailInput;
};

type SendAdminEmailResult = {
  success: boolean;
  sent: boolean;
  provider: 'resend' | 'gmail' | 'mock' | 'none';
  skipped?: 'provider_not_configured' | 'recipient_missing';
};

export async function sendImmediateAdminEmail(
  params: SendAdminEmailParams
): Promise<SendAdminEmailResult> {
  const result = await sendTemplatedEmail({
    templateId: params.templatedEmail.templateId,
    audience: params.templatedEmail.audience,
    locale: params.templatedEmail.locale,
    recipient: {
      email: params.to,
    },
    payload: params.templatedEmail.payload as never,
    transportPolicy: params.templatedEmail.transportPolicy || 'opsAdmin',
  });

  return {
    success: result.success,
    sent: result.sent,
    provider: result.provider,
    skipped: result.skipped,
  };
}
