import { render } from '@react-email/render';
import * as React from 'react';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  normalizeNotificationLocale,
  resolveRecipientLocale,
} from '@/app/utils/notificationLocale';
import { emailTemplateRegistry } from '@/app/emails/registry/emailTemplates';
import type {
  EmailLocale,
  EmailRenderResult,
  EmailSendRequest,
  EmailTemplateId,
} from '@/app/emails/registry/emailTypes';
import { DEFAULT_EMAIL_LOCALE } from '@/app/emails/registry/emailTypes';
import { renderEmailText } from './renderEmailText';

type AdminClient = ReturnType<typeof createAdminClient>;

export function isSupportedEmailTemplateId(
  templateId: string
): templateId is EmailTemplateId {
  return templateId in emailTemplateRegistry;
}

export async function resolveRequestedEmailLocale(params: {
  locale?: EmailLocale | null;
  recipientUserId?: string | null;
  supabaseAdmin?: AdminClient | null;
}): Promise<EmailLocale> {
  const explicitLocale = normalizeNotificationLocale(params.locale);
  if (explicitLocale) return explicitLocale;

  if (params.recipientUserId) {
    const supabaseAdmin = params.supabaseAdmin || createAdminClient();
    return resolveRecipientLocale(supabaseAdmin, params.recipientUserId);
  }

  return DEFAULT_EMAIL_LOCALE;
}

export async function renderEmailTemplate<T extends EmailTemplateId>(
  request: EmailSendRequest<T>,
  options?: {
    supabaseAdmin?: AdminClient | null;
  }
): Promise<EmailRenderResult> {
  const locale = await resolveRequestedEmailLocale({
    locale: request.locale,
    recipientUserId: request.recipient.userId || null,
    supabaseAdmin: options?.supabaseAdmin || null,
  });
  const registration = emailTemplateRegistry[request.templateId];
  const componentProps = registration.buildProps({
    audience: request.audience,
    locale,
    payload: request.payload,
  } as never);
  const element = React.createElement(registration.component, componentProps);
  const html = await render(element, { pretty: true });
  const text = await renderEmailText(element);

  return {
    subject: componentProps.subject,
    preheader: componentProps.preheader,
    html,
    text,
  };
}
