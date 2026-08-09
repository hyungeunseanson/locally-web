/* eslint-disable @next/next/no-img-element */
'use client';

// Media kit slides are rendered from plain public assets so the carousel can swap file extensions without Next image transforms.

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { DesktopRightRailAdLayout } from '@/app/components/DesktopRightRailAdSlot';
import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';

const MEDIA_KIT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const MEDIA_KIT_SLOTS = [1, 2, 3, 4, 5, 6, 7] as const;

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const COPY: Record<Locale, {
  eyebrow: string;
  title: string;
  description: string;
  mediaKitTitle: string;
  mediaKitDesc: string;
  mediaKitNote: string;
  mediaKitOpenLabel: string;
  mediaKitModalTitle: string;
  mediaKitModalHint: string;
  mediaKitCloseLabel: string;
  mediaKitPrevLabel: string;
  mediaKitNextLabel: string;
  mediaKitFallback: string;
  formTitle: string;
  formDesc: string;
  companyLabel: string;
  companyPlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  proposalLabel: string;
  proposalPlaceholder: string;
  submitLabel: string;
  submitSuccess: string;
  submitFail: string;
  submitValidation: string;
  submitSending: string;
}> = {
  ko: {
    eyebrow: 'Instagram channel',
    title: 'Instagram 광고 · 제휴 문의',
    description: '로컬리 인스타그램 채널 광고, 브랜드 협업, 공동 캠페인 문의를 한곳에서 확인하고 바로 문의할 수 있습니다.',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '미디어 킷과 단가표는 모달로 넘겨보면서 확인할 수 있어요.',
    mediaKitNote: '광고 문의는 아래 폼으로 남겨주시면 확인 후 연락드릴게요.',
    mediaKitOpenLabel: '미디어 킷 보기',
    mediaKitModalTitle: 'Locally Instagram media kit',
    mediaKitModalHint: '좌우로 넘기며 채널 소개와 단가표를 확인해보세요.',
    mediaKitCloseLabel: '닫기',
    mediaKitPrevLabel: '이전',
    mediaKitNextLabel: '다음',
    mediaKitFallback: '이미지 업로드 전입니다',
    formTitle: '문의 남기기',
    formDesc: '희망 채널, 예산, 진행 시기, 원하는 협업 형태를 함께 남겨주시면 더 빠르게 검토할 수 있습니다.',
    companyLabel: '브랜드 / 회사명',
    companyPlaceholder: '회사명 또는 브랜드명을 입력하세요',
    emailLabel: '연락 이메일',
    emailPlaceholder: 'email@company.com',
    proposalLabel: '문의 내용',
    proposalPlaceholder: '광고 집행 목적, 예산 범위, 희망 일정, 요청 사항을 적어주세요.',
    submitLabel: '문의 보내기',
    submitSuccess: '문의가 접수되었습니다. 확인 후 연락드릴게요.',
    submitFail: '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
    submitValidation: '브랜드명, 이메일, 문의 내용을 모두 올바르게 입력해주세요.',
    submitSending: '전송 중...',
  },
  en: {
    eyebrow: 'Instagram channel',
    title: 'Instagram media kit & partnerships',
    description: 'Review Locally’s Instagram media kit, advertising options, and partnership details before reaching out.',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: 'Check the media kit and rate card below, then send us your inquiry.',
    mediaKitNote: 'Review the media kit and pricing slides in order before sending your inquiry.',
    mediaKitOpenLabel: 'View media kit',
    mediaKitModalTitle: 'Locally Instagram media kit',
    mediaKitModalHint: 'Use the arrows to review the channel overview and pricing slides.',
    mediaKitCloseLabel: 'Close',
    mediaKitPrevLabel: 'Previous',
    mediaKitNextLabel: 'Next',
    mediaKitFallback: 'Waiting for upload',
    formTitle: 'Send an inquiry',
    formDesc: 'Share your target channel, budget, timing, and preferred collaboration format for a faster review.',
    companyLabel: 'Brand / Company name',
    companyPlaceholder: 'Enter your company or brand name',
    emailLabel: 'Contact email',
    emailPlaceholder: 'email@company.com',
    proposalLabel: 'Inquiry details',
    proposalPlaceholder: 'Tell us about your campaign goals, budget, schedule, and request.',
    submitLabel: 'Send inquiry',
    submitSuccess: 'Your inquiry has been received. We will get back to you soon.',
    submitFail: 'Failed to send your inquiry. Please try again shortly.',
    submitValidation: 'Please enter a valid company name, email, and inquiry message.',
    submitSending: 'Sending...',
  },
  ja: {
    eyebrow: 'Instagram channel',
    title: 'Instagram広告・提携のお問い合わせ',
    description: 'LocallyのInstagram広告、ブランド提携、共同キャンペーンに関する内容を確認して、そのままお問い合わせできます。',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '下のメディアキットと料金表を確認してからお問い合わせください。',
    mediaKitNote: 'メディアキットと料金表を順番に確認してからお問い合わせください。',
    mediaKitOpenLabel: 'メディアキットを見る',
    mediaKitModalTitle: 'Locally Instagram media kit',
    mediaKitModalHint: '左右に切り替えながらチャンネル紹介と料金表を確認できます。',
    mediaKitCloseLabel: '閉じる',
    mediaKitPrevLabel: '前へ',
    mediaKitNextLabel: '次へ',
    mediaKitFallback: '画像アップロード待ちです',
    formTitle: 'お問い合わせ',
    formDesc: '希望チャネル、予算、実施時期、コラボ形式を一緒に送っていただくと確認がスムーズです。',
    companyLabel: '会社名 / ブランド名',
    companyPlaceholder: '会社名またはブランド名を入力してください',
    emailLabel: '連絡用メール',
    emailPlaceholder: 'email@company.com',
    proposalLabel: 'お問い合わせ内容',
    proposalPlaceholder: '広告の目的、予算、希望日程、要望内容をご記入ください。',
    submitLabel: '送信する',
    submitSuccess: 'お問い合わせを受け付けました。確認後ご連絡します。',
    submitFail: 'お問い合わせの送信に失敗しました。しばらくしてからお試しください。',
    submitValidation: '会社名、メールアドレス、お問い合わせ内容を正しく入力してください。',
    submitSending: '送信中...',
  },
  zh: {
    eyebrow: 'Instagram channel',
    title: 'Instagram 广告与合作咨询',
    description: '可以在这里查看 Locally 的 Instagram 媒体资料、广告方案与合作方式，并直接提交咨询。',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '请先查看下面的媒体资料与报价，再提交合作咨询。',
    mediaKitNote: '请先按顺序查看媒体资料与报价，再提交咨询。',
    mediaKitOpenLabel: '查看媒体资料',
    mediaKitModalTitle: 'Locally Instagram media kit',
    mediaKitModalHint: '可逐页查看频道介绍与报价内容。',
    mediaKitCloseLabel: '关闭',
    mediaKitPrevLabel: '上一页',
    mediaKitNextLabel: '下一页',
    mediaKitFallback: '等待上传图片',
    formTitle: '提交咨询',
    formDesc: '填写目标渠道、预算、投放时间与合作方式后，我们会更快完成初步确认。',
    companyLabel: '品牌 / 公司名',
    companyPlaceholder: '请输入品牌名或公司名',
    emailLabel: '联系邮箱',
    emailPlaceholder: 'email@company.com',
    proposalLabel: '咨询内容',
    proposalPlaceholder: '请填写投放目标、预算范围、希望时间与合作需求。',
    submitLabel: '发送咨询',
    submitSuccess: '咨询已提交，我们确认后会尽快联系您。',
    submitFail: '咨询发送失败，请稍后再试。',
    submitValidation: '请正确填写品牌名、邮箱和咨询内容。',
    submitSending: '发送中...',
  },
};

function MediaKitCard({
  index,
  fallbackLabel,
}: {
  index: number;
  fallbackLabel: string;
}) {
  const [extensionIndex, setExtensionIndex] = useState(0);
  const [isMissing, setIsMissing] = useState(false);

  const src = `/images/company/partnership-media-kit/${index}.${MEDIA_KIT_EXTENSIONS[extensionIndex]}`;

  const handleError = () => {
    if (extensionIndex < MEDIA_KIT_EXTENSIONS.length - 1) {
      setExtensionIndex((current) => current + 1);
      return;
    }

    setIsMissing(true);
  };

  return (
    <div
      data-testid={`partnership-media-kit-card-${index}`}
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
    >
      {isMissing ? (
        <div className="flex aspect-[4/5] flex-col items-center justify-center bg-[linear-gradient(180deg,#fbfbfb_0%,#f5f5f5_100%)] px-5 text-center">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-[#2f2f2f]">
            MEDIA KIT {index}
          </p>
          <p className="mt-2 text-[12px] leading-6 text-[#7a7a7a]">
            {fallbackLabel}
          </p>
          <p className="mt-3 text-[11px] text-[#9a9a9a]">
            {index}.png / jpg / jpeg / webp
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt={`Locally Instagram media kit ${index}`}
          className="block h-auto w-full"
          loading="lazy"
          onError={handleError}
        />
      )}
    </div>
  );
}

function MediaKitSlide({
  index,
  fallbackLabel,
}: {
  index: number;
  fallbackLabel: string;
}) {
  return (
    <div
      data-testid={`partnership-media-kit-slide-${index}`}
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
    >
      <MediaKitCard index={index} fallbackLabel={fallbackLabel} />
    </div>
  );
}

export default function PartnershipPage() {
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const copy = COPY[(lang in COPY ? lang : 'ko') as Locale];
  const [isMediaKitModalOpen, setIsMediaKitModalOpen] = useState(false);
  const [activeMediaKitIndex, setActiveMediaKitIndex] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [proposal, setProposal] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isMediaKitModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMediaKitModalOpen(false);
        return;
      }

      if (event.key === 'ArrowLeft') {
        setActiveMediaKitIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === 'ArrowRight') {
        setActiveMediaKitIndex((current) =>
          Math.min(MEDIA_KIT_SLOTS.length - 1, current + 1)
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMediaKitModalOpen]);

  const openMediaKitModal = () => {
    setActiveMediaKitIndex(0);
    setIsMediaKitModalOpen(true);
  };

  const closeMediaKitModal = () => {
    setIsMediaKitModalOpen(false);
  };

  const goToPreviousSlide = () => {
    setActiveMediaKitIndex((current) => Math.max(0, current - 1));
  };

  const goToNextSlide = () => {
    setActiveMediaKitIndex((current) =>
      Math.min(MEDIA_KIT_SLOTS.length - 1, current + 1)
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!companyName.trim() || !contactEmail.trim() || proposal.trim().length < 10) {
      showToast(copy.submitValidation, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/company/partnership-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          email: contactEmail.trim(),
          message: proposal.trim(),
          website,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || copy.submitFail);
      }

      setCompanyName('');
      setContactEmail('');
      setProposal('');
      setWebsite('');
      showToast(copy.submitSuccess, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.submitFail;
      showToast(message || copy.submitFail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSlot = MEDIA_KIT_SLOTS[activeMediaKitIndex];

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />

      <DesktopRightRailAdLayout>
      <main
        data-testid="company-partnership-main-content"
        className="mx-auto flex w-full max-w-[1120px] flex-col gap-16 px-4 py-12 md:px-6 md:py-24"
      >
        <section className="max-w-[820px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7a7a7a]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 text-[38px] font-black tracking-[-0.06em] md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-[760px] text-[16px] leading-8 text-[#666666] md:text-[20px] md:leading-9">
            {copy.description}
          </p>
        </section>

        <section
          data-testid="partnership-media-kit"
          className="rounded-[32px] border border-slate-200 bg-slate-50 px-4 py-5 md:px-6 md:py-7"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[760px]">
              <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#222222] md:text-[34px]">
                {copy.mediaKitTitle}
              </h2>
              <p className="mt-2 text-[14px] leading-7 text-[#666666] md:text-[16px]">
                {copy.mediaKitDesc}
              </p>
              <p className="mt-3 text-[12px] leading-6 text-[#8a8a8a] md:text-[13px]">
                {copy.mediaKitNote}
              </p>
            </div>

            <button
              type="button"
              data-testid="partnership-media-kit-toggle"
              onClick={openMediaKitModal}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-[13px] font-semibold text-[#222222] transition-colors hover:bg-slate-100"
            >
              {copy.mediaKitOpenLabel}
            </button>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white px-4 py-5 md:px-6 md:py-7">
          <div className="max-w-[760px]">
            <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#222222] md:text-[34px]">
              {copy.formTitle}
            </h2>
            <p className="mt-2 text-[14px] leading-7 text-[#666666] md:text-[16px]">
              {copy.formDesc}
            </p>
          </div>

          <form className="mt-10 space-y-12" onSubmit={handleSubmit}>
            <div
              aria-hidden="true"
              className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
            >
              <label htmlFor="partnership-website">Website</label>
              <input
                id="partnership-website"
                name="website"
                type="text"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-12 md:grid-cols-2">
              <div className="group">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                  {copy.companyLabel}
                </label>
                <input
                  type="text"
                  data-testid="partnership-company-input"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="w-full rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                  placeholder={copy.companyPlaceholder}
                  disabled={isSubmitting}
                />
              </div>
              <div className="group">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                  {copy.emailLabel}
                </label>
                <input
                  type="email"
                  data-testid="partnership-email-input"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className="w-full rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                  placeholder={copy.emailPlaceholder}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="group">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                {copy.proposalLabel}
              </label>
              <textarea
                data-testid="partnership-message-input"
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                className="h-40 w-full resize-none rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                placeholder={copy.proposalPlaceholder}
                disabled={isSubmitting}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                data-testid="partnership-submit-button"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-between bg-black px-8 py-6 text-lg font-bold text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:bg-[#555]"
              >
                <span>{isSubmitting ? copy.submitSending : copy.submitLabel}</span>
                <span className="transition-transform group-hover:translate-x-2">→</span>
              </button>
            </div>
          </form>
        </section>
      </main>
      </DesktopRightRailAdLayout>

      {isMediaKitModalOpen && (
        <div
          data-testid="partnership-media-kit-modal"
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-4 py-5 backdrop-blur-[4px] md:px-8"
        >
          <button
            type="button"
            aria-label={copy.mediaKitCloseLabel}
            className="absolute inset-0 cursor-default"
            onClick={closeMediaKitModal}
          />

          <div className="relative z-[1] flex w-full max-w-[1120px] flex-col">
            <div className="mb-4 flex items-start justify-between gap-4 px-1 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">
                  {copy.mediaKitModalTitle}
                </p>
                <p className="mt-2 text-[14px] text-white/88 md:text-[15px]">
                  {copy.mediaKitModalHint}
                </p>
              </div>

              <button
                type="button"
                data-testid="partnership-media-kit-close"
                onClick={closeMediaKitModal}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/16"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex items-center justify-center gap-3 md:gap-5">
              <button
                type="button"
                data-testid="partnership-media-kit-prev"
                aria-label={copy.mediaKitPrevLabel}
                onClick={goToPreviousSlide}
                disabled={activeMediaKitIndex === 0}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex-1">
                <MediaKitSlide
                  key={activeSlot}
                  index={activeSlot}
                  fallbackLabel={copy.mediaKitFallback}
                />
              </div>

              <button
                type="button"
                data-testid="partnership-media-kit-next"
                aria-label={copy.mediaKitNextLabel}
                onClick={goToNextSlide}
                disabled={activeMediaKitIndex === MEDIA_KIT_SLOTS.length - 1}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 px-1">
              <div
                data-testid="partnership-media-kit-counter"
                className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/88"
              >
                {activeMediaKitIndex + 1} / {MEDIA_KIT_SLOTS.length}
              </div>

              <div className="flex items-center gap-2">
                {MEDIA_KIT_SLOTS.map((slot, index) => (
                  <button
                    key={slot}
                    type="button"
                    aria-label={`Go to slide ${slot}`}
                    onClick={() => setActiveMediaKitIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeMediaKitIndex
                        ? 'w-8 bg-white'
                        : 'w-2.5 bg-white/35 hover:bg-white/55'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
