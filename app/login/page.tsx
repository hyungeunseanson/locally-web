'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import LoginModal from '@/app/components/LoginModal';
import { Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';

/**
 * 로그인 전용 페이지
 * - 이미 로그인된 사용자는 returnUrl 또는 메인으로 리다이렉트
 * - returnUrl 쿼리가 있으면 로그인 성공 후 해당 경로로 이동
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  const returnUrl = searchParams.get('returnUrl') || searchParams.get('next') || '/';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setChecking(false);
      if (user) router.replace(returnUrl || '/');
    });
  }, [mounted, returnUrl, router]);

  const handleClose = () => {
    router.push(returnUrl || '/');
  };

  const handleLoginSuccess = () => {
    router.push(returnUrl || '/');
  };

  if (!mounted || checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-12 bg-slate-50/50">
        <div className="w-full max-w-md text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 mb-2">로그인</h1>
          <p className="text-slate-500 text-sm">아래 로그인 창을 통해 계정에 접속하세요.</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900 underline"
          >
            홈으로 돌아가기
          </button>
        </div>
        <LoginModal
          isOpen={true}
          onClose={handleClose}
          onLoginSuccess={handleLoginSuccess}
        />
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
