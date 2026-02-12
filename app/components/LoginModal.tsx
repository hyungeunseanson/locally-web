'use client';

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  // 1. Hooks (최상단)
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState<'EMAIL' | 'PASSWORD' | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  // 2. Logic Functions
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

  const handleAuth = useCallback(async () => {
    if (!email || !password) {
        showToast('이메일과 비밀번호를 입력해주세요.', 'error');
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
        showToast('가입 성공! 이메일을 확인해주세요.', 'success');
        setMode('LOGIN');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureProfileExists();
        showToast('로그인 되었습니다.', 'success');
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
    if (e.key === 'Enter') handleAuth();
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) showToast(error.message, 'error');
  };

  // 3. Render (조건문은 마지막)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* 모달 박스: 컴팩트한 사이즈(420px) & 둥근 모서리 */}
      <div className="bg-white w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
        
        {/* 헤더 */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2">
            <X size={18} className="text-gray-900" />
          </button>
          <span className="font-bold text-[15px] text-gray-900">
            {mode === 'LOGIN' ? '로그인 또는 회원가입' : '회원가입'}
          </span>
          <div className="w-8"></div> {/* 공간 맞춤용 */}
        </div>

        <div className="p-6 pt-8">
          {/* 타이틀 */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Locally에 오신 것을 환영합니다.</h3>
            <p className="text-sm text-gray-500 font-medium">현지인처럼 여행하는 가장 쉬운 방법</p>
          </div>

          {/* 인풋 그룹 (Black border focus) */}
          <div className="border border-gray-300 rounded-xl overflow-hidden mb-6">
            <div className={`relative h-14 border-b border-gray-300 ${isFocused === 'EMAIL' ? 'ring-2 ring-black z-10 border-transparent rounded-t-xl' : ''}`}>
              <input
                type="email"
                className="block w-full h-full pt-5 pb-1 px-4 text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsFocused('EMAIL')}
                onBlur={() => setIsFocused(null)}
                onKeyDown={handleKeyDown}
                id="email"
              />
              <label 
                htmlFor="email" 
                className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium"
              >
                이메일
              </label>
            </div>

            <div className={`relative h-14 ${isFocused === 'PASSWORD' ? 'ring-2 ring-black z-10 rounded-b-xl' : ''}`}>
              <input
                type="password"
                className="block w-full h-full pt-5 pb-1 px-4 text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsFocused('PASSWORD')}
                onBlur={() => setIsFocused(null)}
                onKeyDown={handleKeyDown}
                id="password"
              />
              <label 
                htmlFor="password" 
                className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium"
              >
                비밀번호
              </label>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 mb-6 leading-relaxed">
            계속 진행하면 Locally의 
            <span className="font-bold underline cursor-pointer mx-1">서비스 약관</span>및 
            <span className="font-bold underline cursor-pointer mx-1">개인정보 처리방침</span>에 동의하는 것으로 간주됩니다.
          </div>

          {/* 메인 버튼 (로컬리 블랙) */}
          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-[#111] hover:bg-black text-white font-bold h-12 rounded-xl text-[15px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-6 shadow-md"
          >
            {loading ? '처리 중...' : '계속하기'}
          </button>

          {/* 구분선 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[11px] text-gray-400 font-bold">또는</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* 소셜 버튼 (블랙 보더 스타일) */}
          <div className="space-y-3">
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-12 border border-gray-900 hover:bg-gray-50 rounded-xl flex items-center relative transition-all active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z"/>
                </svg>
              </div>
              <span className="w-full text-center text-sm font-bold text-gray-900">카카오톡으로 계속하기</span>
            </button>

            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-12 border border-gray-900 hover:bg-gray-50 rounded-xl flex items-center relative transition-all active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
              </div>
              <span className="w-full text-center text-sm font-bold text-gray-900">구글로 계속하기</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}