'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, X, User, Instagram, 
  CheckCircle2, ShieldCheck, CreditCard, Smile
} from 'lucide-react';
import Link from 'next/link';

export default function HostRegisterPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 6; // 프로필 등록은 6단계로 구성

  const [formData, setFormData] = useState({
    // Step 1: 기본 정보
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',
    
    // Step 2: 언어 능력
    targetLanguage: '', // Japanese, English etc.
    languageLevel: 3, 
    languageCert: '',

    // Step 3: 프로필 (사진/소개)
    selfIntro: '',
    profilePhoto: null as string | null,

    // Step 4: 신분 인증
    idCardType: '', 
    idCardFile: null as string | null,
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
      {step < totalSteps && (
        <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-1.5 hover:bg-slate-50 rounded-full">
              <X size={20} className="text-slate-400"/>
            </Link>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400">Step {step} / {totalSteps - 1}</span>
              <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}/>
              </div>
            </div>
          </div>
          <button className="text-xs font-bold text-slate-400 hover:text-black underline decoration-1 underline-offset-2">
            나가기
          </button>
        </header>
      )}

      {/* 2. 메인 컨텐츠 (중앙 집중형) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 기본 정보 */}
        {step === 1 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 1. 기본 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">호스트님의<br/>연락처를 알려주세요</h1>
              <p className="text-sm text-slate-500">로컬리 활동을 위한 필수 정보입니다.</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e)=>updateData('name', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e)=>updateData('dob', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all text-sm"/>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">휴대전화 번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all text-sm"/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 flex items-center gap-1"><Instagram size={12}/> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">유입 경로</label>
                  <input type="text" placeholder="예) 지인 추천" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all text-sm"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 언어 능력 (타겟 설정) */}
        {step === 2 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 2. 언어 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">주로 어떤 언어로<br/>소통 하시나요?</h1>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {[
                { code: 'Japanese', label: '일본어 🇯🇵' },
                { code: 'English', label: '영어 🇺🇸' },
                { code: 'Chinese', label: '중국어 🇨🇳' },
                { code: 'Korean', label: '한국어 🇰🇷' },
              ].map((lang) => (
                <button 
                  key={lang.code}
                  onClick={() => updateData('targetLanguage', lang.code)}
                  className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.targetLanguage === lang.code ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="text-lg font-black">{lang.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: 언어 상세 능력 */}
        {step === 3 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 3. 구사 능력</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">해당 언어를<br/>얼마나 잘하시나요?</h1>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
              <div className="flex justify-between items-center mb-6 px-1">
                <span className="text-2xl">🌱</span>
                <span className="text-2xl">🌿</span>
                <span className="text-2xl">🌳</span>
                <span className="text-2xl">🗣️</span>
                <span className="text-2xl">👑</span>
              </div>
              
              <input 
                type="range" min="1" max="5" step="1" 
                value={formData.languageLevel}
                onChange={(e) => updateData('languageLevel', Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black mb-6"
              />
              
              <div className="text-center bg-slate-50 p-5 rounded-xl">
                <h3 className="text-lg font-bold mb-1 text-slate-900">
                  {formData.languageLevel === 1 && "Lv.1 기초 단계"}
                  {formData.languageLevel === 2 && "Lv.2 초급 회화"}
                  {formData.languageLevel === 3 && "Lv.3 일상 회화"}
                  {formData.languageLevel === 4 && "Lv.4 비즈니스 회화"}
                  {formData.languageLevel === 5 && "Lv.5 원어민 수준"}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {formData.languageLevel === 1 && "간단한 인사말 가능, 번역기 필수"}
                  {formData.languageLevel === 2 && "단어 위주 소통, 번역기 도움 필요"}
                  {formData.languageLevel === 3 && "일상적인 주제로 대화 가능"}
                  {formData.languageLevel === 4 && "복잡한 내용 설명 가능"}
                  {formData.languageLevel === 5 && "현지인 수준의 억양과 표현 구사"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 프로필 (사진/소개) */}
        {step === 4 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 4. 프로필 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">게스트에게 보여질<br/>모습을 꾸며보세요</h1>
            </div>

            <div className="space-y-6 text-left">
              <div className="flex flex-col items-center">
                <label className="aspect-square w-32 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all relative overflow-hidden bg-slate-50">
                  {formData.profilePhoto ? (
                    <img src={formData.profilePhoto} className="w-full h-full object-cover"/>
                  ) : (
                    <>
                      <Camera size={24} className="text-slate-400 mb-1"/>
                      <span className="text-[10px] text-slate-500 font-bold">사진 추가</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'profilePhoto')}/>
                </label>
                <p className="text-[10px] text-slate-400 mt-2">본인의 얼굴이 잘 나온 사진을 추천해요.</p>
              </div>

              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">자기소개</label>
                <textarea 
                  placeholder="안녕하세요! 저는 여행과 사진을 좋아하는 호스트입니다. 친구처럼 편안하게 도시를 안내해 드릴게요! 😄"
                  value={formData.selfIntro} 
                  onChange={(e)=>updateData('selfIntro', e.target.value)} 
                  className="w-full p-4 h-32 bg-slate-50 rounded-xl outline-none resize-none text-sm leading-relaxed border-2 border-transparent focus:border-black focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 신분 인증 */}
        {step === 5 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-purple-50 text-purple-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 5. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">인증 뱃지를<br/>받아보세요</h1>
              <p className="text-sm text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={12} className="inline"/> 인증 뱃지</span>가 표시됩니다.</p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:bg-slate-50 transition-all cursor-pointer group relative">
              <input type="file" accept="image/*" className="hidden" id="id-upload" onChange={(e) => handlePhotoUpload(e, 'idCardFile')}/>
              
              {formData.idCardFile ? (
                <div className="relative h-40 w-full flex flex-col items-center justify-center">
                  <img src={formData.idCardFile} className="h-full object-contain rounded-lg shadow-sm"/>
                  <button onClick={(e) => { e.preventDefault(); updateData('idCardFile', null); }} className="absolute top-0 right-0 bg-black text-white p-1.5 rounded-full hover:scale-110 transition-transform"><X size={14}/></button>
                  <p className="text-green-600 font-bold mt-4 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full text-sm"><CheckCircle2 size={16}/> 업로드 완료</p>
                </div>
              ) : (
                <label htmlFor="id-upload" className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                    <CreditCard size={32} className="text-slate-400 group-hover:text-black"/>
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-slate-800">신분증 업로드</h3>
                  <p className="text-xs text-slate-400 mb-6">여권, 운전면허증, 주민등록증 중 택 1</p>
                  <span className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all">파일 선택하기</span>
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-4 bg-slate-50 py-2 rounded-lg">* 제출된 정보는 본인 확인 즉시 안전하게 파기됩니다.</p>
          </div>
        )}

        {/* STEP 6: 완료 화면 */}
        {step === 6 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
              <CheckCircle2 size={48}/>
            </div>
            <div>
              <h1 className="text-3xl font-black mb-4">호스트 신청 완료! 🎉</h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-sm mx-auto">
                환영합니다! 심사가 완료되면 알림을 보내드립니다.<br/>
                이제 대시보드에서 <strong>체험을 만들어보세요!</strong>
              </p>
            </div>
            
            <div className="pt-6">
              <Link href="/host/dashboard">
                <button className="bg-black text-white px-10 py-4 rounded-xl font-bold text-base hover:scale-105 transition-transform shadow-xl">
                  대시보드로 이동하기
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 */}
      {step < totalSteps && (
        <footer className="h-20 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
          <button 
            onClick={prevStep}
            disabled={step === 1}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100'}`}
          >
            이전
          </button>

          <div className="flex gap-2">
            {step === totalSteps - 1 ? (
              <button 
                onClick={nextStep} // 여기서는 DB 전송 로직
                className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs hover:scale-105 transition-transform shadow-lg shadow-slate-200"
              >
                신청서 제출
              </button>
            ) : (
              <button 
                onClick={nextStep}
                className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                다음 <ChevronRight size={14}/>
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}