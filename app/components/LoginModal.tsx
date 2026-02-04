'use client';

import React, { useState } from 'react';
import { X, Chrome, MessageCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';

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

  if (!isOpen) return null;

  // 🔹 [핵심 추가] 프로필 확인 및 생성 함수
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
        // 이메일 가입자는 아바타가 없으므로 기본값 처리
      });
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (mode === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            // 가입 시 메타데이터에 이름 저장
            data: { full_name: email.split('@')[0] } 
          }
        });
        if (error) throw error;
        alert('회원가입 성공! 이메일 확인 후 로그인해주세요.');
        setMode('LOGIN');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // ✅ 로그인 성공 직후 프로필 생성 보장
        await ensureProfileExists();
        
        onClose();
        if (onLoginSuccess) onLoginSuccess();
        router.refresh();
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) alert(error.message);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
        <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6">
          <span className="font-bold text-sm text-slate-500">{mode === 'LOGIN' ? '로그인' : '회원가입'}</span>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-black mb-2 text-slate-900">Locally에 오신 것을<br/>환영합니다 👋</h2>
          <p className="text-slate-500 text-sm mb-8">현지인처럼 여행하는 가장 쉬운 방법</p>
          
          <div className="space-y-3 mb-8">
            <button 
              onClick={() => handleSocialLogin('kakao')}
              className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] rounded-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] text-[#391B1B] font-bold"
            >
              <MessageCircle size={20} fill="currentColor" className="border-none"/>
              카카오로 3초 만에 시작하기
            </button>

            <button 
              onClick={() => handleSocialLogin('google')}
              className="w-full h-12 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] text-slate-700 font-bold"
            >
              <Chrome size={20}/>
              Google로 계속하기
            </button>
          </div>

          <div className="relative py-2 mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">또는 이메일로</span></div>
          </div>

          <div className="space-y-3">
            <input 
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소" 
              className="w-full h-12 pl-4 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all font-medium"
            />
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호" 
              className="w-full h-12 pl-4 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all font-medium"
            />
          </div>

          <button 
            onClick={handleAuth} disabled={loading}
            className="w-full bg-slate-900 text-white font-bold h-14 rounded-xl mt-6 hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
          >
            {loading ? '처리 중...' : (mode === 'LOGIN' ? '로그인하기' : '가입하기')}
          </button>

          <div className="mt-6 text-center text-sm">
             <span className="text-slate-500">{mode === 'LOGIN' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
             <button onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="font-bold text-slate-900 ml-2 hover:underline decoration-2 underline-offset-4">
               {mode === 'LOGIN' ? '회원가입' : '로그인'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}