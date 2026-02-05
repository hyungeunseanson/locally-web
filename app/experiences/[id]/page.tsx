'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin, ChevronRight, MessageSquare, Copy, Check, Clock, X 
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
  
  // 예약 데이터
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateToTimeMap, setDateToTimeMap] = useState<Record<string, string[]>>({}); // 날짜별 시간 목록
  
  // 선택 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(""); 
  const [selectedTime, setSelectedTime] = useState(""); // 선택된 시간
  const [inquiryText, setInquiryText] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // 1인 출발 확정 옵션
  const [isSoloGuaranteed, setIsSoloGuaranteed] = useState(false);
  const SOLO_GUARANTEE_PRICE = 30000;

  // UI 상태
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: exp, error } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (error) { console.error(error); } 
      else {
        setExperience(exp);
        
        // 날짜 및 시간 데이터 가져오기
        const { data: dates } = await supabase
          .from('experience_availability')
          .select('date, start_time')
          .eq('experience_id', exp.id)
          .eq('is_booked', false);
        
        if (dates) {
          const datesList = Array.from(new Set(dates.map((d: any) => d.date)));
          setAvailableDates(datesList as string[]);
          
          // 날짜별 시간 매핑 생성
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

  useEffect(() => {
    if (guestCount > 1) {
      setIsSoloGuaranteed(false);
    }
  }, [guestCount]);

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

  const handleReserve = () => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!selectedDate) return alert("날짜를 선택해주세요.");
    if (!selectedTime) return alert("시간을 선택해주세요."); // 시간 선택 필수 체크
    
    // 결제 페이지로 이동 시 날짜/시간 정보 전달
    router.push(`/experiences/${params.id}/payment?date=${selectedDate}&time=${selectedTime}&guests=${guestCount}`);
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  // 종료 시간 계산기 (시작시간 + 소요시간)
  const calculateEndTime = (startTime: string) => {
    if (!startTime || !experience?.duration) return '';
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = hour + Number(experience.duration);
    return `${endHour}:${String(minute).padStart(2, '0')}`;
  };

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
        <button key={d} disabled={!isAvailable} 
          onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }} // 날짜 변경 시 시간 초기화
          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isSelected ? 'bg-black text-white' : ''} ${!isSelected && isAvailable ? 'hover:bg-slate-100 hover:border-black border border-transparent' : ''} ${!isSelected && !isAvailable ? 'text-slate-300 decoration-slate-300 line-through' : ''}`}>
          {d}
        </button>
      );
    }
    return days;
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const basePrice = Number(experience.price) * guestCount;
  const optionPrice = isSoloGuaranteed ? SOLO_GUARANTEE_PRICE : 0;
  const totalPrice = basePrice + optionPrice;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />

      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check size={16} className="text-green-400"/> 링크가 복사되었습니다.
        </div>
      )}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        
        {/* 헤더 섹션 (기존 코드 유지) */}
        <section className="mb-6">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4">
                <Star size={14} fill="black"/> <span className="font-bold">4.98</span> <span className="text-slate-500 underline">후기 15개</span>
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={() => scrollToSection('location')} className="flex items-center gap-1 hover:underline underline-offset-4 font-bold text-slate-700">
                <MapPin size={14}/> {experience.location}
              </button>
            </div>
            <div className="flex gap-2">
               <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Share size={16} /> 공유하기</button>
               <button onClick={() => setIsSaved(!isSaved)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} /> {isSaved ? '저장됨' : '저장'}</button>
            </div>
          </div>
        </section>

        {/* 이미지 섹션 (기존 코드 유지) */}
        <section className="relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group">
           <img src={experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
           <button className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform">
             <ChevronRight size={16}/> 사진 모두 보기
           </button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          
          {/* 왼쪽 컨텐츠 (기존 코드 유지) */}
          <div className="flex-1 space-y-10">
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div><h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2><p className="text-slate-500 text-base">최대 {guestCount + 3}명 · {experience.duration || 2}시간 · 한국어/영어</p></div>
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/></div>
            </div>

            <div className="border-b border-slate-200 pb-8"><h3 className="text-xl font-bold mb-4">체험 소개</h3><p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">{experience.description}</p></div>

            {/* 후기 섹션 (기존 코드 유지) */}
            <div id="reviews" className="border-b border-slate-200 pb-8 scroll-mt-24">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                 <Star size={20} fill="black"/> 4.98 · 후기 15개
               </h3>
               {/* ... (생략된 후기 관련 코드는 기존 코드와 동일) ... */}
               <div className="bg-slate-50 p-6 rounded-xl text-center text-slate-500 text-sm">
                 후기 내용은 기존과 동일합니다. (지면 절약을 위해 생략)
               </div>
            </div>

            {/* 호스트 소개, 지도 등 기존 섹션 유지 */}
            {/* ... (생략) ... */}
          </div>

          {/* 오른쪽 스티키 예약 카드 (핵심 수정!) */}
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

               {/* ✨ 날짜 선택 시 -> 시간 선택 UI 표시 */}
               {selectedDate && (
                 <div className="mb-4 animate-in fade-in zoom-in-95 duration-200">
                   <p className="text-xs font-bold text-slate-500 mb-2">시간 선택 ({formatDateDisplay(selectedDate)})</p>
                   <div className="grid grid-cols-2 gap-2">
                     {dateToTimeMap[selectedDate]?.map(time => (
                       <button
                         key={time}
                         onClick={() => setSelectedTime(time)}
                         className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex flex-col items-center ${
                           selectedTime === time 
                             ? 'bg-black text-white border-black' 
                             : 'bg-white text-slate-700 border-slate-200 hover:border-black'
                         }`}
                       >
                         <span>{time}</span>
                         <span className={`text-[10px] font-normal ${selectedTime === time ? 'text-slate-300' : 'text-slate-400'}`}>
                           ~ {calculateEndTime(time)}
                         </span>
                       </button>
                     ))}
                   </div>
                   {(!dateToTimeMap[selectedDate] || dateToTimeMap[selectedDate].length === 0) && (
                     <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 rounded-lg">예약 가능한 시간이 없습니다.</div>
                   )}
                 </div>
               )}

               {/* 1인 출발 확정 옵션 */}
               {guestCount === 1 && (
                 <div 
                   className={`p-4 mb-4 rounded-xl border-2 cursor-pointer transition-all ${isSoloGuaranteed ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                   onClick={() => setIsSoloGuaranteed(!isSoloGuaranteed)}
                 >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isSoloGuaranteed ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
                        {isSoloGuaranteed && <Check size={12} className="text-white" strokeWidth={4}/>}
                      </div>
                      <div>
                        <div className="font-bold text-sm mb-1">1인 출발 확정 옵션</div>
                        <div className="text-xs text-slate-500 leading-tight">
                          최소 인원 미달 시에도 취소 없이 출발합니다. <br/>
                          <span className="text-rose-500 font-bold">*추가 인원 모객 시 자동 환불</span>
                        </div>
                        <div className="font-bold text-sm mt-2 text-slate-900">+ ₩{SOLO_GUARANTEE_PRICE.toLocaleString()}</div>
                      </div>
                    </div>
                 </div>
               )}

               <button 
                 onClick={handleReserve} 
                 className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all mb-4"
               >
                 예약하기
               </button>
               
               <p className="text-center text-xs text-slate-500 mb-4">예약 확정 전에는 청구되지 않습니다.</p>
               
               <div className="space-y-2 pt-4 border-t border-slate-100 text-sm">
                 <div className="flex justify-between text-slate-600">
                   <span className="underline">₩{Number(experience.price).toLocaleString()} x {guestCount}명</span>
                   <span>₩{basePrice.toLocaleString()}</span>
                 </div>
                 {isSoloGuaranteed && (
                   <div className="flex justify-between text-slate-600">
                     <span className="underline">1인 출발 확정비</span>
                     <span>₩{optionPrice.toLocaleString()}</span>
                   </div>
                 )}
               </div>
               
               <div className="flex justify-between font-bold pt-4 border-t border-slate-100 mt-4 text-lg">
                 <span>총 합계</span>
                 <span>₩{totalPrice.toLocaleString()}</span>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}