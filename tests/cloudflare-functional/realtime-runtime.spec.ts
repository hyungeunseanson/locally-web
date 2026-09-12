import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { loginWithPassword, requiredEnv } from './helpers';

let admin: SupabaseClient;
let messageIds: number[] = [];
let notificationIds: number[] = [];

test.describe.serial('Supabase Realtime on the Worker canary', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(() => {
    admin = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  });

  test.afterEach(async () => {
    if (notificationIds.length > 0) {
      await admin.from('notifications').delete().in('id', notificationIds);
      notificationIds = [];
    }
    if (messageIds.length > 0) {
      await admin.from('inquiry_messages').delete().in('id', messageIds);
      messageIds = [];
    }
  });

  test('receives inquiry/chat and notification changes and reconnects after a socket disconnect', async ({ page }) => {
    test.setTimeout(150_000);
    const inquiryId = requiredEnv('CLOUDFLARE_CANARY_INQUIRY_ID');
    const guestId = requiredEnv('CLOUDFLARE_CANARY_GUEST_USER_ID');
    const hostId = requiredEnv('CLOUDFLARE_CANARY_HOST_USER_ID');
    const token = `cf-realtime-${Date.now()}`;
    let realtimeSockets = 0;
    await page.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      const realtimeSockets: WebSocket[] = [];

      class CanaryWebSocket extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          if (String(url).includes('/realtime/v1/websocket')) realtimeSockets.push(this);
        }
      }

      Object.defineProperty(window, 'WebSocket', { value: CanaryWebSocket });
      Object.defineProperty(window, '__locallyCanaryRealtimeSockets', { value: realtimeSockets });
    });
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
    messageIds.push(Number(message.id));

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
    notificationIds.push(Number(notification.id));

    await expect(
      page.getByTestId('guest-inbox-message-thread').getByText(token, { exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('[data-testid="guest-mobile-profile-unread-dot"]:visible')
    ).toBeVisible({ timeout: 30_000 });

    const beforeReconnect = realtimeSockets;
    await page.evaluate(() => {
      const sockets = (
        window as typeof window & { __locallyCanaryRealtimeSockets?: WebSocket[] }
      ).__locallyCanaryRealtimeSockets ?? [];
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) socket.close(4000, 'canary reconnect probe');
      }
    });
    await expect.poll(() => realtimeSockets, { timeout: 45_000 }).toBeGreaterThan(beforeReconnect);

    const reconnectToken = `${token}-reconnected`;
    const { data: reconnectMessage, error: reconnectMessageError } = await admin
      .from('inquiry_messages')
      .insert({
        inquiry_id: inquiryId,
        sender_id: hostId,
        content: reconnectToken,
        type: 'text',
        is_read: false,
        read_at: null,
      })
      .select('id')
      .single();
    if (reconnectMessageError || !reconnectMessage?.id) {
      throw reconnectMessageError || new Error('Reconnect message seed failed.');
    }
    messageIds.push(Number(reconnectMessage.id));

    await expect(
      page.getByTestId('guest-inbox-message-thread').getByText(reconnectToken, { exact: true })
    ).toBeVisible({ timeout: 45_000 });
  });
});
