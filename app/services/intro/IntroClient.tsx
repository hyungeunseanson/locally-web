'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Check, MessageSquareText } from 'lucide-react';

import SiteHeader from '@/app/components/SiteHeader';
import { useLanguage, type Locale } from '@/app/context/LanguageContext';

type IntroCopy = {
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  pricingTitle: string;
  general: string;
  generalScope: string;
  generalPrice: string;
  business: string;
  businessScope: string;
  businessPrice: string;
  pricingRule: string;
  durationTitle: string;
  durationRows: Array<[string, string]>;
  useTitle: string;
  personalTitle: string;
  personalCases: string[];
  workTitle: string;
  workCases: string[];
  flowTitle: string;
  steps: Array<{ title: string; desc: string }>;
  noteTitle: string;
  notes: string[];
  finalTitle: string;
  finalDesc: string;
};

const COPY: Record<Locale, IntroCopy> = {
  ko: {
    eyebrow: 'Locally · 일본 현지 맞춤 서비스',
    title: '일본 현지 동행, 통역\n가이드 서비스',
    desc: '여행 중 생활 통역부터 비즈니스 현장 지원까지. 신청 내용을 바탕으로 로컬리가 일정과 목적에 맞는 호스트를 직접 배정합니다.',
    cta: '맞춤 서비스 신청하기',
    pricingTitle: '이용 요금',
    general: '일반 동행·생활 통역',
    generalScope: '1~5인',
    generalPrice: '시간당 35,000원',
    business: '비즈니스 통역·현장 지원',
    businessScope: '비즈니스 목적 또는 6인 이상',
    businessPrice: '시간당 55,000원',
    pricingRule: '비즈니스 서비스와 6인 이상 조건이 겹쳐도 추가 요금은 중복 적용되지 않습니다.',
    durationTitle: '시간 기준',
    durationRows: [['하루 이용 시간', '3~24시간'], ['전체 이용 시간', '최대 168시간'], ['장기 이용', '40시간 이상 신청 가능']],
    useTitle: '이런 상황에 이용할 수 있어요',
    personalTitle: '여행·일상 동행',
    personalCases: ['상점에서 상품 정보나 구매 방법을 확인할 때', '병원·미용실·부동산 등에서 생활 통역이 필요할 때', '일정에 동행하며 이동과 현지 소통을 도와줄 사람이 필요할 때'],
    workTitle: '비즈니스·행사 지원',
    workCases: ['미팅, 시장 조사, 상권 벤치마킹 통역이 필요할 때', '팝업스토어·전시회·프로모션 현장 지원이 필요할 때', '고객 응대, 제품 설명, 현장 운영을 도울 인력이 필요할 때'],
    flowTitle: '진행 순서',
    steps: [
      { title: '신청서 작성', desc: '도시, 일정, 인원, 필요한 언어와 요청 사항을 알려 주세요.' },
      { title: '결제', desc: '예상 금액을 확인하고 결제합니다. 결제가 완료되면 신청서가 현지 담당자에게 자동으로 전달됩니다.' },
      { title: '현지 담당자 1:1 확인', desc: '현지 담당자가 1:1 문의에서 빠진 내용과 세부 조건을 확인합니다.' },
      { title: '호스트 배정·연결', desc: '로컬리가 일정, 언어, 경력을 확인해 호스트를 배정하고 전용 대화방을 열어 드립니다.' },
    ],
    noteTitle: '예약 전 확인해 주세요',
    notes: ['입장료, 티켓, 교통비, 식비 등 현장에서 발생하는 비용은 서비스 요금에 포함되지 않습니다.', '호스트에게 추가 비용이 발생하는 일정은 현지 담당자와 사전에 협의합니다.', '호스트 배정 전 취소는 전액 환불을 원칙으로 하며, 배정 후에는 취소 시점과 진행 상태에 따라 환불 기준이 달라질 수 있습니다.'],
    finalTitle: '호스트는 로컬리가 찾겠습니다.',
    finalDesc: '고객은 필요한 내용만 알려 주세요. 결제 후 현지 담당자가 1:1 문의에서 확인하고 적합한 호스트를 연결합니다.',
  },
  en: {
    eyebrow: 'Locally · Custom support in Japan',
    title: 'Local companion and interpreting,\ntailored to your plans',
    desc: 'From everyday travel help to business support, Locally reviews your request and directly assigns a host who fits your schedule and purpose.',
    cta: 'Start a custom request',
    pricingTitle: 'Rates',
    general: 'Companion & everyday interpreting',
    generalScope: '1–5 guests',
    generalPrice: 'KRW 35,000 per hour',
    business: 'Business interpreting & on-site support',
    businessScope: 'Business requests or 6+ guests',
    businessPrice: 'KRW 55,000 per hour',
    pricingRule: 'The business and 6+ guest conditions do not stack. The hourly rate remains KRW 55,000.',
    durationTitle: 'Time limits',
    durationRows: [['Per date', '3–24 hours'], ['Total', 'Up to 168 hours'], ['Long bookings', '40+ hours supported']],
    useTitle: 'When to use this service',
    personalTitle: 'Travel & everyday help',
    personalCases: ['Ask about products or purchases at local shops', 'Get help at hospitals, salons, or real-estate offices', 'Have someone assist with local communication throughout your itinerary'],
    workTitle: 'Business & events',
    workCases: ['Interpret for meetings, market research, or district benchmarking', 'Support pop-ups, exhibitions, and promotions', 'Help with customer service, product explanations, and on-site operations'],
    flowTitle: 'How it works',
    steps: [
      { title: 'Submit a request', desc: 'Share the city, schedule, group size, languages, and what you need.' },
      { title: 'Pay', desc: 'Review the total and pay. Your form is automatically delivered to a local coordinator after payment.' },
      { title: 'Private coordinator review', desc: 'A local coordinator confirms missing details and specific conditions in private chat.' },
      { title: 'Host assignment', desc: 'Locally checks schedule, language, and experience, then assigns a host and opens a separate chat.' },
    ],
    noteTitle: 'Before you book',
    notes: ['Admission, tickets, transportation, meals, and other on-site expenses are not included.', 'Any schedule that creates extra host expenses will be discussed in advance.', 'Cancellations before host assignment are fully refundable in principle. After assignment, the refund depends on timing and progress.'],
    finalTitle: 'Let Locally find the host.',
    finalDesc: 'Simply tell us what you need. After payment, a local coordinator reviews the details and connects you with the right host.',
  },
  ja: {
    eyebrow: 'Locally · 日本現地オーダーメイドサービス',
    title: '日本現地の同行・通訳を、\n必要な分だけオーダーメイドで',
    desc: '旅行中の生活通訳からビジネス現場のサポートまで。ご依頼内容をもとに、Locallyが日程と目的に合うホストを直接手配します。',
    cta: 'オーダーメイドで依頼する',
    pricingTitle: 'ご利用料金',
    general: '一般同行・生活通訳',
    generalScope: '1～5名',
    generalPrice: '1時間35,000ウォン',
    business: 'ビジネス通訳・現場サポート',
    businessScope: 'ビジネス目的または6名以上',
    businessPrice: '1時間55,000ウォン',
    pricingRule: 'ビジネスと6名以上の条件が重なっても、追加料金は重複しません。',
    durationTitle: '時間の基準',
    durationRows: [['1日の利用時間', '3～24時間'], ['合計利用時間', '最大168時間'], ['長期利用', '40時間以上も申請可能']],
    useTitle: 'このような場面で利用できます',
    personalTitle: '旅行・日常の同行',
    personalCases: ['店舗で商品情報や購入方法を確認したいとき', '病院、美容室、不動産などで生活通訳が必要なとき', '旅程に同行し、移動や現地での会話を手伝ってほしいとき'],
    workTitle: 'ビジネス・イベント支援',
    workCases: ['会議、市場調査、商圏視察の通訳が必要なとき', 'ポップアップ、展示会、プロモーションの現場支援が必要なとき', '接客、商品説明、現場運営を支援する人材が必要なとき'],
    flowTitle: 'ご利用の流れ',
    steps: [
      { title: '申請フォームを入力', desc: '都市、日程、人数、必要な言語、ご依頼内容を入力します。' },
      { title: '決済', desc: '金額を確認して決済します。完了後、申請内容が担当者へ自動で送信されます。' },
      { title: '現地担当者が1:1で確認', desc: '現地担当者が1:1のお問い合わせで不足情報と詳細条件を確認します。' },
      { title: 'ホスト手配・連絡', desc: '日程、言語、経験を確認してホストを手配し、専用チャットを開きます。' },
    ],
    noteTitle: 'ご予約前にご確認ください',
    notes: ['入場料、チケット、交通費、食費など現地で発生する費用は含まれません。', 'ホストに追加費用が発生する日程は、事前に担当者と相談します。', 'ホスト手配前のキャンセルは原則全額返金です。手配後は時期と進行状況により基準が異なります。'],
    finalTitle: 'ホスト探しはLocallyにお任せください。',
    finalDesc: '必要な内容だけお知らせください。決済後、現地担当者が1:1で確認し、最適なホストを手配します。',
  },
  zh: {
    eyebrow: 'Locally · 日本当地定制服务',
    title: '日本当地陪同与口译，\n按实际需要灵活定制',
    desc: '从旅行生活口译到商务现场支持，Locally会根据您的需求、日程和目的直接安排合适的向导。',
    cta: '提交定制需求',
    pricingTitle: '服务价格',
    general: '普通陪同与生活口译',
    generalScope: '1–5人',
    generalPrice: '每小时35,000韩元',
    business: '商务口译与现场支持',
    businessScope: '商务需求或6人以上',
    businessPrice: '每小时55,000韩元',
    pricingRule: '商务服务与6人以上两个条件同时满足时不会重复加价。',
    durationTitle: '时长标准',
    durationRows: [['每天', '3–24小时'], ['总时长', '最多168小时'], ['长期服务', '支持40小时以上']],
    useTitle: '适合这些场景',
    personalTitle: '旅行与日常陪同',
    personalCases: ['在商店了解商品信息或购买方式', '在医院、美容院或房产机构需要生活口译', '希望有人陪同行程并协助当地沟通'],
    workTitle: '商务与活动支持',
    workCases: ['会议、市场调研或商圈考察口译', '快闪店、展会或推广活动现场支持', '客户接待、产品说明与现场运营协助'],
    flowTitle: '服务流程',
    steps: [
      { title: '填写申请', desc: '填写城市、日程、人数、所需语言和具体需求。' },
      { title: '付款', desc: '确认金额并付款。付款完成后，申请表会自动发送给当地负责人。' },
      { title: '当地负责人一对一确认', desc: '当地负责人会通过一对一咨询确认缺失信息和详细条件。' },
      { title: '安排并联系向导', desc: 'Locally根据日程、语言和经验安排向导，并开启单独的沟通窗口。' },
    ],
    noteTitle: '预订前请确认',
    notes: ['门票、交通、餐饮及其他现场费用不包含在服务费内。', '如行程会产生向导额外费用，当地负责人会提前与您确认。', '原则上，安排向导前取消可全额退款；安排后将根据取消时间和进度适用不同标准。'],
    finalTitle: '向导由Locally为您寻找。',
    finalDesc: '您只需告诉我们实际需求。付款后，当地负责人会一对一确认并安排最合适的向导。',
  },
};

export default function ServiceIntroPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const startRequest = () => router.push('/services/request');

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pb-36 md:px-8 md:pb-20">
        <section className="grid gap-12 border-b border-zinc-200 py-14 md:grid-cols-[minmax(0,1fr)_280px] md:items-end md:py-20">
          <div>
            <p className="text-xs font-medium tracking-wide text-zinc-500">{copy.eyebrow}</p>
            <h1 className="mt-5 whitespace-pre-line text-4xl font-semibold leading-[1.15] tracking-[-0.04em] md:text-6xl">{copy.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg">{copy.desc}</p>
            <button type="button" onClick={startRequest} className="mt-8 hidden items-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:inline-flex">
              {copy.cta}<ArrowRight size={16} />
            </button>
          </div>
          <div className="border-l border-zinc-200 pl-5 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-950">{copy.durationTitle}</p>
            <dl className="mt-4 space-y-3">
              {copy.durationRows.map(([label, value]) => <div key={label} className="flex justify-between gap-6"><dt>{label}</dt><dd className="font-medium text-zinc-950">{value}</dd></div>)}
            </dl>
          </div>
        </section>

        <DocumentSection index="01" title={copy.pricingTitle}>
          <div className="border-y border-zinc-200">
            {[
              [copy.general, copy.generalScope, copy.generalPrice],
              [copy.business, copy.businessScope, copy.businessPrice],
            ].map(([title, scope, price], index) => (
              <div key={title} className={`grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center ${index > 0 ? 'border-t border-zinc-200' : ''}`}>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-zinc-500">{scope}</p>
                <p className="text-lg font-semibold sm:text-right">{price}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-500">{copy.pricingRule}</p>
        </DocumentSection>

        <DocumentSection index="02" title={copy.useTitle}>
          <div className="grid border-y border-zinc-200 md:grid-cols-2">
            <UseCaseList title={copy.personalTitle} items={copy.personalCases} />
            <UseCaseList title={copy.workTitle} items={copy.workCases} className="border-t border-zinc-200 md:border-l md:border-t-0" />
          </div>
        </DocumentSection>

        <DocumentSection index="03" title={copy.flowTitle}>
          <ol className="border-t border-zinc-200">
            {copy.steps.map((step, index) => (
              <li key={step.title} className="grid gap-2 border-b border-zinc-200 py-5 sm:grid-cols-[48px_190px_minmax(0,1fr)]">
                <span className="text-sm tabular-nums text-zinc-400">{String(index + 1).padStart(2, '0')}</span>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm leading-6 text-zinc-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </DocumentSection>

        <DocumentSection index="04" title={copy.noteTitle}>
          <div className="rounded-lg bg-zinc-100 px-5 py-4">
            {copy.notes.map((note) => <p key={note} className="flex gap-3 border-b border-zinc-200 py-3 text-sm leading-6 text-zinc-700 last:border-0"><Check className="mt-1 shrink-0" size={14} />{note}</p>)}
          </div>
        </DocumentSection>

        <section className="grid gap-6 border-t border-zinc-950 py-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-zinc-500"><MessageSquareText size={16} /><span className="text-xs font-medium">1:1 Concierge</span></div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">{copy.finalTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{copy.finalDesc}</p>
          </div>
          <button type="button" onClick={startRequest} className="hidden items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 md:inline-flex">{copy.cta}<ArrowRight size={16} /></button>
        </section>
      </main>

      <div data-testid="service-intro-mobile-cta" className="fixed left-14 right-3 z-[120] rounded-lg border border-zinc-200 bg-white p-2 shadow-[0_8px_32px_rgba(0,0,0,0.16)] md:hidden" style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" onClick={startRequest} className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white">{copy.cta}<ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function DocumentSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-zinc-200 py-10 md:grid-cols-[180px_minmax(0,1fr)] md:py-14">
      <div><p className="text-xs tabular-nums text-zinc-400">{index}</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{title}</h2></div>
      <div>{children}</div>
    </section>
  );
}

function UseCaseList({ title, items, className = '' }: { title: string; items: string[]; className?: string }) {
  return (
    <div className={`p-5 md:p-6 ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
        {items.map((item) => <li key={item} className="flex gap-3"><span className="text-zinc-400">—</span><span>{item}</span></li>)}
      </ul>
    </div>
  );
}
