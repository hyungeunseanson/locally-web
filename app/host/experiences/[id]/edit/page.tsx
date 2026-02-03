'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function EditExperiencePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    const fetchExp = async () => {
      const { data } = await supabase.from('experiences').select('*').eq('id', params.id).single();
      if (data) setFormData(data);
    };
    fetchExp();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('experiences')
      .update({ 
        title: formData.title, 
        price: formData.price, 
        description: formData.description 
      })
      .eq('id', params.id);
    
    if (!error) {
      alert('수정되었습니다.');
      router.push('/host/dashboard');
    }
  };

  if (!formData) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black mb-6 font-bold text-sm">
           <ChevronLeft size={16} /> 취소
        </Link>
        <h1 className="text-2xl font-black mb-8">체험 수정하기</h1>
        
        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block font-bold mb-2">제목</label>
            <input className="w-full border p-3 rounded-xl" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
          </div>
          <div>
            <label className="block font-bold mb-2">가격</label>
            <input type="number" className="w-full border p-3 rounded-xl" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
          </div>
          <div>
            <label className="block font-bold mb-2">설명</label>
            <textarea className="w-full border p-3 rounded-xl h-32" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <button className="w-full bg-black text-white py-4 rounded-xl font-bold">수정 완료</button>
        </form>
      </main>
    </div>
  );
}