'use client';

import React from 'react';
import { Share, Heart, MapPin, ChevronRight, Check, X, Users, Zap, ShieldAlert, CalendarX, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import ReviewSection from './ReviewSection';
import HostProfileSection from './HostProfileSection';

export default function ExpMainContent({ 
  experience, hostProfile, isSaved, setIsSaved, handleShare, scrollToSection, handleInquiry, inquiryText, setInquiryText 
}: any) {
  
  return (
    <div className="flex-1 space-y-12">
      {/* 1. 헤더 섹션 */}
      <section className="mb-6">
        <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
            <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4"><span className="font-bold">★ 4.98</span> <span className="text-slate-500 underline">후기 15개</span></button>
            <span className="text-slate-300">|</span>
            <button onClick={() => scrollToSection('location')} className="flex items-center gap-1 hover:underline underline-offset-4 font-bold text-slate-700"><MapPin size={14}/> {experience.location}</button>
          </div>
          <div className="flex gap-2">
             <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Share size={16} /> 공유하기</button>
             <button onClick={() => setIsSaved(!isSaved)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} /> {isSaved ? '저장됨' : '저장'}</button>
          </div>
        </div>
      </section>

      {/* 2. 이미지 갤러리 */}
      <section className="relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group">
         <img src={experience.photos?.[0] || experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
         <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
         <button className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform"><ChevronRight size={16}/> 사진 모두 보기</button>
      </section>

      {/* 3. 호스트 요약 */}
      <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2>
          <p className="text-slate-500 text-base">최대 {experience.max_guests}명 · {experience.duration || 2}시간 · 한국어/영어</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/></div>
      </div>

      {/* 4. 체험 소개 */}
      <div className="border-b border-slate-200 pb-8">
        <h3 className="text-xl font-bold mb-4">체험 소개</h3>
        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p>
      </div>

      {/* 5. 동선 (루트) */}
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

      {/* 6. 후기 섹션 */}
      <ReviewSection hostName={hostProfile?.name || 'Locally'} />

      {/* 7. 호스트 상세 프로필 */}
      <HostProfileSection 
        hostId={experience.host_id}
        name={hostProfile?.name || 'Tomoyo'}
        avatarUrl={hostProfile?.avatar_url}
        job="패션 디자이너"
        dreamDestination="중앙아메리카 커피 여행!"
        favoriteSong="Growing on me - The Darkness"
        languages={['영어', '일본어']}
        intro={hostProfile?.self_intro || "도쿄의 숨겨진 빈티지 샵을 소개하는 것을 좋아합니다."}
      />

      {/* 8. 지도 (Location) */}
      <div id="location" className="border-b border-slate-200 pb-8 scroll-mt-24">
         <h3 className="text-xl font-bold mb-4">호스팅 지역</h3>
         <p className="text-slate-500 mb-4">{experience.meeting_point || experience.location} (정확한 위치는 예약 확정 후 표시됩니다)</p>
         <Link href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(experience.meeting_point || experience.location || 'Seoul')}`} target="_blank" rel="noopener noreferrer">
           <div className="w-full h-[400px] bg-slate-50 rounded-2xl relative overflow-hidden group cursor-pointer border border-slate-200">
              <img src="https://developer.apple.com/maps/sample-code/images/embedded-map_2x.png" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700" style={{filter: 'contrast(105%)'}} alt="Map Background" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm hover:scale-110 transition-transform text-slate-900 border border-slate-100">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_(2020).svg" alt="Google Maps" className="w-[18px] h-[18px]" />
                    지도에서 보기
                 </div>
              </div>
           </div>
         </Link>
      </div>

      {/* 9. 문의하기 */}
      <div id="inquiry" className="pb-8 scroll-mt-24">
         <h3 className="text-xl font-bold mb-4">문의하기</h3>
         <div className="flex gap-2">
           <input value={inquiryText} onChange={e => setInquiryText(e.target.value)} placeholder="호스트에게 메시지 보내기..." className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"/>
           <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:scale-105 transition-transform"><MessageSquare size={18}/></button>
         </div>
      </div>

      {/* 10. 포함/불포함 */}
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

      {/* 11. 알아두어야 할 사항 */}
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