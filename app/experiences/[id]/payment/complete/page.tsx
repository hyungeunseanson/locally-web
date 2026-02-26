'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, Calendar, MapPin, Share2, Copy, Home, ArrowRight, Download, MessageCircle, Clock, CreditCard, AlertCircle } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import confetti from 'canvas-confetti'; // 🎉 폭죽 효과

function PaymentCompleteContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const orderId = searchParams.get('orderId');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. 예약 정보 조회
  useEffect(() => {
    const fetchBooking = async () => {
      if (!orderId) return;

      const { data, error } = await supabase
        .from('bookings')
        .select('*, experiences(*)')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error || !data) {
        console.error('Booking fetch error:', error);
        showToast('예약 정보를 불러오지 못했어요. 주문 번호를 확인해주세요.', 'error');
      } else {
        setBooking(data);
        // 🎉 데이터 로드 성공 시 폭죽 발사!
        fireConfetti();
      }
      setLoading(false);
    };
    fetchBooking();
  }, [orderId, supabase]);

  // 🎉 폭죽 효과 함수
  const fireConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // 📅 구글 캘린더 링크 생성
  const handleAddToCalendar = () => {
    if (!booking) return;
    const { date, time, experiences } = booking;
    
    // 날짜/시간 포맷팅 (YYYYMMDDTHHMMSSZ)
    const startTime = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`;
    const endDate = new Date(new Date(`${date}T${time}`).getTime() + (experiences.duration || 2) * 60 * 60 * 1000);
    const endTime = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // 대략적인 종료 시간 (2시간 후로 가정)

    const details = `Locally 체험 예약: ${experiences.title}\n위치: ${experiences.location}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(experiences.title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(experiences.location)}`;
    
    window.location.href = url;
  };

  // 💌 링크 공유
  const handleShare = () => {
    const url = `${window.location.origin}/experiences/${params.id}`;
    navigator.clipboard.writeText(url);
    showToast('체험 링크가 복사되었습니다! 친구에게 알려주세요.', 'success');
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">로딩 중...</div>;
  if (!booking) return <div className="min-h-screen bg-white flex items-center justify-center">예약 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteHeader />
      
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-20 text-center">
        
{/* 1. 성공 메시지 (상태별 분기) */}
<div className="mb-10 animate-in zoom-in duration-500">
          {booking.status === 'PENDING' ? (
            <>
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600 shadow-sm animate-pulse">
                <AlertCircle size={40} strokeWidth={3} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">입금을 대기 중입니다!</h1>
              <p className="text-slate-500 text-lg mb-6">아래 계좌로 입금해주시면 예약이 확정됩니다.</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-w-sm mx-auto">
                 <p className="text-xs font-bold text-slate-400 mb-2 uppercase">입금 계좌 정보</p>
                 <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="font-black text-2xl text-slate-900">3333-14-0254739</span>
                    <Copy size={16} className="text-slate-400 cursor-pointer hover:text-black" onClick={() => { navigator.clipboard.writeText('3333140254739'); showToast('계좌번호 복사 완료!', 'success'); }}/>
                 </div>
                 <p className="font-bold text-slate-700">카카오뱅크 (예금주: 로컬리)</p>
                 <p className="text-xs text-rose-500 mt-2 font-bold">* 1시간 내 미입금 시 자동 취소</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-sm">
                <CheckCircle size={40} strokeWidth={3} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">예약이 확정되었습니다!</h1>
              <p className="text-slate-500 text-lg">설레는 여행 준비를 시작해보세요.</p>
            </>
          )}
        </div>

        {/* 2. 예약 정보 카드 */}
        <div className="bg-slate-50 rounded-3xl p-6 md:p-10 border border-slate-100 shadow-sm text-left mb-10 max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6 items-start">
             {/* 이미지 */}
             <div className="w-full md:w-32 h-32 bg-slate-200 rounded-2xl relative overflow-hidden shrink-0 shadow-inner">
                <Image src={booking.experiences?.photos?.[0] || booking.experiences?.image_url} alt="Exp" fill className="object-cover" />
             </div>
             
             {/* 텍스트 정보 */}
             <div className="flex-1 space-y-4 w-full">
                <h3 className="font-bold text-xl text-slate-900 leading-snug">{booking.experiences?.title}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                   <div className="flex items-center gap-3 text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <Calendar className="text-rose-500" size={18}/>
                      <span className="font-bold">{booking.date}</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <Clock className="text-rose-500" size={18}/>
                      <span className="font-bold">{booking.time}</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-600 bg-white p-3 rounded-xl border border-slate-100 md:col-span-2">
                      <MapPin className="text-rose-500" size={18}/>
                      <span className="font-medium line-clamp-1">{booking.experiences?.location}</span>
                   </div>
                </div>
             </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-sm text-slate-500">
                예약번호 <span className="font-mono font-bold text-slate-900 ml-2">{orderId}</span>
             </div>
             <Link href={`/guest/trips`} className="text-sm font-bold text-rose-500 hover:underline flex items-center gap-1">
                예약 상세 내역 보기 <ArrowRight size={14}/>
             </Link>
          </div>
        </div>

        {/* 3. 액션 버튼들 (캘린더, 공유, 홈) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-16">
           <button onClick={handleAddToCalendar} className="flex items-center justify-center gap-2 py-4 px-6 bg-white border border-slate-200 hover:border-black hover:shadow-md rounded-2xl transition-all font-bold text-slate-700">
              <Calendar size={18}/> 캘린더에 추가
           </button>
           <button onClick={handleShare} className="flex items-center justify-center gap-2 py-4 px-6 bg-white border border-slate-200 hover:border-black hover:shadow-md rounded-2xl transition-all font-bold text-slate-700">
              <Share2 size={18}/> 친구에게 공유
           </button>
           <Link href="/" className="flex items-center justify-center gap-2 py-4 px-6 bg-slate-900 text-white hover:bg-black hover:shadow-lg rounded-2xl transition-all font-bold">
              <Home size={18}/> 홈으로 가기
           </Link>
        </div>

        {/* 4. 하단 안내 */}
        <div className="bg-blue-50 text-blue-800 p-6 rounded-2xl text-sm max-w-2xl mx-auto flex items-start gap-3">
           <MessageCircle className="shrink-0 mt-0.5" size={18}/>
           <div className="text-left">
              <p className="font-bold mb-1">호스트에게 메시지를 보내보세요!</p>
              <p className="text-blue-600/80">궁금한 점이 있거나, 미리 알리고 싶은 내용이 있다면 '메시지함'에서 호스트와 대화할 수 있습니다.</p>
              <Link href="/guest/inbox" className="inline-block mt-3 text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                 메시지 보내러 가기 →
              </Link>
           </div>
        </div>

      </main>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
       <PaymentCompleteContent />
    </Suspense>
  );
}
