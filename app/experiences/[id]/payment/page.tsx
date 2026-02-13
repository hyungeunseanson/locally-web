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
  
  // 🟢 [추가] 결제에 필요한 유저 정보 및 약관 동의 상태
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState(''); // 예약 메시지
  const [agreed, setAgreed] = useState(false); // 약관 동의

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  
  // 🟢 [가격 로직]
  // 실제로는 experience.price에서 가져와야 하지만, 예시로 5만원 설정
  const expPrice = experience?.price || 50000; 
  const hostPrice = isPrivate ? (experience?.private_price || 300000) : expPrice * guests;
  const guestFee = hostPrice * 0.1; // 수수료 10%
  const finalAmount = hostPrice + guestFee; 

  useEffect(() => { 
    setMounted(true); 
    const fetchExp = async () => {
      if (!experienceId) return;
      
      // 1. 체험 정보 가져오기
      const { data: expData } = await supabase
        .from('experiences')
        .select('title, image_url, photos, location, price, private_price')
        .eq('id', experienceId)
        .single();
      if (expData) setExperience(expData);

      // 2. 로그인한 유저 정보 미리 채우기
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 프로필 정보가 있다면 가져와서 이름/전화번호 채우기
        const { data: profile } = await supabase.from('profiles').select('name, phone').eq('id', user.id).single();
        if (profile) {
          setCustomerName(profile.name || '');
          setCustomerPhone(profile.phone || '');
        }
      }
    };
    fetchExp();
  }, [experienceId]);

  const handlePayment = async () => {
    if (!agreed) return showToast('필수 약관에 동의해주세요.', 'error');
    if (!customerName || !customerPhone) return showToast('예약자 정보를 입력해주세요.', 'error');
    
    // confirm 대신 바로 진행 (UX상 더 깔끔함)
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        showToast("로그인이 필요합니다.", 'error'); 
        setIsProcessing(false); 
        router.push('/login');
        return; 
      }

      // 1. 주문 ID 생성
      const newOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 🟢 2. [핵심] 결제 전 'PENDING' 상태로 예약 데이터 미리 저장
      const { error: bookingError } = await supabase.from('bookings').insert([
        {
          id: newOrderId, // 주문번호를 ID로 사용
          order_id: newOrderId, // 🟢 [추가] DB의 Not Null 제약조건을 만족시키기 위해 추가
          user_id: user.id,
          experience_id: experienceId,
          amount: finalAmount,         // 게스트가 실제로 낸 총 금액
          total_price: hostPrice,      // 호스트 매출 기준액
          status: 'PENDING',           // 결제 대기 상태
          guests: guests,
          date: date,
          time: time,
          type: isPrivate ? 'private' : 'group',
          // 예약자 정보 및 메시지 저장
          contact_name: customerName,
          contact_phone: customerPhone,
          message: message, 
          created_at: new Date().toISOString()
        }
      ]);

      if (bookingError) {
        console.error(bookingError);
        showToast('예약 데이터 생성 실패. 다시 시도해주세요.', 'error');
        setIsProcessing(false);
        return;
      }

      // 3. 포트원(나이스페이) 결제 요청
      const { IMP } = window as any;
      if (!process.env.NEXT_PUBLIC_PORTONE_IMP_CODE) {
          alert('결제 연동 코드가 설정되지 않았습니다.');
          setIsProcessing(false);
          return;
      }
      IMP.init(process.env.NEXT_PUBLIC_PORTONE_IMP_CODE); 

      const data = {
        pg: 'nice_v2', 
        pay_method: 'card', // 기본값 카드
        merchant_uid: newOrderId, // 위에서 만든 주문번호 사용
        name: experience?.title || 'Locally 체험 예약',
        amount: finalAmount,
        buyer_email: user.email,
        buyer_name: customerName,
        buyer_tel: customerPhone,
        m_redirect_url: `${window.location.origin}/api/payment/nicepay-callback`, 
      };

      IMP.request_pay(data, async (rsp: any) => {
        if (rsp.success) {
           // 4. 결제 성공 -> 서버에 검증 및 상태 업데이트 요청
           const verifyRes = await fetch('/api/payment/nicepay-callback', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(rsp),
           });
           
           if (verifyRes.ok) {
             showToast("결제가 완료되었습니다!", 'success');
             router.push(`/payment/success?orderId=${newOrderId}&amount=${finalAmount}`);
           } else {
             const errData = await verifyRes.json();
             showToast(`결제 완료 처리 실패: ${errData.error}`, 'error');
           }
        } else {
           showToast(`결제 취소/실패: ${rsp.error_msg}`, 'error');
        }
        setIsProcessing(false);
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
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={24}/></button>
          <span className="font-black text-lg">결제하기</span>
        </div>

        <div className="p-6">
          {/* 상품 정보 */}
          <div className="flex gap-5 mb-8">
            <div className="w-24 h-32 relative rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm border border-slate-100">
               <Image 
                 src={imageUrl} 
                 alt="Experience" 
                 fill 
                 className="object-cover" 
                 sizes="100px"
               />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
               <span className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{experience?.location || 'SEOUL'}</span>
               <h3 className="font-bold text-slate-900 leading-snug line-clamp-3 text-lg">{experience?.title || '체험 정보를 불러오는 중...'}</h3>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">예약 정보 확인</h2>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4 mb-6 text-sm text-slate-700 border border-slate-100">
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Calendar size={16}/> 날짜</span><span className="font-bold">{date}</span></div>
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Clock size={16}/> 시간</span><span className="font-bold">{time}</span></div>
             <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><Users size={16}/> 인원</span><span className="font-bold">{guests}명</span></div>
             {isPrivate && <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-2"><ShieldCheck size={16}/> 타입</span><span className="font-bold text-rose-500">프라이빗 투어</span></div>}
          </div>

          {/* 🟢 [추가] 예약자 정보 입력 필드 */}
          <div className="mb-8 space-y-4">
            <h2 className="text-xl font-bold">예약자 정보</h2>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">이름</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors"
                  placeholder="예약자 성함"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">연락처</label>
                <input 
                  type="tel" 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors"
                  placeholder="010-0000-0000"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">호스트에게 남길 메시지 (선택)</label>
                <textarea 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors h-20 resize-none"
                  placeholder="특이사항이나 요청사항이 있다면 적어주세요."
                />
            </div>
          </div>

          {/* 금액 상세 */}
          <div className="px-2 space-y-2 mb-8 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>체험 금액</span>
              <span>₩{hostPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-blue-600">
              <span className="flex items-center gap-1">서비스 수수료 (10%) <Info size={12}/></span>
              <span>+ ₩{guestFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-2 flex justify-between items-center">
              <span className="font-bold text-slate-900">총 결제금액</span>
              <span className="text-3xl font-black text-slate-900">₩{finalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* 🟢 [추가] 약관 동의 */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${agreed ? 'bg-black border-black text-white' : 'border-slate-300 text-transparent'}`}>
                    <CheckCircle2 size={14} />
                </div>
                <input type="checkbox" className="hidden" checked={agreed} onChange={() => setAgreed(!agreed)} />
                <span className="text-sm font-medium text-slate-600">
                    [필수] 구매 조건 및 취소/환불 규정에 동의합니다.
                </span>
            </label>
          </div>

          <button onClick={handlePayment} disabled={isProcessing} className="w-full h-14 rounded-2xl font-bold text-lg bg-black text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100">
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20}/> ₩{finalAmount.toLocaleString()} 결제하기</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense fallback={<div>Loading...</div>}><PaymentContent /></Suspense>;
}