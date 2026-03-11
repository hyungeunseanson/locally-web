export type AdminNotificationLike = {
  type?: string | null;
  link?: string | null;
};

export function isAdminAlertNotification(notification: AdminNotificationLike) {
  const link = notification.link?.trim() || '';
  if (link.startsWith('/admin')) return true;

  return notification.type === 'admin_alert';
}

export function getAdminNotificationCategory(notification: AdminNotificationLike) {
  const link = notification.link || '';

  if (link.includes('tab=CHATS')) return 'messages';
  if (link.includes('tab=TEAM')) return 'team';
  if (link.includes('tab=SERVICE_REQUESTS')) return 'services';
  if (link.includes('tab=LEDGER') || link.includes('tab=SALES')) return 'finance';
  return 'general';
}
