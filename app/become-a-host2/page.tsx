import { permanentRedirect } from 'next/navigation';

type SearchParamMap = { [key: string]: string | string[] | undefined };

function serializeSearchParams(params: SearchParamMap) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'undefined') continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        search.append(key, entry);
      }
      continue;
    }

    search.append(key, value);
  }

  return search.toString();
}

export default async function BecomeAHost2RedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamMap>;
}) {
  const params = await searchParams;
  const query = serializeSearchParams(params);
  const targetPath = query ? `/become-a-host?${query}` : '/become-a-host';

  permanentRedirect(targetPath);
}
