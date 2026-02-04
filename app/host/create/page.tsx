'use client';

import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Upload, Camera, Check, 
  Globe, ShieldCheck, MapPin, DollarSign, Image as ImageIcon, X 
} from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader'; // 헤더가 있다면 사용, 없으면 제거 가능

export default function CreateExperiencePage() {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // 입력 데이터 상태
  const [formData, setFormData] = useState({
    category: '',
    koreanLevel: 3, // 1~5
    languages: [] as string[],
    certificate: null as File | null,
    idCard: null as File | null,
    title: '',
    description: '',
    photos: [] as string[],
    price: 30000,
    meetingPoint: ''
  });

  // 다음 단계로 이동
  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  // 이전 단계로 이동
  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // 데이터 변경 핸들러
  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // 사진 업로드 (미리보기용 가짜 URL 생성)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      updateData('photos', [...formData.photos, ...newPhotos]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 상단 진행바 (Progress Bar) */}
      <header className="h-20 px-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-50 rounded-full">
            <X size={24} className="text-slate-400"/>
          </Link>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400">Step {step} of {totalSteps}</span>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500 ease-out" 
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <button className="text-sm font-bold text-slate-400 hover:text-black underline decoration-1 underline-offset-4">
          저장하고 나가기
        </button>
      </header>

      {/* 2. 메인 컨텐츠 영역 (Wizard Body) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 카테고리 & 언어 능력 */}
        {step === 1 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 1. 기본 정보</span>
              <h1 className="text-3xl md:text-4xl font-black">어떤 친구가 되어주실 건가요?</h1>
              <p className="text-slate-500">게스트가 호스트님을 더 잘 알 수 있도록 언어 능력을 알려주세요.</p>
            </div>

            {/* 한국어 레벨 슬라이더 */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
              <label className="block text-lg font-bold mb-4 flex items-center gap-2">
                <Globe size={20}/> 한국어 실력은 어느 정도인가요?
              </label>
              <input 
                type="range" min="1" max="5" step="1" 
                value={formData.koreanLevel}
                onChange={(e) => updateData('koreanLevel', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black mb-4"
              />
              <div className="flex justify-between text-xs font-bold text-slate-400 px-1">
                <span>Lv.1<br/>초급</span>
                <span>Lv.2<br/>기초</span>
                <span className={`text-black scale-110`}>Lv.3<br/>일상회화</span>
                <span>Lv.4<br/>비즈니스</span>
                <span>Lv.5<br/>원어민</span>
              </div>
              <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 text-center">
                <span className="text-sm font-bold text-slate-900">
                  {formData.koreanLevel === 1 && "👋 간단한 인사말 정도만 알아요."}
                  {formData.koreanLevel === 2 && "🗣️ 천천히 말하면 이해할 수 있어요."}
                  {formData.koreanLevel === 3 && "💬 일상적인 대화는 문제없어요!"}
                  {formData.koreanLevel === 4 && "💼 복잡한 내용도 설명할 수 있어요."}
                  {formData.koreanLevel === 5 && "🇰🇷 한국인처럼 자연스럽게 말해요!"}
                </span>
              </div>
            </div>

            {/* 카테고리 선택 */}
            <div className="grid grid-cols-3 gap-4">
              {['맛집 탐방', '산책/투어', '액티비티', '나이트라이프', '쇼핑', '문화 체험'].map((cat) => (
                <button 
                  key={cat}
                  onClick={() => updateData('category', cat)}
                  className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all ${formData.category === cat ? 'border-black bg-black text-white shadow-lg scale-105' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: 신뢰와 인증 (ID & 자격증) */}
        {step === 2 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full text-xs">Step 2. 신뢰와 안전</span>
              <h1 className="text-3xl md:text-4xl font-black">신원을 인증해 주세요</h1>
              <p className="text-slate-500">안전한 로컬리 커뮤니티를 위해 신분증과 자격증을 확인합니다.<br/>(이 정보는 게스트에게 공개되지 않습니다)</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* 신분증 업로드 */}
              <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                  <ShieldCheck size={32} className="text-slate-400 group-hover:text-black"/>
                </div>
                <h3 className="font-bold text-lg mb-2">신분증 등록</h3>
                <p className="text-xs text-slate-400 mb-4">여권, 운전면허증, 주민등록증 중 택 1</p>
                <button className="bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm">파일 찾기</button>
              </div>

              {/* 어학 성적 증명서 */}
              <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                  <Globe size={32} className="text-slate-400 group-hover:text-black"/>
                </div>
                <h3 className="font-bold text-lg mb-2">어학 능력 증빙 (선택)</h3>
                <p className="text-xs text-slate-400 mb-4">TOPIK, JLPT 등 자격증이 있다면 올려주세요.</p>
                <button className="bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm">파일 찾기</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: 체험 상세 내용 */}
        {step === 3 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-amber-50 text-amber-600 font-bold px-3 py-1 rounded-full text-xs">Step 3. 체험 소개</span>
              <h1 className="text-3xl md:text-4xl font-black">어떤 경험을 제공하나요?</h1>
              <p className="text-slate-500">매력적인 제목과 설명으로 게스트의 마음을 사로잡으세요.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2 ml-1">체험 제목</label>
                <input 
                  type="text" 
                  placeholder="예) 일본 현지인과 퇴근 후 막걸리 한 잔! 🍶" 
                  value={formData.title}
                  onChange={(e) => updateData('title', e.target.value)}
                  className="w-full p-4 text-xl font-bold border-b-2 border-slate-200 focus:border-black outline-none placeholder:text-slate-300 transition-colors bg-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2 ml-1">상세 설명</label>
                <textarea 
                  placeholder="이 체험의 매력 포인트, 진행 코스, 포함 사항 등을 자유롭게 적어주세요." 
                  value={formData.description}
                  onChange={(e) => updateData('description', e.target.value)}
                  className="w-full p-4 h-48 rounded-2xl bg-slate-50 border border-slate-200 focus:border-black focus:bg-white outline-none resize-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 ml-1">만남 장소</label>
                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <MapPin size={20} className="text-slate-400"/>
                  <input 
                    type="text" 
                    placeholder="예) 신주쿠역 동쪽 출구, 스타벅스 앞" 
                    value={formData.meetingPoint}
                    onChange={(e) => updateData('meetingPoint', e.target.value)}
                    className="flex-1 bg-transparent outline-none font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 사진 업로드 */}
        {step === 4 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-purple-50 text-purple-600 font-bold px-3 py-1 rounded-full text-xs">Step 4. 시각 자료</span>
              <h1 className="text-3xl md:text-4xl font-black">멋진 사진을 보여주세요</h1>
              <p className="text-slate-500">현장감이 느껴지는 사진 5장 이상을 추천합니다.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 업로드 버튼 */}
              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                <Camera size={32} className="text-slate-400 mb-2"/>
                <span className="text-xs font-bold text-slate-500">사진 추가하기</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
              </label>

              {/* 업로드된 사진 미리보기 */}
              {formData.photos.map((url, idx) => (
                <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group shadow-sm">
                  <img src={url} className="w-full h-full object-cover"/>
                  <button 
                    onClick={() => updateData('photos', formData.photos.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14}/>
                  </button>
                  {idx === 0 && <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg">대표 사진</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: 요금 설정 (마지막) */}
        {step === 5 && (
          <div className="w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="bg-green-50 text-green-600 font-bold px-3 py-1 rounded-full text-xs">Step 5. 요금 설정</span>
              <h1 className="text-3xl md:text-4xl font-black">얼마나 받을까요?</h1>
              <p className="text-slate-500">게스트 1인당 요금을 설정해 주세요.</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-12 pr-4 py-4 text-4xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"
                />
              </div>
              <p className="mt-4 text-sm text-slate-500">
                비슷한 체험의 평균 요금은 <strong>₩35,000</strong> 입니다.
              </p>

              <div className="mt-12 bg-slate-50 p-6 rounded-2xl w-full max-w-sm border border-slate-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">게스트 결제 금액</span>
                  <span className="font-bold">₩{formData.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-slate-500">서비스 수수료 (10%)</span>
                  <span className="font-bold text-rose-500">- ₩{(formData.price * 0.1).toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200 pt-4 flex justify-between text-lg">
                  <span className="font-black text-slate-900">호스트 정산 금액</span>
                  <span className="font-black text-blue-600">₩{(formData.price * 0.9).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (Fixed Bottom Bar) */}
      <footer className="h-24 px-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-lg z-50">
        <button 
          onClick={prevStep}
          disabled={step === 1}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-100 underline decoration-1'}`}
        >
          이전 단계
        </button>

        <div className="flex gap-4">
          {step === totalSteps ? (
            <button className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-slate-200">
              체험 등록 완료 🎉
            </button>
          ) : (
            <button 
              onClick={nextStep}
              className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              다음 <ChevronRight size={16}/>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}