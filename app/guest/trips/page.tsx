'use client';

import React from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, 
  CheckCircle2, ChevronRight, Receipt 
} from 'lucide-react';
import Link from 'next/link';

export default function GuestTripsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      
      {/* 1. Navbar */}
      <header className="h-20 border-b border-slate-100 flex items-center px-6 sticky top-0 bg-white z-50">
        <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
          <Link href="/" className="font-black text-xl tracking-tighter">Locally</Link>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
             <span className="font-bold text-sm">JM</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 2. Upcoming Trips (Hero Card) */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6">예정된 예약</h2>
          
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row">
            {/* Left: Info */}
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                   <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">D-3</span>
                   <button className="text-slate-400 hover:text-black"><MoreHorizontal/></button>
                </div>
                <h3 className="text-2xl font-bold mb-2">현지인과 함께하는 시부야 이자카야 탐방</h3>
                <p className="text-slate-500 mb-6">호스트: Kenji</p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Calendar className="text-slate-400" size={20}/>
                    <span className="font-semibold">2026년 10월 24일 (토) 19:00</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin className="text-slate-400" size={20}/>
                    <span className="font-semibold">시부야역 하치코 동상 앞</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-8 border-t border-slate-100">
              <Link href="/guest/inbox" className="flex-1">
  <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
    <MessageSquare size={16}/> 호스트에게 메시지
  </button>
</Link>
                <button className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                  <Receipt size={16}/> 영수증 보기
                </button>
              </div>
            </div>

            {/* Right: Map/Image */}
            <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
               <img src="https://images.unsplash.com/photo-1542051841857-5f90071e7989" className="w-full h-full object-cover"/>
               <div className="absolute inset-0 bg-black/10"></div>
            </div>
          </div>
        </section>

        {/* 3. Past Trips (List) */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <TripCard 
              image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e"
              title="기모노 입고 다도 체험"
              date="2025년 12월"
              host="Sakura"
            />
             <TripCard 
              image="https://images.unsplash.com/photo-1551632811-561732d1e306"
              title="홋카이도 설국 스키 레슨"
              date="2025년 1월"
              host="Yuki"
            />
             <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer min-h-[300px]">
               <span className="font-bold mb-1">다음 여행을 떠나보세요</span>
               <Link href="/" className="text-sm underline text-black">체험 둘러보기</Link>
             </div>

          </div>
        </section>

      </main>
    </div>
  );
}

function TripCard({ image, title, date, host }: any) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      <div className="aspect-[4/3] bg-slate-100 relative">
        <img src={image} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"/>
      </div>
      <div className="p-4">
        <h4 className="font-bold text-lg mb-1 truncate">{title}</h4>
        <p className="text-xs text-slate-500 mb-2">{date} · {host}</p>
        <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
          <CheckCircle2 size={12}/> 이용 완료
        </div>
      </div>
    </div>
  );
}