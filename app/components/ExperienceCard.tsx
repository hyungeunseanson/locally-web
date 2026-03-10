'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star } from 'lucide-react';
import { useWishlist } from '@/app/hooks/useWishlist';
import { useLanguage } from '@/app/context/LanguageContext';
import { getContent } from '@/app/utils/contentHelper';
import { formatLocalizedExperienceLocation } from '@/app/utils/locationLocalization';

type ExperienceCardData = {
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
  subCity?: string | null;
  location?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
  price?: number | string | null;
};

export default function ExperienceCard({ data }: { data: ExperienceCardData }) {
  const { isSaved, toggleWishlist, isLoading } = useWishlist(String(data.id));
  const { lang, t } = useLanguage();

  // 🟢 [기능 유지] 다국어 데이터 가져오기 (LanguageContext의 lang 사용)
  const title = getContent(data, 'title', lang) || t('exp_card_title_fallback');
  const category = getContent(data, 'category', lang) || data.category || t('cat_exp');

  // 이미지 주소 처리
  const imageUrl = (data.photos && data.photos.length > 0)
    ? data.photos[0]
    : (data.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989");

  // 지역 정보 (없으면 기본값)
  const location = formatLocalizedExperienceLocation(data, lang) || t('exp_card_location_fallback');
  const rating = Number(data.rating || 0);
  const reviewCount = Number(data.review_count || 0);

  return (
    <Link href={`/experiences/${data.id}`} className="block group active:scale-[0.98] transition-transform duration-200">
      {/* 🖼️ 이미지 영역 (프리미엄 쉐도우 및 Lift 애니메이션 적용) */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-2 md:mb-3 border border-transparent [box-shadow:var(--shadow-card)] group-hover:[box-shadow:var(--shadow-card-hover)] group-hover:-translate-y-1 transition-all duration-500 ease-out">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        {/* ❤️ 하트 버튼 (우측 상단 고정 원본 복구) */}
        <button
          type="button"
          aria-label={t('exp_card_wishlist_toggle')}
          disabled={isLoading}
          onClick={(e) => {
            void toggleWishlist(e);
          }}
          className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10"
        >
          <Heart
            size={24}
            fill={isSaved ? "#F43F5E" : "rgba(0,0,0,0.5)"}
            strokeWidth={2}
            className={isSaved ? "text-rose-500" : ""}
          />
        </button>
      </div>

      {/* 📝 텍스트 영역 (원본 레이아웃 복구) */}
      <div className="space-y-0.5 md:space-y-1 px-0.5 md:px-1">

        {/* 1열: [지역 · 카테고리] --------- [별점] */}
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[12px] md:text-[15px] truncate pr-2 tracking-tight">
            {location} · {category}
          </h3>
          <div className="flex items-center gap-0.5 md:gap-1 text-[11px] md:text-sm shrink-0">
            <Star size={11} className="md:w-[14px] md:h-[14px]" fill={rating > 0 ? "black" : "none"} />
            <span>{rating > 0 ? rating.toFixed(2) : t('exp_card_new')}</span>
            {reviewCount > 0 && <span className="text-slate-400 font-normal">({reviewCount})</span>}
          </div>
        </div>

        {/* 2열: 제목 */}
        <p className="text-[11px] md:text-[15px] text-slate-500 line-clamp-1 leading-snug tracking-tight">
          {title}
        </p>

        {/* 3열: 가격 */}
        <div className="mt-0.5 md:mt-1">
          <span className="text-[11px] md:text-[14px] text-slate-500 font-normal">{t('exp_card_per_person')} </span>
          <span className="font-black text-slate-900 text-[12px] md:text-[15px] tracking-tight">
            ₩{Number(data.price).toLocaleString()}{t('exp_card_price_from')}
          </span>
        </div>
      </div>
    </Link>
  );
}
