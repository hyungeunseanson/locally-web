'use client';

import React from 'react';
import { X, Star, ShieldCheck, CheckCircle2, Briefcase, Globe, Music, MessageCircle } from 'lucide-react';

export default function HostProfileModal({ isOpen, onClose, host }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 모달 컨텐츠 */}
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-white rounded-full hover:bg-slate-100 transition-colors z-20 shadow-sm border border-slate-100">
          <X size={20}/>
        </button>

        {/* 🟢 왼쪽: 호스트 카드 (고정 영역) */}
        <div className="md:w-[400px] bg-slate-50 p-10 flex flex-col items-center text-center border-r border-slate-100 overflow-y-auto">
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-lg mb-6 border-4 border-white">
            <img src={host.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"} className="w-full h-full object-cover"/>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">{host.name}</h2>
          <div className="flex items-center gap-2 mb-8">
            <span className="flex items-center gap-1 font-bold text-sm"><Star size={14} fill="black"/> 4.98</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 font-bold text-sm underline decoration-slate-300 underline-offset-4">후기 156개</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 font-bold text-sm"><ShieldCheck size={14}/> 슈퍼호스트</span>
          </div>

          <div className="w-full space-y-4 text-left border-t border-slate-200 pt-8">
            <h3 className="font-bold text-lg mb-2">{host.name}님 확인 정보</h3>
            <div className="flex items-center gap-3 text-slate-700">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>신분증</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>이메일 주소</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700">
               <CheckCircle2 size={20} className="text-slate-900"/> <span>전화번호</span>
            </div>
          </div>
        </div>

        {/* 🟢 오른쪽: 상세 소개 (스크롤 영역) */}
        <div className="flex-1 p-10 overflow-y-auto">
          <h3 className="text-2xl font-bold mb-8">호스트 소개</h3>
          
          <div className="space-y-6 mb-10">
            <h4 className="font-bold text-lg mb-4">{host.name}님에 대한 재미있는 사실</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {host.job && (
                <div className="flex items-start gap-3">
                  <Briefcase className="text-slate-900 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">직업/직장</p>
                    <p className="text-sm text-slate-600">{host.job}</p>
                  </div>
                </div>
              )}
              {host.dreamDestination && (
                <div className="flex items-start gap-3">
                  <Globe className="text-slate-900 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">꼭 여행해 보고 싶은 장소</p>
                    <p className="text-sm text-slate-600">{host.dreamDestination}</p>
                  </div>
                </div>
              )}
              {host.favoriteSong && (
                <div className="flex items-start gap-3">
                  <Music className="text-slate-900 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">학창시절 최애 노래</p>
                    <p className="text-sm text-slate-600">{host.favoriteSong}</p>
                  </div>
                </div>
              )}
              {host.languages && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="text-slate-900 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">구사 언어</p>
                    <p className="text-sm text-slate-600">{host.languages.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-8">
            <h4 className="font-bold text-lg mb-4">소개</h4>
            <p className="text-slate-600 leading-loose whitespace-pre-wrap text-base">
              {host.intro || "안녕하세요! 여행과 새로운 만남을 사랑하는 호스트입니다."}
            </p>
          </div>
          
          <div className="mt-10 pt-8 border-t border-slate-100">
             <button onClick={() => alert("문의하기 기능 준비 중")} className="bg-black text-white px-8 py-3.5 rounded-xl font-bold hover:scale-105 transition-transform">
               호스트에게 연락하기
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}