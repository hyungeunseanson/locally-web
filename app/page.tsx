'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Star, MapPin, Search, Calendar, Users, 
  ChevronRight, Globe, SlidersHorizontal 
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client'; // 클라이언트 수정
import SiteHeader from '@/app/components/SiteHeader';

const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌍' },
  { id: 'culture', label: '문화/예술', icon: '🎨' },
  { id: 'food', label: '음식/투어', icon: '🍳' },
  { id: 'nature', label: '자연/야외', icon: '🌲' },
  { id: 'night', label: '나이트라이프', icon: '🍸' },
  { id: 'class', label: '원데이클래스', icon: '🧶' },
];

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) setExperiences(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiences();
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      {/* Hero Search Section */}
      <section className="relative h-[500px] flex items-center justify-center bg-slate-900">
        <img 
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800" 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          alt="Hero Background"
        />
        <div className="relative z-10 w-full max-w-4xl px-6 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-lg">
            특별한 로컬 경험을<br/>발견하세요
          </h1>
          
          <div className="bg-white p-2 rounded-full shadow-2xl flex items-center max-w-2xl mx-auto">
            <div className="flex-1 px-6 border-r border-slate-200">
              <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">어디로 떠나세요?</label>
              <input type="text" placeholder="여행지 검색" className="w-full text-sm text-black outline-none placeholder:text-slate-400 font-medium"/>
            </div>
            <div className="flex-1 px-6 border-r border-slate-200 hidden md:block">
              <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">날짜</label>
              <input type="text" placeholder="날짜 추가" className="w-full text-sm text-black outline-none placeholder:text-slate-400 font-medium"/>
            </div>
            <div className="flex-1 px-6 hidden md:block">
              <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">인원</label>
              <input type="text" placeholder="게스트 추가" className="w-full text-sm text-black outline-none placeholder:text-slate-400 font-medium"/>
            </div>
            <button className="bg-rose-500 hover:bg-rose-600 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors">
              <Search size={20} strokeWidth={3}/>
            </button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <div className="bg-white border-b border-slate-100 sticky top-20 z-40">
        <div className="max-w-[1760px] mx-auto px-6 py-4 flex items-center gap-8 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex flex-col items-center gap-2 min-w-[64px] pb-2 transition-all border-b-2 ${
                selectedCategory === cat.id 
                  ? 'border-black text-black opacity-100' 
                  : 'border-transparent text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-200'
              }`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1760px] mx-auto px-6 py-12 space-y-16">
        
        {/* Section 1: 인기 체험 */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold">🔥 이번 주 인기 체험</h2>
            <Link href="/search?sort=popular" className="text-sm font-semibold underline">모두 보기</Link>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
              {experiences.length === 0 ? (
                <div className="col-span-full text-center py-20 text-slate-500">등록된 체험이 없습니다.</div>
              ) : (
                experiences.map((item) => <ExperienceCard key={item.id} item={item} />)
              )}
            </div>
          )}
        </section>

        {/* Section 2: Banner */}
        <section className="bg-slate-100 rounded-2xl p-10 md:p-20 text-center relative overflow-hidden">
           <img src="https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b" className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply"/>
           <div className="relative z-10">
             <h2 className="text-3xl md:text-4xl font-black mb-4">나만의 취미를 공유하고 수익을 만드세요</h2>
             <p className="text-slate-600 mb-8 max-w-xl mx-auto">누구나 호스트가 되어 특별한 경험을 나눌 수 있습니다. 지금 바로 시작해보세요.</p>
             <Link href="/host/register">
               <button className="bg-black text-white px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform">호스트 등록하기</button>
             </Link>
           </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-12 px-6">
        <div className="max-w-[1760px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-slate-500">
          <div>
            <h5 className="font-bold text-black mb-4">Locally</h5>
            <ul className="space-y-2">
              <li><Link href="/about">소개</Link></li>
              <li><Link href="/careers">채용 정보</Link></li>
              <li><Link href="/admin/dashboard">관리자 페이지</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-black mb-4">호스팅</h5>
            <ul className="space-y-2">
              <li><Link href="/host/register">호스트 되기</Link></li>
              <li><Link href="/host/resources">호스트 리소스</Link></li>
              <li><Link href="/community">커뮤니티 포럼</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-black mb-4">지원</h5>
            <ul className="space-y-2">
              <li><Link href="/help">도움말 센터</Link></li>
              <li><Link href="/safety">안전 센터</Link></li>
              <li><Link href="/cancellation">예약 취소 옵션</Link></li>
            </ul>
          </div>
          <div>
             <div className="flex gap-4 font-semibold text-slate-900 mb-4">
               <span className="flex items-center gap-1"><Globe size={16}/> 한국어 (KR)</span>
               <span>₩ KRW</span>
             </div>
             <p className="text-xs">© 2026 Locally, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ExperienceCard({ item }: any) {
  return (
    <Link href={`/experiences/${item.id}`}>
      <div className="group cursor-pointer">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-slate-100">
          <img 
            src={item.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} 
            alt={item.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all">
            <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
          </button>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-900 flex items-center gap-1"><MapPin size={12}/> {item.location || '서울'}</span>
            <div className="flex items-center gap-1">
              <Star size={12} fill="black" stroke="none" />
              <span className="text-black">4.9</span>
              <span className="text-slate-400">(15)</span>
            </div>
          </div>
          <h3 className="text-sm font-light leading-snug line-clamp-2 text-slate-900 group-hover:underline decoration-1 underline-offset-2">
            {item.title}
          </h3>
          <div className="pt-1">
            <span className="font-bold text-sm">₩{Number(item.price).toLocaleString()}</span>
            <span className="text-slate-500 text-sm font-light"> / 인</span>
          </div>
        </div>
      </div>
    </Link>
  )
}