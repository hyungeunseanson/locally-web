'use client';

import React, { useState, useEffect } from 'react';
import { Share, Heart, MapPin, Check, X, Grid } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat'; 
import { useWishlist } from '@/app/hooks/useWishlist'; // 🟢 훅 임포트
import ExpMainContent from './components/ExpMainContent';
import ExpSidebar from './components/ExpSidebar';
import Image from 'next/image'; 
import { useToast } from '@/app/context/ToastContext'; 
import { ExperienceDetailSkeleton } from '@/app/components/skeletons/ExperienceDetailSkeleton';

export default function ExperienceClient() {
  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const { showToast } = useToast(); 
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { createInquiry } = useChat(); 
  
  // 🟢 훅 사용 (복잡한 로직 제거됨)
  const experienceId = params?.id as string;
  const { isSaved, toggleWishlist, isLoading: isSaveLoading } = useWishlist(experienceId);
  
  const [user, setUser] = useState<any>(null);
  const [experience, setExperience] = useState<any>(null);
  const [hostProfile, setHostProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateToTimeMap, setDateToTimeMap] = useState<Record<string, string[]>>({});
  const [inquiryText, setInquiryText] = useState('');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: exp, error } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (error) { console.error(error); } 
      else {
        setExperience(exp);
        
        // 날짜 정보
        const { data: dates } = await supabase.from('experience_availability').select('date, start_time').eq('experience_id', exp.id).eq('is_booked', false);
        if (dates) {
          const datesList = Array.from(new Set(dates.map((d: any) => d.date)));
          setAvailableDates(datesList as string[]);
          const timeMap: Record<string, string[]> = {};
          dates.forEach((d:any) => {
            if (!timeMap[d.date]) timeMap[d.date] = [];
            timeMap[d.date].push(d.start_time);
          });
          setDateToTimeMap(timeMap);
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', exp.host_id).single();
        const { data: app } = await supabase.from('host_applications').select('*').eq('user_id', exp.host_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        
        setHostProfile({
          id: exp.host_id, 
          name: app?.name || profile?.name || profile?.full_name || 'Locally Host',
          avatar_url: app?.profile_photo || profile?.avatar_url || null,
          languages: (profile?.languages && profile.languages.length > 0) ? profile.languages : (app?.languages || []),
          introduction: profile?.introduction || profile?.bio || app?.self_intro || '안녕하세요! 로컬리 호스트입니다.',
          job: profile?.job,
          dream_destination: profile?.dream_destination,
          favorite_song: profile?.favorite_song
        });
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id, supabase]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopySuccess(true); 
    setTimeout(() => setIsCopySuccess(false), 3000);
  };

  const handleInquiry = async () => {
    if (!user) return showToast('로그인이 필요합니다.', 'error');
    if (!inquiryText.trim()) return showToast('내용을 입력해주세요.', 'error');
    
    try {
      if (!experience?.host_id) return showToast('호스트 정보를 불러올 수 없습니다.', 'error');
      await createInquiry(experience.host_id, experience.id, inquiryText);
      if (confirm('문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?')) {
        router.push('/guest/inbox');
      }
      setInquiryText('');
    } catch (e: any) {
      showToast('문의 전송 실패: ' + e.message, 'error');
    }
  };

  const handleReserve = (date: string, time: string, guests: number, isPrivate: boolean) => {
    if (!user) return showToast("로그인이 필요합니다.", 'error');
    if (!date) return showToast("날짜를 선택해주세요.", 'error');
    if (!time) return showToast("시간을 선택해주세요.", 'error');
    const typeParam = isPrivate ? '&type=private' : '';
    router.push(`/experiences/${params.id}/payment?date=${date}&time=${time}&guests=${guests}${typeParam}`);
  };

  if (loading) return <ExperienceDetailSkeleton />;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">체험을 찾을 수 없습니다.</div>;

  const photos = experience.photos && experience.photos.length > 0 
    ? experience.photos 
    : [experience.image_url || "https://images.unsplash.com/photo-1540206395-688085723adb"];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-0">
      <SiteHeader />
      {isCopySuccess && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><Check size={16} className="text-green-400"/> 링크가 복사되었습니다.</div>}

      <main className="max-w-[1120px] mx-auto px-6 py-8">
        <section className="mb-6">
          <h1 className="text-3xl font-black mb-2 tracking-tight">{experience.title}</h1>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-800">
              <button onClick={() => scrollToSection('reviews')} className="flex items-center gap-1 hover:underline underline-offset-4"><span className="font-bold">★ 4.98</span> <span className="text-slate-500 underline">후기 15개</span></button>
              <span className="text-slate-300">|</span>
              <button onClick={() => scrollToSection('location')} className="flex items-center gap-1 hover:underline underline-offset-4 font-bold text-slate-700"><MapPin size={14}/> {experience.location}</button>
            </div>
            <div className="flex gap-2">
               <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1"><Share size={16} /> 공유하기</button>
               {/* 🟢 훅 연결 완료 */}
               <button onClick={toggleWishlist} disabled={isSaveLoading} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                 <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} /> 
                 {isSaved ? '저장됨' : '저장'}
               </button>
            </div>
          </div>
        </section>

        {/* 사진 그리드 등 나머지 UI 유지 */}
        <section className="relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group border border-slate-200 shadow-sm select-none">
          {photos.length === 1 && (
             <div className="w-full h-full relative cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
                <Image src={photos[0]} alt="Background" fill className="object-cover blur-xl opacity-50 scale-110" />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="relative w-full h-full max-w-[800px] shadow-2xl rounded-lg overflow-hidden transition-transform duration-500 group-hover:scale-[1.01]">
                    <Image src={photos[0]} alt="Main" fill className="object-contain" />
                  </div>
                </div>
             </div>
          )}
          {photos.length >= 2 && (
             <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
                <div className="col-span-2 row-span-2 relative overflow-hidden">
                   <Image src={photos[0]} alt="Main" fill className="object-cover hover:scale-105 transition-transform duration-700" />
                </div>
                {photos.slice(1, 5).map((photo: string, i: number) => (
                  <div key={i} className={`relative overflow-hidden ${photos.length === 2 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'}`}>
                    <Image src={photo} alt={`Sub ${i}`} fill className="object-cover hover:scale-105 transition-transform duration-700" />
                  </div>
                ))}
             </div>
          )}
           <button 
             onClick={(e) => { e.stopPropagation(); setIsGalleryOpen(true); }}
             className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform z-10"
           >
             <Grid size={16}/> 사진 모두 보기
           </button>
        </section>

        <div className="flex flex-col md:flex-row gap-16 relative">
          <ExpMainContent 
            experience={experience} 
            hostProfile={hostProfile} 
            handleInquiry={handleInquiry} 
            inquiryText={inquiryText} 
            setInquiryText={setInquiryText}
          />
          <ExpSidebar 
            experience={experience} 
            availableDates={availableDates} 
            dateToTimeMap={dateToTimeMap} 
            handleReserve={handleReserve} 
          />
        </div>
      </main>

      {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-200 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
             <button onClick={() => setIsGalleryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
             <h3 className="font-bold text-lg">사진 모두 보기</h3>
             <div className="w-10"></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50">
             <div className="max-w-4xl mx-auto space-y-4">
               {photos.map((photo: string, index: number) => (
                 <div key={index} className="relative w-full aspect-[3/2] md:aspect-[16/10] bg-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <Image src={photo} alt={`Gallery ${index}`} fill className="object-contain bg-black/5" />
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}