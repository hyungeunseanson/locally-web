import DOMPurify from 'isomorphic-dompurify';

/**
 * XSS 방지: 입력된 텍스트에서 악성 스크립트 태그를 제거합니다.
 * 채팅 메시지, 리뷰, 자기소개 등 사용자가 입력하는 모든 곳에 사용하세요.
 */
export const sanitizeText = (text: string) => {
  if (!text) return '';
  
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // 🟢 모든 HTML 태그 제거 (순수 텍스트만 허용)
    ALLOWED_ATTR: [], // 속성도 모두 제거
  });
};

/**
 * 링크(URL) 보안 검사
 * 'javascript:', 'vbscript:', 'data:' 같은 악성 프로토콜을 막습니다.
 */
export const sanitizeUrl = (url: string) => {
  if (!url) return '';
  const cleanUrl = url.trim().toLowerCase();
  
  if (
    cleanUrl.startsWith('javascript:') ||
    cleanUrl.startsWith('vbscript:') ||
    cleanUrl.startsWith('data:')
  ) {
    return ''; // 위험한 URL은 빈 문자열로 바꿔버림
  }
  return url;
};