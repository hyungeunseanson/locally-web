'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, XCircle, MessageSquare, 
  MoreHorizontal, Loader2, AlertTriangle, RefreshCw, X, AlertCircle
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';
import { sendNotification } from '@/app/utils/notification'; // Ensure import

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const supabase = createClient();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          experiences!inner ( id, title, host_id ),
          guest:profiles!bookings_user_id_fkey ( id, full_name, avatar_url, email, phone )
        `)
        .eq('experiences.host_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setReservations(data || []);

    } catch (error: any) {
      console.error('Reservation load error:', error);
      if (error.code === 'PGRST200' || error.message.includes('foreign key')) {
        setErrorMsg('Database connection error. Please re-run SQL.');
      } else {
        setErrorMsg('Failed to load reservations.');
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleApproveCancellation = async (booking: any) => {
    if (!confirm(`Approve cancellation for '${booking.guest?.full_name}'?`)) return;

    setProcessingId(booking.id);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: booking.id, 
          reason: 'Host approved cancellation' 
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Refund failed');

      // 🔔 Send notification to guest
      await sendNotification({
        supabase,
        userId: booking.user_id,
        type: 'cancellation_approved',
        title: 'Cancellation Approved',
        message: `'${booking.experiences?.title}' cancellation has been approved. Refund initiating.`,
        link: '/guest/trips'
      });

      alert('Cancellation approved and refunded.');
      fetchReservations(); 

    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getFilteredList = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return reservations.filter(r => {
      const tripDate = new Date(r.date);
      const isCancelled = r.status === 'cancelled'; 
      const isRequesting = r.status === 'cancellation_requested';
      
      if (activeTab === 'cancelled') return isCancelled || isRequesting;
      if (isCancelled) return false; 

      if (activeTab === 'upcoming') {
         return tripDate >= today || isRequesting;
      }
      if (activeTab === 'completed') return tripDate < today && !isRequesting;
      
      return true;
    });
  };

  const filteredList = getFilteredList();

  const renderStatusBadge = (status: string, date: string) => {
    if (status === 'cancellation_requested') return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse">Requesting Cancel</span>;
    if (status === 'cancelled') return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">Cancelled</span>;
    if (status === 'PAID') {
      const isUpcoming = new Date(date) >= new Date();
      return isUpcoming 
        ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">Confirmed</span>
        : <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">Completed</span>;
    }
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📅 Reservation Manager
          <button onClick={fetchReservations} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </h3>
        
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => {
            const count = tab.id === 'cancelled' || tab.id === 'upcoming'
              ? reservations.filter(r => r.status === 'cancellation_requested').length 
              : 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
                {(tab.id === 'cancelled' || tab.id === 'upcoming') && count > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2 border-b border-red-100">
          <AlertCircle size={18}/> {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Loader2 className="animate-spin mb-2" size={24}/>
            <p className="text-xs">Loading data...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
            <Calendar size={40} className="mb-3 opacity-20"/>
            <p className="text-sm font-medium">No reservations found.</p>
          </div>
        ) : (
          filteredList.map(res => (
            <div key={res.id} className={`border rounded-xl p-5 transition-all bg-white shadow-sm ${res.status === 'cancellation_requested' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 hover:border-slate-300'}`}>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-400">
                    {res.guest?.avatar_url ? (
                      <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                    ) : (
                      <User size={20}/>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-slate-900 text-sm">{res.guest?.full_name || 'Guest'}</span>
                      {renderStatusBadge(res.status, res.date)}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{res.guests} guests</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span>₩{res.amount?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <Link href={`/host/dashboard?tab=inquiries&guestId=${res.user_id}`}>
                    <button className="text-slate-400 hover:text-black p-2 rounded-full hover:bg-slate-100 transition-colors" title="Message">
                        <MessageSquare size={18}/>
                    </button>
                </Link>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                <div className="font-bold text-sm text-slate-800 mb-2 truncate">{res.experiences?.title}</div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(res.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><Clock size={14}/> {res.time || 'TBD'}</span>
                </div>
              </div>

              {res.status === 'cancellation_requested' && (
                <div className="bg-white border border-orange-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-orange-800">Cancellation Requested</p>
                      <p className="text-xs text-orange-600 mt-1">Approval will trigger a full refund.</p>
                      
                      {res.cancel_reason && (
                        <div className="mt-2 bg-orange-50 p-2 rounded border border-orange-100">
                           <p className="text-xs font-bold text-orange-800 mb-1">Reason:</p>
                           <p className="text-xs text-orange-700 break-words whitespace-pre-wrap">"{res.cancel_reason}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleApproveCancellation(res)}
                      disabled={processingId === res.id}
                      className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-orange-200"
                    >
                      {processingId === res.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                      Approve & Refund
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}