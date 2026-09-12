import {
  canaryJson,
  hiddenCanaryResponse,
  isCloudflareFunctionalCanaryRequest,
} from '@/app/utils/cloudflareFunctionalCanary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WRITE_GATES = ['auth', 'realtime', 'storage', 'portone', 'nicepay', 'paypal'] as const;
type WriteGate = (typeof WRITE_GATES)[number];
const KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS = new Set(['uhinvcydgzqlpnvieyal']);

function getSupabaseProjectRef() {
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    const projectRef = hostname.slice(0, -suffix.length);
    return /^[a-z0-9]{20}$/.test(projectRef) ? projectRef : null;
  } catch {
    return null;
  }
}

function getWriteGate(): WriteGate | null {
  const value = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE;
  return WRITE_GATES.find((gate) => gate === value) || null;
}

export async function GET(request: Request) {
  if (!(await isCloudflareFunctionalCanaryRequest(request))) {
    return hiddenCanaryResponse();
  }

  const supabaseProjectRef = getSupabaseProjectRef();
  const declaredStagingProjectRef =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_SUPABASE_PROJECT_REF?.trim() || null;
  const stagingTierDeclared =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SUPABASE_TIER === 'staging';
  const stagingProjectVerified =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_PROJECT_VERIFIED === 'true';
  const stagingTargetMatches = Boolean(
    supabaseProjectRef &&
      declaredStagingProjectRef &&
      /^[a-z0-9]{20}$/.test(declaredStagingProjectRef) &&
      supabaseProjectRef === declaredStagingProjectRef &&
      !KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS.has(supabaseProjectRef)
  );
  const stagingWritesExplicitlyEnabled =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES === 'true';
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const paymentSandbox = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE === 'sandbox';
  const portOneConfigured = Boolean(
    process.env.CARD_PAYMENT_PROVIDER === 'portone' &&
      process.env.NEXT_PUBLIC_PORTONE_IMP_CODE &&
      process.env.PORTONE_API_KEY &&
      process.env.PORTONE_API_SECRET
  );
  const nicePayConfigured = Boolean(
    process.env.CARD_PAYMENT_PROVIDER === 'nicepay' &&
      process.env.NICEPAY_MID &&
      process.env.NICEPAY_MERCHANT_KEY
  );
  const payPalSandboxConfigured = Boolean(
    process.env.PAYPAL_ENV === 'sandbox' &&
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
  );
  const googleOAuthConfigured =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_GOOGLE_OAUTH === 'true';
  const kakaoOAuthConfigured =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_KAKAO_OAUTH === 'true';
  const activeWriteGate = getWriteGate();
  const activeWriteGateConfigured = Boolean(
    activeWriteGate &&
      supabaseConfigured &&
      (activeWriteGate === 'auth'
        ? googleOAuthConfigured && kakaoOAuthConfigured
        : activeWriteGate === 'portone'
          ? portOneConfigured
          : activeWriteGate === 'nicepay'
            ? nicePayConfigured
            : activeWriteGate === 'paypal'
              ? payPalSandboxConfigured
              : true)
  );
  const safe = Boolean(
    stagingTierDeclared &&
      stagingProjectVerified &&
      stagingTargetMatches &&
      stagingWritesExplicitlyEnabled &&
      paymentSandbox &&
      activeWriteGateConfigured
  );

  return canaryJson({
    safe,
    runtime: {
      nodeEnv: process.env.NODE_ENV || null,
      canaryEnabled: process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED === 'true',
    },
    supabase: {
      configured: supabaseConfigured,
      stagingTargetMatches,
      stagingTierDeclared,
      stagingProjectVerified,
      stagingWritesExplicitlyEnabled,
    },
    safety: {
      activeWriteGate,
      activeWriteGateConfigured,
    },
    auth: {
      googleConfigured: googleOAuthConfigured,
      kakaoConfigured: kakaoOAuthConfigured,
    },
    payments: {
      sandbox: paymentSandbox,
      portOneConfigured,
      nicePayConfigured,
      payPalSandboxConfigured,
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
