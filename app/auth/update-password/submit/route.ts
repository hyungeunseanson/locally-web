import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { authorizeRecovery, clearRecoveryCookie } from '@/app/utils/passwordRecovery.server';
import { RECOVERY_COOKIE_NAME, SIGNUP_PASSWORD_MIN_LENGTH } from '@/app/utils/passwordReset';
import { resolveAuthCallbackOrigin } from '@/app/utils/authRedirect';

function reply(result: string, status = 200, consume = false) {
  const response = NextResponse.json({ result }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (consume) clearRecoveryCookie(response);
  return response;
}

export async function POST(request: Request) {
  // Require same-origin JSON POST; never accept a cookie-authenticated CSRF.
  if (request.headers.get('origin') !== resolveAuthCallbackOrigin(request.url, request.headers)
    || !request.headers.get('content-type')?.startsWith('application/json')) return reply('invalid', 403);
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();
    const marker = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;
    if (!await authorizeRecovery(supabase, marker)) return reply('invalid', 403, true);
    const body = await request.text();
    if (body.length > 8192) return reply('input-invalid', 400);
    const input = JSON.parse(body) as { password?: unknown; confirmation?: unknown };
    if (typeof input.password !== 'string' || input.password.length < SIGNUP_PASSWORD_MIN_LENGTH
      || input.password !== input.confirmation) return reply('input-invalid', 400);
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) return reply([401, 403].includes(error.status ?? 0) ? 'invalid' : 'failed', 400);
    // Password change consumes Auth's recovery_sent_at. Clear the browser grant
    // as well; retries/replays must pass a fresh recovery callback.
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      return reply(signOutError ? 'cleanup-required' : 'success', 200, true);
    } catch {
      return reply('cleanup-required', 200, true);
    }
  } catch {
    // No raw provider body, submitted password, auth code, or token diagnostics.
    return reply('failed', 400);
  }
}
