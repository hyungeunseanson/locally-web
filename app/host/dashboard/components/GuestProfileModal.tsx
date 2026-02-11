'use client';

import React from 'react';
import { User, XCircle, MessageSquare, Phone } from 'lucide-react';

interface Props {
  guest: any;
  onClose: () => void;
}

export default function GuestProfileModal({ guest, onClose }: Props) {
  if (!guest) return null;

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-colors">
          <XCircle size={24} />
        </button>

        {/* 상단 커버 & 아바타 */}
        <div className="h-32 bg-slate-900 relative">
           <div className="absolute -bottom-12 left-6 p-1 bg-white rounded-full">
             <div className="w-24 h-24 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
               {guest.avatar_url ? (
                 <img src={secureUrl(guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={40}/></div>
               )}
             </div>
           </div>
        </div>

        {/* 프로필 내용 */}
        <div className="pt-16 px-6 pb-8">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            {guest.full_name}
            {guest.host_nationality && <span className="text-xl">{guest.host_nationality}</span>}
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-6">
            {(() => {
              if (!guest.languages) return '언어 정보 없음';
              try {
                if (Array.isArray(guest.languages)) return guest.languages.join(', ');
                if (guest.languages.startsWith('[')) return JSON.parse(guest.languages).join(', ');
                return guest.languages;
              } catch (e) {
                return guest.languages;
              }
            })()}
          </p>

          {/* 소개글 */}
          <div className="bg-slate-50 p-4 rounded-2xl mb-6">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {guest.introduction || "아직 자기소개가 없습니다."}
            </p>
          </div>

          {/* 연락처 정보 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Info</h3>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                  <MessageSquare size={16} fill="currentColor"/> 
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">KakaoTalk ID</p>
                  <p className="text-sm font-bold text-slate-900">{guest.kakao_id || '등록되지 않음'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                   <Phone size={16}/>
                 </div>
                 <div>
                   <p className="text-[10px] text-slate-400 font-bold">Phone Number</p>
                   <p className="text-sm font-bold text-slate-900">{guest.phone || '비공개'}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}