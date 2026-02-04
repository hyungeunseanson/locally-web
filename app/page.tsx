'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Star, MapPin, Search, Globe, ChevronLeft, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

const CATEGORIES = [
  { id: 'all', label: '전체', icon: '🌏' },
  { id: 'tokyo', label: '도쿄', icon: '🗼' },
  { id: 'osaka', label: '오사카', icon: '🏯' },
  { id: 'fukuoka', label: '후쿠오카', icon: '🍜' },
  { id: 'sapporo', label: '삿포로', icon: '☃️' },
  { id: 'nagoya', label: '나고야', icon: '🍣' },
  { id: 'seoul', label: '서울', icon: '🏙️' },
  { id: 'busan', label: '부산', icon: '🚢' },
  { id: 'jeju', label: '제주', icon: '🏔️' },
];

const LOCALLY_SERVICES = [
  { id: 1, title: '일본 식당 전화 예약 대행', price: 5000, image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b', desc: '한국어 대응 불가 식당, 대신 예약해드립니다.' },
  { id: 2, title: '일본 전세 버스 대절 서비스', price: 350000, image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e', desc: '단체 여행을 위한 쾌적한 버스 대절.' },
  { id: 3, title: '현지 비즈니스 통역 파견', price: 200000, image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df', desc: '중요한 미팅, 전문 통역사가 함께합니다.' },
  { id: 4, title: '팝업 스토어 스태프 인력', price: 15000, image: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d', desc: '일본 현지 행사/팝업 운영 인력 지원.' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'service'>('experience');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeSearchField, setActiveSearchField] = useState<'location' | 'date' | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });
  const searchRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const isScrolled = scrollY > 20;
  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      if (window.scrollY > 50) setActiveSearchField(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setActiveSearchField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ 데이터 로딩 (수정됨: 승인된 체험만 가져오기)
  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active') // 🟢 이 부분이 추가되었습니다! (승인된 것만 노출)
          .order('created_at', { ascending: false });
        
        if (selectedCategory !== 'all') {
           // 추후 city 컬럼 등으로 필터링 추가 가능
           // query = query.eq('city', selectedCategory); 
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) setExperiences(data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchExperiences();
  }, [selectedCategory]);

  const formatDateRange = () => {
    if (dateRange.start && dateRange.end) {
      return `${dateRange.start.getMonth()+1}월 ${dateRange.start.getDate()}일 - ${dateRange.end.getMonth()+1}월 ${dateRange.end.getDate()}일`;
    }
    if (dateRange.start) return `${dateRange.start.getMonth()+1}월 ${dateRange.start.getDate()}일`;
    return '';
  };

  const progress = Math.min(scrollY / 50, 1);
  const expandedSearchStyle = {
    opacity: 1 - progress * 2,
    transform: `scale(${1 - progress * 0.2}) translateY(${progress * -20}px)`,
    pointerEvents: isScrolled ? 'none' : 'auto',
    display: progress > 0.8 ? 'none' : 'flex',
  };
  const collapsedSearchStyle = {
    opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2,
    transform: `scale(${0.8 + progress * 0.2}) translateY(0)`,
    pointerEvents: isScrolled ? 'auto' : 'none',
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans relative">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-20 transition-shadow">
        <SiteHeader />
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md transition-all h-12 px-2 cursor-pointer z-50"
          style={collapsedSearchStyle as any}
          onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">어디든지</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">언제든지</div>
          <div className="px-4 text-sm font-bold text-slate-500">검색</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2"><Search size={14} strokeWidth={3}/></button>
        </div>
      </div>

      <div className="pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">
          <div className={`flex gap-8 mb-4 transition-all duration-300 ${isScrolled ? 'opacity-0 -translate-y-10' : 'opacity-100'}`}>
            <button onClick={() => setActiveTab('experience')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'experience' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🎈</span> 체험
            </button>
            <button onClick={() => setActiveTab('service')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'service' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🛎️</span> 서비스
            </button>
          </div>

          <div className="relative w-full max-w-3xl h-[66px]" style={expandedSearchStyle as any}>
            <div className={`absolute inset-0 flex items-center bg-white border ${activeSearchField ? 'border-transparent bg-slate-100' : 'border-slate-200'} rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all`}>
              <div className={`flex-[1.5] px-8 h-full flex flex-col justify-center rounded-full cursor-pointer transition-colors relative z-10 ${activeSearchField === 'location' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} onClick={() => setActiveSearchField('location')}>
                <label className="text-[11px] font-bold text-slate-800">여행지</label>
                <input type="text" placeholder="도시나 명소로 검색" value={locationInput} readOnly className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"/>
              </div>
              <div className={`flex-[1] px-8 h-full flex flex-col justify-center rounded-full cursor-pointer transition-colors relative z-10 ${activeSearchField === 'date' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} onClick={() => setActiveSearchField('date')}>
                <label className="text-[11px] font-bold text-slate-800">날짜</label>
                <input type="text" placeholder="날짜 선택" value={formatDateRange()} readOnly className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"/>
              </div>
              <div className="pl-4 pr-2 h-full flex items-center justify-end rounded-full z-10">
                <button className="w-12 h-12 bg-[#FF385C] hover:bg-[#E00B41] rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"><Search size={22} strokeWidth={2.5}/></button>
              </div>
            </div>

            {activeSearchField === 'location' && (
              <div className="absolute top-[80px] left-0 w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
                <h4 className="text-xs font-bold text-slate-500 mb-3 px-2">지역으로 검색하기</h4>
                <div className="grid grid-cols-1 gap-1">
                  {CATEGORIES.filter(c => c.id !== 'all').map((city) => (
                    <button key={city.id} onClick={() => { setLocationInput(city.label); setActiveSearchField('date'); setSelectedCategory(city.id); }} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left group">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all"><MapPin size={20} /></div>
                      <span className="font-bold text-slate-700">{city.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSearchField === 'date' && (
              <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
                <DatePicker selectedRange={dateRange} onChange={(range) => { setDateRange(range); if (range.start && range.end) setActiveSearchField(null); }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'experience' && (
        <div className="bg-white pb-6 pt-2 border-b border-slate-100">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-12 overflow-x-auto no-scrollbar pb-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group ${selectedCategory === cat.id ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'}`}>
                  <span className="text-3xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1760px] mx-auto px-6 md:px-12 py-8 min-h-screen">
        {activeTab === 'experience' && (
          loading ? (
            <div className="flex justify-center py-40"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div></div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <div className="text-4xl mb-4">🌏</div>
              <h3 className="text-lg font-bold text-slate-900">아직 등록된 체험이 없습니다.</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10">
              {experiences.map((item) => <ExperienceCard key={item.id} item={item} />)}
            </div>
          )
        )}

        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {LOCALLY_SERVICES.map((item) => <ServiceCard key={item.id} item={item} />)}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 bg-slate-50 mt-20">
        <div className="max-w-[1760px] mx-auto px-6 md:px-12 py-12">
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
                <li><Link href="/host/register" className="hover:underline">호스트 되기</Link></li>
                <li><Link href="#" className="hover:underline">호스트 추천하기</Link></li>
                <li><Link href="#" className="hover:underline">책임 보험</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-black mb-4">지원</h5>
              <ul className="space-y-3">
                <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
                <li><Link href="#" className="hover:underline">안전 센터</Link></li>
                <li><Link href="#" className="hover:underline">예약 취소 옵션</Link></li>
                <li><Link href="#" className="hover:underline">장애인 지원</Link></li>
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

function DatePicker({ selectedRange, onChange }: { selectedRange: any, onChange: (range: any) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) { onChange({ start: clickedDate, end: null }); } 
    else { if (clickedDate < selectedRange.start) { onChange({ start: clickedDate, end: selectedRange.start }); } else { onChange({ ...selectedRange, end: clickedDate }); } }
  };
  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const startBlank = getFirstDay(year, month);
    const days = [];
    for (let i = 0; i < startBlank; i++) days.push(<div key={`empty-${i}`} />);
    for (let d = 1; d <= daysCount; d++) {
      const date = new Date(year, month, d);
      const isStart = selectedRange.start?.getTime() === date.getTime();
      const isEnd = selectedRange.end?.getTime() === date.getTime();
      const isInRange = selectedRange.start && selectedRange.end && date > selectedRange.start && date < selectedRange.end;
      days.push(
        <button key={d} onClick={() => handleDateClick(d)} className={`h-10 w-10 rounded-full text-sm font-bold flex items-center justify-center transition-all ${isStart || isEnd ? 'bg-black text-white' : ''} ${isInRange ? 'bg-slate-100' : ''} ${!isStart && !isEnd && !isInRange ? 'hover:border border-black' : ''}`}>{d}</button>
      );
    }
    return days;
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}><ChevronLeft size={20}/></button>
        <span className="font-bold">{currentDate.getFullYear()}년 {currentDate.getMonth()+1}월</span>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 text-center gap-y-1 text-xs font-bold text-slate-500 mb-2">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1 justify-items-center">{renderDays()}</div>
    </div>
  );
}

function ExperienceCard({ item }: any) {
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        <img src={item.photos && item.photos[0] ? item.photos[0] : "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10"><Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} /></button>
      </div>
      <div className="space-y-1 px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">{item.city || '서울'} · {item.category}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0"><Star size={14} fill="black" /><span>4.95</span><span className="text-slate-400 font-normal">(32)</span></div>
        </div>
        <p className="text-[15px] text-slate-500 line-clamp-1">{item.title}</p>
        <div className="mt-1"><span className="font-bold text-slate-900 text-[15px]">₩{Number(item.price).toLocaleString()}</span><span className="text-[15px] text-slate-900 font-normal"> / 인</span></div>
      </div>
    </Link>
  )
}

function ServiceCard({ item }: any) {
  return (
    <div className="block group cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3">
        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-white">
           <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
           <p className="text-sm opacity-90 line-clamp-2">{item.desc}</p>
        </div>
      </div>
      <div className="mt-1 font-bold text-slate-900 px-1">₩{item.price.toLocaleString()}부터</div>
    </div>
  )
}