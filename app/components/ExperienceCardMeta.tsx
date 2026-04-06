'use client';

import { useLanguage } from '@/app/context/LanguageContext';
import {
  getExperienceDurationHours,
  getExperienceLanguageBadges,
  getExperiencePriceParts,
} from '@/app/utils/experienceCardDisplay';

type ExperienceCardMetaProps = {
  title: string;
  location: string;
  languages?: string[] | null;
  price?: number | string | null;
  duration?: number | string | null;
  rating?: number | null;
  reviewCount?: number | null;
  showReviewCount?: boolean;
  className?: string;
};

export default function ExperienceCardMeta({
  title,
  location,
  languages,
  price,
  duration,
  rating,
  reviewCount,
  showReviewCount = false,
  className = 'space-y-0.5 px-0.5 md:space-y-1',
}: ExperienceCardMetaProps) {
  const { lang, t } = useLanguage();
  const languageBadges = getExperienceLanguageBadges(languages, lang);
  const { prefix: pricePrefix, suffix: priceSuffix } = getExperiencePriceParts(lang);
  const rawPrice = typeof price === 'number' ? price : Number(price);
  const formattedPrice = Number.isFinite(rawPrice) ? rawPrice.toLocaleString() : '45,000';
  const durationHours = getExperienceDurationHours(duration);
  const durationText = durationHours ? t('exp_card_duration_hours', { hours: durationHours }) : '';
  const ratingValue = Number(rating || 0);
  const normalizedReviewCount = Number(reviewCount || 0);
  const ratingText = ratingValue > 0 ? `★${ratingValue.toFixed(1)}` : t('exp_card_new');

  return (
    <div className={className}>
      <h3
        data-testid="experience-card-meta-title"
        className="line-clamp-2 text-[11px] font-semibold leading-[1.28] tracking-[-0.01em] text-[#1F1F1F] md:text-[15px] md:leading-[1.3]"
      >
        {title}
      </h3>
      <div className="flex items-center gap-1 overflow-hidden text-[9px] text-slate-500 md:text-[12px]">
        <span data-testid="experience-card-meta-location" className="truncate leading-none">
          {location}
        </span>
        {languageBadges.visible.map((label) => (
          <span
            key={label}
            className="inline-flex h-[15px] shrink-0 items-center self-center rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[8px] font-medium leading-none text-slate-600 md:h-[18px] md:px-1.5 md:text-[9px]"
          >
            {label}
          </span>
        ))}
        {languageBadges.hiddenCount > 0 && (
          <span className="inline-flex h-[15px] shrink-0 items-center self-center rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[8px] font-medium leading-none text-slate-600 md:h-[18px] md:px-1.5 md:text-[9px]">
            {t('exp_card_languages_more', { count: languageBadges.hiddenCount })}
          </span>
        )}
      </div>
      <div
        data-testid="experience-card-meta-price-row"
        className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 overflow-hidden text-[10px] text-slate-500 md:text-[14px]"
      >
        <span data-testid="experience-card-meta-price" className="shrink-0">
          {pricePrefix ? <span>{pricePrefix} </span> : null}
          <span className="font-semibold text-slate-900">₩{formattedPrice}{priceSuffix}</span>
        </span>
        {durationText && (
          <>
            <span className="shrink-0 text-slate-300">·</span>
            <span data-testid="experience-card-duration" className="shrink-0 font-medium">
              {durationText}
            </span>
          </>
        )}
        <span className="shrink-0 text-slate-300">·</span>
        <span data-testid="experience-card-meta-rating" className="shrink-0 font-medium">
          {ratingText}
          {showReviewCount && normalizedReviewCount > 0 ? (
            <span className="ml-1 text-slate-400 font-normal">({normalizedReviewCount})</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
