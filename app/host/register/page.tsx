'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { Camera, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function HostRegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // 폼 데이터 (보내주신 로컬리 지원 양식 반영)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birthdate: '',
    email: '',
    motivation: '', // 알게 된 계기
    instagram: '',
    koreanLevel: '초급',
    mbti: '',
    tourLocation: '도쿄',
    tourConcept: '', // 투어 소개
    tourPrice: '',
    availableDates: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/');
      return;
    }

    // 실제로는 여기서 'host_applications' 같은 테이블에 저장해야 합니다.
    // 지금은 체험판이므로, 유저 메타데이터에 "호스트 신청함" 표시를 남기고 통과시킵니다.
    const { error } = await supabase.auth.updateUser({
      data: { is_host_pending: true } // 신청 대기 상태로 변경
    });

    if (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    } else {
      alert('🎉 파트너 지원이 완료되었습니다!\n담당자가 검토 후 연락드릴 예정입니다.\n(지금은 바로 체험 등록이 가능하도록 이동합니다.)');
      router.push('/host/create'); // 임시로 바로 체험 등록으로 연결
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-black mb-6 font-bold text-sm">
          <ChevronLeft size={16} /> 홈으로 돌아가기
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-black mb-4">한국인 파트너 지원하기 🌏</h1>
          <p className="text-slate-500">
            Locally와 함께 일본의 매력을 소개할 파트너가 되어주세요.<br/>
            작성해주신 내용은 담당자가 꼼꼼히 확인하겠습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. 기본 정보 섹션 */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold border-b border-slate-100 pb-2">1. 기본 정보</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold mb-2">1. 성함 (氏名)</label>
                <input required type="text" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="홍길동"
                  onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">2. 전화번호</label>
                <input required type="tel" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="010-0000-0000"
                  onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">3. 생년월일</label>
                <input required type="date" className="w-full border border-slate-300 rounded-xl px-4 py-3"
                  onChange={e => setFormData({...formData, birthdate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">4. 이메일</label>
                <input required type="email" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="example@gmail.com"
                  onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">5. 인스타그램 계정 (DM 연락용)</label>
              <input required type="text" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="@your_instagram"
                onChange={e => setFormData({...formData, instagram: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">6. MBTI</label>
              <input type="text" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="ENFP"
                onChange={e => setFormData({...formData, mbti: e.target.value})} />
            </div>
          </section>

          {/* 2. 언어 및 활동 지역 */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold border-b border-slate-100 pb-2">2. 언어 및 활동 지역</h2>
            
            <div>
              <label className="block text-sm font-bold mb-2">7. 한국어 레벨</label>
              <select className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white"
                onChange={e => setFormData({...formData, koreanLevel: e.target.value})}>
                <option value="초급">초급 (번역기 필수)</option>
                <option value="중급">중급 (간단한 대화 가능)</option>
                <option value="상급">상급 (일상 회화 문제 없음)</option>
                <option value="네이티브">네이티브 (문화적 표현 이해)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">8. 투어 개최 희망 지역</label>
              <select className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white"
                onChange={e => setFormData({...formData, tourLocation: e.target.value})}>
                <option value="도쿄">도쿄 및 근교 (요코하마 등)</option>
                <option value="오사카">오사카 및 근교 (교토, 고베)</option>
                <option value="후쿠오카">후쿠오카</option>
                <option value="나고야">나고야</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </section>

          {/* 3. 투어 맛보기 */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold border-b border-slate-100 pb-2">3. 투어 아이디어 (맛보기)</h2>
            
            <div>
              <label className="block text-sm font-bold mb-2">방문할 장소 (3-4시간 코스)</label>
              <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none" 
                placeholder="예) 아자부주반 상점가 -> 도쿄타워 산책 -> 현지 이자카야"
                onChange={e => setFormData({...formData, tourConcept: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">희망 참가 비용 (1인당)</label>
              <input type="number" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="예) 3500 (보통 3000~4000엔 설정)"
                onChange={e => setFormData({...formData, tourPrice: e.target.value})} />
            </div>

             <div>
              <label className="block text-sm font-bold mb-2">활동 가능 날짜 (1~2월)</label>
              <input type="text" className="w-full border border-slate-300 rounded-xl px-4 py-3" placeholder="예) 주말 가능, 혹은 특정 날짜 기입"
                onChange={e => setFormData({...formData, availableDates: e.target.value})} />
            </div>
          </section>

           {/* 4. 사진 업로드 (UI만 구현) */}
           <section className="space-y-6">
            <h2 className="text-xl font-bold border-b border-slate-100 pb-2">4. 사진 및 신분증</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl h-40 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Camera size={32} />
                    <span className="text-sm mt-2 font-bold">본인 사진 1 (필수)</span>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl h-40 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Camera size={32} />
                    <span className="text-sm mt-2 font-bold">신분증 (여권/면허증)</span>
                </div>
            </div>
            <p className="text-xs text-slate-400">* 호스트 등록 시 보증금(500엔) 확인 절차가 있습니다.</p>
          </section>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-5 rounded-xl hover:scale-[1.01] transition-transform shadow-lg text-lg"
          >
            {loading ? '제출 중...' : '지원서 제출하기'}
          </button>
        </form>
      </main>
    </div>
  );
}