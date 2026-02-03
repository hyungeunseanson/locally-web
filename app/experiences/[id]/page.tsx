'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client'; // ✅ 통합된 클라이언트 사용
import SiteHeader from '@/app/components/SiteHeader';

export default function ExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [experience, setExperience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 예약 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  
  // ✅ [수정 완료] 에러의 원인이었던 변수 선언 추가!
  const [inquiryText, setInquiryText] = useState('');

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      // 1. 내 정보
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 2. 체험 정보 (호스트 정보 포함)
      const { data: exp, error } = await supabase
        .from('experiences')
        .select('*, host:host_id(*)')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error("체험 로딩 실패:", error);
      } else {
        setExperience(exp);
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, supabase]);

  // 문의하기 기능
  const handleInquiry = async () => {
    if (!user) return alert('로그인이 필요합니다.');
    if (!inquiryText.trim()) return alert('내용을 입력해주세요.');

    const { error } = await supabase.from('inquiries').insert([{
      experience_id: experience.id,
      host_id: experience.host_id,
      user_id: user.id,
      content: inquiryText
    }]);

    if (!error) {
      alert('호스트에게 메시지를 보냈습니다!');
      setInquiryText('');
    } else {
      alert('전송 실패');
    }
  };

  // 예약 페이지로 이동
  const handleReserve = () => {
    if (!user) return alert("로그인이 필요합니다.");
    router.push(`/experiences/${params.id}/payment`);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const SERVICE_FEE = 0; // 수수료 (필요시 추가)
  const totalPrice = (Number(experience.price) * guestCount) + SERVICE_FEE;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      
      <SiteHeader />

      <main className="max-w-[1280px] mx-auto px-6 py-8">
        
        {/* Header Info */}
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 text-sm font-medium underline cursor-pointer">
              <Star size={14} fill="black" />
              <span>4.9 (120개 후기)</span>
              <span>·</span>
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

        {/* Photo Area */}
        <section className="relative rounded-2xl overflow-hidden aspect-[2/1] md:aspect-[2.5/1] mb-10 bg-slate-100 border border-slate-200">
          <img 
            src={experience.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
            className="w-full h-full object-cover" 
            alt={experience.title} 
          />
        </section>

        {/* Content & Booking */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column */}
          <div className="md:col-span-2 space-y-10">
            <div className="flex justify-between items-center border-b border-slate-200 pb-8">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {experience.host?.user_metadata?.full_name || 'Locally Host'}님이 호스팅하는 체험
                </h2>
                <ul className="flex gap-4 text-slate-500 text-sm">
                  <li>최대 4명</li>
                  <li>한국어, 일본어</li>
                </ul>
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden relative">
                <img 
                  src={experience.host?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <ShieldCheck size={12} className="text-black" />
                </div>
              </div>
            </div>
            
            <div className="border-b border-slate-200 pb-8">
              <h2 className="text-xl font-bold mb-4">체험 소개</h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>

            {/* ✅ 문의하기 섹션 (이제 에러 안 남) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-xl font-bold mb-2">호스트에게 문의하기</h3>
              <p className="text-sm text-slate-500 mb-4">체험에 대해 궁금한 점이 있다면 언제든 물어보세요.</p>
              <textarea 
                className="w-full border border-slate-300 p-4 rounded-xl h-24 mb-4 resize-none focus:outline-none focus:border-black transition-colors"
                placeholder="안녕하세요, 이 체험에 관심이 있는데요..."
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
              />
              <button 
                onClick={handleInquiry} 
                className="px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm"
              >
                메시지 보내기
              </button>
            </div>
          </div>

          {/* Right Column (Booking) */}
          <div className="relative">
            <div className="sticky top-32 bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
               <div className="flex justify-between items-end mb-6">
                 <div>
                   <span className="text-2xl font-bold">₩{Number(experience.price).toLocaleString()}</span>
                   <span className="text-slate-500 text-sm"> / 인</span>
                 </div>
               </div>

               {/* 입력 폼 */}
               <div className="border border-slate-300 rounded-xl mb-4">
                 <div className="flex border-b border-slate-300">
                   <div className="flex-1 p-3 border-r border-slate-300">
                     <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">날짜</label>
                     <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full text-sm outline-none bg-transparent"/>
                   </div>
                 </div>
                 <div className="p-3">
                   <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">인원</label>
                   <select className="w-full bg-transparent text-sm outline-none" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
                     {[1,2,3,4,5].map(n => <option key={n} value={n}>게스트 {n}명</option>)}
                   </select>
                 </div>
               </div>

               <button 
                 onClick={handleReserve} 
                 className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all mb-4"
               >
                 예약하기
               </button>
               
               <div className="flex justify-between font-bold text-slate-900 pt-3 border-t border-slate-100 mt-2">
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