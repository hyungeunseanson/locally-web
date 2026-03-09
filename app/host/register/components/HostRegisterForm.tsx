'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Instagram,
  Lock,
  User,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { type LanguageLevel, type LanguageLevelEntry } from '@/app/utils/languageLevels';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  HOST_REGISTER_LANGUAGE_OPTIONS,
  getHostRegisterCopy,
  getLocalizedText,
} from '../localization';

type HostRegisterFormData = {
  languageLevels: LanguageLevelEntry[];
  languageCert: string;
  name: string;
  phone: string;
  dob: string;
  email: string;
  instagram: string;
  source: string;
  profilePhoto: string | null;
  selfIntro: string;
  idCardFile: string | null;
  hostNationality: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  motivation: string;
  agreeTerms: boolean;
  educationCompleted: boolean;
  agreeSafetyPolicy: boolean;
};

interface HostRegisterFormProps {
  step: number;
  totalSteps: number;
  formData: HostRegisterFormData;
  updateData: <K extends keyof HostRegisterFormData>(key: K, value: HostRegisterFormData[K]) => void;
  toggleLanguage: (lang: string) => void;
  updateLanguageLevel: (lang: string, level: LanguageLevel) => void;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profile' | 'idCard') => void;
  prevStep: () => void;
  nextStep: () => void;
  handleSubmit: () => void;
  loading: boolean;
}

function LanguageLevelSelector({
  entries,
  toggleLanguage,
  updateLanguageLevel,
}: {
  entries: LanguageLevelEntry[];
  toggleLanguage: (lang: string) => void;
  updateLanguageLevel: (lang: string, level: LanguageLevel) => void;
}) {
  const { lang } = useLanguage();

  return (
    <div className="space-y-4">
      {HOST_REGISTER_LANGUAGE_OPTIONS.map((languageOption) => {
        const current = entries.find((entry) => entry.language === languageOption.value);
        const isSelected = Boolean(current);

        return (
          <div
            key={languageOption.value}
            className={`rounded-2xl border p-4 transition-all ${isSelected ? 'border-black bg-slate-50 shadow-sm' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleLanguage(languageOption.value)}
                className="flex items-center gap-3 text-left"
              >
                <div className="text-3xl">{languageOption.flag}</div>
                <div>
                  <div className="font-bold text-base text-slate-900">{getLocalizedText(languageOption.labels, lang)}</div>
                  <div className="text-xs text-slate-400 font-medium">{getLocalizedText(languageOption.codeLabels, lang)}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage(languageOption.value)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-black bg-black text-white' : 'border-slate-300 text-transparent'}`}
              >
                <Check size={14} strokeWidth={3} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={!isSelected}
                  onClick={() => updateLanguageLevel(languageOption.value, level as LanguageLevel)}
                  className={`h-10 rounded-xl border text-[11px] font-bold transition-all ${
                    !isSelected
                      ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : current?.level === level
                        ? 'border-black bg-black text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  Lv.{level}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HostRegisterForm({
  step,
  totalSteps,
  formData,
  updateData,
  toggleLanguage,
  updateLanguageLevel,
  handlePhotoUpload,
  prevStep,
  nextStep,
  handleSubmit,
  loading,
}: HostRegisterFormProps) {
  const { lang } = useLanguage();
  const copy = getHostRegisterCopy(lang);
  const safetyIconMap = {
    shield: ShieldCheck,
    lock: Lock,
    user: User,
    creditCard: CreditCard,
    checkCircle: CheckCircle2,
  } as const;

  const renderMultilineText = (text: string) =>
    text.split('\n').map((line, index) => (
      <React.Fragment key={`${line}-${index}`}>
        {index > 0 && <br />}
        {line}
      </React.Fragment>
    ));

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {step < totalSteps + 1 && (
        <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-1.5 hover:bg-slate-50 rounded-full">
              <X size={20} className="text-slate-400" />
            </Link>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400">Step {step} / {totalSteps}</span>
              <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="w-10" />
        </header>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === 1 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step1Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step1Title)}</h1>
              <p className="text-sm text-slate-500">{copy.step1Desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => updateData('hostNationality', 'Korea')}
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Korea' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇰🇷</div>
                <div className="font-bold text-lg">{copy.nationalityKorea}</div>
              </button>
              <button
                type="button"
                onClick={() => updateData('hostNationality', 'Japan')}
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Japan' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇯🇵</div>
                <div className="font-bold text-lg">{copy.nationalityJapan}</div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step2Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step2Title)}</h1>
              <p className="text-sm text-slate-500">{copy.step2Desc}</p>
            </div>
            <LanguageLevelSelector
              entries={formData.languageLevels}
              toggleLanguage={toggleLanguage}
              updateLanguageLevel={updateLanguageLevel}
            />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <label className="font-bold block mb-1.5 text-xs ml-1 text-slate-500">{copy.languageCertLabel}</label>
              <input
                type="text"
                placeholder={copy.languageCertPlaceholder}
                value={formData.languageCert}
                onChange={(e) => updateData('languageCert', e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-black transition-all text-sm"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step3Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step3Title)}</h1>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.nameLabel}</label>
                  <input type="text" placeholder={copy.namePlaceholder} value={formData.name} onChange={(e) => updateData('name', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.dobLabel}</label>
                  <input type="text" placeholder={copy.dobPlaceholder} value={formData.dob} onChange={(e) => updateData('dob', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.phoneLabel}</label>
                <input type="tel" placeholder={copy.phonePlaceholder} value={formData.phone} onChange={(e) => updateData('phone', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.emailLabel}</label>
                <input type="email" placeholder={copy.emailPlaceholder} value={formData.email} onChange={(e) => updateData('email', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 flex items-center gap-1"><Instagram size={12} /> {copy.instagramLabel}</label>
                  <input type="text" placeholder={copy.instagramPlaceholder} value={formData.instagram} onChange={(e) => updateData('instagram', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.sourceLabel}</label>
                  <input type="text" placeholder={copy.sourcePlaceholder} value={formData.source} onChange={(e) => updateData('source', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step4Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step4Title)}</h1>
            </div>
            <div className="flex flex-col items-center gap-6">
              <label className="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-black overflow-hidden relative bg-slate-50">
                {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" alt="프로필 미리보기" /> : <Camera size={24} className="text-slate-400" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'profile')} />
              </label>
              <div className="w-full text-left">
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.selfIntroLabel}</label>
                <textarea placeholder={copy.selfIntroPlaceholder} value={formData.selfIntro} onChange={(e) => updateData('selfIntro', e.target.value)} className="w-full p-3.5 h-32 bg-slate-50 rounded-xl outline-none text-sm resize-none border border-transparent focus:border-black focus:bg-white transition-all" />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-purple-50 text-purple-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step5Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step5Title)}</h1>
              <p className="text-sm text-slate-500">{copy.step5Desc}</p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:bg-slate-50 transition-all cursor-pointer group relative">
              <input type="file" accept="image/*" className="hidden" id="id-upload" onChange={(e) => handlePhotoUpload(e, 'idCard')} />
              {formData.idCardFile ? (
                <div className="relative h-40 w-full flex flex-col items-center justify-center">
                  <img src={formData.idCardFile} className="h-full object-contain rounded-lg shadow-sm" alt="신분증 미리보기" />
                  <button type="button" onClick={(e) => { e.preventDefault(); updateData('idCardFile', null); }} className="absolute top-0 right-0 bg-black text-white p-1.5 rounded-full hover:scale-110 transition-transform"><X size={14} /></button>
                  <p className="text-green-600 font-bold mt-4 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full text-sm"><CheckCircle2 size={16} /> {copy.uploadDone}</p>
                </div>
              ) : (
                <label htmlFor="id-upload" className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                    <CreditCard size={32} className="text-slate-400 group-hover:text-black" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-slate-800">{copy.idUploadTitle}</h3>
                  <p className="text-xs text-slate-400 mb-6">{copy.idUploadDesc}</p>
                  <span className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all">{copy.chooseFileButton}</span>
                </label>
              )}
            </div>
            <p className="text-[12px] text-slate-400 text-center mt-4 bg-slate-50 py-2 rounded-lg">{copy.idSecurityNote}</p>
          </div>
        )}

        {step === 6 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-green-50 text-green-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step6Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step6Title)}</h1>
              <p className="text-sm text-slate-500">{copy.step6Desc}</p>
            </div>
            <div className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.bankNameLabel}</label>
                <div className="relative"><Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={copy.bankNamePlaceholder} value={formData.bankName} onChange={(e) => updateData('bankName', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.accountNumberLabel}</label>
                <div className="relative"><CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="tel" placeholder={copy.accountNumberPlaceholder} value={formData.accountNumber} onChange={(e) => updateData('accountNumber', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">{copy.accountHolderLabel}</label>
                <div className="relative"><User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={copy.accountHolderPlaceholder} value={formData.accountHolder} onChange={(e) => updateData('accountHolder', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">{copy.step7Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{copy.step7Title}</h1>
              <p className="text-sm text-slate-500">{copy.step7Desc}</p>
            </div>
            <textarea placeholder={copy.motivationPlaceholder} value={formData.motivation} onChange={(e) => updateData('motivation', e.target.value)} className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none text-sm resize-none border border-slate-200 focus:border-black transition-all" />
            <div className="pt-2 text-left">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${formData.agreeTerms ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
                  {formData.agreeTerms && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={formData.agreeTerms} onChange={(e) => updateData('agreeTerms', e.target.checked)} />
                <span className="text-xs text-slate-500 leading-relaxed">
                  {renderMultilineText(copy.pledgeText)}
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="w-full space-y-8 animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="text-center">
              <span className="bg-red-50 text-red-600 font-bold px-2.5 py-1 rounded-full text-[10px] animate-pulse">{copy.step8Badge}</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">{renderMultilineText(copy.step8Title)}</h1>
              <p className="text-sm text-slate-500">{copy.step8Desc}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 h-64 w-full text-sm text-slate-700 space-y-6 shadow-inner relative overflow-y-auto">
              {copy.safetyPolicies.map((policy, index) => {
                const Icon = safetyIconMap[policy.icon];
                return (
                  <React.Fragment key={policy.title}>
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><Icon size={16} className={policy.accentClass} /> {policy.title}</h3>
                      <p className="leading-relaxed text-xs">{policy.description}</p>
                    </div>
                    {index < copy.safetyPolicies.length - 1 && <div className="h-px bg-slate-200 w-full"></div>}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border transition-all hover:bg-slate-50 border-slate-200">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${formData.educationCompleted ? 'bg-black border-black text-white' : 'border-slate-300 bg-white'}`}>
                  <CheckCircle2 size={14} className={formData.educationCompleted ? 'opacity-100' : 'opacity-0'} />
                </div>
                <input type="checkbox" className="hidden" checked={formData.educationCompleted} onChange={(e) => updateData('educationCompleted', e.target.checked)} />
                <span className="text-xs text-slate-600 font-bold leading-relaxed">
                  {renderMultilineText(copy.policyReadCheckbox)}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100/50 transition-all">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${formData.agreeSafetyPolicy ? 'bg-red-600 border-red-600 text-white' : 'border-red-300 bg-white'}`}>
                  <CheckCircle2 size={14} className={formData.agreeSafetyPolicy ? 'opacity-100' : 'opacity-0'} />
                </div>
                <input type="checkbox" className="hidden" checked={formData.agreeSafetyPolicy} onChange={(e) => updateData('agreeSafetyPolicy', e.target.checked)} />
                <span className="text-xs text-slate-900 font-bold leading-relaxed">
                  {renderMultilineText(copy.policyAgreeCheckbox)}
                </span>
              </label>
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between">
        <button onClick={prevStep} disabled={step === 1} className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>{copy.prevButton}</button>
        {step === totalSteps ? (
          <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50 flex items-center gap-2">
            {loading ? copy.submittingButton : copy.submitButton}
          </button>
        ) : (
          <button onClick={nextStep} className="bg-black text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">{copy.nextButton} <ChevronRight size={16} /></button>
        )}
      </footer>
    </div>
  );
}
