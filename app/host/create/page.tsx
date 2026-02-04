'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, MapPin, X, User, Instagram, Calendar, Clock
} from 'lucide-react';
import Link from 'next/link';

export default function CreateExperiencePage() {
  const [step, setStep] = useState(1);
  const totalSteps = 4; // 단계를 4개로 압축하여 효율성 증대

  // 입력 데이터 상태
  const [formData, setFormData] = useState({
    // Step 1: 개인정보
    name: '',
    phone: '',
    dob: '',
    email: '',
    instagram: '',
    source: '', // 알게 된 계기
    
    // Step 2: 언어 & 프로필
    japaneseLevel: 2, // 1:초급, 2:중급, 3:상급, 4:원어민
    japaneseCert: '',
    selfIntro: '',
    profilePhoto1: null as string | null,
    profilePhoto2: null as string | null,

    // Step 3: 투어 정보
    location: '',
    spots: '',
    meetingPoint: '',
    duration: 3,
    description: '',

    // Step 4: 가격 & 일정
    price: 30000,
    availability: '' // 가능 일정 텍스트
  });

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'profilePhoto1' | 'profilePhoto2') => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      updateData(key, url);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 상단 진행바 */}
      <header className="h-20 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-50 rounded-full">
            <X size={24} className="text-slate-400"/>
          </Link>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400">Step {step} of {totalSteps}</span>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }}/>
            </div>
          </div>
        </div>
        <button className="text-sm font-bold text-slate-400 hover:text-black underline decoration-1 underline-offset-4">
          임시 저장
        </button>
      </header>

      {/* 2. 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 호스트 기본 정보 */}
        {step === 1 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-xs">Step 1. 기본 정보</span>
              <h1 className="text-3xl font-black">호스트님에 대해 알려주세요</h1>
              <p className="text-slate-500">연락을 위한 기본적인 정보가 필요합니다.</p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e)=>updateData('name', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e)=>updateData('dob', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">전화번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">이메일 주소</label>
                <input type="email" placeholder="example@gmail.com" value={formData.email} onChange={(e)=>updateData('email', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Instagram size={12}/> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">알게 된 계기</label>
                  <input type="text" placeholder="예) 인스타 릴스, 지인 추천" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 언어 능력 & 프로필 */}
        {step === 2 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full text-xs">Step 2. 언어 & 프로필</span>
              <h1 className="text-3xl font-black">일본어 실력을 보여주세요</h1>
              <p className="text-slate-500">게스트와 소통하기 위한 중요한 정보입니다.</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <label className="block font-bold mb-4 flex items-center gap-2"><Globe size={18}/> 일본어 구사 수준</label>
              <input 
                type="range" min="1" max="4" step="1" 
                value={formData.japaneseLevel}
                onChange={(e) => updateData('japaneseLevel', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black mb-4"
              />
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span className={formData.japaneseLevel===1 ? 'text-black':''}>초급</span>
                <span className={formData.japaneseLevel===2 ? 'text-black':''}>중급</span>
                <span className={formData.japaneseLevel===3 ? 'text-black':''}>상급</span>
                <span className={formData.japaneseLevel===4 ? 'text-black':''}>원어민</span>
              </div>
              <div className="mt-4 text-center text-sm font-medium text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                {formData.japaneseLevel === 1 && "간단한 자기소개 가능 (번역기 활용)"}
                {formData.japaneseLevel === 2 && "간단한 문장 대화 가능 (부분 번역기)"}
                {formData.japaneseLevel === 3 && "기본적인 회화 문제 없음"}
                {formData.japaneseLevel === 4 && "복잡한 내용 및 문화적 표현 이해 가능"}
              </div>
              
              <input type="text" placeholder="자격증이 있다면 기재해주세요 (선택)" value={formData.japaneseCert} onChange={(e)=>updateData('japaneseCert', e.target.value)} className="w-full mt-4 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none"/>
            </div>

            <div>
              <label className="font-bold block mb-2">자기소개</label>
              <textarea placeholder="게스트에게 나를 소개해 주세요." value={formData.selfIntro} onChange={(e)=>updateData('selfIntro', e.target.value)} className="w-full p-4 h-32 bg-slate-50 rounded-xl outline-none resize-none"/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {['profilePhoto1', 'profilePhoto2'].map((key, idx) => (
                <div key={key}>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">프로필 사진 {idx + 1}</label>
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all relative overflow-hidden">
                    {formData[key as keyof typeof formData] ? (
                      <img src={formData[key as keyof typeof formData] as string} className="w-full h-full object-cover"/>
                    ) : (
                      <>
                        <Camera size={24} className="text-slate-400 mb-1"/>
                        <span className="text-[10px] text-slate-400">사진 추가</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, key as any)}/>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: 투어 상세 정보 */}
        {step === 3 && (
          <div className="w-full space-y-6">
            <div className="text-center space-y-2">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 3. 투어 정보</span>
              <h1 className="text-3xl font-black">어디로 떠나볼까요?</h1>
              <p className="text-slate-500">매력적인 투어 코스를 자세히 적어주세요.</p>
            </div>

            <div>
              <label className="font-bold block mb-2">개최 지역</label>
              <div className="flex gap-2 flex-wrap">
                {['서울', '인천', '경기도', '부산', '기타'].map(loc => (
                  <button key={loc} onClick={() => updateData('location', loc)} className={`px-4 py-2 rounded-full border text-sm font-bold transition-all ${formData.location === loc ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">방문 장소 (구체적으로)</label>
              <input type="text" placeholder="예) 용리단길, 광장시장, 보쌈식당" value={formData.spots} onChange={(e)=>updateData('spots', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none"/>
              <p className="text-[10px] text-slate-400 mt-1 ml-1">※ 단순 지역명이 아닌 실제 방문할 장소를 적어주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold block mb-1">미팅 장소</label>
                <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl">
                  <MapPin size={18} className="text-slate-400"/>
                  <input type="text" placeholder="명동역 5번 출구" value={formData.meetingPoint} onChange={(e)=>updateData('meetingPoint', e.target.value)} className="bg-transparent outline-none w-full text-sm"/>
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">소요 시간</label>
                <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl">
                  <Clock size={18} className="text-slate-400"/>
                  <input type="number" placeholder="4" value={formData.duration} onChange={(e)=>updateData('duration', e.target.value)} className="bg-transparent outline-none w-full text-sm"/>
                  <span className="text-sm text-slate-500 whitespace-nowrap">시간</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">투어 소개글</label>
              <textarea 
                placeholder={`예시) "서촌과 인왕산의 매력을 소개합니다!"\n서촌은 서울의 전통과 현대가 어우러진 곳으로...`}
                value={formData.description} 
                onChange={(e)=>updateData('description', e.target.value)} 
                className="w-full p-4 h-48 bg-slate-50 rounded-xl outline-none resize-none text-sm leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 4: 가격 및 일정 */}
        {step === 4 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-green-50 text-green-600 font-bold px-3 py-1 rounded-full text-xs">Step 4. 가격 및 일정</span>
              <h1 className="text-3xl font-black">마지막 단계입니다!</h1>
            </div>

            <div className="flex flex-col items-center">
              <label className="font-bold mb-4">1인당 투어 가격</label>
              <div className="relative w-full max-w-xs mb-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 text-3xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"
                />
              </div>
              <p className="text-xs text-slate-400 mb-8">권장 가격대: 30,000원 ~ 50,000원</p>

              {/* 정산 시뮬레이션 카드 */}
              <div className="bg-slate-50 p-6 rounded-2xl w-full max-w-sm border border-slate-100">
                <div className="flex justify-between text-sm mb-2 text-slate-500">
                  <span>게스트 결제 금액 (플랫폼 수수료 별도)</span>
                  <span>₩{formData.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-4 text-slate-500">
                  <span>호스트 수수료 (20%)</span>
                  <span className="text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200 pt-4 flex justify-between text-lg">
                  <span className="font-black text-slate-900">호스트 정산 예상금</span>
                  <span className="font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold block mb-2 flex items-center gap-2"><Calendar size={18}/> 투어 가능 일정</label>
              <textarea 
                placeholder="예) 10월 1, 2, 7일 / 11월 3, 5일 가능합니다." 
                value={formData.availability}
                onChange={(e)=>updateData('availability', e.target.value)}
                className="w-full p-4 h-24 bg-slate-50 rounded-xl outline-none resize-none text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-2">※ 정확한 스케줄 관리는 등록 후 '일정 관리' 탭에서 설정할 수 있습니다.</p>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 버튼 */}
      <footer className="h-24 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
        <button 
          onClick={prevStep}
          disabled={step === 1}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100'}`}
        >
          이전
        </button>

        <div className="flex gap-2">
          {step === totalSteps ? (
            <button className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg">
              신청서 제출하기
            </button>
          ) : (
            <button 
              onClick={nextStep}
              className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2"
            >
              다음 <ChevronRight size={16}/>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}