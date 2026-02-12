'use client';

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react'; // 🟢 아이콘 최소화 (안전성 확보)
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  if (!isOpen) return null;

  // 프로필 존재 여부 확인 및 생성 (안전장치)
  const ensureProfileExists = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'User',
      });
    }
  };

  // 인증 처리 함수
  const handleAuth = useCallback(async () => {
    if (!email || !password) {
        showToast('이메일과 비밀번호를 모두 입력해주세요.', 'error');
        return;
    }

    setLoading(true);
    try {
      if (mode === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { full_name: email.split('@')[0] } }
        });
        if (error) throw error;
        
        showToast('회원가입 성공! 이메일 확인 후 로그인해주세요.', 'success');
        setMode('LOGIN');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        await ensureProfileExists();
        showToast('환영합니다! 성공적으로 로그인되었습니다.', 'success');

        onClose();
        if (onLoginSuccess) onLoginSuccess();
        router.refresh();
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [email, password, mode, supabase, router, onClose, onLoginSuccess, showToast]);

  // 🟢 엔터키 입력 시 자동 로그인
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAuth();
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) showToast(error.message, 'error');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-300">
      {/* 배경 블러 효과 강화 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* 모달 컨테이너 */}
      <div className="bg-white w-full max-w-[420px] mx-auto rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out sm:my-8 border border-white/20">
        
        {/* 닫기 버튼 */}
        <div className="relative h-14 flex items-center justify-end px-6 pt-6">
          <button 
            onClick={onClose} 
            className="group p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all duration-200 focus:outline-none"
          >
            <X size={20} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
          </button>
        </div>

        <div className="px-8 pb-10 pt-0">
          {/* 타이틀 영역 */}
          <div className="mb-8">
            <h2 className="text-[26px] font-black leading-tight mb-2 text-slate-900 tracking-tight">
              Locally에 오신 것을<br/>환영합니다 👋
            </h2>
            <p className="text-slate-500 text-sm font-medium">현지인처럼 여행하는 가장 쉬운 방법</p>
          </div>
          
          {/* 소셜 로그인 버튼 (SVG 사용으로 에러 방지) */}
          <div className="space-y-3 mb-8">
            {/* 카카오톡 */}
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-[#391B1B] font-bold text-[15px] shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z"/>
              </svg>
              <span>카카오로 3초 만에 시작하기</span>
            </button>

            {/* 구글 */}
            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-12 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-slate-700 font-bold text-[15px]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Google로 계속하기</span>
            </button>
          </div>

          {/* 구분선 */}
          <div className="relative py-2 mb-6 flex items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink-0 mx-4 text-[11px] text-slate-400 font-bold uppercase tracking-wider">또는 이메일로</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* 입력창 */}
          <div className="space-y-3">
            <div className="relative group">
                <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="이메일 주소" 
                className="w-full h-12 pl-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-all duration-200 font-medium text-[15px] placeholder:text-slate-400"
                />
            </div>
            <div className="relative group">
                <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="비밀번호" 
                className="w-full h-12 pl-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-all duration-200 font-medium text-[15px] placeholder:text-slate-400"
                />
            </div>
          </div>

          {/* 메인 버튼 */}
          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-slate-900 text-white font-bold text-[15px] h-12 rounded-xl mt-6 transition-all duration-200 hover:bg-black hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? (
                <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    처리 중...
                </span>
            ) : (mode === 'LOGIN' ? '로그인하기' : '회원가입하기')}
          </button>

          {/* 모드 전환 */}
          <div className="mt-6 text-center text-sm">
             <span className="text-slate-400">{mode === 'LOGIN' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
             <button 
                onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
                className="font-bold text-slate-900 ml-2 hover:underline decoration-2 underline-offset-4 transition-all"
             >
               {mode === 'LOGIN' ? '회원가입' : '로그인'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}