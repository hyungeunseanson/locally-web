'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, MapPin, X, CheckCircle2, Clock, Users, Plus, Info, Minus, Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { MAJOR_CITIES, CATEGORIES, TOTAL_STEPS, INITIAL_FORM_DATA } from './config';

export default function CreateExperiencePage() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const [isCustomCity, setIsCustomCity] = useState(false); 
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [tempInclusion, setTempInclusion] = useState('');
  const [tempExclusion, setTempExclusion] = useState('');

  const nextStep = () => { if (step < TOTAL_STEPS) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // 카운터 핸들러 (숫자 증감)
  const handleCounter = (key: string, type: 'inc' | 'dec') => {
    const currentVal = formData[key as keyof typeof formData] as number;
    if (type === 'dec' && currentVal <= 1) return;
    updateData(key, type === 'inc' ? currentVal + 1 : currentVal - 1);
  };

  const addItem = (field: 'inclusions' | 'exclusions', value: string, setter: any) => {
    if (!value.trim()) return;
    updateData(field, [...formData[field], value]);
    setter('');
  };

  const removeItem = (field: 'inclusions' | 'exclusions', index: number) => {
    const newList = formData[field].filter((_, i) => i !== index);
    updateData(field, newList);
  };

  const handleCitySelect = (selectedCity: string) => {
    if (selectedCity === '기타') {
      setIsCustomCity(true);
      updateData('city', '');
    } else {
      setIsCustomCity(false);
      updateData('city', selectedCity);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      updateData('photos', [...formData.photos, url]);
      setImageFiles(prev => [...prev, file]);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const photoUrls = [];
      for (const file of imageFiles) {
        const fileName = `experience/${user.id}_${Date.now()}_${Math.random()}`;
        const { error } = await supabase.storage.from('images').upload(fileName, file);
        if (!error) {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          photoUrls.push(data.publicUrl);
        }
      }

      const { error } = await supabase.from('experiences').insert([
        {
          host_id: user.id,
          country: formData.country,
          city: formData.city,
          title: formData.title,
          category: formData.category,
          duration: formData.duration,
          max_guests: formData.maxGuests,
          description: formData.description,
          spots: formData.subCity ? `[${formData.subCity}] ${formData.spots}` : formData.spots,
          meeting_point: formData.meetingPoint,
          photos: photoUrls,
          price: formData.price,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          supplies: formData.supplies,
          rules: formData.rules, 
          status: 'pending' 
        }
      ]);

      if (error) throw error;
      setStep(step + 1);

    } catch (error: any) {
      console.error(error);
      alert('등록 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. 모던 헤더 (슬림한 진행바) */}
      {step < TOTAL_STEPS && (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50 px-6 flex items-center justify-between">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500"/>
          </Link>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Step {step} of {TOTAL_STEPS - 1}</span>
            <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500 ease-out" 
                style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
              />
            </div>
          </div>

          <button className="text-sm font-bold text-slate-400 hover:text-black hover:bg-slate-100 px-3 py-1.5 rounded-full transition-all">
            저장
          </button>
        </header>
      )}

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="flex-1 flex flex-col items-center justify-start pt-32 pb-32 px-6 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 지역 설정 */}
        {step === 1 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">어디서 진행하시나요?</h1>
              <p className="text-slate-500 text-lg">게스트가 찾아갈 수 있는 주요 도시를 알려주세요.</p>
            </div>

            <div className="space-y-8">
              {/* 국가 선택 (탭 스타일) */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-sm mx-auto">
                {['Korea', 'Japan'].map((c) => (
                  <button 
                    key={c}
                    onClick={() => { updateData('country', c); updateData('city', ''); setIsCustomCity(false); }} 
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${formData.country === c ? 'bg-white text-black ring-1 ring-black/5' : 'bg-transparent text-slate-400 hover:text-slate-600 shadow-none'}`}
                  >
                    {c === 'Korea' ? '🇰🇷 한국' : '🇯🇵 일본'}
                  </button>
                ))}
              </div>

              {/* 도시 선택 (카드 그리드 스타일) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block ml-1">주요 도시</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {MAJOR_CITIES[formData.country as 'Korea'|'Japan'].map((city) => (
                    <button 
                      key={city}
                      onClick={() => handleCitySelect(city)}
                      className={`h-14 rounded-xl text-sm font-bold border transition-all hover:scale-[1.02] active:scale-95 ${
                        (!isCustomCity && formData.city === city) || (isCustomCity && city === '기타')
                          ? 'border-black bg-black text-white shadow-lg' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* 기타 입력 & 상세 지역 */}
              <div className="space-y-4">
                {isCustomCity && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">도시 직접 입력</label>
                    <input 
                      type="text" 
                      placeholder="예) 가마쿠라" 
                      value={formData.city}
                      onChange={(e) => updateData('city', e.target.value)}
                      className="w-full p-4 text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-300"
                      autoFocus
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">상세 지역 (동네)</label>
                  <input 
                    type="text" 
                    placeholder={formData.country === 'Korea' ? "예) 마포구 연남동" : "예) 신주쿠구 가부키초"} 
                    value={formData.subCity} 
                    onChange={(e) => updateData('subCity', e.target.value)} 
                    className="w-full p-4 text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 기본 정보 (모던 입력창 & 카운터) */}
        {step === 2 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight">어떤 체험인가요?</h1>
              <p className="text-slate-500 text-lg">제목과 카테고리, 기본 정보를 설정해주세요.</p>
            </div>

            <div className="space-y-10">
              {/* 제목 입력 (Big Input) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">체험 제목</label>
                <input 
                  type="text" 
                  placeholder="매력적인 제목을 입력하세요" 
                  value={formData.title} 
                  onChange={(e)=>updateData('title', e.target.value)} 
                  className="w-full py-4 text-2xl font-black border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-300"
                />
              </div>

              {/* 카테고리 (Pill Style) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">카테고리</label>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => updateData('category', cat)} 
                      className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all hover:scale-105 ${
                        formData.category === cat 
                          ? 'bg-black text-white border-black shadow-md' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 소요시간 & 인원 (Counter UI) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex items-center justify-between p-6 border border-slate-200 rounded-2xl hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Clock size={20} className="text-slate-600"/></div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">소요 시간</div>
                      <div className="text-xs text-slate-500">시간 단위</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleCounter('duration', 'dec')} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"><Minus size={14}/></button>
                    <span className="font-black text-lg w-4 text-center">{formData.duration}</span>
                    <button onClick={() => handleCounter('duration', 'inc')} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"><Plus size={14}/></button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 border border-slate-200 rounded-2xl hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Users size={20} className="text-slate-600"/></div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">최대 인원</div>
                      <div className="text-xs text-slate-500">명 단위</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleCounter('maxGuests', 'dec')} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"><Minus size={14}/></button>
                    <span className="font-black text-lg w-4 text-center">{formData.maxGuests}</span>
                    <button onClick={() => handleCounter('maxGuests', 'inc')} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"><Plus size={14}/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: 상세 정보 (깔끔한 텍스트영역 & 사진 업로드) */}
        {step === 3 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight">매력을 보여주세요</h1>
              <p className="text-slate-500 text-lg">사진과 설명으로 게스트의 마음을 사로잡아보세요.</p>
            </div>

            <div className="space-y-8">
              {/* 사진 업로드 (Drag & Drop 스타일) */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block flex justify-between">
                  사진 (5장 이상 권장)
                  <span className="text-black">{formData.photos.length}장 선택됨</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all group">
                    <Camera size={24} className="text-slate-400 group-hover:text-black mb-2 transition-colors"/>
                    <span className="text-xs font-bold text-slate-500 group-hover:text-black">추가하기</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
                  </label>
                  {formData.photos.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-100 shadow-sm group">
                      <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110"/>
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"/>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상세 설명 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">상세 소개글</label>
                <textarea 
                  placeholder="투어의 흐름, 방문 장소의 매력 등을 자세히 적어주세요."
                  value={formData.description} 
                  onChange={(e)=>updateData('description', e.target.value)} 
                  className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none resize-none text-base leading-relaxed border border-slate-200 focus:border-black focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              {/* 장소 입력 */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">방문 코스 요약</label>
                  <input type="text" placeholder="예) 신주쿠역 -> 오모이데 요코초 -> 야키토리집" value={formData.spots} onChange={(e)=>updateData('spots', e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-black focus:bg-white transition-all text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">만나는 장소</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 focus-within:border-black focus-within:bg-white transition-all">
                    <MapPin size={18} className="text-slate-400"/>
                    <input type="text" placeholder="예) 신주쿠역 동쪽 출구 스타벅스 앞" value={formData.meetingPoint} onChange={(e)=>updateData('meetingPoint', e.target.value)} className="bg-transparent outline-none w-full text-sm font-medium"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 제공 및 규칙 (카드 스타일 리스트) */}
        {step === 4 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight">중요한 정보</h1>
              <p className="text-slate-500 text-lg">게스트가 꼭 알아야 할 내용을 정리해주세요.</p>
            </div>

            <div className="space-y-8">
              {/* 1. 포함/불포함 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">포함 사항</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="예) 음료 1잔" value={tempInclusion} onChange={e=>setTempInclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white border border-slate-200 focus:border-black transition-all" onKeyPress={e => e.key === 'Enter' && addItem('inclusions', tempInclusion, setTempInclusion)}/>
                    <button onClick={()=>addItem('inclusions', tempInclusion, setTempInclusion)} className="bg-black text-white p-3 rounded-xl hover:bg-slate-800 transition-colors"><Plus size={20}/></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.inclusions.map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                        <CheckCircle2 size={12}/> {item}
                        <button onClick={() => removeItem('inclusions', i)} className="hover:text-green-900"><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">불포함 사항</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="예) 교통비" value={tempExclusion} onChange={e=>setTempExclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white border border-slate-200 focus:border-black transition-all" onKeyPress={e => e.key === 'Enter' && addItem('exclusions', tempExclusion, setTempExclusion)}/>
                    <button onClick={()=>addItem('exclusions', tempExclusion, setTempExclusion)} className="bg-slate-200 text-slate-600 p-3 rounded-xl hover:bg-slate-300 transition-colors"><Plus size={20}/></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.exclusions.map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                        {item}
                        <button onClick={() => removeItem('exclusions', i)} className="hover:text-slate-900"><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. 준비물 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">게스트 준비물</label>
                <textarea 
                  placeholder="예) 편한 운동화, 개인 경비(현금), 카메라 등"
                  value={formData.supplies}
                  onChange={(e) => updateData('supplies', e.target.value)}
                  className="w-full p-4 h-24 bg-slate-50 rounded-2xl outline-none resize-none text-sm border border-slate-200 focus:border-black focus:bg-white transition-all"
                />
              </div>

              {/* 3. 이용 규칙 */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Info size={18}/> 이용 규칙</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-1.5 uppercase">참가 연령</span>
                    <input type="text" placeholder="예) 20세 이상" value={formData.rules.age_limit} onChange={(e) => setFormData(prev => ({...prev, rules: {...prev.rules, age_limit: e.target.value}}))} className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200 focus:border-black transition-all"/>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-1.5 uppercase">활동 강도</span>
                    <div className="relative">
                      <select value={formData.rules.activity_level} onChange={(e) => setFormData(prev => ({...prev, rules: {...prev.rules, activity_level: e.target.value}}))} className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200 focus:border-black transition-all appearance-none cursor-pointer">
                        <option value="가벼움">🍃 가벼움 (산책)</option>
                        <option value="보통">🚶 보통 (걷기)</option>
                        <option value="높음">🔥 높음 (등산/운동)</option>
                      </select>
                      <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90"/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 가격 설정 (Big Number) */}
        {step === 5 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight">요금은 얼마인가요?</h1>
              <p className="text-slate-500 text-lg">1인당 가격을 설정해주세요.</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs mb-10">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-300">₩</span>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => updateData('price', Number(e.target.value))}
                  className="w-full pl-12 pr-4 py-4 text-5xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-200 tracking-tight"
                />
              </div>

              {/* 정산 시뮬레이션 (카드 스타일) */}
              <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm border border-slate-100 shadow-xl shadow-slate-200/50">
                <h3 className="font-bold text-lg mb-6 text-center">💰 정산 예상 금액</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>설정 가격</span>
                    <span>₩{formData.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>호스트 수수료 (20%)</span>
                    <span className="text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-200 my-4"></div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">내 통장에 입금</span>
                    <span className="text-2xl font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: 완료 화면 */}
        {step === 6 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500 py-10">
            <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-200">
              <CheckCircle2 size={64} strokeWidth={3}/>
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight">체험 등록 완료! 🎉</h1>
              <p className="text-slate-500 text-lg leading-relaxed max-w-md mx-auto">
                멋진 체험이 등록되었습니다.<br/>
                관리자 검토 후 공개되며, <br/>예약 관리 메뉴에서 <strong>일정을 꼭 오픈</strong>해주세요.
              </p>
            </div>
            
            <div className="pt-8">
              <Link href="/host/dashboard">
                <button className="bg-black text-white px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl">
                  내 체험 보러가기
                </button>
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 고정 네비게이션 (플로팅 스타일) */}
      {step < TOTAL_STEPS && (
        <footer className="fixed bottom-0 left-0 right-0 h-24 px-6 flex items-center justify-between bg-gradient-to-t from-white via-white to-transparent z-50">
          <div className="w-full max-w-4xl mx-auto flex justify-between items-center">
            <button 
              onClick={prevStep}
              disabled={step === 1}
              className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-black underline decoration-2 underline-offset-4'}`}
            >
              이전
            </button>

            {step === TOTAL_STEPS - 1 ? (
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50"
              >
                {loading ? '등록 중...' : '체험 등록하기'}
              </button>
            ) : (
              <button 
                onClick={nextStep}
                className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300"
              >
                다음 <ChevronRight size={18}/>
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}