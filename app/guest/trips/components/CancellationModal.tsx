'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isProcessing: boolean;
}

export default function CancellationModal({ isOpen, onClose, onConfirm, isProcessing }: Props) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">예약 취소 요청</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          
          {/* 환불 규정 안내 박스 */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-3 text-sm text-orange-800">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <p className="font-bold">취소 전 환불 규정을 확인하세요.</p>
              <ul className="list-disc pl-4 text-xs space-y-1 opacity-90">
                <li>체험 7일 전: 100% 환불</li>
                <li>체험 3일 전: 50% 환불</li>
                <li>당일 취소: 환불 불가</li>
              </ul>
              <p className="text-xs mt-2 font-medium">* 호스트가 취소 요청을 승인하면 환불이 진행됩니다.</p>
            </div>
          </div>

          {/* 취소 사유 입력 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">취소 사유를 입력해주세요</label>
            <textarea 
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
              rows={4}
              placeholder="예: 개인 사정이 생겨서 참여가 어렵습니다."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            닫기
          </button>
          <button 
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isProcessing}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${!reason.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'}`}
          >
            {isProcessing ? '처리 중...' : '취소 요청하기'}
          </button>
        </div>
      </div>
    </div>
  );
}