'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, Clock3, CreditCard, Loader2, MapPin, MessageCircle, ShieldCheck, Users, XCircle } from 'lucide-react';

import SiteHeader from '@/app/components/SiteHeader';
import Spinner from '@/app/components/ui/Spinner';
import { getServiceRequestStatusLabel, isPendingPaymentServiceRequest } from '@/app/constants/serviceStatus';
import { useLanguage, type Locale } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import type { ServiceBooking, ServiceRequest, ServiceScheduleItem } from '@/app/types/service';
import { getServicePricingReasonLabel, getServiceTypeLabel } from '@/app/utils/services/concierge';
import { createClient } from '@/app/utils/supabase/client';

type SafeRequest = Omit<ServiceRequest, 'user_id' | 'selected_host_id' | 'hourly_rate_host' | 'total_host_payout'> & {
  viewerRole: 'owner' | 'host';
  schedule: ServiceScheduleItem[];
  booking: Pick<ServiceBooking, 'id' | 'order_id' | 'amount' | 'status' | 'payment_method' | 'refund_amount' | 'host_compensation_amount'> | null;
  supportInquiryId: string | null;
  hostInquiryId: string | null;
};

const COPY: Record<Locale, {
  notFound: string; goTrips: string; progress: string; steps: string[]; assigning: string;
  cancelling: string; region: string; guestsType: string; hours: string; payment: string;
  schedule: string; details: string; continuePayment: string; support: string; hostChat: string;
  recovering: string; guestsUnit: string; hoursUnit: string; back: string;
  cancel: string; cancelTitle: string; cancelDescription: string; cancelReason: string;
}> = {
  ko: { notFound: '신청 내역을 찾을 수 없거나 접근 권한이 없습니다.', goTrips: '내 맞춤 서비스로 이동', progress: '진행 상태', steps: ['결제 확인', '현지 담당자 확인·배정', '호스트 연결', '서비스 완료'], assigning: '결제가 확인되었습니다. 현지 담당자가 신청 내용을 검토하고 적합한 호스트를 섭외하고 있습니다.', cancelling: '취소 요청이 접수되었습니다. 현지 담당자가 환불 금액과 호스트 보상 여부를 확인하고 있습니다.', region: '이용 지역', guestsType: '이용 인원·서비스', hours: '전체 이용 시간', payment: '결제 금액', schedule: '이용 일정', details: '요청 사항', continuePayment: '결제 계속하기', support: '현지 담당자에게 1:1 문의', hostChat: '호스트와 대화', recovering: '결제 확인 정보를 복구하고 있습니다. 잠시 후 새로고침하거나 고객센터에 문의해 주세요.', guestsUnit: '명', hoursUnit: '시간', back: '이전 화면으로', cancel: '취소 요청', cancelTitle: '맞춤 서비스 취소', cancelDescription: '결제 전 신청은 즉시 취소됩니다. 결제 후에는 호스트 배정 여부와 결제 수단에 따라 환불 또는 현지 담당자 확인이 진행됩니다.', cancelReason: '고객 요청 취소' },
  en: { notFound: 'This request was not found or you do not have access.', goTrips: 'Go to my trips', progress: 'Progress', steps: ['Payment', 'Local coordinator review', 'Host connection', 'Completed'], assigning: 'Payment is confirmed. Your local coordinator is reviewing the request and arranging a suitable host.', cancelling: 'Your cancellation request is under review, including the refund and any host compensation.', region: 'Location', guestsType: 'Guests · type', hours: 'Total time', payment: 'Payment', schedule: 'Schedule', details: 'Request details', continuePayment: 'Continue payment', support: 'Chat with local coordinator', hostChat: 'Chat with host', recovering: 'We are restoring your payment confirmation. Refresh shortly or contact support.', guestsUnit: ' guests', hoursUnit: ' hours', back: 'Back', cancel: 'Request cancellation', cancelTitle: 'Cancel custom service', cancelDescription: 'Unpaid requests are cancelled immediately. Paid requests are refunded or reviewed based on assignment and payment status.', cancelReason: 'Customer requested cancellation' },
  ja: { notFound: '申請が見つからないか、アクセス権限がありません。', goTrips: 'マイトリップへ', progress: '進行状況', steps: ['決済', '現地担当者確認・手配', 'ホスト連絡', 'サービス完了'], assigning: '決済を確認しました。現地担当者が内容を確認し、ホストを手配しています。', cancelling: 'キャンセル申請を受け付け、返金とホスト補償の有無を確認しています。', region: '地域', guestsType: '人数・種別', hours: '合計利用時間', payment: '決済金額', schedule: '利用日程', details: '依頼内容', continuePayment: '決済を続ける', support: '現地担当者に1:1で相談', hostChat: 'ホストと連絡', recovering: '決済確認情報を復旧しています。しばらくしてから更新するか、サポートへお問い合わせください。', guestsUnit: '名', hoursUnit: '時間', back: '戻る', cancel: 'キャンセル申請', cancelTitle: 'カスタムサービスのキャンセル', cancelDescription: '決済前はすぐにキャンセルされます。決済後は手配状況と決済方法に応じて返金または現地担当者の確認を行います。', cancelReason: 'お客様によるキャンセル申請' },
  zh: { notFound: '未找到该申请或您没有访问权限。', goTrips: '前往我的旅行', progress: '进度', steps: ['付款', '当地负责人确认安排', '联系向导', '服务完成'], assigning: '已确认付款。当地负责人正在审核需求并安排合适的向导。', cancelling: '取消申请已受理，当地负责人正在审核退款及向导补偿。', region: '地区', guestsType: '人数·类型', hours: '总时长', payment: '付款金额', schedule: '服务日程', details: '需求内容', continuePayment: '继续付款', support: '一对一咨询当地负责人', hostChat: '联系向导', recovering: '正在恢复付款确认信息。请稍后刷新或联系客服。', guestsUnit: '人', hoursUnit: '小时', back: '返回', cancel: '申请取消', cancelTitle: '取消定制服务', cancelDescription: '未付款申请将立即取消。付款后将根据安排状态和付款方式进行退款或由当地负责人审核。', cancelReason: '客户申请取消' },
};

const CUSTOMER_CHAT_COPY: Record<Locale, string> = {
  ko: '고객과 대화',
  en: 'Chat with customer',
  ja: 'お客様と連絡',
  zh: '联系客户',
};

export default function ServiceRequestClient() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const copy = COPY[lang];
  const [request, setRequest] = useState<SafeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const cancellationKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(`/services/${requestId}`)}`);
        return;
      }
      const response = await fetch(`/api/services/requests?requestId=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!active) return;
      if (response.ok && result.success && result.data) setRequest(result.data as SafeRequest);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [requestId, router, supabase]);

  if (loading) return <div className="min-h-screen bg-white"><SiteHeader /><div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div></div>;
  if (!request) return <div className="flex min-h-screen flex-col items-center justify-center gap-4"><p className="text-sm text-slate-500">{copy.notFound}</p><Link className="text-sm font-bold underline" href="/guest/trips#custom-services">{copy.goTrips}</Link></div>;

  const isOwner = request.viewerRole === 'owner';
  const canContactSupport = isOwner && Boolean(request.supportInquiryId);
  const canContactHost = Boolean(request.hostInquiryId);
  const canCancel = isOwner && Boolean(request.booking) && ['PENDING', 'PAID', 'confirmed'].includes(request.booking?.status || '') && !['completed', 'cancelled', 'cancellation_requested'].includes(request.status);
  const steps = copy.steps;
  const displayTitle = `${request.city} · ${getServiceTypeLabel(request.service_type, lang)} · ${request.service_date}`;
  const activeStep = request.status === 'pending_payment' ? 0 : request.status === 'assigning' || request.status === 'open' ? 1 : request.status === 'matched' || request.status === 'confirmed' || request.status === 'paid' ? 2 : 3;

  const handleCancel = () => {
    if (!request.booking) return;
    requestConfirm({ title: copy.cancelTitle, description: copy.cancelDescription, confirmLabel: copy.cancel, tone: 'red' }, async () => {
      setCancelling(true);
      cancellationKey.current ||= `customer-ui:${crypto.randomUUID()}`;
      try {
        const response = await fetch('/api/services/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: request.booking?.order_id, cancel_reason: copy.cancelReason, idempotency_key: cancellationKey.current }),
        });
        const result = await response.json() as { success?: boolean; status?: ServiceRequest['status']; message?: string; error?: string; code?: string };
        if (result.status === 'cancelled' || result.status === 'cancellation_requested') {
          setRequest((current) => current ? { ...current, status: result.status as ServiceRequest['status'], booking: current.booking ? { ...current.booking, status: result.status as ServiceBooking['status'] } : null } : current);
        }
        if (!response.ok || !result.success) {
          showToast(result.error || 'Cancellation failed', 'error');
          return;
        }
        showToast(result.message || copy.cancel, 'success');
      } catch {
        showToast('Cancellation failed', 'error');
      } finally {
        setCancelling(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-8 pb-28 md:px-8 md:py-12">
        <header className="border-b border-zinc-200 pb-8">
          <button type="button" aria-label={copy.back} onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-950"><ChevronLeft size={15} />{copy.back}</button>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><h1 className="min-w-0 truncate text-2xl font-semibold tracking-[-0.025em] md:text-3xl">{displayTitle}</h1><span className="inline-flex rounded-md bg-zinc-950 px-3 py-1.5 text-[11px] font-medium text-white">{getServiceRequestStatusLabel(request.status, lang)}</span></div>
        </header>

        <section className="border-b border-zinc-200 py-8">
          <p className="text-xs font-medium tracking-wide text-zinc-500">{copy.progress}</p>
          <div className="mt-5 grid grid-cols-4 gap-1">{steps.map((step, index) => <div key={step} className="text-center"><div className={`mx-auto h-1 ${index <= activeStep ? 'bg-zinc-950' : 'bg-zinc-200'}`} /><p className={`mt-2 text-[10px] font-medium leading-4 ${index === activeStep ? 'text-zinc-950' : 'text-zinc-400'}`}>{step}</p></div>)}</div>
          {request.status === 'assigning' && <p className="mt-5 rounded-md bg-zinc-100 p-4 text-sm font-medium leading-6 text-zinc-800">{copy.assigning}</p>}
          {request.status === 'cancellation_requested' && <p className="mt-5 rounded-md border border-zinc-300 p-4 text-sm font-medium leading-6 text-zinc-800">{copy.cancelling}</p>}
        </section>

        <section className="border-b border-zinc-200 py-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={MapPin} label={copy.region} value={`Japan · ${request.city}`} />
            <Info icon={Users} label={copy.guestsType} value={`${request.guest_count}${copy.guestsUnit} · ${getServiceTypeLabel(request.service_type, lang)}`} />
            <Info icon={Clock3} label={copy.hours} value={`${request.duration_hours}${copy.hoursUnit}`} />
            <Info icon={CreditCard} label={copy.payment} value={`₩${request.total_customer_price.toLocaleString()} (${getServicePricingReasonLabel(request.pricing_reason, lang)})`} />
          </div>
          <div className="mt-7 border-t border-zinc-200 pt-6"><p className="text-xs font-medium text-zinc-500">{copy.schedule}</p><div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">{request.schedule.map((item) => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2 font-medium"><CalendarDays size={15} />{item.serviceDate}</span><span>{item.startTime} · {item.durationHours}h</span></div>)}</div></div>
          <div className="mt-7 border-t border-zinc-200 pt-6"><p className="text-xs font-medium text-zinc-500">{copy.details}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{request.description}</p></div>
        </section>

        <section className="grid gap-3 py-6 sm:grid-cols-2">
          {isOwner && isPendingPaymentServiceRequest(request.status) && <button type="button" onClick={() => router.push(`/services/${requestId}/payment`)} className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white"><CreditCard size={16} />{copy.continuePayment}</button>}
          {canContactSupport && <button type="button" onClick={() => router.push(`/guest/inbox?inquiryId=${request.supportInquiryId}`)} className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white"><MessageCircle size={16} />{copy.support}</button>}
          {canContactHost && <button type="button" onClick={() => router.push(isOwner ? `/guest/inbox?inquiryId=${request.hostInquiryId}` : `/host/dashboard?tab=inquiries&inquiryId=${request.hostInquiryId}`)} className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold"><MessageCircle size={16} />{isOwner ? copy.hostChat : CUSTOMER_CHAT_COPY[lang]}</button>}
          {canCancel && <button type="button" disabled={cancelling} onClick={handleCancel} className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-700 disabled:opacity-50">{cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}{copy.cancel}</button>}
        </section>
        {isOwner && !isPendingPaymentServiceRequest(request.status) && !canContactSupport && <div className="mt-2 flex items-start gap-2 rounded-md bg-zinc-100 p-4 text-xs font-medium leading-5 text-zinc-700"><ShieldCheck className="mt-0.5 shrink-0" size={16} />{copy.recovering}</div>}
      </main>
      {ConfirmDialogElement}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="border-t border-zinc-200 py-4"><p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"><Icon size={13} />{label}</p><p className="mt-2 text-sm font-semibold leading-6">{value}</p></div>;
}
