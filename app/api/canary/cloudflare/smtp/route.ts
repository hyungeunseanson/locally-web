import nodemailer from 'nodemailer';

import {
  canaryJson,
  hiddenCanaryResponse,
  isCloudflareFunctionalCanaryRequest,
} from '@/app/utils/cloudflareFunctionalCanary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SmtpProbeRequest = {
  port?: unknown;
  profile?: unknown;
};

function resolveCredentials(profile: 'transactional' | 'admin') {
  if (profile === 'admin') {
    return {
      user: process.env.ADMIN_GMAIL_USER,
      pass: process.env.ADMIN_GMAIL_APP_PASSWORD,
    };
  }

  return {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  };
}

export async function POST(request: Request) {
  if (!(await isCloudflareFunctionalCanaryRequest(request))) {
    return hiddenCanaryResponse();
  }

  const body = (await request.json().catch(() => null)) as SmtpProbeRequest | null;
  const port = body?.port === 465 || body?.port === 587 ? body.port : null;
  const profile = body?.profile === 'admin' ? 'admin' : 'transactional';
  if (!port) {
    return canaryJson({ error: 'Port must be 465 or 587' }, { status: 400 });
  }

  const credentials = resolveCredentials(profile);
  if (!credentials.user || !credentials.pass) {
    return canaryJson(
      { ok: false, profile, port, errorCode: 'credentials_missing' },
      { status: 503 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: credentials,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: {
      minVersion: 'TLSv1.2',
      servername: 'smtp.gmail.com',
    },
  });

  const startedAt = Date.now();
  try {
    await transporter.verify();
    return canaryJson({
      ok: true,
      profile,
      port,
      secure: port === 465,
      elapsedMs: Date.now() - startedAt,
      sent: false,
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'cloudflare functional canary SMTP verification failed',
      profile,
      port,
      error: error instanceof Error ? error.message : String(error),
    }));
    return canaryJson(
      {
        ok: false,
        profile,
        port,
        elapsedMs: Date.now() - startedAt,
        errorCode: 'smtp_verify_failed',
        sent: false,
      },
      { status: 502 }
    );
  } finally {
    transporter.close();
  }
}
