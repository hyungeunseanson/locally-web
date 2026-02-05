'use client';

import React, { useState } from 'react';
import { Star, ShieldCheck, Briefcase, Globe, Music, MessageCircle } from 'lucide-react';
import HostProfileModal from './HostProfileModal'; // ✅ 방금 만든 모달 임포트

interface HostProfileProps {
  hostId: string;
  name: string;
  avatarUrl?: string;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  languages?: string[];
  intro?: string;
}

export default function HostProfileSection(props: HostProfileProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="py-12 border-t border-slate-200">
        <h3 className="text-2xl font-bold mb-8">호스트: {props.name}님</h3>
        
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row gap-10 items-start">
          
          {/* 🟢 왼쪽: 호스트 프로필 요약 (에어비앤비 스타일) */}
          <div className="flex flex-col items-center text-center md:w-1/3 w-full shrink-0">
             <div className="relative mb-4">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-100">
                  <img src={props.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"} className="w-full h-full object-cover"/>
                </div>
                <div className="absolute bottom-0 right-0 bg-rose-500 text-white p-1.5 rounded-full shadow-sm border-2 border-white">
                  <ShieldCheck size={16} fill="white" className="text-rose-500"/>
                </div>
             </div>
             <h2 className="text-2xl font-black mb-1">{props.name}</h2>
             <p className="text-sm font-bold text-slate-500 mb-4">슈퍼호스트</p>
             
             <div className="flex gap-4 w-full justify-center border-t border-slate-100 pt-4">
                <div className="text-center">
                   <div className="text-sm font-bold">156</div>
                   <div className="text-[10px] font-bold text-slate-400">후기</div>
                </div>
                <div className="w-[1px] bg-slate-200 h-8"></div>
                <div className="text-center">
                   <div className="text-sm font-bold flex items-center gap-1">4.98 <Star size={10} fill="black"/></div>
                   <div className="text-[10px] font-bold text-slate-400">평점</div>
                </div>
                <div className="w-[1px] bg-slate-200 h-8"></div>
                <div className="text-center">
                   <div className="text-sm font-bold">7년</div>
                   <div className="text-[10px] font-bold text-slate-400">경력</div>
                </div>
             </div>
          </div>

          {/* 🟢 오른쪽: 재미있는 사실들 (깔끔한 리스트) */}
          <div className="flex-1 space-y-5 w-full">
             <h4 className="font-bold text-lg mb-2">호스트 상세 정보</h4>
             
             {props.job && (
               <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                 <Briefcase size={20} className="text-slate-900"/>
                 <span className="text-slate-700 text-sm">직업: <strong>{props.job}</strong></span>
               </div>
             )}
             
             {props.dreamDestination && (
               <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                 <Globe size={20} className="text-slate-900"/>
                 <span className="text-slate-700 text-sm">여행하고 싶은 곳: <strong>{props.dreamDestination}</strong></span>
               </div>
             )}

             {props.favoriteSong && (
               <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                 <Music size={20} className="text-slate-900"/>
                 <span className="text-slate-700 text-sm">최애 노래: <strong>{props.favoriteSong}</strong></span>
               </div>
             )}

             {props.languages && (
               <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                 <MessageCircle size={20} className="text-slate-900"/>
                 <span className="text-slate-700 text-sm">구사 언어: <strong>{props.languages.join(', ')}</strong></span>
               </div>
             )}

             <div className="pt-4">
               <p className="text-slate-600 line-clamp-2 text-sm leading-relaxed mb-4">
                 {props.intro || "안녕하세요! 저는 여행을 사랑하는 호스트입니다."}
               </p>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="text-black font-bold underline decoration-1 underline-offset-4 hover:text-slate-600 transition-colors"
               >
                 더 읽어보기
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* 🟢 모달 (클릭 시 뜸) */}
      <HostProfileModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        host={props}
      />
    </>
  );
}