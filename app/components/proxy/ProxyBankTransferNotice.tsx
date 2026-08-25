'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getPublicBankInfo } from '@/app/utils/publicBankInfo';

type ProxyBankTransferNoticeProps = {
  amount: number;
  mode: 'before-submit' | 'pending';
  title?: string;
  className?: string;
};

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the compatibility fallback below.
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = value;
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

export function ProxyBankTransferNotice({
  amount,
  mode,
  title,
  className = '',
}: ProxyBankTransferNoticeProps) {
  const bankInfo = getPublicBankInfo();
  const [copied, setCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const isPending = mode === 'pending';

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  const handleCopy = async () => {
    const succeeded = await copyToClipboard(bankInfo.account);
    if (!succeeded) return;

    setCopied(true);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className={`rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-slate-900 ${className}`}
      data-testid="proxy-bank-transfer-notice"
    >
      <h3 className="text-sm font-bold text-slate-900">
        {title || (isPending ? '입금 대기 중' : '무통장 입금')}
      </h3>

      {isPending ? (
        <p className="mt-2 text-sm leading-6 text-slate-700">
          <strong>₩{amount.toLocaleString()}원을 아래 계좌로 입금해주세요.</strong>
        </p>
      ) : (
        <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl border border-blue-100 bg-white/80 px-3 py-2.5">
          <span className="text-xs font-semibold text-slate-600">결제 금액</span>
          <span className="text-base font-black text-blue-700">₩{amount.toLocaleString()}</span>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
        <p className="text-xs font-semibold text-slate-600">입금 계좌</p>
        <div className="mt-2 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-[72px] shrink-0 whitespace-nowrap text-xs text-slate-500">은행명</span>
            <span className="font-semibold text-slate-900">{bankInfo.bankName}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-[72px] shrink-0 whitespace-nowrap text-xs text-slate-500">계좌번호</span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <span className="whitespace-nowrap font-mono text-base font-bold tracking-tight text-slate-900">{bankInfo.account}</span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? '복사되었습니다.' : '계좌번호 복사'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-[72px] shrink-0 whitespace-nowrap text-xs text-slate-500">예금주</span>
            <span className="text-right text-slate-700">{bankInfo.accountHolder}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-700" aria-live="polite">
        {isPending
          ? '입금 확인 후 운영팀에서 요청을 진행합니다.'
          : '요청 접수 후 위 계좌로 입금해주세요. 입금 확인 후 운영팀에서 요청을 진행합니다.'}
      </p>
    </section>
  );
}
