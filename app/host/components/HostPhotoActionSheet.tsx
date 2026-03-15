'use client';

import React from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

const COPY = {
  ko: {
    title: '사진 관리',
    subtitle: '사진을 변경하거나 삭제할 수 있습니다.',
    change: '사진 변경',
    remove: '사진 삭제',
    cancel: '취소',
  },
  en: {
    title: 'Manage photo',
    subtitle: 'Change or remove this photo.',
    change: 'Replace photo',
    remove: 'Delete photo',
    cancel: 'Cancel',
  },
  ja: {
    title: '写真管理',
    subtitle: '写真の変更または削除ができます。',
    change: '写真を変更',
    remove: '写真を削除',
    cancel: 'キャンセル',
  },
  zh: {
    title: '照片管理',
    subtitle: '可以更换或删除这张照片。',
    change: '更换照片',
    remove: '删除照片',
    cancel: '取消',
  },
} as const;

type HostPhotoActionSheetProps = {
  isOpen: boolean;
  photoLabel?: string;
  onClose: () => void;
  onChange: () => void;
  onDelete: () => void;
};

export default function HostPhotoActionSheet({
  isOpen,
  photoLabel,
  onClose,
  onChange,
  onDelete,
}: HostPhotoActionSheetProps) {
  const { lang } = useLanguage();
  const copy = COPY[lang as keyof typeof COPY] || COPY.ko;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end md:items-center md:justify-center" data-testid="host-photo-action-sheet">
      <button
        type="button"
        aria-label={copy.cancel}
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <div className="relative z-[221] w-full rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-5 shadow-2xl md:max-w-sm md:rounded-3xl md:px-6 md:pb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold text-slate-900">{photoLabel || copy.title}</p>
            <p className="mt-1 text-[12px] text-slate-500">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onChange}
            data-testid="host-photo-action-change"
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left text-[14px] font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <ImagePlus size={18} className="text-slate-500" />
            <span>{copy.change}</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            data-testid="host-photo-action-delete"
            className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 px-4 py-3 text-left text-[14px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 size={18} />
            <span>{copy.remove}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-[14px] font-semibold text-slate-600 transition-colors hover:bg-slate-200"
          >
            {copy.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
