import * as Sentry from '@sentry/nextjs';

import {
  getServerSentryInitOptions,
  isNextRouterStateHeaderParseError,
  isServerSentryEnabled,
} from '@/app/utils/monitoring/sentry';

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

  if (isNextRouterStateHeaderParseError(args[0], args[2])) {
    return;
  }

  Sentry.captureRequestError(...args);
};
