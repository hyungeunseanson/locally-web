'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { CheckCircle, Home, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const [isSaving, setIsSaving] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const confirmBooking = async () => {
      if (!orderId) return;
      
      // ✅ [핵심] 아까 만든 예약을 찾아서 'confirmed'로 상태 업데이트
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' }) 
        .eq('order_id', orderId);

      if (error) {
        console.error('예약 확정 실패:', error);
      }
      // 성공하든 실패하든 로딩 종료 (사용자에게 완료 화면 보여줌)
      setIsSaving(false);
    };

    confirmBooking();
  }, [orderId]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-300">
          <CheckCircle size={48} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-black mb-3 text-slate-900">예약이 확정되었습니다!</h1>
        
        {isSaving ? (
          <p className="text-slate-500 mb-10 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin" size={16}/> 처리 중...
          </p>
        ) : (
          <p className="text-slate-500 mb-10">설레는 여행이 기다리고 있어요.<br/>호스트가 곧 확인 연락을 드릴 예정입니다.</p>
        )}
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left border border-slate-100">
          <div className="flex justify-between mb-3">
            <span className="text-slate-500 text-sm">예약 번호</span>
            <span className="font-mono font-bold text-slate-900">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 text-sm">결제 금액</span>
            <span className="font-bold text-blue-600">₩{Number(amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/" className="flex-1">
            <button className="w-full py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <Home size={18}/> 홈으로
            </button>
          </Link>
          <Link href="/guest/trips" className="flex-1">
            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <FileText size={18}/> 내 여행 보기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div>}>
      <SuccessContent />
    </Suspense>
  );
}