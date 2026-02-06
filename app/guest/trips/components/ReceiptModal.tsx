'use client';

import React from 'react';
import { X, Calendar, Clock, User, MapPin, Phone, CreditCard, Share2, Map, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  trip: any;
  onClose: () => void;
}

export default function ReceiptModal({ trip, onClose }: ReceiptModalProps) {
  if (!trip) return null;

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.address)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative">
        
        {/* 상단: 바코드 및 헤더 */}
        <div className="bg-slate-900 p-6 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
            <X size={20}/>
          </button>
          <div className="font-black text-white text-lg tracking-widest mb-2">LOCALLY TICKET</div>
          
          {/* 바코드 생성 API 연동 (실제 바코드처럼 보임) */}
          <div className="bg-white p-2 rounded mb-2">
            <img 
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${trip.orderId}&scale=2&height=8&includetext`} 
              alt="Barcode" 
              className="w-full h-12 object-contain"
            />
          </div>
          <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Booking Ref: {trip.orderId}</p>
        </div>

        {/* 하단: 상세 내용 */}
        <div className="p-6 bg-white relative">
          {/* 펀치홀 (티켓 느낌) */}
          <div className="absolute -top-3 left-0 w-6 h-6 bg-slate-900 rounded-full"></div>
          <div className="absolute -top-3 right-0 w-6 h-6 bg-slate-900 rounded-full"></div>

          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 leading-tight mb-2">{trip.title}</h2>
            <div 
              onClick={openGoogleMaps}
              className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <MapPin size={14} className="shrink-0 mt-0.5"/>
              <span>{trip.address} <span className="font-bold underline ml-1">지도 보기</span></span>
            </div>
          </div>

          <div className="space-y-3 border-b border-dashed border-slate-200 pb-6 mb-6">
            <InfoRow label="Date" icon={<Calendar size={14}/>} value={trip.date} />
            <InfoRow label="Time" icon={<Clock size={14}/>} value={trip.time} />
            <InfoRow label="Guests" icon={<User size={14}/>} value={`${trip.guests}명 (${trip.isPrivate ? 'Private' : 'Group'})`} />
            <InfoRow label="Booker" icon={<CheckCircle2 size={14}/>} value={trip.userName} />
            
            <div className="pt-2 mt-2 border-t border-slate-100">
              <InfoRow label="Host Contact" icon={<Phone size={14}/>} value={trip.hostPhone} />
            </div>
          </div>

          <div className="flex justify-between items-center mb-6 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
            <span className="font-bold text-sm flex items-center gap-2"><CreditCard size={16}/> Total Paid</span>
            <span className="text-2xl font-black">₩{Number(trip.price).toLocaleString()}</span>
          </div>

          <button className="w-full py-3 bg-slate-100 text-slate-900 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
            <Share2 size={16}/> 티켓 이미지 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// 헬퍼 컴포넌트
function InfoRow({ label, value, icon }: any) {
  return (
    <div className="flex justify-between items-center text-sm">
      <div className="text-slate-400 font-bold text-xs uppercase flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}