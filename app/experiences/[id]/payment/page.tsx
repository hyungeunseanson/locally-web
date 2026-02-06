'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck, Clock } from 'lucide-react';
import Script from 'next/script';
import { createClient } from '@/app/utils/supabase/client'; // ✅ 올바른 클라이언트 사용

function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  
  const basePrice = 50000; 
  const totalPrice = isPrivate ? 300000 : basePrice * guests;

  useEffect(() => { setMounted(true); }, []);

  const handlePayment = async () => {
    if (!confirm("결제를 진행하시겠습니까?")) return;
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("로그인이 필요합니다."); setIsProcessing(false); return; }

      // 1. 주문 번호 생성
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 2. ✅ 결제 전 DB에 'Pending' 상태로 미리 저장 (데이터 유실 방지)
      const { error } = await supabase.from('bookings').insert([{
        experience_id: experienceId,
        user_id: user.id,
        date: date,
        time: time,
        guests: guests,
        total_price: totalPrice,
        amount: totalPrice,
        status: 'pending',
        type: isPrivate ? 'private' : 'group',
        order_id: orderId,
        created_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      // 3. 성공 시 완료 페이지로 이동
      router.push(`/payment/success?orderId=${orderId}&amount=${totalPrice}`);

    } catch (error: any) {
      alert(`오류 발생: ${error.message}`);
      setIsProcessing(false);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-black" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js" strategy="afterInteractive" />
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={24}/></button>
          <span className="font-black text-lg">결제하기</span>
        </div>
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6">체험 예약</h2>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-3 mb-8 text-sm text-slate-700">
             <div className="flex justify-between"><span className="text-slate-500">날짜</span><span className="font-bold">{date}</span></div>
             <div className="flex justify-between"><span className="text-slate-500">시간</span><span className="font-bold">{time}</span></div>
             <div className="flex justify-between"><span className="text-slate-500">인원</span><span className="font-bold">{guests}명</span></div>
          </div>
          <div className="flex justify-between items-center mb-8">
            <span className="font-bold text-slate-500">총 결제금액</span>
            <span className="text-3xl font-black text-slate-900">₩{totalPrice.toLocaleString()}</span>
          </div>
          <button onClick={handlePayment} disabled={isProcessing} className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
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