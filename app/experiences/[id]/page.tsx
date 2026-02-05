'use client';

import React, { useState, useEffect } from 'react';
import { Share, Heart, ChevronRight, ShieldCheck, MapPin, MessageSquare, Check, X } from 'lucide-react';
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
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
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
           <img src={experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
           <button className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform"><ChevronRight size={16}/> 사진 모두 보기</button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          <div className="flex-1 space-y-10">
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div><h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2><p className="text-slate-500 text-base">최대 10명 · {experience.duration || 2}시간 · 한국어/영어</p></div>
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/></div>
            </div>

            <div className="border-b border-slate-200 pb-8"><h3 className="text-xl font-bold mb-4">체험 소개</h3><p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p></div>

            <ReviewSection hostName={hostProfile?.name || 'Locally'} />

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

            <div id="location" className="border-b border-slate-200 pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">호스팅 지역</h3>
               <p className="text-slate-500 mb-4">{experience.location} (정확한 위치는 예약 확정 후 표시됩니다)</p>
               <Link href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(experience.location || 'Seoul')}`} target="_blank">
                 <div className="w-full h-[400px] bg-slate-50 rounded-2xl relative overflow-hidden group cursor-pointer border border-slate-200">
                    <img src="https://developer.apple.com/maps/sample-code/images/embedded-map_2x.png" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700" style={{filter: 'contrast(105%)'}} />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm hover:scale-110 transition-transform text-slate-900 border border-slate-100">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_(2020).svg" alt="Google Maps" className="w-[18px] h-[18px]" /> 지도에서 보기
                       </div>
                    </div>
                 </div>
               </Link>
            </div>

            <div id="inquiry" className="pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">문의하기</h3>
               <div className="flex gap-2">
                 <input value={inquiryText} onChange={e => setInquiryText(e.target.value)} placeholder="호스트에게 메시지 보내기..." className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"/>
                 <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:scale-105 transition-transform"><MessageSquare size={18}/></button>
               </div>
            </div>

            <div className="border-t border-slate-200 pt-10 pb-8">
               <h3 className="text-xl font-bold mb-6">포함 및 불포함 사항</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                     <h4 className="font-bold text-sm mb-3 text-slate-900">포함</h4>
                     <ul className="space-y-2.5">
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><Check size={18} className="text-slate-900 flex-shrink-0 mt-0.5"/><span>전문 로컬 가이드 비용</span></li>
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><Check size={18} className="text-slate-900 flex-shrink-0 mt-0.5"/><span>웰컴 드링크 1잔 및 로컬 간식</span></li>
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><Check size={18} className="text-slate-900 flex-shrink-0 mt-0.5"/><span>현지인만 아는 맛집 지도 제공</span></li>
                     </ul>
                  </div>
                  <div>
                     <h4 className="font-bold text-sm mb-3 text-slate-900">불포함</h4>
                     <ul className="space-y-2.5">
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><X size={18} className="text-slate-400 flex-shrink-0 mt-0.5"/><span>개인 식사 비용 및 쇼핑비</span></li>
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><X size={18} className="text-slate-400 flex-shrink-0 mt-0.5"/><span>투어 중 이동 교통비 (약 500엔)</span></li>
                        <li className="flex gap-3 text-sm text-slate-600 items-start"><X size={18} className="text-slate-400 flex-shrink-0 mt-0.5"/><span>여행자 보험</span></li>
                     </ul>
                  </div>
               </div>
               <div className="mt-8 bg-slate-50 p-5 rounded-xl border border-slate-100">
                 <h4 className="font-bold text-sm mb-2 text-slate-900 flex items-center gap-2"><span className="text-xl">🎒</span> 준비물</h4>
                 <p className="text-sm text-slate-600 leading-relaxed">많이 걷기 때문에 <strong>편안한 운동화</strong>를 꼭 착용해 주세요. <br/>개인 경비(약 3,000엔)와 인생샷을 남길 <strong>카메라</strong>가 있으면 좋아요!</p>
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
    </div>
  );
}