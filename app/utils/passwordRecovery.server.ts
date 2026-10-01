import 'server-only';

import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { RECOVERY_COOKIE_NAME, RECOVERY_COOKIE_PATH } from './passwordReset';

const MAX_RECOVERY_SECONDS = 10 * 60;
const SIGNING_DOMAIN = 'locally/password-recovery/v1';

type RecoveryIdentity = { userId: string; sessionId: string; recoverySentAt: string; recoveredAt: number };
type RecoveryGrant = RecoveryIdentity & { version: 1; issuedAt: number; expiresAt: number; nonce: string };

function signingKey() {
  // Reuse the existing server-only secret; never use the cron development
  // fallback, an anon key, a user token, or a service-role key as a signing key.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error('Recovery signing unavailable');
  return createHmac('sha256', secret).update(`${SIGNING_DOMAIN}/key`).digest();
}

function signature(payload: string) {
  return createHmac('sha256', signingKey()).update(`${SIGNING_DOMAIN}:${payload}`).digest();
}

export const recoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: RECOVERY_COOKIE_PATH,
};

// Call getUser with the exact token before inspecting its claims. Supabase
// verifies its signature AND active session; locally decoded claims alone
// must never authorize recovery. No user_metadata fields are trusted.
export async function validatedRecoveryIdentity(supabase: SupabaseClient, session?: Session): Promise<RecoveryIdentity | null> {
  const active = session ?? (await supabase.auth.getSession()).data.session;
  if (!active) return null;
  const { data, error } = await supabase.auth.getUser(active.access_token);
  if (error || !data.user || !data.user.recovery_sent_at) return null;
  const claims = JSON.parse(Buffer.from(active.access_token.split('.')[1], 'base64url').toString()) as {
    sub?: string; session_id?: string; exp?: number; amr?: { method: string; timestamp: number }[];
  };
  const now = Math.floor(Date.now() / 1000);
  const recovery = Array.isArray(claims.amr) ? claims.amr.find((entry) => entry.method === 'recovery') : undefined;
  if (claims.sub !== data.user.id || typeof claims.session_id !== 'string' || !claims.session_id
    || typeof claims.exp !== 'number' || claims.exp <= now
    || !recovery || !Number.isSafeInteger(recovery.timestamp)
    || recovery.timestamp > now + 60 || recovery.timestamp + MAX_RECOVERY_SECONDS <= now
    || !Number.isFinite(Date.parse(data.user.recovery_sent_at))) return null;
  return { userId: data.user.id, sessionId: claims.session_id, recoverySentAt: data.user.recovery_sent_at, recoveredAt: recovery.timestamp };
}

export function issueRecoveryGrant(identity: RecoveryIdentity) {
  const now = Math.floor(Date.now() / 1000);
  const grant: RecoveryGrant = {
    ...identity, version: 1, issuedAt: now,
    expiresAt: Math.min(now + MAX_RECOVERY_SECONDS, identity.recoveredAt + MAX_RECOVERY_SECONDS),
    nonce: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return { value: `${payload}.${signature(payload).toString('hex')}`, maxAge: grant.expiresAt - now };
}

function verifyRecoveryGrant(value: string): RecoveryGrant | null {
  if (value.length > 2048) return null;
  const [payload, signed, extra] = value.split('.');
  if (!payload || extra || !/^[a-f0-9]{64}$/.test(signed ?? '')) return null;
  if (!timingSafeEqual(signature(payload), Buffer.from(signed, 'hex'))) return null;
  const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as RecoveryGrant;
  const now = Math.floor(Date.now() / 1000);
  if (grant.version !== 1 || typeof grant.userId !== 'string' || typeof grant.sessionId !== 'string'
    || typeof grant.recoverySentAt !== 'string' || typeof grant.nonce !== 'string'
    || !Number.isSafeInteger(grant.issuedAt) || !Number.isSafeInteger(grant.expiresAt)
    || grant.issuedAt > now + 60 || grant.expiresAt <= now
    || grant.expiresAt - grant.issuedAt > MAX_RECOVERY_SECONDS) return null;
  return grant;
}

export async function authorizeRecovery(supabase: SupabaseClient, marker: string | undefined): Promise<boolean> {
  try {
    if (!marker) return false;
    const grant = verifyRecoveryGrant(marker);
    if (!grant) return false;
    const identity = await validatedRecoveryIdentity(supabase);
    // Auth clears recovery_sent_at inside the password-change transaction.
    // A replayed old cookie is rejected even if session cleanup failed.
    return Boolean(identity && grant.userId === identity.userId && grant.sessionId === identity.sessionId
      && grant.recoverySentAt === identity.recoverySentAt && grant.recoveredAt === identity.recoveredAt);
  } catch {
    return false;
  }
}

export function clearRecoveryCookie(response: { cookies: { set: (name: string, value: string, options: typeof recoveryCookieOptions & { maxAge: number; expires?: Date }) => unknown } }) {
  response.cookies.set(RECOVERY_COOKIE_NAME, '', { ...recoveryCookieOptions, maxAge: 0, expires: new Date(0) });
}
