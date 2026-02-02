'use client';

import React, { useState } from 'react';
import { 
    ChevronLeft, ChevronRight, X, Image as ImageIcon, Camera, 
    MapPin, Clock, Users, DollarSign, CheckCircle2 
  } from 'lucide-react';
import Link from 'next/link';

// --- 단계별 구성 정의 ---
const STEPS = [
  { id: 'category', title: '어떤 종류의 체험인가요?' },
  { id: 'title', title: '체험의 이름을 지어주세요' },
  { id: 'photos', title: '멋진 사진을 추가하세요' },
  { id: 'details', title: '세부 정보를 입력하세요' },
  { id: 'review', title: '마지막으로 확인해주세요' },
];

const CATEGORIES = [
  { id: 'culture', label: '문화/예술', icon: '🎨', desc: '박물관, 갤러리, 고궁 투어 등' },
  { id: 'food', label: '음식/투어', icon: '🍳', desc: '맛집 탐방, 쿠킹 클래스 등' },
  { id: 'nature', label: '자연/야외', icon: '🌲', desc: '등산, 캠핑, 자전거 투어 등' },
  { id: 'night', label: '나이트라이프', icon: '🍸', desc: '바 호핑, 야경 투어 등' },
  { id: 'class', label: '원데이클래스', icon: '🧶', desc: '공예, 드로잉, 향수 만들기 등' },
];

export default function CreateExperiencePage() {
  const [currentStep, setCurrentStep] = useState(0);
  
  // 폼 데이터 상태 관리
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    location: '',
    duration: 2,
    price: 50000,
    images: [] as string[], // 실제 업로드 대신 UI만 구현
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // 진행률 계산 (0% ~ 100%)
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
      
      {/* 1. Header (Progress & Close) */}
      <header className="h-20 px-6 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </Link>
          <div className="hidden md:block text-sm font-bold text-slate-500">
            새로운 체험 등록하기
          </div>
        </div>
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
          <div 
            className="h-full bg-black transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* 2. Main Content (Wizard Step) */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-6 md:p-12 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Step Title */}
        <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
          {STEPS[currentStep].title}
        </h1>
        <p className="text-slate-500 mb-10 text-lg">
          {currentStep === 0 && "게스트에게 가장 잘 어울리는 카테고리를 선택해주세요."}
          {currentStep === 1 && "체험의 매력을 한 문장으로 표현해보세요."}
          {currentStep === 2 && "체험의 분위기를 보여주는 고화질 사진이 필요합니다."}
          {currentStep === 3 && "게스트가 알아야 할 기본 정보를 설정합니다."}
          {currentStep === 4 && "등록하기 전에 내용을 꼼꼼히 확인해주세요."}
        </p>

        {/* --- DYNAMIC STEP CONTENT --- */}
        <div className="min-h-[400px]">
          {currentStep === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({...formData, category: cat.id})}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-black group ${
                    formData.category === cat.id ? 'border-black bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="text-3xl mb-3 block">{cat.icon}</span>
                  <span className="font-bold text-lg block mb-1 group-hover:underline">{cat.label}</span>
                  <span className="text-sm text-slate-500">{cat.desc}</span>
                </button>
              ))}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">체험 제목</label>
                <input 
                  type="text" 
                  className="w-full text-2xl font-bold border-b-2 border-slate-200 py-2 focus:border-black focus:outline-none bg-transparent placeholder:text-slate-300 transition-colors"
                  placeholder="예) 시부야의 숨겨진 맛집 투어"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-2">30자 이내로 짧고 강렬하게 작성하세요.</p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">체험 설명</label>
                <textarea 
                  className="w-full h-40 border border-slate-200 rounded-xl p-4 resize-none focus:border-black focus:outline-none text-lg transition-all"
                  placeholder="이 체험에서 게스트는 무엇을 경험하게 되나요? 특별한 점을 자세히 적어주세요."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-400 hover:border-black hover:text-black hover:bg-slate-50 transition-all cursor-pointer">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <Camera size={32} />
                </div>
                <span className="font-bold text-lg">사진 끌어다 놓기</span>
                <span className="text-sm">또는 클릭해서 업로드</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 border border-slate-200">
                    <ImageIcon size={20} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-bold mb-2 flex items-center gap-2"><DollarSign size={16}/> 1인당 가격 (KRW)</label>
                   <input 
                    type="number"
                    className="w-full p-4 border border-slate-200 rounded-xl text-lg font-bold focus:border-black focus:outline-none"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Clock size={16}/> 소요 시간 (시간)</label>
                   <div className="flex items-center gap-4">
                     <button 
                      onClick={() => setFormData({...formData, duration: Math.max(1, formData.duration - 0.5)})}
                      className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center hover:border-black font-bold"
                     >-</button>
                     <span className="text-xl font-bold w-12 text-center">{formData.duration}</span>
                     <button 
                      onClick={() => setFormData({...formData, duration: formData.duration + 0.5})}
                      className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center hover:border-black font-bold"
                     >+</button>
                   </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2"><MapPin size={16}/> 만나는 장소</label>
                <input 
                  type="text" 
                  className="w-full p-4 border border-slate-200 rounded-xl focus:border-black focus:outline-none"
                  placeholder="예) 시부야역 하치코 동상 앞"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Users size={16}/> 최대 인원</label>
                <select className="w-full p-4 border border-slate-200 rounded-xl bg-white focus:border-black focus:outline-none">
                  <option>1 ~ 4명 (소규모)</option>
                  <option>5 ~ 10명</option>
                  <option>10명 이상 (단체)</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex flex-col items-center">
              {/* Preview Card */}
              <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg mb-8">
                <div className="aspect-[4/3] bg-slate-200 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <ImageIcon size={48} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg line-clamp-2">{formData.title || '체험 제목이 여기에 표시됩니다'}</h3>
                    <div className="flex items-center gap-1 text-sm font-bold">
                       <span className="text-black">★ NEW</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{formData.location || '위치 정보'}</p>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">₩ {formData.price.toLocaleString()}</span>
                    <span className="text-sm text-slate-500">/ 인</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 w-full">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600"/>
                  거의 다 되었습니다!
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  '제출하기'를 누르면 관리자 승인 절차가 시작됩니다. 승인은 보통 24시간 이내에 완료되며, 결과는 이메일과 대시보드 알림으로 알려드립니다.
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                   <span>• 이메일 알림 동의</span>
                   <span>• 호스트 이용약관 동의</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* 3. Footer Navigation */}
      <footer className="h-24 border-t border-slate-100 px-6 md:px-12 flex items-center justify-between bg-white sticky bottom-0 z-50">
        <button 
          onClick={handleBack}
          className={`font-bold underline text-slate-900 px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
        >
          뒤로
        </button>
        
        {currentStep === STEPS.length - 1 ? (
          <Link href="/host/dashboard">
            <button className="bg-gradient-to-r from-slate-900 to-black text-white font-bold text-lg px-8 py-4 rounded-xl hover:shadow-lg hover:scale-105 transition-all">
              제출하기
            </button>
          </Link>
        ) : (
          <button 
            onClick={handleNext}
            className="bg-black text-white font-bold text-lg px-8 py-4 rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            다음 <ChevronRight size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}