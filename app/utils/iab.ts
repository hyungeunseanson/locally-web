export type InAppBrowserKind = 'kakao';

export const IAB_ESCAPE_BYPASS_PARAM = 'locally_iab_bypass';
export const KAKAO_IAB_ATTEMPT_STORAGE_KEY = 'locally.kakao_iab.last_attempt_url';

const KAKAO_IAB_PATTERN = /KAKAOTALK/i;

export function isKakaoTalkIab(userAgent: string): boolean {
  return KAKAO_IAB_PATTERN.test(userAgent);
}

export function detectInAppBrowser(userAgent: string): InAppBrowserKind | null {
  return isKakaoTalkIab(userAgent) ? 'kakao' : null;
}

export function buildKakaoOpenExternalUrl(targetUrl: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(targetUrl)}`;
}

export function shouldBypassIabEscape(search: string): boolean {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const searchParams = new URLSearchParams(normalized);
  return searchParams.get(IAB_ESCAPE_BYPASS_PARAM) === '1';
}
