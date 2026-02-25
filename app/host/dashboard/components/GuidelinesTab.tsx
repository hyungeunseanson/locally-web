import React from 'react';
import { Lock, User, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function GuidelinesTab() {
    return (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-1">

            {/* 히어로 배너 */}
            <div className="bg-slate-900 text-white px-5 py-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="relative z-10">
                    <span className="bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] mb-2 inline-block">필수 준수</span>
                    <h1 className="text-[16px] font-black mb-1.5">호스트 파트너 가이드라인</h1>
                    <p className="text-slate-300 text-[11px] leading-relaxed">로컬리는 호스트님과 게스트의 안전하고 투명한 연결을 최우선으로 생각합니다. 원활한 호스팅을 위해 반드시 아래 규정을 숙지해 주시기 바랍니다.</p>
                </div>
            </div>

            {/* 정책 카드들 */}
            <div className="space-y-3">

                {/* Policy 1 */}
                <div className="bg-white px-4 py-4 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                    <h2 className="text-[13px] font-bold flex items-center gap-1.5 mb-2.5 text-slate-900">
                        <Lock className="text-rose-500 shrink-0" size={14} /> 1. 플랫폼 외부 결제 및 우회 거래 금지
                    </h2>
                    <div className="text-slate-600 space-y-2 text-[11px] leading-relaxed">
                        <p className="font-medium text-slate-800 bg-rose-50 px-3 py-2 rounded-xl">
                            개인 계좌번호 안내나 타 플랫폼 결제 유도는 <strong>어떠한 경우에도 엄격히 금지</strong>됩니다.
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>예약 확정 전 외부 연락망(카카오톡, 이메일 등) 교환 금지</li>
                            <li>체험 현장에서 미결제 인원에 대한 추가 현금 결제 요구 금지</li>
                            <li>적발 즉시 <strong>계정 영구 정지 및 매출액 정산 보류</strong> 가능</li>
                        </ul>
                    </div>
                </div>

                {/* Policy 2 */}
                <div className="bg-white px-4 py-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <h2 className="text-[13px] font-bold flex items-center gap-1.5 mb-2.5 text-slate-900">
                        <User className="text-blue-500 shrink-0" size={14} /> 2. 게스트 응대 및 예약 이행 규정
                    </h2>
                    <div className="text-slate-600 space-y-2 text-[11px] leading-relaxed">
                        <p className="font-medium text-slate-800 bg-blue-50 px-3 py-2 rounded-xl">
                            책임감 있는 예약 이행은 신뢰의 기본입니다.
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>불가피한 취소 시 최소 24시간 전 게스트에게 사유 설명 필요</li>
                            <li>게스트 문의에 신속하고 친절하게 답변 의무 (응답률 지표 반영)</li>
                            <li><strong>무단 노쇼 3회 누적 시</strong> 패널티 부과</li>
                        </ul>
                    </div>
                </div>

                {/* Policy 3 */}
                <div className="bg-white px-4 py-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                    <h2 className="text-[13px] font-bold flex items-center gap-1.5 mb-2.5 text-slate-900">
                        <ShieldCheck className="text-green-500 shrink-0" size={14} /> 3. 상호 안전 및 존중 규정
                    </h2>
                    <div className="text-slate-600 space-y-2 text-[11px] leading-relaxed">
                        <p className="font-medium text-slate-800 bg-green-50 px-3 py-2 rounded-xl">
                            어떠한 형태의 차별이나 혐오 발언도 일절 허용되지 않습니다.
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>국적, 성별, 장애, 종교를 이유로 한 차별적 언행 절대 금지</li>
                            <li>체험 시 게스트 안전을 위한 Safety Briefing 진행 의무</li>
                            <li>응급 상황 발생 시 즉시 119 및 플랫폼 지원 센터로 연락</li>
                        </ul>
                    </div>
                </div>

            </div>

            {/* 푸터 */}
            <div className="text-center bg-slate-50 py-5 rounded-2xl border border-slate-100">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm border border-slate-200">
                    <CheckCircle2 className="text-slate-800" size={18} />
                </div>
                <p className="text-[11px] text-slate-500 font-bold mb-0.5">안전한 로컬 문화를 함께 만들어갑니다</p>
                <p className="text-[10px] text-slate-400">Locally Trust & Safety Team</p>
            </div>

        </div>
    );
}
