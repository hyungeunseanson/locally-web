'use client';

import { Check, Compass, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/context/LanguageContext';
import {
  INSTAGRAM_IAB_PROMPT_PARAM,
  removeInstagramIabPrompt,
  shouldShowInstagramIabPrompt,
} from '@/app/utils/instagramIabPrompt';

const COPY = {
  ko: {
    eyebrow: 'Locally',
    title: '외부 브라우저에서 더 편리하게 이용하세요',
    description: '로그인과 결제는 Safari 또는 Chrome에서 더 안정적이에요. 인스타그램 오른쪽 위 메뉴에서 외부 브라우저로 열 수 있습니다.',
    continueHere: '현재 창에서 계속하기',
    copyLink: '링크 복사',
    copied: '링크가 복사되었어요',
  },
  en: {
    eyebrow: 'Locally',
    title: 'For a smoother experience, use your browser',
    description: 'Sign-in and payment work more reliably in Safari or Chrome. Use the Instagram menu in the top-right corner to open your browser.',
    continueHere: 'Continue in this window',
    copyLink: 'Copy link',
    copied: 'Link copied',
  },
  ja: {
    eyebrow: 'Locally',
    title: '外部ブラウザでより快適にご利用いただけます',
    description: 'ログインと決済はSafariまたはChromeのほうが安定しています。Instagram右上のメニューから外部ブラウザで開けます。',
    continueHere: 'この画面で続ける',
    copyLink: 'リンクをコピー',
    copied: 'リンクをコピーしました',
  },
  zh: {
    eyebrow: 'Locally',
    title: '使用外部浏览器会更加顺畅',
    description: '使用 Safari 或 Chrome 登录和付款更加稳定。您可以从 Instagram 右上角菜单中选择外部浏览器。',
    continueHere: '在当前窗口继续',
    copyLink: '复制链接',
    copied: '链接已复制',
  },
} as const;

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Use the selection fallback when clipboard permission is unavailable.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export default function InstagramIabPrompt() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const cleanUrlRef = useRef('');
  const copyResetTimerRef = useRef<number | null>(null);
  const copy = COPY[lang] || COPY.ko;

  useEffect(() => {
    const currentUrl = window.location.href;
    const searchParams = new URL(currentUrl).searchParams;
    if (!searchParams.has(INSTAGRAM_IAB_PROMPT_PARAM)) return;

    cleanUrlRef.current = removeInstagramIabPrompt(currentUrl);
    if (shouldShowInstagramIabPrompt(navigator.userAgent || '', window.location.search)) {
      const showTimer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(showTimer);
    }

    window.history.replaceState(window.history.state, '', cleanUrlRef.current);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  function continueHere() {
    setVisible(false);
    window.history.replaceState(window.history.state, '', cleanUrlRef.current);
  }

  async function copyLink() {
    if (!cleanUrlRef.current) return;
    const succeeded = await copyText(cleanUrlRef.current);
    if (!succeeded) return;

    setCopied(true);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  if (!visible) return null;

  return (
    <div
      aria-labelledby="instagram-iab-prompt-title"
      aria-modal="true"
      className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/20 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-10 backdrop-blur-[3px] sm:items-center sm:p-6"
      data-testid="instagram-iab-prompt"
      role="dialog"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.48)] backdrop-blur-3xl backdrop-saturate-150 sm:p-6"
        data-testid="instagram-iab-prompt-panel"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/90 bg-white/70 text-slate-900 shadow-sm">
          <Compass aria-hidden="true" size={21} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-500">{copy.eyebrow}</p>
        <h2 id="instagram-iab-prompt-title" className="mt-1.5 text-[23px] font-bold leading-8 text-slate-950">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.description}</p>

        <div className="mt-6 space-y-2.5">
          <button
            className="min-h-12 w-full rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition active:scale-[0.99]"
            data-testid="instagram-iab-continue"
            onClick={continueHere}
            type="button"
          >
            {copy.continueHere}
          </button>
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/90 bg-white/65 px-5 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-[0.99]"
            onClick={copyLink}
            type="button"
          >
            {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
            {copied ? copy.copied : copy.copyLink}
          </button>
        </div>
      </div>
    </div>
  );
}
