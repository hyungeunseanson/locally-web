'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, MapPin, X, User, Instagram, 
  CheckCircle2, ShieldCheck, Flag, CreditCard, Clock, Smile, Building, FileText
} from 'lucide-react';
import Link from 'next/link';

export default function HostRegisterPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 7; // 호스트 등록 총 7단계

  const [formData, setFormData] = useState({
    // Step 1: 내 국적 (Host Nationality) - 순서 변경됨
    hostNationality: '', 

    // Step 2: 타겟 언어
    targetLanguage: '', 

    // Step 3: 기본 정보
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',

    // Step 4: 언어 능력
    languageLevel: 3, 
    languageCert: '',

    // Step 5: 프로필
    profilePhoto: null as string | null,
    selfIntro: '',

    // Step 6: 신분 인증
    idCardFile: null as string | null,

    // Step 7: 정산 계좌 (Motivation 대체)
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    agreeTerms: false // 약관 동의 추가
  });

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      if (fieldName === 'profilePhoto') {
        updateData('profilePhoto', url);
      } else {
        updateData(fieldName, url);
      }
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

      {/* 2. 메인 컨텐츠 (max-w-xl로 컴팩트하게) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 호스트 국적 선택 (가장 먼저) */}
        {step === 1 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 1. 국적 선택</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">호스트님의 국적은<br/>어디인가요?</h1>
              <p className="text-sm text-slate-500">신분증 확인 및 정산 통화 기준이 됩니다.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button 
                onClick={() => updateData('hostNationality', 'Korea')} 
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Korea' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇰🇷</div>
                <div className="font-bold text-lg">한국인</div>
              </button>
              <button 
                onClick={() => updateData('hostNationality', 'Japan')} 
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.hostNationality === 'Japan' ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="text-4xl mb-2">🇯🇵</div>
                <div className="font-bold text-lg">일본인</div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 타겟 언어 (만나고 싶은 게스트) */}
        {step === 2 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 2. 언어 선택</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">어떤 언어권 게스트와<br/>만나고 싶으신가요?</h1>
              <p className="text-sm text-slate-500">주로 소통하게 될 언어를 선택해 주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {[
                { code: 'Japanese', label: '일본어 🇯🇵', sub: 'Japanese' },
                { code: 'English', label: '미국/영어권 🇺🇸', sub: 'English' },
                { code: 'Chinese', label: '중국어 🇨🇳', sub: 'Chinese' },
                { code: 'Korean', label: '한국어 🇰🇷', sub: 'Korean' },
              ].map((lang) => (
                <button 
                  key={lang.code}
                  onClick={() => updateData('targetLanguage', lang.code)}
                  className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-md ${formData.targetLanguage === lang.code ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="text-lg font-black mb-1">{lang.label}</div>
                  <div className="text-xs text-slate-400 font-medium">{lang.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: 기본 정보 */}
        {step === 3 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 3. 기본 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">호스트님의<br/>연락처를 알려주세요</h1>
            </div>

            <div className="space-y-4">
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
              
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">휴대전화 번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">이메일 주소</label>
                <input type="email" placeholder="example@gmail.com" value={formData.email} onChange={(e)=>updateData('email', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 flex items-center gap-1"><Instagram size={12}/> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">가입 경로</label>
                  <input type="text" placeholder="예) 인스타, 지인 추천" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 언어 능력 */}
        {step === 4 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 4. 언어 능력</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">해당 언어를<br/>얼마나 유창하게 하시나요?</h1>
              <p className="text-sm text-slate-500">게스트와의 원활한 소통을 위해 정확히 선택해 주세요.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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
                  {formData.languageLevel === 1 && "간단한 인사말 정도만 가능하며, 번역기 사용이 필수입니다."}
                  {formData.languageLevel === 2 && "단어 위주의 소통이 가능하며, 대화 시 번역기의 도움이 일부 필요합니다."}
                  {formData.languageLevel === 3 && "일상적인 주제로 큰 어려움 없이 대화를 나눌 수 있습니다."}
                  {formData.languageLevel === 4 && "복잡한 내용이나 전문적인 주제도 자연스럽게 설명할 수 있습니다."}
                  {formData.languageLevel === 5 && "현지인 수준의 자연스러운 억양과 표현을 구사합니다."}
                </p>
              </div>

              <div className="mt-6">
                <label className="font-bold block mb-1.5 text-xs ml-1 text-slate-500">어학 자격증 (선택사항)</label>
                <input type="text" placeholder="예) JLPT N1, TOEIC 900" value={formData.languageCert} onChange={(e)=>updateData('languageCert', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-black transition-all text-sm"/>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 프로필 설정 */}
        {step === 5 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 5. 프로필 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">게스트에게 보여질<br/>모습을 꾸며보세요</h1>
            </div>
            <div className="flex flex-col items-center gap-6">
              <label className="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-black overflow-hidden relative bg-slate-50">
                {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover"/> : <Camera size={24} className="text-slate-400"/>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'profilePhoto')}/>
              </label>
              <div className="w-full text-left">
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">자기소개</label>
                <textarea 
                  placeholder="안녕하세요! 저는 여행과 사진을 좋아하는 호스트입니다. (최소 50자 이상)" 
                  value={formData.selfIntro} 
                  onChange={(e)=>updateData('selfIntro', e.target.value)} 
                  className="w-full p-3.5 h-32 bg-slate-50 rounded-xl outline-none text-sm resize-none border border-transparent focus:border-black focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: 신분 인증 */}
        {step === 6 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-purple-50 text-purple-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 6. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">인증된 호스트<br/>배지를 받아보세요</h1>
              <p className="text-sm text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={14} className="inline"/> 인증 배지</span>가 표시됩니다.</p>
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
                  <p className="text-xs text-slate-400 mb-6">주민등록증, 운전면허증, 여권 중 택 1</p>
                  <span className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all">파일 선택하기</span>
                </label>
              )}
            </div>
            <p className="text-[12px] text-slate-400 text-center mt-4 bg-slate-50 py-2 rounded-lg">* 제출된 신분증 정보는 본인 확인 용도로만 사용되며, 확인 즉시 안전하게 파기됩니다.</p>
          </div>
        )}

        {/* STEP 7: 정산 계좌 등록 (마지막) */}
        {step === 7 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-green-50 text-green-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 7. 정산 계좌</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">수익을 지급받을<br/>계좌를 알려주세요</h1>
              <p className="text-sm text-slate-500">본인 명의의 계좌만 등록 가능합니다.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">은행명</label>
                <div className="relative">
                  <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input 
                    type="text" 
                    placeholder="예) 카카오뱅크, 신한은행" 
                    value={formData.bankName} 
                    onChange={(e)=>updateData('bankName', e.target.value)} 
                    className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">계좌번호</label>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input 
                    type="tel" 
                    placeholder="- 없이 숫자만 입력" 
                    value={formData.accountNumber} 
                    onChange={(e)=>updateData('accountNumber', e.target.value)} 
                    className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">예금주</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input 
                    type="text" 
                    placeholder="본인 실명" 
                    value={formData.accountHolder} 
                    onChange={(e)=>updateData('accountHolder', e.target.value)} 
                    className="w-full p-3.5 pl-10 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black border border-slate-200 text-sm"
                  />
                </div>
              </div>

              {/* 약관 동의 */}
              <div className="pt-4">
                <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${formData.agreeTerms ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
                    {formData.agreeTerms && <CheckCircle2 size={14} className="text-white"/>}
                  </div>
                  <input type="checkbox" className="hidden" checked={formData.agreeTerms} onChange={(e) => updateData('agreeTerms', e.target.checked)}/>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-bold text-slate-900">개인정보 수집 및 이용에 동의합니다.</span><br/>
                    수집된 정보는 호스트 심사 및 정산 목적으로만 사용됩니다.
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: 완료 화면 */}
        {step === 8 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="w-28 h-28 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
              <CheckCircle2 size={56}/>
            </div>
            <div>
              <h1 className="text-3xl font-black mb-4">제출이 완료되었습니다! 🎉</h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-sm mx-auto">
                꼼꼼하게 작성해 주셔서 감사합니다.<br/>
                담당자가 내용을 확인한 후,<br/>
                <strong>영업일 기준 2~3일 내</strong>에 연락드리겠습니다.
              </p>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-sm mx-auto text-left space-y-3 shadow-sm">
              <h4 className="font-bold text-sm text-slate-900 mb-1">✅ 이후 진행 절차</h4>
              <ul className="text-xs text-slate-600 space-y-2.5">
                <li className="flex gap-3 items-center"><span className="bg-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-slate-200">1</span> <span>서류 및 자격 심사 (신분증 확인)</span></li>
                <li className="flex gap-3 items-center"><span className="bg-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-slate-200">2</span> <span>유선 또는 화상 인터뷰 (필요시)</span></li>
                <li className="flex gap-3 items-center"><span className="bg-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-slate-200">3</span> <span>최종 승인 및 투어 오픈</span></li>
              </ul>
            </div>

            <div className="pt-6">
              <Link href="/host/dashboard">
                <button className="bg-black text-white px-10 py-4 rounded-xl font-bold text-base hover:scale-105 transition-transform shadow-xl">
                  대시보드로 이동
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (Step 8 완료 화면 제외) */}
      {step < totalSteps + 1 && (
        <footer className="h-20 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
          <button 
            onClick={prevStep}
            disabled={step === 1}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100'}`}
          >
            이전
          </button>

          <div className="flex gap-2">
            {step === totalSteps ? (
              <button 
                onClick={() => setStep(step + 1)} // 실제로는 여기서 DB 전송 로직 필요
                disabled={!formData.agreeTerms}
                className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs hover:scale-105 transition-transform shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                신청서 제출하기
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