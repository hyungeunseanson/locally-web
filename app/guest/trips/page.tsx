'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, Receipt, Ghost, Lock, Loader2, X, Share2, Map, Clock, CheckCircle2, User, Phone, CreditCard, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';

export default function GuestTripsPage() {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMyTrips();
  }, []);

  const fetchMyTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences (
            id, title, city, photos, address, host_id, profiles:host_id (name, phone)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (bookings) {
        const upcoming: any[] = [];
        const past: any[] = [];

        bookings.forEach((booking: any) => {
          const tripDate = new Date(booking.date);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          const isFuture = tripDate >= today && booking.status !== 'cancelled';
          const diffTime = tripDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const dDay = isFuture ? (diffDays === 0 ? 'D-Day' : `D-${diffDays}`) : null;

          const formattedTrip = {
            id: booking.id,
            title: booking.experiences?.title,
            hostName: booking.experiences?.profiles?.name || 'Host',
            hostPhone: booking.experiences?.profiles?.phone || '연락처 미공개',
            hostId: booking.experiences?.host_id,
            date: booking.date, 
            time: booking.time || '14:00',
            location: booking.experiences?.city || '서울',
            address: booking.experiences?.address || booking.experiences?.city,
            image: booking.experiences?.photos?.[0],
            dDay: dDay,
            isPrivate: booking.type === 'private',
            status: booking.status,
            price: booking.amount || booking.total_price || 50000,
            guests: booking.guests || 1,
            expId: booking.experience_id,
            orderId: booking.order_id || `ORD-${booking.id.substring(0,8).toUpperCase()}`,
            userName: user.user_metadata?.name || user.email?.split('@')[0] || 'Guest', // 예약자 이름
          };

          if (isFuture) upcoming.push(formattedTrip);
          else past.push(formattedTrip);
        });
        setUpcomingTrips(upcoming);
        setPastTrips(past.reverse());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 구글맵 바로가기
  const openGoogleMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  // 캘린더 추가
  const addToCalendar = (trip: any) => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.address}`);
    const location = encodeURIComponent(trip.address);
    const dateStr = trip.date.replace(/-/g, ''); 
    const dates = `${dateStr}T${trip.time.replace(':','')}/${dateStr}T${(parseInt(trip.time.split(':')[0])+2).toString().padStart(2,'0')}${trip.time.split(':')[1]}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
  };

  // 예약 취소
  const handleCancelBooking = async (id: number) => {
    if (!confirm('정말 예약을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) { alert('예약이 취소되었습니다.'); fetchMyTrips(); } 
    else { alert('취소 실패: ' + error.message); }
  };

  const handleOpenReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const handleOpenReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };
  const toggleMenu = (id: number) => setActiveMenuId(activeMenuId === id ? null : id);

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" onClick={() => setActiveMenuId(null)}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 🟢 예정된 예약 (컴팩트 디자인) */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            다가오는 예약 <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
          </h2>
          
          {upcomingTrips.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {upcomingTrips.map(trip => (
                <div key={trip.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex relative group">
                  {/* 이미지 */}
                  <div className="w-32 sm:w-40 h-auto relative shrink-0">
                    {trip.image ? <img src={trip.image} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No Image</div>}
                    <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded-full">{trip.dDay}</div>
                  </div>

                  {/* 정보 및 액션 */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                          {trip.date} · {trip.time}
                          {trip.isPrivate && <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Lock size={8} /> Private</span>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleMenu(trip.id); }} className="p-1 hover:bg-slate-100 rounded-full -mt-1 -mr-1"><MoreHorizontal className="text-slate-400" size={18}/></button>
                        {activeMenuId === trip.id && (
                           <div className="absolute right-4 top-10 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-10 overflow-hidden">
                             <button onClick={() => addToCalendar(trip)} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2 border-b border-slate-50"><Calendar size={12}/> 캘린더에 추가</button>
                             <button onClick={() => handleCancelBooking(trip.id)} className="w-full text-left px-4 py-3 text-xs hover:bg-red-50 text-red-500 font-medium">예약 취소</button>
                           </div>
                        )}
                      </div>
                      <h3 className="text-lg font-bold leading-tight mb-1 line-clamp-1 hover:underline"><Link href={`/experiences/${trip.expId}`}>{trip.title}</Link></h3>
                      <div className="text-sm text-slate-600 flex items-center gap-1 truncate"><MapPin size={14} className="text-slate-400 shrink-0"/>{trip.location}</div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => openGoogleMaps(trip.address)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors">
                        <Map size={14}/> 길찾기
                      </button>
                      <button onClick={() => handleOpenReceipt(trip)} className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors">
                        <Receipt size={14}/> 티켓/영수증
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <Ghost size={32} className="text-slate-300 mb-4"/>
              <h3 className="text-lg font-bold text-slate-900 mb-1">예정된 여행이 없습니다.</h3>
              <Link href="/" className="mt-4 px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">체험 둘러보기</Link>
            </div>
          )}
        </section>

        {/* 🟠 지난 여행 섹션 */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-slate-400">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pastTrips.map(trip => (
                <div key={trip.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white group flex flex-col">
                    <div className="h-32 bg-slate-200 relative overflow-hidden">
                        {trip.image && <img src={trip.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>}
                        {trip.status === 'cancelled' && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold backdrop-blur-sm text-sm">취소된 예약</div>}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-bold mb-1 truncate text-slate-900 text-sm">{trip.title}</div>
                          <div className="text-xs text-slate-500 mb-4">{trip.date}</div>
                        </div>
                        {trip.status !== 'cancelled' && (
                          <button onClick={() => handleOpenReview(trip)} className="w-full border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
                            후기 작성
                          </button>
                        )}
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 🎫 리얼 티켓형 영수증 모달 */}
      {isReceiptModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative">
            
            {/* 상단 바코드 영역 */}
            <div className="bg-slate-900 p-6 relative text-center">
              <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={20}/></button>
              <div className="font-black text-white text-lg tracking-widest">LOCALLY TICKET</div>
              {/* 바코드 이미지 (실제로는 생성 라이브러리 사용) */}
              <div className="my-4 h-12 bg-white p-1"><img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${selectedTrip.orderId}&scale=3&height=10&includetext`} alt="Barcode" className="w-full h-full object-cover"/></div>
              <p className="text-slate-400 text-xs font-mono">{selectedTrip.orderId}</p>
            </div>

            {/* 티켓 본문 */}
            <div className="p-6 bg-white relative">
              {/* 펀치홀 디자인 */}
              <div className="absolute -top-3 left-0 w-6 h-6 bg-slate-900 rounded-full"></div>
              <div className="absolute -top-3 right-0 w-6 h-6 bg-slate-900 rounded-full"></div>

              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-900 leading-tight mb-2">{selectedTrip.title}</h2>
                <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5"/>
                  <span>{selectedTrip.address} <button onClick={() => openGoogleMaps(selectedTrip.address)} className="text-blue-600 font-bold ml-1 hover:underline flex items-center inline-flex gap-0.5"><Map size={12}/>지도보기</button></span>
                </div>
              </div>

              <div className="space-y-4 border-b border-dashed border-slate-200 pb-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Date</div><div className="font-bold flex items-center gap-1"><Calendar size={14}/>{selectedTrip.date}</div></div>
                  <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Time</div><div className="font-bold flex items-center gap-1"><Clock size={14}/>{selectedTrip.time}</div></div>
                  <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Guests</div><div className="font-bold flex items-center gap-1"><User size={14}/>{selectedTrip.guests}인</div></div>
                  <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Booker</div><div className="font-bold truncate">{selectedTrip.userName}</div></div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Host Contact</div>
                  <div className="font-bold flex items-center gap-1 text-sm"><Phone size={14}/>{selectedTrip.hostPhone}</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6 bg-slate-900 text-white p-4 rounded-xl">
                <span className="font-bold text-sm flex items-center gap-2"><CreditCard size={16}/> Total Paid</span>
                <span className="text-2xl font-black">₩{Number(selectedTrip.price).toLocaleString()}</span>
              </div>

              <button className="w-full py-3 bg-slate-100 text-slate-900 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <Share2 size={16}/> 티켓 공유하기
              </button>
            </div>
          </div>
        </div>
      )}

      {isReviewModalOpen && selectedTrip && <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}