import * as Sentry from '@sentry/nextjs';

type PrimitiveContextValue = string | number | boolean | null | undefined;

export type LocallySentryContext = Record<string, PrimitiveContextValue>;

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

  return process.env.NODE_ENV || 'development';
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
    sendDefaultPii: false,
    beforeBreadcrumb() {
      return null;
    },
    beforeSend(event: Sentry.ErrorEvent) {
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
    return;
  }

  Sentry.withScope((scope) => {
    applyLocallyContext(scope, context);
    Sentry.captureException(error);
  });
}

export function captureServerException(error: unknown, context?: LocallySentryContext) {
  if (!isServerSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    applyLocallyContext(scope, context);
    Sentry.captureException(error);
  });
}
