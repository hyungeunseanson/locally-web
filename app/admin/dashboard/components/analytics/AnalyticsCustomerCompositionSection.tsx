'use client';

import { UserCheck } from 'lucide-react';

import type {
  AnalyticsCustomerCompositionSummary,
  CustomerCompositionSource,
} from './types';

function formatKrw(value: number) {
  return `₩${Math.round(value || 0).toLocaleString()}`;
}

export default function AnalyticsCustomerCompositionSection({
  customerComposition,
  customerCompositionSource,
}: {
  customerComposition: AnalyticsCustomerCompositionSummary | null;
  customerCompositionSource: CustomerCompositionSource;
}) {
  return (
    <section className="pt-4 md:pt-6">
      <div className="flex flex-col gap-3 mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="md:w-[18px] md:h-[18px] text-slate-700" />
          <h2 className="text-base md:text-lg font-bold">고객 구성 분석</h2>
          {customerCompositionSource === 'cached' && (
            <span className="text-[10px] md:text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
              최근 집계 재사용
            </span>
          )}
          {customerCompositionSource === 'unavailable' && (
            <span className="text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
              일시 불가
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs md:text-sm text-slate-600">
          <div className="font-semibold text-slate-800">체험 + 서비스 결제 고객 기준으로 고객 구성을 봅니다.</div>
          <div className="mt-1">누가 결제하고, 누가 다시 결제하는지 고객 구성을 먼저 보고, 추적된 고객 기준 유입 source도 함께 참고합니다.</div>
          <div className="mt-1">언어는 복수 응답 기준이라 한 고객이 여러 언어에 함께 집계될 수 있습니다.</div>
          {customerComposition?.sourceFunnel && customerComposition.sourceFunnel.length > 0 && (
            <div className="mt-1 text-[11px] md:text-xs text-slate-500">
              유입 source별 가입→결제 전환, 결제액, 반복 고객 비율은 추적 데이터가 남아 있는 가입자 {customerComposition.sourceSignupTrackedUsers || 0}명 기준 참고용입니다.
            </div>
          )}
          {customerComposition?.sourceStatus === 'ready' && !(customerComposition?.sourceFunnel && customerComposition.sourceFunnel.length > 0) && (
            <div className="mt-1 text-[11px] md:text-xs text-slate-500">
              유입 source는 추적 데이터가 남아 있는 결제 고객 {customerComposition.sourceTrackedCustomers || 0}명 기준 참고용입니다.
            </div>
          )}
          {customerComposition?.sourceStatus === 'collecting' && (
            <div className="mt-1 text-[11px] md:text-xs text-slate-500">유입 source 데이터가 아직 충분히 쌓이는 중입니다.</div>
          )}
          {customerComposition?.sourceStatus === 'unavailable' && (
            <div className="mt-1 text-[11px] md:text-xs text-slate-500">유입 source 집계를 현재 불러오지 못해, 다른 고객 구성 지표만 표시하고 있습니다.</div>
          )}
        </div>
      </div>

      {customerComposition ? (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-800">국적별 결제 고객</h3>
              <span className="text-[10px] md:text-xs text-slate-400">총 {customerComposition.totalPayingCustomers}명</span>
            </div>
            <div className="space-y-2">
              {customerComposition.nationalityMix.length > 0 ? customerComposition.nationalityMix.map((item) => (
                <div key={`customer-composition-nationality-${item.name}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                </div>
              )) : (
                <div className="py-6 text-center text-sm text-slate-400">국적 데이터가 부족합니다.</div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-800">주요 언어권</h3>
              <span className="text-[10px] md:text-xs text-slate-400">복수 선택 허용</span>
            </div>
            <div className="space-y-2">
              {customerComposition.languageMix.length > 0 ? customerComposition.languageMix.map((item) => (
                <div key={`customer-composition-language-${item.name}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="text-xs font-mono text-slate-500">{item.customers}명</span>
                </div>
              )) : (
                <div className="py-6 text-center text-sm text-slate-400">언어 데이터가 부족합니다.</div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-800">신규 vs 반복 고객</h3>
              <span className="text-[10px] md:text-xs text-slate-400">전체 결제 고객</span>
            </div>
            <div className="space-y-2">
              {customerComposition.loyaltyMix.length > 0 ? customerComposition.loyaltyMix.map((item) => (
                <div key={`customer-composition-loyalty-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                    <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 text-[11px] md:text-xs text-slate-500">{item.customers}명</div>
                </div>
              )) : (
                <div className="py-6 text-center text-sm text-slate-400">반복 결제 데이터가 부족합니다.</div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-800">체험/서비스 선호</h3>
              <span className="text-[10px] md:text-xs text-slate-400">결제 고객 분포</span>
            </div>
            <div className="space-y-2">
              {customerComposition.purchaseMix.length > 0 ? customerComposition.purchaseMix.map((item) => (
                <div key={`customer-composition-purchase-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                    <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 text-[11px] md:text-xs text-slate-500">{item.customers}명</div>
                </div>
              )) : (
                <div className="py-6 text-center text-sm text-slate-400">구성 데이터가 부족합니다.</div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-800">주요 유입 source</h3>
              <span className="text-[10px] md:text-xs text-slate-400">
                {customerComposition.sourceFunnel && customerComposition.sourceFunnel.length > 0
                  ? `추적 가입 ${customerComposition.sourceSignupTrackedUsers || 0}명`
                  : customerComposition.sourceAvailable
                    ? `추적 고객 ${customerComposition.sourceTrackedCustomers || 0}명`
                    : '참고용'}
              </span>
            </div>
            <div className="space-y-2">
              {customerComposition.sourceFunnel && customerComposition.sourceFunnel.length > 0 ? (
                customerComposition.sourceFunnel.map((item) => (
                  <div key={`customer-composition-source-funnel-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                      <span className="text-xs font-mono text-slate-500">{item.conversionRate.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                      가입 {item.signups}명 · 결제 {item.payingCustomers}명
                    </div>
                    <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                      결제액 {formatKrw(item.revenue)} · 반복 {item.repeatCustomers}명 ({item.repeatRate.toFixed(1)}%)
                    </div>
                    {(item.topNationality || item.topLanguage) && (
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        주요 고객: {[item.topNationality, item.topLanguage].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ))
              ) : customerComposition.sourceAvailable && (customerComposition.sourceMix || []).length > 0 ? (
                (customerComposition.sourceMix || []).map((item) => (
                  <div key={`customer-composition-source-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                      <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 text-[11px] md:text-xs text-slate-500">{item.customers}명</div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-slate-400">
                  {customerComposition.sourceStatus === 'unavailable'
                    ? '유입 source 집계를 불러오지 못했습니다.'
                    : '유입 source 데이터가 더 쌓이면 여기서 볼 수 있습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          고객 구성 분석 데이터를 불러오지 못했습니다.
        </div>
      )}
    </section>
  );
}
