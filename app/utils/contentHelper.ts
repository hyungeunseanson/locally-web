// app/utils/contentHelper.ts

import { getLocalizedCategoryLabel } from '@/app/utils/experienceTranslation';

/**
 * 4개 국어 데이터를 자동으로 선택해주는 만능 함수
 * @param data - 체험 데이터 (experience 객체)
 * @param field - 가져올 필드 이름 (예: 'title', 'description')
 * @param lang - 현재 언어 코드 ('ko', 'en', 'ja', 'zh')
 */
export function getContent<T extends object>(data: T | null | undefined, field: string, lang: string) {
    if (!data) return '';

    const source = data as Record<string, unknown>;
    const targetLang = lang || 'ko';
    const targetField = `${field}_${targetLang}`;

    // locale 전용 컬럼이 있으면 우선 사용하고, 없으면 canonical 원문 필드로 fallback
    const localizedValue = source[targetField];
    const canonicalValue = source[field];

    if (typeof localizedValue === 'string' && localizedValue.trim()) {
      return localizedValue;
    }

    if (field === 'category') {
      const localizedCategory = getLocalizedCategoryLabel(canonicalValue, targetLang);
      if (localizedCategory) {
        return localizedCategory;
      }
    }

    if (typeof canonicalValue === 'string') {
      return canonicalValue;
    }

    return '';
  }
