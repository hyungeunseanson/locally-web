'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, Camera, MapPin, X, CheckCircle2, Clock, Users, Plus, Info, Minus, Map, Trash2, GripVertical
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
    updateData(field, formData[field].filter((_, i) => i !== index));
  };

  // 📍 동선(루트) 관리 함수
  const addItineraryItem = () => {
    updateData('itinerary', [...formData.itinerary, { title: '', description: '', type: 'spot' }]);
  };
  
  const removeItineraryItem = (index: number) => {
    if (formData.itinerary.length <= 1) return; // 최소 1개 유지
    updateData('itinerary', formData.itinerary.filter((_, i) => i !== index));
  };

  const updateItineraryItem = (index: number, key: string, value: string) => {
    const newItinerary = [...formData.itinerary];
    newItinerary[index] = { ...newItinerary[index], [key]: value };
    updateData('itinerary', newItinerary);
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
          // itinerary JSON 저장
          itinerary: formData.itinerary, 
          // spots는 단순 텍스트 검색용으로 변환해서 저장
          spots: formData.itinerary.map(i => i.title).join(' -> '), 
          meeting_point: formData.itinerary[0]?.description || '',
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
      alert('등록 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 헤더 */}
      {step < TOTAL_STEPS && (
        <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md z-50 px-6 flex items-center justify-between">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-900"/></Link>
          <div className="w-1/3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}/>
          </div>
          <div className="w-10"></div> {/* Spacer */}
        </header>
      )}

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center pt-32 pb-40 px-6 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* STEP 1: 지역 & 카테고리 */}
        {step === 1 && (
          <div className="w-full space-y-12">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900">어떤 체험을 준비하셨나요?</h1>
              <p className="text-slate-500 text-lg">지역과 카테고리를 선택해주세요.</p>
            </div>

            <div className="space-y-8">
              {/* 국가 탭 */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {['Korea', 'Japan'].map(c => (
                  <button key={c} onClick={() => updateData('country', c)} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${formData.country === c ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}>
                    {c === 'Korea' ? '🇰🇷 한국' : '🇯🇵 일본'}
                  </button>
                ))}
              </div>

              {/* 도시 선택 */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {MAJOR_CITIES[formData.country as 'Korea'|'Japan'].map((city) => (
                  <button key={city} onClick={() => { setIsCustomCity(city === '기타'); updateData('city', city === '기타' ? '' : city); }}
                    className={`h-14 rounded-2xl text-sm font-bold border transition-all ${(!isCustomCity && formData.city === city) || (isCustomCity && city === '기타') ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
                    {city}
                  </button>
                ))}
              </div>
              
              {isCustomCity && (
                <input type="text" placeholder="도시 이름 입력 (예: 가마쿠라)" value={formData.city} onChange={e => updateData('city', e.target.value)} className="w-full p-4 text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"/>
              )}

              {/* 카테고리 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">카테고리</label>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => updateData('category', cat)} className={`px-5 py-3 rounded-full text-sm font-bold border transition-all ${formData.category === cat ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 기본 정보 (제목 & 사진) */}
        {step === 2 && (
          <div className="w-full space-y-12">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900">체험의 첫인상</h1>
              <p className="text-slate-500 text-lg">매력적인 제목과 멋진 사진을 올려주세요.</p>
            </div>

            <div className="space-y-10">
              <input type="text" placeholder="체험 제목을 입력하세요" value={formData.title} onChange={e => updateData('title', e.target.value)} className="w-full py-4 text-3xl font-black border-b-2 border-slate-200 focus:border-black outline-none bg-transparent placeholder:text-slate-300"/>
              
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                    <Camera size={24} className="text-slate-400 mb-2"/>
                    <span className="text-xs font-bold text-slate-500">사진 추가</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
                  </label>
                  {formData.photos.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative shadow-sm"><img src={url} className="w-full h-full object-cover"/></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ STEP 3: 코스 동선 (신규 기능!) */}
        {step === 3 && (
          <div className="w-full space-y-10">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900">이동 동선 만들기</h1>
              <p className="text-slate-500 text-lg">만나는 곳부터 헤어지는 곳까지, 여정을 그려주세요.</p>
            </div>

            <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-8 py-2">
              {formData.itinerary.map((item, idx) => (
                <div key={idx} className="relative group animate-in slide-in-from-left-4 fade-in duration-300">
                  {/* 타임라인 점 */}
                  <div className={`absolute -left-[41px] top-4 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${idx === 0 ? 'bg-black' : idx === formData.itinerary.length - 1 ? 'bg-slate-900' : 'bg-slate-300'}`}>
                    {idx === 0 && <MapPin size={10} className="text-white"/>}
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 group-hover:border-slate-300 transition-colors relative">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {idx === 0 ? 'START (만나는 장소)' : idx === formData.itinerary.length - 1 ? 'END (헤어지는 장소)' : `STOP ${idx}`}
                      </span>
                      {formData.itinerary.length > 1 && (
                        <button onClick={() => removeItineraryItem(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <input type="text" placeholder={idx === 0 ? "예) 신주쿠역 동쪽 출구" : "장소 이름 (예: 오모이데 요코초)"} value={item.title} onChange={e => updateItineraryItem(idx, 'title', e.target.value)} className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-slate-300"/>
                      <textarea placeholder="무엇을 하나요? (예: 꼬치구이와 맥주 한잔)" value={item.description} onChange={e => updateItineraryItem(idx, 'description', e.target.value)} className="w-full bg-transparent text-sm text-slate-600 outline-none resize-none h-10 placeholder:text-slate-300 leading-relaxed"/>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* 추가 버튼 */}
              <button onClick={addItineraryItem} className="flex items-center gap-3 text-slate-500 hover:text-black font-bold text-sm pl-1 transition-colors">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200"><Plus size={16}/></div>
                경유지 추가하기
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: 상세 정보 (소개 & 제공) */}
        {step === 4 && (
          <div className="w-full space-y-12">
            <div className="space-y-2"><h1 className="text-3xl font-black">디테일을 채워주세요</h1><p className="text-slate-500 text-lg">체험 설명과 제공되는 것들을 적어주세요.</p></div>
            <div className="space-y-8">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">상세 소개글</label>
                <textarea placeholder="투어의 매력 포인트..." value={formData.description} onChange={e => updateData('description', e.target.value)} className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none resize-none text-base border border-slate-200 focus:border-black transition-all"/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">포함 사항</label>
                  <div className="flex gap-2 mb-3"><input type="text" placeholder="예) 음료 1잔" value={tempInclusion} onChange={e=>setTempInclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200 focus:border-black" onKeyPress={e=>e.key==='Enter'&&addItem('inclusions',tempInclusion,setTempInclusion)}/><button onClick={()=>addItem('inclusions',tempInclusion,setTempInclusion)} className="bg-black text-white p-3 rounded-xl"><Plus size={20}/></button></div>
                  <div className="flex flex-wrap gap-2">{formData.inclusions.map((item,i)=><span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">{item}<button onClick={()=>removeItem('inclusions',i)}><X size={12}/></button></span>)}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">불포함 사항</label>
                  <div className="flex gap-2 mb-3"><input type="text" placeholder="예) 교통비" value={tempExclusion} onChange={e=>setTempExclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200 focus:border-black" onKeyPress={e=>e.key==='Enter'&&addItem('exclusions',tempExclusion,setTempExclusion)}/><button onClick={()=>addItem('exclusions',tempExclusion,setTempExclusion)} className="bg-slate-200 text-slate-600 p-3 rounded-xl"><Plus size={20}/></button></div>
                  <div className="flex flex-wrap gap-2">{formData.exclusions.map((item,i)=><span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">{item}<button onClick={()=>removeItem('exclusions',i)}><X size={12}/></button></span>)}</div>
                </div>
              </div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">준비물</label><textarea placeholder="예) 편한 운동화, 개인 경비..." value={formData.supplies} onChange={e => updateData('supplies', e.target.value)} className="w-full p-4 h-24 bg-slate-50 rounded-2xl outline-none resize-none text-sm border border-slate-200 focus:border-black transition-all"/></div>
            </div>
          </div>
        )}

        {/* STEP 5: 규칙 및 설정 */}
        {step === 5 && (
          <div className="w-full space-y-12">
            <div className="space-y-2"><h1 className="text-3xl font-black">기본 규칙 설정</h1><p className="text-slate-500 text-lg">안전하고 즐거운 체험을 위한 규칙입니다.</p></div>
            <div className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">소요 시간 (시간)</label>
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200"><button onClick={()=>handleCounter('duration','dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Minus size={14}/></button><span className="font-black flex-1 text-center">{formData.duration}</span><button onClick={()=>handleCounter('duration','inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Plus size={14}/></button></div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">최대 인원 (명)</label>
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200"><button onClick={()=>handleCounter('maxGuests','dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Minus size={14}/></button><span className="font-black flex-1 text-center">{formData.maxGuests}</span><button onClick={()=>handleCounter('maxGuests','inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Plus size={14}/></button></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">참가 연령</label><input type="text" placeholder="예) 20세 이상" value={formData.rules.age_limit} onChange={e => setFormData(prev => ({...prev, rules: {...prev.rules, age_limit: e.target.value}}))} className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"/></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">활동 강도</label><select value={formData.rules.activity_level} onChange={e => setFormData(prev => ({...prev, rules: {...prev.rules, activity_level: e.target.value}}))} className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none cursor-pointer"><option value="가벼움">🍃 가벼움 (산책)</option><option value="보통">🚶 보통 (걷기)</option><option value="높음">🔥 높음 (등산/운동)</option></select></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: 가격 */}
        {step === 6 && (
          <div className="w-full space-y-12">
            <div className="text-center space-y-2"><h1 className="text-3xl font-black">요금은 얼마인가요?</h1><p className="text-slate-500 text-lg">1인당 가격을 설정해주세요.</p></div>
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs mb-10"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-300">₩</span><input type="number" value={formData.price} onChange={(e) => updateData('price', Number(e.target.value))} className="w-full pl-12 pr-4 py-4 text-5xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent transition-all placeholder:text-slate-200 tracking-tight"/></div>
              <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm border border-slate-100 shadow-xl shadow-slate-200/50"><h3 className="font-bold text-lg mb-6 text-center">💰 정산 예상 금액</h3><div className="space-y-4"><div className="flex justify-between text-sm text-slate-500"><span>설정 가격</span><span>₩{formData.price.toLocaleString()}</span></div><div className="flex justify-between text-sm text-slate-500"><span>호스트 수수료 (20%)</span><span className="text-rose-500">- ₩{(formData.price * 0.2).toLocaleString()}</span></div><div className="border-t border-dashed border-slate-200 my-4"></div><div className="flex justify-between items-center"><span className="font-bold text-slate-900">내 통장에 입금</span><span className="text-2xl font-black text-blue-600">₩{(formData.price * 0.8).toLocaleString()}</span></div></div></div>
            </div>
          </div>
        )}

        {/* STEP 7: 완료 */}
        {step === 7 && (
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500 py-10">
            <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-200"><CheckCircle2 size={64} strokeWidth={3}/></div>
            <div className="space-y-4"><h1 className="text-4xl font-black tracking-tight">체험 등록 완료! 🎉</h1><p className="text-slate-500 text-lg leading-relaxed max-w-md mx-auto">멋진 체험이 등록되었습니다.<br/>관리자 검토 후 공개되며, 예약 관리 메뉴에서 <strong>일정을 꼭 오픈</strong>해주세요.</p></div>
            <div className="pt-8"><Link href="/host/dashboard"><button className="bg-black text-white px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl">내 체험 보러가기</button></Link></div>
          </div>
        )}

      </main>

      {/* 푸터 네비게이션 */}
      {step < TOTAL_STEPS && (
        <footer className="fixed bottom-0 left-0 right-0 h-24 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-between px-6 z-50">
          <button onClick={prevStep} disabled={step === 1} className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>이전</button>
          {step === TOTAL_STEPS - 1 ? (
            <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50">{loading ? '등록 중...' : '체험 등록하기'}</button>
          ) : (
            <button onClick={nextStep} className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">다음 <ChevronRight size={18}/></button>
          )}
        </footer>
      )}
    </div>
  );
}