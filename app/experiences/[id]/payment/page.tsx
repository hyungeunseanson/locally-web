'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import { Calendar, Clock, Users, CreditCard, ShieldCheck, MessageSquare, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import Skeleton from '@/app/components/ui/Skeleton';

// 🟢 [보완] 실제 결제 로직이 포함된 컴포넌트
function PaymentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const experienceId = params.id as string;
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const guests = Number(searchParams.get('guests')) || 1;
  const type = searchParams.get('type');
  const isPrivate = type === 'private';

  const [experience, setExperience] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 🟢 입력 폼 상태
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('로그인이 필요합니다.', 'error');
        router.push(`/login?redirect=/experiences/${experienceId}`);
        return;
      }
      setUser(user);
      
      const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();
      if (profile) {
        setCustomerName(profile.full_name || '');
        setCustomerPhone(profile.phone || '');
      }

      const { data: exp, error } = await supabase.from('experiences').select('*').eq('id', experienceId).single();
      if (error || !exp) {
        showToast('체험 정보를 불러올 수 없습니다.', 'error');
        router.back();
        return;
      }
      setExperience(exp);
      setLoading(false);
    };
    fetchData();
  }, [experienceId, supabase, router, showToast]);

  // 🟢 [가격 로직 수정] DB 가격 기반 계산
  const basePrice = isPrivate ? Number(experience?.private_price || 0) : Number(experience?.price || 0);
  const hostPrice = isPrivate ? basePrice : basePrice * guests; 
  // 🟢 [정책] 수수료 10% 추가 (호스트는 20% 수수료지만, 여기서는 고객이 내는 돈 계산)
  // 기획에 따라 '고객 수수료'를 별도로 받는지, '포함'인지 결정해야 합니다.
  // 아까 대화에서 "플랫폼 수수료 10% 고객에게 수취"라고 하셨으므로 10%를 더합니다.
  const guestFee = hostPrice * 0.1; 
  const totalPrice = hostPrice + guestFee;

  const handlePayment = async () => {
    if (!agreed) return showToast('필수 약관에 동의해주세요.', 'error');
    if (!customerName || !customerPhone) return showToast('예약자 정보를 입력해주세요.', 'error');
    
    setIsProcessing(true);

    try {
      // 1. 주문 ID 생성
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 2. 포트원 결제 요청 (실제 결제창 띄우기)
      const { IMP } = window as any;
      // 🚨 주의: .env 파일에 NEXT_PUBLIC_PORTONE_IMP_CODE 가 있어야 합니다.
      if (!process.env.NEXT_PUBLIC_PORTONE_IMP_CODE) {
          alert('결제 연동 코드가 설정되지 않았습니다. (관리자 문의)');
          setIsProcessing(false);
          return;
      }
      IMP.init(process.env.NEXT_PUBLIC_PORTONE_IMP_CODE); 

      const data = {
        pg: 'nice_v2', 
        pay_method: paymentMethod,
        merchant_uid: orderId,
        name: experience.title,
        amount: totalPrice,
        buyer_email: user.email,
        buyer_name: customerName,
        buyer_tel: customerPhone,
        m_redirect_url: `${window.location.origin}/api/payment/nicepay-callback`, 
        custom_data: {  // 🟢 중요: 결제 완료 후 서버가 이 데이터를 보고 DB에 저장함
            experienceId, 
            date, 
            time, 
            guests, 
            userId: user.id,
            message,
            type: isPrivate ? 'private' : 'group',
            hostPrice, // 정산용 원가
            guestFee,  // 수수료
            totalPrice // 총 결제액
        }
      };

      IMP.request_pay(data, async (rsp: any) => {
        if (rsp.success) {
           // 3. 결제 성공 -> 서버 검증
           const verifyRes = await fetch('/api/payment/nicepay-callback', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(rsp),
           });
           
           if (verifyRes.ok) {
             router.push(`/experiences/${experienceId}/payment/complete?orderId=${orderId}`);
           } else {
             const errData = await verifyRes.json();
             showToast(`결제 검증 실패: ${errData.error}`, 'error');
           }
        } else {
           showToast(`결제 취소/실패: ${rsp.error_msg}`, 'error');
        }
        setIsProcessing(false);
      });

    } catch (error: any) {
      console.error(error);
      showToast('결제 시스템 오류가 발생했습니다.', 'error');
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-12">
         <div className="md:col-span-2 space-y-6">
           <Skeleton className="h-12 w-1/2"/>
           <Skeleton className="h-64 w-full rounded-2xl"/>
         </div>
         <Skeleton className="h-96 w-full rounded-2xl"/>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <SiteHeader />
      {/* 포트원 스크립트 로드 */}
      <script src="https://cdn.iamport.kr/v1/iamport.js"></script>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-2">
           <ChevronDown className="rotate-90 text-slate-400 cursor-pointer hover:text-black" onClick={() => router.back()}/>
           예약 및 결제
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16">
          
          {/* 🟢 좌측: 입력 폼 영역 */}
          <div className="md:col-span-2 space-y-10">
            
            {/* 1. 예약자 정보 */}
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users size={20}/> 예약자 정보</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-sm font-bold text-slate-500 mb-2">이름</label>
                   <input 
                     type="text" 
                     value={customerName} 
                     onChange={(e) => setCustomerName(e.target.value)}
                     className="w-full border border-slate-200 rounded-xl px-4 py-3 font-medium focus:border-black focus:ring-0 transition-colors"
                     placeholder="실명 입력"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-500 mb-2">연락처</label>
                   <input 
                     type="tel" 
                     value={customerPhone} 
                     onChange={(e) => setCustomerPhone(e.target.value)}
                     className="w-full border border-slate-200 rounded-xl px-4 py-3 font-medium focus:border-black focus:ring-0 transition-colors"
                     placeholder="010-0000-0000"
                   />
                 </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">* 예약 확정 알림이 위 연락처로 전송됩니다.</p>
            </section>

            {/* 2. 호스트 요청사항 */}
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><MessageSquare size={20}/> 호스트에게 메시지 (선택)</h2>
               <textarea 
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[120px] focus:border-black focus:ring-0 transition-colors resize-none"
                 placeholder="알러지, 특별한 요청사항, 기념일 등 호스트가 알아야 할 내용을 적어주세요."
               />
            </section>

            {/* 3. 결제 수단 */}
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard size={20}/> 결제 수단</h2>
               <div className="grid grid-cols-3 gap-4">
                  <button onClick={() => setPaymentMethod('card')} className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${paymentMethod === 'card' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 hover:border-slate-300'}`}>
                     <span>신용/체크카드</span>
                  </button>
                  <button onClick={() => setPaymentMethod('trans')} className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${paymentMethod === 'trans' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 hover:border-slate-300'}`}>
                     <span>실시간 계좌이체</span>
                  </button>
                  <button onClick={() => setPaymentMethod('vbank')} className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${paymentMethod === 'vbank' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 hover:border-slate-300'}`}>
                     <span>무통장입금</span>
                  </button>
               </div>
            </section>

            {/* 4. 환불 정책 */}
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowRefundPolicy(!showRefundPolicy)}>
                 <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20}/> 취소 및 환불 정책</h2>
                 {showRefundPolicy ? <ChevronUp/> : <ChevronDown/>}
               </div>
               
               {showRefundPolicy && (
                 <div className="mt-6 space-y-3 text-sm text-slate-600 bg-slate-50 p-6 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <p className="flex justify-between"><span>체험 7일 전까지</span> <span className="font-bold text-slate-900">100% 환불</span></p>
                    <p className="flex justify-between"><span>체험 3일 전까지</span> <span className="font-bold text-slate-900">50% 환불</span></p>
                    <p className="flex justify-between"><span>체험 1일 전 ~ 당일</span> <span className="font-bold text-red-500">환불 불가</span></p>
                 </div>
               )}
            </section>

          </div>

          {/* 🟢 우측: 예약 요약 및 결제 버튼 (Sticky) */}
          <div className="relative">
             <div className="sticky top-28 space-y-6">
                
                {/* 요약 카드 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg">
                   <div className="flex gap-4 mb-6">
                      <div className="w-20 h-20 bg-slate-100 rounded-xl relative overflow-hidden shrink-0">
                         {experience?.photos?.[0] || experience?.image_url ? (
                             <Image src={experience.photos?.[0] || experience.image_url} alt="Thumbnail" fill className="object-cover" />
                         ) : <div className="bg-slate-200 w-full h-full"/>}
                      </div>
                      <div>
                         <div className="text-xs font-bold text-slate-400 mb-1">{experience?.category || '체험'}</div>
                         <h3 className="font-bold text-slate-900 line-clamp-2 leading-tight">{experience?.title}</h3>
                      </div>
                   </div>

                   <div className="space-y-4 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-3 text-sm">
                         <Calendar className="text-slate-400" size={16}/>
                         <span className="font-medium text-slate-700">{date} ({new Date(date || '').toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                         <Clock className="text-slate-400" size={16}/>
                         <span className="font-medium text-slate-700">{time}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                         <Users className="text-slate-400" size={16}/>
                         <span className="font-medium text-slate-700">게스트 {guests}명 {isPrivate && '(단독)'}</span>
                      </div>
                   </div>

                   {/* 🟢 가격 상세 내역 */}
                   <div className="border-t border-slate-100 mt-6 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>체험 금액 ({isPrivate ? '팀' : `${guests}인`})</span>
                        <span>₩{hostPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>서비스 수수료 (10%)</span>
                        <span>+ ₩{guestFee.toLocaleString()}</span>
                      </div>
                   </div>

                   <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between items-center">
                      <span className="text-slate-500 text-sm">총 합계</span>
                      <span className="text-xl font-black text-slate-900">₩{totalPrice.toLocaleString()}</span>
                   </div>
                </div>

                {/* 약관 동의 및 버튼 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                   <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-all ${agreed ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'}`}>
                         {agreed && <CheckIcon />}
                      </div>
                      <input type="checkbox" className="hidden" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                      <span className="text-xs text-slate-500 leading-snug select-none">
                         <span className="font-bold text-slate-900">필수 약관에 동의합니다.</span><br/>
                         서비스 이용약관, 취소 및 환불 정책, 개인정보 제3자 제공 동의 (호스트 제공)
                      </span>
                   </label>
                </div>

                <button 
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-rose-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                   {isProcessing ? <Loader2 className="animate-spin" /> : `₩${totalPrice.toLocaleString()} 결제하기`}
                </button>
                
                <p className="text-center text-[10px] text-slate-400">
                   안전한 결제를 위해 포트원(KG이니시스/나이스페이) 보안 모듈이 작동합니다.
                </p>

             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

// 🟢 [필수] Suspense로 감싸기 (searchParams 사용 시 필수)
export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <PaymentContent />
    </Suspense>
  );
}