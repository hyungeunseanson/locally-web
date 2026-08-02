'use client';

import { Check, Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

type ExternalBrowserHandoffProps = {
  androidIntentUrl: string | null;
  destinationUrl: string;
  locale: Locale;
};

const COPY = {
  ko: {
    eyebrow: '더 편리한 예약을 위해',
    title: '외부 브라우저에서 열어주세요',
    description: '로그인과 결제를 안정적으로 이용하려면 Safari 또는 Chrome으로 이동하는 것이 좋아요.',
    androidAction: 'Chrome에서 계속하기',
    iosStepTitle: 'iPhone에서 여는 방법',
    iosStep: '오른쪽 위 ··· 메뉴를 누른 뒤 “외부 브라우저에서 열기”를 선택해주세요.',
    copy: '링크 복사',
    copied: '링크가 복사되었어요',
    continueHere: '현재 창에서 계속하기',
  },
  en: {
    eyebrow: 'For a smoother booking experience',
    title: 'Open this page in your browser',
    description: 'Safari or Chrome provides more reliable sign-in and payment support.',
    androidAction: 'Continue in Chrome',
    iosStepTitle: 'How to open on iPhone',
    iosStep: 'Tap the ··· menu in the top-right corner, then choose “Open in external browser.”',
    copy: 'Copy link',
    copied: 'Link copied',
    continueHere: 'Continue in this window',
  },
  ja: {
    eyebrow: 'より快適に予約するために',
    title: '外部ブラウザで開いてください',
    description: 'ログインと決済はSafariまたはChromeのほうが安定してご利用いただけます。',
    androidAction: 'Chromeで続ける',
    iosStepTitle: 'iPhoneで開く方法',
    iosStep: '右上の「···」メニューをタップし、「外部ブラウザで開く」を選択してください。',
    copy: 'リンクをコピー',
    copied: 'リンクをコピーしました',
    continueHere: 'この画面で続ける',
  },
  zh: {
    eyebrow: '为了获得更顺畅的预订体验',
    title: '请使用外部浏览器打开',
    description: '使用 Safari 或 Chrome 登录和付款会更加稳定。',
    androidAction: '在 Chrome 中继续',
    iosStepTitle: '在 iPhone 上打开的方法',
    iosStep: '点击右上角的“···”菜单，然后选择“在外部浏览器中打开”。',
    copy: '复制链接',
    copied: '链接已复制',
    continueHere: '在当前窗口继续',
  },
} as const;

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Use the selection fallback below when clipboard permission is unavailable.
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

export default function ExternalBrowserHandoff({
  androidIntentUrl,
  destinationUrl,
  locale,
}: ExternalBrowserHandoffProps) {
  const [copied, setCopied] = useState(false);
  const copy = COPY[locale] || COPY.ko;

  async function handleCopy() {
    const succeeded = await copyText(destinationUrl);
    if (!succeeded) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="flex min-h-[100svh] items-center justify-center bg-white px-6 py-10 text-slate-950"
      data-testid="external-browser-handoff"
    >
      <section className="w-full max-w-md">
        <p className="text-xs font-semibold text-slate-500">Locally</p>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white">
          <ExternalLink aria-hidden="true" size={22} />
        </div>

        <p className="mt-7 text-sm font-semibold text-slate-500">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{copy.title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">{copy.description}</p>

        {androidIntentUrl ? (
          <a
            className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-base font-semibold text-white"
            data-testid="external-browser-android-action"
            href={androidIntentUrl}
          >
            <ExternalLink aria-hidden="true" size={18} />
            {copy.androidAction}
          </a>
        ) : (
          <div className="mt-8 border-y border-slate-200 py-5" data-testid="external-browser-ios-instructions">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <MoreHorizontal aria-hidden="true" size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold">{copy.iosStepTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{copy.iosStep}</p>
              </div>
            </div>
          </div>
        )}

        <button
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800"
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
          {copied ? copy.copied : copy.copy}
        </button>

        <a
          className="mt-5 block text-center text-sm font-medium text-slate-500 underline underline-offset-4"
          href={destinationUrl}
        >
          {copy.continueHere}
        </a>
      </section>
    </div>
  );
}
