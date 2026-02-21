import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async () => {
  // 현재는 별도의 메시지 파일(JSON) 없이 DB 데이터를 주로 사용하므로 빈 객체 반환.
  // 추후 UI 정적 텍스트 번역이 필요하면 여기서 messages를 로드.
  return {
    locale: 'ko', // 기본값
    messages: {}
  };
});
