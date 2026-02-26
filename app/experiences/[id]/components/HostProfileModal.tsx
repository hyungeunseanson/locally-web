'use client';

import React from 'react';
import { X, Star, ShieldCheck, CheckCircle2, Briefcase, Globe, Music, MessageCircle } from 'lucide-react';

export default function HostProfileModal({ isOpen, onClose, host }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 모달 컨텐츠 */}
      <div className="bg-white w-full max-w-5xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-white rounded-full hover:bg-slate-100 transition-colors z-20 shadow-sm border border-slate-100">
          <X size={20}/>
        </button>

        {/* 🟢 왼쪽: 호스트 카드 (고정 영역) */}
        <div className="md:w-[360px] bg-white p-8 md:p-10 flex flex-col items-start border-r border-slate-100 overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          <div className="flex flex-col items-center w-full text-center mb-8">
            <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden shadow-lg border-4 border-white">
                  <img src={host.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"} className="w-full h-full object-cover"/>
                </div>
                <div className="absolute bottom-1 right-1 bg-rose-500 text-white p-1.5 rounded-full shadow-md border-2 border-white">
                   <ShieldCheck size={18} fill="white" className="text-rose-500"/>
                </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-1">{host.name}</h2>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
               <span>슈퍼호스트</span>
            </div>
          </div>

          <div className="flex justify-around w-full border-y border-slate-100 py-6 mb-8">
             <div className="text-center">
                <div className="font-black text-lg">{host.reviewCount ?? '-'}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">후기</div>
             </div>
             <div className="w-[1px] bg-slate-100"></div>
             <div className="text-center">
                <div className="font-black text-lg flex items-center gap-1">
                  {host.rating ? Number(host.rating).toFixed(2) : '-'}
                  {host.rating && <Star size={12} fill="black"/>}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">평점</div>
             </div>
             <div className="w-[1px] bg-slate-100"></div>
             <div className="text-center">
                <div className="font-black text-lg">{host.joinedYear ? `${host.joinedYear}년` : '-'}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">경력</div>
             </div>
          </div>

          <div className="w-full space-y-4">
            <h3 className="font-bold text-lg text-slate-900 mb-2">{host.name}님 확인 정보</h3>
            <div className="flex items-center gap-3 text-slate-600">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>신분증</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>이메일 주소</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>전화번호</span>
            </div>
          </div>
        </div>

        {/* 🟢 오른쪽: 상세 소개 (스크롤 영역) */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-white">
          <h3 className="text-2xl font-bold mb-8">호스트 소개</h3>
          
          <div className="bg-slate-50 p-6 rounded-2xl mb-8">
            <h4 className="font-bold text-base mb-4 text-slate-900 flex items-center gap-2">👀 {host.name}님에 대한 재미있는 사실</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              {host.job && (
                <div className="flex items-start gap-3">
                  <Briefcase className="text-slate-400 mt-0.5" size={18} />
                  <div className="text-sm">직업: <span className="font-bold text-slate-900">{host.job}</span></div>
                </div>
              )}
              {host.dreamDestination && (
                <div className="flex items-start gap-3">
                  <Globe className="text-slate-400 mt-0.5" size={18} />
                  <div className="text-sm">여행하고 싶은 곳: <span className="font-bold text-slate-900">{host.dreamDestination}</span></div>
                </div>
              )}
              {host.favoriteSong && (
                <div className="flex items-start gap-3">
                  <Music className="text-slate-400 mt-0.5" size={18} />
                  <div className="text-sm">최애 노래: <span className="font-bold text-slate-900">{host.favoriteSong}</span></div>
                </div>
              )}
              {host.languages && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="text-slate-400 mt-0.5" size={18} />
                  <div className="text-sm">구사 언어: <span className="font-bold text-slate-900">{host.languages.join(', ')}</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-lg">소개</h4>
            <p className="text-slate-600 leading-loose text-base whitespace-pre-wrap">
              {host.intro || "안녕하세요! 여행과 새로운 만남을 사랑하는 호스트입니다. 저와 함께 잊지 못할 추억을 만들어보세요."}
            </p>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
             <button onClick={() => alert("문의하기 기능 준비 중")} className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">
               호스트에게 연락하기
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}