'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Mail, Phone, User, X } from 'lucide-react';

export type ChatParticipantProfile = {
  kind: 'guest' | 'host';
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

type ChatParticipantProfileModalProps = {
  participant: ChatParticipantProfile | null;
  onClose: () => void;
};

function getProfileTitle(kind: ChatParticipantProfile['kind']) {
  return kind === 'guest' ? '게스트 프로필' : '호스트 프로필';
}

function getProfileLabel(kind: ChatParticipantProfile['kind']) {
  return kind === 'guest' ? '게스트' : '호스트';
}

export default function ChatParticipantProfileModal({
  participant,
  onClose,
}: ChatParticipantProfileModalProps) {
  useEffect(() => {
    if (!participant) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [participant, onClose]);

  if (!participant) return null;

  const title = getProfileTitle(participant.kind);
  const label = getProfileLabel(participant.kind);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-participant-modal={participant.kind}
    >
      <button
        type="button"
        aria-label="프로필 모달 닫기"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <X size={16} />
        </button>

        <div className="border-b border-slate-100 bg-slate-50 px-6 pb-5 pt-6">
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </span>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
              {participant.avatar_url ? (
                <Image
                  src={participant.avatar_url}
                  alt={`${title} 아바타`}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-7 w-7 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-slate-900">{participant.name || '정보 없음'}</h3>
              <p className="mt-1 text-sm text-slate-500">{title}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">이메일</div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Mail size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{participant.email || '정보 없음'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">전화번호</div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Phone size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{participant.phone || '정보 없음'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
