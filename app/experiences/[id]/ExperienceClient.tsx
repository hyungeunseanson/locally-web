'use client';

import React, { useState } from 'react';
import { Share, Heart, MapPin, Check, X, Grid, Copy, ArrowLeft, Star } from 'lucide-react';
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

type AuthUser = {
  id?: string;
} | null;

type ExperienceData = {
  id: string | number;
  host_id?: string;
  title?: string;
  description?: string;
  category?: string;
  meeting_point?: string;
  location?: string;
  rating?: number;
  review_count?: number;
  price?: number;
  photos?: string[];
  image_url?: string;
  max_guests?: number;
  duration?: number;
  [key: string]: unknown;
};

type HostProfileData = {
  id?: string;
  name?: string;
  avatar_url?: string;
  languages?: string[];
  introduction?: string;
  job?: string;
  dream_destination?: string;
  favorite_song?: string;
  joined_year?: number | null;
  bio?: string;
  [key: string]: unknown;
} | null;

type Props = {
  initialUser: AuthUser;
  initialExperience: ExperienceData;
  initialHostProfile: HostProfileData;
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
  const translatedDescription = getContent(experience, 'description', lang);
  // 🟢 [핵심] 위치 정보는 아직 번역이 없으므로 한국어 사용 (나중에 location_en 추가 가능)
  const location = experience.meeting_point || experience.location;
  const category = getContent(experience, 'category', lang) || experience.category || '문화 체험';
  const compactLocation = location?.split(',')?.[0]?.trim() || 'Locally';
  const headerLabel = `${compactLocation} · ${category}`;
  const ratingText = experience.rating > 0 ? experience.rating.toFixed(2) : 'New';
  const reviewCount = Number(experience.review_count || 0);

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

  const handleInquiry = async (): Promise<boolean> => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return false;
    }
    if (!inquiryText.trim()) {
      showToast('내용을 입력해주세요.', 'error');
      return false;
    }

    try {
      if (!experience?.host_id) {
        showToast('호스트 정보를 불러올 수 없습니다.', 'error');
        return false;
      }
      await createInquiry(experience.host_id, experience.id, inquiryText);
      if (confirm('문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?')) {
        router.push('/guest/inbox');
      }
      setInquiryText('');
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      showToast('문의 전송 실패: ' + message, 'error');
      return false;
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

      {/* 📱 모바일 전용 상단 헤더 */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-sm h-[52px] flex items-center justify-between px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={18} className="text-slate-900" />
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 truncate max-w-[58%]">{headerLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Share size={16} className="text-slate-900" />
          </button>
          <button onClick={toggleWishlist} disabled={isSaveLoading} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} />
          </button>
        </div>
      </div>

      <main className="max-w-[1120px] mx-auto px-4 md:px-6 pt-[58px] md:pt-8 pb-8 md:py-8">
        <section className="hidden md:block mb-6">
          <p className="text-sm font-semibold text-slate-500 mb-2">{headerLabel}</p>
          <h1 className="text-3xl font-black mb-2 tracking-tight">{translatedTitle}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4">
                <span className="font-bold">★ {ratingText}</span>
                {reviewCount > 0 && <span className="text-slate-500 underline">후기 {reviewCount}개</span>}
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

        {/* 모바일 상단 소개 블록 */}
        <section className="md:hidden">
          <div
            className="relative w-full aspect-square mb-6 overflow-hidden rounded-[24px] cursor-pointer border border-slate-200"
            onClick={() => setIsGalleryOpen(true)}
          >
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[5px] bg-white">
              <div className="relative overflow-hidden w-full h-full rounded-tl-[24px]">
                <Image src={photos[0]} alt="Main" fill className="object-cover" />
              </div>
              <div className="relative overflow-hidden w-full h-full rounded-tr-[24px]">
                <Image src={photos[1] || photos[0]} alt="Sub 1" fill className="object-cover" />
              </div>
              <div className="relative overflow-hidden w-full h-full rounded-bl-[24px]">
                <Image src={photos[2] || photos[0]} alt="Sub 2" fill className="object-cover" />
              </div>
              <div className="relative overflow-hidden w-full h-full rounded-br-[24px]">
                <Image src={photos[3] || photos[0]} alt="Sub 3" fill className="object-cover" />
              </div>
            </div>
            <div className="absolute bottom-4 right-4 bg-white p-2.5 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.15)] border border-slate-200 z-10 text-slate-800">
              <Copy size={16} className="rotate-90" />
            </div>
          </div>

          <div className="text-center px-2">
            <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.01em] mb-3">{translatedTitle}</h1>
            <p className="text-[13px] leading-[1.42] text-slate-500 font-normal mb-4 whitespace-pre-wrap line-clamp-3">{translatedDescription}</p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium mb-4">
              <Star size={11} fill="black" className="mb-[1px]" />
              <span>{ratingText}</span>
              <span className="text-slate-300">·</span>
              <button onClick={() => scrollToSection('reviews')} className="underline underline-offset-2">
                후기 {reviewCount}개
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center">
                {hostProfile?.avatar_url ? (
                  <img src={hostProfile.avatar_url} className="w-full h-full object-cover" alt="Host" />
                ) : (
                  <span className="text-slate-400 text-xs font-bold">{(hostProfile?.name || 'H').slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">호스트: {hostProfile?.name || 'Locally Host'} 님</p>
                <p className="text-[12px] text-slate-500 truncate">{hostProfile?.job || category}</p>
              </div>
            </div>

            <button
              onClick={() => scrollToSection('location')}
              className="mt-4 w-full text-left flex items-center gap-2.5 py-1.5"
            >
              <div className="w-10 h-10 rounded-[12px] bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-[0_1px_5px_rgba(0,0,0,0.08)]">
                <MapPin size={14} className="text-slate-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{location}</p>
                <p className="text-[12px] text-slate-500 truncate">{experience.location || compactLocation}</p>
              </div>
            </button>

            <div className="mt-5 border-b border-slate-200" />
          </div>
        </section>

        <div className="flex flex-col md:flex-row gap-10 md:gap-16 relative">
          <ExpMainContent
            experience={experience}
            hostProfile={hostProfile}
            handleInquiry={handleInquiry}
            inquiryText={inquiryText}
            setInquiryText={setInquiryText}
            translatedDescription={translatedDescription}
            translatedCategory={category}
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
        <div className="fixed inset-0 z-[150] bg-white animate-in fade-in duration-200 flex flex-col">
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
