'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Star, Share2, ArrowRight, ArrowLeft } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가

interface WishlistExperience {
  id: number;
  title: string;
  city?: string | null;
  location?: string | null;
  category?: string | null;
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
          city: exp.city ?? null,
          location: exp.location ?? null,
          category: exp.category ?? null,
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
  const { t } = useLanguage(); // 🟢 추가
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

  const handleShare = async (e: React.MouseEvent, exp: WishlistExperience) => {
    e.preventDefault();
    e.stopPropagation();

    const tripUrl = `${window.location.origin}/experiences/${exp.id}`;
    const shareText = `[Locally] ${exp.title}\n${tripUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: exp.title,
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
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-x-6 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {wishlists.map((item) => {
              const exp = item.experiences;
              if (!exp) return null;
              const imageUrl = exp.photos && exp.photos.length > 0 ? exp.photos[0] : (exp.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989");
              const ratingValue = Number(exp.rating ?? 0);
              const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;

              return (
                <Link href={`/experiences/${exp.id}`} key={item.id} className="block group">
                  <div className="relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-slate-200 mb-1.5 md:mb-2 border border-transparent group-hover:shadow-md transition-shadow">
                    <Image
                      src={imageUrl}
                      alt={exp.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button
                      onClick={(e) => handleShare(e, exp)}
                      className="absolute top-1.5 md:top-2 left-1.5 md:left-2 text-white bg-black/35 hover:bg-black/45 backdrop-blur-sm rounded-full p-1.5 md:p-[7px] transition-all z-10"
                      aria-label={t('trip_share')}
                    >
                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.3} />
                    </button>
                    {/* 찜 해제 버튼 */}
                    <button
                      onClick={(e) => handleRemove(e, item.id)}
                      className="absolute top-1.5 md:top-2 right-1.5 md:right-2 text-rose-500 hover:scale-110 transition-all z-10"
                    >
                      <Heart className="w-4 h-4 md:w-[18px] md:h-[18px]" fill="#F43F5E" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="space-y-0.5 px-0.5">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-900 text-[11px] md:text-[12px] truncate pr-1">{exp.city || exp.location || '서울'} · {exp.category}</h3>
                      <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] shrink-0">
                        <Star className={`w-[10px] h-[10px] md:w-[11px] md:h-[11px] ${hasRating ? "" : "text-slate-300"}`} fill={hasRating ? "black" : "none"} />
                        <span>{hasRating ? ratingValue.toFixed(1) : "New"}</span>
                      </div>
                    </div>
                    <p className="text-[10px] md:text-[11px] text-slate-500 line-clamp-1">{exp.title}</p>
                    <div className="mt-0.5">
                      <span className="font-bold text-slate-900 text-[11px] md:text-[12px]">₩{Number(exp.price).toLocaleString()}</span>
                      <span className="text-[10px] md:text-[11px] text-slate-500 font-normal"> {t('per_person')}</span>
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
