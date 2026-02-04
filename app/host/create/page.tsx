'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, MapPin, X, CheckCircle2, Clock, Users, Tag, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function CreateExperiencePage() {
  const [step, setStep] = useState(1);
  const totalSteps = 5; // 단계를 5개로 최적화

  const [formData, setFormData] = useState({
    // Step 1: 지역
    country: 'Korea', 
    city: '',
    
    // Step 2: 기본 정보
    title: '', 
    category: '', // 맛집, 액티비티, 문화 등
    duration: 3,
    maxGuests: 4,

    // Step 3: 상세 정보
    description: '', 
    spots: '', 
    meetingPoint: '',
    photos: [] as string[],

    // Step 4: 가격
    price: 50000,
  });

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      updateData('photos', [...formData.photos, url]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 상단 진행바 */}
      {step < totalSteps && (
        <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
          <div className="flex items-center gap-4">
            <Link href="/host/dashboard" className="p-1.5 hover:bg-slate-50 rounded-full">
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
            임시 저장
          </button>
        </header>
      )}

      {/* 2. 메인 컨텐츠 (max-w-xl로 컴팩트하게) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 지역 선택 */}
        {step === 1 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 1. 지역 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">어디에서<br/>투어를 진행하시나요?</h1>
              <p className="text-sm text-slate-500">게스트가 찾아올 수 있도록 정확한 위치를 알려주세요.</p>
            </div>

            <div className="space-y-6 text-left">
              <div>
                <label className="font-bold block mb-3 text-xs text-slate-500 ml-1">국가 선택</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => updateData('country', 'Korea')} className={`p-3.5 rounded-xl border-2 font-bold text-base transition-all ${formData.country === 'Korea' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>🇰🇷 한국</button>
                  <button onClick={() => updateData('country', 'Japan')} className={`p-3.5 rounded-xl border-2 font-bold text-base transition-all ${formData.country === 'Japan' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>🇯🇵 일본</button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-3 text-xs text-slate-500 ml-1">상세 지역 (도시/동네)</label>
                <input 
                  type="text" 
                  placeholder={formData.country === 'Korea' ? "예) 서울 마포구 연남동" : "예) 도쿄 신주쿠구"} 
                  value={formData.city} 
                  onChange={(e)=>updateData('city', e.target.value)} 
                  className="w-full p-4 bg-white rounded-xl outline-none font-bold text-lg border-2 border-slate-200 focus:border-black transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 기본 정보 (제목, 카테고리, 인원) */}
        {step === 2 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 2. 기본 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">어떤 체험인지<br/>한눈에 알려주세요</h1>
            </div>

            <div className="space-y-5 text-left">
              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">체험 제목</label>
                <input type="text" placeholder="예) 현지인과 함께하는 퇴근 후 이자카야 탐방 🍻" value={formData.title} onChange={(e)=>updateData('title', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black focus:bg-white transition-all font-bold text-sm"/>
              </div>

              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">카테고리</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['맛집 탐방', '카페/디저트', '산책/힐링', '쇼핑', '문화 체험', '액티비티', '나이트라이프'].map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => updateData('category', cat)} 
                      className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${formData.category === cat ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-2 text-[10px] text-slate-500 ml-1 flex items-center gap-1"><Clock size={12}/> 소요 시간 (시간)</label>
                  <input type="number" placeholder="3" value={formData.duration} onChange={(e)=>updateData('duration', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none text-sm border border-transparent focus:border-black focus:bg-white transition-all"/>
                </div>
                <div>
                  <label className="font-bold block mb-2 text-[10px] text-slate-500 ml-1 flex items-center gap-1"><Users size={12}/> 최대 인원 (명)</label>
                  <input type="number" placeholder="4" value={formData.maxGuests} onChange={(e)=>updateData('maxGuests', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none text-sm border border-transparent focus:border-black focus:bg-white transition-all"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: 상세 정보 (소개, 코스, 사진) */}
        {step === 3 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 3. 상세 정보</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">매력을 듬뿍 담아<br/>소개해 주세요</h1>
            </div>

            <div className="space-y-6 text-left">
              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">상세 소개글</label>
                <textarea 
                  placeholder="투어의 매력 포인트, 진행 방식, 방문하는 장소의 특징 등을 자유롭게 적어주세요. (최소 100자 이상 권장)"
                  value={formData.description} 
                  onChange={(e)=>updateData('description', e.target.value)} 
                  className="w-full p-4 h-40 bg-slate-50 rounded-xl outline-none resize-none text-sm leading-relaxed border-2 border-transparent focus:border-black focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">방문 장소 & 코스 요약</label>
                <input type="text" placeholder="예) 신주쿠역 -> 오모이데 요코초 -> 야키토리집" value={formData.spots} onChange={(e)=>updateData('spots', e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black focus:bg-white transition-all text-sm"/>
              </div>

              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 ml-1">만나는 장소</label>
                <div className="flex items-center gap-2 bg-slate-50 p-3.5 rounded-xl border border-transparent focus-within:border-black focus-within:bg-white transition-all">
                  <MapPin size={16} className="text-slate-400"/>
                  <input type="text" placeholder="예) 신주쿠역 동쪽 출구 스타벅스 앞" value={formData.meetingPoint} onChange={(e)=>updateData('meetingPoint', e.target.value)} className="bg-transparent outline-none w-full text-sm font-medium"/>
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="font-bold block mb-2 text-xs text-slate-500 flex justify-between ml-1">
                  투어 사진 (5장 이상 권장)
                  <span className="text-slate-400 text-[10px] font-normal">현재 {formData.photos.length}장</span>
                </label>
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                  <label className="w-24 h-24 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                    <Camera size={20} className="text-slate-400 mb-1"/>
                    <span className="text-[10px] text-slate-500 font-bold">사진 추가</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
                  </label>
                  {formData.photos.map((url, idx) => (
                    <div key={idx} className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden relative border border-slate-200 shadow-sm">
                      <img src={url} className="w-full h-full object-cover"/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 가격 설정 */}
        {step === 4 && (
          <div className="w-full space-y-8 text-center">
            <div>
              <span className="bg-green-50 text-green-600 font-bold px-2.5 py-1 rounded-full text-[10px]">Step 4. 요금 설정</span>
              <h1 className="text-3xl font-black mt-4 mb-3 leading-tight">게스트 1인당<br/>얼마를 받을까요?</h1>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs mb-8">
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-300">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-16 pr-4 py-4 text-4xl font-black text-center border-b-4 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-200"
                />
              </div>

              {/* 정산 시뮬레이션 */}
              <div className="bg-white p-6 rounded-[1.5rem] w-full max-w-sm border border-slate-100 shadow-xl shadow-slate-200/50">
                <h3 className="font-bold text-base mb-4 border-b border-slate-100 pb-3 text-center">💰 정산 예상 금액</h3>
                
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">설정 가격</span>
                  <span className="font-bold">₩{formData.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-slate-500">호스트 수수료 (20%)</span>
                  <span className="font-bold text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span>
                </div>
                
                <div className="border-t-2 border-dashed border-slate-100 pt-4 flex justify-between items-center">
                  <span className="font-bold text-slate-900">내 통장에 입금</span>
                  <span className="text-xl font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span>
                </div>
                
                <div className="mt-6 bg-slate-50 p-3 rounded-lg text-[10px] text-slate-400 text-center leading-relaxed">
                  * 게스트 결제 시에는 플랫폼 수수료(10%)가 별도로 부과됩니다.<br/>
                  (호스트 정산금에는 영향을 주지 않습니다)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 완료 화면 */}
        {step === 5 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="w-28 h-28 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
              <CheckCircle2 size={56}/>
            </div>
            <div>
              <h1 className="text-3xl font-black mb-4">체험 등록 완료! 🎉</h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-sm mx-auto">
                멋진 체험이 등록되었습니다.<br/>
                관리자 검토가 완료되면 게스트들에게 공개됩니다.<br/>
                이제 예약 관리 메뉴에서 일정을 오픈해 주세요.
              </p>
            </div>
            
            <div className="pt-6">
              <Link href="/host/dashboard">
                <button className="bg-black text-white px-10 py-4 rounded-xl font-bold text-base hover:scale-105 transition-transform shadow-xl">
                  내 체험 보러가기
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (Step 5 완료 화면 제외) */}
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
                onClick={nextStep} // 실제로는 여기서 DB 전송 로직 필요
                className="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs hover:scale-105 transition-transform shadow-lg shadow-slate-200"
              >
                체험 등록하기
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