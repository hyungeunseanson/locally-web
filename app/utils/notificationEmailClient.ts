type NotificationEmailUpdateResponse = {
  success?: boolean;
  notificationEmail?: string;
  error?: string;
};

export async function updateOwnNotificationEmail(email: string) {
  const response = await fetch('/api/account/notification-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const result = (await response.json()) as NotificationEmailUpdateResponse;

  if (!response.ok || !result.success || !result.notificationEmail) {
    throw new Error(result.error || 'Failed to save notification email.');
  }

  return result.notificationEmail;
}
