'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Clock3, Languages, MapPin, Plus, Trash2, Users } from 'lucide-react';

import SiteHeader from '@/app/components/SiteHeader';
import Spinner from '@/app/components/ui/Spinner';
import { useLanguage, type Locale } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import type { ServiceScheduleItemInput, ServiceType } from '@/app/types/service';
import {
  calculateServicePricing,
  getServicePricingReasonLabel,
  SERVICE_JAPAN_CITY_SUGGESTIONS,
  SERVICE_LANGUAGE_OPTIONS,
  SERVICE_MAX_GUESTS,
  validateServiceSchedule,
} from '@/app/utils/services/concierge';
import { createClient } from '@/app/utils/supabase/client';

type LocalScheduleItem = ServiceScheduleItemInput & { rowKey: string };

const LANGUAGE_LABELS: Record<Locale, Record<(typeof SERVICE_LANGUAGE_OPTIONS)[number], string>> = {
  ko: { 한국어: '한국어', 일본어: '일본어', 영어: '영어', 중국어: '중국어' },
  en: { 한국어: 'Korean', 일본어: 'Japanese', 영어: 'English', 중국어: 'Chinese' },
  ja: { 한국어: '韓国語', 일본어: '日本語', 영어: '英語', 중국어: '中国語' },
  zh: { 한국어: '韩语', 일본어: '日语', 영어: '英语', 중국어: '中文' },
};

const COPY: Record<Locale, Record<string, string>> = {
  ko: {
    eyebrow: '맞춤 서비스 신청', title: '일본 현지 동행·통역 신청', desc: '필요한 일정과 요청 사항을 알려 주세요. 결제가 확인되면 현지 담당자가 1:1 문의에서 내용을 확인하고 호스트를 배정합니다.',
    planTitle: '일정과 기본 조건', planDesc: '서비스 유형, 도시, 일정, 인원과 필요한 언어를 선택해 주세요.', type: '서비스 유형', general: '일반 동행·생활 통역', generalDesc: '1~5인 · 시간당 35,000원', business: '비즈니스 통역·현장 지원', businessDesc: '비즈니스 목적 또는 6인 이상 · 시간당 55,000원',
    city: '일본 내 이용 도시', cityHelp: '목록에 없는 일본 도시도 직접 입력할 수 있습니다.', cityPh: '예: 도쿄', schedule: '이용 일정', scheduleHelp: '하루 3~24시간, 전체 168시간까지 신청할 수 있습니다. 40시간 이상의 장기 이용도 가능합니다.', date: '날짜', start: '시작 시각', hours: '이용 시간', addDay: '날짜 추가', removeDay: '날짜 삭제', guests: '이용 인원', guestsUnit: '명', languages: '필요한 언어',
    requestTitle: '원하는 서비스 내용', requestDesc: '현지 담당자가 적합한 호스트를 찾을 수 있도록 목적과 상황을 구체적으로 적어 주세요.', details: '요청 사항', detailsPh: '예: 오사카에서 병원 진료 통역이 필요합니다. 접수부터 진료 종료까지 동행해 주세요.',
    contactTitle: '연락 및 결제 진행 정보', contactDesc: '입력한 연락처는 결제 확인과 현지 담당자 1:1 문의에 사용됩니다.', name: '이름', phone: '전화번호',
    summary: '예상 결제 요약', perHour: '시간당 요금', totalHours: '전체 이용 시간', rateRule: '적용 기준', total: '총 예상 금액', nextTitle: '다음 단계', next: '의뢰 등록 후 결제가 진행됩니다. 결제가 완료되면 신청 내용이 현지 담당자 1:1 문의로 자동 전달됩니다.', submit: '의뢰 등록 및 결제하기', processing: '등록 중…',
    required: '필수 항목을 모두 올바르게 입력해 주세요.', login: '로그인이 필요합니다.', scheduleError: '하루 3~24시간, 전체 168시간 이내로 입력해 주세요.', back: '이전 화면으로',
  },
  en: {
    eyebrow: 'Custom service request', title: 'Local companion & interpreting in Japan', desc: 'Tell us your schedule and needs. Once payment is confirmed, a local coordinator reviews the details in private chat and assigns a host.',
    planTitle: 'Schedule and basic details', planDesc: 'Choose the service type, city, schedule, group size, and languages.', type: 'Service type', general: 'Companion & everyday interpreting', generalDesc: '1–5 guests · KRW 35,000/hour', business: 'Business interpreting & on-site support', businessDesc: 'Business or 6+ guests · KRW 55,000/hour',
    city: 'City in Japan', cityHelp: 'You can enter any city in Japan.', cityPh: 'e.g. Tokyo', schedule: 'Schedule', scheduleHelp: '3–24 hours per date and up to 168 hours total. Long bookings of 40+ hours are supported.', date: 'Date', start: 'Start time', hours: 'Hours', addDay: 'Add date', removeDay: 'Remove date', guests: 'Guests', guestsUnit: '', languages: 'Languages needed',
    requestTitle: 'What you need help with', requestDesc: 'Describe your purpose and situation so the local coordinator can find the right host.', details: 'Request details', detailsPh: 'e.g. I need help at a hospital in Osaka, from reception through the end of my appointment.',
    contactTitle: 'Contact and payment details', contactDesc: 'We use this contact information for payment confirmation and private local coordinator support.', name: 'Name', phone: 'Phone',
    summary: 'Estimated payment summary', perHour: 'Hourly rate', totalHours: 'Total hours', rateRule: 'Rate applied', total: 'Estimated total', nextTitle: 'What happens next', next: 'After you register, you will proceed to payment. Once paid, the request is automatically delivered to a private local coordinator chat.', submit: 'Register & Pay for Request', processing: 'Submitting…',
    required: 'Please complete all required fields.', login: 'Please sign in first.', scheduleError: 'Each date must be 3–24 hours and the total must not exceed 168 hours.', back: 'Go back',
  },
  ja: {
    eyebrow: 'オーダーメイドサービス申請', title: '日本現地の同行・通訳を申し込む', desc: '日程とご希望をお知らせください。決済確認後、現地担当者が1:1で内容を確認し、ホストを手配します。',
    planTitle: '日程と基本条件', planDesc: 'サービス種別、都市、日程、人数、必要な言語を選択してください。', type: 'サービス種別', general: '一般同行・生活通訳', generalDesc: '1～5名 · 1時間35,000ウォン', business: 'ビジネス通訳・現場サポート', businessDesc: 'ビジネス目的または6名以上 · 1時間55,000ウォン',
    city: '日本の利用都市', cityHelp: '一覧にない日本の都市も直接入力できます。', cityPh: '例：東京', schedule: '利用日程', scheduleHelp: '1日3～24時間、合計168時間まで申請できます。40時間以上の長期利用にも対応しています。', date: '日付', start: '開始時刻', hours: '利用時間', addDay: '日付を追加', removeDay: '日付を削除', guests: '利用人数', guestsUnit: '名', languages: '必要な言語',
    requestTitle: '希望するサービス内容', requestDesc: '担当者が最適なホストを探せるよう、目的と状況を具体的にご記入ください。', details: '依頼内容', detailsPh: '例：大阪の病院で、受付から診察終了まで通訳と同行をお願いします。',
    contactTitle: '連絡先と決済情報', contactDesc: '入力した連絡先は、決済確認と現地担当者からの連絡に使用します。', name: '氏名', phone: '電話番号',
    summary: '決済予定の概要', perHour: '1時間あたり', totalHours: '合計利用時間', rateRule: '適用基準', total: '合計予定金額', nextTitle: '次のステップ', next: '申請登録後に決済へ進みます。決済完了後、内容が現地担当者との1:1お問い合わせへ自動送信されます。', submit: 'リクエストを登録して決済する', processing: '登録中…',
    required: '必須項目を正しく入力してください。', login: 'ログインが必要です。', scheduleError: '1日3～24時間、合計168時間以内で入力してください。', back: '前の画面へ',
  },
  zh: {
    eyebrow: '定制服务申请', title: '申请日本当地陪同与口译', desc: '请告诉我们日程和具体需求。确认付款后，当地负责人会通过一对一咨询核对内容并安排向导。',
    planTitle: '行程与基本条件', planDesc: '请选择服务类型、城市、日程、人数和所需语言。', type: '服务类型', general: '普通陪同与生活口译', generalDesc: '1–5人 · 每小时35,000韩元', business: '商务口译与现场支持', businessDesc: '商务需求或6人以上 · 每小时55,000韩元',
    city: '日本服务城市', cityHelp: '也可以直接填写列表外的日本城市。', cityPh: '例如：东京', schedule: '服务日程', scheduleHelp: '每天3–24小时，总计最多168小时，也支持40小时以上的长期服务。', date: '日期', start: '开始时间', hours: '时长', addDay: '添加日期', removeDay: '删除日期', guests: '人数', guestsUnit: '人', languages: '所需语言',
    requestTitle: '您需要的服务内容', requestDesc: '请具体说明目的和场景，以便当地负责人安排合适的向导。', details: '具体需求', detailsPh: '例如：需要在大阪医院从挂号到就诊结束全程陪同口译。',
    contactTitle: '联系与支付信息', contactDesc: '填写的联系方式将用于付款确认和当地负责人一对一沟通。', name: '姓名', phone: '电话号码',
    summary: '预计支付摘要', perHour: '每小时价格', totalHours: '总时长', rateRule: '适用标准', total: '预计总额', nextTitle: '接下来会发生什么', next: '提交申请后将进入付款。付款完成后，申请内容会自动发送到当地负责人一对一咨询。', submit: '提交需求并支付', processing: '提交中…',
    required: '请正确填写所有必填项。', login: '请先登录。', scheduleError: '每天须为3–24小时，且总时长不得超过168小时。', back: '返回上一页',
  },
};

const inputClassName = 'mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3.5 py-3 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950';

function ServiceRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const idempotencyKey = useRef<string | null>(null);
  const initialDuration = Number(searchParams.get('duration'));

  const [serviceType, setServiceType] = useState<ServiceType>('general');
  const [city, setCity] = useState('');
  const [schedule, setSchedule] = useState<LocalScheduleItem[]>(() => [{
    rowKey: 'initial',
    serviceDate: searchParams.get('date') || '',
    startTime: searchParams.get('startTime') || '09:00',
    durationHours: Number.isInteger(initialDuration) && initialDuration >= 3 && initialDuration <= 24 ? initialDuration : 4,
  }]);
  const [guestCount, setGuestCount] = useState(Math.min(10, Math.max(1, Number(searchParams.get('guests')) || 1)));
  const [languages, setLanguages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalHours = schedule.reduce((sum, item) => sum + (Number(item.durationHours) || 0), 0);
  const pricing = calculateServicePricing({ serviceType, guestCount, totalHours });
  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), []);
  const times = useMemo(() => Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`), []);

  const updateSchedule = (index: number, patch: Partial<ServiceScheduleItemInput>) => {
    setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const submit = async () => {
    const invalidSchedule = !validateServiceSchedule(schedule, { today }).success;
    if (!city.trim() || languages.length === 0 || !description.trim() || !contactName.trim() || !contactPhone.trim() || invalidSchedule) {
      showToast(invalidSchedule ? copy.scheduleError : copy.required, 'error');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast(copy.login, 'error');
      router.push(`/login?redirect=${encodeURIComponent('/services/request')}`);
      return;
    }
    setSubmitting(true);
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const response = await fetch('/api/services/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          serviceType,
          city,
          schedule: schedule.map(({ serviceDate, startTime, durationHours }) => ({ serviceDate, startTime, durationHours })),
          guestCount,
          languages,
          description,
          contactName,
          contactPhone,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.requestId) throw new Error(result.error || copy.required);
      router.push(`/services/${result.requestId}/payment`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.required, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-8 pb-36 md:px-8 md:py-12 lg:pb-20">
        <header className="border-b border-zinc-200 pb-9">
          <button type="button" onClick={() => router.back()} aria-label={copy.back} className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-950"><ArrowLeft size={15} />{copy.back}</button>
          <p className="mt-8 text-xs font-medium tracking-wide text-zinc-500">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">{copy.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 md:text-base">{copy.desc}</p>
        </header>

        <div data-testid="service-request-mobile-cta" className="fixed left-14 right-3 z-[120] rounded-lg border border-zinc-200 bg-white p-2 shadow-[0_8px_32px_rgba(0,0,0,0.16)] lg:hidden" style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 px-2"><p className="text-[10px] text-zinc-500">{copy.total}</p><p className="truncate text-base font-semibold">₩{pricing.totalPrice.toLocaleString()}</p></div>
            <button data-testid="service-request-mobile-submit" type="button" disabled={submitting} onClick={submit} className="min-w-[188px] rounded-md bg-zinc-950 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? copy.processing : copy.submit}</button>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div>
            <FormSection index="01" title={copy.planTitle} desc={copy.planDesc}>
              <fieldset>
                <legend className="text-sm font-semibold">{copy.type}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([['general', copy.general, copy.generalDesc, Users], ['business', copy.business, copy.businessDesc, BriefcaseBusiness]] as const).map(([value, label, help, Icon]) => {
                    const selected = serviceType === value;
                    return (
                      <button key={value} type="button" aria-pressed={selected} onClick={() => setServiceType(value)} className={`rounded-md border p-4 text-left transition-colors ${selected ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-300 bg-white hover:border-zinc-950'}`}>
                        <Icon size={17} /><p className="mt-4 text-sm font-semibold">{label}</p><p className={`mt-1.5 text-xs leading-5 ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>{help}</p>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-7">
                <label htmlFor="service-city" className="flex items-center gap-2 text-sm font-semibold"><MapPin size={15} />{copy.city}</label>
                <input id="service-city" value={city} onChange={(event) => setCity(event.target.value)} list="japan-cities" maxLength={100} className={inputClassName} placeholder={copy.cityPh} />
                <datalist id="japan-cities">{SERVICE_JAPAN_CITY_SUGGESTIONS.map((option) => <option key={option} value={option} />)}</datalist>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{copy.cityHelp}</p>
              </div>

              <div className="mt-8">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} />{copy.schedule}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{copy.scheduleHelp}</p></div>
                  <span className="shrink-0 border-b border-zinc-950 pb-1 text-sm font-semibold tabular-nums">{totalHours}h</span>
                </div>
                <div className="mt-4 border-t border-zinc-200">
                  {schedule.map((item, index) => (
                    <div key={item.rowKey} className="grid gap-3 border-b border-zinc-200 py-4 sm:grid-cols-[1.3fr_1fr_0.75fr_auto] sm:items-end">
                      <label className="text-xs font-medium text-zinc-600">{copy.date}<input type="date" min={today} value={item.serviceDate} onChange={(event) => updateSchedule(index, { serviceDate: event.target.value })} className={inputClassName} /></label>
                      <label className="text-xs font-medium text-zinc-600">{copy.start}<select value={item.startTime} onChange={(event) => updateSchedule(index, { startTime: event.target.value })} className={inputClassName}>{times.map((time) => <option key={time}>{time}</option>)}</select></label>
                      <label className="text-xs font-medium text-zinc-600">{copy.hours}<input type="number" min={3} max={24} step={1} value={item.durationHours} onChange={(event) => updateSchedule(index, { durationHours: Number(event.target.value) })} className={inputClassName} /></label>
                      <button type="button" aria-label={copy.removeDay} disabled={schedule.length === 1} onClick={() => setSchedule((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md border border-zinc-300 p-3 text-zinc-500 transition-colors hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={schedule.length >= 56} onClick={() => setSchedule((current) => [...current, { rowKey: crypto.randomUUID(), serviceDate: '', startTime: '09:00', durationHours: 4 }])} className="mt-3 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 disabled:opacity-40"><Plus size={14} />{copy.addDay}</button>
              </div>

              <div className="mt-8 grid gap-7 sm:grid-cols-2">
                <div>
                  <label htmlFor="service-guests" className="flex items-center gap-2 text-sm font-semibold"><Users size={15} />{copy.guests}</label>
                  <select id="service-guests" value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} className={inputClassName}>{Array.from({ length: SERVICE_MAX_GUESTS }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}{copy.guestsUnit}</option>)}</select>
                </div>
                <fieldset>
                  <legend className="flex items-center gap-2 text-sm font-semibold"><Languages size={15} />{copy.languages}</legend>
                  <div className="mt-3 flex flex-wrap gap-2">{SERVICE_LANGUAGE_OPTIONS.map((language) => {
                    const selected = languages.includes(language);
                    return <button type="button" aria-pressed={selected} key={language} onClick={() => setLanguages((current) => selected ? current.filter((item) => item !== language) : [...current, language])} className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${selected ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-300 bg-white hover:border-zinc-950'}`}>{LANGUAGE_LABELS[lang][language]}</button>;
                  })}</div>
                </fieldset>
              </div>
            </FormSection>

            <FormSection index="02" title={copy.requestTitle} desc={copy.requestDesc}>
              <label htmlFor="service-details" className="text-sm font-semibold">{copy.details}</label>
              <textarea id="service-details" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={7} placeholder={copy.detailsPh} className={`${inputClassName} resize-y leading-6`} />
            </FormSection>

            <FormSection index="03" title={copy.contactTitle} desc={copy.contactDesc}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">{copy.name}<input value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={100} autoComplete="name" className={inputClassName} /></label>
                <label className="text-sm font-semibold">{copy.phone}<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={50} inputMode="tel" autoComplete="tel" className={inputClassName} /></label>
              </div>
            </FormSection>
          </div>

          <aside className="border-t border-zinc-950 py-7 lg:sticky lg:top-24 lg:mt-10 lg:border-l lg:border-t-0 lg:py-0 lg:pl-7">
            <p className="text-xs font-medium tracking-wide text-zinc-500">{copy.summary}</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-5"><dt className="text-zinc-500">{copy.perHour}</dt><dd className="font-medium">₩{pricing.hourlyRate.toLocaleString()}</dd></div>
              <div className="flex justify-between gap-5"><dt className="text-zinc-500">{copy.totalHours}</dt><dd className="font-medium">{totalHours}h</dd></div>
              <div className="flex justify-between gap-5"><dt className="text-zinc-500">{copy.rateRule}</dt><dd className="text-right font-medium">{getServicePricingReasonLabel(pricing.reason, lang)}</dd></div>
            </dl>
            <div className="mt-6 border-t border-zinc-200 pt-5">
              <div className="flex items-end justify-between gap-5"><span className="text-sm font-semibold">{copy.total}</span><span className="text-2xl font-semibold tracking-[-0.03em]">₩{pricing.totalPrice.toLocaleString()}</span></div>
            </div>
            <div className="mt-7 rounded-md bg-zinc-100 p-4">
              <p className="text-xs font-semibold text-zinc-950">{copy.nextTitle}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{copy.next}</p>
            </div>
            <button type="button" disabled={submitting} onClick={submit} className="mt-4 hidden w-full rounded-md bg-zinc-950 px-4 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 lg:block">{submitting ? copy.processing : copy.submit}</button>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FormSection({ index, title, desc, children }: { index: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-zinc-200 py-10 md:grid-cols-[150px_minmax(0,1fr)]">
      <div><p className="text-xs tabular-nums text-zinc-400">{index}</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.015em]">{title}</h2><p className="mt-2 text-xs leading-5 text-zinc-500">{desc}</p></div>
      <div>{children}</div>
    </section>
  );
}

export default function ServiceRequestPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}><ServiceRequestForm /></Suspense>;
}
