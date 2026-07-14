import { createAdminClient } from '@/app/utils/supabase/admin';
import { sendImmediateAdminEmail } from '@/app/utils/adminEmailProvider';
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

export async function resolveAdminAlertRecipientsForEmails(params: {
  emails: Array<string | null | undefined>;
  supabaseAdmin?: ReturnType<typeof createAdminClient>;
}): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = params.supabaseAdmin ?? createAdminClient();
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
    console.warn('[AdminAlertCenter] profiles email lookup failed, falling back to users:', profileError.message);
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
      console.warn('[AdminAlertCenter] users email fallback failed:', userError.message);
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
      `[AdminAlertCenter] Unable to resolve in-app admin recipients for whitelist emails: ${missingInAppRecipients.join(', ')}`
    );
  }

  return recipients;
}

async function getAdminAlertRecipients(): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = createAdminClient();

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
}) {
  const recipients = await getAdminAlertRecipients();
  const inAppRecipients = recipients.filter((recipient): recipient is AdminAlertRecipient & { userId: string } => Boolean(recipient.userId));

  if (inAppRecipients.length === 0) {
    return { success: true, count: 0, targetCount: 0 };
  }

  const supabaseAdmin = createAdminClient();
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
}) {
  const recipients = await getAdminAlertRecipients();

  if (recipients.length === 0) {
    return { success: true, count: 0, targetCount: 0 };
  }

  let sentCount = 0;

  await Promise.all(recipients.map(async (recipient) => {
    try {
      const result = await sendImmediateAdminEmail({
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
      });

      if (result.sent) {
        sentCount += 1;
      }
    } catch (error) {
      console.error(`[AdminAlertCenter] admin email failed (${recipient.email}):`, error);
    }
  }));

  return { success: true, count: sentCount, targetCount: recipients.length };
}

export async function sendAdminPaymentConfirmedEmail(
  params: AdminPaymentConfirmedEmailParams
) {
  return sendAdminAlertEmails(buildAdminPaymentConfirmedEmail(params));
}
