'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';

import { useWishlist } from '@/app/hooks/useWishlist';
import { useLanguage } from '@/app/context/LanguageContext';
import { getContent } from '@/app/utils/contentHelper';

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
  price?: number | string | null;
  rating?: number | null;
  review_count?: number | null;
  photos?: string[] | null;
  image_url?: string | null;
}

function formatLocation(data: HomeExperienceCardData) {
  const parts = Array.from(
    new Set(
      [data.city, data.country]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const fallbackLocation = String(data.location || '').trim();
  return fallbackLocation || '서울';
}

export default function HomeExperienceCard({ data }: { data: HomeExperienceCardData }) {
  const { lang } = useLanguage();
  const { isSaved, toggleWishlist, isLoading } = useWishlist(String(data.id));

  const title = getContent(data, 'title', lang) || '로컬 체험';
  const category = getContent(data, 'category', lang) || data.category || '체험';
  const location = formatLocation(data);
  const rawPrice = typeof data.price === 'number' ? data.price : Number(data.price);
  const price = Number.isFinite(rawPrice) ? rawPrice.toLocaleString() : '45,000';
  const ratingValue = Number(data.rating || 0);
  const ratingText = ratingValue > 0 ? `★${ratingValue.toFixed(1)}` : 'New';
  const imageUrl = data.photos?.[0] || data.image_url || 'https://images.unsplash.com/photo-1542051841857-5f90071e7989';

  return (
    <Link
      href={`/experiences/${data.id}`}
      className="group block transition-transform duration-200 active:scale-[0.985] md:hover:-translate-y-[2px] md:active:scale-100"
    >
      <div className="relative mb-2.5 overflow-hidden rounded-[22px] bg-slate-200 aspect-square border border-black/5 md:mb-3 md:rounded-[24px] shadow-[0_4px_12px_rgba(15,23,42,0.06)] md:shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 42vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 18vw"
        />

        <div className="absolute left-3 top-3 z-10 max-w-[68%] rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold tracking-[-0.01em] text-[#2B2B2B] shadow-[0_2px_6px_rgba(0,0,0,0.08)] md:left-4 md:top-4 md:max-w-[72%] md:px-3.5 md:py-1.5 md:text-[11px]">
          <span className="block truncate">{category}</span>
        </div>

        <button
          type="button"
          aria-label="위시리스트 토글"
          disabled={isLoading}
          onClick={(e) => {
            void toggleWishlist(e);
          }}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-black/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.16)] backdrop-blur-sm transition-transform duration-200 md:right-4 md:top-4 md:h-9 md:w-9 md:hover:scale-105"
        >
          <Heart
            size={16}
            strokeWidth={2.2}
            fill={isSaved ? '#F43F5E' : 'rgba(255,255,255,0.08)'}
            className={isSaved ? 'text-rose-500' : 'text-white'}
          />
        </button>
      </div>

      <div className="space-y-0.5 px-0.5 md:space-y-1">
        <h3 className="line-clamp-2 text-[11px] font-semibold leading-[1.28] tracking-[-0.01em] text-[#1F1F1F] md:text-[15px] md:leading-[1.3]">
          {title}
        </h3>
        <p className="line-clamp-1 text-[10px] text-slate-500 md:text-[14px]">
          {location}
        </p>
        <div className="mt-0.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-slate-500 md:text-[14px]">
          <span className="shrink-0">1인당</span>
          <span className="truncate font-semibold text-slate-900">₩{price}부터</span>
          <span className="shrink-0 text-slate-300">·</span>
          <span className="shrink-0 font-medium">{ratingText}</span>
        </div>
      </div>
    </Link>
  );
}
