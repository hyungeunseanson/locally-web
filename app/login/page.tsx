import { permanentRedirect } from 'next/navigation';

import LoginPageClient from './LoginPageClient';

const LEGACY_IMWEB_LOGIN = 'https://locally2.imweb.me/login';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function appendSearchParams(
  target: URLSearchParams,
  searchParams: Record<string, string | string[] | undefined>
) {
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) target.append(key, item);
    } else if (value !== undefined) {
      target.append(key, value);
    }
  }
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  if (params.back_url !== undefined || params.used_login_btn !== undefined) {
    const query = new URLSearchParams();
    appendSearchParams(query, params);
    permanentRedirect(`${LEGACY_IMWEB_LOGIN}${query.size ? `?${query}` : ''}`);
  }

  return <LoginPageClient />;
}
