import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';
import { hasSupabaseSessionCookie } from '@/app/utils/supabase/authCookies';
import { authorizeRecovery } from '@/app/utils/passwordRecovery.server';
import { RECOVERY_COOKIE_NAME } from '@/app/utils/passwordReset';
import PasswordResetForm from '../PasswordResetForm';

export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  let authenticated = false;
  const cookieStore = await cookies();
  if (hasSupabaseSessionCookie(cookieStore.getAll())) {
    try {
      const supabase = await createClient();
      authenticated = await authorizeRecovery(supabase, cookieStore.get(RECOVERY_COOKIE_NAME)?.value);
    } catch {
      // Authentication failures are rendered without raw provider diagnostics.
    }
  }
  return <PasswordResetForm mode={authenticated ? 'update' : 'invalid'} />;
}
