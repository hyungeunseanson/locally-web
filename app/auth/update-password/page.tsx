import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';
import { hasSupabaseSessionCookie } from '@/app/utils/supabase/authCookies';
import PasswordResetForm from '../PasswordResetForm';

export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  let authenticated = false;
  if (hasSupabaseSessionCookie((await cookies()).getAll())) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      authenticated = !error && Boolean(data.user);
    } catch {
      // Authentication failures are rendered without raw provider diagnostics.
    }
  }
  return <PasswordResetForm mode={authenticated ? 'update' : 'invalid'} />;
}
