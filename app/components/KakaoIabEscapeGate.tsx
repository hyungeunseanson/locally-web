'use client';

import { useEffect, useRef, useState } from 'react';

import {
  buildKakaoOpenExternalUrl,
  KAKAO_IAB_ATTEMPT_STORAGE_KEY,
  shouldBypassIabEscape,
} from '@/app/utils/iab';

type Locale = 'ko' | 'en' | 'ja' | 'zh';
type KakaoIabEscapeGateProps = {
  locale: Locale;
  enabled: boolean;
};

type GateMode = 'idle' | 'attempting' | 'fallback' | 'copied';

type GateCopy = {
  title: string;
  description: string;
  attemptHint: string;
  retryLabel: string;
  copyLabel: string;
  copiedLabel: string;
  manualHint: string;
};

const COPY_MAP: Record<Locale, GateCopy> = {
  ko: {
    title: '브라우저에서 여는 중입니다',
    description: '카카오톡 내부 브라우저에서는 화면이 깨질 수 있어요. 외부 브라우저에서 다시 열어주세요.',
    attemptHint: '외부 브라우저로 여는 시도를 진행하고 있습니다.',
    retryLabel: '브라우저로 다시 열기',
    copyLabel: '링크 복사',
    copiedLabel: '링크가 복사되었어요',
    manualHint: '자동으로 열리지 않으면 카카오톡 메뉴에서 브라우저로 열기를 선택해주세요.',
  },
  en: {
    title: 'Opening in your browser',
    description: 'KakaoTalk in-app browser may render this page incorrectly. Please reopen it in your browser.',
    attemptHint: 'Trying to hand this page off to your browser now.',
    retryLabel: 'Open in browser again',
    copyLabel: 'Copy link',
    copiedLabel: 'Link copied',
    manualHint: 'If nothing happens, use the KakaoTalk menu option to open this page in your browser.',
  },
  ja: {
    title: 'ブラウザで開いています',
    description: 'KakaoTalkのアプリ内ブラウザでは表示が崩れることがあります。外部ブラウザで開き直してください。',
    attemptHint: '外部ブラウザで開く処理を試しています。',
    retryLabel: 'ブラウザで再度開く',
    copyLabel: 'リンクをコピー',
    copiedLabel: 'リンクをコピーしました',
    manualHint: '自動で開かない場合は、KakaoTalkのメニューからブラウザで開いてください。',
  },
  zh: {
    title: '正在浏览器中打开',
    description: 'KakaoTalk 内置浏览器可能会导致页面显示异常，请在外部浏览器中重新打开。',
    attemptHint: '正在尝试用外部浏览器打开此页面。',
    retryLabel: '重新在浏览器中打开',
    copyLabel: '复制链接',
    copiedLabel: '链接已复制',
    manualHint: '如果没有自动打开，请在 KakaoTalk 菜单中选择用浏览器打开。',
  },
};

function unlockDocument() {
  if (typeof document === 'undefined') return;

  document.documentElement.removeAttribute('data-iab');
  document.documentElement.removeAttribute('data-iab-lock');
}

function lockDocument() {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.iab = 'kakao';
  document.documentElement.dataset.iabLock = 'true';
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback below.
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
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

export default function KakaoIabEscapeGate({ locale, enabled }: KakaoIabEscapeGateProps) {
  const [mode, setMode] = useState<GateMode>('idle');
  const [currentUrl, setCurrentUrl] = useState('');
  const initializedRef = useRef(false);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      unlockDocument();
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!enabled || typeof window === 'undefined') {
      unlockDocument();
      return;
    }

    if (shouldBypassIabEscape(window.location.search)) {
      unlockDocument();
      delete window.__LOCALLY_KAKAO_IAB__;
      return;
    }

    const iabState = window.__LOCALLY_KAKAO_IAB__;

    if (!iabState?.detected || iabState.kind !== 'kakao') {
      unlockDocument();
      delete window.__LOCALLY_KAKAO_IAB__;
      return;
    }

    lockDocument();

    const nextUrl = iabState.currentUrl || window.location.href;
    const storage = getSessionStorage();
    const previousAttemptUrl = storage?.getItem(KAKAO_IAB_ATTEMPT_STORAGE_KEY);
    setCurrentUrl(nextUrl);

    if (previousAttemptUrl === nextUrl) {
      setMode('fallback');
      return;
    }

    storage?.setItem(KAKAO_IAB_ATTEMPT_STORAGE_KEY, nextUrl);
    setMode('attempting');

    try {
      window.location.href = buildKakaoOpenExternalUrl(nextUrl);
    } catch {
      setMode('fallback');
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setMode('fallback');
    }, 1200);

    return () => {
      window.clearTimeout(fallbackTimer);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      unlockDocument();
    };
  }, [enabled]);

  const copy = COPY_MAP[locale] || COPY_MAP.ko;
  const isVisible = mode !== 'idle';

  async function handleCopyLink() {
    if (!currentUrl) return;

    const copied = await copyToClipboard(currentUrl);
    if (!copied) return;

    setMode('copied');
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = window.setTimeout(() => {
      setMode('fallback');
    }, 2000);
  }

  function handleRetryOpen() {
    if (!currentUrl) return;
    window.location.href = buildKakaoOpenExternalUrl(currentUrl);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="kakao-iab-gate fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6 py-10"
      data-testid="kakao-iab-gate"
    >
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E8] text-lg font-semibold text-[#A3123A]">
            K
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              KakaoTalk IAB
            </p>
            <h1 className="text-xl font-semibold text-slate-950">{copy.title}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">{copy.description}</p>

        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {mode === 'attempting' ? (
            <span>{copy.attemptHint}</span>
          ) : (
            <span>{copy.manualHint}</span>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            className="rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
            onClick={handleRetryOpen}
            type="button"
          >
            {copy.retryLabel}
          </button>

          <button
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={handleCopyLink}
            type="button"
          >
            {mode === 'copied' ? copy.copiedLabel : copy.copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
