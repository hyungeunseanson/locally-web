'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin, ChevronRight, MessageSquare
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
  const [hostProfile, setHostProfile] = useState<any>(null); // 호스트 추가 정보
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // 예약 폼 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(""); 
  const [inquiryText, setInquiryText] = useState('');
  
  // 달력 UI
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 1. 체험 정보
      const { data: exp, error } = await supabase
        .from('experiences')
        .select('*') // JOIN 없이 가져옴 (에러 방지)
        .eq('id', params.id)
        .single();

      if (error) { console.error(error); } 
      else {
        setExperience(exp);
        
        // 2. 예약 가능일
        const { data: dates } = await supabase.from('experience_availability').select('date').eq('experience_id', exp.id).eq('is_booked', false);
        if (dates) setAvailableDates(dates.map((d: any) => d.date));

        // 3. 호스트 정보 (지원서에서 자기소개 가져오기 - Airbnb 스타일)
        const { data: hostApp } = await supabase
          .from('host_applications')
          .select('self_intro, motivation, name, instagram')
          .eq('user_id', exp.host_id)
          .single();
        
        // 유저 메타데이터(사진) + 지원서 내용 합치기
        // (주의: getUserById는 클라이언트에서 안되므로, 편의상 user_metadata가 있다고 가정하거나 fallback 이미지 사용)
        setHostProfile(hostApp); 
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

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        
        {/* 타이틀 및 헤더 */}
        <section className="mb-8">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium underline decoration-slate-300 underline-offset-4 cursor-pointer">
              <span className="flex items-center gap-1"><Star size={14} fill="black"/> 4.98 · 후기 15개</span>
              <span className="flex items-center gap-1"><MapPin size={14}/> {experience.location}</span>
            </div>
            <div className="flex gap-2">
               <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Share size={16} /> 공유하기</button>
               <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Heart size={16} /> 저장</button>
            </div>
          </div>
        </section>

        {/* 이미지 그리드 */}
        <section className="rounded-xl overflow-hidden aspect-[2/1] mb-12 bg-slate-100 relative group">
           <img src={experience.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
           <button className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg text-sm font-bold shadow-md border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform">
             <ChevronRight size={16}/> 사진 모두 보기
           </button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          
          {/* 왼쪽 컨텐츠 */}
          <div className="flex-1 space-y-12">
            
            {/* 1. 호스트 요약 */}
            <div className="border-b border-slate-200 pb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">{hostProfile?.name || 'Locally Host'}님이 호스팅하는 체험</h2>
                <p className="text-slate-500">최대 {guestCount + 3}명 · 2시간 · 한국어</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                 <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
              </div>
            </div>

            {/* 2. 체험 소개 */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>

            {/* 3. 호스트 카드 (Airbnb 스타일) */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-xl font-bold mb-6">호스트 소개</h3>
              <div className="bg-slate-50 rounded-3xl p-8 flex flex-col md:flex-row gap-8 shadow-sm">
                 <div className="flex flex-col items-center justify-center min-w-[200px] text-center space-y-2">
                    <div className="w-28 h-28 rounded-full overflow-hidden mb-2 shadow-lg">
                      <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
                    </div>
                    <h4 className="text-xl font-black">{hostProfile?.name || 'Host'}</h4>
                    <div className="flex gap-2 items-center text-xs font-bold text-slate-500">
                       <ShieldCheck size={14}/> 신원 인증됨
                    </div>
                 </div>
                 <div className="flex-1 space-y-4">
                    <p className="text-slate-700 leading-relaxed">{hostProfile?.self_intro || "안녕하세요! 여행을 사랑하는 호스트입니다. 현지인만 아는 특별한 장소로 여러분을 초대합니다."}</p>
                    <p className="text-slate-700 leading-relaxed font-medium">"{hostProfile?.motivation || '새로운 친구를 만나는 것은 언제나 설레는 일이죠!'}"</p>
                    <button onClick={() => document.getElementById('inquiry')?.scrollIntoView({behavior:'smooth'})} className="px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-100 transition-colors mt-4">
                      호스트에게 연락하기
                    </button>
                 </div>
              </div>
            </div>

            {/* 4. 만나는 장소 (지도 UI) */}
            <div className="border-b border-slate-200 pb-8">
               <h3 className="text-xl font-bold mb-4">만나는 장소</h3>
               <p className="text-slate-500 mb-4">{experience.location}</p>
               <div className="w-full h-64 bg-slate-100 rounded-2xl relative overflow-hidden group cursor-pointer border border-slate-200">
                  {/* 가짜 지도 이미지 */}
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b" className="w-full h-full object-cover opacity-50 group-hover:opacity-60 transition-opacity grayscale"/>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="bg-white p-3 rounded-full shadow-lg animate-bounce">
                        <MapPin size={24} className="text-rose-500 fill-rose-500"/>
                     </div>
                  </div>
               </div>
            </div>

            {/* 5. 후기 (UI Mockup) */}
            <div className="border-b border-slate-200 pb-8">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Star size={20} fill="black"/> 4.98 · 후기 15개</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="space-y-2">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                          <div><div className="font-bold text-sm">Guest {i}</div><div className="text-xs text-slate-500">2026년 1월</div></div>
                       </div>
                       <p className="text-sm text-slate-600 line-clamp-3">호스트님이 정말 친절하셨고, 코스도 완벽했습니다. 다시 오고 싶어요!</p>
                    </div>
                  ))}
               </div>
               <button className="mt-6 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50">후기 15개 모두 보기</button>
            </div>

            {/* 6. 알아두어야 할 사항 */}
            <div id="inquiry" className="pb-8">
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

          {/* 오른쪽 스티키 예약 카드 */}
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