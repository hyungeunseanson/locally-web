'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, Globe, MapPin, X, User, Instagram, 
  CheckCircle2, ShieldCheck, Flag, CreditCard, Clock
} from 'lucide-react';
import Link from 'next/link';

export default function CreateExperiencePage() {
  const [step, setStep] = useState(1);
  const totalSteps = 7; // 총 7단계로 확장

  // 입력 데이터 상태
  const [formData, setFormData] = useState({
    // Step 1: 타겟 언어 (국적)
    targetLanguage: '', // Korean, Japanese, English, Chinese

    // Step 2: 기본 정보
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',
    
    // Step 3: 언어 능력
    languageLevel: 2, 
    languageCert: '',

    // Step 4: 신분 인증
    idCardType: '', 
    idCardFile: null as string | null,

    // Step 5: 투어 정보
    country: 'Korea', // 기본값
    city: '',
    spots: '', 
    meetingPoint: '',
    duration: 3,
    title: '', 
    description: '', // 상세 소개글
    photos: [] as string[],

    // Step 6: 가격
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
        
        {/* STEP 1: 타겟 언어 선택 (국적) */}
        {step === 1 && (
          <div className="w-full space-y-10">
            <div className="text-center">
              <span className="bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-full text-xs">Step 1. 언어 선택</span>
              <h1 className="text-3xl font-black mt-6 mb-3">어떤 언어권의 게스트를 만나시겠어요?</h1>
              <p className="text-slate-500">주로 소통하게 될 언어를 선택해 주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { code: 'Japanese', label: '일본어 🇯🇵', desc: '일본인 게스트' },
                { code: 'English', label: '영어 🇺🇸', desc: '영어권 게스트' },
                { code: 'Chinese', label: '중국어 🇨🇳', desc: '중화권 게스트' },
                { code: 'Korean', label: '한국어 🇰🇷', desc: '한국인 게스트' },
              ].map((lang) => (
                <button 
                  key={lang.code}
                  onClick={() => updateData('targetLanguage', lang.code)}
                  className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-md ${formData.targetLanguage === lang.code ? 'border-black bg-slate-50' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="text-lg font-black mb-1">{lang.label}</div>
                  <div className="text-sm text-slate-500">{lang.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: 기본 정보 */}
        {step === 2 && (
          <div className="w-full space-y-10">
            <div className="text-center">
              <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-xs">Step 2. 기본 정보</span>
              <h1 className="text-3xl font-black mt-6 mb-3">호스트님에 대해 알려주세요</h1>
              <p className="text-slate-500">원활한 연락을 위해 정확한 정보를 입력해 주세요.</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">성함 (실명)</label>
                  <input type="text" placeholder="홍길동" value={formData.name} onChange={(e)=>updateData('name', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">생년월일</label>
                  <input type="text" placeholder="YYYY.MM.DD" value={formData.dob} onChange={(e)=>updateData('dob', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">전화번호</label>
                <input type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e)=>updateData('phone', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">이메일 주소</label>
                <input type="email" placeholder="example@gmail.com" value={formData.email} onChange={(e)=>updateData('email', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 flex items-center gap-1"><Instagram size={12}/> Instagram ID</label>
                  <input type="text" placeholder="@locally.host" value={formData.instagram} onChange={(e)=>updateData('instagram', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">로컬리를 알게 된 계기</label>
                  <input type="text" placeholder="예) 인스타 릴스, 지인 추천" value={formData.source} onChange={(e)=>updateData('source', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-1 focus:ring-black transition-all"/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: 언어 능력 (명확한 워딩) */}
        {step === 3 && (
          <div className="w-full space-y-10">
            <div className="text-center">
              <span className="bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full text-xs">Step 3. 언어 능력</span>
              <h1 className="text-3xl font-black mt-6 mb-3">해당 언어를 얼마나 잘하시나요?</h1>
              <p className="text-slate-500">게스트와의 원활한 소통을 위해 솔직하게 선택해 주세요.</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
              <label className="block font-bold mb-6 flex items-center gap-2">
                <Globe size={18}/> 구사 능력 선택
              </label>
              <input 
                type="range" min="1" max="4" step="1" 
                value={formData.languageLevel}
                onChange={(e) => updateData('languageLevel', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black mb-8"
              />
              
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold text-slate-400 mb-6">
                <span className={formData.languageLevel===1 ? 'text-black':''}>초급</span>
                <span className={formData.languageLevel===2 ? 'text-black':''}>중급</span>
                <span className={formData.languageLevel===3 ? 'text-black':''}>상급</span>
                <span className={formData.languageLevel===4 ? 'text-black':''}>원어민</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-100 text-center shadow-sm">
                <span className="text-sm font-bold text-slate-900 block">
                  {formData.languageLevel === 1 && "간단한 자기소개 가능 (번역기 필수)"}
                  {formData.languageLevel === 2 && "간단한 일상 대화 가능 (부분 번역기)"}
                  {formData.languageLevel === 3 && "일상 회화에 문제 없음"}
                  {formData.languageLevel === 4 && "비즈니스 회화 및 복잡한 표현 가능"}
                </span>
              </div>

              <div className="mt-8">
                <label className="font-bold block mb-2 text-sm ml-1">어학 자격증 (선택)</label>
                <input type="text" placeholder="예) JLPT N1, TOEIC 900, HSK 6급" value={formData.languageCert} onChange={(e)=>updateData('languageCert', e.target.value)} className="w-full p-4 bg-white rounded-xl outline-none border border-slate-200 focus:border-black text-sm"/>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 신분 인증 (뱃지 획득) */}
        {step === 4 && (
          <div className="w-full space-y-10">
            <div className="text-center">
              <span className="bg-purple-50 text-purple-600 font-bold px-3 py-1 rounded-full text-xs">Step 4. 신뢰 인증</span>
              <h1 className="text-3xl font-black mt-6 mb-3">인증된 호스트 뱃지 받기</h1>
              <p className="text-slate-500">신분증을 제출하면 프로필에 <span className="text-blue-600 font-bold"><ShieldCheck size={14} className="inline"/> 인증 뱃지</span>가 표시됩니다.</p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center hover:bg-slate-50 transition-all cursor-pointer group relative">
              <input type="file" accept="image/*" className="hidden" id="id-upload" onChange={(e) => handlePhotoUpload(e, 'idCardFile')}/>
              
              {formData.idCardFile ? (
                <div className="relative h-48 w-full flex flex-col items-center justify-center">
                  <img src={formData.idCardFile} className="h-full object-contain rounded-lg shadow-sm"/>
                  <button onClick={(e) => { e.preventDefault(); updateData('idCardFile', null); }} className="absolute top-0 right-0 bg-black text-white p-1 rounded-full hover:scale-110 transition-transform"><X size={16}/></button>
                  <p className="text-green-600 font-bold mt-4 flex items-center gap-2"><CheckCircle2 size={18}/> 업로드 완료</p>
                </div>
              ) : (
                <label htmlFor="id-upload" className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <CreditCard size={32} className="text-slate-400 group-hover:text-black"/>
                  </div>
                  <h3 className="font-bold text-lg mb-2">신분증 업로드</h3>
                  <p className="text-xs text-slate-400 mb-6">여권, 운전면허증, 주민등록증 중 택 1</p>
                  <span className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md">파일 선택하기</span>
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-4">* 제출된 정보는 본인 확인 후 즉시 파기됩니다.</p>
          </div>
        )}

        {/* STEP 5: 투어 정보 (국가 선택 + 도시 입력) */}
        {step === 5 && (
          <div className="w-full space-y-8">
            <div className="text-center">
              <span className="bg-rose-50 text-rose-600 font-bold px-3 py-1 rounded-full text-xs">Step 5. 투어 정보</span>
              <h1 className="text-3xl font-black mt-6 mb-3">어디서 만날까요?</h1>
              <p className="text-slate-500">투어 장소와 상세 내용을 입력해 주세요.</p>
            </div>

            <div className="space-y-6">
              {/* 국가 및 지역 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="font-bold block mb-2 text-xs text-slate-500">국가</label>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => updateData('country', 'Japan')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${formData.country === 'Japan' ? 'bg-black text-white border-black' : 'bg-white text-slate-500'}`}>🇯🇵 일본</button>
                    <button onClick={() => updateData('country', 'Korea')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${formData.country === 'Korea' ? 'bg-black text-white border-black' : 'bg-white text-slate-500'}`}>🇰🇷 한국</button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="font-bold block mb-2 text-xs text-slate-500">개최 지역 (도시/동네)</label>
                  <input 
                    type="text" 
                    placeholder="예) 도쿄 신주쿠, 서울 홍대" 
                    value={formData.city} 
                    onChange={(e)=>updateData('city', e.target.value)} 
                    className="w-full h-[108px] p-4 bg-slate-50 rounded-xl outline-none font-bold text-lg border border-transparent focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-2 text-sm">투어 제목</label>
                <input type="text" placeholder="예) 현지인과 함께하는 퇴근 후 이자카야 탐방 🍻" value={formData.title} onChange={(e)=>updateData('title', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black"/>
              </div>

              <div>
                <label className="font-bold block mb-2 text-sm">방문 장소 & 코스</label>
                <input type="text" placeholder="예) 신주쿠역 -> 오모이데 요코초 -> 야키토리집" value={formData.spots} onChange={(e)=>updateData('spots', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black"/>
              </div>

              <div>
                <label className="font-bold block mb-2 text-sm">상세 소개글</label>
                <textarea 
                  placeholder="투어의 매력 포인트, 진행 방식 등을 자유롭게 적어주세요. (최소 50자 이상 권장)"
                  value={formData.description} 
                  onChange={(e)=>updateData('description', e.target.value)} 
                  className="w-full p-4 h-40 bg-slate-50 rounded-xl outline-none resize-none text-sm leading-relaxed border border-transparent focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold block mb-1 text-xs text-slate-500">미팅 장소</label>
                  <input type="text" placeholder="신주쿠역 동쪽 출구" value={formData.meetingPoint} onChange={(e)=>updateData('meetingPoint', e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm"/>
                </div>
                <div>
                  <label className="font-bold block mb-1 text-xs text-slate-500">소요 시간 (시간)</label>
                  <input type="number" placeholder="3" value={formData.duration} onChange={(e)=>updateData('duration', e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm"/>
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="font-bold block mb-2 text-sm flex justify-between">
                  투어 사진 (5장 이상 권장)
                  <span className="text-slate-400 text-xs font-normal">현재 {formData.photos.length}장</span>
                </label>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <label className="w-24 h-24 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                    <Camera size={20} className="text-slate-400"/>
                    <span className="text-[10px] text-slate-500 mt-1">추가</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'photos')}/>
                  </label>
                  {formData.photos.map((url, idx) => (
                    <div key={idx} className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden relative border border-slate-200">
                      <img src={url} className="w-full h-full object-cover"/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: 가격 설정 (수수료 로직 반영) */}
        {step === 6 && (
          <div className="w-full space-y-10">
            <div className="text-center">
              <span className="bg-green-50 text-green-600 font-bold px-3 py-1 rounded-full text-xs">Step 6. 요금 설정</span>
              <h1 className="text-3xl font-black mt-6 mb-3">얼마나 받을까요?</h1>
              <p className="text-slate-500">호스트 수수료를 제외한 정산 금액을 확인하세요.</p>
            </div>

            <div className="flex flex-col items-center">
              <label className="font-bold mb-4 text-slate-500">1인당 투어 가격</label>
              <div className="relative w-full max-w-xs mb-8">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-12 pr-4 py-4 text-4xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all"
                />
              </div>

              {/* 정산 시뮬레이션 */}
              <div className="bg-white p-8 rounded-3xl w-full max-w-sm border border-slate-200 shadow-xl shadow-slate-100">
                <h3 className="font-bold text-lg mb-6 border-b border-slate-100 pb-4">💰 정산 예상 금액</h3>
                
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-slate-500">설정 가격</span>
                  <span className="font-bold">₩{formData.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-6">
                  <span className="text-slate-500">호스트 수수료 (20%)</span>
                  <span className="font-bold text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span>
                </div>
                
                <div className="border-t-2 border-dashed border-slate-100 pt-6 flex justify-between items-center">
                  <span className="font-bold text-slate-900">내 통장에 입금</span>
                  <span className="text-2xl font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span>
                </div>
                
                <div className="mt-6 bg-slate-50 p-3 rounded-lg text-[11px] text-slate-400 text-center leading-tight">
                  * 게스트 결제 시에는 플랫폼 수수료(10%)가 별도로 부과됩니다.<br/>
                  (호스트 정산금에는 영향을 주지 않습니다)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: 완료 화면 (검토 대기) */}
        {step === 7 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle2 size={48}/>
            </div>
            <div>
              <h1 className="text-3xl font-black mb-4">제출이 완료되었습니다! 🎉</h1>
              <p className="text-slate-500 leading-relaxed max-w-md mx-auto">
                꼼꼼하게 작성해 주셔서 감사합니다.<br/>
                담당자가 내용을 검토한 후,<br/>
                <strong>영업일 기준 2~3일 내</strong>에 연락드리겠습니다.
              </p>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-sm mx-auto text-left space-y-3">
              <h4 className="font-bold text-sm text-slate-900">✅ 이후 진행 절차</h4>
              <ul className="text-xs text-slate-500 space-y-2">
                <li className="flex gap-2"><span>1.</span> <span>서류 및 자격 심사 (신분증 확인)</span></li>
                <li className="flex gap-2"><span>2.</span> <span>유선 또는 화상 인터뷰 (필요시)</span></li>
                <li className="flex gap-2"><span>3.</span> <span>최종 승인 및 투어 오픈</span></li>
              </ul>
            </div>

            <Link href="/host/dashboard">
              <button className="bg-black text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-xl mt-8">
                대시보드로 이동
              </button>
            </Link>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (Step 7 완료 화면 제외) */}
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
                className="bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg"
              >
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
      )}
    </div>
  );
}