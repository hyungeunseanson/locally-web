'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Share2, ArrowRight, ArrowLeft } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import Spinner from '@/app/components/ui/Spinner';
import { getContent } from '@/app/utils/contentHelper';
import { formatLocalizedExperienceLocation } from '@/app/utils/locationLocalization';
import { getExperienceLanguageBadges, getExperiencePriceParts } from '@/app/utils/experienceCardDisplay';

interface WishlistExperience {
  id: number;
  title: string;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  city?: string | null;
  country?: string | null;
  subCity?: string | null;
  location?: string | null;
  languages?: string[] | null;
  category?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  rating?: number | null;
  price?: number | string | null;
  image_url?: string | null;
  photos?: string[] | null;
}

interface WishlistItem {
  id: number;
  created_at: string | undefined;
  experiences: WishlistExperience | null;
}

const normalizeWishlistRows = (rows: unknown[]): WishlistItem[] => {
  return rows
    .map((row) => {
      const item = row as { id: number; created_at?: string; experiences?: unknown };
      const rawExperience = Array.isArray(item.experiences) ? item.experiences[0] : item.experiences;
      if (!rawExperience || typeof rawExperience !== 'object') return null;

      const exp = rawExperience as Partial<WishlistExperience>;
      if (typeof exp.id !== 'number' || typeof exp.title !== 'string') return null;

      return {
        id: Number(item.id),
        created_at: item.created_at,
        experiences: {
          id: exp.id,
          title: exp.title,
          title_en: exp.title_en ?? null,
          title_ja: exp.title_ja ?? null,
          title_zh: exp.title_zh ?? null,
          city: exp.city ?? null,
          country: exp.country ?? null,
          subCity: exp.subCity ?? null,
          location: exp.location ?? null,
          languages: exp.languages ?? null,
          category: exp.category ?? null,
          category_en: exp.category_en ?? null,
          category_ja: exp.category_ja ?? null,
          category_zh: exp.category_zh ?? null,
          rating: exp.rating ?? null,
          price: exp.price ?? null,
          image_url: exp.image_url ?? null,
          photos: exp.photos ?? null,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

export default function WishlistsPage() {
  const { lang, t } = useLanguage(); // 🟢 추가
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/account');
  };

  useEffect(() => {
    const fetchWishlists = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      // 🟢 [수정] experiences(*)로 모든 컬럼을 가져와서 에러 방지
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          id,
          created_at,
          experiences (*) 
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('위시리스트 로딩 실패:', error);
        showToast('위시리스트를 불러오는 중 오류가 발생했어요.', 'error');
      } else {
        setWishlists(normalizeWishlistRows((data ?? []) as unknown[]));
      }
      setLoading(false);
    };

    fetchWishlists();
  }, [router, showToast, supabase]);

  // 🟢 [추가] 찜 해제 기능 (화면에서 바로 사라지게)
  const handleRemove = async (e: React.MouseEvent, wishlistId: number) => {
    e.preventDefault();
    e.stopPropagation();

    // 낙관적 업데이트 (UI 먼저 삭제)
    setWishlists(prev => prev.filter(item => item.id !== wishlistId));

    const { error } = await supabase.from('wishlists').delete().eq('id', wishlistId);
    if (error) {
      console.error(error);
      showToast('찜 해제에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: reData } = await supabase.from('wishlists').select('id, created_at, experiences (*)').eq('user_id', user.id).order('created_at', { ascending: false });
        setWishlists(normalizeWishlistRows((reData ?? []) as unknown[]));
      }
    }
  };

  const handleShare = async (e: React.MouseEvent, exp: WishlistExperience, shareTitle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const tripUrl = `${window.location.origin}/experiences/${exp.id}`;
    const shareText = `[Locally] ${shareTitle}\n${tripUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: tripUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error('share-unavailable');
      }
      showToast(t('trip_share_done'), 'success');
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast(t('trip_share_fail'), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-[1760px] mx-auto px-4 md:px-6 py-5 md:py-12">
        <div className="md:hidden mb-2.5">
          <button
            onClick={handleMobileBack}
            className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-[14px] h-[14px] md:w-4 md:h-4" />
          </button>
        </div>

        <h1 className="text-[18px] md:text-3xl font-black mb-3 md:mb-8">{t('wishlist')}</h1>
        {loading ? (
          <div className="flex justify-center py-28 md:py-40">
            <Spinner size={32} variant="muted" />
          </div>
        ) : wishlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 md:py-20 border-2 border-dashed border-slate-100 rounded-2xl md:rounded-3xl bg-slate-50">
            <Heart className="w-10 h-10 md:w-12 md:h-12 text-slate-300 mb-3 md:mb-4" />
            <h3 className="text-[16px] md:text-lg font-bold text-slate-900 mb-1.5 md:mb-2">{t('wishlist_empty')}</h3> {/* 🟢 번역 */}
            <p className="text-[13px] md:text-base text-slate-500 mb-5 md:mb-6 text-center px-3">{t('wishlist_desc')}</p> {/* 🟢 번역 */}
            <Link href="/">
              <button className="bg-black text-white px-5 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[13px] md:text-sm font-bold hover:scale-105 transition-transform flex items-center gap-1.5 md:gap-2">
                {t('explore_exp')} <ArrowRight className="w-4 h-4 md:w-[18px] md:h-[18px]" /> {/* 🟢 번역 */}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {wishlists.map((item) => {
              const exp = item.experiences;
              if (!exp) return null;
              const imageUrl = exp.photos && exp.photos.length > 0 ? exp.photos[0] : (exp.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989");
              const ratingValue = Number(exp.rating ?? 0);
              const ratingText = Number.isFinite(ratingValue) && ratingValue > 0
                ? `★${ratingValue.toFixed(1)}`
                : t('exp_card_new');
              const title = getContent(exp, 'title', lang) || exp.title || t('exp_card_title_fallback');
              const location = formatLocalizedExperienceLocation(exp, lang) || t('exp_card_location_fallback');
              const languageBadges = getExperienceLanguageBadges(exp.languages, lang);
              const { prefix: pricePrefix, suffix: priceSuffix } = getExperiencePriceParts(lang);

              return (
                <Link
                  href={`/experiences/${exp.id}`}
                  key={item.id}
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
                    <button
                      onClick={(e) => handleShare(e, exp, title)}
                      className="absolute left-3 top-3 z-10 rounded-full bg-black/35 p-1.5 text-white backdrop-blur-sm transition-all hover:bg-black/45 md:left-4 md:top-4 md:p-[7px]"
                      aria-label={t('trip_share')}
                    >
                      <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.3} />
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, item.id)}
                      className="absolute right-3 top-3 z-10 p-0.5 text-white [filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.34))] transition-transform duration-200 md:right-4 md:top-4 md:hover:scale-105"
                      aria-label={t('exp_card_wishlist_toggle')}
                    >
                      <Heart
                        size={20}
                        strokeWidth={1.9}
                        fill="#F43F5E"
                        className="text-rose-500"
                      />
                    </button>
                  </div>

                  <div className="space-y-0.5 px-0.5 md:space-y-1">
                    <h3 className="line-clamp-2 text-[11px] font-semibold leading-[1.28] tracking-[-0.01em] text-[#1F1F1F] md:text-[15px] md:leading-[1.3]">
                      {title}
                    </h3>
                    <div className="flex items-center gap-1 overflow-hidden text-[9px] text-slate-500 md:text-[12px]">
                      <span className="truncate leading-none">{location}</span>
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
                    <div className="mt-0.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-slate-500 md:text-[14px]">
                      <span className="shrink-0">{pricePrefix}</span>
                      <span className="truncate font-semibold text-slate-900">
                        ₩{Number(exp.price).toLocaleString()}{priceSuffix}
                      </span>
                      <span className="shrink-0 text-slate-300">·</span>
                      <span className="shrink-0 font-medium">{ratingText}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
