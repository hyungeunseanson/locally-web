import { sendTemplatedEmail } from '@/app/emails/delivery/sendTemplatedEmail';
import type {
  EmailAudience,
  EmailLocale,
  EmailPayloadMap,
  EmailTemplateId,
  EmailTransportPolicy,
} from '@/app/emails/registry/emailTypes';

type GenericTemplatedEmailInput<T extends EmailTemplateId = EmailTemplateId> = {
  templateId: T;
  audience: EmailAudience;
  locale?: EmailLocale | null;
  payload: EmailPayloadMap[T];
  transportPolicy?: EmailTransportPolicy;
};

export async function sendImmediateGenericEmail(params: {
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  subject?: string;
  title?: string;
  message?: string;
  link?: string | null;
  ctaLabel?: string;
  templatedEmail: GenericTemplatedEmailInput;
}) {
  return sendTemplatedEmail({
    templateId: params.templatedEmail.templateId,
    audience: params.templatedEmail.audience,
    locale: params.templatedEmail.locale,
    recipient: {
      userId: params.recipientUserId || null,
      email: params.recipientEmail || null,
    },
    payload: params.templatedEmail.payload as never,
    transportPolicy: params.templatedEmail.transportPolicy,
  });
}
