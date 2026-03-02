'use client';

import React, { useState, useEffect } from 'react';
// 🟢 [수정] 아이콘 추가 및 유틸리티 import
import {
  Wifi, Search, User, Mail, Calendar, MoreHorizontal, X, Phone, Clock, MapPin,
  MessageCircle, Smile, Trash2, Star, Bell, Send, CheckSquare, Square, CheckCircle
} from 'lucide-react';
import { sendNotification } from '@/app/utils/notification';
import { useToast } from '@/app/context/ToastContext';
import { createClient } from '@/app/utils/supabase/client';

// 🟢 [Utility] 시간을 "방금 전", "5분 전" 등으로 변환하는 함수
function timeAgo(dateString: string | null) {
  if (!dateString) return '기록 없음';

  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return '방금 전';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;
  return past.toLocaleDateString(); // 오래된 건 날짜로 표시
}

export default function UsersTab({ users, onlineUsers, deleteItem }: any) {
  const supabase = createClient();
  const { showToast } = useToast(); // 🟢 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // 🟢 [추가] 다중 선택 및 알림 모달 상태
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isNotiModalOpen, setIsNotiModalOpen] = useState(false);
  const [notiTitle, setNotiTitle] = useState('');
  const [notiMessage, setNotiMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  // 1분마다 화면을 갱신해서 "몇 분 전" 시간을 최신화하는 코드
  const [tick, setTick] = useState(0);

  // 🟢 실제 결제 내역 및 리뷰 상태
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  useEffect(() => {
    if (selectedUser?.id) {
      let isMounted = true;
      const fetchActivity = async () => {
        setIsActivityLoading(true);
        try {
          const { data: bData } = await supabase
            .from('bookings')
            .select('*, experiences(title)')
            .eq('user_id', selectedUser.id)
            .order('created_at', { ascending: false });

          const { data: rData } = await supabase
            .from('reviews')
            .select('*, experiences(title)')
            .eq('user_id', selectedUser.id)
            .order('created_at', { ascending: false });

          if (isMounted) {
            setUserBookings(bData || []);
            setUserReviews(rData || []);
          }
        } catch (e) {
          console.error('Failed to fetch user activity', e);
        } finally {
          if (isMounted) setIsActivityLoading(false);
        }
      };
      fetchActivity();
      return () => { isMounted = false; };
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1); // 1분마다 화면을 다시 그리라는 신호
    }, 60000); // 60초 = 1분

    return () => clearInterval(timer);
  }, []);
  // 검색 필터링
  const filteredUsers = users.filter((u: any) =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🟢 온라인 유저 ID 목록 (Set으로 빠른 조회)
  const onlineUserIds = new Set(onlineUsers.map((u: any) => u.user_id));

  // 🟢 [추가] 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) setSelectedUserIds([]);
    else setSelectedUserIds(filteredUsers.map((u: any) => u.id));
  };

  // 🟢 [추가] 개별 선택/해제
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]);
  };

  // 🟢 [추가] 알림 발송 로직
  const handleSendNotification = async () => {
    if (!notiTitle.trim() || !notiMessage.trim()) {
      showToast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    setIsSending(true);
    try {
      await sendNotification({
        recipient_ids: selectedUserIds,
        type: 'admin_alert',
        title: notiTitle,
        message: notiMessage,
        link: '/notifications'
      });
      showToast(`${selectedUserIds.length}명에게 전송 완료!`, 'success');
      setIsNotiModalOpen(false);
      setNotiTitle(''); setNotiMessage(''); setSelectedUserIds([]);
    } catch (e) { console.error(e); showToast('전송 실패', 'error'); }
    finally { setIsSending(false); }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">

      {/* 🟢 메인 콘텐츠 (리스트 영역) */}
      <div className={`flex-1 flex overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-300 ${selectedUser ? 'hidden md:flex flex-col md:w-2/3 md:pr-4' : 'flex-col w-full'}`}>

        {/* 1. 실시간 접속자 섹션 */}
        <section className="bg-white rounded-lg md:rounded-2xl border border-slate-200 p-3 md:p-6 mb-3 md:mb-6 shadow-sm shrink-0">
          <h3 className="font-bold text-sm md:text-lg mb-2.5 md:mb-4 flex items-center gap-1.5 md:gap-2">
            <Wifi size={16} className="text-green-500 animate-pulse md:w-5 md:h-5" /> 실시간 접속 유저 ({onlineUsers.length}명)
          </h3>
          {onlineUsers.length > 0 ? (
            <div className="flex gap-2.5 md:gap-4 overflow-x-auto pb-1 md:pb-2 scrollbar-hide">
              {onlineUsers.map((u: any, idx: number) => (
                <div key={idx} className="flex-shrink-0 w-36 md:w-48 p-2.5 md:p-4 bg-slate-50 border border-green-100 rounded-xl flex items-center gap-2.5 md:gap-3 relative overflow-hidden">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-sm ${u.is_anonymous ? 'bg-slate-300' : 'bg-blue-500'}`}>
                    {u.email ? u.email[0].toUpperCase() : 'G'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-bold truncate text-slate-900">{u.email || '비회원'}</div>
                    <div className="text-[9px] md:text-[10px] text-green-600 font-medium leading-none mt-0.5">지금 활동 중</div>
                  </div>
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-ping"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-2">현재 접속 중인 유저가 없습니다.</div>
          )}
        </section>

        {/* 2. 전체 유저 목록 섹션 */}
        <section className="bg-white rounded-lg md:rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
          <div className="p-3 md:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:gap-0 justify-between md:items-center shrink-0">
            <h3 className="font-bold text-sm md:text-lg">전체 회원 ({users.length})</h3>

            <div className="flex items-center gap-2.5 md:gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
              {/* 🟢 [추가] 선택된 유저가 있을 때 버튼 표시 */}
              {selectedUserIds.length > 0 && (
                <button
                  onClick={() => setIsNotiModalOpen(true)}
                  className="flex shrink-0 items-center gap-2 px-3 md:px-4 py-2 bg-slate-900 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors animate-in fade-in"
                >
                  <Bell size={16} /> {selectedUserIds.length}명에게 알림 발송
                </button>
              )}

              <div className="relative w-full md:w-64 shrink-0">

                <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4" />
                <input
                  type="text"
                  placeholder="이름/이메일 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] md:text-sm focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-xs md:text-sm text-left min-w-[600px]">
              <thead className="text-[10px] md:text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  {/* 🟢 [추가] 전체 선택 체크박스 */}
                  <th className="px-2 md:px-6 py-2 md:py-3 w-8 md:w-10">
                    <button onClick={toggleSelectAll}>
                      {filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length
                        ? <CheckSquare className="text-slate-900 w-3.5 h-3.5 md:w-4 md:h-4" />
                        : <Square className="text-slate-300 w-3.5 h-3.5 md:w-4 md:h-4" />}
                    </button>
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3">유저 정보</th>
                  <th className="px-2 md:px-6 py-2 md:py-3">연락처</th>
                  <th className="px-2 md:px-6 py-2 md:py-3">최근 접속</th> {/* 🟢 추가됨 */}
                  <th className="px-2 md:px-6 py-2 md:py-3">구분</th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user: any) => {
                  const isOnline = onlineUserIds.has(user.id);
                  const isSelected = selectedUserIds.includes(user.id); // 🟢 추가

                  return (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${selectedUser?.id === user.id ? 'bg-blue-100' : 'hover:bg-slate-50'}`}
                    >
                      {/* 🟢 [추가] 개별 선택 체크박스 */}
                      <td className="px-2 md:px-6 py-2.5 md:py-4" onClick={(e) => { e.stopPropagation(); toggleSelectUser(user.id); }}>
                        {isSelected
                          ? <CheckSquare className="text-slate-900 w-4 h-4 md:w-[18px] md:h-[18px]" />
                          : <Square className="text-slate-300 hover:text-slate-400 w-4 h-4 md:w-[18px] md:h-[18px]" />}
                      </td>

                      <td className="px-2 md:px-6 py-2.5 md:py-4 flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 overflow-hidden border border-slate-100 relative">
                          {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          {/* 🟢 온라인 상태일 때 초록색 점 표시 */}
                          {isOnline && <div className="absolute bottom-0 right-0 w-2 h-2 md:w-2.5 md:h-2.5 bg-green-500 border-2 border-white rounded-full"></div>}
                        </div>
                        <div>
                          <div className="font-bold text-[11px] md:text-sm text-slate-900">{user.name || '이름 없음'}</div>
                          <div className="text-[9px] md:text-xs text-slate-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-[10px] md:text-sm">{user.phone || '-'}</td>

                      {/* 🟢 최근 접속 시간 표시 (수정됨) */}
                      <td className="px-2 md:px-6 py-2.5 md:py-4">
                        {isOnline ? (
                          <span className="text-green-600 font-bold text-[9px] md:text-xs bg-green-50 px-1.5 md:px-2 py-0.5 md:py-1 rounded">Online</span>
                        ) : (
                          <span className="text-slate-500 text-[9px] md:text-xs flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> {timeAgo(user.last_active_at)}
                          </span>
                        )}
                      </td>

                      <td className="px-2 md:px-6 py-2.5 md:py-4">
                        <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[8px] md:text-[10px] font-bold uppercase ${user.role === 'host' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                          {user.role || 'USER'}
                        </span>
                      </td>
                      <td className="px-2 md:px-6 py-2.5 md:py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItem('profiles', user.id); }}
                          className="text-slate-400 hover:text-red-500 p-1.5 md:p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 🟢 유저 상세 정보 패널 (우측 슬라이드) - 오버레이 적용됨 */}
      {selectedUser && (
        <div className="absolute inset-0 z-[100] md:z-30 md:relative md:w-[450px] border-l border-slate-200 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 right-0 top-0">

          {/* 헤더 */}
          <div className="p-3 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-sm md:text-lg text-slate-900">Customer</h3>
              <div className="text-[9px] md:text-[10px] text-slate-400 font-mono break-all pr-4">ID: {selectedUser.id}</div>
            </div>
            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-900 p-1.5 md:p-2 rounded-full hover:bg-slate-200 transition-colors shrink-0">
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* 1. 기본 정보 */}
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center gap-3 md:gap-5">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User className="w-6 h-6 md:w-8 md:h-8" /></div>}
              </div>
              <div>
                <h2 className="text-base md:text-xl font-bold text-slate-900 leading-tight">{selectedUser.name || 'Locally User'}</h2>

                {/* 🟢 상세 페이지 최근 접속 표시 (수정됨) */}
                <div className={`flex items-center gap-1.5 text-[9px] md:text-xs font-bold mt-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded w-fit ${onlineUserIds.has(selectedUser.id) ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                  {onlineUserIds.has(selectedUser.id) ? (
                    <>
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span> 지금 활동 중 (Online)
                    </>
                  ) : (
                    <>
                      <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> 마지막 접속: {timeAgo(selectedUser.last_active_at)}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 고객 프로필 (기존 유지) */}
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h4 className="text-[10px] md:text-xs font-bold text-slate-900 uppercase mb-3 md:mb-4">고객 프로필</h4>
              <div className="space-y-3 md:space-y-4 text-xs md:text-sm">
                <InfoRow icon={<Mail className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="이메일" value={selectedUser.email} />
                <InfoRow icon={<Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="연락처" value={selectedUser.phone || '+82 10-0000-0000'} />
                <InfoRow icon={<Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="생년월일" value={selectedUser.birthdate || '1999-09-01 (만 26세)'} />
                <InfoRow icon={<MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="국적" value={selectedUser.nationality || 'KR (대한민국)'} />
                <InfoRow icon={<MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="카카오톡 ID" value={selectedUser.kakao_id || '미등록'} />
                <InfoRow icon={<Smile className="w-3.5 h-3.5 md:w-4 md:h-4" />} label="MBTI" value={selectedUser.mbti || 'ENTP'} />
              </div>
            </div>

            {/* 3. 구매 활동 (동적 데이터 연동) */}
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h4 className="text-[10px] md:text-xs font-bold text-slate-900 uppercase mb-3 md:mb-4">구매 활동</h4>
              {isActivityLoading ? (
                <div className="flex justify-center items-center py-6 opacity-50">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
                </div>
              ) : userBookings.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                  <p className="text-[11px] md:text-xs font-bold text-slate-500">구매 내역이 없습니다</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4 md:mb-6">
                    <div className="bg-slate-50 p-2 md:p-3 rounded-lg text-center">
                      <div className="text-[9px] md:text-[10px] text-slate-500 mb-0.5 md:mb-1">총 구매액</div>
                      <div className="font-bold text-[11px] md:text-sm text-slate-900">
                        ₩{userBookings.reduce((sum, b) => sum + (b.total_price || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 md:p-3 rounded-lg text-center">
                      <div className="text-[9px] md:text-[10px] text-slate-500 mb-0.5 md:mb-1">구매 횟수</div>
                      <div className="font-bold text-[11px] md:text-sm text-slate-900">{userBookings.length}회</div>
                    </div>
                    <div className="bg-slate-50 p-2 md:p-3 rounded-lg text-center">
                      <div className="text-[9px] md:text-[10px] text-slate-500 mb-0.5 md:mb-1">마지막 구매</div>
                      <div className="font-bold text-[11px] md:text-sm text-slate-900">
                        {timeAgo(userBookings[0]?.created_at) || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-lg overflow-hidden text-[10px] md:text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-2 md:px-3 py-1.5 md:py-2 font-medium">체험명</th>
                          <th className="px-2 md:px-3 py-1.5 md:py-2 font-medium">날짜</th>
                          <th className="px-2 md:px-3 py-1.5 md:py-2 font-medium text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userBookings.slice(0, 5).map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-slate-900 truncate max-w-[100px] md:max-w-[120px]">
                              {b.experiences?.title || '알 수 없음'}
                            </td>
                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-slate-500">
                              {new Date(b.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-2 md:px-3 py-1.5 md:py-2 text-right font-bold">
                              ₩{(b.total_price || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* 4. 등록한 리뷰 (동적 연동) */}
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h4 className="text-[10px] md:text-xs font-bold text-slate-900 uppercase mb-3 md:mb-4">받은 리뷰 ({userReviews.length}개)</h4>
              {isActivityLoading ? (
                <div className="flex justify-center items-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
                </div>
              ) : userReviews.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                  <p className="text-[11px] md:text-xs font-bold text-slate-500">아직 받은 리뷰가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {userReviews.slice(0, 5).map((r) => (
                    <div key={r.id} className="bg-slate-50 p-2.5 md:p-3 rounded-xl">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-[11px] md:text-xs truncate mr-2">
                          {r.experiences?.title || '알 수 없음'}
                        </span>
                        <div className="flex items-center text-[9px] md:text-[10px] font-bold text-orange-500 shrink-0">
                          <Star size={10} fill="currentColor" className="mr-0.5" /> {(r.rating || 0).toFixed(1)}
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{r.content || '(내용 없음)'}</p>
                      <div className="text-[9px] md:text-[10px] text-slate-400 mt-1.5 md:mt-2">
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. 관리자 메모 (기존 유지) */}
            <div className="p-4 md:p-6">
              <h4 className="text-[10px] md:text-xs font-bold text-slate-900 uppercase mb-2">관리자 메모</h4>
              <textarea
                className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 md:p-3 text-[11px] md:text-sm focus:outline-none focus:border-yellow-400 min-h-[60px] md:min-h-[80px]"
                placeholder="특이사항을 입력하세요..."
              />
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="p-3 md:p-5 border-t border-slate-100 bg-white sticky bottom-0">
            {/* 🟢 [추가] 개별 알림 버튼 */}
            <button
              onClick={() => { setSelectedUserIds([selectedUser.id]); setIsNotiModalOpen(true); }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2.5 md:py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 md:gap-2 mb-2 text-xs md:text-sm"
            >
              <Bell className="w-3.5 h-3.5 md:w-4 md:h-4" /> 이 유저에게 알림 보내기
            </button>

            <button
              onClick={() => { if (confirm('정말 계정을 영구 삭제하시겠습니까?')) deleteItem('profiles', selectedUser.id); }}
              className="w-full bg-slate-900 hover:bg-red-600 text-white font-bold py-2.5 md:py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm"
            >
              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> 계정 영구 삭제
            </button>
          </div>
        </div>
      )}

      {/* 🟢 [추가] 알림 발송 모달 */}
      {isNotiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsNotiModalOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} /></button>

            <div className="mb-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 mx-auto"><Send size={24} /></div>
              <h3 className="text-xl font-black">알림 보내기</h3>
              <p className="text-sm text-slate-500">선택된 <span className="font-bold text-slate-900">{selectedUserIds.length}명</span>에게 메시지를 보냅니다.</p>
            </div>

            <div className="space-y-4">
              <input type="text" value={notiTitle} onChange={(e) => setNotiTitle(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="제목" autoFocus />
              <textarea value={notiMessage} onChange={(e) => setNotiMessage(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl text-sm h-32 resize-none" placeholder="내용" />
              <button onClick={handleSendNotification} disabled={isSending} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black">
                {isSending ? '발송 중...' : <><CheckCircle size={18} /> 발송하기</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 헬퍼 컴포넌트 (아이콘 + 라벨 + 값)
function InfoRow({ icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 md:gap-4">
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase truncate">{label}</div>
        <div className="text-[11px] md:text-sm font-medium text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}