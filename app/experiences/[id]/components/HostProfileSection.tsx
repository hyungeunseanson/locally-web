'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';
import HostProfileModal from './HostProfileModal';

interface HostProfileProps {
  hostId: string;
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

  return (
    <>
      <div className="py-8 border-t border-slate-200">
        <h3 className="text-[20px] md:text-[27px] font-semibold tracking-[-0.01em] mb-5">자기소개</h3>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-[#f4f4f4] rounded-[22px] border border-slate-200 p-7 text-center shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] transition-shadow"
        >
          <div className="w-[96px] h-[96px] rounded-full overflow-hidden bg-slate-200 border border-slate-200 mx-auto mb-4 flex items-center justify-center">
            {props.avatarUrl ? (
              <img src={props.avatarUrl} className="w-full h-full object-cover" alt={props.name} />
            ) : (
              <User className="text-slate-300 w-12 h-12" />
            )}
          </div>
          <h4 className="text-[21px] md:text-[34px] font-semibold leading-none mb-2">{props.name}</h4>
          <p className="text-[12px] md:text-[14px] text-slate-500 font-normal">{props.job || props.category || '로컬리 호스트'}</p>
        </button>

        <p className="text-[12px] md:text-[15px] leading-[1.5] text-slate-700 mt-5 whitespace-pre-wrap">
          {props.intro || "안녕하세요! 여행과 새로운 만남을 사랑하는 호스트입니다."}
        </p>

        <button
          type="button"
          onClick={props.onMessageHost}
          className="mt-5 w-full rounded-xl bg-[#ececec] px-4 py-2.5 text-[12px] md:text-[14px] font-medium text-slate-700 hover:bg-[#e5e5e5] transition-colors"
        >
          {props.name} 님에게 메시지 보내기
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
          reviewCount: 0,
          rating: null,
        }}
      />
    </>
  );
}
