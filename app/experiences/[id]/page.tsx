'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  Globe, Users, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase'; // ✅ Supabase 가져오기

export default function ExperienceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null); // ✅ 내 정보 담을 곳
  const [isLiked, setIsLiked] = useState(false);
  
  // 예약 상태
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState("2026-10-24");
  const [selectedTime, setSelectedTime] = useState("19:00");

  // ✅ (가짜) 상품 데이터
  const experience = {
    id: params.id,
    title: "현지인과 함께하는 시부야 이자카야 탐방",
    location: "도쿄, 시부야",
    price: 85000,
    rating: 4.98,
    reviewCount: 124,
    images: [
      "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&q=80&w=600"
    ]
  };

  const SERVICE_FEE = 12000;
  const totalPrice = (experience.price * guestCount) + SERVICE_FEE;

  // ✅ 페이지 켜지면 내 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleReserve = () => {
    // 로그인이 안 되어 있으면 로그인 창으로 보내거나 알림
    if (!user) {
      const confirmLogin = confirm("로그인이 필요한 서비스입니다. 로그인 하시겠습니까?");
      if (confirmLogin) router.push('/'); // 메인으로 보내서 로그인 유도 (나중엔 로그인 모달 띄우기)
      return;
    }
    router.push(`/experiences/${params.id}/payment`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      
      {/* 1. Navbar */}
      <header className="h-20 border-b border-slate-100 flex items-center px-6 sticky top-0 bg-white z-50">
        <div className="max-w-[1280px] mx-auto w-full flex justify-between items-center">
          <Link href="/" className="font-black text-xl tracking-tighter">Locally</Link>
          
          <Link href="/" className="md:hidden p-2">
            <ChevronLeft size={24} />
          </Link>

          <div className="hidden md:flex gap-4 text-sm font-semibold items-center">
            <Link href="/host/register" className="hover:bg-slate-50 px-4 py-2 rounded-full">호스트 되기</Link>
            
            {/* ✅ 로그인 상태에 따라 내 얼굴 보여주기 */}
            {user ? (
              <div className="flex items-center gap-2">
                 <span className="text-xs text-slate-500 hidden lg:block">{user.email}</span>
                 <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                    <img 
                      src={user.user_metadata.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                 </div>
              </div>
            ) : (
              <button className="bg-black text-white px-4 py-2 rounded-full hover:scale-105 transition-transform">로그인</button>
            )}
          </div>
        </div>
      </header>

      {/* ... 나머지 본문 내용은 동일 ... */}
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        
        {/* Header Info */}
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 text-sm font-medium underline cursor-pointer">
              <Star size={14} fill="black" />
              <span>{experience.rating} ({experience.reviewCount}개 후기)</span>
              <span>·</span>
              <span>{experience.location}</span>
            </div>
            <div className="flex gap-2">
               <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Share size={16} /> 공유하기
               </button>
               <button onClick={() => setIsLiked(!isLiked)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Heart size={16} fill={isLiked ? "red" : "transparent"} className={isLiked ? "text-red-500" : ""} /> 저장
               </button>
            </div>
          </div>
        </section>

        {/* Photo Grid */}
        <section className="relative rounded-2xl overflow-hidden aspect-[2/1] md:aspect-[2.5/1] mb-10 grid grid-cols-4 grid-rows-2 gap-2">
          <div className="col-span-2 row-span-2 relative bg-slate-200"><img src={experience.images[0]} className="w-full h-full object-cover"/></div>
          <div className="relative bg-slate-200"><img src={experience.images[1]} className="w-full h-full object-cover"/></div>
          <div className="relative bg-slate-200"><img src={experience.images[2]} className="w-full h-full object-cover"/></div>
          <div className="relative bg-slate-200"><img src={experience.images[3]} className="w-full h-full object-cover"/></div>
          <div className="relative bg-slate-200"><img src={experience.images[4]} className="w-full h-full object-cover"/></div>
        </section>

        {/* Content & Booking */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column */}
          <div className="md:col-span-2 space-y-10">
            <div className="flex justify-between items-center border-b border-slate-200 pb-8">
              <div>
                <h2 className="text-2xl font-bold mb-1">Kenji님이 호스팅하는 체험</h2>
                <ul className="flex gap-4 text-slate-500 text-sm"><li>2 시간</li><li>최대 4명</li><li>한국어, 일본어</li></ul>
              </div>
              <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden relative">
                <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center"><ShieldCheck size={12} className="text-black" /></div>
              </div>
            </div>
            
            <div className="border-b border-slate-200 pb-8">
              <h2 className="text-xl font-bold mb-4">체험 소개</h2>
              <p className="text-slate-700 leading-relaxed mb-4">시부야의 뒷골목, 진짜 로컬들만 아는 이자카야로 안내합니다.</p>
            </div>
          </div>

          {/* Right Column (Booking) */}
          <div className="relative">
            <div className="sticky top-32 bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
               <div className="flex justify-between items-end mb-6">
                 <div><span className="text-2xl font-bold">₩{experience.price.toLocaleString()}</span><span className="text-slate-500 text-sm"> / 인</span></div>
               </div>

               {/* 입력 폼 */}
               <div className="border border-slate-300 rounded-xl mb-4">
                 <div className="flex border-b border-slate-300">
                   <div className="flex-1 p-3 border-r border-slate-300">
                     <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">날짜</label>
                     <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full text-sm outline-none bg-transparent"/>
                   </div>
                   <div className="flex-1 p-3">
                     <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">시간</label>
                     <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full text-sm outline-none bg-transparent">
                       <option>19:00 - 21:00</option>
                     </select>
                   </div>
                 </div>
                 <div className="p-3">
                   <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">인원</label>
                   <select className="w-full bg-transparent text-sm outline-none" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
                     {[1,2,3,4].map(n => <option key={n} value={n}>게스트 {n}명</option>)}
                   </select>
                 </div>
               </div>

               <button onClick={handleReserve} className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all mb-4">
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