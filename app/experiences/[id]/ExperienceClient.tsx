'use client';

import React, { useState } from 'react';
import { Share, Heart, MapPin, Check, X, Grid, Copy, ArrowLeft, Star, Globe } from 'lucide-react';
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
import { ExperienceDetail, HostProfileDetail } from './types';

type AuthUser = {
  id?: string;
} | null;

type Props = {
  initialUser: AuthUser;
  initialExperience: ExperienceDetail;
  initialHostProfile: HostProfileDetail;
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
  const category = getContent(experience, 'category', lang) || experience.category || '문화 체험';
  const meetingPoint = experience.meeting_point || experience.location || 'Locally';
  const compactLocation = experience.city?.trim() || meetingPoint?.split(',')?.[0]?.trim() || 'Locally';
  const headerLabel = `${compactLocation} · ${category}`;
  const addressLine = experience.location || experience.city || compactLocation;
  const hostJob = hostProfile?.job?.trim() || '로컬리 호스트';
  const formatLanguageLevel = (level?: number | null) => {
    switch (level) {
      case 1:
        return 'Lv.1 기초 단계';
      case 2:
        return 'Lv.2 초급 회화';
      case 3:
        return 'Lv.3 일상 회화';
      case 4:
        return 'Lv.4 비즈니스 회화';
      case 5:
        return 'Lv.5 원어민 수준';
      default:
        return '';
    }
  };
  const hostLanguages = Array.isArray(hostProfile?.languages)
    ? Array.from(new Set(hostProfile.languages.map((language) => String(language).trim()).filter(Boolean)))
    : [];
  const hostLanguageLevel = formatLanguageLevel(hostProfile?.language_level);
  const hostLanguageSummary = [
    hostLanguages.length > 0 ? hostLanguages.join(', ') : '',
    hostLanguageLevel
  ].filter(Boolean).join(' · ');
  const desktopHostMeta = [hostJob, hostLanguageSummary].filter(Boolean).join('  |  ');
  const ratingValue = Number(experience.rating || 0);
  const ratingText = ratingValue > 0 ? ratingValue.toFixed(2) : 'New';
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
      await createInquiry(experience.host_id, String(experience.id), inquiryText);
      showToast('메시지가 발송되었습니다.', 'success');
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
    router.push(`/experiences/${experienceId}/payment?date=${date}&time=${time}&guests=${guests}${typeParam}`);
  };

  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const heroPhotos = Array.isArray(experience.photos) && experience.photos.length > 0
    ? experience.photos
    : [experience.image_url || "https://images.unsplash.com/photo-1540206395-688085723adb"];
  const itineraryPhotos = Array.isArray(experience.itinerary)
    ? experience.itinerary
      .map((item) => String(item?.image_url || '').trim())
      .filter(Boolean)
    : [];
  const photos = Array.from(new Set([...heroPhotos, ...itineraryPhotos]));

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

        <section className="hidden md:block mb-12">
          <div className="max-w-3xl">
            <div className="flex items-start justify-between gap-6">
              <h1 className="text-[40px] leading-[1.15] font-black tracking-tight text-slate-900">{translatedTitle}</h1>
              <div className="flex shrink-0 gap-2 pt-1">
                <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                  <Share size={16} /> 공유하기
                </button>
                <button onClick={toggleWishlist} disabled={isSaveLoading} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                  <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} />
                  {isSaved ? '저장됨' : '저장'}
                </button>
              </div>
            </div>
            <p className="mt-4 text-[16px] leading-[1.65] text-slate-500 whitespace-pre-wrap line-clamp-3">{translatedDescription}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4">
                <span className="font-bold">★ {ratingText}</span>
                {reviewCount > 0 && <span className="text-slate-500 underline">후기 {reviewCount}개</span>}
              </button>
            </div>
            <p className="mt-3 text-[15px] text-slate-500">{headerLabel}</p>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center">
                {hostProfile?.avatar_url ? (
                  <div className="relative w-full h-full">
                    <Image src={hostProfile.avatar_url} fill className="object-cover" alt="Host avatar" />
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm font-bold">{(hostProfile?.name || 'H').slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[18px] font-semibold truncate">호스트: {hostProfile?.name || 'Locally Host'} 님</p>
                {desktopHostMeta && (
                  <p className="mt-1 text-[14px] text-slate-500 truncate">{desktopHostMeta}</p>
                )}
              </div>
            </div>

            <button onClick={() => scrollToSection('location')} className="mt-5 flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-[14px] bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-[0_1px_5px_rgba(0,0,0,0.08)]">
                <MapPin size={16} className="text-slate-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[18px] font-semibold truncate">{meetingPoint}</p>
                <p className="text-[15px] text-slate-500 truncate">{addressLine}</p>
              </div>
            </button>
          </div>
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
                  <div className="relative w-full h-full">
                    <Image src={hostProfile.avatar_url} fill className="object-cover" alt="Host avatar" />
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs font-bold">{(hostProfile?.name || 'H').slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">호스트: {hostProfile?.name || 'Locally Host'} 님</p>
                <p className="text-[12px] text-slate-500 truncate">{hostJob}</p>
                {hostLanguageSummary && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                    <Globe size={10} className="shrink-0" />
                    <span className="truncate">{hostLanguageSummary}</span>
                  </p>
                )}
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
                <p className="text-[13px] font-medium truncate">{meetingPoint}</p>
                <p className="text-[12px] text-slate-500 truncate">{addressLine}</p>
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
          <div className="md:-mt-[220px] md:self-start">
            <ExpSidebar
              experience={experience}
              availableDates={availableDates}
              dateToTimeMap={dateToTimeMap}
              remainingSeatsMap={remainingSeatsMap}
              handleReserve={handleReserve}
            />
          </div>
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
