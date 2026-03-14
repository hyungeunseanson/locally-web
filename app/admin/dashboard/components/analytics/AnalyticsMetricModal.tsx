'use client';

import { format } from 'date-fns';
import { Star, X } from 'lucide-react';

import { FunnelBar, SimpleBar } from './helpers';
import type { AnalyticsMetricKey, AnalyticsStats } from './types';

type AnalyticsMetricModalProps = {
  selectedMetric: AnalyticsMetricKey | null;
  stats: AnalyticsStats;
  onClose: () => void;
};

export default function AnalyticsMetricModal({
  selectedMetric,
  stats,
  onClose,
}: AnalyticsMetricModalProps) {
  if (!selectedMetric) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl p-8 relative"
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-black">
          <X size={20} />
        </button>

        {selectedMetric === 'aov' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">가격대별 결제 비중</h3>
            <div className="space-y-4">
              <SimpleBar label="Low (<3만)" val={stats.priceDistribution.low} max={stats.funnel.completed} />
              <SimpleBar label="Mid (3~10만)" val={stats.priceDistribution.mid} max={stats.funnel.completed} />
              <SimpleBar label="High (>10만)" val={stats.priceDistribution.high} max={stats.funnel.completed} />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              체험 예약과 서비스 결제를 합친 전체 결제 건 기준 가격대 비중입니다.
            </p>
          </div>
        )}

        {selectedMetric === 'users' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">최근 가입 유저 (기간 내)</h3>
            <div className="space-y-3">
              {stats.newUsersList.length > 0 ? (
                stats.newUsersList.map((user, index) => (
                  <div key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {user.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{user.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">
                          {user.created_at ? `${format(new Date(user.created_at), 'yyyy-MM-dd')} 가입` : '가입일 미확인'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded">
                      {user.nationality || 'KR'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">기간 내 신규 유저가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {selectedMetric === 'gmv' && (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">🔥 최고 매출 기록일</h3>
            <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
              <div className="text-4xl font-black text-rose-500 tracking-tighter mb-2">
                ₩{stats.topRevenueDate.amount.toLocaleString()}
              </div>
              <div className="text-sm font-bold text-slate-600">발생일자: {stats.topRevenueDate.dateStr}</div>
              <p className="text-xs text-slate-500 mt-2">
                선택하신 기간 내 체험 예약과 서비스 결제를 합친 하루 기준 최고 거래액입니다.
              </p>
            </div>
          </div>
        )}

        {selectedMetric === 'cancel' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">체험 예약 취소 사유 분석</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-xl text-center">
                <div className="text-sm text-red-500 font-bold mb-1">유저 취소</div>
                <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.user}건</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl text-center">
                <div className="text-sm text-orange-500 font-bold mb-1">호스트 거절</div>
                <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.host}건</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              이 구간은 서비스 의뢰가 아닌 체험 예약 취소 기준입니다. 호스트 거절이 많다면 달력 관리를 독려해야 합니다.
            </p>
          </div>
        )}

        {selectedMetric === 'response' && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xl font-bold flex items-center gap-2">
              🏆 응답시간 상위 10명 <span className="text-xs font-normal text-emerald-500">최단 시간 기준</span>
            </h3>
            <div className="space-y-3 mb-6">
              {stats.topRespHosts.length > 0 ? (
                stats.topRespHosts.map((host, index) => (
                  <div key={host.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </div>
                      <div className="text-sm font-bold text-slate-800">{host.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-600">{host.timeMins}분</div>
                      <div className="text-[10px] text-slate-400">응답률 {host.rate.toFixed(0)}%</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">데이터 없음</div>
              )}
            </div>

            <h3 className="text-xl font-bold flex items-center gap-2 pt-4 border-t border-slate-100">
              🐢 응답시간 하위 10명 <span className="text-xs font-normal text-rose-500">최장 시간 기준</span>
            </h3>
            <div className="space-y-3">
              {stats.bottomRespHosts.length > 0 ? (
                stats.bottomRespHosts.map((host, index) => (
                  <div key={host.id} className="flex justify-between items-center bg-rose-50/30 p-3 rounded-lg border border-rose-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </div>
                      <div className="text-sm font-bold text-slate-800">{host.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-600">{host.timeMins}분</div>
                      <div className="text-[10px] text-slate-400">응답률 {host.rate.toFixed(0)}%</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">데이터 없음</div>
              )}
            </div>
          </div>
        )}

        {selectedMetric === 'exps' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">활성 체험 현황</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl text-center">
                <div className="text-sm text-emerald-600 font-bold mb-1">운영 중 (Active)</div>
                <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.active}개</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <div className="text-sm text-blue-500 font-bold mb-1">기간 내 신규 등록</div>
                <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.new}개</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 opacity-70">
              <div className="text-xs text-slate-500 font-medium">검수 대기: {stats.expsBreakdown.pending}개</div>
              <div className="text-xs text-slate-500 font-medium">반려: {stats.expsBreakdown.rejected}개</div>
            </div>
          </div>
        )}

        {selectedMetric === 'demographics' && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xl font-bold">결제 고객 인구통계 상세</h3>
            <p className="text-xs text-slate-400 -mt-3">체험 예약과 서비스 결제를 합친 플랫폼 전체 결제 고객 기준</p>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">국적 분포 (전체)</h4>
              <div className="space-y-3">
                {stats.demographics.allNationalities.map((nationality, index) => (
                  <div key={`nat-${index}`} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{index + 1}</span>
                    <div className="w-16 text-sm font-bold text-slate-700">{nationality.name}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nationality.percent}%` }}></div>
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-slate-500">
                      {nationality.count}명 ({nationality.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">연령대 분포</h4>
              <div className="grid grid-cols-2 gap-4">
                {stats.demographics.ages.map((age, index) => (
                  <div key={`age-${index}`} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                    <span className="text-sm font-bold text-slate-700">{age.name}</span>
                    <span className="text-xs font-mono text-slate-500">
                      {age.count}명 ({age.percent.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">성별 분포</h4>
              <div className="flex gap-4">
                {stats.demographics.genders.map((gender, index) => (
                  <div key={`gen-${index}`} className="flex-1 bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                    <div className="text-sm font-bold text-slate-700 mb-1">{gender.name}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {gender.count}명 ({gender.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedMetric === 'searchTrends' && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xl font-bold">체험 검색어 전체 순위</h3>
            <p className="text-xs text-slate-400 -mt-3">체험 검색 로그 기준</p>
            <div className="space-y-2">
              {stats.allSearchTrends.length > 0 ? (
                stats.allSearchTrends.map((trend, index) => (
                  <div
                    key={`trend-${index}`}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </div>
                      <div className="text-sm font-bold text-slate-800">{trend.keyword}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-700">{trend.count}회</div>
                      <div className="text-[10px] text-slate-400">검색 비중 {trend.percent.toFixed(1)}%</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">검색 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {selectedMetric === 'topExps' && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xl font-bold">전체 체험 판매 랭킹</h3>
            <p className="text-xs text-slate-400 -mt-3">체험 예약 결제 완료 건수 기준</p>
            <div className="space-y-3">
              {stats.allExperiences.length > 0 ? (
                stats.allExperiences.map((experience, index) => (
                  <div
                    key={experience.id ?? `experience-${index}`}
                    className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors"
                  >
                    <div className="w-8 flex flex-col items-center justify-center">
                      <span className={`text-lg font-black ${index < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                      {experience.image_url ? (
                        <img
                          src={experience.image_url ?? undefined}
                          alt={experience.title || 'Experience image'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Star size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="text-sm font-bold text-slate-900 truncate">{experience.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                          <Star size={12} fill="currentColor" /> {experience.rating}
                        </span>
                        <span>결제 {experience.bookingCount}건</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <div className="text-sm font-black text-slate-800 group-hover:text-amber-600 transition-colors">
                        ₩{experience.totalRevenue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">판매된 체험이 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {selectedMetric === 'hostDemographics' && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xl font-bold">호스트 생태계 전체 통계</h3>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">주요 유입 경로</h4>
              <div className="space-y-3">
                {stats.hostEcosystem.allSources.map((source, index) => (
                  <div key={`src-${index}`} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{index + 1}</span>
                    <div className="w-24 text-sm font-bold text-slate-700 truncate">{source.name}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${source.percent}%` }}></div>
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-slate-500">
                      {source.count}명 ({source.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">호스트 국적 비율</h4>
              <div className="space-y-3">
                {stats.hostEcosystem.allNationalities.map((nationality, index) => (
                  <div key={`hnat-${index}`} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{index + 1}</span>
                    <div className="w-20 text-sm font-bold text-slate-700">{nationality.name}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nationality.percent}%` }}></div>
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-slate-500">
                      {nationality.count}명 ({nationality.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-bold text-slate-500 border-b pb-2">보유 언어 비율</h4>
              <div className="space-y-3">
                {stats.hostEcosystem.allLanguages.map((language, index) => (
                  <div key={`hlang-${index}`} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{index + 1}</span>
                    <div className="w-20 text-sm font-bold text-slate-700">{language.name}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${language.percent}%` }}></div>
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-slate-500">
                      {language.count}명 ({language.percent.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedMetric === 'revenue' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">플랫폼 순수익 구조</h3>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-500">총 거래액 (GMV)</span>
                <span className="text-lg font-black text-slate-800">₩{stats.gmv.toLocaleString()}</span>
              </div>
              <div className="w-full h-8 bg-slate-200 rounded-full flex overflow-hidden">
                <div
                  className="h-full bg-blue-500 flex items-center px-3"
                  style={{ width: `${stats.gmv ? (stats.netRevenue / stats.gmv) * 100 : 0}%` }}
                >
                  <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">플랫폼 수익</span>
                </div>
                <div className="h-full bg-slate-400 flex items-center justify-end px-3 flex-1">
                  <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">호스트 정산</span>
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <div>
                  <div className="text-xs font-bold text-blue-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> 플랫폼 순수익
                  </div>
                  <div className="text-sm font-black text-slate-700 mt-1">₩{stats.netRevenue.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span> 호스트 정산금
                  </div>
                  <div className="text-sm font-black text-slate-700 mt-1">₩{stats.hostPayout.toLocaleString()}</div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center">체험 예약과 서비스 결제를 합친 플랫폼 전체 수익 구조입니다.</p>
            </div>
          </div>
        )}

        {selectedMetric === 'conversion' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">가입 대비 결제건 비율</h3>
            <div className="space-y-4">
              <FunnelBar label="상품 노출" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
              <FunnelBar label="상세 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
              <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
              <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              기간 내 신규 가입자 수 대비 결제 완료 건수 비율은 <strong className="text-emerald-500">{stats.conversionRate}%</strong> 입니다. 동일 고객의 중복 결제 건도 포함됩니다.
            </p>
          </div>
        )}

        {selectedMetric === 'retention' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">기간 내 반복 결제 고객 비율</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <div className="text-[10px] text-slate-500 font-bold mb-1">1회 결제</div>
                <div className="text-xl font-black text-slate-700">{stats.retentionBreakdown.once}명</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-100">
                <div className="text-[10px] text-blue-500 font-bold mb-1">2회 재구매</div>
                <div className="text-xl font-black text-blue-700">{stats.retentionBreakdown.twice}명</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                <div className="text-[10px] text-emerald-600 font-bold mb-1">3회 이상 (단골)</div>
                <div className="text-xl font-black text-emerald-700">{stats.retentionBreakdown.threeOrMore}명</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              해당 기간 내 체험 예약과 서비스 결제를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율은 {stats.retentionRate}% 입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
