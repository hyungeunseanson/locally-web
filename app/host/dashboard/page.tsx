'use client';

import React, { useState, useEffect } from 'react';
import { 
  List, MessageSquare, DollarSign, Star, Plus, 
  Clock, AlertCircle, XCircle, CheckCircle2, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import MyExperiences from './MyExperiences';
import InquiryChat from './InquiryChat';
import Earnings from './Earnings';
import HostReviews from './HostReviews';

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState('experiences');
  const [hostStatus, setHostStatus] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkHostStatus();
  }, []);

  const checkHostStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); 
        return;
      }

      const { data, error } = await supabase
        .from('host_applications')
        .select('*') 
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) 
        .limit(1)
        .single();

      if (!error) {
        setHostStatus(data);
      }
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
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-black mb-4">아직 호스트가 아니시군요!</h1>
          <p className="text-slate-500 mb-8">나만의 특별한 투어를 만들고 수익을 창출해보세요.</p>
          <Link href="/host/register">
            <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">호스트 지원하기</button>
          </Link>
        </div>
      </div>
    );
  }

  const status = hostStatus.status?.toLowerCase().trim();

  // ✅ 2. 보완 요청 (Revision) - 주황색 레이아웃 유지
  if (status === 'revision') {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-2">보완이 필요합니다</h1>
            <p className="text-slate-500 mb-6">
              아래 관리자 코멘트를 확인하고,<br/>
              내용을 보완하여 다시 제출해 주세요.
            </p>
            
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl text-left mb-8 shadow-sm">
              <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                <MessageSquare size={16}/> 관리자 코멘트
              </h4>
              <p className="text-orange-700 text-sm whitespace-pre-wrap leading-relaxed">
                {hostStatus.admin_comment || "관리자가 남긴 상세 코멘트가 없습니다."}
              </p>
            </div>

            <Link href="/host/register">
              <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">
                신청서 수정하기
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. 거절됨 (Rejected) - 빨간색 레이아웃 유지
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-2">승인이 거절되었습니다</h1>
            <p className="text-slate-500 mb-6">
              아쉽게도 이번에는 모시지 못하게 되었습니다.<br/>
              사유를 확인해 주시기 바랍니다.
            </p>

            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-left mb-8 shadow-sm">
              <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                <MessageSquare size={16}/> 거절 사유
              </h4>
              <p className="text-red-700 text-sm whitespace-pre-wrap leading-relaxed">
                {hostStatus.admin_comment || "별도의 사유가 기재되지 않았습니다."}
              </p>
            </div>

            <Link href="/">
              <button className="text-slate-400 underline hover:text-slate-600 text-sm">홈으로 돌아가기</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. 승인됨 (Approved/Active) - 메인 대시보드 레이아웃
  if (status === 'approved' || status === 'active') {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans">
        <SiteHeader />
        <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
          <aside className="w-64 hidden md:block shrink-0">
             <div className="sticky top-24 space-y-2">
                <div className="px-4 py-2 mb-4">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">HOST PARTNER</span>
                  <p className="text-xs text-slate-400 mt-1">승인된 호스트입니다</p>
                </div>
                <button onClick={() => setActiveTab('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='experiences' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><List size={20}/> 내 체험 관리</button>
                <button onClick={() => setActiveTab('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='inquiries' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><MessageSquare size={20}/> 문의함</button>
                <button onClick={() => setActiveTab('earnings')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='earnings' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><DollarSign size={20}/> 수익 및 정산</button>
                <button onClick={() => setActiveTab('reviews')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='reviews' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><Star size={20}/> 받은 후기</button>
             </div>
          </aside>

          <main className="flex-1">
            <div className="flex justify-between items-end mb-8">
              <h1 className="text-3xl font-black">
                {activeTab === 'experiences' && '내 체험 관리'}
                {activeTab === 'inquiries' && '문의 메시지'}
                {activeTab === 'earnings' && '수익 및 정산'}
                {activeTab === 'reviews' && '게스트 후기'}
              </h1>
              {activeTab === 'experiences' && (
                <Link href="/host/create"><button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-md"><Plus size={18} /> 새 체험 등록</button></Link>
              )}
            </div>

            {activeTab === 'experiences' && <MyExperiences />}
            {activeTab === 'inquiries' && <InquiryChat />}
            {activeTab === 'earnings' && <Earnings />}
            {activeTab === 'reviews' && <HostReviews />}
          </main>
        </div>
      </div>
    );
  }

  // 5. 심사 대기 중 (Pending) - 노란색 레이아웃 유지
  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
          <Clock size={48} />
        </div>
        <div>
          <h1 className="text-3xl font-black mb-2">심사가 진행 중입니다</h1>
          <p className="text-slate-500">
            제출해주신 신청서를 꼼꼼히 확인하고 있습니다.<br/>
            결과가 나올 때까지 조금만 기다려 주세요!
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl inline-block text-xs text-slate-400">
          신청일: {new Date(hostStatus.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}