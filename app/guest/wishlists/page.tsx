'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, ArrowRight } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';

export default function WishlistsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [wishlists, setWishlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        // 체험 정보가 있는 것만 필터링
        setWishlists(data?.filter(item => item.experiences) || []);
      }
      setLoading(false);
    };

    fetchWishlists();
  }, [router, supabase]);

  // 🟢 [추가] 찜 해제 기능 (화면에서 바로 사라지게)
  const handleRemove = async (e: React.MouseEvent, wishlistId: number, expId: number) => {
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
         setWishlists(reData?.filter(item => item.experiences) || []);
       }
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
      <main className="max-w-[1760px] mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-8">위시리스트</h1>

        {loading ? (
          <div className="flex justify-center py-40">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
          </div>
        ) : wishlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50">
            <Heart size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">아직 찜한 체험이 없어요</h3>
            <p className="text-slate-500 mb-6">마음에 드는 체험을 찾아 하트를 눌러보세요!</p>
            <Link href="/">
              <button className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2">
                체험 둘러보기 <ArrowRight size={18}/>
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
            {wishlists.map((item: any) => {
              const exp = item.experiences;
              // 이미지 처리 (photos 배열 확인)
              const imageUrl = exp.photos && exp.photos.length > 0 ? exp.photos[0] : (exp.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989");

              return (
                <Link href={`/experiences/${exp.id}`} key={item.id} className="block group">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
                    <Image 
                      src={imageUrl} 
                      alt={exp.title} 
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* 찜 해제 버튼 */}
                    <button 
                      onClick={(e) => handleRemove(e, item.id, exp.id)}
                      className="absolute top-3 right-3 text-rose-500 hover:scale-110 transition-all z-10"
                    >
                      <Heart size={24} fill="#F43F5E" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="space-y-1 px-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">{exp.city || exp.location || '서울'} · {exp.category}</h3>
                      <div className="flex items-center gap-1 text-sm shrink-0">
                        <Star size={14} fill="black" />
                        <span>4.98</span> {/* 평점은 DB에 없으면 고정값 사용 */}
                      </div>
                    </div>
                    <p className="text-[15px] text-slate-500 line-clamp-1">{exp.title}</p>
                    <div className="mt-1">
                      <span className="font-bold text-slate-900 text-[15px]">₩{Number(exp.price).toLocaleString()}</span>
                      <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
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