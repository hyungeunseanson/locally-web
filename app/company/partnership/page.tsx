'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { useLanguage } from '@/app/context/LanguageContext';

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
  mediaKitToggleOpen: string;
  mediaKitToggleClose: string;
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
}> = {
  ko: {
    eyebrow: 'Instagram channel',
    title: 'Instagram 광고 · 제휴 문의',
    description: '로컬리 인스타그램 채널 광고, 브랜드 협업, 공동 캠페인 문의를 한곳에서 확인하고 바로 문의할 수 있습니다.',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '미디어 킷과 단가표는 아래에서 편하게 펼쳐서 볼 수 있어요.',
    mediaKitNote: '광고 문의는 아래 폼으로 남겨주시면 확인 후 연락드릴게요.',
    mediaKitToggleOpen: '미디어 킷 펼쳐보기',
    mediaKitToggleClose: '미디어 킷 접기',
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
  },
  en: {
    eyebrow: 'Instagram channel',
    title: 'Instagram media kit & partnerships',
    description: 'Review Locally’s Instagram media kit, advertising options, and partnership details before reaching out.',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: 'Check the media kit and rate card below, then send us your inquiry.',
    mediaKitNote: 'Review the media kit and pricing slides in order before sending your inquiry.',
    mediaKitToggleOpen: 'View media kit',
    mediaKitToggleClose: 'Hide media kit',
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
  },
  ja: {
    eyebrow: 'Instagram channel',
    title: 'Instagram広告・提携のお問い合わせ',
    description: 'LocallyのInstagram広告、ブランド提携、共同キャンペーンに関する内容を確認して、そのままお問い合わせできます。',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '下のメディアキットと料金表を確認してからお問い合わせください。',
    mediaKitNote: 'メディアキットと料金表を順番に確認してからお問い合わせください。',
    mediaKitToggleOpen: 'メディアキットを見る',
    mediaKitToggleClose: 'メディアキットを閉じる',
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
  },
  zh: {
    eyebrow: 'Instagram channel',
    title: 'Instagram 广告与合作咨询',
    description: '可以在这里查看 Locally 的 Instagram 媒体资料、广告方案与合作方式，并直接提交咨询。',
    mediaKitTitle: 'Media kit & rate card',
    mediaKitDesc: '请先查看下面的媒体资料与报价，再提交合作咨询。',
    mediaKitNote: '请先按顺序查看媒体资料与报价，再提交咨询。',
    mediaKitToggleOpen: '查看媒体资料',
    mediaKitToggleClose: '收起媒体资料',
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

export default function PartnershipPage() {
  const { lang } = useLanguage();
  const copy = COPY[(lang in COPY ? lang : 'ko') as Locale];
  const [isMediaKitOpen, setIsMediaKitOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-16 px-4 py-12 md:px-6 md:py-24">
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
              aria-expanded={isMediaKitOpen}
              onClick={() => setIsMediaKitOpen((current) => !current)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-[13px] font-semibold text-[#222222] transition-colors hover:bg-slate-100"
            >
              {isMediaKitOpen ? copy.mediaKitToggleClose : copy.mediaKitToggleOpen}
            </button>
          </div>

          {isMediaKitOpen && (
            <div
              data-testid="partnership-media-kit-panel"
              className="mt-6 grid gap-4 md:grid-cols-2"
            >
              {MEDIA_KIT_SLOTS.map((slot) => (
                <MediaKitCard
                  key={slot}
                  index={slot}
                  fallbackLabel={copy.mediaKitFallback}
                />
              ))}
            </div>
          )}
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

          <form className="mt-10 space-y-12" onSubmit={(event) => event.preventDefault()}>
            <div className="grid gap-12 md:grid-cols-2">
              <div className="group">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                  {copy.companyLabel}
                </label>
                <input
                  type="text"
                  className="w-full rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                  placeholder={copy.companyPlaceholder}
                />
              </div>
              <div className="group">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                  {copy.emailLabel}
                </label>
                <input
                  type="email"
                  className="w-full rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                  placeholder={copy.emailPlaceholder}
                />
              </div>
            </div>

            <div className="group">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 group-focus-within:text-black">
                {copy.proposalLabel}
              </label>
              <textarea
                className="h-40 w-full resize-none rounded-none border-b border-gray-300 bg-transparent py-3 text-xl font-medium outline-none transition-colors placeholder:text-gray-300 focus:border-black"
                placeholder={copy.proposalPlaceholder}
              />
            </div>

            <div className="pt-2">
              <button className="group flex w-full items-center justify-between bg-black px-8 py-6 text-lg font-bold text-white transition-colors hover:bg-[#333]">
                <span>{copy.submitLabel}</span>
                <span className="transition-transform group-hover:translate-x-2">→</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
