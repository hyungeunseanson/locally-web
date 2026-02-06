'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { CheckCircle, Home, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client'; // ✅ 핵심 수정: 올바른 클라이언트 사용

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const [isSaving, setIsSaving] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const confirmBooking = async () => {
      if (!orderId) return;
      
      // ✅ Insert가 아니라 Update를 사용 (데이터 유실 방지)
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' }) 
        .eq('order_id', orderId);

      if (error) console.error('확정 실패:', error);
      setIsSaving(false);
    };
    confirmBooking();
  }, [orderId]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-black mb-3">예약 확정!</h1>
        {isSaving ? <p className="text-slate-500 mb-10">처리 중...</p> : <p className="text-slate-500 mb-10">설레는 여행이 확정되었습니다.</p>}
        
        <div className="flex gap-3">
          <Link href="/" className="flex-1"><button className="w-full py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">홈으로</button></Link>
          <Link href="/guest/trips" className="flex-1"><button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">나의 여행 보기</button></Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return <Suspense fallback={<div>Loading...</div>}><SuccessContent /></Suspense>;
}