'use client';

import React, { useState, useEffect } from 'react';
import { Share, Heart, ChevronRight, ShieldCheck, MapPin, MessageSquare, Check, X, Clock, User, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewSection from './components/ReviewSection';
import ReservationCard from './components/ReservationCard';

export default function ExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [experience, setExperience] = useState<any>(null);
  const [hostProfile, setHostProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateToTimeMap, setDateToTimeMap] = useState<Record<string, string[]>>({});
  
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [inquiryText, setInquiryText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: exp, error } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (error) { console.error(error); } 
      else {
        setExperience(exp);
        const { data: dates } = await supabase.from('experience_availability').select('date, start_time').eq('experience_id', exp.id).eq('is_booked', false);
        if (dates) {
          const datesList = Array.from(new Set(dates.map((d: any) => d.date)));
          setAvailableDates(datesList as string[]);
          const timeMap: Record<string, string[]> = {};
          dates.forEach((d:any) => {
            if (!timeMap[d.date]) timeMap[d.date] = [];
            timeMap[d.date].push(d.start_time);
          });
          setDateToTimeMap(timeMap);
        }
        const { data: hostApp } = await supabase.from('host_applications').select('*').eq('user_id', exp.host_id).maybeSingle();
        setHostProfile(hostApp || { name: 'Locally Host', self_intro: '안녕하세요!' }); 
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, supabase]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleInquiry = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (!inquiryText.trim()) return alert('내용을 입력해주세요.');
    alert('메시지가 전송되었습니다.'); 
    setInquiryText('');
  };

  const handleReserve = (date: string, time: string, guests: number) => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!date) return alert("날짜를 선택해주세요.");
    if (!time) return alert("시간을 선택해주세요.");
    router.push(`/experiences/${params.id}/payment?date=${date}&time=${time}&guests=${guests}`);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-0">
      <SiteHeader />
      {showToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><Check size={16} className="text-green-400"/> 링크가 복사되었습니다.</div>}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
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

        <section className="relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group">
           <img src={experience.photos?.[0] || experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
           <button className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform"><ChevronRight size={16}/> 사진 모두 보기</button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          <div className="flex-1 space-y-12">
            {/* 호스트 요약 */}
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2>
                <p className="text-slate-500 text-base">최대 {experience.max_guests}명 · {experience.duration || 2}시간 · 한국어/영어</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/></div>
            </div>

            {/* 체험 소개 */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p>
            </div>

            {/* ✨ 동선 (루트) 타임라인 - 신규 추가! */}
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

            {/* 후기 */}
            <ReviewSection hostName={hostProfile?.name || 'Locally'} />

            {/* 호스트 상세 */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-6">호스트 소개</h3>
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/></div>
                    <div><h4 className="text-lg font-bold">호스트 {hostProfile?.name || 'Locally'}님</h4><div className="flex gap-2 items-center text-xs text-slate-500 mt-1"><ShieldCheck size={14} className="text-black"/> 신원 인증됨 · 슈퍼호스트</div></div>
                 </div>
                 <p className="text-slate-600 leading-relaxed max-w-2xl">{hostProfile?.self_intro || "안녕하세요! 여행을 사랑하는 호스트입니다."}</p>
                 <button onClick={() => document.getElementById('inquiry')?.scrollIntoView({behavior:'smooth'})} className="px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-100 transition-colors inline-block mt-2">호스트에게 연락하기</button>
              </div>
            </div>

            {/* 지도 */}
            <div id="location" className="border-b border-slate-200 pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">호스팅 지역</h3>
               <p className="text-slate-500 mb-4">{experience.meeting_point || experience.location} (정확한 위치는 예약 확정 후 표시됩니다)</p>
               <div className="w-full h-[400px] bg-slate-50 rounded-2xl relative overflow-hidden border border-slate-200">
                  <img src="https://developer.apple.com/maps/sample-code/images/embedded-map_2x.png" className="w-full h-full object-cover opacity-90" style={{filter: 'contrast(105%)'}} />
               </div>
            </div>

            {/* 문의하기 */}
            <div id="inquiry" className="pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">문의하기</h3>
               <div className="flex gap-2">
                 <input value={inquiryText} onChange={e => setInquiryText(e.target.value)} placeholder="호스트에게 메시지 보내기..." className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"/>
                 <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:scale-105 transition-transform"><MessageSquare size={18}/></button>
               </div>
            </div>

            {/* 포함/불포함 */}
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

            {/* ✅ 알아두어야 할 사항 (복구됨!) */}
            <div className="pb-12">
               <h3 className="text-xl font-bold mb-6">알아두어야 할 사항</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div>
                     <div className="font-bold text-sm mb-1.5 text-slate-900">참가 연령</div>
                     <p className="text-sm text-slate-600 leading-relaxed">{experience.rules?.age_limit || '제한 없음'}</p>
                  </div>
                  <div>
                     <div className="font-bold text-sm mb-1.5 text-slate-900">활동 강도</div>
                     <p className="text-sm text-slate-600 leading-relaxed">{experience.rules?.activity_level || '보통'}</p>
                  </div>
                  <div>
                     <div className="font-bold text-sm mb-1.5 text-slate-900">접근성</div>
                     <button onClick={() => document.getElementById('inquiry')?.scrollIntoView({behavior:'smooth'})} className="text-sm text-slate-600 leading-relaxed underline hover:text-black">호스트에게 문의하기</button>
                  </div>
                  <div>
                     <div className="font-bold text-sm mb-1.5 text-slate-900">환불 정책</div>
                     <p className="text-sm text-slate-600 leading-relaxed">{experience.rules?.refund_policy || '표준 정책 (5일 전 무료 취소)'}</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="w-full md:w-[380px]">
            <ReservationCard 
              price={Number(experience.price)} 
              duration={Number(experience.duration || 2)} 
              availableDates={availableDates}
              dateToTimeMap={dateToTimeMap}
              onReserve={handleReserve}
            />
          </div>
        </div>
      </main>

      {/* ✅ 푸터 (복구됨!) */}
      <footer className="border-t border-slate-100 bg-slate-50 mt-20">
        <div className="max-w-[1120px] mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
            <div>
              <h5 className="font-bold text-black mb-4">Locally</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">회사 소개</Link></li>
                <li><Link href="/admin/dashboard" className="hover:underline font-bold text-slate-800">관리자 페이지</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">호스팅</h5>
              <ul className="space-y-3">
                <li><Link href="/become-a-host" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">호스트 추천하기</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">지원</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
                <li><Link href="#" className="hover:underline">안전 센터</Link></li>
              </ul>
            </div>
            <div>
               <div className="flex gap-4 font-bold text-slate-900 mb-6">
                 <button className="flex items-center gap-1 hover:underline"><Globe size={16}/> 한국어 (KR)</button>
                 <button className="hover:underline">₩ KRW</button>
               </div>
               <p className="text-xs">© 2026 Locally, Inc.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}