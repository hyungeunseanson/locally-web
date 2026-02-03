'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useParams, useRouter } from 'next/navigation';
import { MapPin, Star, Heart, Share2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ExperienceDetailPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const [experience, setExperience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ [수정 완료] 에러의 원인이었던 '문의하기 상태'를 여기에 선언했습니다!
  const [inquiryText, setInquiryText] = useState('');

  useEffect(() => {
    const fetchExperience = async () => {
      const { data, error } = await supabase
        .from('experiences')
        .select('*, host:host_id(*)') // 호스트 정보도 가져오기
        .eq('id', params.id)
        .single();
      
      if (error) {
        console.error(error);
        // 에러나면 메인으로
        // router.push('/'); 
      } else {
        setExperience(data);
      }
      setLoading(false);
    };
    fetchExperience();
  }, [params.id, router, supabase]);

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
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

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 이미지 섹션 */}
        <div className="relative aspect-video rounded-3xl overflow-hidden mb-8 bg-slate-100 border border-slate-200">
          {experience.image_url ? (
            <img src={experience.image_url} className="w-full h-full object-cover" alt={experience.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">이미지 없음</div>
          )}
          <button className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md hover:scale-105 transition-transform">
            <Heart size={20} className="text-slate-900"/>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* 왼쪽: 상세 정보 */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-2">{experience.title}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={16}/> {experience.location || '위치 정보 없음'}</span>
                <span className="flex items-center gap-1"><Star size={16} className="text-black fill-black"/> 4.8 (120)</span>
              </div>
            </div>

            <div className="border-t border-b border-slate-100 py-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden border border-slate-100">
                 <img src={experience.host?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-bold text-sm">호스트: {experience.host?.user_metadata?.full_name || 'Locally Host'}</p>
                <p className="text-xs text-slate-500">인증된 호스트</p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>

            {/* ✅ 문의하기 섹션 (이제 에러 안 남) */}
            <div className="mt-12 border-t pt-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-xl font-bold mb-2">호스트에게 문의하기</h3>
              <p className="text-sm text-slate-500 mb-4">체험에 대해 궁금한 점이 있다면 언제든 물어보세요.</p>
              <textarea 
                className="w-full border border-slate-300 p-4 rounded-xl h-24 mb-4 resize-none focus:outline-none focus:border-black transition-colors"
                placeholder="안녕하세요, 이 체험에 관심이 있는데요..."
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
              />
              <button onClick={handleInquiry} className="px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm">
                메시지 보내기
              </button>
            </div>
          </div>

          {/* 오른쪽: 예약 카드 (Sticky) */}
          <div className="md:col-span-1">
            <div className="sticky top-24 border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-100/50 bg-white">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <span className="text-2xl font-bold">₩{Number(experience.price).toLocaleString()}</span>
                  <span className="text-slate-500 text-sm"> / 인</span>
                </div>
              </div>

              <Link href={`/experiences/${experience.id}/payment`}>
                <button className="w-full bg-rose-600 text-white font-bold py-4 rounded-xl hover:bg-rose-700 transition-colors mb-4 text-lg shadow-lg shadow-rose-200">
                  예약하기
                </button>
              </Link>
              
              <p className="text-center text-xs text-slate-400">예약 확정 전에는 결제되지 않습니다.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}