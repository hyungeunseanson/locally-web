'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CreditCard, Info } from 'lucide-react';

interface RefundInfo {
  percent: number;
  amount: number;
  reason: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isProcessing: boolean;
  refundInfo: RefundInfo; // 🟢 추가됨
}

export default function CancellationModal({ isOpen, onClose, onConfirm, isProcessing, refundInfo }: Props) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-4">
      <div className="bg-white rounded-xl md:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* 헤더 */}
        <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-[16px] md:text-lg text-slate-800">예약 취소 요청</h3>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-[18px] h-[18px] md:w-5 md:h-5 text-slate-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 md:p-6 space-y-5 md:space-y-6">
          
          {/* 🟢 [핵심] 예상 환불 금액 카드 */}
          <div className={`border rounded-lg md:rounded-xl p-4 md:p-5 text-center ${refundInfo.amount > 0 ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[11px] md:text-xs font-bold text-slate-500 uppercase mb-1">예상 환불 금액</div>
            <div className={`text-[26px] md:text-3xl font-black mb-2 ${refundInfo.amount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
              ₩{refundInfo.amount.toLocaleString()}
            </div>
            <div className="inline-block px-2.5 md:px-3 py-1 bg-white rounded-full text-[11px] md:text-xs font-bold shadow-sm border border-slate-100">
              환불율: <span className={refundInfo.percent === 100 ? 'text-green-600' : 'text-red-500'}>{refundInfo.percent}%</span>
            </div>
            <p className="text-[10px] md:text-[11px] text-slate-500 mt-2.5 md:mt-3 flex items-center justify-center gap-1">
              <Info className="w-[11px] h-[11px] md:w-3 md:h-3"/> {refundInfo.reason}
            </p>
          </div>

          {/* 환불 규정 안내 (간략화) */}
          <div className="text-[11px] md:text-xs text-slate-500 bg-slate-50 p-2.5 md:p-3 rounded-lg border border-slate-100 space-y-1">
             <div className="font-bold flex items-center gap-1 text-slate-700"><AlertTriangle className="w-[11px] h-[11px] md:w-3 md:h-3"/> 취소 규정 요약</div>
             <p>• 7일 전: 100% / 3일 전: 50% / 당일: 불가</p>
             <p>• 결제 후 24시간 이내(투어 1일 전까지): 100%</p>
          </div>

          {/* 취소 사유 입력 */}
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[13px] md:text-sm font-bold text-slate-700">취소 사유를 입력해주세요</label>
            <textarea 
              className="w-full border border-slate-300 rounded-lg md:rounded-xl p-2.5 md:p-3 text-[13px] md:text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
              rows={3}
              placeholder="예: 개인 사정이 생겨서 참여가 어렵습니다."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 md:p-5 border-t border-slate-100 flex gap-2.5 md:gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl border border-slate-200 font-bold text-[13px] md:text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            닫기
          </button>
          <button 
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isProcessing}
            className={`flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-[13px] md:text-sm text-white transition-all ${!reason.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'}`}
          >
            {isProcessing ? '처리 중...' : '취소 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}
