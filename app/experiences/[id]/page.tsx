'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin, ChevronRight
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
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]); // 예약 가능일
  
  // 예약 폼 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [inquiryText, setInquiryText] = useState('');
  
  // 달력 UI 상태
  const [currentDate, setCurrentDate] = useState(new Date()); // 달력 페이지

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 1. 체험 정보 (join 없이 안전하게)
      const { data: exp, error } = await supabase
        .from('experiences')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error(error); 
        // 에러 처리: router.push('/') 등을 할 수 있음
      } else {
        setExperience(exp);
        // 2. 예약 가능일 가져오기
        const { data: dates } = await supabase
          .from('experience_availability')
          .select('date')
          .eq('experience_id', exp.id)
          .eq('is_booked', false);
        
        if (dates) setAvailableDates(dates.map((d: any) => d.date));
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, supabase]);

  const handleInquiry = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (!inquiryText.trim()) return alert('내용을 입력해주세요.');
    const { error } = await supabase.from('inquiries').insert([{
      experience_id: experience.id, host_id: experience.host_id, user_id: user.id, content: inquiryText
    }]);
    if (!error) { alert('전송되었습니다!'); setInquiryText(''); }
  };

  const handleReserve = () => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!selectedDate) return alert("날짜를 선택해주세요.");
    router.push(`/experiences/${params.id}/payment`);
  };

  // --- 달력 렌더링 로직 ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDay = (year: number, month: number) => new Date(year, month, 1).getDay();
  
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
        <button 
          key={d} 
          disabled={!isAvailable}
          onClick={() => setSelectedDate(dateStr)}
          className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
            ${isSelected ? 'bg-black text-white shadow-md' : ''}
            ${!isSelected && isAvailable ? 'hover:bg-slate-100 hover:border hover:border-black cursor-pointer text-slate-900' : ''}
            ${!isSelected && !isAvailable ? 'text-slate-300 cursor-not-allowed line-through decoration-slate-300' : ''}
          `}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        
        {/* 헤더 섹션 */}
        <section className="mb-8">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium underline decoration-slate-300 underline-offset-4">
              <span className="flex items-center gap-1"><Star size={14} fill="black"/> 4.98 · 후기 120개</span>
              <span className="flex items-center gap-1"><MapPin size={14}/> {experience.location || '위치 정보 없음'}</span>
            </div>
            <div className="flex gap-2">
               <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Share size={16} /> 공유하기
               </button>
               <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Heart size={16} /> 저장
               </button>
            </div>
          </div>
        </section>

        {/* 이미지 그리드 (에어비앤비 스타일) */}
        <section className="rounded-xl overflow-hidden aspect-[2/1] mb-12 bg-slate-100 relative group">
           <img src={experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           <button className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg text-sm font-bold shadow-md border border-black/10 flex items-center gap-2">
             <ChevronRight size={16}/> 사진 모두 보기
           </button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          
          {/* 왼쪽 컨텐츠 */}
          <div className="flex-1 space-y-10">
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">Locally 호스트님이 진행하는 체험</h2>
                <p className="text-slate-500">최대 {guestCount + 3}명 · 2시간 · 한국어</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                 <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>

            {/* 문의하기 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
              <h3 className="text-xl font-bold mb-2">호스트에게 문의하기</h3>
              <p className="text-sm text-slate-500 mb-4">궁금한 점이 있다면 언제든 메시지를 남겨주세요.</p>
              <textarea 
                className="w-full border border-slate-300 p-4 rounded-xl h-24 mb-4 resize-none focus:outline-none focus:border-black transition-colors bg-white"
                placeholder="안녕하세요, 예약 가능 날짜에 대해 문의드려요..."
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
              />
              <button onClick={handleInquiry} className="px-6 py-3 border border-black rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">
                메시지 보내기
              </button>
            </div>
          </div>

          {/* 오른쪽 스티키 예약 카드 (달력 포함) */}
          <div className="w-full md:w-[380px]">
            <div className="sticky top-28 border border-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)] rounded-2xl p-6 bg-white">
               <div className="flex justify-between items-end mb-6">
                 <div><span className="text-2xl font-bold">₩{Number(experience.price).toLocaleString()}</span> <span className="text-slate-500 text-sm">/ 인</span></div>
               </div>

               {/* 커스텀 달력 위젯 */}
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
                 
                 <div className="p-3 bg-white flex justify-between items-center cursor-pointer hover:bg-slate-50 border-t border-slate-200">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase text-slate-800">인원</span>
                     <span className="text-sm">게스트 {guestCount}명</span>
                   </div>
                   <ChevronRight className="rotate-90 text-slate-400" size={16}/>
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