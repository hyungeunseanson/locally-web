'use client';

import React from 'react';
import { Users, PersonStanding, CalendarX, Copy, ExternalLink, Backpack, Lightbulb, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import ReviewSection from './ReviewSection';
import HostProfileSection from './HostProfileSection';
import { useToast } from '@/app/context/ToastContext';
import { ExperienceDetail, ExperienceItineraryItem, HostProfileDetail } from '../types';
import { formatLanguageLevelSummary, normalizeLanguageLevels } from '@/app/utils/languageLevels';

type MainContentProps = {
  experience: ExperienceDetail;
  hostProfile: HostProfileDetail;
  handleInquiry: () => Promise<boolean>;
  inquiryText: string;
  setInquiryText: React.Dispatch<React.SetStateAction<string>>;
  translatedDescription?: string;
  translatedCategory?: string;
};

export default function ExpMainContent({
  experience, hostProfile, handleInquiry, inquiryText, setInquiryText, translatedDescription, translatedCategory
}: MainContentProps) {
  const fixedRefundPolicy = '표준 정책 (7일 전 무료 취소)';
  const { showToast } = useToast();
  const [isMessageModalOpen, setIsMessageModalOpen] = React.useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = React.useState(false);
  const meetingPoint = (experience.meeting_point || '').trim();
  const addressLine = (experience.location || '').trim();
  const mapQuery = addressLine || meetingPoint || String(experience.city || 'Seoul');
  const copyTarget = addressLine || meetingPoint || mapQuery;
  const itinerary: ExperienceItineraryItem[] = Array.isArray(experience.itinerary) ? experience.itinerary : [];
  const heroPhotos = Array.isArray(experience.photos) && experience.photos.length > 0
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
  const rawLanguages = Array.isArray(experience.languages) && experience.languages.length > 0
    ? experience.languages
    : Array.isArray(hostProfile?.languages)
      ? hostProfile.languages
      : [];
  const experienceLanguageLevels = normalizeLanguageLevels(experience.language_levels, experience.languages, 3);
  const normalizedLanguages = rawLanguages.length > 0
    ? rawLanguages
      .map((language) => mapLanguageLabel(String(language)))
      .filter(Boolean)
    : [];
  const languageText = experienceLanguageLevels.length > 0
    ? `${formatLanguageLevelSummary(experienceLanguageLevels)}로 진행되는 체험입니다.`
    : normalizedLanguages.length > 0
    ? `${Array.from(new Set(normalizedLanguages)).join(' 및 ')}로 진행되는 체험입니다.`
    : '영어 및 한국어로 진행되는 체험입니다.';

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(copyTarget);
    showToast('주소가 복사되었습니다.', 'success');
  };

  const openHostMessage = () => {
    setIsMessageModalOpen(true);
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
      {/* 체험 내용 */}
      <div className="border-b border-slate-200 pb-8 md:pb-10">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-5">체험 내용</h3>
        <div className="space-y-4">
          {itinerary.length > 0 ? itinerary.map((item, idx: number) => {
            const imageSrc = item?.image_url || heroPhotos[idx % heroPhotos.length];
            return (
              <div key={`${item?.title || 'step'}-${idx}`} className="flex items-center gap-3 md:gap-5">
                <div className="w-[72px] h-[72px] md:w-[100px] md:h-[100px] rounded-[14px] md:rounded-[20px] overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                  <div className="relative w-full h-full">
                    <Image src={imageSrc} fill className="object-cover" alt={item?.title || `itinerary-${idx + 1}`} />
                  </div>
                </div>
                <div className="min-h-[72px] md:min-h-[100px] flex-1 flex flex-col justify-center overflow-hidden">
                  <h4 className="text-[12px] md:text-[15px] font-medium leading-[1.3] mb-1">{item?.title || `코스 ${idx + 1}`}</h4>
                  <p className="text-[11px] md:text-[13px] leading-[1.45] text-slate-500 whitespace-pre-wrap line-clamp-4">{item?.description || ''}</p>
                </div>
              </div>
            );
          }) : (
            <p className="text-[12px] md:text-[15px] text-slate-600 leading-relaxed whitespace-pre-wrap">
              {translatedDescription || experience.description}
            </p>
          )}
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-amber-900">
          <Lightbulb size={16} className="mt-0.5 shrink-0" />
          <p className="text-[12px] md:text-[15px] leading-[1.45]">{languageText}</p>
        </div>
      </div>

      {/* 후기 */}
      <ReviewSection experienceId={String(experience.id)} hostName={hostProfile?.name || 'Locally'} />

      {/* 만나는 장소 */}
      <div id="location" className="border-b border-slate-200 pb-8 md:pb-10 scroll-mt-24">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-3">만나는 장소</h3>
        {meetingPoint ? (
          <p className="text-[12px] md:text-[15px] text-slate-700 font-medium mb-1">{meetingPoint}</p>
        ) : null}
        {addressLine ? (
          <p className="text-[11px] md:text-[14px] text-slate-500 mb-4">{addressLine}</p>
        ) : null}

        <div className="w-full h-[384px] md:h-[400px] bg-slate-100 rounded-[20px] md:rounded-[24px] relative overflow-hidden border border-slate-200 shadow-sm">
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            className="grayscale-[5%]"
          ></iframe>

          <Link
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
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
        reviewCount={hostProfile?.review_count}
        rating={hostProfile?.rating}
        job={hostProfile?.job || "로컬리 호스트"}
        dreamDestination={hostProfile?.dream_destination || "여행"}
        favoriteSong={hostProfile?.favorite_song || "음악"}
        languages={hostProfile?.languages || []}
        intro={hostProfile?.introduction || hostProfile?.bio || "안녕하세요! 로컬리 호스트입니다."}
        joinedYear={hostProfile?.joined_year}
        category={translatedCategory || experience.category || '문화 체험'}
        onMessageHost={openHostMessage}
      />

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
                신체 활동 강도: {experience.rules?.activity_level || '보통'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle2 size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">포함 사항</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                {Array.isArray(experience.inclusions) && experience.inclusions.length > 0
                  ? experience.inclusions.join(', ')
                  : '현장 안내를 참고해주세요.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <X size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">불포함 사항</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                {Array.isArray(experience.exclusions) && experience.exclusions.length > 0
                  ? experience.exclusions.join(', ')
                  : '별도 구매가 필요한 항목은 현장에서 안내됩니다.'}
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
            </div>
          </div>

          <div className="flex gap-3">
            <CalendarX size={22} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] md:text-[16px] font-semibold mb-1">환불 정책</h4>
              <p className="text-[12px] md:text-[14px] text-slate-600 leading-relaxed">
                {fixedRefundPolicy}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isMessageModalOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-end bg-black/35 px-[7px] pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+7px)] pt-4 backdrop-blur-[1px] md:items-center md:justify-center md:p-4"
          onClick={() => setIsMessageModalOpen(false)}
        >
          <div
            className="flex max-h-[68dvh] w-full max-w-[430px] flex-col overflow-y-auto rounded-[24px] bg-[#fcfcfc] px-4 pt-4 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+14px)] shadow-[0_18px_48px_rgba(15,23,42,0.22)] md:max-h-[78dvh] md:max-w-[560px] md:rounded-[28px] md:px-7 md:pt-6 md:pb-6 md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex justify-end">
              <button onClick={() => setIsMessageModalOpen(false)} className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-100">
                <span className="sr-only">닫기</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <h3 className="mb-1.5 text-[18px] font-medium leading-tight tracking-[-0.01em] md:text-[24px]">{hostProfile?.name || '호스트'}님에게 질문하기</h3>
            <p className="mb-4 text-[11px] leading-snug text-slate-500 md:mb-5 md:text-[13px] md:leading-relaxed">
              이 체험에 대해 자세히 알아보려면 호스트에게
              <span className="underline underline-offset-2 ml-1">메시지를 보내세요.</span>
            </p>
            <textarea
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              placeholder="호스트에게 본인을 소개해 보세요."
              className="h-[108px] w-full resize-none rounded-[18px] border border-slate-300 bg-white px-3.5 py-3 text-[12px] font-normal text-slate-700 placeholder:text-slate-300 focus:border-slate-500 focus:outline-none md:h-[170px] md:rounded-2xl md:px-5 md:py-4 md:text-[14px]"
            />
            <div className="mt-4 md:mt-5">
              <button
                onClick={handleSubmitMessage}
                disabled={!inquiryText.trim() || isSubmittingMessage}
                className={`w-full rounded-[18px] py-3 text-[13px] font-medium md:rounded-2xl md:py-3.5 md:text-[15px] ${
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
