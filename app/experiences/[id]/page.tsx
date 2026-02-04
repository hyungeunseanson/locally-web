'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin, ChevronRight, MessageSquare, Copy, Check
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

export default function ExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [experience, setExperience] = useState<any>(null);
  const [hostProfile, setHostProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // 예약 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(""); 
  const [inquiryText, setInquiryText] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ✨ UI 상태 추가 (저장, 공유, 후기펼치기)
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 1. 체험 정보
      const { data: exp, error } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (error) { console.error(error); } 
      else {
        setExperience(exp);
        // 2. 예약 가능일
        const { data: dates } = await supabase.from('experience_availability').select('date').eq('experience_id', exp.id).eq('is_booked', false);
        if (dates) setAvailableDates(dates.map((d: any) => d.date));
        
        // 3. 호스트 정보
        const { data: hostApp } = await supabase.from('host_applications').select('*').eq('user_id', exp.host_id).maybeSingle();
        setHostProfile(hostApp || { name: 'Locally Host', self_intro: '안녕하세요!' }); 
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, supabase]);

  // ✨ 기능: 스크롤 이동
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ✨ 기능: 공유하기 (클립보드 복사)
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleInquiry = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (!inquiryText.trim()) return alert('내용을 입력해주세요.');
    const { error } = await supabase.from('inquiries').insert([{
      experience_id: experience.id, host_id: experience.host_id, user_id: user.id, content: inquiryText
    }]);
    if (!error) { alert('메시지가 전송되었습니다.'); setInquiryText(''); }
  };

  const handleReserve = () => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!selectedDate) return alert("날짜를 선택해주세요.");
    router.push(`/experiences/${params.id}/payment`);
  };

  // 달력 렌더링
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const startBlank = getFirstDay(year, month);
    const days = [];
    for (let i = 0; i < startBlank; i++) days.push(<div key={`empty-${i}`} />);
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAvailable = availableDates.includes(dateStr);
      const isSelected = selectedDate === dateStr;
      days.push(
        <button key={d} disabled={!isAvailable} onClick={() => setSelectedDate(dateStr)}
          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isSelected ? 'bg-black text-white' : ''} ${!isSelected && isAvailable ? 'hover:bg-slate-100 hover:border-black border border-transparent' : ''} ${!isSelected && !isAvailable ? 'text-slate-300 decoration-slate-300 line-through' : ''}`}>
          {d}
        </button>
      );
    }
    return days;
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />

      {/* ✨ 토스트 알림 (공유하기 클릭 시) */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check size={16} className="text-green-400"/> 링크가 복사되었습니다.
        </div>
      )}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        
        {/* 타이틀 및 헤더 */}
        <section className="mb-6">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            {/* ✨ 기능: 클릭 시 해당 섹션으로 스크롤 이동 */}
            <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4">
                <Star size={14} fill="black"/> 
                <span className="font-bold">4.98</span> 
                <span className="text-slate-500 underline">후기 15개</span>
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={() => scrollToSection('location')} className="flex items-center gap-1 hover:underline underline-offset-4 font-bold text-slate-700">
                <MapPin size={14}/> {experience.location}
              </button>
            </div>

            <div className="flex gap-2">
               <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Share size={16} /> 공유하기
               </button>
               {/* ✨ 기능: 찜하기 토글 (색상 변경) */}
               <button onClick={() => setIsSaved(!isSaved)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} /> 
                 {isSaved ? '저장됨' : '저장'}
               </button>
            </div>
          </div>
        </section>

        {/* ✨ 이미지 그리드 (4:5 비율 느낌 살림, h-[480px]로 시원하게) */}
        <section className="relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group">
           <img src={experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           {/* 그라데이션 오버레이 */}
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
           <button className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform">
             <ChevronRight size={16}/> 사진 모두 보기
           </button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          
          {/* 왼쪽 컨텐츠 */}
          <div className="flex-1 space-y-10">
            
            {/* ✨ 1. 호스트 요약 (심플하게 변경) */}
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  호스트: {hostProfile?.name || 'Locally Host'}님
                </h2>
                <p className="text-slate-500 text-base">
                  최대 {guestCount + 3}명 · 2시간 · 한국어/영어
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
                 <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
              </div>
            </div>

            {/* 2. 체험 소개 */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p>
            </div>

            {/* ✨ 3. 후기 섹션 (펼치기 기능 추가) */}
            <div id="reviews" className="border-b border-slate-200 pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                 <Star size={20} fill="black"/> 4.98 · 후기 15개
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {/* 펼쳐지면 더 많은 아이템(8개), 아니면 4개만 보여줌 */}
                  {(isReviewsExpanded ? [1,2,3,4,5,6,7,8] : [1,2,3,4]).map(i => (
                    <div key={i} className="space-y-3">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-full bg-cover bg-center" style={{backgroundImage: `url('https://i.pravatar.cc/150?u=${i}')`}}></div>
                          <div>
                            <div className="font-bold text-sm text-slate-900">Guest {i}</div>
                            <div className="text-xs text-slate-500">2026년 1월</div>
                          </div>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed">
                         호스트님이 정말 친절하셨고, 코스도 완벽했습니다. 현지인만 아는 맛집을 알게 되어 너무 좋았어요!
                       </p>
                    </div>
                  ))}
               </div>
               
               <button 
                 onClick={() => setIsReviewsExpanded(!isReviewsExpanded)}
                 className="mt-8 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50 transition-colors"
               >
                 {isReviewsExpanded ? '후기 접기' : '후기 15개 모두 보기'}
               </button>
            </div>

            {/* ✨ 4. 호스트 상세 (이전의 큰 박스를 여기로 이동) */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-6">호스트 소개</h3>
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
                      <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold">호스트 {hostProfile?.name || 'Locally'}님</h4>
                      <div className="flex gap-2 items-center text-xs text-slate-500 mt-1">
                         <ShieldCheck size={14} className="text-black"/> 신원 인증됨 · 슈퍼호스트
                      </div>
                    </div>
                 </div>
                 <p className="text-slate-600 leading-relaxed max-w-2xl">
                   {hostProfile?.self_intro || "안녕하세요! 여행을 사랑하는 호스트입니다. 현지인만 아는 특별한 장소로 여러분을 초대합니다. 단순한 가이드가 아니라 친구처럼 편안한 여행을 만들어 드릴게요."}
                 </p>
                 <button onClick={() => document.getElementById('inquiry')?.scrollIntoView({behavior:'smooth'})} className="px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-100 transition-colors inline-block mt-2">
                   호스트에게 연락하기
                 </button>
              </div>
            </div>

            {/* ✨ 5. 만나는 장소 (구글 지도 연결) */}
            <div id="location" className="border-b border-slate-200 pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">호스팅 지역</h3>
               <p className="text-slate-500 mb-4">{experience.location} (정확한 위치는 예약 확정 후 표시됩니다)</p>
               
               {/* 구글 지도 검색 링크 연결 */}
               <Link href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(experience.location || 'Seoul')}`} target="_blank">
                 <div className="w-full h-[320px] bg-slate-100 rounded-2xl relative overflow-hidden group cursor-pointer border border-slate-200">
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b" className="w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500 grayscale group-hover:grayscale-0"/>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="bg-white px-4 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm hover:scale-110 transition-transform">
                          <MapPin size={18} className="text-rose-500 fill-rose-500"/>
                          구글 지도에서 보기
                       </div>
                    </div>
                 </div>
               </Link>
            </div>

            {/* 6. 문의하기 */}
            <div id="inquiry" className="pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-4">문의하기</h3>
               <p className="text-sm text-slate-500 mb-4">체험에 대해 궁금한 점이 있으신가요?</p>
               <div className="flex gap-2">
                 <input 
                   value={inquiryText} 
                   onChange={e => setInquiryText(e.target.value)} 
                   placeholder="호스트에게 메시지 보내기..." 
                   className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"
                 />
                 <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:scale-105 transition-transform"><MessageSquare size={18}/></button>
               </div>
            </div>

          </div>

          {/* 오른쪽 스티키 예약 카드 (기존 유지) */}
          <div className="w-full md:w-[380px]">
            <div className="sticky top-28 border border-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)] rounded-2xl p-6 bg-white">
               <div className="flex justify-between items-end mb-6">
                 <div><span className="text-2xl font-bold">₩{Number(experience.price).toLocaleString()}</span> <span className="text-slate-500 text-sm">/ 인</span></div>
               </div>

               <div className="border border-slate-300 rounded-xl mb-4 overflow-hidden">
                 <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}><ChevronLeft size={16}/></button>
                      <span className="font-bold text-sm">{currentDate.getFullYear()}년 {currentDate.getMonth()+1}월</span>
                      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}><ChevronRight size={16}/></button>
                    </div>
                    <div className="grid grid-cols-7 text-center mb-2">
                      {['일','월','화','수','목','금','토'].map(d=><span key={d} className="text-[10px] text-slate-400 font-bold">{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                      {renderCalendar()}
                    </div>
                 </div>
                 
                 <div className="p-3 bg-white flex justify-between items-center border-t border-slate-200">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase text-slate-800">인원</span>
                     <select value={guestCount} onChange={(e)=>setGuestCount(Number(e.target.value))} className="text-sm outline-none bg-transparent font-bold">
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>게스트 {n}명</option>)}
                     </select>
                   </div>
                 </div>
               </div>

               <button 
                 onClick={handleReserve} 
                 className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all mb-4"
               >
                 예약하기
               </button>
               
               <p className="text-center text-xs text-slate-500 mb-4">예약 확정 전에는 청구되지 않습니다.</p>
               <div className="flex justify-between font-bold pt-4 border-t border-slate-100">
                 <span>총 합계</span>
                 <span>₩{(Number(experience.price) * guestCount).toLocaleString()}</span>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}