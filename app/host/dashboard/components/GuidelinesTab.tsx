import React from 'react';
import { Lock, User, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

            {/* 푸터 */}
            <div className="text-center bg-slate-50 py-5 md:py-8 rounded-2xl border border-slate-100 md:mt-12">
                <div className="w-9 h-9 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4 shadow-sm border border-slate-200">
                    <CheckCircle2 className="text-slate-800" size={18} />
                </div>
                <p className="text-[11px] md:text-sm text-slate-500 font-bold mb-0.5 md:mb-1">{t('hg_footer_msg')}</p>
                <p className="text-[10px] md:text-xs text-slate-400">Locally Trust & Safety Team</p>
            </div>

        </div>
    );
}
