'use client';

import React from 'react';
import { 
  Camera, MapPin, CheckCircle2, Plus, Minus, Trash2, X, Lock, Check 
} from 'lucide-react';
import Link from 'next/link';
import { MAJOR_CITIES, CATEGORIES, SUPPORTED_LANGUAGES } from '../config';

export default function ExperienceFormSteps({
  step,
  formData,
  updateData,
  handleCounter,
  handlePhotoUpload,
  addItem,
  removeItem,
  addItineraryItem,
  removeItineraryItem,
  updateItineraryItem,
  isCustomCity,
  setIsCustomCity,
  tempInclusion,
  setTempInclusion,
  tempExclusion,
  setTempExclusion
}: any) {

  // --- STEP 1 ---
  if (step === 1) {
    const toggleLanguage = (lang: string) => {
      const current = formData.languages || [];
      if (current.includes(lang)) {
        updateData('languages', current.filter((l: string) => l !== lang));
      } else {
        updateData('languages', [...current, lang]);
      }
    };

    return (
      <div className="w-full space-y-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">어떤 체험을 준비하셨나요?</h1>
          <p className="text-slate-500 text-lg">지역, 카테고리, 그리고 언어를 선택해주세요.</p>
        </div>

        <div className="space-y-8">
          {/* 국가 */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            {['Korea', 'Japan'].map(c => (
              <button key={c} onClick={() => updateData('country', c)} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${formData.country === c ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}>
                {c === 'Korea' ? '🇰🇷 한국' : '🇯🇵 일본'}
              </button>
            ))}
          </div>

          {/* 도시 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {MAJOR_CITIES[formData.country as 'Korea'|'Japan'].map((city: string) => (
              <button key={city} onClick={() => { setIsCustomCity(city === '기타'); updateData('city', city === '기타' ? '' : city); }}
                className={`h-14 rounded-2xl text-sm font-bold border transition-all ${(!isCustomCity && formData.city === city) || (isCustomCity && city === '기타') ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
                {city}
              </button>
            ))}
          </div>
          
          {isCustomCity && (
            <input type="text" placeholder="도시 이름 입력 (예: 가마쿠라)" value={formData.city} onChange={(e) => updateData('city', e.target.value)} className="w-full p-4 text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"/>
          )}

          {/* 카테고리 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">카테고리</label>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map((cat: string) => (
                <button key={cat} onClick={() => updateData('category', cat)} className={`px-5 py-3 rounded-full text-sm font-bold border transition-all ${formData.category === cat ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ 언어 선택 */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">진행 가능한 언어 (다중 선택)</label>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_LANGUAGES.map((lang: string) => {
                const isSelected = (formData.languages || []).includes(lang);
                return (
                  <button 
                    key={lang} 
                    onClick={() => toggleLanguage(lang)} 
                    className={`px-5 py-3 rounded-full text-sm font-bold border transition-all flex items-center gap-2
                      ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}
                  >
                    {lang}
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 2 ~ 7 (기존 코드 유지) ---
  // 아래는 기존 코드와 동일합니다.
  
  if (step === 2) {
    return (
      <div className="w-full space-y-12">
        <div className="space-y-2"><h1 className="text-3xl font-black text-slate-900">체험의 첫인상</h1><p className="text-slate-500 text-lg">매력적인 제목과 멋진 사진을 올려주세요.</p></div>
        <div className="space-y-10">
          <input type="text" placeholder="체험 제목을 입력하세요" value={formData.title} onChange={(e) => updateData('title', e.target.value)} className="w-full py-4 text-3xl font-black border-b-2 border-slate-200 focus:border-black outline-none bg-transparent placeholder:text-slate-300"/>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all"><Camera size={24} className="text-slate-400 mb-2"/><span className="text-xs font-bold text-slate-500">사진 추가</span><input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload}/></label>
            {formData.photos.map((url: string, idx: number) => (<div key={idx} className="aspect-square rounded-2xl overflow-hidden relative shadow-sm"><img src={url} className="w-full h-full object-cover"/></div>))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="w-full space-y-10">
        <div className="space-y-2"><h1 className="text-3xl font-black text-slate-900">이동 동선 만들기</h1><p className="text-slate-500 text-lg">만나는 곳부터 헤어지는 곳까지, 여정을 그려주세요.</p></div>
        <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-8 py-2">
          {formData.itinerary.map((item: any, idx: number) => (
            <div key={idx} className="relative group animate-in slide-in-from-left-4 fade-in duration-300">
              <div className={`absolute -left-[41px] top-4 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${idx === 0 ? 'bg-black' : idx === formData.itinerary.length - 1 ? 'bg-slate-900' : 'bg-slate-300'}`}>{idx === 0 && <MapPin size={10} className="text-white"/>}</div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 group-hover:border-slate-300 transition-colors relative">
                <div className="flex justify-between items-start mb-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{idx === 0 ? 'START' : idx === formData.itinerary.length - 1 ? 'END' : `STOP ${idx}`}</span>{formData.itinerary.length > 1 && (<button onClick={() => removeItineraryItem(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>)}</div>
                <div className="space-y-3"><input type="text" placeholder="장소 이름" value={item.title} onChange={(e) => updateItineraryItem(idx, 'title', e.target.value)} className="w-full bg-transparent text-lg font-bold outline-none"/><textarea placeholder="설명" value={item.description} onChange={(e) => updateItineraryItem(idx, 'description', e.target.value)} className="w-full bg-transparent text-sm text-slate-600 outline-none resize-none h-10"/></div>
              </div>
            </div>
          ))}
          <button onClick={addItineraryItem} className="flex items-center gap-3 text-slate-500 hover:text-black font-bold text-sm pl-1"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200"><Plus size={16}/></div>경유지 추가하기</button>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="w-full space-y-12">
        <div className="space-y-2"><h1 className="text-3xl font-black">디테일을 채워주세요</h1><p className="text-slate-500 text-lg">상세 설명과 제공 사항을 입력하세요.</p></div>
        <div className="space-y-8">
          <textarea placeholder="상세 소개글" value={formData.description} onChange={(e) => updateData('description', e.target.value)} className="w-full p-5 h-48 bg-slate-50 rounded-2xl outline-none resize-none text-base border border-slate-200 focus:border-black"/>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">포함 사항</label><div className="flex gap-2 mb-3"><input type="text" placeholder="예) 음료" value={tempInclusion} onChange={(e)=>setTempInclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200" onKeyPress={(e)=>e.key==='Enter'&&addItem('inclusions',tempInclusion,setTempInclusion)}/><button onClick={()=>addItem('inclusions',tempInclusion,setTempInclusion)} className="bg-black text-white p-3 rounded-xl"><Plus size={20}/></button></div><div className="flex flex-wrap gap-2">{formData.inclusions.map((item: string,i: number)=><span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">{item}<button onClick={()=>removeItem('inclusions',i)}><X size={12}/></button></span>)}</div></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">불포함 사항</label><div className="flex gap-2 mb-3"><input type="text" placeholder="예) 교통비" value={tempExclusion} onChange={(e)=>setTempExclusion(e.target.value)} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200" onKeyPress={(e)=>e.key==='Enter'&&addItem('exclusions',tempExclusion,setTempExclusion)}/><button onClick={()=>addItem('exclusions',tempExclusion,setTempExclusion)} className="bg-slate-200 text-slate-600 p-3 rounded-xl"><Plus size={20}/></button></div><div className="flex flex-wrap gap-2">{formData.exclusions.map((item: string,i: number)=><span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">{item}<button onClick={()=>removeItem('exclusions',i)}><X size={12}/></button></span>)}</div></div>
          </div>
          <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">준비물</label><textarea placeholder="예) 운동화" value={formData.supplies} onChange={(e) => updateData('supplies', e.target.value)} className="w-full p-4 h-24 bg-slate-50 rounded-2xl outline-none resize-none text-sm border border-slate-200 focus:border-black"/></div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="w-full space-y-12">
        <div className="space-y-2"><h1 className="text-3xl font-black">기본 규칙 설정</h1><p className="text-slate-500 text-lg">규칙을 설정하세요.</p></div>
        <div className="space-y-8">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">소요 시간</label><div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200"><button onClick={()=>handleCounter('duration','dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Minus size={14}/></button><span className="font-black flex-1 text-center">{formData.duration}</span><button onClick={()=>handleCounter('duration','inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Plus size={14}/></button></div></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">최대 인원</label><div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200"><button onClick={()=>handleCounter('maxGuests','dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Minus size={14}/></button><span className="font-black flex-1 text-center">{formData.maxGuests}</span><button onClick={()=>handleCounter('maxGuests','inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Plus size={14}/></button></div></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">참가 연령</label><input type="text" placeholder="예) 20세 이상" value={formData.rules.age_limit} onChange={(e) => updateData('rules', {...formData.rules, age_limit: e.target.value})} className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"/></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">활동 강도</label><select value={formData.rules.activity_level} onChange={(e) => updateData('rules', {...formData.rules, activity_level: e.target.value})} className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"><option value="가벼움">🍃 가벼움</option><option value="보통">🚶 보통</option><option value="높음">🔥 높음</option></select></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="w-full space-y-12">
        <div className="text-center space-y-2"><h1 className="text-3xl font-black">요금 설정</h1><p className="text-slate-500 text-lg">가격을 설정하세요.</p></div>
        <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-8">
          <div className="w-full"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-center">기본 1인당 가격</label><div className="relative w-full max-w-xs mx-auto"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-300">₩</span><input type="number" value={formData.price} onChange={(e) => updateData('price', Number(e.target.value))} className="w-full pl-12 pr-4 py-4 text-5xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"/></div></div>
          
          <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2"><Lock size={18} className="text-slate-900"/><span className="font-bold text-slate-900">단독 투어 옵션</span></div>
              <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.is_private_enabled || false} onChange={(e) => updateData('is_private_enabled', e.target.checked)}/><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div></label>
            </div>
            {formData.is_private_enabled && (<div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-200 mt-2"><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₩</span><input type="number" value={formData.private_price || 0} onChange={(e) => updateData('private_price', Number(e.target.value))} className="w-full pl-10 pr-4 py-3 text-xl font-bold bg-white border border-slate-300 rounded-xl focus:border-black outline-none" placeholder="단독 투어 고정 가격"/></div></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (step === 7) {
    return (
      <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500 py-10">
        <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-200"><CheckCircle2 size={64} strokeWidth={3}/></div>
        <div className="space-y-4"><h1 className="text-4xl font-black tracking-tight">체험 등록 완료! 🎉</h1><p className="text-slate-500 text-lg leading-relaxed max-w-md mx-auto">관리자 검토 후 공개됩니다.</p></div>
        <div className="pt-8"><Link href="/host/dashboard"><button className="bg-black text-white px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl">내 체험 보러가기</button></Link></div>
      </div>
    );
  }

  return null;
}