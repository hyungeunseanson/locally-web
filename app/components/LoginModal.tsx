'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, User, Chrome, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // 🔹 이메일 로그인/회원가입
  const handleAuth = async () => {
    setLoading(true);
    try {
      if (mode === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('회원가입 성공! 이메일 확인 후 로그인해주세요.');
        setMode('LOGIN');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoginSuccess();
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 소셜 로그인 (구글/카카오)
  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // 로그인 끝나면 원래 있던 페이지로 돌아오게 설정
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    
    if (error) alert(error.message);
    // 소셜 로그인은 페이지가 이동되므로 여기서 onLoginSuccess를 부르지 않습니다.
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* 헤더 */}
        <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full"><X size={20} /></button>
          <span className="font-bold text-sm">{mode === 'LOGIN' ? '로그인 / 회원가입' : '회원가입'}</span>
          <div className="w-9"></div>
        </div>

        {/* 바디 */}
        <div className="p-6">
          <h2 className="text-2xl font-black mb-6">Locally에 오신 것을<br/>환영합니다.</h2>
          
          <div className="space-y-3 mb-6">
            {/* ✅ 카카오 로그인 버튼 */}
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] rounded-xl flex items-center justify-center gap-2 transition-all relative"
            >
              <MessageCircle size={20} fill="black" className="absolute left-4 border-none"/>
              <span className="font-semibold text-sm text-[#391B1B]">카카오로 계속하기</span>
            </button>

            {/* ✅ 구글 로그인 버튼 */}
            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-12 border border-slate-300 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-black transition-all relative"
            >
              <Chrome size={20} className="absolute left-4"/>
              <span className="font-semibold text-sm">Google로 계속하기</span>
            </button>
          </div>

          <div className="relative py-2 mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">또는 이메일로</span></div>
          </div>

          <div className="space-y-3">
            <input 
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일" className="w-full h-12 pl-4 border border-slate-300 rounded-xl focus:border-black focus:outline-none"
            />
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호" className="w-full h-12 pl-4 border border-slate-300 rounded-xl focus:border-black focus:outline-none"
            />
          </div>

          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-slate-900 text-white font-bold h-12 rounded-xl mt-4 hover:scale-[1.01] transition-all disabled:opacity-50"
          >
            {loading ? '처리 중...' : (mode === 'LOGIN' ? '로그인' : '가입하기')}
          </button>

          <div className="mt-4 text-center text-xs text-slate-500">
             {mode === 'LOGIN' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'} 
             <button onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="font-bold underline text-black ml-1">
               {mode === 'LOGIN' ? '회원가입' : '로그인'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}