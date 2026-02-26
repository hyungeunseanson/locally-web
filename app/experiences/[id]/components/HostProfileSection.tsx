'use client';

import React, { useState } from 'react';
import { Star, ShieldCheck, Briefcase, Globe, Music, MessageCircle, ChevronRight, User } from 'lucide-react';
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
}

export default function HostProfileSection(props: HostProfileProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="py-12 border-t border-slate-200">
        <h3 className="text-2xl font-bold mb-8">호스트: {props.name}님</h3>
        
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
{/* 🟢 왼쪽: 프로필 사진 (수정됨: 실제 사진 우선 표시) */}
<div className="relative shrink-0 mx-auto md:mx-0">
               <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center">
                 {props.avatarUrl ? (
                   <img src={props.avatarUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                 ) : (
                   <User className="text-slate-300 w-12 h-12"/>
                 )}
               </div>
               <div className="absolute bottom-0 right-0 bg-rose-500 text-white p-1 rounded-full shadow-sm border-2 border-white">
                 <ShieldCheck size={14} fill="white" className="text-rose-500"/>
               </div>
            </div>

            {/* 🟢 중앙: 정보 */}
            <div className="flex-1 space-y-4 text-center md:text-left">
               <div>
                  <h2 className="text-xl font-black mb-1 text-slate-900">{props.name}</h2>
                  <p className="text-sm text-slate-500 font-medium">슈퍼호스트{props.joinedYear ? ` · 경력 ${props.joinedYear}년` : ''}</p>
               </div>
               
               {/* 요약 정보 (재미있는 사실 1~2개만 노출) */}
               <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {props.job && (
                    <span className="bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1.5 border border-slate-100">
                       <Briefcase size={12}/> {props.job}
                    </span>
                  )}
                  {props.languages && (
                    <span className="bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1.5 border border-slate-100">
                       <MessageCircle size={12}/> {props.languages.join(', ')}
                    </span>
                  )}
               </div>

               <p className="text-slate-600 text-sm line-clamp-2 leading-relaxed">
                 {props.intro || "안녕하세요! 여행과 새로운 만남을 사랑하는 호스트입니다."}
               </p>
            </div>

            {/* 🟢 오른쪽: 화살표 (이동 암시) */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:block opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
               <ChevronRight size={24}/>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 연결 */}
      <HostProfileModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        host={props}
      />
    </>
  );
}