'use client';

import React, { useState, useCallback } from 'react';
import { X, Chrome, MessageCircle } from 'lucide-react';
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

  // 프로필 존재 여부 확인 및 생성 (기존 로직 유지)
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

  // 인증 처리 함수 (기존 로직 유지 + 유효성 검사 추가)
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

  // 🟢 [NEW] 엔터키 입력 핸들러
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

  return (
    // 배경: 더 깊은 블러와 부드러운 페이드인
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* 모달 컨테이너: 더 둥글고, 아래에서 부드럽게 올라오는 애니메이션 적용 */}
      <div className="bg-white w-full max-w-[440px] mx-auto rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out sm:my-8">
        
        {/* 헤더: 닫기 버튼 디자인 개선 */}
        <div className="relative h-16 flex items-center justify-end px-6 pt-6">
          <button 
            onClick={onClose} 
            className="group p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <X size={20} className="text-slate-600 group-hover:text-slate-900 transition-colors" />
          </button>
        </div>

        <div className="px-8 pb-10 pt-2">
          {/* 타이틀: 크기 키우고 간격 조정 */}
          <h2 className="text-[28px] font-black leading-tight mb-3 text-slate-900 tracking-tight">
            Locally에 오신 것을<br/>환영합니다 👋
          </h2>
          <p className="text-slate-500 text-base mb-10 font-medium">현지인처럼 여행하는 가장 쉬운 방법</p>
          
          {/* 소셜 로그인 버튼: 호버 시 살짝 떠오르는 인터랙션 추가 */}
          <div className="space-y-4 mb-10">
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-14 bg-[#FEE500] hover:bg-[#FDD835] rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-[#391B1B] font-bold text-lg shadow-sm hover:shadow-md"
            >
              <MessageCircle size={24} fill="currentColor" className="border-none"/>
              <span>카카오로 3초 만에 시작하기</span>
            </button>

            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-14 border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-slate-700 font-bold text-lg"
            >
              <Chrome size={24}/>
              <span>Google로 계속하기</span>
            </button>
          </div>

          {/* 구분선 디자인 개선 */}
          <div className="relative py-4 mb-6 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-bold uppercase tracking-wider">또는 이메일로</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* 입력창: 엔터키 적용 및 포커스 디자인 개선 */}
          <div className="space-y-4">
            <div className="relative">
                <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown} // 🟢 엔터키 적용
                placeholder="이메일 주소" 
                className="peer w-full h-14 pl-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-slate-900 focus:outline-none transition-all duration-200 font-medium text-lg placeholder:text-slate-400"
                />
            </div>
            <div className="relative">
                <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown} // 🟢 엔터키 적용
                placeholder="비밀번호" 
                className="peer w-full h-14 pl-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-slate-900 focus:outline-none transition-all duration-200 font-medium text-lg placeholder:text-slate-400"
                />
            </div>
          </div>

          {/* 메인 버튼: 디자인 및 인터랙션 강화 */}
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

          {/* 모드 전환 문구 개선 */}
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