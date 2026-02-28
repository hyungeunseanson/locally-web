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

const LANGUAGE_OPTIONS = [
  { label: '한국어', code: 'Korean', flag: '🇰🇷' },
  { label: '영어', code: 'English', flag: '🇺🇸' },
  { label: '일본어', code: 'Japanese', flag: '🇯🇵' },
  { label: '중국어', code: 'Chinese', flag: '🇨🇳' },
];

function LanguageLevelSelector({
  entries,
  toggleLanguage,
  updateLanguageLevel,
}: {
  entries: LanguageLevelEntry[];
  toggleLanguage: (lang: string) => void;
  updateLanguageLevel: (lang: string, level: LanguageLevel) => void;
}) {
  return (
    <div className="space-y-4">
      {LANGUAGE_OPTIONS.map((lang) => {
        const current = entries.find((entry) => entry.language === lang.label);
        const isSelected = Boolean(current);

        return (
          <div
            key={lang.label}
            className={`rounded-2xl border p-4 transition-all ${isSelected ? 'border-black bg-slate-50 shadow-sm' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleLanguage(lang.label)}
                className="flex items-center gap-3 text-left"
              >
                <div className="text-3xl">{lang.flag}</div>
                <div>
                  <div className="font-bold text-base text-slate-900">{lang.label}</div>
                  <div className="text-xs text-slate-400 font-medium">{lang.code}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage(lang.label)}
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
                  onClick={() => updateLanguageLevel(lang.label, level as LanguageLevel)}
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
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 1. 국적 선택</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">호스트님의 국적은<br />어디인가요?</h1>
              <p className="text-sm text-slate-500">신분증 확인 및 정산 통화 기준이 됩니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => updateData('hostNationality', 'Korea')}
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Korea' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇰🇷</div>
                <div className="font-bold text-lg">한국인</div>
              </button>
              <button
                type="button"
                onClick={() => updateData('hostNationality', 'Japan')}
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Japan' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇯🇵</div>
                <div className="font-bold text-lg">일본인</div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 2. 구사 언어 및 레벨</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">어떤 언어로 소통이<br />가능하신가요?</h1>
              <p className="text-sm text-slate-500">선택한 각 언어의 레벨을 함께 설정해 주세요.</p>
            </div>
            <LanguageLevelSelector
              entries={formData.languageLevels}
              toggleLanguage={toggleLanguage}
              updateLanguageLevel={updateLanguageLevel}
            />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <label className="font-bold block mb-1.5 text-xs ml-1 text-slate-500">어학 자격증 (선택사항)</label>
              <input
                type="text"
                placeholder="예) JLPT N1, TOEIC 900"
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
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 3. 기본 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">호스트님의<br />연락처를 알려주세요</h1>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e) => updateData('name', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e) => updateData('dob', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">휴대전화 번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e) => updateData('phone', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">이메일 주소</label>
                <input type="email" placeholder="example@gmail.com" value={formData.email} onChange={(e) => updateData('email', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 flex items-center gap-1"><Instagram size={12} /> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e) => updateData('instagram', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">가입 경로</label>
                  <input type="text" placeholder="예) 인스타, 지인 추천" value={formData.source} onChange={(e) => updateData('source', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 4. 프로필 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">게스트에게 보여질<br />모습을 꾸며보세요</h1>
            </div>
            <div className="flex flex-col items-center gap-6">
              <label className="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-black overflow-hidden relative bg-slate-50">
                {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" alt="프로필 미리보기" /> : <Camera size={24} className="text-slate-400" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'profile')} />
              </label>
              <div className="w-full text-left">
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">자기소개</label>
                <textarea placeholder="안녕하세요! 저는 여행과 사진을 좋아하는 호스트입니다. (최소 50자 이상)" value={formData.selfIntro} onChange={(e) => updateData('selfIntro', e.target.value)} className="w-full p-3.5 h-32 bg-slate-50 rounded-xl outline-none text-sm resize-none border border-transparent focus:border-black focus:bg-white transition-all" />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-purple-50 text-purple-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 5. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">인증된 호스트<br />배지를 받아보세요</h1>
              <p className="text-sm text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={14} className="inline" /> 인증 배지</span>가 표시됩니다.</p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:bg-slate-50 transition-all cursor-pointer group relative">
              <input type="file" accept="image/*" className="hidden" id="id-upload" onChange={(e) => handlePhotoUpload(e, 'idCard')} />
              {formData.idCardFile ? (
                <div className="relative h-40 w-full flex flex-col items-center justify-center">
                  <img src={formData.idCardFile} className="h-full object-contain rounded-lg shadow-sm" alt="신분증 미리보기" />
                  <button type="button" onClick={(e) => { e.preventDefault(); updateData('idCardFile', null); }} className="absolute top-0 right-0 bg-black text-white p-1.5 rounded-full hover:scale-110 transition-transform"><X size={14} /></button>
                  <p className="text-green-600 font-bold mt-4 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full text-sm"><CheckCircle2 size={16} /> 업로드 완료</p>
                </div>
              ) : (
                <label htmlFor="id-upload" className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                    <CreditCard size={32} className="text-slate-400 group-hover:text-black" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-slate-800">신분증 업로드</h3>
                  <p className="text-xs text-slate-400 mb-6">주민등록증, 운전면허증, 여권 중 택 1</p>
                  <span className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all">파일 선택하기</span>
                </label>
              )}
            </div>
            <p className="text-[12px] text-slate-400 text-center mt-4 bg-slate-50 py-2 rounded-lg">* 제출된 신분증 정보는 본인 확인 용도로만 사용되며, 확인 즉시 안전하게 파기됩니다.</p>
          </div>
        )}

        {step === 6 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-green-50 text-green-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 6. 정산 계좌</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">수익을 지급받을<br />계좌를 알려주세요</h1>
              <p className="text-sm text-slate-500">본인 명의의 계좌만 등록 가능합니다.</p>
            </div>
            <div className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">은행명</label>
                <div className="relative"><Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="예) 카카오뱅크, 신한은행" value={formData.bankName} onChange={(e) => updateData('bankName', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">계좌번호</label>
                <div className="relative"><CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="tel" placeholder="- 없이 숫자만 입력" value={formData.accountNumber} onChange={(e) => updateData('accountNumber', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">예금주</label>
                <div className="relative"><User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="본인 실명" value={formData.accountHolder} onChange={(e) => updateData('accountHolder', e.target.value)} className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm" /></div>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 7. 신청 사유</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">마지막 질문입니다!</h1>
              <p className="text-sm text-slate-500">로컬리 호스트가 되고 싶은 이유를 적어주세요.</p>
            </div>
            <textarea placeholder="예) 외국인 친구들과 교류하는 것을 좋아해서 지원하게 되었습니다." value={formData.motivation} onChange={(e) => updateData('motivation', e.target.value)} className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none text-sm resize-none border border-slate-200 focus:border-black transition-all" />
            <div className="pt-2 text-left">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${formData.agreeTerms ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
                  {formData.agreeTerms && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={formData.agreeTerms} onChange={(e) => updateData('agreeTerms', e.target.checked)} />
                <span className="text-xs text-slate-500 leading-relaxed">
                  본인은 로컬리 호스트로서 투명하고 정직하게 활동할 것을 약속하며, <br />위 기재된 정보가 사실과 다를 경우 승인이 취소될 수 있음을 확인합니다.
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="w-full space-y-8 animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="text-center">
              <span className="bg-red-50 text-red-600 font-bold px-2.5 py-1 rounded-full text-[10px] animate-pulse">Step 8. 필수 교육 숙지</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">안전하고 올바른<br />호스팅을 위한 서약</h1>
              <p className="text-sm text-slate-500">제출하기 전 아래 안전 가이드라인을 반드시 정독해 주세요.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 h-64 w-full text-sm text-slate-700 space-y-6 shadow-inner relative overflow-y-auto">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><ShieldCheck size={16} className="text-red-500" /> 1. 플랫폼 외부 결제 유도 금지</h3>
                <p className="leading-relaxed text-xs">수수료 회피를 목적으로 게스트에게 <strong>개인 계좌 이체, 현금 결제, 타 플랫폼 링크를 요구하는 행위</strong>는 엄격히 금지됩니다. 적발 시 <strong className="text-red-600">즉각적인 계정 영구 정지</strong> 조치가 내려지며, 누적 예약금을 몰수당할 수 있습니다.</p>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><Lock size={16} className="text-red-500" /> 2. 개인정보 교환 제한 및 스팸 차단</h3>
                <p className="leading-relaxed text-xs">예약이 확정되기 전(결제 완료 전) 개인 연락처, 카카오톡 아이디, 이메일 등을 사전 교환할 수 없습니다. 안전한 거래를 위해 초기 문의 소통은 모두 로컬리 내부 메시지로 진행하십시오.</p>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><User size={16} className="text-blue-500" /> 3. 게스트 상호 안전 매뉴얼</h3>
                <p className="leading-relaxed text-xs">활동 중 발생할 수 있는 사고를 대비하여 게스트에게 적절한 안전 장비와 가이드라인을 제공할 책임이 있습니다. 상호 존중 없는 부적절한 차별은 허용되지 않습니다.</p>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><CreditCard size={16} className="text-red-500" /> 4. 예약 확정 후 무단 취소 및 노쇼 금지</h3>
                <p className="leading-relaxed text-xs">호스트는 예약이 확정된 체험에 대해 정당한 사유 없이 일방적으로 취소하거나, 약속된 시간과 장소에 나타나지 않는 행위를 해서는 안 됩니다. 호스트의 무단 취소 및 노쇼는 게스트의 여행 일정에 보상 불가한 큰 피해를 줄 수 있으며, 적발 시 정산 보류, 계정 정지 등의 조치가 이루어질 수 있습니다.</p>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><CheckCircle2 size={16} className="text-blue-500" /> 5. 예약 후 응답 및 일정 안내 의무</h3>
                <p className="leading-relaxed text-xs">호스트는 예약 확정 후 게스트의 문의, 일정 확인, 집합 장소 안내 등에 성실히 응답해야 합니다. 체험 진행에 필요한 핵심 안내를 누락하거나 장시간 응답하지 않아 게스트에게 혼선을 주는 경우, 서비스 품질 저하로 간주되어 운영상 불이익이 발생할 수 있습니다.</p>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2"><User size={16} className="text-blue-500" /> 6. 체험 내용의 성실 이행 의무</h3>
                <p className="leading-relaxed text-xs">호스트는 등록한 체험 설명, 진행 시간, 포함 사항 등의 내용을 실제와 최대한 일치하도록 운영해야 합니다. 고의로 과장된 설명을 등록하거나, 현장에서 사전 안내 없이 체험 내용을 축소·변경하는 행위는 신뢰 위반으로 간주됩니다.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border transition-all hover:bg-slate-50 border-slate-200">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${formData.educationCompleted ? 'bg-black border-black text-white' : 'border-slate-300 bg-white'}`}>
                  <CheckCircle2 size={14} className={formData.educationCompleted ? 'opacity-100' : 'opacity-0'} />
                </div>
                <input type="checkbox" className="hidden" checked={formData.educationCompleted} onChange={(e) => updateData('educationCompleted', e.target.checked)} />
                <span className="text-xs text-slate-600 font-bold leading-relaxed">
                  [필수] 위 호스트 안전 가이드라인 및 플랫폼 이용 수칙을 모두 정독하고 숙지하였습니다.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100/50 transition-all">
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${formData.agreeSafetyPolicy ? 'bg-red-600 border-red-600 text-white' : 'border-red-300 bg-white'}`}>
                  <CheckCircle2 size={14} className={formData.agreeSafetyPolicy ? 'opacity-100' : 'opacity-0'} />
                </div>
                <input type="checkbox" className="hidden" checked={formData.agreeSafetyPolicy} onChange={(e) => updateData('agreeSafetyPolicy', e.target.checked)} />
                <span className="text-xs text-slate-900 font-bold leading-relaxed">
                  [필수] 위반 시 계정 영구 정지 및 법적 책임이 따를 수 있음에 동의하며,<br />로컬리의 정직한 파트너로 활동할 것을 서약합니다.
                </span>
              </label>
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between">
        <button onClick={prevStep} disabled={step === 1} className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>이전</button>
        {step === totalSteps ? (
          <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50 flex items-center gap-2">
            {loading ? '신청 중...' : '신청 완료하기'}
          </button>
        ) : (
          <button onClick={nextStep} className="bg-black text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">다음 <ChevronRight size={16} /></button>
        )}
      </footer>
    </div>
  );
}
