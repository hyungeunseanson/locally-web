import * as Sentry from '@sentry/nextjs';

import { getServerSentryInitOptions, isServerSentryEnabled } from '@/app/utils/monitoring/sentry';

export async function register() {
  const options = getServerSentryInitOptions();

  if (!options.enabled) {
    return;
  }

  Sentry.init(options);
}

export const onRequestError = (...args: Parameters<typeof Sentry.captureRequestError>) => {
  if (!isServerSentryEnabled()) {
    return;
  }

  Sentry.captureRequestError(...args);
};
