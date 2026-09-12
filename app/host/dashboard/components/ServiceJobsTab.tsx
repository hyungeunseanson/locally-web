'use client';

import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useLanguage, type Locale } from '@/app/context/LanguageContext';

const COPY: Record<Locale, { title: string; desc: string; items: string[]; inbox: string }> = {
  ko: { title: '현지 담당자 배정 방식으로 변경되었습니다', desc: '공개 의뢰 목록과 호스트 지원 기능은 더 이상 사용하지 않습니다. 로컬리 현지 담당자가 일정, 언어, 경력을 확인한 뒤 적합한 호스트에게 개별 연락합니다.', items: ['배정 전 일정과 보수를 현지 담당자가 먼저 확인합니다.', '수락과 조건은 현지 담당자와 협의합니다.', '배정 완료 후 고객 전용 문의가 생성됩니다.'], inbox: '문의함 확인' },
  en: { title: 'Services are now assigned by Locally', desc: 'The public job board and host applications are no longer used. A manager reviews schedule, language, and experience before contacting a suitable host.', items: ['Schedule and payout are confirmed before assignment.', 'Acceptance and conditions are discussed with a manager.', 'A private customer thread opens after assignment.'], inbox: 'Open inbox' },
  ja: { title: 'スタッフによる個別手配に変更されました', desc: '公開依頼一覧とホスト応募機能は終了しました。日程・言語・経験を確認後、専任スタッフが適切なホストへ個別に連絡します。', items: ['手配前に日程と報酬を確認します。', '受諾と条件はスタッフと相談します。', '手配完了後にお客様との専用お問い合わせが作成されます。'], inbox: 'お問い合わせを確認' },
  zh: { title: '现由管理员直接安排服务', desc: '公开需求列表和向导申请功能已停用。管理员会核对日程、语言与经验后单独联系合适的向导。', items: ['安排前会先确认日程与报酬。', '接受与服务条件由管理员沟通。', '安排完成后会创建客户专属咨询。'], inbox: '查看咨询' },
};

export default function ServiceJobsTab() {
  const router = useRouter();
  const { lang } = useLanguage();
  const copy = COPY[lang];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50"><ShieldCheck className="text-emerald-600" size={24} /></div>
      <h2 className="mt-5 text-lg font-black">{copy.title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">{copy.desc}</p>
      <div className="mt-5 space-y-3">{copy.items.map((item) => <p key={item} className="flex items-start gap-2 text-sm font-semibold leading-6 text-slate-700"><CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={16} />{item}</p>)}</div>
      <button type="button" onClick={() => router.push('/host/dashboard?tab=inquiries')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white"><MessageCircle size={16} />{copy.inbox}</button>
    </div>
  );
}
