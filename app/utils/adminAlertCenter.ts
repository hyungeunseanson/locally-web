import { createAdminClient } from '@/app/utils/supabase/admin';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type AdminAlertRecipient = {
  userId: string;
  email: string;
};

async function getAdminAlertRecipients(): Promise<AdminAlertRecipient[]> {
  const supabaseAdmin = createAdminClient();

  const { data: whitelistRows, error: whitelistError } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email');

  if (whitelistError) {
    throw new Error(whitelistError.message);
  }

  const emails = (whitelistRows || [])
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email));

  if (emails.length === 0) {
    return [];
  }

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', emails);

  if (profileError) {
    throw new Error(profileError.message);
  }

  return (profileRows || [])
    .filter((row) => row.id && row.email)
    .map((row) => ({
      userId: row.id as string,
      email: row.email as string,
    }));
}

export async function insertAdminAlerts(params: {
  title: string;
  message: string;
  link?: string | null;
}) {
  const recipients = await getAdminAlertRecipients();

  if (recipients.length === 0) {
    return { success: true, count: 0 };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(recipients.map((recipient) => ({
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

  return { success: true, count: recipients.length };
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
