// app/utils/contentHelper.ts

/**
 * 4개 국어 데이터를 자동으로 선택해주는 만능 함수
 * @param data - 체험 데이터 (experience 객체)
 * @param field - 가져올 필드 이름 (예: 'title', 'description')
 * @param lang - 현재 언어 코드 ('ko', 'en', 'ja', 'zh')
 */
export function getContent(data: any, field: string, lang: string) {
    if (!data) return '';
    
    // 한국어(기본)일 때는 원래 필드 반환 (예: data.title)
    if (lang === 'ko' || !lang) return data[field];
  
    // 다른 언어일 때는 해당 언어 필드 찾기 (예: data.title_en)
    const targetField = `${field}_${lang}`;
    
    // 해당 언어 데이터가 있으면 반환, 없으면(빈칸이면) 한국어 반환
    return data[targetField] || data[field] || '';
  }