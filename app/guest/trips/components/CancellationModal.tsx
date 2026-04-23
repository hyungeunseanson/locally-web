'use client';

import React, { useState } from 'react';
import { useModalClose } from '@/app/hooks/useModalClose';
import { X, AlertTriangle, Info } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import type { GuestTripCancelReasonCode } from '@/app/utils/api/trips';

interface RefundInfo {
  percent: number;
  amount: number;
  reason: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { reasonCode: GuestTripCancelReasonCode; reason: string }) => void;
  isProcessing: boolean;
  refundInfo: RefundInfo; // 🟢 추가됨
  fullRefundAmount: number;
  onContactHost: () => void;
}

export default function CancellationModal({ isOpen, onClose, onConfirm, isProcessing, refundInfo, fullRefundAmount, onContactHost }: Props) {
  const { visible, closing, requestClose } = useModalClose(isOpen, onClose);
  const { t } = useLanguage();
  const [reasonCode, setReasonCode] = useState<GuestTripCancelReasonCode>('personal_change');
  const [reason, setReason] = useState('');
  const [hasAcknowledgedFollowup, setHasAcknowledgedFollowup] = useState(false);

  if (!visible) return null;

  const isHostUnavailable = reasonCode === 'host_unavailable';
  const isMinimumParticipantsUnmet = reasonCode === 'minimum_participants_unmet';
  const isReviewReason = isHostUnavailable || isMinimumParticipantsUnmet;
  const isOtherReason = reasonCode === 'other';
  const resolvedRefundInfo = isReviewReason
    ? {
      percent: 100,
      amount: fullRefundAmount,
      reason: isMinimumParticipantsUnmet
        ? t('modal_cancel_minimum_participants_unmet_refund')
        : t('modal_cancel_host_unavailable_refund'),
    }
    : refundInfo;
  const reasonRequired = isOtherReason;
  const confirmDisabled = !hasAcknowledgedFollowup || (reasonRequired && !reason.trim()) || isProcessing;

  return (
    <div
      data-testid="guest-trip-cancel-modal"
      className={`fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-4 transition-opacity duration-150 ${closing ? 'opacity-0' : 'animate-in fade-in duration-200'}`}
    >
      <div
        data-testid="guest-trip-cancel-dialog"
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl transition-all duration-150 md:max-h-[90dvh] md:rounded-2xl ${closing ? 'opacity-0 scale-95' : 'animate-in fade-in zoom-in duration-200'}`}
      >
        
        {/* 헤더 */}
        <div className="shrink-0 p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-[16px] md:text-lg text-slate-800">{t('modal_cancel_title')}</h3>
          <button
            data-testid="guest-trip-cancel-close-button"
            onClick={requestClose}
            className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-[18px] h-[18px] md:w-5 md:h-5 text-slate-500" />
          </button>
        </div>

        {/* 본문 */}
        <div
          data-testid="guest-trip-cancel-body"
          className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6 space-y-5 md:space-y-6"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          
          {/* 🟢 [핵심] 예상 환불 금액 카드 */}
          <div className={`border rounded-lg md:rounded-xl p-4 md:p-5 text-center ${resolvedRefundInfo.amount > 0 ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[11px] md:text-xs font-bold text-slate-500 uppercase mb-1">{t('modal_cancel_expected_refund')}</div>
            <div className={`text-[26px] md:text-3xl font-black mb-2 ${resolvedRefundInfo.amount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
              ₩{resolvedRefundInfo.amount.toLocaleString()}
            </div>
            <div className="inline-block px-2.5 md:px-3 py-1 bg-white rounded-full text-[11px] md:text-xs font-bold shadow-sm border border-slate-100">
              {t('modal_cancel_refund_rate')} <span className={resolvedRefundInfo.percent === 100 ? 'text-green-600' : 'text-red-500'}>{resolvedRefundInfo.percent}%</span>
            </div>
            <p className="text-[10px] md:text-[11px] text-slate-500 mt-2.5 md:mt-3 flex items-center justify-center gap-1">
              <Info className="w-[11px] h-[11px] md:w-3 md:h-3"/> {resolvedRefundInfo.reason}
            </p>
          </div>

          {/* 환불 규정 안내 (실제 계산 규칙과 동일하게 유지) */}
          <div className="text-[11px] md:text-xs text-slate-500 bg-slate-50 p-2.5 md:p-3 rounded-lg border border-slate-100 space-y-1">
             <div className="font-bold flex items-center gap-1 text-slate-700"><AlertTriangle className="w-[11px] h-[11px] md:w-3 md:h-3"/> {t('modal_cancel_policy_summary')}</div>
             <p>{t('modal_cancel_policy_1')}</p>
             <p>{t('modal_cancel_policy_2')}</p>
             <p>{t('modal_cancel_policy_3')}</p>
             <p>{t('modal_cancel_policy_4')}</p>
          </div>

          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[13px] md:text-sm font-bold text-slate-700">{t('modal_cancel_reason_type_label')}</label>
            <select
              className="w-full border border-slate-300 rounded-lg md:rounded-xl p-2.5 md:p-3 text-[13px] md:text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-white"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as GuestTripCancelReasonCode)}
            >
              <option value="personal_change">{t('modal_cancel_reason_option_personal_change')}</option>
              <option value="schedule_issue">{t('modal_cancel_reason_option_schedule_issue')}</option>
              <option value="host_unavailable">{t('modal_cancel_reason_option_host_unavailable')}</option>
              <option value="minimum_participants_unmet">{t('modal_cancel_reason_option_minimum_participants_unmet')}</option>
              <option value="other">{t('modal_cancel_reason_option_other')}</option>
            </select>
            {isHostUnavailable && (
              <p className="text-[11px] text-orange-600 leading-5">
                {t('modal_cancel_host_unavailable_hint')}
              </p>
            )}
            {isMinimumParticipantsUnmet && (
              <p className="text-[11px] text-orange-600 leading-5">
                {t('modal_cancel_minimum_participants_unmet_hint')}
              </p>
            )}
          </div>

          {/* 취소 사유 입력 */}
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[13px] md:text-sm font-bold text-slate-700">
              {t('modal_cancel_reason_detail_label')}
            </label>
            <textarea 
              className="w-full border border-slate-300 rounded-lg md:rounded-xl p-2.5 md:p-3 text-[13px] md:text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
              rows={3}
              placeholder={t('modal_cancel_reason_placeholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div
            data-testid="guest-trip-cancel-followup"
            className={`rounded-lg border px-3.5 py-3 text-left ${isReviewReason ? 'border-orange-100 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <p className={`text-[11px] md:text-xs font-bold ${isReviewReason ? 'text-orange-800' : 'text-slate-700'}`}>
              {t('modal_cancel_followup_title')}
            </p>
            <p className={`mt-1 text-[11px] leading-5 ${isReviewReason ? 'text-orange-700' : 'text-slate-500'}`}>
              {t('modal_cancel_followup_desc')}
            </p>
            <p className={`mt-1 text-[11px] leading-5 ${isReviewReason ? 'text-orange-700' : 'text-slate-500'}`}>
              {t('modal_cancel_refund_account_support_note')}
            </p>
            <label
              data-testid="guest-trip-cancel-acknowledge-label"
              className={`mt-3 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                isReviewReason
                  ? 'border-orange-200 bg-white/70 hover:bg-white'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                data-testid="guest-trip-cancel-acknowledge-checkbox"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                checked={hasAcknowledgedFollowup}
                onChange={(e) => setHasAcknowledgedFollowup(e.target.checked)}
              />
              <span className={`text-[11px] leading-5 ${isReviewReason ? 'text-orange-800' : 'text-slate-700'}`}>
                {t('modal_cancel_followup_acknowledge')}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={onContactHost}
            className="text-[12px] md:text-sm font-semibold text-slate-600 underline underline-offset-4 transition-colors hover:text-slate-900"
          >
            {t('modal_cancel_contact_host_cta')}
          </button>
        </div>

        {/* 하단 버튼 */}
        <div className="shrink-0 p-4 md:p-5 border-t border-slate-100 flex gap-2.5 md:gap-3 bg-slate-50">
          <button
            onClick={requestClose}
            className="flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl border border-slate-200 font-bold text-[13px] md:text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t('button_close')}
          </button>
          <button 
            onClick={() => onConfirm({ reasonCode, reason: reason.trim() })}
            disabled={confirmDisabled}
            className={`flex-1 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-[13px] md:text-sm text-white transition-all ${confirmDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'}`}
          >
            {isProcessing ? t('status_processing') : t('button_confirm_cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
