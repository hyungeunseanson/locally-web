import {
  canaryJson,
  hiddenCanaryResponse,
  isCloudflareFunctionalCanaryRequest,
} from '@/app/utils/cloudflareFunctionalCanary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRODUCTION_SUPABASE_PROJECT_REF = 'uhinvcydgzqlpnvieyal';

function getSupabaseProjectRef() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!(await isCloudflareFunctionalCanaryRequest(request))) {
    return hiddenCanaryResponse();
  }

  const supabaseProjectRef = getSupabaseProjectRef();
  const nonProductionSupabase = Boolean(
    supabaseProjectRef && supabaseProjectRef !== PRODUCTION_SUPABASE_PROJECT_REF
  );
  const paymentSandbox = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE === 'sandbox';

  return canaryJson({
    safe: nonProductionSupabase && paymentSandbox,
    runtime: {
      nodeEnv: process.env.NODE_ENV || null,
      canaryEnabled: process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED === 'true',
    },
    supabase: {
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      nonProduction: nonProductionSupabase,
      stagingWritesExplicitlyEnabled:
        nonProductionSupabase &&
        process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES === 'true',
    },
    auth: {
      googleConfigured: process.env.CLOUDFLARE_FUNCTIONAL_CANARY_GOOGLE_OAUTH === 'true',
      kakaoConfigured: process.env.CLOUDFLARE_FUNCTIONAL_CANARY_KAKAO_OAUTH === 'true',
    },
    payments: {
      sandbox: paymentSandbox,
      portOneConfigured: Boolean(
        process.env.NEXT_PUBLIC_PORTONE_IMP_CODE &&
          process.env.PORTONE_API_KEY &&
          process.env.PORTONE_API_SECRET
      ),
      nicePayConfigured: Boolean(
        process.env.NICEPAY_MID && process.env.NICEPAY_MERCHANT_KEY
      ),
      payPalSandboxConfigured: Boolean(
        process.env.PAYPAL_ENV === 'sandbox' &&
          process.env.PAYPAL_CLIENT_ID &&
          process.env.PAYPAL_CLIENT_SECRET
      ),
    },
    sentry: {
      configured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      serverProbeRoute: '/api/admin/sentry-test',
    },
    gmail: {
      transactionalConfigured: Boolean(
        process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ),
      adminConfigured: Boolean(
        process.env.ADMIN_GMAIL_USER && process.env.ADMIN_GMAIL_APP_PASSWORD
      ),
      probeSendsMail: false,
    },
  });
}
