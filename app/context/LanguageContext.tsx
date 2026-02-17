'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// 📚 1. 타입 정의 (자동완성을 위해)
type Locale = 'ko' | 'en' | 'ja' | 'zh';

// 📚 2. 대규모 단어장 (섹션별로 정리)
const dictionary: Record<Locale, Record<string, string>> = {
  ko: {
    // [헤더 & 네비게이션]
    host_mode: "호스트 모드로 전환",
    become_host: "호스트 등록하기",
    guest_mode: "게스트 모드로 전환",
    login: "로그인",
    logout: "로그아웃",
    signup: "회원가입",
    my_trips: "나의 여행",
    wishlist: "위시리스트",
    messages: "메시지",
    account: "계정 관리",
    help: "도움말 센터",
    
    // [공통 액션]
    search: "검색",
    filter: "필터",
    close: "닫기",
    save: "저장",
    confirm: "확인",
    cancel: "취소",
    loading: "로딩 중...",
    
    // [카테고리]
    all: "전체",
    culture: "문화/예술",
    food: "음식/투어",
    nature: "자연/야외",
    night: "나이트라이프",
    class: "원데이클래스",
    
    // [예약/결제]
    price_unit: "인",
    total: "총 합계",
    reserve: "예약하기",
    reserve_private: "단독 투어 예약하기",
    sold_out: "매진",
    
    // [상태 메시지]
    no_exp: "등록된 체험이 없습니다.",
    login_required: "로그인이 필요합니다.",
    
    // [푸터]
    privacy: "개인정보처리방침",
    terms: "이용약관",
    company_info: "회사 정보"
  },
  en: {
    host_mode: "Switch to Host",
    become_host: "Become a Host",
    guest_mode: "Switch to Guest",
    login: "Log in",
    logout: "Log out",
    signup: "Sign up",
    my_trips: "Trips",
    wishlist: "Wishlist",
    messages: "Messages",
    account: "Account",
    help: "Help Center",
    search: "Search",
    filter: "Filter",
    close: "Close",
    save: "Save",
    confirm: "Confirm",
    cancel: "Cancel",
    loading: "Loading...",
    all: "All",
    culture: "Culture/Art",
    food: "Food/Drink",
    nature: "Nature",
    night: "Nightlife",
    class: "Classes",
    price_unit: "person",
    total: "Total",
    reserve: "Reserve",
    reserve_private: "Book Private",
    sold_out: "Sold Out",
    no_exp: "No experiences found.",
    login_required: "Login required.",
    privacy: "Privacy",
    terms: "Terms",
    company_info: "Company Details"
  },
  ja: {
    host_mode: "ホストモード",
    become_host: "ホストになる",
    guest_mode: "ゲストモード",
    login: "ログイン",
    logout: "ログアウト",
    signup: "会員登録",
    my_trips: "旅行",
    wishlist: "お気に入り",
    messages: "メッセージ",
    account: "アカウント",
    help: "ヘルプ",
    search: "検索",
    filter: "フィルター",
    close: "閉じる",
    save: "保存",
    confirm: "確認",
    cancel: "キャンセル",
    loading: "読み込み中...",
    all: "すべて",
    culture: "文化・芸術",
    food: "グルメ",
    nature: "自然",
    night: "ナイトライフ",
    class: "体験教室",
    price_unit: "人",
    total: "合計",
    reserve: "予約する",
    reserve_private: "貸切予約",
    sold_out: "売切れ",
    no_exp: "体験が見つかりません。",
    login_required: "ログインが必要です。",
    privacy: "プライバシー",
    terms: "利用規約",
    company_info: "会社情報"
  },
  zh: {
    host_mode: "切换房东模式",
    become_host: "开展体验",
    guest_mode: "切换游客模式",
    login: "登录",
    logout: "退出",
    signup: "注册",
    my_trips: "行程",
    wishlist: "心愿单",
    messages: "消息",
    account: "账号",
    help: "帮助",
    search: "搜索",
    filter: "筛选",
    close: "关闭",
    save: "保存",
    confirm: "确认",
    cancel: "取消",
    loading: "加载中...",
    all: "全部",
    culture: "文化艺术",
    food: "美食",
    nature: "自然户外",
    night: "夜生活",
    class: "课程",
    price_unit: "人",
    total: "总计",
    reserve: "预订",
    reserve_private: "包团预订",
    sold_out: "已售罄",
    no_exp: "没有找到体验。",
    login_required: "请先登录。",
    privacy: "隐私政策",
    terms: "服务条款",
    company_info: "公司信息"
  }
};

const LanguageContext = createContext<any>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // 기본값 한국어
  const [lang, setLang] = useState<Locale>('ko');

  // 🟢 새로고침해도 언어 유지
  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Locale;
    if (saved && dictionary[saved]) setLang(saved);
  }, []);

  const changeLang = (newLang: Locale) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  // 🟢 번역 함수 (키가 없으면 키 그대로 반환하여 디버깅 용이하게)
  const t = (key: string) => {
    return dictionary[lang]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);