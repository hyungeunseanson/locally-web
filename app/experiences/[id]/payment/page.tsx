'use client';

import React, { useEffect, useState } from 'react'; // 'use' 제거
import { useRouter } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck } from 'lucide-react';
import Script from 'next/script';

// params 타입을 직접 지정하여 use() 없이 사용 가능하도록 변경
export default function NicepayPaymentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const experienceId = params.id; 

  const [mounted, setMounted] = useState(false);
  
  // ✅ 실제 로컬리 상점 정보 (관리자 페이지 기반)
  const MID = "FIsonnersm"; 
  const MERCHANT_KEY = "vuoJHUl6YwuOAfpBL+tRt3AEm3LsZ21idVHdvOWEX8AhrVU6vFk2EzjR48mAeDS7VKWeyn1S6fpjq6FKU9KVQQ==";

  // 예약 데이터 (실제로는 이전 페이지에서 넘겨받거나 DB에서 가져와야 함)
  const bookingInfo = {
    title: "도쿄 시부야 이자카야 탐방",
    date: "2026-10-24",
    guests: 2,
    totalPrice: 170000
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNicepay = () => {
    const nicepay = (window as any).nicepayStart;
    
    if (typeof nicepay !== 'function') {
      alert("결제 모듈 로딩 중입니다. 잠시 후 다시 시도하거나 새로고침 해주세요.");
      return;
    }

    nicepay({
      payMethod: 'CARD',
      orderName: bookingInfo.title,
      price: bookingInfo.totalPrice,
      orderId: `LOC_${experienceId.substring(0,4)}_${new Date().getTime()}`,
      mid: MID,
      merchantKey: MERCHANT_KEY,
      charSet: 'utf-8',
      buyerName: '게스트',
      buyerEmail: 'customer@example.com',
      returnUrl: window.location.origin + '/api/payment/nicepay-callback',
      m_redirectUrl: window.location.origin + '/api/payment/nicepay-callback',
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script 
        src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js"
        strategy="afterInteractive"
      />

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* 헤더 */}
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ChevronLeft size={24}/>
          </button>
          <span className="font-black text-lg">결제 확인</span>
        </div>

        {/* 상품 요약 정보 */}
        <div className="p-8 border-b border-slate-50">
          <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-full mb-2 inline-block">체험 예약</span>
          <h2 className="text-xl font-bold mb-6 leading-snug">{bookingInfo.title}</h2>
          
          <div className="space-y-4 text-slate-700 text-sm bg-slate-50 p-5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Calendar size={16}/></div>
              <span className="font-semibold">{bookingInfo.date}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Users size={16}/></div>
              <span className="font-semibold">게스트 {bookingInfo.guests}명</span>
            </div>
          </div>
        </div>

        {/* 결제 금액 섹션 */}
        <div className="p-8 text-center bg-white">
          <p className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Total Payment</p>
          <div className="text-4xl font-black text-slate-900 mb-8">
            ₩{bookingInfo.totalPrice.toLocaleString()}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-8 bg-slate-50 py-2 rounded-lg">
             <ShieldCheck size={14}/> 안전 결제 시스템으로 보호됩니다
          </div>

          <button 
            onClick={handleNicepay}
            className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={20}/> 결제하기
          </button>
          
          <p className="mt-6 text-[10px] text-slate-300 leading-tight">
            (주)로컬리는 통신판매중개자로서 통신판매의 당사자가 아니며 상품의 예약, 이용 및 환불 등과 관련한 의무와 책임은 각 판매자에게 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}