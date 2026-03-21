import * as Sentry from '@sentry/nextjs';

import { getClientSentryInitOptions } from '@/app/utils/monitoring/sentry';

const options = getClientSentryInitOptions();

if (options.enabled) {
  Sentry.init(options);
}
