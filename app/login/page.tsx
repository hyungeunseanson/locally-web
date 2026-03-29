'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import LoginModal from '@/app/components/LoginModal';
import { Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import Spinner from '@/app/components/ui/Spinner';
import { useLanguage } from '@/app/context/LanguageContext';

function normalizeReturnUrl(rawValue: string | null | undefined) {
  if (typeof rawValue !== 'string') {
    return '/';
  }

  const value = rawValue.trim();
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/';
  }

  try {
    const parsed = new URL(value, 'https://locally.local');
    if (parsed.origin !== 'https://locally.local' || !parsed.pathname.startsWith('/')) {
      return '/';
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

/**
 * 로그인 전용 페이지
 * - 이미 로그인된 사용자는 returnUrl 또는 메인으로 리다이렉트
 * - returnUrl 쿼리가 있으면 로그인 성공 후 해당 경로로 이동
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const returnUrl = useMemo(
    () => normalizeReturnUrl(searchParams.get('returnUrl') ?? searchParams.get('next')),
    [searchParams]
  );

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          router.replace(returnUrl);
          return;
        }
      } finally {
        setChecking(false);
      }
    };
    
    checkSession();
  }, [returnUrl, router, supabase]);

  const handleClose = () => {
    router.push(returnUrl || '/');
  };

  const handleLoginSuccess = () => {
    router.push(returnUrl || '/');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size={34} variant="muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-12 bg-slate-50/50">
        <div className="w-full max-w-md text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 mb-2">{t('login')}</h1>
          <p className="text-slate-500 text-sm">
            {returnUrl !== '/' ? t('login_return_page_desc') : t('login_default_page_desc')}
          </p>
          <div data-testid="login-page-help" className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-semibold text-slate-900">{t('login_help_title')}</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              {returnUrl !== '/' ? t('login_help_return_hint') : t('login_help_default_hint')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900 underline"
          >
            {t('login_back_home')}
          </button>
        </div>
        <LoginModal
          isOpen={true}
          onClose={handleClose}
          onLoginSuccess={handleLoginSuccess}
          redirectPath={returnUrl}
        />
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size={34} variant="muted" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
