import { getLocale } from 'next-intl/server';

export async function getCurrentLocale() {
  // next-intl 미들웨어가 설정한 locale 값을 반환
  // 기본값은 'ko'
  const locale = await getLocale();
  return locale || 'ko';
}
