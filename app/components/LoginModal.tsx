'use client';

import React, { useState } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getLegalDocument } from '@/app/constants/legalDocuments';
import {
  getLoginModalCopy,
  getLoginModalNationalityOptions,
} from '@/app/components/loginModalLocalization';

type Gender = 'Male' | 'Female' | '';

interface InputItemProps {
  type: string;
  label: string;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  isFirst: boolean;
  focusKey: string;
  currentFocus: string | null;
  setFocus: React.Dispatch<React.SetStateAction<string | null>>;
  autoComplete: string;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [nationality, setNationality] = useState('');

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [showLegalText, setShowLegalText] = useState<'terms' | 'privacy' | null>(null);

  const [loading, setLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<'google' | 'kakao' | null>(null);
  const [isFocused, setIsFocused] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const copy = getLoginModalCopy(lang);
  const nationalityOptions = getLoginModalNationalityOptions(lang);
  const legalDocument = showLegalText ? getLegalDocument(lang, showLegalText) : null;

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading || socialLoadingProvider) return;

    if (!email || !password) {
      showToast(copy.emailPasswordRequired, 'error');
      return;
    }

    if (mode === 'SIGNUP') {
      if (!fullName || !phone || !birthDate || !gender || !nationality) {
        showToast(copy.signupFieldsRequired, 'error');
        return;
      }
      if (!birthDate.match(/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/)) {
        showToast(copy.birthDateInvalid, 'error');
        return;
      }
      if (phone.length < 9) {
        showToast(copy.phoneInvalid, 'error');
        return;
      }
      if (!termsAgreed || !privacyAgreed) {
        setTermsError(true);
        showToast(copy.agreementsRequired, 'error');
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
              gender: gender,
              nationality: nationality
            }
          }
        });

        if (error) throw error;

        if (data.user && data.session) {
          showToast(copy.signupSuccess, 'success');
          if (onLoginSuccess) {
            onLoginSuccess();
          } else {
            onClose();
          }
          router.refresh();
        } else {
          showToast(copy.signupVerificationSent, 'success');
          setMode('LOGIN');
        }

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error(copy.invalidCredentials);
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error(copy.emailNotConfirmed);
          }
          throw error;
        }

        showToast(copy.loginSuccess, 'success');
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          onClose();
        }
        router.refresh();
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, copy.unknownError);
      const errorStatus =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: number }).status
          : undefined;

      if (errorMessage.includes('rate limit') || errorStatus === 429) {
        showToast(copy.rateLimit, 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    if (loading || socialLoadingProvider) return;

    setSocialLoadingProvider(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setSocialLoadingProvider(null);
      showToast(error.message, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className={`bg-white w-full ${mode === 'SIGNUP' ? 'max-w-[356px] md:max-w-[480px]' : 'max-w-[328px] md:max-w-[420px]'} rounded-[22px] md:rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 transition-all`}>

        {/* 🟢 약관 모달 오버레이 */}
        {showLegalText && legalDocument && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col h-full">
            <div className="h-12 md:h-14 flex items-center justify-between px-4 md:px-5 border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowLegalText(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2 text-gray-900"
                type="button"
              >
                <X size={18} />
              </button>
              <span className="font-bold text-[14px] md:text-[15px] text-gray-900">
                {legalDocument.title}
              </span>
              <div className="w-8"></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
              {legalDocument.fallbackNotice && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] md:text-xs font-medium leading-relaxed text-amber-900">
                  {legalDocument.fallbackNotice}
                </div>
              )}
              <div className="text-[12px] md:text-[13px] text-gray-600 leading-relaxed bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm whitespace-pre-wrap">
                {legalDocument.body}
              </div>
            </div>
            <div className="p-4 md:p-5 border-t border-gray-100 bg-white flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowLegalText(null)}
                className="w-full bg-black text-white font-bold h-11 md:h-12 rounded-xl text-[14px] md:text-[15px] hover:bg-gray-800 transition-all active:scale-[0.98]"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        )}

        <div className="h-12 md:h-14 flex items-center justify-between px-4 md:px-5 border-b border-gray-100">
          <button onClick={onClose} type="button" className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2">
            <X size={18} className="text-gray-900" />
          </button>
          <span className="font-bold text-[14px] md:text-[15px] text-gray-900">
            {mode === 'LOGIN' ? t('login') : t('signup')} {/* 🟢 번역 적용 */}
          </span>
          <div className="w-8"></div>
        </div>

        <div className={`p-4 md:p-6 ${mode === 'SIGNUP' ? 'max-h-[76dvh] md:max-h-[80vh] overflow-y-auto' : ''}`}>

          <div className="mb-5 md:mb-6">
            <h3 className="text-[18px] md:text-xl font-bold text-gray-900 mb-1">
              {mode === 'LOGIN' ? t('welcome_title') : copy.signupTitle}
            </h3>
            <p className="text-[12px] md:text-sm text-gray-500 font-medium">
              {mode === 'LOGIN' ? t('welcome_subtitle') : copy.signupSubtitle}
            </p>
          </div>

          <form onSubmit={handleAuth}>
            <div className="border border-gray-300 rounded-xl overflow-hidden mb-5 md:mb-6">

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
                  <div className="flex border-t border-gray-300">
                    <div className="w-1/2 border-r border-gray-300">
                      <InputItem
                        type="text" label={copy.realNameLabel} value={fullName} setValue={setFullName}
                        isFirst={true} focusKey="NAME" currentFocus={isFocused} setFocus={setIsFocused}
                        autoComplete="name"
                      />
                    </div>
                    <div className={`relative h-12 md:h-14 w-1/2 ${isFocused === 'NATION' ? 'ring-2 ring-black z-10' : ''}`}>
                      <select
                        className={`block w-full h-full pt-4 md:pt-5 pb-1 px-3.5 md:px-4 text-[14px] md:text-[15px] bg-white appearance-none focus:outline-none peer relative cursor-pointer ${!nationality ? 'text-transparent' : 'text-gray-900'}`}
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        onFocus={() => setIsFocused('NATION')}
                        onBlur={() => setIsFocused(null)}
                      >
                        <option value="" disabled className="text-gray-900">{t('select_nationality')}</option>
                        {nationalityOptions.map((option) => (
                          <option key={option.value} value={option.value} className="text-gray-900">
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className={`absolute duration-150 transform -translate-y-3 scale-75 top-3.5 md:top-4 z-0 origin-[0] left-3.5 md:left-4 text-[13px] md:text-[14px] font-medium pointer-events-none ${!nationality ? 'text-gray-500' : 'text-gray-500'}`}>
                        {t('label_nationality')}
                      </label>
                      <ChevronDown size={16} className="absolute right-3 top-4 md:top-5 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <InputItem
                    type="tel" label={copy.phoneFieldLabel} value={phone} setValue={setPhone}
                    isFirst={false} focusKey="PHONE" currentFocus={isFocused} setFocus={setIsFocused}
                    autoComplete="tel"
                  />

                  <div className="flex border-t border-gray-300">
                    <div className={`relative h-12 md:h-14 w-1/2 border-r border-gray-300 ${isFocused === 'BIRTH' ? 'ring-2 ring-black z-10' : ''}`}>
                      <input
                        type="text"
                        className="block w-full h-full pt-4 md:pt-5 pb-1 px-3.5 md:px-4 text-[14px] md:text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
                        placeholder={copy.birthDateFieldLabel}
                        value={birthDate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                          setBirthDate(val);
                        }}
                        onFocus={() => setIsFocused('BIRTH')}
                        onBlur={() => setIsFocused(null)}
                        autoComplete="bday"
                      />
                      <label className="absolute text-[13px] md:text-[14px] text-gray-500 duration-150 transform -translate-y-3 scale-75 top-3.5 md:top-4 z-10 origin-[0] left-3.5 md:left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium pointer-events-none">
                        {copy.birthDateFieldLabel}
                      </label>
                    </div>

                    <div className={`relative h-12 md:h-14 w-1/2 ${isFocused === 'GENDER' ? 'ring-2 ring-black z-10' : ''}`}>
                      <select
                        className={`block w-full h-full pt-4 md:pt-5 pb-1 px-3.5 md:px-4 text-[14px] md:text-[15px] bg-white appearance-none focus:outline-none peer relative cursor-pointer ${!gender ? 'text-transparent' : 'text-gray-900'}`}
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        onFocus={() => setIsFocused('GENDER')}
                        onBlur={() => setIsFocused(null)}
                        autoComplete="sex"
                      >
                        <option value="" disabled className="text-gray-900">{t('gender_select')}</option>
                        <option value="Male" className="text-gray-900">{t('gender_male')}</option>
                        <option value="Female" className="text-gray-900">{t('gender_female')}</option>
                      </select>
                      <label className={`absolute duration-150 transform -translate-y-3 scale-75 top-3.5 md:top-4 z-0 origin-[0] left-3.5 md:left-4 text-[13px] md:text-[14px] font-medium pointer-events-none ${!gender ? 'text-gray-500' : 'text-gray-500'}`}>
                        {t('label_gender')}
                      </label>
                      <ChevronDown size={16} className="absolute right-3 top-4 md:top-5 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {mode === 'SIGNUP' && (
              <div className={`mb-5 md:mb-6 rounded-xl border ${termsError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'} text-xs text-gray-700`}>
                <div
                  className="flex items-center p-3.5 md:p-4 border-b border-gray-200 cursor-pointer select-none group"
                  onClick={() => {
                    const newValue = !(termsAgreed && privacyAgreed);
                    setTermsAgreed(newValue);
                    setPrivacyAgreed(newValue);
                  }}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${termsAgreed && privacyAgreed ? 'bg-black border-black text-white' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                    {(termsAgreed && privacyAgreed) && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="ml-3 font-bold text-[13px] md:text-sm text-gray-900">{copy.selectAll}</span>
                </div>

                <div className="p-3.5 md:p-4 space-y-3.5 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center cursor-pointer select-none group"
                      onClick={() => setTermsAgreed(!termsAgreed)}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${termsAgreed ? 'bg-black border-black text-white' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                        {termsAgreed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="ml-2.5 text-gray-700 font-medium text-xs">{copy.termsAgreement}</span>
                    </div>
                    <button type="button" onClick={() => setShowLegalText('terms')} className="text-[11px] md:text-[12px] text-gray-400 hover:text-black underline font-medium">{copy.viewLabel}</button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center cursor-pointer select-none group"
                      onClick={() => setPrivacyAgreed(!privacyAgreed)}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${privacyAgreed ? 'bg-black border-black text-white' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                        {privacyAgreed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="ml-2.5 text-gray-700 font-medium text-xs">{copy.privacyAgreement}</span>
                    </div>
                    <button type="button" onClick={() => setShowLegalText('privacy')} className="text-[11px] md:text-[12px] text-gray-400 hover:text-black underline font-medium">{copy.viewLabel}</button>
                  </div>
                </div>
              </div>
            )}
            {mode === 'LOGIN' && (
              <div className="text-[10px] md:text-[11px] text-gray-500 mb-5 md:mb-6 leading-relaxed">
                {t('agree_terms')} {/* 🟢 번역 적용 */}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || socialLoadingProvider !== null}
              aria-busy={loading}
              className="mb-5 md:mb-6 h-11 md:h-12 w-full rounded-xl bg-[#111] text-[14px] md:text-[15px] font-bold text-white shadow-md transition-all active:scale-[0.98] active:brightness-95 hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {mode === 'LOGIN' ? t('login_button') : t('signup')}
              </span>
            </button>
          </form>

          <div className="mb-5 md:mb-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[11px] text-gray-400 font-bold">{t('or')}</span> {/* 🟢 번역 적용 */}
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <div className="space-y-2.5 md:space-y-3">
            <SocialButton provider="kakao" label={t('continue_kakao')} onClick={() => handleSocialLogin('kakao')} isLoading={socialLoadingProvider === 'kakao'} disabled={loading || socialLoadingProvider !== null} /> {/* 🟢 번역 적용 */}
            <SocialButton provider="google" label={t('continue_google')} onClick={() => handleSocialLogin('google')} isLoading={socialLoadingProvider === 'google'} disabled={loading || socialLoadingProvider !== null} /> {/* 🟢 번역 적용 */}
          </div>

          <div className="mt-5 md:mt-6 text-center text-[13px] md:text-sm">
            <button
              type="button"
              onClick={() => {
                if (loading || socialLoadingProvider) return;
                setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                setIsFocused(null);
              }}
              disabled={loading || socialLoadingProvider !== null}
              className="text-gray-900 font-semibold underline decoration-1 underline-offset-4 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              {mode === 'LOGIN' ? `${t('no_account')} ${t('signup')}` : copy.switchToLogin}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function InputItem({ type, label, value, setValue, isFirst, focusKey, currentFocus, setFocus, autoComplete }: InputItemProps) {
  const isFocused = currentFocus === focusKey;

  return (
    <div className={`relative h-12 md:h-14 ${!isFirst ? 'border-t border-gray-300' : ''} ${isFocused ? 'ring-2 ring-black z-10 rounded-none' : ''}`}>
      <input
        type={type}
        className="block w-full h-full pt-4 md:pt-5 pb-1 px-3.5 md:px-4 text-[14px] md:text-[15px] text-gray-900 bg-white appearance-none focus:outline-none placeholder-transparent peer"
        placeholder={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocus(focusKey)}
        onBlur={() => setFocus(null)}
        autoComplete={autoComplete}
      />
      <label className="absolute text-[13px] md:text-[14px] text-gray-500 duration-150 transform -translate-y-3 scale-75 top-3.5 md:top-4 z-10 origin-[0] left-3.5 md:left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

function SocialButton({
  provider,
  label,
  onClick,
  isLoading,
  disabled,
}: {
  provider: 'kakao' | 'google',
  label: string,
  onClick: () => void,
  isLoading?: boolean,
  disabled?: boolean,
}) {
  const isKakao = provider === 'kakao';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={isLoading}
      className={`relative flex h-11 md:h-12 w-full items-center rounded-xl border border-gray-900 transition-all active:scale-[0.98] ${isLoading ? 'bg-gray-50' : 'hover:bg-gray-50'} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <div className="absolute left-3.5 md:left-4">
        {isLoading ? (
          <Loader2 size={18} className="animate-spin text-gray-500" />
        ) : isKakao ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 4C7.02944 4 3 7.35786 3 11.5C3 14.078 4.66428 16.3685 7.23438 17.707L6.2125 21.465C6.12656 21.782 6.47891 22.029 6.75781 21.845L11.2969 18.845C11.5297 18.868 11.7641 18.88 12 18.88C16.9706 18.88 21 15.522 21 11.38C21 7.238 16.9706 4 12 4Z" />
          </svg>
        ) : (
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" /><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" /><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" /><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" /></svg>
        )}
      </div>
      <span className="w-full text-center text-[13px] md:text-sm font-bold text-gray-900">
        {label}
      </span>
    </button>
  );
}// Force update
