export const INSTAGRAM_IAB_PROMPT_PARAM = 'locally_external_prompt';
export const INSTAGRAM_IAB_PROMPT_VALUE = 'instagram';

const META_IN_APP_BROWSER_PATTERN = /Instagram|FBAN|FBAV|FB_IAB/i;

export function isMetaInAppBrowser(userAgent: string): boolean {
  return META_IN_APP_BROWSER_PATTERN.test(userAgent);
}

export function shouldShowInstagramIabPrompt(userAgent: string, search: string): boolean {
  if (!isMetaInAppBrowser(userAgent)) return false;

  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const searchParams = new URLSearchParams(normalizedSearch);
  return searchParams.get(INSTAGRAM_IAB_PROMPT_PARAM) === INSTAGRAM_IAB_PROMPT_VALUE;
}

export function removeInstagramIabPrompt(url: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.delete(INSTAGRAM_IAB_PROMPT_PARAM);
  return parsedUrl.toString();
}
