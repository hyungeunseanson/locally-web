// Existing signup hint and Supabase Auth policy both require six characters.
export const SIGNUP_PASSWORD_MIN_LENGTH = 6;

export function buildPasswordRecoveryRedirect(origin: string): string {
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', '/auth/update-password');
  callback.searchParams.set('flow', 'recovery');
  return callback.toString();
}

export function isPasswordResetPath(pathname: string | null): boolean {
  const path = (pathname ?? '').replace(/^\/(ko|en|ja|zh)(?=\/)/, '');
  return path === '/auth/forgot-password' || path === '/auth/update-password';
}
