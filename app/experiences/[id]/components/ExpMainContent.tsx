'use client';

import React, { useState } from 'react';
import { MapPin, MessageSquare, Check, X, Users, Zap, ShieldAlert, CalendarX, User, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import ReviewSection from './ReviewSection';
import HostProfileSection from './HostProfileSection';
import { useToast } from '@/app/context/ToastContext'; // 🟢 Toast 사용

export default function ExpMainContent({ 
  experience, hostProfile, handleInquiry, inquiryText, setInquiryText 
}: any) {
  const { showToast } = useToast();
  const location = experience.meeting_point || experience.location || 'Seoul';
  
  // 주소 복사 기능
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(location);
    showToast('주소가 복사되었습니다.', 'success');
  };

  return (
    <div className="flex-1 space-y-12">
      
      {/* 1. 호스트 요약 */}
      <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2>
          <p className="text-slate-500 text-base">최대 {experience.max_guests}명 · {experience.duration || 2}시간 · 한국어/영어</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center relative">
           {hostProfile?.avatar_url ? (
             <img src={hostProfile.avatar_url} className="w-full h-full object-cover" alt="Host"/>
           ) : (
             <User className="text-slate-300 w-8 h-8"/>
           )}
        </div>
      </div>

      {/* 2. 체험 소개 */}
      <div className="border-b border-slate-200 pb-8">
        <h3 className="text-xl font-bold mb-4">체험 소개</h3>
        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p>
      </div>

      {/* 3. 동선 (루트) */}
      {experience.itinerary && (
        <div className="border-b border-slate-200 pb-8">
          <h3 className="text-xl font-bold mb-6">진행 코스</h3>
          <div className="pl-2 border-l-2 border-slate-100 space-y-8 ml-2">
            {experience.itinerary.map((item: any, idx: number) => (
              <div key={idx} className="relative pl-8 group">
                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${idx === 0 ? 'bg-black' : 'bg-slate-400'}`}></div>
                <h4 className="font-bold text-slate-900 text-base mb-1">{item.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 후기 섹션 */}
      <ReviewSection experienceId={experience.id} hostName={hostProfile?.name || 'Locally'} />
      
      {/* 5. 호스트 상세 프로필 */}
      <HostProfileSection 
        hostId={experience.host_id}
        name={hostProfile?.name || 'Locally Host'} 
        avatarUrl={hostProfile?.avatar_url}
        job={hostProfile?.job || "로컬리 호스트"}
        dreamDestination={hostProfile?.dream_destination || "여행"}
        favoriteSong={hostProfile?.favorite_song || "음악"}
        languages={hostProfile?.languages || []} 
        intro={hostProfile?.introduction || hostProfile?.bio || "안녕하세요! 로컬리 호스트입니다."} 
      />

      {/* 6. 지도 (Location) - 🟢 인터랙티브 지도로 교체 */}
      <div id="location" className="border-b border-slate-200 pb-8 scroll-mt-24">
         <div className="flex justify-between items-end mb-4">
            <div>
               <h3 className="text-xl font-bold mb-1">호스팅 지역</h3>
               <p className="text-slate-500 text-sm flex items-center gap-1">
                 <MapPin size={14}/> {location}
               </p>
            </div>
            <button 
              onClick={handleCopyAddress}
              className="text-xs font-bold text-slate-600 underline decoration-slate-300 hover:text-black flex items-center gap-1"
            >
              <Copy size={12}/> 주소 복사
            </button>
         </div>

         <div className="w-full h-[400px] bg-slate-50 rounded-2xl relative overflow-hidden border border-slate-200 shadow-sm">
            {/* 구글 지도 임베드 (무료 버전) */}
            <iframe 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              loading="lazy" 
              allowFullScreen 
              src={`https://maps.google.com/maps?q=${encodeURIComponent(location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              className="grayscale-[20%] hover:grayscale-0 transition-all duration-700"
            ></iframe>
            
            {/* 구글 맵으로 크게 보기 버튼 */}
            <Link 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform border border-slate-200"
            >
               <ExternalLink size={14}/> 큰 지도로 보기
            </Link>
         </div>
         <p className="text-xs text-slate-400 mt-2 text-center">* 정확한 만남 장소는 예약 확정 후 호스트가 안내해 드립니다.</p>
      </div>

      {/* 7. 문의하기 */}
      <div id="inquiry" className="pb-8 scroll-mt-24">
         <h3 className="text-xl font-bold mb-4">문의하기</h3>
         <div className="flex gap-2">
           <input value={inquiryText} onChange={e => setInquiryText(e.target.value)} placeholder="호스트에게 메시지 보내기..." className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black transition-colors"/>
           <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center"><MessageSquare size={18}/></button>
         </div>
      </div>

      {/* 8. 포함/불포함 */}
      <div className="border-t border-slate-200 pt-10 pb-8">
         <h3 className="text-xl font-bold mb-6">포함 및 불포함 사항</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
               <h4 className="font-bold text-sm mb-3 text-slate-900">포함</h4>
               <ul className="space-y-2.5">
                  {experience.inclusions?.length > 0 ? experience.inclusions.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600 items-start"><Check size={18} className="text-slate-900 flex-shrink-0 mt-0.5"/><span>{item}</span></li>
                  )) : <li className="text-sm text-slate-400">등록된 포함 사항이 없습니다.</li>}
               </ul>
            </div>
            <div>
               <h4 className="font-bold text-sm mb-3 text-slate-900">불포함</h4>
               <ul className="space-y-2.5">
                  {experience.exclusions?.length > 0 ? experience.exclusions.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600 items-start"><X size={18} className="text-slate-400 flex-shrink-0 mt-0.5"/><span>{item}</span></li>
                  )) : <li className="text-sm text-slate-400">등록된 불포함 사항이 없습니다.</li>}
               </ul>
            </div>
         </div>
         {experience.supplies && (
           <div className="mt-8 bg-slate-50 p-5 rounded-xl border border-slate-100">
             <h4 className="font-bold text-sm mb-2 text-slate-900 flex items-center gap-2"><span className="text-xl">🎒</span> 준비물</h4>
             <p className="text-sm text-slate-600 leading-relaxed">{experience.supplies}</p>
           </div>
         )}
      </div>

      {/* 9. 알아두어야 할 사항 */}
      <div className="py-12 border-t border-slate-200">
         <h3 className="text-2xl font-bold mb-8">알아두어야 할 사항</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            <div className="flex gap-4">
               <Users size={24} className="text-slate-900 flex-shrink-0"/>
               <div><h4 className="font-bold text-base mb-2 text-slate-900">게스트 요건</h4><p className="text-sm text-slate-600 leading-relaxed">참가 연령: {experience.rules?.age_limit || '제한 없음'} <br/> 최대 인원: {experience.max_guests}명</p></div>
            </div>
            <div className="flex gap-4">
               <Zap size={24} className="text-slate-900 flex-shrink-0"/>
               <div><h4 className="font-bold text-base mb-2 text-slate-900">활동 강도</h4><p className="text-sm text-slate-600 leading-relaxed">이 체험의 활동 강도는 <strong>'{experience.rules?.activity_level || '보통'}'</strong> 입니다. <br/> 가벼운 산책 수준의 체력이 필요합니다.</p></div>
            </div>
            <div className="flex gap-4">
               <ShieldAlert size={24} className="text-slate-900 flex-shrink-0"/>
               <div><h4 className="font-bold text-base mb-2 text-slate-900">안전 및 접근성</h4><p className="text-sm text-slate-600 leading-relaxed mb-1">특이 사항이나 도움이 필요하신 경우 사전에 호스트에게 문의해주세요.</p><button onClick={() => document.getElementById('inquiry')?.scrollIntoView({behavior:'smooth'})} className="text-sm font-bold underline decoration-slate-300 hover:text-black">호스트에게 문의하기</button></div>
            </div>
            <div className="flex gap-4">
               <CalendarX size={24} className="text-slate-900 flex-shrink-0"/>
               <div><h4 className="font-bold text-base mb-2 text-slate-900">환불 정책</h4><p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{experience.rules?.refund_policy || '체험 시작 5일 전까지 취소 시 전액 환불됩니다.'}</p><button className="text-sm font-bold underline decoration-slate-300 hover:text-black mt-1">정책 자세히 보기</button></div>
            </div>
         </div>
      </div>
    </div>
  );
}