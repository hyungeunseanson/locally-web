'use client';

import React, { useState, useEffect } from 'react';
import { 
  Share, Heart, MapPin, ChevronRight, MessageSquare, Check, Globe 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat'; // ✅ 훅 추가

// 분리된 컴포넌트 임포트
import ExpMainContent from './components/ExpMainContent';
import ExpSidebar from './components/ExpSidebar';

export default function ExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { createInquiry } = useChat(); // 훅에서 생성 함수 가져오기
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

// ✅ 핸들러 수정: 진짜 채팅방 생성
const handleInquiry = async () => {
  if (!user) return alert('로그인이 필요합니다.');
  if (!inquiryText.trim()) return alert('내용을 입력해주세요.');
  
  try {
    // 체험 정보에서 host_id 가져오기 (experience state 사용)
    if (!experience?.host_id) return alert('호스트 정보를 불러올 수 없습니다.');

    await createInquiry(experience.host_id, experience.id, inquiryText);
    
    if (confirm('문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?')) {
      router.push('/guest/inbox');
    }
    setInquiryText('');
  } catch (e: any) {
    alert('문의 전송 실패: ' + e.message);
  }
};

  const handleReserve = (date: string, time: string, guests: number, isPrivate: boolean) => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!date) return alert("날짜를 선택해주세요.");
    if (!time) return alert("시간을 선택해주세요.");
    const typeParam = isPrivate ? '&type=private' : '';
    router.push(`/experiences/${params.id}/payment?date=${date}&time=${time}&guests=${guests}${typeParam}`);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-0">
      <SiteHeader />
      {showToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><Check size={16} className="text-green-400"/> 링크가 복사되었습니다.</div>}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        
        {/* ✅ [복구 완료] 헤더 & 이미지 섹션 (Flex 밖으로 꺼냄 -> 넓어짐) */}
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

        {/* 하단 2단 레이아웃 (본문 + 사이드바) */}
        <div className="flex flex-col md:flex-row gap-16 relative">
          
          <ExpMainContent 
            experience={experience} 
            hostProfile={hostProfile}
            handleInquiry={handleInquiry} 
            inquiryText={inquiryText} 
            setInquiryText={setInquiryText}
          />

          <ExpSidebar 
            experience={experience} 
            availableDates={availableDates} 
            dateToTimeMap={dateToTimeMap} 
            handleReserve={handleReserve} 
          />
        </div>
      </main>

      {/* 푸터 */}
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