'use client';

import React, { createContext, useContext, useState } from 'react';

// 📚 4개 국어 사전
const dictionary: any = {
  ko: {
    host_mode: "호스트 모드로 전환",
    become_host: "호스트 등록하기",
    guest_mode: "게스트 모드로 전환",
    login: "로그인",
    logout: "로그아웃",
    my_trips: "나의 여행",
    filter: "필터",
    all: "전체",
    culture: "문화/예술",
    food: "음식/투어",
    nature: "자연/야외",
    night: "나이트라이프",
    class: "원데이클래스",
    no_exp: "등록된 체험이 없습니다.",
    unit: "인",
    loc_unknown: "위치 정보 없음",
    login_required: "로그인이 필요합니다.",
    host_pending: "호스트 승인 대기중",
    apply_title: "한국인 파트너 지원",
    apply_desc: "Locally와 함께 일본의 매력을 소개하세요.",
    submit: "지원서 제출하기"
  },
  en: {
    host_mode: "Switch to Host",
    become_host: "Become a Host",
    guest_mode: "Switch to Guest",
    login: "Log in",
    logout: "Log out",
    my_trips: "My Trips",
    filter: "Filter",
    all: "All",
    culture: "Culture/Art",
    food: "Food/Tour",
    nature: "Nature",
    night: "Nightlife",
    class: "Classes",
    no_exp: "No experiences found.",
    unit: "person",
    loc_unknown: "Unknown Location",
    login_required: "Login required.",
    host_pending: "Application Pending",
    apply_title: "Apply as Partner",
    apply_desc: "Share the charm of Japan with Locally.",
    submit: "Submit Application"
  },
  ja: {
    host_mode: "ホストモードへ",
    become_host: "ホスト登録する",
    guest_mode: "ゲストモードへ",
    login: "ログイン",
    logout: "ログアウト",
    my_trips: "私の旅行",
    filter: "フィルター",
    all: "すべて",
    culture: "文化/芸術",
    food: "グルメ/ツアー",
    nature: "自然/アウトドア",
    night: "ナイトライフ",
    class: "体験教室",
    no_exp: "登録された体験がありません。",
    unit: "人",
    loc_unknown: "位置情報なし",
    login_required: "ログインが必要です。",
    host_pending: "承認待ち",
    apply_title: "パートナー支援",
    apply_desc: "Locallyと一緒に日本の魅力を紹介しましょう。",
    submit: "申請書を提出"
  },
  zh: {
    host_mode: "切换到房东模式",
    become_host: "注册成为房东",
    guest_mode: "切换到游客模式",
    login: "登录",
    logout: "退出",
    my_trips: "我的行程",
    filter: "筛选",
    all: "全部",
    culture: "文化/艺术",
    food: "美食/游览",
    nature: "自然/户外",
    night: "夜生活",
    class: "一日课程",
    no_exp: "没有找到体验。",
    unit: "人",
    loc_unknown: "未知位置",
    login_required: "请先登录。",
    host_pending: "等待批准",
    apply_title: "申请成为合作伙伴",
    apply_desc: "与Locally一起分享日本的魅力。",
    submit: "提交申请"
  }
};

const LanguageContext = createContext<any>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState('ko');

  const t = (key: string) => {
    return dictionary[lang]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);