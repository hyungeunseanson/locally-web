'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, MapPin, X, User, Instagram, 
  CheckCircle2, ShieldCheck, Flag, CreditCard, Smile, MessageSquare
} from 'lucide-react';
import Link from 'next/link';

export default function HostRegisterPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 7; // 단계 재조정

  const [formData, setFormData] = useState({
    // Step 1: 내 국적 (Host Nationality)
    hostNationality: '', 

    // Step 2: 타겟 언어 (Guest Language)
    targetLanguage: '', 

    // Step 3: 기본 정보
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',

    // Step 4: 언어 능력
    languageLevel: 3, 
    languageCert: '',

    // Step 5: 프로필 (사진/소개)
    profilePhoto: null as string | null,
    selfIntro: '',

    // Step 6: 신분 인증
    idCardFile: null as string | null,

    // Step 7: 신청 사유 (Motivation)
    motivation: ''
  });

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      updateData(fieldName, url);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 상단 진행바 */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-1.5 hover:bg-slate-50 rounded-full">
            <X size={20} className="text-slate-400"/>
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400">Step {step} / {totalSteps}</span>
            <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }}/>
            </div>
          </div>
        </div>
        <button className="text-xs font-bold text-slate-400 hover:text-black underline decoration-1 underline-offset-2">
          나가기
        </button>
      </header>

      {/* 2. 메인 컨텐츠 (max-w-xl로 컴팩트하게) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 호스트 국적 */}
        {step === 1 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 1. 국적 선택</span>
              <h1 className="text-3xl font-black mt-4 mb-3">호스트님의 국적은<br/>어디인가요?</h1>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button onClick={() => updateData('hostNationality', 'Korea')} className={`p-6 rounded-2xl border-2 transition-all ${formData.hostNationality === 'Korea' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}>
                <div className="text-3xl mb-2">🇰🇷</div>
                <div className="font-bold">한국인</div>
              </button>
              <button onClick={() => updateData('hostNationality', 'Japan')} className={`p-6 rounded-2xl border-2 transition-all ${formData.hostNationality === 'Japan' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}>
                <div className="text-3xl mb-2">🇯🇵</div>
                <div className="font-bold">일본인</div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 타겟 언어 */}
        {step === 2 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 2. 언어 선택</span>
              <h1 className="text-3xl font-black mt-4 mb-3">어떤 언어권 게스트와<br/>만나고 싶으신가요?</h1>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {[
                { code: 'Japanese', label: '일본어 🇯🇵' }, { code: 'English', label: '영어 🇺🇸' },
                { code: 'Chinese', label: '중국어 🇨🇳' }, { code: 'Korean', label: '한국어 🇰🇷' }
              ].map(lang => (
                <button key={lang.code} onClick={() => updateData('targetLanguage', lang.code)} className={`p-5 rounded-2xl border-2 transition-all ${formData.targetLanguage === lang.code ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}>
                  <div className="font-bold">{lang.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: 기본 정보 */}
        {step === 3 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 3. 기본 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3">연락처를 알려주세요</h1>
            </div>
            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e)=>updateData('name', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e)=>updateData('dob', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
                </div>
              </div>
              <input type="tel" placeholder="휴대전화 번호" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
              <input type="email" placeholder="이메일 주소" value={formData.email} onChange={(e)=>updateData('email', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Instagram ID" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
                <input type="text" placeholder="가입 경로" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 언어 능력 */}
        {step === 4 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 4. 언어 능력</span>
              <h1 className="text-3xl font-black mt-4 mb-3">해당 언어를<br/>얼마나 유창하게 하시나요?</h1>
              <p className="text-sm text-slate-500">게스트와의 원활한 소통을 위해 정확히 선택해 주세요.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between text-2xl mb-6 px-1"><span>🌱</span><span>🌿</span><span>🌳</span><span>🗣️</span><span>👑</span></div>
              <input type="range" min="1" max="5" step="1" value={formData.languageLevel} onChange={(e) => updateData('languageLevel', Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black mb-6"/>
              <div className="bg-slate-50 p-4 rounded-xl text-sm font-bold text-slate-900">
                {formData.languageLevel === 1 && "Lv.1 기초 단계 (번역기 필수)"}
                {formData.languageLevel === 2 && "Lv.2 초급 회화 (단어 위주)"}
                {formData.languageLevel === 3 && "Lv.3 일상 회화 (소통 원활)"}
                {formData.languageLevel === 4 && "Lv.4 비즈니스 회화 (복잡한 표현)"}
                {formData.languageLevel === 5 && "Lv.5 원어민 수준"}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 프로필 설정 */}
        {step === 5 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 5. 프로필</span>
              <h1 className="text-3xl font-black mt-4 mb-3">게스트에게 보여질<br/>모습을 꾸며보세요</h1>
            </div>
            <div className="flex flex-col items-center gap-6">
              <label className="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-black overflow-hidden relative bg-slate-50">
                {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover"/> : <Camera size={24} className="text-slate-400"/>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'profilePhoto')}/>
              </label>
              <textarea placeholder="자기소개를 입력해주세요. (취미, 성격 등)" value={formData.selfIntro} onChange={(e)=>updateData('selfIntro', e.target.value)} className="w-full p-4 h-32 bg-slate-50 rounded-xl outline-none text-sm resize-none border border-transparent focus:border-black"/>
            </div>
          </div>
        )}

        {/* STEP 6: 신분 인증 */}
        {step === 6 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-purple-50 text-purple-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 6. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-4 mb-3">인증된 호스트<br/>배지를 받아보세요</h1>
              <p className="text-sm text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={14} className="inline"/> 인증 배지</span>가 표시됩니다.</p>
            </div>
            <label className="block border-2 border-dashed border-slate-300 rounded-3xl p-10 cursor-pointer hover:bg-slate-50">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'idCardFile')}/>
              {formData.idCardFile ? (
                <div className="text-green-600 font-bold flex flex-col items-center"><CheckCircle2 size={32} className="mb-2"/>업로드 완료</div>
              ) : (
                <div className="flex flex-col items-center">
                  <CreditCard size={32} className="text-slate-400 mb-2"/>
                  <span className="text-sm font-bold">신분증 업로드</span>
                </div>
              )}
            </label>
          </div>
        )}

        {/* STEP 7: 신청 사유 (마지막) */}
        {step === 7 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-green-50 text-green-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 7. 신청 사유</span>
              <h1 className="text-3xl font-black mt-4 mb-3">마지막 질문입니다!</h1>
              <p className="text-sm text-slate-500">로컬리 호스트가 되고 싶은 이유를 적어주세요.</p>
            </div>
            <textarea 
              placeholder="예) 외국인 친구들과 교류하는 것을 좋아해서 지원하게 되었습니다." 
              value={formData.motivation} 
              onChange={(e)=>updateData('motivation', e.target.value)} 
              className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none text-sm resize-none border border-transparent focus:border-black"
            />
          </div>
        )}

      </main>

      {/* 3. 하단 네비게이션 */}
      <footer className="h-20 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
        <button onClick={prevStep} disabled={step === 1} className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100'}`}>이전</button>
        {step === totalSteps ? (
          <Link href="/host/dashboard">
            <button className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg hover:scale-105 transition-transform">제출하기</button>
          </Link>
        ) : (
          <button onClick={nextStep} className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg hover:scale-105 transition-transform flex items-center gap-2">다음 <ChevronRight size={14}/></button>
        )}
      </footer>
    </div>
  );
}