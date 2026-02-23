'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Loader2, Calendar, Users, ShieldCheck, Clock, Info, CheckCircle2 } from 'lucide-react';
import Script from 'next/script';
import Image from 'next/image';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [experience, setExperience] = useState<any>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // 🟢 message state는 DB 저장을 위해 남겨두되, 입력란은 삭제했으므로 빈 값으로 유지
  const [message, setMessage] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSafety, setAgreeSafety] = useState(false);
  const [agreeNoOffPlatform, setAgreeNoOffPlatform] = useState(false);
  // 🟢 [추가] 결제 수단 상태 ('card' | 'bank')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';

  const expPrice = experience?.price || 50000;
  const hostPrice = isPrivate ? (experience?.private_price || 300000) : expPrice * guests;
  const guestFee = Math.floor(hostPrice * 0.1);
  const finalAmount = hostPrice + guestFee;

  useEffect(() => {
    setMounted(true);
    const fetchExp = async () => {
      if (!experienceId) return;

      const { data: expData } = await supabase
        .from('experiences')
        // 🟢 [수정] host_id 추가 (알림 발송용)
        .select('title, image_url, photos, location, price, private_price, max_guests, host_id')
        .eq('id', experienceId)
        .maybeSingle();
      if (expData) setExperience(expData);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
        if (profile) {
          setCustomerName(profile.full_name || '');
          setCustomerPhone(profile.phone || '');
        }

        // 🟢 결제 페이지 진입 기록 (퍼널 3단계: 결제 시도)
        if (experienceId) {
          supabase.from('analytics_events').insert([{
            event_type: 'payment_init',
            target_id: experienceId,
            user_id: user.id
          }]).then(({ error }) => {
            if (error) console.error('Payment Init Log Error:', error);
          });
        }
      }
    };
    fetchExp();
  }, [experienceId]);

  // 🟢 [핵심] 가용성 체크 (프라이빗 로직 포함)
  const checkAvailability = async () => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('guests, type')
      .eq('experience_id', experienceId)
      .eq('date', date)
      .eq('time', time)
      .in('status', ['PAID', 'confirmed']);

    const currentBookedCount = bookings?.reduce((sum, b) => sum + (b.guests || 0), 0) || 0;
    const hasPrivateBooking = bookings?.some(b => b.type === 'private');
    const maxGuests = experience?.max_guests || 10;

    // 이미 프라이빗 예약이 있으면 불가
    if (hasPrivateBooking) return false;
    // 내가 프라이빗인데 이미 예약이 있으면 불가
    if (isPrivate && currentBookedCount > 0) return false;
    // 일반 예약 정원 초과 시 불가
    if (!isPrivate && (currentBookedCount + guests > maxGuests)) return false;

    return true;
  };

  const handlePayment = async () => {
    if (!customerName || !customerPhone) return showToast('예약자 정보를 입력해주세요.', 'error');
    if (!agreeTerms || !agreeSafety || !agreeNoOffPlatform) {
      return showToast('모든 필수 안전 및 이용 규정에 동의해주세요.', 'error');
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("로그인이 필요합니다.", 'error');
        setIsProcessing(false);
        router.push('/login');
        return;
      }

      const isAvailable = await checkAvailability();
      if (!isAvailable) {
        alert(isPrivate
          ? '해당 시간대에 이미 다른 예약이 있어 단독 투어 진행이 어렵습니다.'
          : '죄송합니다. 잔여석이 부족하여 예약할 수 없습니다.');
        setIsProcessing(false);
        router.back();
        return;
      }

      // [V3 SECURITY PATCH] 서버 사이드 API 호출로 대체 (결제 금액 계산 및 예약 인서트 보안 위임)
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId,
          date,
          time,
          guests,
          isPrivate,
          customerName,
          customerPhone,
          paymentMethod
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        showToast(result.error || '예약 처리 중 오류가 발생했습니다.', 'error');
        setIsProcessing(false);
        return;
      }

      // 서버가 생성한 안전한 주문번호 및 (위변조 불가능한) 최종 결제 금액 반환받음
      const { newOrderId, finalAmount: secureFinalAmount } = result;

      // 🟢 [수정] 무통장 입금이면 PG사 결제 없이 바로 완료 페이지로 이동
      if (paymentMethod === 'bank') {
        window.location.href = `/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`;
        return;
      }

      // 👇 카드 결제일 때만 실행
      const { IMP } = window as any;
      IMP.init('imp44607000');

      const data = {
        pg: 'nice_v2',
        pay_method: 'card',
        merchant_uid: newOrderId,
        name: experience?.title || 'Locally 체험 예약',
        amount: secureFinalAmount, // 🟢 [보안] 클라이언트 변수가 아닌 서버 통제 금액 사용
        buyer_email: user.email,
        buyer_name: customerName,
        buyer_tel: customerPhone,
        m_redirect_url: `${window.location.origin}/api/payment/nicepay-callback`,
      };

      IMP.request_pay(data, async (rsp: any) => {
        const isSuccess = rsp.success === true || rsp.code === '0' || rsp.status === 'paid' || (rsp.imp_uid && !rsp.error_msg);

        if (isSuccess) {
          try {
            const response = await fetch('/api/payment/nicepay-callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rsp),
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
              alert(`⚠️ 결제 검증 중 오류가 발생했습니다.\n${result.error}`);
              window.location.href = `/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`;
            } else {
              window.location.href = `/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`;
            }
          } catch (err: any) {
            alert(`⚠️ 네트워크 통신 오류: ${err.message}`);
            window.location.href = `/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`;
          }
        } else {
          showToast(`결제 실패: ${rsp.error_msg}`, 'error');
          setIsProcessing(false);
        }
      });

    } catch (error: any) {
      console.error(error);
      showToast('시스템 오류가 발생했습니다.', 'error');
      setIsProcessing(false);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-black" /></div>;
  const imageUrl = experience?.photos?.[0] || experience?.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 font-sans px-4">
      <Script src="https://cdn.iamport.kr/v1/iamport.js" strategy="afterInteractive" />

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <span className="font-black text-lg">결제하기</span>
        </div>

        <div className="p-6">
          <div className="flex gap-5 mb-8">
            <div className="w-24 h-32 relative rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm border border-slate-100">
              <Image src={imageUrl} alt="Experience" fill className="object-cover" sizes="100px" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
              <span className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{experience?.location || 'SEOUL'}</span>
              <h3 className="font-bold text-slate-900 leading-snug line-clamp-3 text-lg">{experience?.title || '로딩 중...'}</h3>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">예약 정보 확인</h2>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4 mb-6 text-sm text-slate-700 border border-slate-100">
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Calendar size={16} /> 날짜</span><span className="font-bold">{date}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Clock size={16} /> 시간</span><span className="font-bold">{time}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Users size={16} /> 인원</span><span className="font-bold">{guests}명</span></div>
            {isPrivate && <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><ShieldCheck size={16} /> 타입</span><span className="font-bold text-rose-500">프라이빗 투어</span></div>}
          </div>

          <div className="mb-8 space-y-4">
            <h2 className="text-xl font-bold">예약자 정보</h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이름</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="예약자 성함" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">연락처</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="010-0000-0000" />
            </div>
            {/* 🟢 [제거 완료] 메시지 입력란 삭제됨 */}
          </div>

          {/* 🟢 [추가] 결제 수단 선택 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">결제 수단</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'card' ? 'border-black bg-slate-50 text-black' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <CreditCard size={24} />
                <span className="font-bold text-sm">카드 결제</span>
              </button>
              <button
                onClick={() => setPaymentMethod('bank')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'bank' ? 'border-black bg-slate-50 text-black' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <div className="flex items-center gap-1"><Users size={24} /><span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1 rounded">추천</span></div>
                <span className="font-bold text-sm">무통장 입금</span>
              </button>
            </div>

            {/* 무통장 선택 시 계좌 안내 */}
            {paymentMethod === 'bank' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in zoom-in-95">
                <p className="text-xs font-bold text-slate-500 mb-1">입금하실 계좌</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-lg text-slate-900">{process.env.NEXT_PUBLIC_BANK_ACCOUNT || '3333-14-0254739'}</span>
                  <span className="text-xs font-bold bg-yellow-300 px-1.5 py-0.5 rounded text-black">{process.env.NEXT_PUBLIC_BANK_NAME || '카카오뱅크'}</span>
                </div>
                <p className="text-xs text-slate-400">
                  * 예약 후 <span className="text-rose-500 font-bold">1시간 이내</span>에 미입금 시 자동 취소됩니다.
                </p>
              </div>
            )}
          </div>

          <div className="px-2 space-y-2 mb-8 text-sm">
            <div className="flex justify-between items-center text-slate-600"><span>체험 금액</span><span>₩{hostPrice.toLocaleString()}</span></div>
            <div className="flex justify-between items-center text-blue-600"><span className="flex items-center gap-1">서비스 수수료 (10%) <Info size={12} /></span><span>+ ₩{guestFee.toLocaleString()}</span></div>
            <div className="border-t border-slate-100 pt-4 mt-2 flex justify-between items-center"><span className="font-bold text-slate-900">총 결제금액</span><span className="text-3xl font-black text-slate-900">₩{finalAmount.toLocaleString()}</span></div>
          </div>

          <div className="mb-6 space-y-3 bg-red-50/50 p-5 rounded-2xl border border-red-100">
            <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-1.5"><ShieldCheck size={16} /> 게스트 안전 필수 동의</h3>

            <label className="flex items-start gap-3 cursor-pointer hover:bg-white/50 p-2 -ml-2 rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[20px] h-5 rounded border flex items-center justify-center transition-colors ${agreeNoOffPlatform ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 size={14} /></div>
              <input type="checkbox" className="hidden" checked={agreeNoOffPlatform} onChange={() => setAgreeNoOffPlatform(!agreeNoOffPlatform)} />
              <div className="text-sm font-medium text-slate-700 leading-snug">
                <span className="text-red-600 font-bold">[필수]</span> 호스트와의 직접 연락 및 플랫폼 외부 결제 유도를 단호히 거부하며, 적발 시 계정 영구 정지 처분에 동의합니다.
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer hover:bg-white/50 p-2 -ml-2 rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[20px] h-5 rounded border flex items-center justify-center transition-colors ${agreeSafety ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 size={14} /></div>
              <input type="checkbox" className="hidden" checked={agreeSafety} onChange={() => setAgreeSafety(!agreeSafety)} />
              <div className="text-sm font-medium text-slate-700 leading-snug">
                <span className="text-red-600 font-bold">[필수]</span> 플랫폼 내 게스트 안전 가이드라인을 숙지하였으며, 상호 존중하는 올바른 호스팅 문화에 기여하겠습니다.
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer hover:bg-white/50 p-2 -ml-2 rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[20px] h-5 rounded border flex items-center justify-center transition-colors ${agreeTerms ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 size={14} /></div>
              <input type="checkbox" className="hidden" checked={agreeTerms} onChange={() => setAgreeTerms(!agreeTerms)} />
              <div className="text-sm font-medium text-slate-700 leading-snug">
                <span className="text-slate-900 font-bold">[필수]</span> 구매 조건, 취소/환불 규정을 모두 확인하였으며 본 플랫폼 서비스 이용 약관에 동의합니다.
              </div>
            </label>
          </div>

          <button onClick={handlePayment} disabled={isProcessing}
            className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100">
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20} /> ₩{finalAmount.toLocaleString()} 결제하기</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense fallback={<div>Loading...</div>}><PaymentContent /></Suspense>;
}