'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProxyRequestValidationSchema, type ProxyRequestPayload } from '@/app/schemas/proxyRequestSchema';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewProxyBooking() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [category, setCategory] = useState<'RESTAURANT' | 'TRANSPORT'>('RESTAURANT');
    const [paymentChannel, setPaymentChannel] = useState<'NAVER' | 'LOCALLY'>('NAVER');
    const [naverBuyerName, setNaverBuyerName] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Restaurant specific
    const [restName, setRestName] = useState('');
    const [restDate, setRestDate] = useState('');
    const [restTime, setRestTime] = useState('');
    const [restGuests, setRestGuests] = useState(1);
    const [restAlternative, setRestAlternative] = useState('');
    const [restSpecial, setRestSpecial] = useState('');

    // Transport specific
    const [transType, setTransType] = useState<'TAXI' | 'BUS' | 'TRAIN'>('TAXI');
    const [transDepart, setTransDepart] = useState('');
    const [transArrival, setTransArrival] = useState('');
    const [transDate, setTransDate] = useState('');
    const [transTime, setTransTime] = useState('');
    const [transPassengers, setTransPassengers] = useState(1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const baseData = {
            agreed_to_terms: agreedToTerms,
            payment_channel: paymentChannel,
            ...(paymentChannel === 'NAVER' ? { naver_buyer_name: naverBuyerName } : {}),
            category_data: category === 'RESTAURANT'
                ? {
                    category: 'RESTAURANT',
                    form_data: {
                        restaurant_name: restName,
                        target_date: restDate,
                        target_time: restTime,
                        guest_number: Number(restGuests),
                        alternative_times: restAlternative || undefined,
                        special_requests: restSpecial || undefined,
                    }
                }
                : {
                    category: 'TRANSPORT',
                    form_data: {
                        transport_type: transType,
                        departure_location: transDepart,
                        arrival_location: transArrival,
                        departure_date: transDate,
                        departure_time: transTime,
                        passenger_number: Number(transPassengers),
                    }
                }
        };

        const validation = ProxyRequestValidationSchema.safeParse(baseData);

        if (!validation.success) {
            const firstError = validation.error.issues[0];
            setError(firstError.message);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/proxy-bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validation.data),
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to submit request');
            }

            // If LOCALLY payment, trigger PG or redirect to payment page
            // Assuming straightforward PG trigger or success page
            router.push(`/proxy-bookings/${data.requestId}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors">
                <ArrowLeft size={16} /> 돌아가기
            </button>

            <h1 className="text-2xl font-bold mb-2">새 전화 대행 요청</h1>
            <p className="text-slate-500 mb-8 text-sm">필요하신 서비스 카테고리를 선택하고 상세 정보를 입력해주세요.</p>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 카테고리 선택 */}
                <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h2 className="font-bold mb-4">서비스 카테고리</h2>
                    <div className="flex gap-4">
                        <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${category === 'RESTAURANT' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" value="RESTAURANT" checked={category === 'RESTAURANT'} onChange={() => setCategory('RESTAURANT')} className="sr-only" />
                            <div className="font-semibold text-sm">식당 예약/확인</div>
                        </label>
                        <label className={`flex-1 p-4 border rounded-xl cursor-pointer transition-colors ${category === 'TRANSPORT' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" value="TRANSPORT" checked={category === 'TRANSPORT'} onChange={() => setCategory('TRANSPORT')} className="sr-only" />
                            <div className="font-semibold text-sm">교통 예매/문의</div>
                        </label>
                    </div>
                </section>

                {/* 동적 폼 영역 */}
                <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h2 className="font-bold mb-4">상세 정보 입력</h2>

                    {category === 'RESTAURANT' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">식당 이름 <span className="text-red-500">*</span></label>
                                <input type="text" required value={restName} onChange={e => setRestName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" placeholder="예: 스시 지로" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">예약 희망 날짜 <span className="text-red-500">*</span></label>
                                <input type="date" required value={restDate} onChange={e => setRestDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">예약 희망 시간 <span className="text-red-500">*</span></label>
                                <input type="time" required value={restTime} onChange={e => setRestTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">대안 시간대</label>
                                <input type="text" value={restAlternative} onChange={e => setRestAlternative(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" placeholder="예: 오후 1시 예약 불가 시 오후 1시 30분 가능" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">방문 인원 <span className="text-red-500">*</span></label>
                                <input type="number" min="1" required value={restGuests} onChange={e => setRestGuests(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">요청 및 특이사항</label>
                                <textarea rows={3} value={restSpecial} onChange={e => setRestSpecial(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none" placeholder="예: 땅콩 알레르기가 있습니다. 생일입니다." />
                            </div>
                        </div>
                    )}

                    {category === 'TRANSPORT' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">수단 <span className="text-red-500">*</span></label>
                                <select value={transType} onChange={e => setTransType(e.target.value as any)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent">
                                    <option value="TAXI">택시/대절</option>
                                    <option value="BUS">버스</option>
                                    <option value="TRAIN">기차</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">출발지 <span className="text-red-500">*</span></label>
                                <input type="text" required value={transDepart} onChange={e => setTransDepart(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="예: 신주쿠역" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">도착지 <span className="text-red-500">*</span></label>
                                <input type="text" required value={transArrival} onChange={e => setTransArrival(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="예: 요코하마역" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">날짜 <span className="text-red-500">*</span></label>
                                <input type="date" required value={transDate} onChange={e => setTransDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600">시간 <span className="text-red-500">*</span></label>
                                <input type="time" required value={transTime} onChange={e => setTransTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600">탑승 인원 <span className="text-red-500">*</span></label>
                                <input type="number" min="1" required value={transPassengers} onChange={e => setTransPassengers(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                            </div>
                        </div>
                    )}
                </section>

                {/* 결제 트랙 */}
                <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h2 className="font-bold mb-4">결제 방식 선택</h2>

                    <div className="flex flex-col gap-3 mb-6">
                        <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentChannel === 'NAVER' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" value="NAVER" checked={paymentChannel === 'NAVER'} onChange={() => setPaymentChannel('NAVER')} className="w-4 h-4 text-green-600" />
                            <div className="flex-1">
                                <div className="font-semibold text-sm">네이버 스마트스토어 결제</div>
                                <div className="text-xs text-slate-500">기존에 스마트스토어로 결제하신 고객님</div>
                            </div>
                        </label>
                        <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentChannel === 'LOCALLY' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" value="LOCALLY" checked={paymentChannel === 'LOCALLY'} onChange={() => setPaymentChannel('LOCALLY')} className="w-4 h-4 text-blue-600" />
                            <div className="flex-1">
                                <div className="font-semibold text-sm">로컬리 웹 자체 결제</div>
                                <div className="text-xs text-slate-500">신용카드 / 토스페이 등 (개발 중 환경)</div>
                            </div>
                        </label>
                    </div>

                    {paymentChannel === 'NAVER' && (
                        <div className="p-4 bg-green-50/50 rounded-xl border border-green-100 space-y-1.5">
                            <label className="text-xs font-semibold text-green-800">스마트스토어 구매자명 <span className="text-red-500">*</span></label>
                            <input type="text" value={naverBuyerName} onChange={e => setNaverBuyerName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="결제 시 입력한 구매자 성함을 입력해주세요." />
                            <p className="text-[11px] text-green-700 mt-1">이탈 방지를 위해 주문번호 14자리 대신 직관적인 구매자 성함으로 대조하고 있습니다.</p>
                        </div>
                    )}
                </section>

                {/* 규정 동의 */}
                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 shrink-0 rounded border-slate-300 text-black focus:ring-black" />
                        <div className="text-sm text-slate-700 leading-relaxed">
                            <span className="font-bold block mb-1">전화 대행 서비스 필수 유의사항에 동의합니다. (필수)</span>
                            0120 번호 등 저희 환경에서 발신 시 수신자 부담 또는 별도 요금이 부과되는 특수 번호, 혹은 통화 연결 지연 및 과정이 복잡한 예약 건의 경우 3,000원의 추가 결제가 요구될 수 있음을 확인했습니다. 또한, 서비스 착수(진행 중 상태) 이후에는 어떠한 경우에도 환불이 불가함을 숙지했습니다.
                        </div>
                    </label>
                </section>

                <button disabled={loading || !agreedToTerms} type="submit" className="w-full bg-black text-white font-bold text-lg py-4 rounded-xl hover:bg-slate-800 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading && <Loader2 size={20} className="animate-spin" />}
                    요청 제출하기
                </button>
            </form>
        </div>
    );
}
