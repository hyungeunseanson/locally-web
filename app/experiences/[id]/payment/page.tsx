'use client';

import React, { useEffect, useState, use } from 'react'; // ✅ use 추가
import { useRouter } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users } from 'lucide-react';
import Script from 'next/script';

export default function NicepayPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params); // ✅ params 언래핑
  const experienceId = resolvedParams.id;

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script 
        src="https://web.nicepay.co.kr/v3/webstd/js/nicepay-3.0.js"
        strategy="afterInteractive"
      />

      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden border border-slate-100">
        {/* 헤더 */}
        <div className="h-14 border-b border-slate-100 flex items-center px-4 gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full">
            <ChevronLeft size={20}/>
          </button>
          <span className="font-bold">결제 확인</span>
        </div>

        {/* 상품 요약 정보 */}
        <div className="p-6 border-b border-slate-50">
          <h2 className="text-lg font-bold mb-4">{bookingInfo.title}</h2>
          <div className="space-y-3 text-slate-600 text-sm">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-slate-400" />
              <span>{bookingInfo.date}</span>
            </div>
            <div className="flex items-center gap-3">
              <Users size={16} className="text-slate-400" />
              <span>게스트 {bookingInfo.guests}명</span>
            </div>
          </div>
        </div>

        {/* 결제 금액 섹션 */}
        <div className="p-6 text-center bg-slate-50/50">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CreditCard size={24} />
          </div>
          <p className="text-slate-500 text-sm mb-1">최종 결제 금액</p>
          <div className="text-3xl font-black text-blue-600 mb-6">
            ₩{bookingInfo.totalPrice.toLocaleString()}
          </div>

          <button 
            onClick={handleNicepay}
            className="w-full h-14 rounded-xl font-bold text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all"
          >
            결제하기
          </button>
          <p className="mt-4 text-[11px] text-slate-400 leading-tight">
            버튼을 누르면 나이스페이먼츠 보안 결제창으로 연결됩니다.<br/>
            결제 완료 시 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}