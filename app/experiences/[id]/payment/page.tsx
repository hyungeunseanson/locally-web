'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck, Clock } from 'lucide-react';
import Script from 'next/script';

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams(); // URL path params (id)
  const searchParams = useSearchParams(); // Query params (date, guests...)
  const [mounted, setMounted] = useState(false);

  // URL에서 예약 정보 가져오기
  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  
  // (데모용) 가격 계산 로직 (실제로는 DB에서 가져와야 함)
  const basePrice = 50000; 
  const totalPrice = isPrivate ? 300000 : basePrice * guests;

  // ✅ 실제 로컬리 상점 정보 (관리자 페이지 기반)
  const MID = "FIsonnersm"; 
  const MERCHANT_KEY = "vuoJHUl6YwuOAfpBL+tRt3AEm3LsZ21idVHdvOWEX8AhrVU6vFk2EzjR48mAeDS7VKWeyn1S6fpjq6FKU9KVQQ==";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePayment = () => {
    // 1. 나이스페이 로직 (백엔드 연동 시 사용)
    /*
    const nicepay = (window as any).nicepayStart;
    if (typeof nicepay === 'function') {
      nicepay({
        payMethod: 'CARD',
        orderName: '을지로 노포 투어', // 실제 상품명으로 변경
        price: totalPrice,
        orderId: `LOC_${experienceId}_${Date.now()}`,
        mid: MID,
        merchantKey: MERCHANT_KEY,
        charSet: 'utf-8',
        buyerName: '게스트',
        buyerEmail: 'guest@example.com',
        returnUrl: window.location.origin + '/api/payment/callback', // 백엔드 필요
        m_redirectUrl: window.location.origin + '/api/payment/callback',
      });
    }
    */

    // 2. (데모용) 즉시 완료 페이지로 이동
    // 실제 결제창이 뜨는 느낌을 주기 위해 약간의 딜레이 후 이동
    const confirmPayment = confirm("결제를 진행하시겠습니까?\n(테스트 환경: 확인을 누르면 바로 결제가 완료됩니다.)");
    if (confirmPayment) {
      router.push(`/experiences/${experienceId}/payment/complete?date=${date}&guests=${guests}&amount=${totalPrice}`);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-black" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js" strategy="afterInteractive" />

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* 헤더 */}
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ChevronLeft size={24}/>
          </button>
          <span className="font-black text-lg">예약 및 결제</span>
        </div>

        {/* 상품 요약 정보 */}
        <div className="p-8 border-b border-slate-50">
          <div className="flex gap-2 mb-3">
            <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-full">체험 예약</span>
            {isPrivate && <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full">프라이빗 단독</span>}
          </div>
          <h2 className="text-2xl font-bold mb-6 leading-snug">을지로 노포 투어</h2> {/* 실제 제목 연동 필요 */}
          
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

        {/* 결제 금액 섹션 */}
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
            className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={20}/> 결제하기
          </button>
          
          <p className="mt-6 text-[10px] text-slate-300 leading-tight px-4">
            (주)로컬리는 통신판매중개자로서 통신판매의 당사자가 아니며 상품의 예약, 이용 및 환불 등과 관련한 의무와 책임은 각 판매자에게 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}