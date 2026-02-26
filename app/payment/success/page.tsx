'use client';
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [isSaving, setIsSaving] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  useEffect(() => {
    const loadBookingStatus = async () => {
      if (!orderId) {
        setIsSaving(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle();

        if (error) throw error;
        setBookingStatus(data?.status || null);
      } catch (error) {
        console.error('주문 상태 조회 오류:', error);
        showToast('주문 상태를 불러오지 못했습니다. 나의 여행에서 확인해주세요.', 'error');
      } finally {
        setIsSaving(false);
      }
    };

    loadBookingStatus();
  }, [orderId, showToast, supabase]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-black mb-3">
          {bookingStatus === 'PENDING' ? '입금 대기중' : '예약 상태 확인'}
        </h1>
        {isSaving ? (
          <p className="text-slate-500 mb-10">처리 중...</p>
        ) : (
          <p className="text-slate-500 mb-10">
            {bookingStatus === 'PENDING'
              ? '입금 확인 후 자동으로 예약이 확정됩니다.'
              : '결제 검증 상태는 나의 여행에서 확인할 수 있습니다.'}
          </p>
        )}
        
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
