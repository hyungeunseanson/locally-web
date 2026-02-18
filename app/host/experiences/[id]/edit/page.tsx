'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, MapPin, Plus, Trash2, X, Camera, Check, Globe, Loader2, Type, FileText } from 'lucide-react';
import { CATEGORIES, SUPPORTED_LANGUAGES } from '@/app/host/create/config';
import { useToast } from '@/app/context/ToastContext'; // 🟢 Toast로 UX 개선
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import

export default function EditExperiencePage() {
  const { t } = useLanguage(); // 🟢 2. Hook
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'course'>('basic');

  // 데이터 불러오기
  useEffect(() => {
    const fetchExp = async () => {
      const { data, error } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (error) {
        showToast(t('msg_load_fail'), 'error'); // 🟢 번역
        return;
      }
      if (data) {
        setFormData({
          ...data,
          // ✅ 기존 데이터 초기화 (Null 방지)
          photos: data.photos || [],
          languages: data.languages || [],
          inclusions: data.inclusions || [],
          exclusions: data.exclusions || [],
          itinerary: data.itinerary || [],
          rules: data.rules || { age_limit: '', activity_level: '보통', refund_policy: '' },
          
          // 🟢 [추가됨] 다국어 필드 초기화
          title_en: data.title_en || '',
          title_ja: data.title_ja || '',
          title_zh: data.title_zh || '',
          description_en: data.description_en || '',
          description_ja: data.description_ja || '',
          description_zh: data.description_zh || '',
          category_en: data.category_en || '',
          category_ja: data.category_ja || '',
          category_zh: data.category_zh || '',
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
          // ✅ 기존 필드
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
          duration: formData.duration,

          // 🟢 [추가됨] 다국어 필드 업데이트
          title_en: formData.title_en,
          title_ja: formData.title_ja,
          title_zh: formData.title_zh,
          description_en: formData.description_en,
          description_ja: formData.description_ja,
          description_zh: formData.description_zh,
          category_en: formData.category_en,
          category_ja: formData.category_ja,
          category_zh: formData.category_zh,
        })
        .eq('id', params.id);
      
        if (error) throw error;
        showToast(t('msg_save_success'), 'success'); // 🟢 번역
        router.refresh();
      } catch (e: any) {
        showToast(t('msg_save_fail') + e.message, 'error'); // 🟢 번역
      } finally {
      setSaving(false);
    }
  };

  // 📸 사진 업로드 핸들러 (기존 로직 유지)
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
      showToast(t('msg_photo_fail') + err.message, 'error'); // 🟢 번역
    } finally {
      setUploading(false);
    }
  };

  // 🗑️ 사진 삭제 핸들러 (기존 로직 유지)
  const removePhoto = (indexToRemove: number) => {
    if (confirm(t('msg_photo_delete_confirm'))) { // 🟢 번역
      setFormData((prev: any) => ({
        ...prev,
        photos: prev.photos.filter((_: string, idx: number) => idx !== indexToRemove)
      }));
    }
  };

  // 진행 언어 토글 (기존 로직 유지)
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-slate-300"/></div>;
  if (!formData) return <div className="p-10 text-center">{t('msg_load_fail')}</div>; // 🟢 번역

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
        {saving ? <><Loader2 className="animate-spin" size={16}/> {t('btn_save_loading')}</> : <><Save size={16}/> {t('btn_save')}</>} {/* 🟢 번역 */}
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        
        {/* 탭 메뉴 */}
        <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {[
            { id: 'basic', label: t('tab_basic') }, // 🟢 번역
            { id: 'detail', label: t('tab_detail') },
            { id: 'course', label: t('tab_course') }
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
            {/* 📸 사진 관리 섹션 (기존 기능 복구) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <label className="block text-sm font-bold text-slate-900 mb-4">{t('label_photo_manage')} ({formData.photos.length})</label> {/* 🟢 번역 */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {/* 업로드 버튼 */}
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-white transition-all bg-white">
                        {uploading ? <Loader2 className="animate-spin text-slate-400 mb-2"/> : <Camera size={24} className="text-slate-400 mb-2"/>}
                        <span className="text-xs font-bold text-slate-500">{uploading ? t('btn_photo_uploading') : t('btn_photo_add')}</span> {/* 🟢 번역 */}
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

            {/* 🟢 제목 (다국어 지원) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Type size={16}/> {t('label_title_ko')}</h3>
              <div className="space-y-4">
                <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_title_ko')}</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputTrans label={t('label_title_en')} value={formData.title_en} onChange={(e:any) => setFormData({...formData, title_en: e.target.value})} placeholder={t('ph_title_en')} />
                  <InputTrans label={t('label_title_ja')} value={formData.title_ja} onChange={(e:any) => setFormData({...formData, title_ja: e.target.value})} placeholder={t('ph_title_ja')} />
                  <InputTrans label={t('label_title_zh')} value={formData.title_zh} onChange={(e:any) => setFormData({...formData, title_zh: e.target.value})} placeholder={t('ph_title_zh')} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_country')}</label>
                    <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none appearance-none" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})}>
                    <option value="Korea">{t('select_country_kr')}</option> {/* 🟢 번역 */}
                        <option value="Japan">{t('select_country_jp')}</option> {/* 🟢 번역 */}
                    </select>
                </div>
                <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_city')}</label> {/* 🟢 번역 */}
                    <input className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                </div>
            </div>

            {/* 진행 언어 선택 (기존 기능 복구) */}
            <div>
            <label className="block text-xs font-bold text-slate-500 mb-3">{t('label_languages')}</label>
                <div className="flex flex-wrap gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                        <button key={lang} onClick={() => toggleLanguage(lang)} className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2 transition-all ${formData.languages.includes(lang) ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                            {lang} {formData.languages.includes(lang) && <Check size={14}/>}
                        </button>
                    ))}
                </div>
            </div>

            {/* 카테고리 (기존 기능 + 다국어) */}
            <div>
            <label className="block text-xs font-bold text-slate-500 mb-3">{t('label_category')}</label>
                <div className="flex flex-wrap gap-2 mb-4">
                    {CATEGORIES.map((cat) => (
                        <button key={cat} onClick={() => setFormData({...formData, category: cat})} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${formData.category === cat ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
 {t(cat)} {/* 🟢 번역 적용 */}
                        </button>
                    ))}
                </div>
                {/* 🟢 카테고리 다국어 입력 (선택사항) */}
                <div className="grid grid-cols-3 gap-2">
                   <InputTrans label={t('label_cat_en')} value={formData.category_en} onChange={(e:any) => setFormData({...formData, category_en: e.target.value})} />
                   <InputTrans label={t('label_cat_ja')} value={formData.category_ja} onChange={(e:any) => setFormData({...formData, category_ja: e.target.value})} />
                   <InputTrans label={t('label_cat_zh')} value={formData.category_zh} onChange={(e:any) => setFormData({...formData, category_zh: e.target.value})} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_price')}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₩</span>
                  <input type="number" className="w-full p-4 pl-10 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                </div>
              </div>
              <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_max_guests')}</label>
                <input type="number" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.max_guests} onChange={(e) => setFormData({...formData, max_guests: e.target.value})} />
              </div>
            </div>
            <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_meeting_point')}</label>
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
            {/* 🟢 설명 (다국어 지원) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><FileText size={16}/> {t('label_desc_title')}</h3>
              <div className="space-y-6">
                <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_desc_ko')}</label>
                  <textarea className="w-full p-4 h-40 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed focus:border-black outline-none resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <TextAreaTrans label={t('label_desc_en')} value={formData.description_en} onChange={(e:any) => setFormData({...formData, description_en: e.target.value})} />
                  <TextAreaTrans label={t('label_desc_ja')} value={formData.description_ja} onChange={(e:any) => setFormData({...formData, description_ja: e.target.value})} />
                  <TextAreaTrans label={t('label_desc_zh')} value={formData.description_zh} onChange={(e:any) => setFormData({...formData, description_zh: e.target.value})} />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_inclusions')}</label>
                <div className="space-y-2">
                  {formData.inclusions.map((item: string, i: number) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('inclusions', i, e.target.value)} />
                      <button onClick={() => removeArrayItem('inclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => addArrayItem('inclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12}/> {t('btn_add_item')}</button>
                </div>
              </div>
              <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_exclusions')}</label>
                <div className="space-y-2">
                  {formData.exclusions.map((item: string, i: number) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('exclusions', i, e.target.value)} />
                      <button onClick={() => removeArrayItem('exclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => addArrayItem('exclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12}/> {t('btn_add_item')}</button>
                </div>
              </div>
            </div>

            <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_supplies')}</label>
              <textarea className="w-full p-4 h-24 bg-white border border-slate-200 rounded-xl text-sm focus:border-black outline-none" value={formData.supplies} onChange={(e) => setFormData({...formData, supplies: e.target.value})} />
            </div>
          </div>
        )}

        {/* 3. 코스 및 규칙 탭 (기존 기능 복구) */}
        {activeTab === 'course' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
            <label className="block text-xs font-bold text-slate-500 mb-4">{t('label_itinerary')}</label>
              <div className="space-y-4 border-l-2 border-slate-200 ml-3 pl-6">
                {formData.itinerary?.map((item: any, i: number) => (
                  <div key={i} className="relative group">
                    <div className="absolute -left-[31px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-slate-900 z-10"></div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 group-hover:border-slate-300 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Step {i+1}</span>
                        <button onClick={() => removeItineraryItem(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                      <input className="w-full bg-transparent font-bold mb-2 outline-none placeholder:text-slate-300" placeholder={t('ph_spot_name')} value={item.title} onChange={(e) => updateItinerary(i, 'title', e.target.value)} />
                      <textarea className="w-full bg-transparent text-sm text-slate-600 outline-none resize-none h-16 placeholder:text-slate-300" placeholder={t('ph_activity_desc')} value={item.description} onChange={(e) => updateItinerary(i, 'description', e.target.value)} />
                    </div>
                  </div>
                ))}
                <button onClick={addItineraryItem} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-black mt-4 ml-1">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border"><Plus size={14}/></div>
                  {t('btn_add_spot')}</button>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-sm mb-4">{t('label_rules')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">{t('label_age_limit')}</label>
                  <input className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.age_limit} onChange={(e) => setFormData({...formData, rules: {...formData.rules, age_limit: e.target.value}})} />
                </div>
                <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">{t('label_activity_level')}</label>
                  <select className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.activity_level} onChange={(e) => setFormData({...formData, rules: {...formData.rules, activity_level: e.target.value}})}>
                  <option value="가벼움">{t('opt_light')}</option>
                    <option value="보통">{t('opt_moderate')}</option>
                    <option value="높음">{t('opt_high')}</option>
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

// 🟡 헬퍼 컴포넌트
function InputTrans({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 mb-1">{label}</label>
      <input className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-black outline-none" value={value || ''} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function TextAreaTrans({ label, value, onChange }: any) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 mb-1">{label}</label>
      <textarea className="w-full p-3 h-24 bg-white border border-slate-200 rounded-lg text-sm focus:border-black outline-none resize-none" value={value || ''} onChange={onChange} />
    </div>
  );
}