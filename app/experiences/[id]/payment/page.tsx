'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck, Clock, Info } from 'lucide-react';
import Script from 'next/script';
import Image from 'next/image';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [experience, setExperience] = useState<any>(null);

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  
  // 🟢 [가격 로직 수정]
  const basePrice = 50000; 
  const hostPrice = isPrivate ? 300000 : basePrice * guests; // 호스트가 설정한 원가
  const guestFee = hostPrice * 0.1; // 게스트에게 부과하는 수수료 10%
  const finalAmount = hostPrice + guestFee; // 게스트가 실제로 결제할 총액

  useEffect(() => { 
    setMounted(true); 
    const fetchExp = async () => {
      if (!experienceId) return;
      const { data } = await supabase
        .from('experiences')
        .select('title, image_url, photos, location')
        .eq('id', experienceId)
        .single();
      if (data) setExperience(data);
    };
    fetchExp();
  }, [experienceId]);

  const handlePayment = async () => {
    if (!confirm(`총 ₩${finalAmount.toLocaleString()}원을 결제하시겠습니까?`)) return;
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        showToast("로그인이 필요합니다.", 'error'); 
        setIsProcessing(false); 
        return; 
      }

      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 🟢 [DB 저장 로직 수정]
      const { error } = await supabase.from('bookings').insert([{
        experience_id: experienceId,
        user_id: user.id,
        date: date,
        time: time,
        guests: guests,
        total_price: hostPrice,      // 20% 떼기 전 호스트의 매출 기준액
        amount: finalAmount,         // 게스트가 실제로 낸 총 금액
        status: 'pending',
        type: isPrivate ? 'private' : 'group',
        order_id: orderId,
        created_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      showToast("결제가 완료되었습니다!", 'success');
      router.push(`/payment/success?orderId=${orderId}&amount=${finalAmount}`);

    } catch (error: any) {
      showToast(`결제 실패: ${error.message}`, 'error');
      setIsProcessing(false);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-black" /></div>;

  const imageUrl = experience?.photos?.[0] || experience?.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js" strategy="afterInteractive" />
      
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={24}/></button>
          <span className="font-black text-lg">결제하기</span>
        </div>

        <div className="p-6">
          <div className="flex gap-5 mb-8">
            <div className="w-24 h-32 relative rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm border border-slate-100">
               <Image 
                 src={imageUrl} 
                 alt="Experience" 
                 fill 
                 className="object-cover" 
                 sizes="100px"
               />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
               <span className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{experience?.location || 'SEOUL'}</span>
               <h3 className="font-bold text-slate-900 leading-snug line-clamp-3 text-lg">{experience?.title || '체험 정보를 불러오는 중...'}</h3>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">예약 정보 확인</h2>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4 mb-6 text-sm text-slate-700 border border-slate-100">
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Calendar size={16}/> 날짜</span><span className="font-bold">{date}</span></div>
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Clock size={16}/> 시간</span><span className="font-bold">{time}</span></div>
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Users size={16}/> 인원</span><span className="font-bold">{guests}명</span></div>
             {isPrivate && <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><ShieldCheck size={16}/> 타입</span><span className="font-bold text-rose-500">프라이빗 투어</span></div>}
          </div>

          {/* 🟢 [수정] 금액 상세 표기 추가 */}
          <div className="px-2 space-y-2 mb-8 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>체험 금액</span>
              <span>₩{hostPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-blue-600">
              <span className="flex items-center gap-1">서비스 수수료 (10%) <Info size={12}/></span>
              <span>+ ₩{guestFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-2 flex justify-between items-center">
              <span className="font-bold text-slate-900">총 결제금액</span>
              <span className="text-3xl font-black text-slate-900">₩{finalAmount.toLocaleString()}</span>
            </div>
          </div>

          <button onClick={handlePayment} disabled={isProcessing} className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-[0.98]">
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20}/> 결제하기</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense fallback={<div>Loading...</div>}><PaymentContent /></Suspense>;
}