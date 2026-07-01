import * as Sentry from '@sentry/nextjs';

type PrimitiveContextValue = string | number | boolean | null | undefined;

export type LocallySentryContext = Record<string, PrimitiveContextValue>;
type SentryException = NonNullable<NonNullable<Sentry.ErrorEvent['exception']>['values']>[number];
type NextRequestErrorContextLike = {
  routerKind?: string;
  routeType?: string;
};
const NEXT_ROUTER_STATE_HEADER_PARSE_ERROR_MESSAGE =
  'The router state header was sent but could not be parsed.';
const HISTORY_REPLACE_STATE_THROTTLE_MESSAGE =
  'Attempt to use history.replaceState() more than 100 times per 10 seconds';
const WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE =
  "undefined is not an object (evaluating 'window.webkit.messageHandlers')";

function sanitizeContext(context?: LocallySentryContext) {
  if (!context) {
    return undefined;
  }

  const entries = Object.entries(context).filter(([, value]) => value !== undefined && value !== null);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

function stripSensitiveData(event: Sentry.ErrorEvent) {
  const sanitizedEvent: Sentry.ErrorEvent = {
    ...event,
    user: undefined,
  };

  if (event.request) {
    sanitizedEvent.request = {
      ...event.request,
      cookies: undefined,
      data: undefined,
      headers: undefined,
      query_string: undefined,
      url: undefined,
    };
  }

  return sanitizedEvent;
}

function getExceptionText(exception: SentryException) {
  return [exception.type, exception.value].filter(Boolean).join(' ');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
}

function getFrameSearchText(exception: SentryException) {
  return (exception.stacktrace?.frames ?? [])
    .flatMap((frame) => [frame.filename, frame.abs_path, frame.module, frame.function])
    .filter(Boolean)
    .join(' ');
}

function hasTransaction(event: Sentry.ErrorEvent, transaction: string) {
  return event.transaction === transaction;
}

function shouldDropAndroidNativePostMessageNoise(event: Sentry.ErrorEvent) {
  return (event.exception?.values ?? []).some((exception) => {
    const exceptionText = getExceptionText(exception);
    const frameText = getFrameSearchText(exception);

    return (
      exceptionText.includes('Error invoking postMessage: Java object is gone') &&
      frameText.includes('navigation_performance_logger_android')
    );
  });
}

function shouldDropSupabaseLockAbortNoise(event: Sentry.ErrorEvent) {
  return (event.exception?.values ?? []).some((exception) => {
    const exceptionText = getExceptionText(exception);
    const frameText = getFrameSearchText(exception);

    return (
      exceptionText.includes('AbortError') &&
      exceptionText.includes('signal is aborted without reason') &&
      (frameText.includes('@supabase/auth-js') || frameText.includes('locks.ts'))
    );
  });
}

function shouldDropNextRouterStateHeaderParseNoise(event: Sentry.ErrorEvent) {
  return (event.exception?.values ?? []).some((exception) => {
    const exceptionText = getExceptionText(exception);
    const frameText = getFrameSearchText(exception);

    return (
      exceptionText.includes(NEXT_ROUTER_STATE_HEADER_PARSE_ERROR_MESSAGE) &&
      (frameText.includes('next-server/app-page') ||
        frameText.includes('app-page-turbo.runtime') ||
        frameText.includes('app-page.js'))
    );
  });
}

function shouldDropHistoryReplaceStateThrottleNoise(event: Sentry.ErrorEvent) {
  if (!hasTransaction(event, '/account')) {
    return false;
  }

  return (event.exception?.values ?? []).some((exception) => {
    const frameText = getFrameSearchText(exception);

    return (
      exception.type === 'SecurityError' &&
      exception.value === HISTORY_REPLACE_STATE_THROTTLE_MESSAGE &&
      frameText.includes('next') &&
      frameText.includes('app-router')
    );
  });
}

function shouldDropWebkitMessageHandlersNoise(event: Sentry.ErrorEvent) {
  if (!hasTransaction(event, '/become-a-host')) {
    return false;
  }

  return (event.exception?.values ?? []).some((exception) => {
    const frameText = getFrameSearchText(exception);

    return (
      exception.type === 'TypeError' &&
      exception.value === WEBKIT_MESSAGE_HANDLERS_ERROR_MESSAGE &&
      frameText.includes('app:///') &&
      (frameText.includes('sendDataToNative') || frameText.includes('sendPageHideMessage'))
    );
  });
}

function shouldDropClientNoise(event: Sentry.ErrorEvent) {
  return (
    shouldDropAndroidNativePostMessageNoise(event) ||
    shouldDropSupabaseLockAbortNoise(event) ||
    shouldDropHistoryReplaceStateThrottleNoise(event) ||
    shouldDropWebkitMessageHandlersNoise(event)
  );
}

function shouldDropServerNoise(event: Sentry.ErrorEvent) {
  return shouldDropNextRouterStateHeaderParseNoise(event);
}

export function isNextRouterStateHeaderParseError(
  error: unknown,
  context?: NextRequestErrorContextLike
) {
  if (!getErrorMessage(error).includes(NEXT_ROUTER_STATE_HEADER_PARSE_ERROR_MESSAGE)) {
    return false;
  }

  if (!context) {
    return true;
  }

  return context.routerKind === 'App Router' && context.routeType === 'render';
}

function applyLocallyContext(scope: Sentry.Scope, context?: LocallySentryContext) {
  const sanitizedContext = sanitizeContext(context);

  if (!sanitizedContext) {
    return;
  }

  scope.setContext('locally', sanitizedContext);

  if (sanitizedContext.route) {
    scope.setTag('locally_route', String(sanitizedContext.route));
  }

  if (sanitizedContext.method) {
    scope.setTag('locally_method', String(sanitizedContext.method));
  }

  if (sanitizedContext.boundary) {
    scope.setTag('locally_boundary', String(sanitizedContext.boundary));
  }
}

export function getSentryEnvironment() {
  if (typeof window === 'undefined') {
    return process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  }

  return process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
}

export function getClientSentryDsn() {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || '';
}

export function getServerSentryDsn() {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '';
}

export function isSentryEnabled() {
  return typeof window === 'undefined' ? isServerSentryEnabled() : isClientSentryEnabled();
}

export function isClientSentryEnabled() {
  return Boolean(getClientSentryDsn());
}

export function isServerSentryEnabled() {
  return Boolean(getServerSentryDsn());
}

export function getClientSentryInitOptions() {
  const dsn = getClientSentryDsn();

  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment: getSentryEnvironment(),
    enableLogs: false,
    sendDefaultPii: false,
    beforeBreadcrumb() {
      return null;
    },
    beforeSend(event: Sentry.ErrorEvent) {
      if (shouldDropClientNoise(event)) {
        return null;
      }

      return stripSensitiveData(event);
    },
  };
}

export function getServerSentryInitOptions() {
  const dsn = getServerSentryDsn();

  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment: getSentryEnvironment(),
    enableLogs: false,
    sendDefaultPii: false,
    beforeBreadcrumb() {
      return null;
    },
    beforeSend(event: Sentry.ErrorEvent) {
      if (shouldDropServerNoise(event)) {
        return null;
      }

      return stripSensitiveData(event);
    },
  };
}

export function captureClientException(error: unknown, context?: LocallySentryContext) {
  if (!isClientSentryEnabled()) {
    return undefined;
  }

  let eventId: string | undefined;
  Sentry.withScope((scope) => {
    applyLocallyContext(scope, context);
    eventId = Sentry.captureException(error);
  });

  return eventId;
}

export function captureServerException(error: unknown, context?: LocallySentryContext) {
  if (!isServerSentryEnabled()) {
    return undefined;
  }

  let eventId: string | undefined;
  Sentry.withScope((scope) => {
    applyLocallyContext(scope, context);
    eventId = Sentry.captureException(error);
  });

  return eventId;
}

export async function flushServerSentry(timeoutMs = 2000) {
  if (!isServerSentryEnabled()) {
    return true;
  }

  return Sentry.flush(timeoutMs);
}
