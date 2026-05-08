'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Download, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import { getContent } from '@/app/utils/contentHelper';
import { isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';
import {
  getSoloGuaranteeRefundGuestLabel,
  normalizeSoloGuaranteeRefundStatus,
} from '@/app/utils/soloGuaranteeRefundStatus';

interface ReceiptTrip {
  id: number;
  orderId?: string | number;
  title: string;
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  date: string;
  time: string;
  guests?: number;
  location?: string;
  paymentDate?: string;
  created_at?: string;
  price?: number;
  amount?: number;
  status?: string;
  soloGuaranteeRefundStatus?: string | null;
  soloGuaranteeRefundAmount?: number | null;
  soloGuaranteeRefundedAt?: string | null;
}

export default function ReceiptModal({ trip, onClose }: { trip: ReceiptTrip, onClose: () => void }) {
  const { t, lang } = useLanguage();
  const { showToast } = useToast();

  // 닫힘 애니메이션
  const [closing, setClosing] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptSurfaceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 150);
  }, [closing, onClose]);

  if (!trip) return null;
  const localizedTitle = getContent(trip, 'title', lang) || trip.title;
  const bankInfo = getPublicBankInfo();
  const isPending = isPendingBookingStatus(trip.status || '');
  const soloRefundStatus = normalizeSoloGuaranteeRefundStatus(trip.soloGuaranteeRefundStatus);
  const soloRefundLabel = getSoloGuaranteeRefundGuestLabel(soloRefundStatus, trip.soloGuaranteeRefundAmount);
  const orderDisplay = trip.orderId || String(trip.id || '-').slice(0, 15);
  const guestCount = Number(trip.guests || 1);
  const safeOrderDisplay = String(orderDisplay).replace(/[^a-zA-Z0-9_-]/g, '-');

  // 🟢 [안전 장치] 데이터가 없으면 빈 문자열 처리 (substring 에러 방지)
  const paymentDate = trip.paymentDate || trip.created_at || new Date().toISOString();
  // dateString 처리 시 안전하게
  const safeDate = (dateStr: string) => {
    try {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    } catch { return '-'; }
  };

  const isIosLikeDevice = (() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || touchMac;
  })();

  const handleSaveReceiptImage = async () => {
    if (isSavingImage || !receiptSurfaceRef.current) return;

    setIsSavingImage(true);

    try {
      const dataUrl = await toPng(receiptSurfaceRef.current, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: '#ffffff',
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `locally-receipt-${safeOrderDisplay}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const canShareFile =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            title: `${t('receipt_title')} #${orderDisplay}`,
            files: [file],
          });
          showToast(t('receipt_save_success'), 'success');
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        }
      }

      if (isIosLikeDevice) {
        window.open(dataUrl, '_blank', 'noopener,noreferrer');
        showToast(t('receipt_save_ios_hint'), 'success', { durationMs: 5000 });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      showToast(t('receipt_save_success'), 'success');
    } catch (error) {
      console.error('[ReceiptModal] failed to save receipt image:', error);
      showToast(t('receipt_save_fail'), 'error');
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[210] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-150 ${closing ? 'opacity-0' : 'animate-in fade-in'}`}>
      <div
        data-testid="guest-trip-receipt-modal"
        className={`relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-150 md:max-h-none md:rounded-3xl ${closing ? 'opacity-0 scale-95' : 'animate-in zoom-in-95 duration-200'}`}
      >
        <div className="flex shrink-0 items-center justify-end px-3 pt-3 md:px-4 md:pt-4">
          <button
            data-testid="guest-trip-receipt-close-button"
            onClick={requestClose}
            className="p-1.5 md:p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4 md:w-[18px] md:h-[18px]"/>
          </button>
        </div>

        <div data-testid="guest-trip-receipt-body" className="overflow-y-auto px-3 pb-3 md:px-4 md:pb-4">
          <div
            ref={receiptSurfaceRef}
            data-testid="guest-trip-receipt-surface"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="bg-slate-900 p-4 md:p-6 text-white text-center">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-2.5 md:mb-3 shadow-lg ${isPending ? 'bg-amber-400' : 'bg-green-500'}`}>
                {isPending ? (
                  <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white"/>
                )}
              </div>
              <h2 className="text-[16px] md:text-lg font-bold">{t('receipt_title')}</h2>
              <p className="text-slate-400 text-[11px] md:text-xs mt-1">{safeDate(paymentDate)}</p>
            </div>

            <div className="p-4 md:p-6 space-y-5 md:space-y-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between text-[12px] md:text-sm">
                  <span className="text-slate-500">{t('receipt_order_no')}</span>
                  <span className="font-mono font-bold">{orderDisplay}</span>
                </div>
                <div className="flex justify-between text-[12px] md:text-sm">
                  <span className="text-slate-500">{t('receipt_product_name')}</span>
                  <span className="font-bold text-right w-36 md:w-40 truncate">{localizedTitle}</span>
                </div>
                <div className="flex justify-between text-[12px] md:text-sm">
                  <span className="text-slate-500">{t('receipt_schedule')}</span>
                  <span className="font-bold">{trip.date} {trip.time}</span>
                </div>
                <div className="flex justify-between text-[12px] md:text-sm">
                  <span className="text-slate-500">{t('receipt_guests')}</span>
                  <span className="font-bold">{guestCount}{t('res_gcal_details_persons')}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 my-3 md:my-4"></div>

              {isPending && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left space-y-2">
                  <div>
                    <p className="text-[11px] md:text-xs font-bold text-amber-800">{t('receipt_pending_title')}</p>
                    <p className="mt-1 text-[11px] md:text-xs text-amber-700 leading-relaxed">{t('receipt_pending_desc')}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2.5 border border-amber-100">
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-500 mb-1">{t('pay_complete_bank_info_label')}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-[15px] md:text-base text-slate-900">{bankInfo.account}</span>
                      <span className="text-[10px] font-bold bg-yellow-300 px-1.5 py-0.5 rounded text-black">{bankInfo.bankName}</span>
                    </div>
                    <p className="text-[10px] md:text-[11px] text-slate-600">{t('pay_complete_bank_account_holder_label')}: {bankInfo.accountHolder}</p>
                    <p className="mt-1 text-[10px] md:text-[11px] font-semibold text-rose-500">{t('pay_complete_bank_timeout_hint')}</p>
                  </div>
                  <div
                    data-testid="guest-trip-receipt-pending-followup"
                    className="rounded-lg border border-amber-100 bg-white px-3 py-2.5"
                  >
                    <p className="text-[10px] md:text-[11px] leading-relaxed text-slate-600">
                      {t('receipt_pending_followup')}
                    </p>
                    <Link
                      href="/help"
                      className="mt-2 inline-flex text-[10px] md:text-[11px] font-bold text-amber-800 underline underline-offset-2 transition-colors hover:text-amber-900"
                    >
                      {t('receipt_pending_support_cta')}
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end">
                <span className="text-[13px] md:text-sm font-bold text-slate-900">{t('receipt_amount')}</span>
                <span className="text-[22px] md:text-2xl font-black text-rose-500">₩{Number(trip.price || trip.amount || 0).toLocaleString()}</span>
              </div>

              {soloRefundLabel && (
                <div className={`rounded-xl border px-4 py-3 text-left ${
                  soloRefundStatus === 'refunded'
                    ? 'border-emerald-100 bg-emerald-50'
                    : 'border-orange-100 bg-orange-50'
                }`}>
                  <p className={`text-[11px] md:text-xs font-bold ${
                    soloRefundStatus === 'refunded' ? 'text-emerald-700' : 'text-orange-700'
                  }`}>
                    {soloRefundLabel}
                  </p>
                  {trip.soloGuaranteeRefundedAt && (
                    <p className="mt-1 text-[10px] md:text-[11px] text-slate-500">
                      {safeDate(trip.soloGuaranteeRefundedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-3 pb-3 pt-3 md:px-4 md:pb-4">
          <button
            data-testid="guest-trip-receipt-save-button"
            onClick={handleSaveReceiptImage}
            disabled={isSavingImage}
            className="w-full py-2.5 md:py-3 bg-slate-100 text-slate-600 rounded-lg md:rounded-xl font-bold text-[13px] md:text-sm hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-1.5 md:gap-2 transition-colors"
          >
            {isSavingImage ? (
              <Loader2 className="w-[14px] h-[14px] md:w-4 md:h-4 animate-spin" />
            ) : (
              <Download className="w-[14px] h-[14px] md:w-4 md:h-4" />
            )}
            {t('receipt_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
