import { expect, test } from '@playwright/test';
import type * as Sentry from '@sentry/nextjs';

import { getClientSentryInitOptions } from '@/app/utils/monitoring/sentry';

const HISTORY_REPLACE_STATE_THROTTLE_MESSAGE =
  'Attempt to use history.replaceState() more than 100 times per 10 seconds';
const WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE =
  "undefined is not an object (evaluating 'window.webkit.messageHandlers')";

function createClientErrorEvent(params: {
  type: string;
  value: string;
  transaction: string;
  frameFilename: string;
  frameFunction?: string;
}): Sentry.ErrorEvent {
  return {
    transaction: params.transaction,
    exception: {
      values: [
        {
          type: params.type,
          value: params.value,
          stacktrace: {
            frames: [
              {
                filename: params.frameFilename,
                function: params.frameFunction,
              },
            ],
          },
        },
      ],
    },
  } as Sentry.ErrorEvent;
}

test.describe('Sentry client noise guards', () => {
  test('drops only the /account Next app-router history.replaceState throttle noise', () => {
    const options = getClientSentryInitOptions();
    const exactEvent = createClientErrorEvent({
      type: 'SecurityError',
      value: HISTORY_REPLACE_STATE_THROTTLE_MESSAGE,
      transaction: '/account',
      frameFilename: 'node_modules/next/src/client/components/app-router.tsx',
      frameFunction: 'lastEffect',
    });

    expect(options.beforeSend(exactEvent)).toBeNull();

    const wrongRouteEvent = createClientErrorEvent({
      type: 'SecurityError',
      value: HISTORY_REPLACE_STATE_THROTTLE_MESSAGE,
      transaction: '/search',
      frameFilename: 'node_modules/next/src/client/components/app-router.tsx',
      frameFunction: 'lastEffect',
    });
    expect(options.beforeSend(wrongRouteEvent)).not.toBeNull();

    const appFrameEvent = createClientErrorEvent({
      type: 'SecurityError',
      value: HISTORY_REPLACE_STATE_THROTTLE_MESSAGE,
      transaction: '/account',
      frameFilename: '/var/task/app/account/page.tsx',
      frameFunction: 'replaceAccountUrl',
    });
    expect(options.beforeSend(appFrameEvent)).not.toBeNull();

    const extendedMessageEvent = createClientErrorEvent({
      type: 'SecurityError',
      value: `${HISTORY_REPLACE_STATE_THROTTLE_MESSAGE}: app detail`,
      transaction: '/account',
      frameFilename: 'node_modules/next/src/client/components/app-router.tsx',
      frameFunction: 'lastEffect',
    });
    expect(options.beforeSend(extendedMessageEvent)).not.toBeNull();

    const wrongTypeEvent = createClientErrorEvent({
      type: 'Error',
      value: HISTORY_REPLACE_STATE_THROTTLE_MESSAGE,
      transaction: '/account',
      frameFilename: 'node_modules/next/src/client/components/app-router.tsx',
      frameFunction: 'lastEffect',
    });
    expect(options.beforeSend(wrongTypeEvent)).not.toBeNull();
  });

  test('drops only the /become-a-host injected native bridge webkit noise', () => {
    const options = getClientSentryInitOptions();
    const exactEvent = createClientErrorEvent({
      type: 'TypeError',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/become-a-host',
      frameFilename: 'app:///become-a-host',
      frameFunction: 'sendDataToNative',
    });

    expect(options.beforeSend(exactEvent)).toBeNull();

    const pageHideEvent = createClientErrorEvent({
      type: 'TypeError',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/become-a-host',
      frameFilename: 'app:///become-a-host',
      frameFunction: 'sendPageHideMessage',
    });

    expect(options.beforeSend(pageHideEvent)).toBeNull();

    const appFrameEvent = createClientErrorEvent({
      type: 'TypeError',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/become-a-host',
      frameFilename: '/var/task/app/become-a-host/page.tsx',
      frameFunction: 'sendDataToNative',
    });
    expect(options.beforeSend(appFrameEvent)).not.toBeNull();

    const wrongRouteEvent = createClientErrorEvent({
      type: 'TypeError',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/account',
      frameFilename: 'app:///account',
      frameFunction: 'sendDataToNative',
    });
    expect(options.beforeSend(wrongRouteEvent)).not.toBeNull();

    const extendedMessageEvent = createClientErrorEvent({
      type: 'TypeError',
      value: `${WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE}: app detail`,
      transaction: '/become-a-host',
      frameFilename: 'app:///become-a-host',
      frameFunction: 'sendDataToNative',
    });
    expect(options.beforeSend(extendedMessageEvent)).not.toBeNull();

    const wrongTypeEvent = createClientErrorEvent({
      type: 'Error',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/become-a-host',
      frameFilename: 'app:///become-a-host',
      frameFunction: 'sendDataToNative',
    });
    expect(options.beforeSend(wrongTypeEvent)).not.toBeNull();

    const unrelatedNativeFrameEvent = createClientErrorEvent({
      type: 'TypeError',
      value: WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE,
      transaction: '/become-a-host',
      frameFilename: 'app:///become-a-host',
      frameFunction: 'renderHostLanding',
    });
    expect(options.beforeSend(unrelatedNativeFrameEvent)).not.toBeNull();
  });
});

test.describe('Account login redirect guard', () => {
  test('redirects unauthenticated account visitors without a replaceState storm', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(`${error.name}: ${error.message}`);
    });

    await page.addInitScript(() => {
      const calls: Array<{ url: string | null }> = [];
      (window as unknown as { __locallyReplaceStateCalls: Array<{ url: string | null }> })
        .__locallyReplaceStateCalls = calls;
      const originalReplaceState = window.history.replaceState.bind(window.history);

      window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
        calls.push({ url: url == null ? null : String(url) });
        return originalReplaceState(data, unused, url);
      }) as History['replaceState'];
    });

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Faccount$/);
    await page.waitForTimeout(1000);

    const replaceStateCalls = await page.evaluate(() => (
      (window as unknown as { __locallyReplaceStateCalls?: Array<{ url: string | null }> })
        .__locallyReplaceStateCalls ?? []
    ));

    expect(replaceStateCalls.length).toBeLessThan(10);
    expect(
      pageErrors.filter((message) => message.includes(HISTORY_REPLACE_STATE_THROTTLE_MESSAGE))
    ).toEqual([]);
  });
});
