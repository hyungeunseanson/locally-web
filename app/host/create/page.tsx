'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, MapPin, X, User, Instagram, 
  CheckCircle2, ShieldCheck, Flag, CreditCard, Clock, Smile
} from 'lucide-react';
import Link from 'next/link';

export default function CreateExperiencePage() {
  const [step, setStep] = useState(1);
  const totalSteps = 9; // 단계를 9개로 확장하여 여유롭게 배치

  // 입력 데이터 상태
  const [formData, setFormData] = useState({
    // Step 1: 타겟 국적
    targetCountry: '', // Korean, Japanese, Chinese, English

    // Step 2: 언어 능력
    languageLevel: 3, 
    languageCert: '',

    // Step 3: 기본 정보
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',

    // Step 4: 신분 인증
    idCardType: '', 
    idCardFile: null as string | null,

    // Step 5: 투어 지역
    country: 'Korea', // 기본값
    city: '',

    // Step 6: 투어 상세 (제목, 장소)
    title: '', 
    spots: '', 
    meetingPoint: '',
    duration: 3,

    // Step 7: 소개글 & 사진
    description: '', // 상세 소개글
    photos: [] as string[],

    // Step 8: 가격
    price: 50000,
  });

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      if (fieldName === 'photos') {
        updateData('photos', [...formData.photos, url]);
      } else {
        updateData(fieldName, url);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 상단 진행바 (마지막 완료 화면에서는 숨김) */}
      {step < totalSteps && (
        <header className="h-20 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
          <div className="flex items-center gap-4">
            <Link href="/host/dashboard" className="p-2 hover:bg-slate-50 rounded-full">
              <X size={24} className="text-slate-400"/>
            </Link>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400">Step {step} of {totalSteps - 1}</span>
              <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}/>
              </div>
            </div>
          </div>
          <button className="text-sm font-bold text-slate-400 hover:text-black underline decoration-1 underline-offset-4">
            나가기
          </button>
        </header>
      )}

      {/* 2. 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 타겟 국적 선택 */}
        {step === 1 && (
          <div className="w-full space-y-12 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-full text-xs">Step 1. 타겟 설정</span>
              <h1 className="text-4xl font-black mt-6 mb-4">어떤 국적의 게스트를<br/>만나고 싶으신가요?</h1>
              <p className="text-slate-500">주로 소통하게 될 언어권의 게스트를 선택해 주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
              {[
                { code: 'Japanese', label: '일본 🇯🇵', sub: 'Japanese' },
                { code: 'English', label: '미국/영어권 🇺🇸', sub: 'English' },
                { code: 'Chinese', label: '중국 🇨🇳', sub: 'Chinese' },
                { code: 'Korean', label: '한국 🇰🇷', sub: 'Korean' },
              ].map((lang) => (
                <button 
                  key={lang.code}
                  onClick={() => updateData('targetCountry', lang.code)}
                  className={`p-8 rounded-3xl border-2 transition-all hover:scale-105 hover:shadow-lg ${formData.targetCountry === lang.code ? 'border-black bg-slate-50 ring-2 ring-black ring-offset-2' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="text-xl font-black mb-2">{lang.label}</div>
                  <div className="text-sm text-slate-400 font-medium">{lang.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: 언어 능력 (5단계 + 이모지) */}
        {step === 2 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full text-xs">Step 2. 언어 능력</span>
              <h1 className="text-3xl font-black mt-6 mb-4">해당 언어를<br/>얼마나 유창하게 하시나요?</h1>
              <p className="text-slate-500">게스트와의 원활한 소통을 위해 정확히 선택해 주세요.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8 px-2">
                <span className="text-3xl">🌱</span>
                <span className="text-3xl">🌿</span>
                <span className="text-3xl">🌳</span>
                <span className="text-3xl">🗣️</span>
                <span className="text-3xl">👑</span>
              </div>
              
              <input 
                type="range" min="1" max="5" step="1" 
                value={formData.languageLevel}
                onChange={(e) => updateData('languageLevel', Number(e.target.value))}
                className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black mb-8"
              />
              
              <div className="text-center bg-slate-50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold mb-2 text-slate-900">
                  {formData.languageLevel === 1 && "Lv.1 기초 단계"}
                  {formData.languageLevel === 2 && "Lv.2 초급 회화"}
                  {formData.languageLevel === 3 && "Lv.3 일상 회화"}
                  {formData.languageLevel === 4 && "Lv.4 비즈니스 회화"}
                  {formData.languageLevel === 5 && "Lv.5 원어민 수준"}
                </h3>
                <p className="text-slate-500 text-sm">
                  {formData.languageLevel === 1 && "간단한 인사말 정도만 가능하며, 번역기 사용이 필수입니다."}
                  {formData.languageLevel === 2 && "단어 위주의 소통이 가능하며, 대화 시 번역기의 도움이 필요합니다."}
                  {formData.languageLevel === 3 && "일상적인 주제로 큰 어려움 없이 대화를 나눌 수 있습니다."}
                  {formData.languageLevel === 4 && "복잡한 내용이나 전문적인 주제도 자연스럽게 설명할 수 있습니다."}
                  {formData.languageLevel === 5 && "현지인과 다름없는 자연스러운 억양과 표현을 구사합니다."}
                </p>
              </div>

              <div className="mt-8">
                <label className="font-bold block mb-2 text-sm ml-1 text-slate-500">어학 자격증 (선택사항)</label>
                <input type="text" placeholder="예) JLPT N1, TOEIC 900" value={formData.languageCert} onChange={(e)=>updateData('languageCert', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-black transition-all"/>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: 기본 정보 */}
        {step === 3 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-xs">Step 3. 기본 정보</span>
              <h1 className="text-3xl font-black mt-6 mb-4">호스트님의<br/>연락처를 알려주세요</h1>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-2 block">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e)=>updateData('name', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-2 block">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e)=>updateData('dob', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-2 block">휴대전화 번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-2 block">이메일 주소</label>
                <input type="email" placeholder="example@gmail.com" value={formData.email} onChange={(e)=>updateData('email', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-2 flex items-center gap-1"><Instagram size={12}/> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-2 block">로컬리 알게 된 계기</label>
                  <input type="text" placeholder="예) 인스타, 지인 추천" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 신분 인증 */}
        {step === 4 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-purple-50 text-purple-600 font-bold px-3 py-1 rounded-full text-xs">Step 4. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-6 mb-4">인증된 호스트<br/>뱃지를 받아보세요</h1>
              <p className="text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={14} className="inline"/> 인증 뱃지</span>가 표시되어<br/>게스트의 신뢰도가 30% 상승합니다.</p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center hover:bg-slate-50 transition-all cursor-pointer group relative">
              <input type="file" accept="image/*" className="hidden" id="id-upload" onChange={(e) => handlePhotoUpload(e, 'idCardFile')}/>
              
              {formData.idCardFile ? (
                <div className="relative h-56 w-full flex flex-col items-center justify-center">
                  <img src={formData.idCardFile} className="h-full object-contain rounded-lg shadow-sm"/>
                  <button onClick={(e) => { e.preventDefault(); updateData('idCardFile', null); }} className="absolute top-0 right-0 bg-black text-white p-2 rounded-full hover:scale-110 transition-transform"><X size={16}/></button>
                  <p className="text-green-600 font-bold mt-6 flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full"><CheckCircle2 size={18}/> 업로드 완료</p>
                </div>
              ) : (
                <label htmlFor="id-upload" className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-inner">
                    <CreditCard size={40} className="text-slate-400 group-hover:text-black"/>
                  </div>
                  <h3 className="font-bold text-xl mb-3 text-slate-800">신분증 업로드</h3>
                  <p className="text-sm text-slate-400 mb-8">주민등록증, 운전면허증, 여권 중 택 1</p>
                  <span className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all">파일 선택하기</span>
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-6 bg-slate-50 py-3 rounded-lg">* 제출된 신분증 정보는 본인 확인 용도로만 사용되며, 확인 즉시 안전하게 파기됩니다.</p>
          </div>
        )}

        {/* STEP 5: 투어 지역 설정 */}
        {step === 5 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 5. 지역 설정</span>
              <h1 className="text-3xl font-black mt-6 mb-4">어디에서<br/>투어를 진행하시나요?</h1>
            </div>

            <div className="space-y-8">
              <div>
                <label className="font-bold block mb-4 text-sm text-slate-500 ml-1">국가 선택</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => updateData('country', 'Korea')} className={`p-4 rounded-xl border-2 font-bold text-lg transition-all ${formData.country === 'Korea' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>🇰🇷 한국</button>
                  <button onClick={() => updateData('country', 'Japan')} className={`p-4 rounded-xl border-2 font-bold text-lg transition-all ${formData.country === 'Japan' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>🇯🇵 일본</button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-4 text-sm text-slate-500 ml-1">상세 지역 (도시/동네)</label>
                <input 
                  type="text" 
                  placeholder={formData.country === 'Korea' ? "예) 서울 마포구 연남동" : "예) 도쿄 신주쿠구"} 
                  value={formData.city} 
                  onChange={(e)=>updateData('city', e.target.value)} 
                  className="w-full p-5 bg-white rounded-xl outline-none font-bold text-xl border-2 border-slate-200 focus:border-black transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: 투어 상세 정보 1 (기본) */}
        {step === 6 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 6. 상세 정보</span>
              <h1 className="text-3xl font-black mt-6 mb-4">어떤 경험을<br/>선물하고 싶으신가요?</h1>
            </div>

            <div className="space-y-8">
              <div>
                <label className="font-bold block mb-3 text-sm text-slate-500 ml-1">투어 제목</label>
                <input type="text" placeholder="예) 현지인과 함께하는 퇴근 후 이자카야 탐방 🍻" value={formData.title} onChange={(e)=>updateData('title', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black focus:bg-white transition-all font-bold"/>
              </div>

              <div>
                <label className="font-bold block mb-3 text-sm text-slate-500 ml-1">방문 장소 & 코스 요약</label>
                <input type="text" placeholder="예) 신주쿠역 -> 오모이데 요코초 -> 야키토리집" value={formData.spots} onChange={(e)=>updateData('spots', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black focus:bg-white transition-all"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold block mb-3 text-xs text-slate-500 ml-1">만나는 장소</label>
                  <input type="text" placeholder="신주쿠역 동쪽 출구" value={formData.meetingPoint} onChange={(e)=>updateData('meetingPoint', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm border border-transparent focus:border-black focus:bg-white transition-all"/>
                </div>
                <div>
                  <label className="font-bold block mb-3 text-xs text-slate-500 ml-1">소요 시간 (시간)</label>
                  <input type="number" placeholder="3" value={formData.duration} onChange={(e)=>updateData('duration', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm border border-transparent focus:border-black focus:bg-white transition-all"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: 투어 상세 정보 2 (소개글 & 사진) */}
        {step === 7 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 7. 소개글 & 사진</span>
              <h1 className="text-3xl font-black mt-6 mb-4">매력을 듬뿍 담아<br/>소개해 주세요</h1>
            </div>

            <div className="space-y-8">
              <div>
                <label className="font-bold block mb-3 text-sm text-slate-500 ml-1">상세 소개글</label>
                <textarea 
                  placeholder="투어의 매력 포인트, 진행 방식, 호스트의 생각 등을 자유롭게 적어주세요. (최소 50자 이상 권장)"
                  value={formData.description} 
                  onChange={(e)=>updateData('description', e.target.value)} 
                  className="w-full p-5 h-64 bg-slate-50 rounded-xl outline-none resize-none text-base leading-relaxed border-2 border-transparent focus:border-black focus:bg-white transition-all"
                />
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="font-bold block mb-3 text-sm text-slate-500 flex justify-between ml-1">
                  투어 사진 (5장 이상 권장)
                  <span className="text-slate-400 text-xs font-normal">현재 {formData.photos.length}장</span>
                </label>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  <label className="w-32 h-32 flex-shrink-0 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                    <Camera size={24} className="text-slate-400 mb-1"/>
                    <span className="text-xs text-slate-500 font-bold">사진 추가</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'photos')}/>
                  </label>
                  {formData.photos.map((url, idx) => (
                    <div key={idx} className="w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden relative border border-slate-200 shadow-sm">
                      <img src={url} className="w-full h-full object-cover"/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: 가격 설정 */}
        {step === 8 && (
          <div className="w-full space-y-12">
            <div className="text-center">
              <span className="bg-green-50 text-green-600 font-bold px-3 py-1 rounded-full text-xs">Step 8. 요금 설정</span>
              <h1 className="text-3xl font-black mt-6 mb-4">게스트 1인당<br/>얼마를 받을까요?</h1>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs mb-10">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-bold text-slate-300">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-14 pr-4 py-5 text-5xl font-black text-center border-b-4 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-200"
                />
              </div>

              {/* 정산 시뮬레이션 */}
              <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm border border-slate-100 shadow-2xl shadow-slate-200/50">
                <h3 className="font-bold text-lg mb-6 border-b border-slate-100 pb-4 text-center">💰 정산 예상 금액</h3>
                
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-slate-500">설정 가격</span>
                  <span className="font-bold text-lg">₩{formData.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-6">
                  <span className="text-slate-500">호스트 수수료 (20%)</span>
                  <span className="font-bold text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span>
                </div>
                
                <div className="border-t-2 border-dashed border-slate-100 pt-6 flex justify-between items-center">
                  <span className="font-bold text-slate-900">내 통장에 입금</span>
                  <span className="text-3xl font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span>
                </div>
                
                <div className="mt-8 bg-slate-50 p-4 rounded-xl text-[12px] text-slate-400 text-center leading-relaxed">
                  * 게스트 결제 시에는 플랫폼 수수료(10%)가 별도로 부과됩니다.<br/>
                  (호스트 정산금에는 영향을 주지 않습니다)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 9: 완료 화면 */}
        {step === 9 && (
          <div className="w-full text-center space-y-10 animate-in zoom-in-95 duration-500">
            <div className="w-32 h-32 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-100">
              <CheckCircle2 size={64}/>
            </div>
            <div>
              <h1 className="text-4xl font-black mb-6">제출이 완료되었습니다! 🎉</h1>
              <p className="text-slate-500 text-lg leading-relaxed max-w-md mx-auto">
                꼼꼼하게 작성해 주셔서 감사합니다.<br/>
                담당자가 내용을 확인한 후,<br/>
                <strong>영업일 기준 2~3일 내</strong>에 연락드리겠습니다.
              </p>
            </div>
            
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 max-w-sm mx-auto text-left space-y-4 shadow-sm">
              <h4 className="font-bold text-base text-slate-900 mb-2">✅ 이후 진행 절차</h4>
              <ul className="text-sm text-slate-600 space-y-3">
                <li className="flex gap-3 items-center"><span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border border-slate-200">1</span> <span>서류 및 자격 심사 (신분증 확인)</span></li>
                <li className="flex gap-3 items-center"><span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border border-slate-200">2</span> <span>유선 또는 화상 인터뷰 (필요시)</span></li>
                <li className="flex gap-3 items-center"><span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border border-slate-200">3</span> <span>최종 승인 및 투어 오픈</span></li>
              </ul>
            </div>

            <div className="pt-8">
              <Link href="/host/dashboard">
                <button className="bg-black text-white px-12 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl">
                  대시보드로 이동
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (Step 9 완료 화면 제외) */}
      {step < totalSteps && (
        <footer className="h-24 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
          <button 
            onClick={prevStep}
            disabled={step === 1}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100'}`}
          >
            이전
          </button>

          <div className="flex gap-2">
            {step === totalSteps - 1 ? (
              <button 
                onClick={nextStep} // 실제로는 여기서 서버 전송 로직 필요
                className="bg-black text-white px-10 py-4 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-xl shadow-slate-200"
              >
                신청서 제출하기
              </button>
            ) : (
              <button 
                onClick={nextStep}
                className="bg-black text-white px-10 py-4 rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                다음 <ChevronRight size={16}/>
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}