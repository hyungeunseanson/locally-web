'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateExperience() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // 입력 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    image_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989', // 기본 이미지
    category: 'culture'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. 현재 유저 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    // 2. DB에 저장
    const { error } = await supabase.from('experiences').insert([
      {
        host_id: user.id,
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        location: formData.location,
        image_url: formData.image_url,
        category: formData.category
      }
    ]);

    if (error) {
      console.error(error);
      alert('등록 실패! 다시 시도해주세요.');
    } else {
      alert('🎉 체험이 등록되었습니다!');
      router.push('/host/dashboard'); // 대시보드로 이동
      router.refresh(); // 데이터 갱신
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black mb-6 font-bold text-sm">
          <ChevronLeft size={16} /> 돌아가기
        </Link>

        <h1 className="text-3xl font-black mb-8">새로운 체험 등록하기</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 제목 */}
          <div>
            <label className="block text-sm font-bold mb-2">체험 제목</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black transition-colors"
              placeholder="예: 시부야 로컬 맛집 탐방"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          {/* 카테고리 & 가격 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">카테고리</label>
              <select 
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black bg-white"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="culture">문화/예술</option>
                <option value="food">음식/투어</option>
                <option value="nature">자연/야외</option>
                <option value="night">나이트라이프</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">가격 (1인당)</label>
              <input 
                type="number" 
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"
                placeholder="예: 50000"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                required
              />
            </div>
          </div>

          {/* 위치 */}
          <div>
            <label className="block text-sm font-bold mb-2">위치 (도시, 지역)</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black"
              placeholder="예: 도쿄, 시부야"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-bold mb-2">체험 설명</label>
            <textarea 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black h-32 resize-none"
              placeholder="어떤 체험인지 자세히 설명해주세요."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>

          {/* 이미지 URL (임시) */}
          <div>
            <label className="block text-sm font-bold mb-2">대표 이미지 URL</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-black text-slate-500 text-sm"
              value={formData.image_url}
              onChange={e => setFormData({...formData, image_url: e.target.value})}
            />
            <p className="text-xs text-slate-400 mt-2">* 일단 기본 이미지가 들어가 있습니다. 그대로 두셔도 됩니다.</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {loading ? '등록 중...' : '체험 등록 완료'}
          </button>
        </form>
      </main>
    </div>
  );
}