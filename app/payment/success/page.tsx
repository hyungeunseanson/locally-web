'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, Home, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase'; // ✅ Supabase 가져오기

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const [isSaving, setIsSaving] = useState(true);

  useEffect(() => {
    const saveBooking = async () => {
      if (!orderId || !amount) return;

      // 1. 현재 로그인한 유저 확인
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 2. 장부(DB)에 기록하기
        const { error } = await supabase
          .from('bookings')
          .insert([
            {
              user_id: user.id,
              amount: Number(amount),
              order_id: orderId,
              status: 'PAID'
            }
          ]);
        
        if (error) console.error('예약 저장 실패:', error);
      }
      setIsSaving(false);
    };

    saveBooking();
  }, [orderId, amount]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        
        <h1 className="text-2xl font-black mb-2">결제가 완료되었습니다!</h1>
        
        {isSaving ? (
          <p className="text-slate-500 mb-8 flex justify-center items-center gap-2">
            <Loader2 size={16} className="animate-spin"/> 예약 정보를 저장 중입니다...
          </p>
        ) : (
          <p className="text-slate-500 mb-8">예약이 확정되었습니다.<br/>호스트가 곧 연락드릴 예정입니다.</p>
        )}

        <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">주문 번호</span>
            <span className="font-mono font-bold truncate max-w-[150px]">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">결제 금액</span>
            <span className="font-bold text-blue-600">
              {Number(amount).toLocaleString()}원
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/" className="flex-1">
            <button className="w-full py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
              <Home size={18}/> 홈으로
            </button>
          </Link>
          <Link href="/guest/trips" className="flex-1">
            <button className="w-full py-3 bg-black text-white rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2">
              <FileText size={18}/> 내 여행 보기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}