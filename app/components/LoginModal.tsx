'use client';

import React, { useState, useCallback } from 'react';
import { X, ChevronDown, MessageCircle } from 'lucide-react'; // MessageCircle 추가
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 번역 훅

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const { t } = useLanguage(); // 🟢 번역 기능 사용
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>('');

  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const ensureProfileExists = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const meta = user.user_metadata || {};

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: meta.full_name || 'User',
        avatar_url: meta.avatar_url || meta.picture || null, // 🟢 프로필 사진 URL 저장
        phone: meta.phone,
        birth_date: meta.birth_date,
        gender: meta.gender
      });
    } else {
      const updates: any = {};
      if (!existingProfile.avatar_url && (meta.avatar_url || meta.picture)) {
        updates.avatar_url = meta.avatar_url || meta.picture; // 🟢 기존 유저도 사진 없으면 업데이트
      }
      if (!existingProfile.gender && meta.gender) updates.gender = meta.gender;
      if (!existingProfile.birth_date && meta.birth_date) updates.birth_date = meta.birth_date;
      if (!existingProfile.phone && meta.phone) updates.phone = meta.phone;

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', user.id);
      }
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email || !password) {
      showToast('이메일과 비밀번호를 입력해주세요.', 'error');
      return;
    }

    if (mode === 'SIGNUP') {
      if (!fullName || !phone || !birthDate || !gender) {
        showToast('이름, 연락처, 생년월일, 성별을 모두 입력해주세요.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'SIGNUP') {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { 
              full_name: fullName,
              phone: phone,
              birth_date: birthDate,
              gender: gender 
            } 
          }
        });
        
        if (error) throw error;

        if (data.user && data.session) {
          showToast('회원가입이 완료되었습니다!', 'success');
          await ensureProfileExists();
          onClose();
          if (onLoginSuccess) onLoginSuccess();
          router.refresh();
        } else {
          showToast('가입 인증 메일을 보냈습니다! 이메일을 확인해주세요.', 'success');
          setMode('LOGIN'); 
        }

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
           if (error.message.includes('Invalid login credentials')) {
             throw new Error('이메일 또는 비밀번호가 일치하지 않습니다.');
           }
           if (error.message.includes('Email not confirmed')) {
             throw new Error('이메일 인증이 완료되지 않았습니다.');
           }
           throw error;
        }
        
        await ensureProfileExists();
        
        showToast('환영합니다! 로그인 되었습니다.', 'success');
        onClose();
        if (onLoginSuccess) onLoginSuccess();
        router.refresh();
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.status === 429) {
        showToast('너무 많은 가입 요청이 감지되었습니다. 잠시 후 다시 시도하거나 소셜 로그인을 이용해주세요.', 'error');
      } else {
        showToast(error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) showToast(error.message, 'error');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className={`bg-white w-full ${mode === 'SIGNUP' ? 'max-w-[480px]' : 'max-w-[420px]'} rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 transition-all`}>
        
        <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100">
          <button onClick={onClose} type="button" className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2">
            <X size={18} className="text-gray-900" />
          </button>
          <span className="font-bold text-[15px] text-gray-900">
            {mode === 'LOGIN' ? t('login') : t('signup')} {/* 🟢 번역 적용 */}
          </span>
          <div className="w-8"></div>
        </div>

        <div className={`p-6 ${mode === 'SIGNUP' ? 'max-h-[80vh] overflow-y-auto' : ''}`}>
          
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {mode === 'LOGIN' ? t('welcome_title') : '계정 생성하기'} {/* 🟢 번역 적용 */}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              {mode === 'LOGIN' ? t('welcome_subtitle') : '빠르고 간편하게 가입하세요.'} {/* 🟢 번역 적용 */}
            </p>
          </div>

          <form onSubmit={handleAuth}>
            <div className="border border-gray-300 rounded-xl overflow-hidden mb-6">
              
              <InputItem 
                type="email" label={t('email')} value={email} setValue={setEmail}  // 🟢 번역 적용
                isFirst={true} focusKey="EMAIL" currentFocus={isFocused} setFocus={setIsFocused}
                autoComplete="username"
              />

              <InputItem 
                type="password" label={t('password')} value={password} setValue={setPassword} // 🟢 번역 적용
                isFirst={false} focusKey="PASSWORD" currentFocus={isFocused} setFocus={setIsFocused}
                autoComplete={mode === 'LOGIN' ? "current-password" : "new-password"}
              />

              {mode === 'SIGNUP' && (
                <>
                  <InputItem 
                    type="text" label="이름 (실명)" value={fullName} setValue={setFullName} 
                    isFirst={false} focusKey="NAME" currentFocus={isFocused} setFocus={setIsFocused}
                    autoComplete="name"
                  />
                  
                  <InputItem 
                    type="tel" label="휴대폰 번호 (- 없이 입력)" value={phone} setValue={setPhone} 
                    isFirst={false} focusKey="PHONE" currentFocus={isFocused} setFocus={setIsFocused}
                    autoComplete="tel"
                  />
                  
                  <div className="flex border-t border-gray-300">
                     <div className={`relative h-14 w-1/2 border-r border-gray-300 ${isFocused === 'BIRTH' ? 'ring-2 ring-black z-10' : ''}`}>
                        <input
                          type="text"
                          className="block w-full h-full pt-5 pb-1 px-4 text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
                          placeholder="생년월일 (YYYYMMDD)"
                          value={birthDate}
                          onChange={(e) => {
                             const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                             setBirthDate(val);
                          }}
                          onFocus={() => setIsFocused('BIRTH')}
                          onBlur={() => setIsFocused(null)}
                          autoComplete="bday"
                        />
                        <label className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium pointer-events-none">
                          생년월일 (8자리)
                        </label>
                     </div>
                     
                     <div className={`relative h-14 w-1/2 ${isFocused === 'GENDER' ? 'ring-2 ring-black z-10' : ''}`}>
                        <select
                          className="block w-full h-full pt-5 pb-1 px-4 text-[15px] text-gray-900 bg-white appearance-none focus:outline-none peer bg-transparent z-10 relative cursor-pointer"
                          value={gender}
                          onChange={(e) => setGender(e.target.value as any)}
                          onFocus={() => setIsFocused('GENDER')}
                          onBlur={() => setIsFocused(null)}
                          autoComplete="sex"
                        >
                           <option value="" disabled>성별 선택</option> 
                           <option value="Male">남성</option>
                           <option value="Female">여성</option>
                        </select>
                        <label className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-0 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium pointer-events-none">
                          성별
                        </label>
                        <ChevronDown size={16} className="absolute right-3 top-5 text-gray-500 pointer-events-none"/>
                     </div>
                  </div>
                </>
              )}
            </div>

            <div className="text-[11px] text-gray-500 mb-6 leading-relaxed">
              {t('agree_terms')} {/* 🟢 번역 적용 */}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#111] hover:bg-black text-white font-bold h-12 rounded-xl text-[15px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-6 shadow-md"
            >
              {loading ? t('loading') : (mode === 'LOGIN' ? t('login_button') : t('signup'))} {/* 🟢 번역 적용 */}
            </button>
          </form>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[11px] text-gray-400 font-bold">{t('or')}</span> {/* 🟢 번역 적용 */}
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <div className="space-y-3">
            <SocialButton provider="kakao" label={t('continue_kakao')} onClick={() => handleSocialLogin('kakao')} /> {/* 🟢 번역 적용 */}
            <SocialButton provider="google" label={t('continue_google')} onClick={() => handleSocialLogin('google')} /> {/* 🟢 번역 적용 */}
          </div>

          <div className="mt-6 text-center text-sm">
             <button 
                type="button"
                onClick={() => {
                  setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                  setIsFocused(null);
                }} 
                className="text-gray-900 font-semibold underline decoration-1 underline-offset-4 hover:text-gray-600 transition-colors"
             >
               {mode === 'LOGIN' ? `${t('no_account')} ${t('signup')}` : '이미 계정이 있으신가요? 로그인'} {/* 🟢 번역 적용 */}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function InputItem({ type, label, value, setValue, isFirst, focusKey, currentFocus, setFocus, autoComplete }: any) {
  const isFocused = currentFocus === focusKey;
  
  return (
    <div className={`relative h-14 ${!isFirst ? 'border-t border-gray-300' : ''} ${isFocused ? 'ring-2 ring-black z-10 rounded-none' : ''}`}>
      <input
        type={type}
        className="block w-full h-full pt-5 pb-1 px-4 text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
        placeholder={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocus(focusKey)}
        onBlur={() => setFocus(null)}
        autoComplete={autoComplete}
      />
      <label className="absolute text-gray-500 duration-150 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

function SocialButton({ provider, label, onClick }: { provider: 'kakao' | 'google', label: string, onClick: () => void }) {
  const isKakao = provider === 'kakao';
  return (
    <button 
      type="button"
      onClick={onClick}
      className="w-full h-12 border border-gray-900 hover:bg-gray-50 rounded-xl flex items-center relative transition-all active:scale-[0.98]"
    >
      <div className="absolute left-4">
        {isKakao ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z"/>
          </svg>
        ) : (
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
        )}
      </div>
      <span className="w-full text-center text-sm font-bold text-gray-900">
        {label}
      </span>
    </button>
  );
}// Force update
