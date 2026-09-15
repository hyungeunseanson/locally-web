import type { SupabaseClient } from '@supabase/supabase-js';
import { sendImmediateAdminEmail } from '@/app/utils/adminEmailProvider';
import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import {
  buildAdminPaymentConfirmedEmail,
  normalizeAdminAlertEmails,
  type AdminPaymentConfirmedEmailParams,
} from '@/app/utils/adminOperationalEmail';

export { normalizeAdminAlertEmails } from '@/app/utils/adminOperationalEmail';

type AdminAlertRecipient = {
  userId: string | null;
  email: string;
};

type RecipientRow = {
  id: string | null;
  email: string | null;
};

type AdminClient = SupabaseClient;

async function resolveAdminClient(client?: AdminClient) {
  if (client) return client;
  return (await import('@/app/utils/supabase/admin')).createAdminClient();
}

export async function resolveAdminAlertRecipientsForEmails(params: {
  emails: Array<string | null | undefined>;
  supabaseAdmin?: AdminClient;
}): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = await resolveAdminClient(params.supabaseAdmin);
  const emails = normalizeAdminAlertEmails(params.emails);

  if (emails.length === 0) {
    return [];
  }

  const emailToUserId = new Map<string, string>();

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', emails);

  if (profileError) {
    console.warn(JSON.stringify({
      event: 'admin_alert_recipient_resolution',
      status: 'fallback',
      diagnosticCode: 'profile_lookup_failed',
    }));
  } else {
    const safeProfileRows = (profileRows || []) as RecipientRow[];
    safeProfileRows.forEach((row) => {
      if (!row.id || !row.email) return;
      emailToUserId.set(row.email.trim().toLowerCase(), row.id);
    });
  }

  const unresolvedEmails = emails.filter((email) => !emailToUserId.has(email));

  if (unresolvedEmails.length > 0) {
    const { data: userRows, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('email', unresolvedEmails);

    if (userError) {
      console.warn(JSON.stringify({
        event: 'admin_alert_recipient_resolution',
        status: 'failed',
        diagnosticCode: 'user_lookup_failed',
      }));
    } else {
      const safeUserRows = (userRows || []) as RecipientRow[];
      safeUserRows.forEach((row) => {
        if (!row.id || !row.email) return;
        emailToUserId.set(row.email.trim().toLowerCase(), row.id);
      });
    }
  }

  const recipients = emails.map((email) => ({
    userId: emailToUserId.get(email) || null,
    email,
  }));

  const missingInAppRecipients = recipients
    .filter((recipient) => !recipient.userId)
    .map((recipient) => recipient.email);

  if (missingInAppRecipients.length > 0) {
    console.warn(
      JSON.stringify({
        event: 'admin_alert_recipient_resolution',
        status: 'partial',
        unresolvedCount: missingInAppRecipients.length,
        diagnosticCode: 'in_app_recipient_missing',
      })
    );
  }

  return recipients;
}

async function getAdminAlertRecipients(
  providedClient?: AdminClient
): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = await resolveAdminClient(providedClient);

  const { data: whitelistRows, error: whitelistError } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email');

  if (whitelistError) {
    throw new Error(whitelistError.message);
  }

  return resolveAdminAlertRecipientsForEmails({
    emails: (whitelistRows || []).map((row) => row.email),
    supabaseAdmin,
  });
}

export async function insertAdminAlerts(params: {
  title: string;
  message: string;
  link?: string | null;
}, options?: { supabaseAdmin?: AdminClient }) {
  const supabaseAdmin = await resolveAdminClient(options?.supabaseAdmin);
  const recipients = await getAdminAlertRecipients(supabaseAdmin);
  const inAppRecipients = recipients.filter((recipient): recipient is AdminAlertRecipient & { userId: string } => Boolean(recipient.userId));

  if (inAppRecipients.length === 0) {
    return { success: true, count: 0, targetCount: 0 };
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(inAppRecipients.map((recipient) => ({
      user_id: recipient.userId,
      type: 'admin_alert',
      title: params.title,
      message: params.message,
      link: params.link || '/admin/dashboard?tab=ALERTS',
      is_read: false,
    })));

  if (error) {
    throw new Error(error.message);
  }

  return { success: true, count: inAppRecipients.length, targetCount: inAppRecipients.length };
}

export async function sendAdminAlertEmails(params: {
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  ctaLabel?: string;
}, options?: {
  supabaseAdmin?: AdminClient;
  env?: EmailEnv;
  sendEmail?: typeof sendImmediateAdminEmail;
}) {
  const supabaseAdmin = await resolveAdminClient(options?.supabaseAdmin);
  const recipients = await getAdminAlertRecipients(supabaseAdmin);

  if (recipients.length === 0) {
    return { success: true, count: 0, targetCount: 0 };
  }

  let sentCount = 0;

  await Promise.all(recipients.map(async (recipient) => {
    try {
      const result = await (options?.sendEmail ?? sendImmediateAdminEmail)({
        to: recipient.email,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'notice.custom',
          audience: 'admin',
          payload: {
            subject: params.subject,
            title: params.title,
            message: params.message,
            ctaLabel: params.ctaLabel || '운영 대시보드 보기',
            ctaUrl: params.link || '/admin/dashboard?tab=ALERTS',
            footerVariant: 'opsAdmin',
          },
        },
      }, { supabaseAdmin, env: options?.env });

      if (result.sent) {
        sentCount += 1;
      }
    } catch {
      console.error(JSON.stringify({
        event: 'admin_alert_email_delivery',
        status: 'failed',
        diagnosticCode: 'email_delivery_failed',
      }));
    }
  }));

  return { success: true, count: sentCount, targetCount: recipients.length };
}

export async function sendAdminPaymentConfirmedEmail(
  params: AdminPaymentConfirmedEmailParams
) {
  return sendAdminAlertEmails(buildAdminPaymentConfirmedEmail(params));
}
