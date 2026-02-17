'use client';
import { sendNotification } from '@/app/utils/notification';
import React, { useEffect, useState, Suspense } from 'react';
import { CheckCircle, Home, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client'; // ✅ 핵심 수정: 올바른 클라이언트 사용
import { useToast } from '@/app/context/ToastContext';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const [isSaving, setIsSaving] = useState(true);
  const supabase = createClient();
  const { showToast } = useToast();

  useEffect(() => {
// ... SuccessContent 내부 confirmBooking 함수 수정
// ⬇️ 여기서부터 confirmBooking 함수를 통째로 교체하세요
const confirmBooking = async () => {
  if (!orderId) return;
  
  try {
    // 1. DB 상태 업데이트 및 알림을 보낼 호스트 정보(host_id) 가져오기
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' }) 
      .eq('order_id', orderId)
      .select(`
        *,
        experiences (
          title,
          host_id
        )
      `)
      .single();

    if (error) throw error;
// 2. 업데이트 성공 시 호스트에게 실시간 알림 전송
if (data && data.experiences) {
  await sendNotification({
    userId: data.experiences.host_id, // 알림 대상: 호스트
    type: 'new_booking',
    title: '새로운 예약 확정! 🎉',
    message: `'${data.experiences.title}' 체험에 새로운 예약이 도착했습니다.`,
    link: '/host/dashboard?tab=reservations'
  });
}
} catch (error) {
  console.error('확정 처리 중 오류:', error);
  showToast('예약 확정 처리 중 오류가 발생했어요. 나의 여행에서 확인해주세요.', 'error');
} finally {
  setIsSaving(false);
}
};
    confirmBooking();
  }, [orderId, supabase]); // 의존성 배열에 supabase 추가 권장

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