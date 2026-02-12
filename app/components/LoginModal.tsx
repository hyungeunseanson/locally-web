'use client';

import React, { useState, useCallback } from 'react';
import { X, Chrome } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  // 1. 모든 Hooks(useState, useRouter 등)를 최상단에 선언
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // supabase client는 컴포넌트 내부에서 생성해도 되지만, useMemo를 쓰거나 그냥 써도 무방 (여기선 그냥 유지)
  const supabase = createClient();
  const { showToast } = useToast();

  // 2. Helper 함수들 정의
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

  // 3. useCallback 훅 선언 (반드시 조건문보다 위에 있어야 함!)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleAuth();
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) showToast(error.message, 'error');
  };

  // 4. 🚨 조건부 렌더링은 모든 훅 선언이 끝난 뒤, 가장 마지막에!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      <div className="bg-white w-full max-w-[440px] mx-auto rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out sm:my-8">
        
        <div className="relative h-16 flex items-center justify-end px-6 pt-6">
          <button 
            onClick={onClose} 
            className="group p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <X size={20} className="text-slate-600 group-hover:text-slate-900 transition-colors" />
          </button>
        </div>

        <div className="px-8 pb-10 pt-2">
          <h2 className="text-[28px] font-black leading-tight mb-3 text-slate-900 tracking-tight">
            Locally에 오신 것을<br/>환영합니다 👋
          </h2>
          <p className="text-slate-500 text-base mb-10 font-medium">현지인처럼 여행하는 가장 쉬운 방법</p>
          
          <div className="space-y-4 mb-10">
            {/* 카카오톡 버튼 */}
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-14 bg-[#FEE500] hover:bg-[#FDD835] rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-[#391B1B] font-bold text-lg shadow-sm hover:shadow-md"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3C7.58172 3 4 6.58172 4 11C4 15.4183 7.58172 19 12 19C16.4183 19 20 15.4183 20 11C20 6.58172 16.4183 3 12 3Z" fill="#391B1B" fillOpacity="0"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z" fill="currentColor"/>
              </svg>
              <span>카카오로 3초 만에 시작하기</span>
            </button>

            {/* 구글 버튼 */}
            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-14 border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-slate-700 font-bold text-lg"
            >
              <Chrome size={24}/>
              <span>Google로 계속하기</span>
            </button>
          </div>

          <div className="relative py-4 mb-6 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-bold uppercase tracking-wider">또는 이메일로</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="space-y-4">
            <div className="relative">
                <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="이메일 주소" 
                className="peer w-full h-14 pl-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-slate-900 focus:outline-none transition-all duration-200 font-medium text-lg placeholder:text-slate-400"
                />
            </div>
            <div className="relative">
                <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="비밀번호" 
                className="peer w-full h-14 pl-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-slate-900 focus:outline-none transition-all duration-200 font-medium text-lg placeholder:text-slate-400"
                />
            </div>
          </div>

          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-slate-900 text-white font-bold text-lg h-14 rounded-2xl mt-8 transition-all duration-200 hover:bg-black hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? (
                <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    처리 중...
                </span>
            ) : (mode === 'LOGIN' ? '로그인하기' : '회원가입하기')}
          </button>

          <div className="mt-8 text-center text-base font-medium">
             <span className="text-slate-500">{mode === 'LOGIN' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
             <button 
                onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
                className="font-bold text-slate-900 ml-2 hover:text-blue-600 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-slate-900 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:origin-left"
             >
               {mode === 'LOGIN' ? '회원가입 시작하기' : '로그인하러 가기'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}