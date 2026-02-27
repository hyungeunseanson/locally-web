'use client';

import React from 'react';
import { MapPin, MessageSquare, Users, PersonStanding, CalendarX, Copy, ExternalLink, Backpack, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import ReviewSection from './ReviewSection';
import HostProfileSection from './HostProfileSection';
import { useToast } from '@/app/context/ToastContext';

type ItineraryItem = {
  title?: string;
  description?: string;
  image_url?: string;
};

type MainContentProps = {
  experience: {
    id: number | string;
    host_id?: string;
    photos?: string[];
    image_url?: string;
    meeting_point?: string;
    location?: string;
    max_guests?: number;
    duration?: number;
    supplies?: string;
    inclusions?: string[];
    rules?: {
      age_limit?: string;
      activity_level?: string;
      preparation_level?: string;
      refund_policy?: string;
    };
    itinerary?: ItineraryItem[];
    category?: string;
    description?: string;
  };
  hostProfile: {
    name?: string;
    avatar_url?: string;
    languages?: string[];
    job?: string;
    dream_destination?: string;
    favorite_song?: string;
    joined_year?: number | null;
    introduction?: string;
    bio?: string;
  } | null;
  handleInquiry: () => Promise<boolean>;
  inquiryText: string;
  setInquiryText: React.Dispatch<React.SetStateAction<string>>;
  translatedDescription?: string;
  translatedCategory?: string;
};

export default function ExpMainContent({
  experience, hostProfile, handleInquiry, inquiryText, setInquiryText, translatedDescription, translatedCategory
}: MainContentProps) {
  const { showToast } = useToast();
  const [isMessageModalOpen, setIsMessageModalOpen] = React.useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = React.useState(false);
  const location = experience.meeting_point || experience.location || 'Seoul';
  const itinerary: ItineraryItem[] = Array.isArray(experience.itinerary) ? experience.itinerary : [];
  const photos = Array.isArray(experience.photos) && experience.photos.length > 0
    ? experience.photos
    : [experience.image_url || "https://images.unsplash.com/photo-1540206395-688085723adb"];
  const mapLanguageLabel = (language: string) => {
    const normalized = language.toLowerCase();
    if (normalized.includes('english') || normalized.includes('영어')) return '영어';
    if (normalized.includes('korean') || normalized.includes('한국어')) return '한국어';
    if (normalized.includes('japanese') || normalized.includes('일본어')) return '일본어';
    if (normalized.includes('chinese') || normalized.includes('중국어')) return '중국어';
    return language;
  };
  const normalizedLanguages = Array.isArray(hostProfile?.languages)
    ? hostProfile.languages
      .map((language) => mapLanguageLabel(String(language)))
      .filter(Boolean)
    : [];
  const languageText = normalizedLanguages.length > 0
    ? `${Array.from(new Set(normalizedLanguages)).join(' 및 ')}로 진행되는 체험입니다.`
    : '영어 및 한국어로 진행되는 체험입니다.';

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(location);
    showToast('주소가 복사되었습니다.', 'success');
  };

  const openHostMessage = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMessageModalOpen(true);
      return;
    }
    document.getElementById('inquiry')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmitMessage = async () => {
    if (!inquiryText.trim()) return;
    setIsSubmittingMessage(true);
    const success = await handleInquiry();
    setIsSubmittingMessage(false);
    if (success) setIsMessageModalOpen(false);
  };

  return (
    <div className="flex-1 space-y-8 md:space-y-14">

      {/* 데스크탑 호스트 요약 */}
      <div className="hidden md:flex border-b border-slate-200 pb-8 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">호스트: {hostProfile?.name || 'Locally Host'}님</h2>
          <p className="text-slate-500 text-base">최대 {experience.max_guests}명 · {experience.duration || 2}시간 · {hostProfile?.languages?.join('/') || '한국어/영어'}</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center relative">
          {hostProfile?.avatar_url ? (
            <img src={hostProfile.avatar_url} className="w-full h-full object-cover" alt="Host" />
          ) : (
            <span className="text-slate-400 text-base font-bold">{(hostProfile?.name || 'H').slice(0, 1)}</span>
          )}
        </div>
      </div>

      {/* 체험 내용 */}
      <div className="border-b border-slate-200 pb-8 md:pb-10">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-5">체험 내용</h3>
        <div className="space-y-4">
          {itinerary.length > 0 ? itinerary.map((item, idx: number) => {
            const imageSrc = item?.image_url || photos[idx % photos.length];
            return (
              <div key={`${item?.title || 'step'}-${idx}`} className="flex items-start gap-3 md:gap-5">
                <div className="w-[72px] h-[72px] md:w-[100px] md:h-[100px] rounded-[14px] md:rounded-[20px] overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                  <img src={imageSrc} className="w-full h-full object-cover" alt={item?.title || `itinerary-${idx + 1}`} />
                </div>
                <div className="pt-0.5">
                  <h4 className="text-[13px] md:text-[17px] font-medium leading-[1.3] mb-1">{item?.title || `코스 ${idx + 1}`}</h4>
                  <p className="text-[12px] md:text-[14px] leading-[1.35] text-slate-500 whitespace-pre-wrap">{item?.description || ''}</p>
                </div>
              </div>
            );
          }) : (
            <p className="text-[12px] md:text-[15px] text-slate-600 leading-relaxed whitespace-pre-wrap">
              {translatedDescription || experience.description}
            </p>
          )}
        </div>
        <p className="text-[12px] md:text-[15px] leading-[1.45] text-slate-700 mt-5">{languageText}</p>
      </div>

      {/* 후기 */}
      <ReviewSection experienceId={experience.id} hostName={hostProfile?.name || 'Locally'} />

      {/* 만나는 장소 */}
      <div id="location" className="border-b border-slate-200 pb-8 md:pb-10 scroll-mt-24">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-3">만나는 장소</h3>
        <p className="text-[12px] md:text-[15px] text-slate-700 font-medium mb-1">{location}</p>
        <p className="text-[11px] md:text-[14px] text-slate-500 mb-4">{experience.location || location}</p>

        <div className="w-full h-[384px] md:h-[400px] bg-slate-100 rounded-[20px] md:rounded-[24px] relative overflow-hidden border border-slate-200 shadow-sm">
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?q=${encodeURIComponent(location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            className="grayscale-[5%]"
          ></iframe>

          <Link
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
            rel="noreferrer"
            className="absolute top-4 right-4 bg-white/95 p-2 rounded-full shadow-md border border-slate-200 text-slate-700 hover:scale-105 transition-transform"
          >
            <ExternalLink size={14} />
          </Link>

          <button
            onClick={handleCopyAddress}
            className="absolute bottom-4 left-4 bg-slate-900/90 text-white px-4 py-2 rounded-full text-[13px] font-bold items-center gap-1.5 hidden md:flex"
          >
            <Copy size={13} /> 주소 복사
          </button>
        </div>
      </div>

      {/* 자기소개 */}
      <HostProfileSection
        hostId={experience.host_id}
        name={hostProfile?.name || 'Locally Host'}
        avatarUrl={hostProfile?.avatar_url}
        job={hostProfile?.job || "로컬리 호스트"}
        dreamDestination={hostProfile?.dream_destination || "여행"}
        favoriteSong={hostProfile?.favorite_song || "음악"}
        languages={hostProfile?.languages || []}
        intro={hostProfile?.introduction || hostProfile?.bio || "안녕하세요! 로컬리 호스트입니다."}
        joinedYear={hostProfile?.joined_year}
        category={translatedCategory || experience.category || '문화 체험'}
        onMessageHost={openHostMessage}
      />

      {/* 문의 */}
      <div id="inquiry" className="hidden md:block pb-2 scroll-mt-24">
        <h3 className="text-[18px] md:text-[20px] font-bold mb-4">호스트에게 문의하기</h3>
        <div className="flex gap-2">
          <input
            value={inquiryText}
            onChange={e => setInquiryText(e.target.value)}
            placeholder="호스트에게 메시지 보내기..."
            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black transition-colors text-[13px] md:text-[14px]"
          />
          <button onClick={handleInquiry} className="bg-black text-white px-6 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center"><MessageSquare size={18} /></button>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">안전한 결제를 위해 항상 로컬리를 통해 결제하고 호스트와 소통하세요.</p>
      </div>

      {/* 알아두어야 할 사항 */}
      <div className="pt-8 pb-12 border-t border-slate-200">
        <h3 className="text-[20px] md:text-[30px] font-semibold tracking-[-0.01em] mb-5">알아두어야 할 사항</h3>
        <div className="space-y-5">
          <div className="flex gap-3">
            <Users size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">게스트 필수조건</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed">
                {experience.rules?.age_limit || '14세 이상'} 게스트만 참가할 수 있습니다. 최대 인원은 {experience.max_guests || 10}명입니다.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <PersonStanding size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">활동 강도</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed">
                신체 활동 강도: {experience.rules?.activity_level || '보통'}, 사전 준비도: {experience.rules?.preparation_level || '초보자'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Backpack size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">준비물</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                {experience.supplies || '편한 복장과 개인 물품을 준비해주세요.'}
              </p>
              {experience.inclusions?.length > 0 && (
                <p className="text-[12px] md:text-[13px] text-slate-500 mt-2">포함 사항: {experience.inclusions.join(', ')}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => document.getElementById('inquiry')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="w-full flex items-center justify-between text-left gap-3"
          >
            <div className="flex gap-3 items-start">
              <MapPin size={22} className="text-slate-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">접근성</h4>
                <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed">주로 평평한 부지이며 도움 필요 시 호스트에게 문의해주세요.</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </button>

          <div className="flex gap-3">
            <CalendarX size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">환불 정책</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed">
                {experience.rules?.refund_policy || '시작 시간을 기준으로 3일 전까지 취소하면 예약금이 전액 환불됩니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isMessageModalOpen && (
        <div className="md:hidden fixed inset-0 z-[210] bg-black/35 backdrop-blur-[1px] flex items-end" onClick={() => setIsMessageModalOpen(false)}>
          <div
            className="w-full h-[88dvh] bg-[#fcfcfc] rounded-t-[28px] px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+16px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button onClick={() => setIsMessageModalOpen(false)} className="p-1.5 text-slate-600">
                <span className="sr-only">닫기</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <h3 className="text-[19px] font-medium leading-tight tracking-[-0.01em] mb-1.5">{hostProfile?.name || '호스트'}님에게 질문하기</h3>
            <p className="text-[11px] text-slate-500 leading-snug mb-4">
              이 체험에 대해 자세히 알아보려면 호스트에게
              <span className="underline underline-offset-2 ml-1">메시지를 보내세요.</span>
            </p>
            <textarea
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              placeholder="호스트에게 본인을 소개해 보세요."
              className="w-full h-[122px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[12px] font-normal text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-slate-500"
            />
            <div className="mt-auto">
              <button
                onClick={handleSubmitMessage}
                disabled={!inquiryText.trim() || isSubmittingMessage}
                className={`w-full rounded-2xl py-3 text-[13px] font-medium ${
                  !inquiryText.trim() || isSubmittingMessage
                    ? 'bg-slate-300 text-slate-50'
                    : 'bg-[#111827] text-white'
                }`}
              >
                {isSubmittingMessage ? '전송 중...' : '메시지 보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
