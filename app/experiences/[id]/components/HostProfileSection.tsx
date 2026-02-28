'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User, Globe } from 'lucide-react';
import HostProfileModal from './HostProfileModal';

interface HostProfileProps {
  hostId?: string;
  name: string;
  avatarUrl?: string;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  languages?: string[];
  intro?: string;
  joinedYear?: number | null;
  category?: string;
  onMessageHost?: () => void;
}

export default function HostProfileSection(props: HostProfileProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const languageLine = Array.isArray(props.languages) && props.languages.length > 0
    ? Array.from(new Set(props.languages.map((language) => String(language).trim()).filter(Boolean))).join(', ')
    : '';

  return (
    <>
      <div className="py-6 md:py-8">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-4 md:mb-5">자기소개</h3>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-[#f4f4f4] rounded-[18px] md:rounded-[22px] border border-slate-200 p-5 md:p-7 text-center shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] transition-shadow"
        >
          <div className="relative w-[80px] h-[80px] md:w-[96px] md:h-[96px] rounded-full overflow-hidden bg-slate-200 border border-slate-200 mx-auto mb-3 md:mb-4 flex items-center justify-center">
            {props.avatarUrl ? (
              <Image src={props.avatarUrl} className="object-cover" alt={props.name} fill />
            ) : (
              <User className="text-slate-300 w-10 h-10 md:w-12 md:h-12" />
            )}
          </div>
          <h4 className="text-[18px] md:text-[34px] font-semibold leading-none mb-1.5 md:mb-2">{props.name}</h4>
          <p className="text-[11px] md:text-[14px] text-slate-500 font-normal">{props.job || '로컬리 호스트'}</p>
          {languageLine && (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] md:text-[12px] text-slate-500 border border-slate-200">
              <Globe size={12} className="shrink-0 md:w-[13px] md:h-[13px]" />
              <span className="truncate">{languageLine}</span>
            </div>
          )}
        </button>

        <p className="text-[11px] md:text-[15px] leading-[1.45] md:leading-[1.5] text-slate-700 mt-4 md:mt-5 whitespace-pre-wrap">
          {props.intro || "안녕하세요! 여행과 새로운 만남을 사랑하는 호스트입니다."}
        </p>

        <button
          type="button"
          onClick={props.onMessageHost}
          className="mt-4 md:mt-5 w-full rounded-xl bg-[#ececec] px-4 py-3 md:py-2.5 min-h-[44px] text-[11px] md:text-[14px] font-medium text-slate-700 hover:bg-[#e5e5e5] transition-colors"
        >
          {props.name}님에게 메시지 보내기
        </button>

        <p className="text-[10px] text-slate-400 text-center mt-3">
          안전한 결제를 위해 항상 로컬리를 통해 결제하고 호스트와 소통하세요.
        </p>
      </div>

      <HostProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        host={{
          ...props,
          onContactHost: props.onMessageHost,
        }}
      />
    </>
  );
}
