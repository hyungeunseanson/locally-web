import React from 'react';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

export default function GuidelinesTab() {
    const { t } = useLanguage();

    return (
        <div className="max-w-2xl md:max-w-4xl mx-auto space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-1 md:px-0">

            {/* 히어로 배너 */}
            <div className="bg-slate-900 text-white px-5 py-6 md:p-10 rounded-2xl md:rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-rose-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="relative z-10">
                    <span className="bg-rose-500 text-white font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs mb-2 md:mb-4 inline-block">{t('hg_badge')}</span>
                    <h1 className="text-[16px] md:text-3xl font-black mb-1.5 md:mb-3">{t('hg_title')}</h1>
                    <p className="text-slate-300 text-[11px] md:text-sm md:max-w-lg leading-relaxed">{t('hg_desc')}</p>
                </div>
            </div>

            {/* 정책 카드들 */}
            <div className="space-y-3 md:space-y-6">

                {/* Policy 1 */}
                <div className="bg-white px-4 py-4 md:p-8 rounded-2xl md:rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden md:hover:border-rose-300 transition-colors">
                    <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-rose-500" />
                    <h2 className="text-[13px] md:text-xl font-bold flex items-center gap-1.5 md:gap-2 mb-2.5 md:mb-4 text-slate-900">
                        <Lock className="text-rose-500 shrink-0" size={18} /> {t('hg_policy1_title')}
                    </h2>
                    <div className="text-slate-600 space-y-2 md:space-y-4 text-[11px] md:text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-rose-50 px-3 py-2 md:p-4 rounded-xl">
                            {t('hg_policy1_desc')}
                        </p>
                        <ul className="list-disc pl-4 md:pl-5 space-y-1 md:space-y-2">
                            <li>{t('hg_policy1_item1')}</li>
                            <li>{t('hg_policy1_item2')}</li>
                            <li><strong>{t('hg_policy1_item3')}</strong></li>
                        </ul>
                    </div>
                </div>

                {/* Policy 2 */}
                <div className="bg-white px-4 py-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden md:hover:border-slate-300 transition-colors">
                    <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-blue-500" />
                    <h2 className="text-[13px] md:text-xl font-bold flex items-center gap-1.5 md:gap-2 mb-2.5 md:mb-4 text-slate-900">
                        <User className="text-blue-500 shrink-0" size={18} /> {t('hg_policy2_title')}
                    </h2>
                    <div className="text-slate-600 space-y-2 md:space-y-4 text-[11px] md:text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-blue-50 px-3 py-2 md:p-4 rounded-xl">
                            {t('hg_policy2_desc')}
                        </p>
                        <ul className="list-disc pl-4 md:pl-5 space-y-1 md:space-y-2">
                            <li>{t('hg_policy2_item1')}</li>
                            <li>{t('hg_policy2_item2')}</li>
                            <li>{t('hg_policy2_item3')}</li>
                        </ul>
                    </div>
                </div>

                {/* Policy 3 */}
                <div className="bg-white px-4 py-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden md:hover:border-slate-300 transition-colors">
                    <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-green-500" />
                    <h2 className="text-[13px] md:text-xl font-bold flex items-center gap-1.5 md:gap-2 mb-2.5 md:mb-4 text-slate-900">
                        <ShieldCheck className="text-green-500 shrink-0" size={18} /> {t('hg_policy3_title')}
                    </h2>
                    <div className="text-slate-600 space-y-2 md:space-y-4 text-[11px] md:text-sm leading-relaxed">
                        <p className="font-medium text-slate-800 bg-green-50 px-3 py-2 md:p-4 rounded-xl">
                            {t('hg_policy3_desc')}
                        </p>
                        <ul className="list-disc pl-4 md:pl-5 space-y-1 md:space-y-2">
                            <li>{t('hg_policy3_item1')}</li>
                            <li>{t('hg_policy3_item2')}</li>
                            <li>{t('hg_policy3_item3')}</li>
                        </ul>
                    </div>
                </div>

            </div>

            {/* 브랜드형 엔딩 섹션 */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:rounded-3xl md:p-8">
                <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-slate-200/40 blur-3xl md:h-40 md:w-40" />
                <div className="absolute -bottom-12 left-0 h-24 w-24 rounded-full bg-slate-100/80 blur-3xl md:h-32 md:w-32" />

                <div className="relative z-10">
                    <div className="max-w-2xl">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-200 md:text-[11px]">
                            {t('hg_footer_eyebrow')}
                        </span>
                        <h3 className="mt-3 text-[20px] font-black tracking-[-0.03em] text-slate-900 md:text-[30px]">
                            {t('hg_footer_title')}
                        </h3>
                        <p className="mt-2 text-[12px] leading-relaxed text-slate-600 md:text-[14px] md:leading-7">
                            {t('hg_footer_desc')}
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                    {[t('hg_footer_chip1'), t('hg_footer_chip2'), t('hg_footer_chip3')].map((item) => (
                        <span
                            key={item}
                            className="rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 md:text-xs"
                        >
                            {item}
                        </span>
                    ))}
                </div>

                <p className="relative z-10 mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:text-[11px]">
                    {t('hg_footer_signature')}
                </p>
            </div>

        </div>
    );
}
