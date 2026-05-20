import * as Sentry from '@sentry/nextjs';

type PrimitiveContextValue = string | number | boolean | null | undefined;

export type LocallySentryContext = Record<string, PrimitiveContextValue>;
type SentryException = NonNullable<NonNullable<Sentry.ErrorEvent['exception']>['values']>[number];

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

function getFrameSearchText(exception: SentryException) {
  return (exception.stacktrace?.frames ?? [])
    .flatMap((frame) => [frame.filename, frame.abs_path, frame.module, frame.function])
    .filter(Boolean)
    .join(' ');
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

function shouldDropClientNoise(event: Sentry.ErrorEvent) {
  return shouldDropAndroidNativePostMessageNoise(event) || shouldDropSupabaseLockAbortNoise(event);
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
