'use client';

import React, { useState } from 'react';
import { X, Mail, Loader2, ArrowRight, ChevronDown } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>('');

  const [loading, setLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false); // 🟢 소셜 로딩 상태 추가
  const [isFocused, setIsFocused] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  // ... (ensureProfileExists 함수는 기존과 동일하게 유지) ...
  const ensureProfileExists = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const meta = user.user_metadata || {};

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id, email: user.email, full_name: meta.full_name || 'User',
        phone: meta.phone, birth_date: meta.birth_date, gender: meta.gender
      });
    } else {
      const updates: any = {};
      if (!existingProfile.gender && meta.gender) updates.gender = meta.gender;
      if (!existingProfile.birth_date && meta.birth_date) updates.birth_date = meta.birth_date;
      if (!existingProfile.phone && meta.phone) updates.phone = meta.phone;
      if (Object.keys(updates).length > 0) await supabase.from('profiles').update(updates).eq('id', user.id);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... (기존 유효성 검사 로직 유지) ...
    if (!email || !password) return showToast('이메일과 비밀번호를 입력해주세요.', 'error');
    if (mode === 'SIGNUP' && (!fullName || !phone || !birthDate || !gender)) return showToast('모든 정보를 입력해주세요.', 'error');

    setLoading(true);
    try {
      if (mode === 'SIGNUP') {
        const { data, error } = await supabase.auth.signUp({ 
          email, password, options: { data: { full_name: fullName, phone, birth_date: birthDate, gender } } 
        });
        if (error) throw error;
        if (data.user && data.session) {
          showToast('회원가입 완료!', 'success');
          await ensureProfileExists();
          onClose(); if (onLoginSuccess) onLoginSuccess(); router.refresh();
        } else {
          showToast('인증 메일을 확인해주세요.', 'success'); setMode('LOGIN');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureProfileExists();
        showToast('환영합니다!', 'success');
        onClose(); if (onLoginSuccess) onLoginSuccess(); router.refresh();
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'kakao' | 'google') => {
    setIsSocialLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/api/auth/callback` }, // 🟢 경로 수정됨
      });
      if (error) throw error;
    } catch (error: any) {
      showToast(`로그인 실패: ${error.message}`, 'error');
      setIsSocialLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className={`bg-white w-full ${mode === 'SIGNUP' ? 'max-w-[480px]' : 'max-w-[420px]'} rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200`}>
        
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-2 flex justify-between items-center">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
          <div className="font-bold text-lg">{mode === 'LOGIN' ? '로그인' : '회원가입'}</div>
          <div className="w-9"></div>
        </div>

        <div className={`p-6 ${mode === 'SIGNUP' ? 'max-h-[80vh] overflow-y-auto custom-scrollbar' : ''}`}>
          
          <h3 className="text-2xl font-black text-slate-900 mb-2">Locally에 오신 것을 환영합니다.</h3>
          <p className="text-slate-500 font-medium mb-8">여행을 더 특별하게 만드는 로컬 체험 플랫폼</p>

          {/* 🟢 이메일 폼 */}
          <form onSubmit={handleAuth} className="space-y-4 mb-8">
            <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
              <input 
                type="email" placeholder="이메일" className="w-full h-14 px-4 text-lg outline-none border-b border-slate-200" 
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
              />
              <input 
                type="password" placeholder="비밀번호" className="w-full h-14 px-4 text-lg outline-none" 
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              />
              {/* 회원가입 추가 필드는 기존 로직과 동일하게 유지... (생략 가능하지만 필요하면 넣어드립니다) */}
              {mode === 'SIGNUP' && (
                 <>
                   <input type="text" placeholder="이름 (실명)" className="w-full h-14 px-4 text-lg outline-none border-t border-slate-200" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                   <input type="tel" placeholder="연락처" className="w-full h-14 px-4 text-lg outline-none border-t border-slate-200" value={phone} onChange={(e)=>setPhone(e.target.value)} />
                   <div className="flex border-t border-slate-200">
                     <input type="text" placeholder="생년월일(8자리)" className="w-1/2 h-14 px-4 outline-none border-r border-slate-200" value={birthDate} onChange={(e)=>setBirthDate(e.target.value)} />
                     <select className="w-1/2 h-14 px-4 outline-none bg-white" value={gender} onChange={(e)=>setGender(e.target.value as any)}>
                       <option value="">성별 선택</option><option value="Male">남성</option><option value="Female">여성</option>
                     </select>
                   </div>
                 </>
              )}
            </div>

            <button disabled={loading || isSocialLoading} className="w-full h-14 bg-[#FF385C] hover:bg-[#D90B3E] text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin"/> : '계속하기'}
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs text-slate-400 font-bold">또는</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          {/* 🟢 소셜 로그인 버튼 (디자인 개선됨) */}
          <div className="space-y-3">
            {/* 카카오 */}
            <button 
              onClick={() => handleSocialLogin('kakao')}
              disabled={isSocialLoading}
              className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] rounded-xl font-bold flex items-center relative transition-transform active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C5.925 3 1 6.925 1 11.75C1 14.875 3.025 17.625 6.125 19.125C5.95 19.725 5.35 21.875 5.225 22.375C5.225 22.375 5.15 22.575 5.3 22.65C5.45 22.725 5.625 22.625 5.625 22.625C7.9 21.125 10.6 19.3 10.6 19.3C11.05 19.375 11.525 19.4 12 19.4C18.075 19.4 23 15.475 23 10.625C23 5.8 18.075 3 12 3Z"/>
                </svg>
              </div>
              <span className="w-full text-center">카카오로 로그인</span>
            </button>

            {/* 구글 */}
            <button 
              onClick={() => handleSocialLogin('google')}
              disabled={isSocialLoading}
              className="w-full h-12 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center relative transition-transform active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              </div>
              <span className="w-full text-center">구글로 로그인</span>
            </button>
          </div>

          <div className="mt-6 text-center">
             <button onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="text-sm font-semibold text-slate-600 hover:text-black hover:underline transition-colors">
               {mode === 'LOGIN' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}