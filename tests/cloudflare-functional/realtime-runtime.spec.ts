import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { loginWithPassword, requiredEnv } from './helpers';

let admin: SupabaseClient;
let messageId: number | null = null;
let notificationId: number | null = null;

test.describe.serial('Supabase Realtime on the Worker canary', () => {
  test.beforeAll(() => {
    admin = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  });

  test.afterEach(async () => {
    if (notificationId !== null) {
      await admin.from('notifications').delete().eq('id', notificationId);
      notificationId = null;
    }
    if (messageId !== null) {
      await admin.from('inquiry_messages').delete().eq('id', messageId);
      messageId = null;
    }
  });

  test('receives inquiry/chat and notification changes and reconnects after an offline transition', async ({ context, page }) => {
    const inquiryId = requiredEnv('CLOUDFLARE_CANARY_INQUIRY_ID');
    const guestId = requiredEnv('CLOUDFLARE_CANARY_GUEST_USER_ID');
    const hostId = requiredEnv('CLOUDFLARE_CANARY_HOST_USER_ID');
    const token = `cf-realtime-${Date.now()}`;
    let realtimeSockets = 0;
    page.on('websocket', (socket) => {
      if (socket.url().includes('/realtime/v1/websocket')) realtimeSockets += 1;
    });

    await loginWithPassword(page);
    await page.goto(`/guest/inbox?inquiryId=${encodeURIComponent(inquiryId)}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect.poll(() => realtimeSockets, { timeout: 30_000 }).toBeGreaterThan(0);

    const { data: inquiry, error: inquiryError } = await admin
      .from('inquiries')
      .select('user_id, host_id')
      .eq('id', inquiryId)
      .single();
    if (inquiryError) throw inquiryError;
    expect(inquiry).toMatchObject({ user_id: guestId, host_id: hostId });

    const { data: message, error: messageError } = await admin
      .from('inquiry_messages')
      .insert({
        inquiry_id: inquiryId,
        sender_id: hostId,
        content: token,
        type: 'text',
        is_read: false,
        read_at: null,
      })
      .select('id')
      .single();
    if (messageError || !message?.id) throw messageError || new Error('Message seed failed.');
    messageId = Number(message.id);

    const { data: notification, error: notificationError } = await admin
      .from('notifications')
      .insert({
        user_id: guestId,
        type: 'new_message',
        title: 'Cloudflare functional canary',
        message: token,
        link: `/guest/inbox?inquiryId=${encodeURIComponent(inquiryId)}`,
        is_read: false,
      })
      .select('id')
      .single();
    if (notificationError || !notification?.id) {
      throw notificationError || new Error('Notification seed failed.');
    }
    notificationId = Number(notification.id);

    await expect(page.getByText(token, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('guest-mobile-profile-unread-dot')).toBeVisible({ timeout: 30_000 });

    const beforeReconnect = realtimeSockets;
    await context.setOffline(true);
    await page.waitForTimeout(1_500);
    await context.setOffline(false);
    await expect.poll(() => realtimeSockets, { timeout: 30_000 }).toBeGreaterThan(beforeReconnect);
  });
});
