import { expect, test } from '@playwright/test';
import type * as Sentry from '@sentry/nextjs';

import {
  getServerSentryInitOptions,
  isNextRouterStateHeaderParseError,
} from '@/app/utils/monitoring/sentry';

const ROUTER_STATE_PARSE_ERROR_MESSAGE =
  'The router state header was sent but could not be parsed.';

function createErrorEvent(frameFilename: string): Sentry.ErrorEvent {
  return {
    exception: {
      values: [
        {
          type: 'Error',
          value: ROUTER_STATE_PARSE_ERROR_MESSAGE,
          stacktrace: {
            frames: [
              {
                filename: frameFilename,
              },
            ],
          },
        },
      ],
    },
  } as Sentry.ErrorEvent;
}

test.describe('RSC router state header monitoring guard', () => {
  test('identifies the raw Next router state parse error before Sentry capture', () => {
    expect(isNextRouterStateHeaderParseError(new Error(ROUTER_STATE_PARSE_ERROR_MESSAGE))).toBe(true);
    expect(
      isNextRouterStateHeaderParseError(new Error(ROUTER_STATE_PARSE_ERROR_MESSAGE), {
        routerKind: 'App Router',
        routeType: 'render',
      })
    ).toBe(true);
    expect(
      isNextRouterStateHeaderParseError(new Error(ROUTER_STATE_PARSE_ERROR_MESSAGE), {
        routerKind: 'App Router',
        routeType: 'route',
      })
    ).toBe(false);
    expect(
      isNextRouterStateHeaderParseError(new Error(ROUTER_STATE_PARSE_ERROR_MESSAGE), {
        routerKind: 'Pages Router',
        routeType: 'render',
      })
    ).toBe(false);
    expect(isNextRouterStateHeaderParseError(new Error('Different request error'))).toBe(false);
  });

  test('drops the Next app-page router state parse event in server beforeSend', () => {
    const options = getServerSentryInitOptions();
    const result = options.beforeSend(
      createErrorEvent('/var/task/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js')
    );

    expect(result).toBeNull();
  });

  test('keeps similarly worded events without a Next app-page frame', () => {
    const options = getServerSentryInitOptions();
    const event = createErrorEvent('/var/task/app/api/example/route.ts');
    const result = options.beforeSend(event);

    expect(result).not.toBeNull();
    expect(result?.exception).toEqual(event.exception);
  });
});
