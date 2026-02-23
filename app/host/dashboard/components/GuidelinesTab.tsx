import React from 'react';
import { ShieldCheck, Lock, User, AlertTriangle, CheckCircle2, FileText, Anchor } from 'lucide-react';

export default function GuidelinesTab() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

            <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="relative z-10">
                    <span className="bg-rose-500 text-white font-bold px-3 py-1 rounded-full text-xs mb-4 inline-block">필수 준수</span>
                    <h1 className="text-3xl font-black mb-3">호스트 파트너 가이드라인</h1>
                    <p className="text-slate-300 max-w-lg leading-relaxed text-sm">로컬리는 호스트님과 게스트의 안전하고 투명한 연결을 최우선으로 생각합니다. 원활한 호스팅을 위해 반드시 아래 규정을 숙지해 주시기 바랍니다.</p>
                </div>
            </div>

            <div className="space-y-6">

                {/* Policy 1 */}
                <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
                    <div className="absolute top-0 left-0 w-2 h-full bg-rose-500"></div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900">
                        <Lock className="text-rose-500" size={24} /> 1. 플랫폼 외부 결제 및 우회 거래 금지
                    </h2>
                    <div className="text-slate-600 space-y-4 text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-rose-50 p-4 rounded-xl">
                            수수료를 회피하기 위해 게스트에게 개인 계좌번호를 안내하거나, 타 플랫폼으로 결제를 유도하는 행위는 <strong>어떠한 경우에도 엄격히 금지</strong>됩니다.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>예약 확정 전 외부 연락망(카카오톡, 이메일, 전화번호 등) 교환 금지</li>
                            <li>체험 현장에서 미결제 인원에 대한 추가 현금 결제 요구 금지</li>
                            <li>적발 즉시 <strong>계정 영구 정지 처분 및 관련 매출액 정산이 보류</strong>될 수 있습니다.</li>
                        </ul>
                    </div>
                </div>

                {/* Policy 2 */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-slate-300 transition-colors">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900">
                        <User className="text-blue-500" size={24} /> 2. 게스트 응대 및 예약 이행 규정
                    </h2>
                    <div className="text-slate-600 space-y-4 text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-blue-50 p-4 rounded-xl">
                            책임감 있는 예약 이행은 신뢰의 기본입니다. 무단 노쇼 및 임의 취소는 호스트 평판에 치명적입니다.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>불가피한 사정으로 예약 취소 시, 최소 24시간 전 게스트에게 충분한 사유를 설명하고 양해를 구해야 합니다.</li>
                            <li>게스트의 문의 채널 개설 시, 신속하고 친절하게 답변할 의무가 있습니다 (응답률 지표 반영).</li>
                            <li><strong>무단 노쇼 적발 시:</strong> 당월 호스트 우수 등급에서 배제되며, 3회 누적 시 패널티가 부과됩니다.</li>
                        </ul>
                    </div>
                </div>

                {/* Policy 3 */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-slate-300 transition-colors">
                    <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900">
                        <ShieldCheck className="text-green-500" size={24} /> 3. 상호 안전 및 존중 규정
                    </h2>
                    <div className="text-slate-600 space-y-4 text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-green-50 p-4 rounded-xl">
                            어떠한 형태의 차별이나 성희롱, 혐오 발언도 일절 허용되지 않습니다.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>국적, 성별, 장애, 종교를 이유로 한 차별적 언행 절대 금지</li>
                            <li>액티비티 체험 시 게스트의 신체적 안전을 위한 사전 설명(Safety Briefing) 진행 의무</li>
                            <li>응급 상황 발생 시 지체 없이 119 구급대 및 플랫폼 지원 센터로 연락해야 합니다.</li>
                        </ul>
                    </div>
                </div>

            </div>

            <div className="mt-12 text-center bg-slate-50 py-8 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                    <CheckCircle2 className="text-slate-800" size={24} />
                </div>
                <p className="text-sm text-slate-500 font-bold mb-1">안전한 로컬 문화를 함께 만들어갑니다</p>
                <p className="text-xs text-slate-400">Locally Trust & Safety Team</p>
            </div>

        </div>
    );
}
