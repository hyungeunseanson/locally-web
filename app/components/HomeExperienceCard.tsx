'use client';

import Link from 'next/link';
import {
  Utensils,
  Coffee,
  TreePine,
  ShoppingBag,
  Landmark,
  Dumbbell,
  MoonStar,
  Building2,
  Ticket,
  Flag,
  Palette,
  Sparkles,
} from 'lucide-react';

import { useLanguage } from '@/app/context/LanguageContext';
import { getContent } from '@/app/utils/contentHelper';
import { CATEGORY_OPTIONS } from '@/app/host/create/config';
import { formatLocalizedExperienceLocation } from '@/app/utils/locationLocalization';
import ExperienceCardMeta from '@/app/components/ExperienceCardMeta';
import PublicExperienceCardImage from '@/app/components/PublicExperienceCardImage';
import { getExperienceCardImageUrl } from '@/app/utils/experienceImages';

export interface HomeExperienceCardData {
  id: number | string;
  title?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  category?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  languages?: string[] | null;
  duration?: number | string | null;
  price?: number | string | null;
  rating?: number | null;
  review_count?: number | null;
  wishlist_count?: number | null;
  card_image_url?: string | null;
  photos?: string[] | null;
  image_url?: string | null;
}

function renderCategoryIcon(categoryLabel: string) {
  const normalizedLabel = categoryLabel.trim().toLowerCase();
  const matchedOption = CATEGORY_OPTIONS.find((option) => {
    const labels = Object.values(option.labels).map((label) => label.trim().toLowerCase());
    return option.value.trim().toLowerCase() === normalizedLabel || labels.includes(normalizedLabel);
  });

  if (!matchedOption) {
    return <Sparkles size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
  }

  switch (matchedOption.icon) {
    case 'utensils':
      return <Utensils size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'coffee':
      return <Coffee size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'treePine':
      return <TreePine size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'shoppingBag':
      return <ShoppingBag size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'landmark':
      return <Landmark size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'dumbbell':
      return <Dumbbell size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'moonStar':
      return <MoonStar size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'building2':
      return <Building2 size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'ticket':
      return <Ticket size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'flag':
      return <Flag size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    case 'palette':
      return <Palette size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
    default:
      return <Sparkles size={11} strokeWidth={2.1} className="shrink-0 text-[#4A4A4A] md:h-[12px] md:w-[12px]" />;
  }
}

export default function HomeExperienceCard({ data }: { data: HomeExperienceCardData }) {
  const { lang, t } = useLanguage();

  const title = getContent(data, 'title', lang) || t('exp_card_title_fallback');
  const category = getContent(data, 'category', lang) || data.category || t('cat_exp');
  const location = formatLocalizedExperienceLocation(data, lang) || t('exp_card_location_fallback');
  const imageUrl = getExperienceCardImageUrl(data);

  return (
    <Link
      href={`/experiences/${data.id}`}
      className="group block transition-transform duration-200 active:scale-[0.985] md:hover:-translate-y-[2px] md:active:scale-100"
    >
      <div className="relative mb-2.5 overflow-hidden rounded-[22px] bg-slate-200 aspect-square border border-black/5 md:mb-3 md:rounded-[24px] shadow-[0_4px_12px_rgba(15,23,42,0.06)] md:shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        <PublicExperienceCardImage
          experienceId={data.id}
          originImageUrl={imageUrl}
          alt={title}
          className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 42vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 18vw"
        />

        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-start md:hidden">
          <div className="max-w-[66%] rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold tracking-[-0.01em] text-[#2B2B2B] shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
            <span className="flex items-center gap-1.5">
              {renderCategoryIcon(String(category))}
              <span className="block truncate">{category}</span>
            </span>
          </div>
        </div>

        <div className="absolute left-4 top-4 z-10 hidden max-w-[70%] rounded-full bg-white px-3 py-[5px] text-[10px] font-semibold tracking-[-0.01em] text-[#2B2B2B] shadow-[0_2px_6px_rgba(0,0,0,0.08)] md:block">
          <span className="flex items-center gap-1.5">
            {renderCategoryIcon(String(category))}
            <span className="block truncate">{category}</span>
          </span>
        </div>

      </div>

      <ExperienceCardMeta
        title={title}
        location={location}
        languages={data.languages}
        price={data.price}
        duration={data.duration}
        rating={data.rating}
        reviewCount={data.review_count}
      />
    </Link>
  );
}
