'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck, Clock } from 'lucide-react';
import Script from 'next/script';
import { createClient } from '@/app/utils/supabase/client';

function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // URL 파라미터 안전하게 가져오기
  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  
  const basePrice = 50000; 
  const totalPrice = isPrivate ? 300000 : basePrice * guests;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePayment = async () => {
    if (!confirm("결제를 진행하시겠습니까?")) return;

    setIsProcessing(true);

    try {
      // 1. 로그인 체크
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert("로그인이 필요한 서비스입니다.");
        setIsProcessing(false);
        return;
      }

      // 2. 주문 번호 생성
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 3. [핵심] 결제 전 DB에 'Pending(대기)' 상태로 미리 저장
      // 이렇게 해야 날짜, 인원수 등 중요 정보가 DB에 확실히 남습니다.
      const { error } = await supabase.from('bookings').insert([{
        experience_id: experienceId,
        user_id: user.id,
        date: date,
        time: time,
        guests: guests,
        total_price: totalPrice,
        amount: totalPrice,
        status: 'pending', // 아직 결제 전이므로 대기 상태
        type: isPrivate ? 'private' : 'group',
        order_id: orderId,
        created_at: new Date().toISOString(),
      }]);

      if (error) {
        console.error('예약 생성 실패:', error);
        throw error;
      }

      // 4. 저장 성공 시 완료 페이지로 이동 (orderId만 넘기면 됨)
      // 실제 PG사 연동 시에는 여기서 결제창을 호출합니다.
      router.push(`/payment/success?orderId=${orderId}&amount=${totalPrice}`);

    } catch (error: any) {
      alert(`결제 준비 중 오류가 발생했습니다.\n${error.message}`);
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-black" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js" strategy="afterInteractive" />

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ChevronLeft size={24}/>
          </button>
          <span className="font-black text-lg">예약 및 결제</span>
        </div>

        <div className="p-8 border-b border-slate-50">
          <div className="flex gap-2 mb-3">
            <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-full">즉시 예약</span>
            {isPrivate && <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full">프라이빗 단독</span>}
          </div>
          <h2 className="text-2xl font-bold mb-6 leading-snug">체험 예약</h2>
          
          <div className="space-y-3 text-slate-700 text-sm bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Calendar size={16}/></div>
              <span className="font-semibold">{date}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Clock size={16}/></div>
              <span className="font-semibold">{time}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Users size={16}/></div>
              <span className="font-semibold">게스트 {guests}명</span>
            </div>
          </div>
        </div>

        <div className="p-8 text-center bg-white">
          <p className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Total Payment</p>
          <div className="text-4xl font-black text-slate-900 mb-8 tracking-tight">
            ₩{totalPrice.toLocaleString()}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-8 bg-slate-50 py-2.5 rounded-xl border border-slate-100">
             <ShieldCheck size={14} className="text-green-600"/> 안전 결제 시스템으로 보호됩니다
          </div>

          <button 
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20}/> 결제하기</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩중...</div>}>
      <PaymentContent />
    </Suspense>
  );
}