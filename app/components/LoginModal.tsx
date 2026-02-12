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
  // 1. Hooks 선언 (최상단 유지)
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState<'EMAIL' | 'PASSWORD' | null>(null); // 포커스 효과용
  
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  // 2. Helper Functions
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

  // 3. 조건부 렌더링 (가장 마지막)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose}></div>

      {/* 모달 컨테이너 (에어비앤비 스타일: 둥근 모서리, 깔끔한 헤더, 컴팩트한 너비) */}
      <div className="bg-white w-full max-w-[568px] md:w-[568px] rounded-xl shadow-xl overflow-hidden relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300">
        
        {/* 1. 헤더: 닫기 버튼 왼쪽, 제목 중앙, 하단 라인 */}
        <div className="h-16 border-b border-gray-200 flex items-center px-6 relative justify-center">
          <button 
            onClick={onClose} 
            className="absolute left-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-900" />
          </button>
          <span className="font-bold text-base text-gray-900">
            {mode === 'LOGIN' ? '로그인 또는 회원가입' : '회원가입'}
          </span>
        </div>

        <div className="p-6">
          {/* 2. 환영 메시지 */}
          <div className="mb-6">
            <h3 className="text-[22px] font-semibold text-gray-900 mb-1">Locally에 오신 것을 환영합니다.</h3>
            <p className="text-sm text-gray-500">현지인처럼 여행하는 가장 쉬운 방법</p>
          </div>

          {/* 3. 인풋 그룹 (에어비앤비 스타일: 붙어있는 인풋) */}
          <div className="border border-gray-400 rounded-lg overflow-hidden mb-4">
            {/* 이메일 인풋 */}
            <div className={`relative h-14 border-b border-gray-400 ${isFocused === 'EMAIL' ? 'ring-2 ring-black z-10 border-transparent rounded-t-lg' : ''}`}>
              <input
                type="email"
                className="block w-full h-full pt-4 pb-1 px-3 text-base text-gray-900 bg-transparent appearance-none focus:outline-none placeholder-transparent peer"
                placeholder="이메일"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsFocused('EMAIL')}
                onBlur={() => setIsFocused(null)}
                onKeyDown={handleKeyDown}
              />
              <label 
                htmlFor="email" 
                className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
              >
                이메일
              </label>
            </div>

            {/* 비밀번호 인풋 */}
            <div className={`relative h-14 ${isFocused === 'PASSWORD' ? 'ring-2 ring-black z-10 rounded-b-lg' : ''}`}>
              <input
                type="password"
                className="block w-full h-full pt-4 pb-1 px-3 text-base text-gray-900 bg-transparent appearance-none focus:outline-none placeholder-transparent peer"
                placeholder="비밀번호"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsFocused('PASSWORD')}
                onBlur={() => setIsFocused(null)}
                onKeyDown={handleKeyDown}
              />
              <label 
                htmlFor="password" 
                className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
              >
                비밀번호
              </label>
            </div>
          </div>

          <div className="text-[12px] text-gray-500 mb-6">
            전화번호 확인을 위해 전화나 문자로 메시지를 보내드립니다. 일반 문자 메시지 요금 및 데이터 요금이 부과될 수 있습니다.
          </div>

          {/* 4. 계속하기 버튼 (브랜드 컬러: 에어비앤비 핑크 or 로컬리 블랙) */}
          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-[#E51D52] hover:bg-[#D90B3E] text-white font-bold h-12 rounded-lg text-base transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-6"
          >
            {loading ? '처리 중...' : '계속하기'}
          </button>

          {/* 5. 구분선 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500 font-medium">또는</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* 6. 소셜 버튼 (좌측 아이콘, 중앙 텍스트, 얇은 테두리) */}
          <div className="space-y-4">
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-12 border border-gray-900 hover:bg-gray-50 rounded-lg flex items-center relative transition-all active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z"/>
                </svg>
              </div>
              <span className="w-full text-center text-sm font-semibold text-gray-900">카카오톡으로 계속하기</span>
            </button>

            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-12 border border-gray-900 hover:bg-gray-50 rounded-lg flex items-center relative transition-all active:scale-[0.98]"
            >
              <div className="absolute left-4">
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
              </div>
              <span className="w-full text-center text-sm font-semibold text-gray-900">구글로 계속하기</span>
            </button>
          </div>

          {/* 모드 전환 */}
          <div className="mt-6 text-center text-sm">
             <button 
                onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
                className="text-gray-900 font-semibold underline decoration-1 underline-offset-4 hover:text-gray-600"
             >
               {mode === 'LOGIN' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}