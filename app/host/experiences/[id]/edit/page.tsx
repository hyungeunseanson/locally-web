'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, MapPin, Plus, Trash2, X, Camera, Check } from 'lucide-react';
import { CATEGORIES, SUPPORTED_LANGUAGES, MAJOR_CITIES } from '@/app/host/create/config';

export default function EditExperiencePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'course'>('basic');

  // 데이터 불러오기
  useEffect(() => {
    const fetchExp = async () => {
      const { data } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (data) {
        setFormData({
          ...data,
          // 배열 데이터 안전하게 초기화
          photos: data.photos || [],
          languages: data.languages || [],
          inclusions: data.inclusions || [],
          exclusions: data.exclusions || [],
          itinerary: data.itinerary || [],
          rules: data.rules || { age_limit: '', activity_level: '보통', refund_policy: '' }
        });
      }
      setLoading(false);
    };
    fetchExp();
  }, [params.id]);

  // 저장하기
  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('experiences')
        .update({ 
          title: formData.title, 
          price: formData.price, 
          country: formData.country,
          city: formData.city,
          category: formData.category,
          languages: formData.languages,
          description: formData.description,
          photos: formData.photos,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          itinerary: formData.itinerary,
          supplies: formData.supplies,
          rules: formData.rules,
          meeting_point: formData.meeting_point,
          max_guests: formData.max_guests,
          duration: formData.duration
        })
        .eq('id', params.id);
      
      if (error) throw error;
      alert('성공적으로 수정되었습니다.');
      router.refresh();
    } catch (e: any) {
      alert('수정 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 📸 사진 업로드 핸들러 (즉시 업로드)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    
    try {
      const file = e.target.files[0];
      const fileName = `experience/${formData.host_id}_${Date.now()}_${Math.random()}`;
      const { error } = await supabase.storage.from('images').upload(fileName, file);
      
      if (error) throw error;
      
      const { data } = supabase.storage.from('images').getPublicUrl(fileName);
      setFormData((prev: any) => ({ ...prev, photos: [...prev.photos, data.publicUrl] }));
      
    } catch (err: any) {
      alert('사진 업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // 🗑️ 사진 삭제 핸들러
  const removePhoto = (indexToRemove: number) => {
    if (confirm('이 사진을 삭제하시겠습니까?')) {
      setFormData((prev: any) => ({
        ...prev,
        photos: prev.photos.filter((_: string, idx: number) => idx !== indexToRemove)
      }));
    }
  };

  // 언어 토글
  const toggleLanguage = (lang: string) => {
    const current = formData.languages || [];
    if (current.includes(lang)) {
      setFormData({ ...formData, languages: current.filter((l: string) => l !== lang) });
    } else {
      setFormData({ ...formData, languages: [...current, lang] });
    }
  };

  // 배열 항목 수정 (포함/불포함)
  const handleArrayChange = (field: string, idx: number, value: string) => {
    const newArr = [...formData[field]];
    newArr[idx] = value;
    setFormData({ ...formData, [field]: newArr });
  };
  const addArrayItem = (field: string) => setFormData({ ...formData, [field]: [...formData[field], ''] });
  const removeArrayItem = (field: string, idx: number) => setFormData({ ...formData, [field]: formData[field].filter((_:any, i:number) => i !== idx) });

  // 동선(Itinerary) 수정
  const updateItinerary = (idx: number, key: string, value: string) => {
    const newItinerary = [...formData.itinerary];
    newItinerary[idx] = { ...newItinerary[idx], [key]: value };
    setFormData({ ...formData, itinerary: newItinerary });
  };
  const addItineraryItem = () => setFormData({ ...formData, itinerary: [...formData.itinerary, { title: '', description: '', type: 'spot' }] });
  const removeItineraryItem = (idx: number) => setFormData({ ...formData, itinerary: formData.itinerary.filter((_:any, i:number) => i !== idx) });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-black"></div></div>;
  if (!formData) return <div className="p-10 text-center">데이터를 불러올 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20">
      <SiteHeader />
      
      {/* 상단 고정 헤더 */}
      <div className="sticky top-20 z-40 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft size={20}/></Link>
          <h1 className="text-lg font-black truncate max-w-md">{formData.title}</h1>
        </div>
        <button onClick={handleUpdate} disabled={saving} className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg disabled:opacity-50">
          {saving ? '저장 중...' : <><Save size={16}/> 저장하기</>}
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        
        {/* 탭 메뉴 */}
        <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: 'basic', label: '기본 정보 & 사진' },
            { id: 'detail', label: '상세 설명' },
            { id: 'course', label: '코스 및 규칙' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. 기본 정보 & 사진 탭 */}
        {activeTab === 'basic' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 📸 사진 관리 섹션 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-900 mb-4">사진 관리 ({formData.photos.length}장)</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {/* 업로드 버튼 */}
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-white transition-all bg-white">
                        {uploading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-black"/> : <Camera size={24} className="text-slate-400 mb-2"/>}
                        <span className="text-xs font-bold text-slate-500">{uploading ? '업로드 중' : '추가하기'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                    </label>
                    {/* 사진 목록 */}
                    {formData.photos.map((url: string, idx: number) => (
                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group shadow-sm border border-slate-200">
                            <img src={url} className="w-full h-full object-cover"/>
                            <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">체험 제목</label>
              <input className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none transition-all" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">국가</label>
                    <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none appearance-none" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})}>
                        <option value="Korea">🇰🇷 한국</option>
                        <option value="Japan">🇯🇵 일본</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">도시</label>
                    <input className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                </div>
            </div>

            {/* 언어 선택 */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-3">진행 언어</label>
                <div className="flex flex-wrap gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                        <button key={lang} onClick={() => toggleLanguage(lang)} className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2 transition-all ${formData.languages.includes(lang) ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                            {lang} {formData.languages.includes(lang) && <Check size={14}/>}
                        </button>
                    ))}
                </div>
            </div>

            {/* 카테고리 */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-3">카테고리</label>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                        <button key={cat} onClick={() => setFormData({...formData, category: cat})} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${formData.category === cat ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">가격 (1인당)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₩</span>
                  <input type="number" className="w-full p-4 pl-10 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">최대 인원</label>
                <input type="number" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.max_guests} onChange={(e) => setFormData({...formData, max_guests: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">만나는 장소</label>
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-4 rounded-xl focus-within:border-black">
                <MapPin size={18} className="text-slate-400"/>
                <input className="bg-transparent w-full outline-none font-medium" value={formData.meeting_point} onChange={(e) => setFormData({...formData, meeting_point: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {/* 2. 상세 설명 탭 */}
        {activeTab === 'detail' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">상세 소개글</label>
              <textarea className="w-full p-4 h-64 bg-white border border-slate-200 rounded-xl leading-relaxed focus:border-black outline-none resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">포함 사항</label>
                <div className="space-y-2">
                  {formData.inclusions.map((item: string, i: number) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('inclusions', i, e.target.value)} />
                      <button onClick={() => removeArrayItem('inclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => addArrayItem('inclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12}/> 항목 추가</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">불포함 사항</label>
                <div className="space-y-2">
                  {formData.exclusions.map((item: string, i: number) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('exclusions', i, e.target.value)} />
                      <button onClick={() => removeArrayItem('exclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => addArrayItem('exclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12}/> 항목 추가</button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">준비물</label>
              <textarea className="w-full p-4 h-24 bg-white border border-slate-200 rounded-xl text-sm focus:border-black outline-none" value={formData.supplies} onChange={(e) => setFormData({...formData, supplies: e.target.value})} />
            </div>
          </div>
        )}

        {/* 3. 코스 및 규칙 탭 */}
        {activeTab === 'course' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-4">이동 동선 (Itinerary)</label>
              <div className="space-y-4 border-l-2 border-slate-200 ml-3 pl-6">
                {formData.itinerary?.map((item: any, i: number) => (
                  <div key={i} className="relative group">
                    <div className="absolute -left-[31px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-slate-900 z-10"></div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 group-hover:border-slate-300 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Step {i+1}</span>
                        <button onClick={() => removeItineraryItem(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                      <input className="w-full bg-transparent font-bold mb-2 outline-none placeholder:text-slate-300" placeholder="장소 이름" value={item.title} onChange={(e) => updateItinerary(i, 'title', e.target.value)} />
                      <textarea className="w-full bg-transparent text-sm text-slate-600 outline-none resize-none h-16 placeholder:text-slate-300" placeholder="활동 내용 설명" value={item.description} onChange={(e) => updateItinerary(i, 'description', e.target.value)} />
                    </div>
                  </div>
                ))}
                <button onClick={addItineraryItem} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-black mt-4 ml-1">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border"><Plus size={14}/></div>
                  경유지 추가
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold text-sm mb-4">이용 규칙</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">참가 연령</label>
                  <input className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.age_limit} onChange={(e) => setFormData({...formData, rules: {...formData.rules, age_limit: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">활동 강도</label>
                  <select className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.activity_level} onChange={(e) => setFormData({...formData, rules: {...formData.rules, activity_level: e.target.value}})}>
                    <option value="가벼움">가벼움</option>
                    <option value="보통">보통</option>
                    <option value="높음">높음</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}