import { createAdminClient } from '@/app/utils/supabase/admin';

export type NotificationLocale = 'ko' | 'en' | 'ja' | 'zh';

type AdminClient = ReturnType<typeof createAdminClient>;

export function normalizeNotificationLocale(value: unknown): NotificationLocale | null {
  if (typeof value !== 'string') return null;

  const normalized = value.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return null;
}

export async function resolveRecipientLocale(
  supabaseAdmin: AdminClient,
  userId: string
): Promise<NotificationLocale> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.warn('[notificationLocale] failed to resolve recipient locale:', error);
      return 'ko';
    }

    const metadata =
      data.user?.user_metadata && typeof data.user.user_metadata === 'object'
        ? (data.user.user_metadata as Record<string, unknown>)
        : null;

    return normalizeNotificationLocale(metadata?.preferred_locale) || 'ko';
  } catch (error) {
    console.warn('[notificationLocale] unexpected recipient locale lookup failure:', error);
    return 'ko';
  }
}
