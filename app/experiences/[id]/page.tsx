'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, Heart, Share, ChevronLeft, ShieldCheck, 
  MapPin 
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
  
  const [guestCount, setGuestCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [inquiryText, setInquiryText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // 1. 내 정보
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 2. 체험 정보 (❗수정됨: 호스트 정보 join 제거 -> 에러 방지)
      const { data: exp, error } = await supabase
        .from('experiences')
        .select('*') 
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

  // 문의하기
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
      alert('전송되었습니다!');
      setInquiryText('');
    } else {
      alert('전송 실패');
    }
  };

  const handleReserve = () => {
    if (!user) return alert("로그인이 필요합니다.");
    router.push(`/experiences/${params.id}/payment`);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const totalPrice = Number(experience.price) * guestCount;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />

      <main className="max-w-[1280px] mx-auto px-6 py-8">
        {/* 헤더 */}
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
             <span className="flex items-center gap-1"><Star size={14} fill="black"/> 4.9</span>
             <span className="flex items-center gap-1"><MapPin size={14}/> {experience.location}</span>
          </div>
        </section>

        {/* 이미지 */}
        <section className="relative rounded-2xl overflow-hidden aspect-[2/1] md:aspect-[2.5/1] mb-10 bg-slate-100">
          <img src={experience.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} className="w-full h-full object-cover" />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* 왼쪽 컨텐츠 */}
          <div className="md:col-span-2 space-y-10">
            <div className="border-b border-slate-200 pb-8">
              <h2 className="text-2xl font-bold mb-2">체험 상세 소개</h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>
            
            {/* 문의하기 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-xl font-bold mb-2">호스트에게 문의하기</h3>
              <textarea 
                className="w-full border border-slate-300 p-4 rounded-xl h-24 mb-4 resize-none focus:outline-none"
                placeholder="궁금한 점을 남겨주세요."
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
              />
              <button onClick={handleInquiry} className="px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100">메시지 보내기</button>
            </div>
          </div>

          {/* 오른쪽 예약 */}
          <div className="relative">
            <div className="sticky top-32 bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
               <div className="text-2xl font-bold mb-6">₩{Number(experience.price).toLocaleString()} <span className="text-sm font-normal text-slate-500">/ 인</span></div>
               
               <div className="border border-slate-300 rounded-xl mb-4">
                 <div className="p-3 border-b border-slate-300">
                   <label className="block text-[10px] font-bold uppercase mb-1">날짜</label>
                   <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full text-sm outline-none"/>
                 </div>
                 <div className="p-3">
                   <label className="block text-[10px] font-bold uppercase mb-1">인원</label>
                   <select className="w-full outline-none text-sm" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
                     {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}명</option>)}
                   </select>
                 </div>
               </div>

               <button onClick={handleReserve} className="w-full bg-rose-600 text-white font-bold py-3.5 rounded-xl hover:bg-rose-700 transition-colors mb-4">예약하기</button>
               <div className="flex justify-between font-bold pt-3 border-t"><span>총 합계</span><span>₩{totalPrice.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}