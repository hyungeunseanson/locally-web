'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  List, MessageSquare, DollarSign, Star, Plus, 
  Clock, AlertCircle, XCircle, UserCog, CalendarCheck 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

// 컴포넌트 임포트
import ReservationManager from './components/ReservationManager';
import MyExperiences from './MyExperiences';
import InquiryChat from './InquiryChat';
import Earnings from './Earnings';
import HostReviews from './HostReviews';
import ProfileEditor from './components/ProfileEditor';

// ✅ [분리] 실제 대시보드 로직을 담은 컴포넌트
function DashboardContent() {
  const [activeTab, setActiveTab] = useState('reservations'); 
  const [hostStatus, setHostStatus] = useState<any>(null); 
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams(); // 여기서 사용

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    
    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: hostData, error } = await supabase
        .from('host_applications')
        .select('*') 
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) 
        .limit(1)
        .single();

      if (!error) setHostStatus(hostData);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

// 🟢 [수정됨] 모든 정보(비공개 포함) 병합하기
const mergedProfile = {
  ...profileData, // 기본 프로필 데이터
  
  // 1. 기본 정보 (프로필 우선 -> 지원서)
  name: profileData?.name || hostData?.name,
  // ✅ [수정] 호스트 지원서 사진을 최우선으로 (사용자 요청 반영)
  avatar_url: hostData?.profile_photo || profileData?.avatar_url,
  introduction: profileData?.introduction || profileData?.bio || hostData?.self_intro,
  languages: (profileData?.languages && profileData.languages.length > 0) ? profileData.languages : (hostData?.languages || []),
  
  // 2. 비공개/개인 정보 (지원서 데이터 연결)
  phone: profileData?.phone || hostData?.phone || '',
  dob: profileData?.dob || hostData?.dob || '',
  host_nationality: profileData?.host_nationality || hostData?.host_nationality || '',
  
  // 3. 정산 정보 (지원서 데이터 연결)
  bank_name: profileData?.bank_name || hostData?.bank_name || '',
  account_number: profileData?.account_number || hostData?.account_number || '',
  account_holder: profileData?.account_holder || hostData?.account_holder || '',
  
  // 4. 기타
  motivation: profileData?.motivation || hostData?.motivation || '',
  job: profileData?.job || '',
  dream_destination: profileData?.dream_destination || '',
  favorite_song: profileData?.favorite_song || '',
};

setProfile(mergedProfile);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
      </div>
    );
  }

  // 1. 신청 내역 없음
  if (!hostStatus) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-black mb-4">아직 호스트가 아니시군요!</h1>
        <p className="text-slate-500 mb-8">나만의 특별한 투어를 만들고 수익을 창출해보세요.</p>
        <Link href="/host/register">
          <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">호스트 지원하기</button>
        </Link>
      </div>
    );
  }

  const status = hostStatus.status?.toLowerCase().trim();

  // 2. 심사 중 / 보완 요청 / 거절 등 상태별 화면
  if (['pending', 'revision', 'rejected'].includes(status)) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${
          status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
          status === 'revision' ? 'bg-orange-100 text-orange-600' :
          'bg-red-100 text-red-600'
        }`}>
          {status === 'pending' ? <Clock size={48} /> : 
           status === 'revision' ? <AlertCircle size={48} /> : 
           <XCircle size={48} />}
        </div>
        <div>
          <h1 className="text-3xl font-black mb-2">
            {status === 'pending' ? '심사가 진행 중입니다' : 
             status === 'revision' ? '보완이 필요합니다' : 
             '승인이 거절되었습니다'}
          </h1>
          <p className="text-slate-500 mb-6">
            {status === 'pending' ? '제출해주신 신청서를 꼼꼼히 확인하고 있습니다.' : 
             status === 'revision' ? '관리자 코멘트를 확인하고 내용을 보완해 주세요.' : 
             '아쉽게도 이번에는 모시지 못하게 되었습니다.'}
          </p>
          
          {(status === 'revision' || status === 'rejected') && hostStatus.admin_comment && (
            <div className={`bg-slate-50 border p-6 rounded-2xl text-left mb-8 shadow-sm ${
              status === 'revision' ? 'border-orange-100 bg-orange-50 text-orange-800' : 'border-red-100 bg-red-50 text-red-800'
            }`}>
              <h4 className="font-bold mb-2 flex items-center gap-2"><MessageSquare size={16}/> 관리자 코멘트</h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{hostStatus.admin_comment}</p>
            </div>
          )}
          
          {status === 'revision' && (
            <Link href="/host/register">
              <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">신청서 수정하기</button>
            </Link>
          )}
          {status === 'rejected' && (
            <Link href="/"><button className="text-slate-400 underline hover:text-slate-600 text-sm">홈으로 돌아가기</button></Link>
          )}
        </div>
      </div>
    );
  }

  // 3. 승인된 호스트 대시보드
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
      
      {/* 사이드바 */}
      <aside className="w-64 hidden md:block shrink-0">
          <div className="sticky top-24 space-y-2">
            <div className="px-4 py-2 mb-4">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">HOST PARTNER</span>
              <p className="text-xs text-slate-400 mt-1">승인된 호스트입니다</p>
            </div>
            
            <button onClick={() => setActiveTab('reservations')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='reservations' ? 'bg-black text-white font-bold shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
              <CalendarCheck size={20}/> 예약 관리
            </button>
            
            <button onClick={() => setActiveTab('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='experiences' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
              <List size={20}/> 내 체험 관리
            </button>

            <button onClick={() => setActiveTab('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='inquiries' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
              <MessageSquare size={20}/> 문의함
            </button>

            <button onClick={() => setActiveTab('earnings')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='earnings' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
              <DollarSign size={20}/> 수익 및 정산
            </button>

            <button onClick={() => setActiveTab('reviews')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='reviews' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
              <Star size={20}/> 받은 후기
            </button>
            
            <div className="pt-4 mt-4 border-t border-slate-100">
              <button onClick={() => setActiveTab('profile')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='profile' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
                <UserCog size={20}/> 프로필 설정
              </button>
            </div>
          </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-8">
          <h1 className="text-3xl font-black">
            {activeTab === 'reservations' && '예약 관리'}
            {activeTab === 'experiences' && '내 체험 관리'}
            {activeTab === 'inquiries' && '문의 메시지'}
            {activeTab === 'earnings' && '수익 및 정산'}
            {activeTab === 'reviews' && '게스트 후기'}
            {activeTab === 'profile' && '프로필 설정'}
          </h1>
          {activeTab === 'experiences' && (
            <Link href="/host/create">
              <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-md">
                <Plus size={18} /> 새 체험 등록
              </button>
            </Link>
          )}
        </div>

        {activeTab === 'reservations' && <div className="h-[700px]"><ReservationManager /></div>}
        {activeTab === 'experiences' && <MyExperiences />}
        {activeTab === 'inquiries' && <InquiryChat />}
        {activeTab === 'earnings' && <Earnings />}
        {activeTab === 'reviews' && <HostReviews />}
        {activeTab === 'profile' && <ProfileEditor profile={profile} onUpdate={fetchData} />}
      </main>
    </div>
  );
}

// ✅ [메인] Suspense로 감싼 페이지 컴포넌트
export default function HostDashboardPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}