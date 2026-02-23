'use client';

import React, { useState } from 'react';
import { Share, Heart, MapPin, Check, X, Grid, Copy } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import { useWishlist } from '@/app/hooks/useWishlist';
import ExpMainContent from './components/ExpMainContent';
import ExpSidebar from './components/ExpSidebar';
import StickyActionSheet from './components/StickyActionSheet';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import { getContent } from '@/app/utils/contentHelper'; // 🟢 추가
import { supabase } from '@/app/lib/supabase'; // 🟢 추가: 퍼널 트래킹용

type Props = {
  initialUser: any;
  initialExperience: any;
  initialHostProfile: any;
  initialAvailableDates: string[];
  initialDateToTimeMap: Record<string, string[]>;
  initialRemainingSeatsMap: Record<string, number>;
};

export default function ExperienceClient({
  initialUser,
  initialExperience,
  initialHostProfile,
  initialAvailableDates,
  initialDateToTimeMap,
  initialRemainingSeatsMap
}: Props) {
  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { createInquiry } = useChat();
  const { lang } = useLanguage(); // 🟢 현재 언어 (LanguageContext는 lang 제공)

  const experienceId = params?.id as string;
  const { isSaved, toggleWishlist, isLoading: isSaveLoading } = useWishlist(experienceId);

  const [user] = useState(initialUser);
  const [experience] = useState(initialExperience);
  const [hostProfile] = useState(initialHostProfile);

  const [availableDates] = useState<string[]>(initialAvailableDates);
  const [dateToTimeMap] = useState<Record<string, string[]>>(initialDateToTimeMap);
  const [remainingSeatsMap] = useState<Record<string, number>>(initialRemainingSeatsMap);

  const [inquiryText, setInquiryText] = useState('');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // 🟢 [핵심] 제목을 언어에 맞춰서 변환!
  const translatedTitle = getContent(experience, 'title', lang);
  // 🟢 [핵심] 위치 정보는 아직 번역이 없으므로 한국어 사용 (나중에 location_en 추가 가능)
  const location = experience.location;

  // 🟢 체험 상세페이지 진입 시 조회(view) 이벤트 기록
  React.useEffect(() => {
    if (experience?.id) {
      supabase.from('analytics_events').insert([{
        event_type: 'view',
        target_id: String(experience.id),
        user_id: user?.id || null
      }]).then(({ error }) => {
        if (error) console.error('View Event Log Error:', error);
      });
    }
  }, [experience?.id, user?.id]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopySuccess(true);
    setTimeout(() => setIsCopySuccess(false), 3000);
  };

  const handleInquiry = async () => {
    if (!user) return showToast('로그인이 필요합니다.', 'error');
    if (!inquiryText.trim()) return showToast('내용을 입력해주세요.', 'error');

    try {
      if (!experience?.host_id) return showToast('호스트 정보를 불러올 수 없습니다.', 'error');
      await createInquiry(experience.host_id, experience.id, inquiryText);
      if (confirm('문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?')) {
        router.push('/guest/inbox');
      }
      setInquiryText('');
    } catch (e: any) {
      showToast('문의 전송 실패: ' + e.message, 'error');
    }
  };

  const handleReserve = (date: string, time: string, guests: number, isPrivate: boolean) => {
    if (!user) return showToast("로그인이 필요합니다.", 'error');
    if (!date) return showToast("날짜를 선택해주세요.", 'error');
    if (!time) return showToast("시간을 선택해주세요.", 'error');

    // 🟢 결제하기 버튼 클릭 기록 (퍼널 2단계: 클릭)
    supabase.from('analytics_events').insert([{
      event_type: 'click',
      target_id: String(experience.id),
      user_id: user.id
    }]).then(({ error }) => {
      if (error) console.error('Click Event Log Error:', error);
    });

    const typeParam = isPrivate ? '&type=private' : '';
    router.push(`/experiences/${params.id}/payment?date=${date}&time=${time}&guests=${guests}${typeParam}`);
  };

  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const photos = experience.photos && experience.photos.length > 0
    ? experience.photos
    : [experience.image_url || "https://images.unsplash.com/photo-1540206395-688085723adb"];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-0">
      <SiteHeader />
      {isCopySuccess && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><Check size={16} className="text-green-400" /> 링크가 복사되었습니다.</div>}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        <section className="mb-6">
          {/* 🟢 변환된 제목 표시 */}
          <h1 className="text-3xl font-black mb-2 tracking-tight">{translatedTitle}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4">
                <span className="font-bold">★ {experience.rating > 0 ? experience.rating.toFixed(2) : 'New'}</span>
                {experience.review_count > 0 && <span className="text-slate-500 underline">후기 {experience.review_count}개</span>}
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={() => scrollToSection('location')} className="flex items-center gap-1 hover:underline underline-offset-4 font-bold text-slate-700"><MapPin size={14} /> {location}</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Share size={16} /> 공유하기</button>
              <button onClick={toggleWishlist} disabled={isSaveLoading} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} />
                {isSaved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
        </section>

        {/* 데스크탑 사진 그리드 */}
        <section className="hidden md:block relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group border border-slate-200 shadow-sm select-none">
          {photos.length === 1 && (
            <div className="w-full h-full relative cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
              <Image src={photos[0]} alt="Background" fill className="object-cover blur-xl opacity-50 scale-110" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative w-full h-full max-w-[800px] shadow-2xl rounded-lg overflow-hidden transition-transform duration-500 group-hover:scale-[1.01]">
                  <Image src={photos[0]} alt="Main" fill className="object-contain" />
                </div>
              </div>
            </div>
          )}
          {photos.length >= 2 && (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
              <div className="col-span-2 row-span-2 relative overflow-hidden">
                <Image src={photos[0]} alt="Main" fill className="object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              {photos.slice(1, 5).map((photo: string, i: number) => (
                <div key={i} className={`relative overflow-hidden ${photos.length === 2 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'}`}>
                  <Image src={photo} alt={`Sub ${i}`} fill className="object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsGalleryOpen(true); }}
            className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform z-10"
          >
            <Grid size={16} /> 사진 모두 보기
          </button>
        </section>

        {/* 모바일 벤토 그리드 사진 (md:hidden) */}
        <section className="md:hidden relative w-full aspect-square mb-8 overflow-hidden rounded-[24px] cursor-pointer shadow-sm border border-slate-100" onClick={() => setIsGalleryOpen(true)}>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1.5 bg-slate-100">
            <div className="relative overflow-hidden w-full h-full">
              <Image src={photos[0]} alt="Main" fill className="object-cover" />
            </div>
            <div className="relative overflow-hidden w-full h-full">
              <Image src={photos[1] || photos[0]} alt="Sub 1" fill className="object-cover" />
            </div>
            <div className="relative overflow-hidden w-full h-full">
              <Image src={photos[2] || photos[0]} alt="Sub 2" fill className="object-cover" />
            </div>
            <div className="relative overflow-hidden w-full h-full">
              <Image src={photos[3] || photos[0]} alt="Sub 3" fill className="object-cover" />
              <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm p-2 rounded-full shadow border border-slate-100 z-10 text-slate-800">
                <Copy size={16} className="rotate-90" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          <ExpMainContent
            experience={experience}
            hostProfile={hostProfile}
            handleInquiry={handleInquiry}
            inquiryText={inquiryText}
            setInquiryText={setInquiryText}
          />
          <ExpSidebar
            experience={experience}
            availableDates={availableDates}
            dateToTimeMap={dateToTimeMap}
            remainingSeatsMap={remainingSeatsMap}
            handleReserve={handleReserve}
          />
        </div>
      </main>

      <StickyActionSheet experience={experience} />

      {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-200 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button onClick={() => setIsGalleryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            <h3 className="font-bold text-lg">사진 모두 보기</h3>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-4">
              {photos.map((photo: string, index: number) => (
                <div key={index} className="relative w-full aspect-[3/2] md:aspect-[16/10] bg-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <Image src={photo} alt={`Gallery ${index}`} fill className="object-contain bg-black/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}