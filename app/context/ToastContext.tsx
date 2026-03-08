'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, ImageUp, Smartphone, Laptop, Monitor } from 'lucide-react';

type ToastType = 'success' | 'error';
type Locale = 'ko' | 'en' | 'ja' | 'zh';

type ToastOptions = {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
  showHeicUnsupportedToast: (message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const APP_LANG_KEY = 'app_lang';

const HEIC_GUIDE_COPY: Record<
  Locale,
  {
    toastMessage: string;
    actionLabel: string;
    modalTitle: string;
    modalDescription: string;
    supportedFormatsLabel: string;
    supportedFormatsValue: string;
    iphoneTitle: string;
    iphoneStep1: string;
    iphoneStep2: string;
    existingTitle: string;
    macLabel: string;
    windowsLabel: string;
    tip: string;
    closeLabel: string;
  }
> = {
  ko: {
    toastMessage: 'HEIC/HEIF 파일은 아직 지원하지 않습니다. JPG, PNG, WEBP로 변환 후 업로드해 주세요.',
    actionLabel: 'JPG 변환 방법',
    modalTitle: 'JPG로 변환하는 방법',
    modalDescription: '로컬리는 현재 JPG, PNG, WEBP만 안정적으로 지원합니다.',
    supportedFormatsLabel: '업로드 가능 형식',
    supportedFormatsValue: 'JPG, PNG, WEBP',
    iphoneTitle: 'iPhone에서 다음 사진부터 JPG로 저장하려면',
    iphoneStep1: '설정 > 카메라 > 포맷으로 이동합니다.',
    iphoneStep2: '\'높은 호환성\'을 선택하면 다음 사진이 JPG 호환 형식으로 저장됩니다.',
    existingTitle: '이미 찍은 HEIC 사진을 변환하려면',
    macLabel: 'Mac: 미리보기 > 파일 > 내보내기 > 형식: JPEG',
    windowsLabel: 'Windows: 사진 앱 또는 그림판 > 다른 이름으로 저장 > JPG',
    tip: '기존 iPhone 사진은 Mac 또는 Windows로 옮겨 JPEG로 내보내는 방식이 가장 안정적입니다.',
    closeLabel: '닫기'
  },
  en: {
    toastMessage: 'HEIC/HEIF files are not supported yet. Convert them to JPG, PNG, or WEBP before uploading.',
    actionLabel: 'How to convert to JPG',
    modalTitle: 'How to convert to JPG',
    modalDescription: 'Locally currently supports JPG, PNG, and WEBP only.',
    supportedFormatsLabel: 'Supported upload formats',
    supportedFormatsValue: 'JPG, PNG, WEBP',
    iphoneTitle: 'To save future iPhone photos in a JPG-compatible format',
    iphoneStep1: 'Open Settings > Camera > Formats.',
    iphoneStep2: 'Choose "Most Compatible" so future photos save in a JPG-compatible format.',
    existingTitle: 'To convert photos you already took in HEIC',
    macLabel: 'Mac: Preview > File > Export > Format: JPEG',
    windowsLabel: 'Windows: Photos or Paint > Save as > JPG',
    tip: 'For existing iPhone photos, exporting them as JPEG on Mac or Windows is the most reliable path.',
    closeLabel: 'Close'
  },
  ja: {
    toastMessage: 'HEIC/HEIF ファイルはまだ対応していません。JPG、PNG、WEBP に変換してからアップロードしてください。',
    actionLabel: 'JPG 変換方法',
    modalTitle: 'JPG に変換する方法',
    modalDescription: 'Locally は現在 JPG、PNG、WEBP のみ安定して対応しています。',
    supportedFormatsLabel: 'アップロード可能形式',
    supportedFormatsValue: 'JPG, PNG, WEBP',
    iphoneTitle: 'iPhone で今後の写真を JPG 互換で保存するには',
    iphoneStep1: '設定 > カメラ > フォーマット を開きます。',
    iphoneStep2: '「互換性優先」を選ぶと、今後の写真が JPG 互換形式で保存されます。',
    existingTitle: 'すでに撮影した HEIC 写真を変換するには',
    macLabel: 'Mac: プレビュー > ファイル > 書き出す > フォーマット: JPEG',
    windowsLabel: 'Windows: フォト または ペイント > 名前を付けて保存 > JPG',
    tip: '既存の iPhone 写真は Mac または Windows に移して JPEG で書き出す方法が最も安定しています。',
    closeLabel: '閉じる'
  },
  zh: {
    toastMessage: '暂不支持 HEIC/HEIF 文件。请先转换为 JPG、PNG 或 WEBP 后再上传。',
    actionLabel: 'JPG 转换方法',
    modalTitle: '如何转换为 JPG',
    modalDescription: 'Locally 目前仅稳定支持 JPG、PNG、WEBP。',
    supportedFormatsLabel: '可上传格式',
    supportedFormatsValue: 'JPG, PNG, WEBP',
    iphoneTitle: '如果想让 iPhone 之后拍的照片以 JPG 兼容格式保存',
    iphoneStep1: '打开 设置 > 相机 > 格式。',
    iphoneStep2: '选择“兼容性最佳”，之后的照片会以 JPG 兼容格式保存。',
    existingTitle: '如果要转换已经拍好的 HEIC 照片',
    macLabel: 'Mac：预览 > 文件 > 导出 > 格式：JPEG',
    windowsLabel: 'Windows：照片 或 画图 > 另存为 > JPG',
    tip: '已有的 iPhone 照片，先传到 Mac 或 Windows 再导出为 JPEG 会更稳定。',
    closeLabel: '关闭'
  }
};

const resolveLocale = (): Locale => {
  if (typeof window === 'undefined') return 'ko';

  const saved = window.localStorage.getItem(APP_LANG_KEY)?.toLowerCase();
  if (saved === 'ko' || saved === 'en' || saved === 'ja' || saved === 'zh') {
    return saved;
  }

  const htmlLang = document.documentElement.lang?.toLowerCase();
  if (htmlLang === 'ko' || htmlLang === 'en' || htmlLang === 'ja' || htmlLang === 'zh') {
    return htmlLang;
  }

  return 'ko';
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [locale, setLocale] = useState<Locale>('ko');
  const [isHeicGuideOpen, setIsHeicGuideOpen] = useState(false);

  useEffect(() => {
    setLocale(resolveLocale());
  }, []);

  useEffect(() => {
    if (!isHeicGuideOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isHeicGuideOpen]);

  const syncLocale = useCallback(() => {
    const nextLocale = resolveLocale();
    setLocale(nextLocale);
    return nextLocale;
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', options?: ToastOptions) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
      }
    ]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.durationMs ?? 3000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openHeicGuide = useCallback(() => {
    syncLocale();
    setIsHeicGuideOpen(true);
  }, [syncLocale]);

  const showHeicUnsupportedToast = useCallback((message?: string) => {
    const nextLocale = syncLocale();
    const copy = HEIC_GUIDE_COPY[nextLocale];

    showToast(message || copy.toastMessage, 'error', {
      actionLabel: copy.actionLabel,
      onAction: openHeicGuide,
      durationMs: 6000,
    });
  }, [openHeicGuide, showToast, syncLocale]);

  const guideCopy = HEIC_GUIDE_COPY[locale];

  return (
    <ToastContext.Provider value={{ showToast, showHeicUnsupportedToast }}>
      {children}
      <div className="fixed bottom-[80px] md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex gap-3 p-3.5 rounded-2xl shadow-[0_14px_30px_rgba(15,23,42,0.35)] border backdrop-blur-md animate-in slide-in-from-bottom-3 fade-in duration-500 ${
              toast.type === 'success' 
                ? 'bg-slate-900/92 border-slate-700 text-slate-100' 
                : 'bg-[#2b1720]/92 border-[#6a2a3d] text-slate-100'
            }`}
          >
            <div className="pt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="text-emerald-300 shrink-0" size={18} />
              ) : (
                <AlertCircle className="text-rose-300 shrink-0" size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium tracking-[-0.005em]">{toast.message}</p>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    removeToast(toast.id);
                  }}
                  className="mt-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {isHeicGuideOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-end md:items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsHeicGuideOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 md:px-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                  <ImageUp size={14} />
                  {guideCopy.supportedFormatsLabel}: {guideCopy.supportedFormatsValue}
                </div>
                <h3 className="mt-3 text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">
                  {guideCopy.modalTitle}
                </h3>
                <p className="mt-1 text-[13px] leading-6 text-slate-600 md:text-[14px]">
                  {guideCopy.modalDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHeicGuideOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={guideCopy.closeLabel}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 md:px-6 md:py-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
                  <Smartphone size={16} className="text-slate-500" />
                  {guideCopy.iphoneTitle}
                </div>
                <p className="mt-3 text-[13px] leading-6 text-slate-600">{guideCopy.iphoneStep1}</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">{guideCopy.iphoneStep2}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-[14px] font-semibold text-slate-900">{guideCopy.existingTitle}</div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-[13px] leading-6 text-slate-600">
                    <Laptop size={16} className="mt-1 shrink-0 text-slate-500" />
                    <span>{guideCopy.macLabel}</span>
                  </div>
                  <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-[13px] leading-6 text-slate-600">
                    <Monitor size={16} className="mt-1 shrink-0 text-slate-500" />
                    <span>{guideCopy.windowsLabel}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
                {guideCopy.tip}
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsHeicGuideOpen(false)}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {guideCopy.closeLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
