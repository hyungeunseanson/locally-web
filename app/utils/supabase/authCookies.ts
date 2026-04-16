type CookieLike = {
  name: string;
};

const SUPABASE_SESSION_COOKIE_PATTERNS = [
  /-auth-token(?:\.\d+)?$/i,
  /-refresh-token(?:\.\d+)?$/i,
];

export function hasSupabaseSessionCookie(cookies: readonly CookieLike[]): boolean {
  return cookies.some(({ name }) =>
    SUPABASE_SESSION_COOKIE_PATTERNS.some((pattern) => pattern.test(name))
  );
}
