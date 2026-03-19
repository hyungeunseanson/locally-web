type LocallyKakaoIabState = {
  detected: boolean;
  kind: 'kakao';
  currentUrl: string;
};

declare global {
  interface Window {
    __LOCALLY_KAKAO_IAB__?: LocallyKakaoIabState;
  }
}

export {};
