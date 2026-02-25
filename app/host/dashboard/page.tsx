'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
  List, MessageSquare, DollarSign, Star, Plus,
  Clock, AlertCircle, XCircle, UserCog, CalendarCheck, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import 추가

// 컴포넌트 임포트
import ReservationManager from './components/ReservationManager';
import MyExperiences from './MyExperiences';
import InquiryChat from './InquiryChat';
import Earnings from './Earnings';
import HostReviews from './HostReviews';
import ProfileEditor from './components/ProfileEditor';
import GuidelinesTab from './components/GuidelinesTab'; // 🟢 필수 교육 및 가이드라인 탭

// 실제 대시보드 로직
function DashboardContent() {
  const { t } = useLanguage(); // 🟢 2. t 함수 추가
  const [activeTab, setActiveTab] = useState('reservations');
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/host/dashboard?tab=${tab}`, { scroll: false });
  };

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
        .maybeSingle();

      if (!error) setHostStatus(hostData);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // 정보 병합 (프로필 > 지원서)
      const mergedProfile = {
        ...profileData,
        name: profileData?.name || hostData?.name,
        avatar_url: hostData?.profile_photo || profileData?.avatar_url,
        introduction: profileData?.introduction || profileData?.bio || hostData?.self_intro,
        languages: (profileData?.languages && profileData.languages.length > 0) ? profileData.languages : (hostData?.languages || []),
        phone: profileData?.phone || hostData?.phone || '',
        dob: profileData?.dob || hostData?.dob || '',
        host_nationality: profileData?.host_nationality || hostData?.host_nationality || '',
        bank_name: profileData?.bank_name || hostData?.bank_name || '',
        account_number: profileData?.account_number || hostData?.account_number || '',
        account_holder: profileData?.account_holder || hostData?.account_holder || '',
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
      <div className="max-w-2xl mx-auto px-6 py-20 text-center animate-in fade-in slide-in-from-bottom-4">
        <h1 className="text-3xl font-black mb-4 text-slate-900">{t('no_host_title')}</h1> {/* 🟢 번역 */}
        <p className="text-slate-500 mb-8">{t('no_host_desc')}</p> {/* 🟢 번역 */}
        <Link href="/host/register">
          <button className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">{t('btn_apply_host')}</button> {/* 🟢 번역 */}
        </Link>
      </div>
    );
  }

  const status = hostStatus.status?.toLowerCase().trim();

  // 2. 심사 중 / 보완 요청 / 거절 (단, 가이드라인 탭은 모두 접근 가능)
  if (['pending', 'revision', 'rejected'].includes(status) && activeTab !== 'guidelines') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6 animate-in fade-in">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
          status === 'revision' ? 'bg-orange-100 text-orange-600' :
            'bg-red-100 text-red-600'
          }`}>
          {status === 'pending' ? <Clock size={48} /> :
            status === 'revision' ? <AlertCircle size={48} /> :
              <XCircle size={48} />}
        </div>
        <div>
          <h1 className="text-3xl font-black mb-2 text-slate-900">
            {status === 'pending' ? t('status_pending_title') :
              status === 'revision' ? t('status_revision_title') :
                t('status_rejected_title')} {/* 🟢 번역 */}
          </h1>
          <p className="text-slate-500 mb-6">
            {status === 'pending' ? t('status_pending_desc') :
              status === 'revision' ? t('status_revision_desc') :
                t('status_rejected_desc')} {/* 🟢 번역 */}
          </p>

          {(status === 'revision' || status === 'rejected') && hostStatus.admin_comment && (
            <div className={`bg-slate-50 border p-6 rounded-2xl text-left mb-8 shadow-sm ${status === 'revision' ? 'border-orange-100 bg-orange-50 text-orange-800' : 'border-red-100 bg-red-50 text-red-800'
              }`}>
              <h4 className="font-bold mb-2 flex items-center gap-2"><MessageSquare size={16} /> {t('admin_comment_title')}</h4> {/* 🟢 번역 */}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{hostStatus.admin_comment}</p>
            </div>
          )}

          {status === 'revision' && (
            <Link href="/host/register">
              <button className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">{t('btn_edit_app')}</button> {/* 🟢 번역 */}
            </Link>
          )}
          {status === 'rejected' && (
            <Link href="/"><button className="text-slate-400 underline hover:text-slate-600 text-sm">{t('btn_go_home')}</button></Link>
          )}

          {/* 🟢 승인 대기/수정 상태일 때 가이드라인 열람 버튼 제공 */}
          {(status === 'pending' || status === 'revision') && (
            <div className="pt-8 border-t border-slate-100 mt-8">
              <button onClick={() => handleTabChange('guidelines')} className="text-sm font-bold text-slate-700 flex items-center justify-center gap-2 mx-auto bg-slate-50 px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm hover:shadow">
                <ShieldCheck size={18} className="text-red-500" /> 호스트 필수 가이드라인 다시 읽기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. 승인된 호스트 대시보드
  return (
    <div className="max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-8 flex flex-col md:flex-row gap-0 md:gap-8">

      {/* 🟢 모바일 전용: 가로 스크롤 탭 네비게이션 */}
      <div className="md:hidden mb-4 -mx-3 px-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 pb-2 min-w-max">
          {[
            { id: 'reservations', icon: <CalendarCheck size={14} />, label: t('menu_reservation') },
            { id: 'experiences', icon: <List size={14} />, label: t('menu_my_exp') },
            { id: 'inquiries', icon: <MessageSquare size={14} />, label: t('menu_inquiry') },
            { id: 'earnings', icon: <DollarSign size={14} />, label: t('menu_earnings') },
            { id: 'reviews', icon: <Star size={14} />, label: t('menu_reviews') },
            { id: 'guidelines', icon: <ShieldCheck size={14} />, label: '가이드라인' },
            { id: 'profile', icon: <UserCog size={14} />, label: t('menu_profile') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${activeTab === tab.id
                  ? (tab.id === 'guidelines' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-900 text-white shadow-sm')
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 데스크탑 사이드바 */}
      <aside className="w-64 hidden md:block shrink-0">
        <div className="sticky top-24 space-y-2">
          <div className="px-4 py-2 mb-4">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold tracking-wide">{t('host_partner')}</span>
            <p className="text-xs text-slate-400 mt-1">{t('host_approved')}</p>
          </div>

          <button onClick={() => handleTabChange('reservations')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'reservations' ? 'bg-slate-900 text-white font-bold shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <CalendarCheck size={20} /> {t('menu_reservation')}
          </button>

          <button onClick={() => handleTabChange('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'experiences' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <List size={20} /> {t('menu_my_exp')}
          </button>

          <button onClick={() => handleTabChange('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'inquiries' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <MessageSquare size={20} /> {t('menu_inquiry')}
          </button>

          <button onClick={() => handleTabChange('earnings')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'earnings' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <DollarSign size={20} /> {t('menu_earnings')}
          </button>

          <button onClick={() => handleTabChange('reviews')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'reviews' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Star size={20} /> {t('menu_reviews')}
          </button>

          <button onClick={() => handleTabChange('guidelines')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'guidelines' ? 'bg-red-50 font-bold text-red-600' : 'text-slate-500 hover:bg-slate-50 hover:text-red-600'}`}>
            <ShieldCheck size={20} className={activeTab === 'guidelines' ? 'text-red-600' : 'text-slate-400'} /> 교육 및 가이드라인
          </button>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button onClick={() => handleTabChange('profile')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              <UserCog size={20} /> {t('menu_profile')}
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-4 md:mb-8">
          <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">
            {activeTab === 'reservations' && t('menu_reservation')}
            {activeTab === 'experiences' && t('menu_my_exp')}
            {activeTab === 'inquiries' && t('menu_inquiry')}
            {activeTab === 'earnings' && t('menu_earnings')}
            {activeTab === 'reviews' && t('menu_reviews')}
            {activeTab === 'profile' && t('menu_profile')}
            {activeTab === 'guidelines' && '호스트 필수 교육'}
          </h1>
          {activeTab === 'experiences' && (
            <Link href="/host/create">
              <button className="bg-slate-900 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold flex items-center gap-1.5 md:gap-2 hover:scale-105 transition-transform shadow-md text-xs md:text-sm">
                <Plus size={16} className="md:w-[18px] md:h-[18px]" /> {t('exp_new')}
              </button>
            </Link>
          )}
        </div>

        {activeTab === 'reservations' && <div className="h-[500px] md:h-[750px]"><ReservationManager /></div>}
        {activeTab === 'experiences' && <MyExperiences />}
        {activeTab === 'inquiries' && <InquiryChat />}
        {activeTab === 'earnings' && <Earnings />}
        {activeTab === 'reviews' && <HostReviews />}
        {activeTab === 'profile' && <ProfileEditor profile={profile} onUpdate={fetchData} />}
        {activeTab === 'guidelines' && <GuidelinesTab />}
      </main>
    </div>
  );
}

// Suspense 적용
export default function HostDashboardPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-slate-900"></div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}