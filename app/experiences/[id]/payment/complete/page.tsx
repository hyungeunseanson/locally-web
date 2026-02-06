'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Home, MapPin, Calendar, User, Download } from 'lucide-react';
import Confetti from 'react-confetti'; // (선택) 폭죽 효과 라이브러리 설치 필요: npm install react-confetti

export default function PaymentCompletePage() {
  const searchParams = useSearchParams();
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const date = searchParams?.get('date') || '2026-10-24';
  const guests = searchParams?.get('guests') || '2';
  const amount = Number(searchParams?.get('amount')) || 0;

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    // 5초 후 폭죽 멈춤
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={200} recycle={false}/>}

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* 상단: 성공 메시지 */}
        <div className="bg-slate-900 text-white p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
            <Check size={40} strokeWidth={4} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black mb-2">예약이 확정되었습니다!</h1>
          <p className="text-slate-400 text-sm">설레는 여행 준비를 시작해보세요.</p>
        </div>

        {/* 영수증 티켓 디자인 */}
        <div className="p-8 bg-white relative">
          {/* 펀치홀 효과 (티켓 느낌) */}
          <div className="absolute -top-3 left-0 w-6 h-6 bg-slate-50 rounded-full"></div>
          <div className="absolute -top-3 right-0 w-6 h-6 bg-slate-50 rounded-full"></div>

          <div className="border-b-2 border-dashed border-slate-100 pb-8 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">을지로 노포 투어</h2>
            <div className="text-sm text-slate-500 flex items-center gap-1"><MapPin size={14}/> 서울특별시 중구 을지로 3가</div>
          </div>

          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 font-bold flex items-center gap-2"><Calendar size={16}/> 날짜</span>
              <span className="text-sm font-bold text-slate-900">{date}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 font-bold flex items-center gap-2"><User size={16}/> 인원</span>
              <span className="text-sm font-bold text-slate-900">게스트 {guests}명</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 font-bold">결제 금액</span>
              <span className="text-xl font-black text-slate-900">₩{amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 flex gap-3">
            <Link href="/guest/trips" className="flex-1">
              <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors">
                나의 여행 보기
              </button>
            </Link>
            <button className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600">
              <Download size={20}/>
            </button>
          </div>
        </div>
      </div>

      <Link href="/" className="mt-8 text-slate-400 text-sm font-bold hover:text-slate-600 flex items-center gap-2 transition-colors">
        <Home size={16}/> 홈으로 돌아가기
      </Link>
    </div>
  );
}