'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void; // 선택적 props
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // 소셜 로그인 (구글, 카카오 등)
  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setLoading(true);
    // ✅ 로그인 끝나면 아까 만든 '도장 찍는 곳(callback)'으로 보내라!
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      alert('로그인에 실패했습니다.');
      setLoading(false);
    }
    // 성공하면 Supabase가 알아서 리다이렉트 하므로 setLoading(false) 불필요
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* 배경 클릭시 닫힘 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* 모달 창 */}
      <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-slate-900">로그인 또는 회원가입</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* 카카오 로그인 */}
            <button 
              onClick={() => handleSocialLogin('kakao')}
              disabled={loading}
              className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#000000] font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C5.373 3 0 6.603 0 11.05c0 2.923 2.317 5.485 5.894 6.84-.25.923-.902 3.364-.93 3.518-.046.262.095.257.2.17.135-.112 3.194-2.158 4.453-3.03.774.113 1.576.176 2.383.176 6.627 0 12-3.603 12-8.05S18.627 3 12 3z"/>
              </svg>
              {loading ? '연결 중...' : '카카오로 3초 만에 시작하기'}
            </button>

            {/* 구글 로그인 */}
            <button 
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              구글로 계속하기
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            계속 진행하면 <span className="underline cursor-pointer">이용약관</span> 및 <span className="underline cursor-pointer">개인정보처리방침</span>에 동의하게 됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}