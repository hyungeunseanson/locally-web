import { createAdminClient } from '@/app/utils/supabase/admin';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type AdminAlertRecipient = {
  userId: string | null;
  email: string;
};

type RecipientRow = {
  id: string | null;
  email: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getAdminAlertRecipients(): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = createAdminClient();

  const { data: whitelistRows, error: whitelistError } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email');

  if (whitelistError) {
    throw new Error(whitelistError.message);
  }

  const emails = Array.from(new Set(
    (whitelistRows || [])
      .map((row) => row.email)
      .filter((email): email is string => Boolean(email))
      .map(normalizeEmail)
  ));

  if (emails.length === 0) {
    return [];
  }

  const emailToUserId = new Map<string, string>();

  const { data: userRows, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .in('email', emails);

  if (userError) {
    console.warn('[AdminAlertCenter] users email lookup failed, falling back to profiles:', userError.message);
  } else {
    const safeUserRows = (userRows || []) as RecipientRow[];
    safeUserRows.forEach((row) => {
      if (!row.id || !row.email) return;
      emailToUserId.set(normalizeEmail(row.email), row.id);
    });
  }

  const unresolvedEmails = emails.filter((email) => !emailToUserId.has(email));

  if (unresolvedEmails.length > 0) {
    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('email', unresolvedEmails);

    if (profileError) {
      console.warn('[AdminAlertCenter] profiles email fallback failed:', profileError.message);
    } else {
      const safeProfileRows = (profileRows || []) as RecipientRow[];
      safeProfileRows.forEach((row) => {
        if (!row.id || !row.email) return;
        emailToUserId.set(normalizeEmail(row.email), row.id);
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

export async function insertAdminAlerts(params: {
  title: string;
  message: string;
  link?: string | null;
}) {
  const recipients = await getAdminAlertRecipients();
  const inAppRecipients = recipients.filter((recipient): recipient is AdminAlertRecipient & { userId: string } => Boolean(recipient.userId));

  if (inAppRecipients.length === 0) {
    return { success: true, count: 0 };
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

  return { success: true, count: inAppRecipients.length };
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
    return { success: true, count: 0 };
  }

  let sentCount = 0;

  await Promise.all(recipients.map(async (recipient) => {
    try {
      const result = await sendImmediateGenericEmail({
        recipientEmail: recipient.email,
        subject: params.subject,
        title: params.title,
        message: params.message,
        link: params.link || '/admin/dashboard?tab=ALERTS',
        ctaLabel: params.ctaLabel || '운영 대시보드 보기',
      });

      if (result.sent) {
        sentCount += 1;
      }
    } catch (error) {
      console.error(`[AdminAlertCenter] admin email failed (${recipient.email}):`, error);
    }
  }));

  return { success: true, count: sentCount };
}
