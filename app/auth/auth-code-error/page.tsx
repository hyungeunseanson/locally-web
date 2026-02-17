'use client';

import React from 'react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

/**
 * 소셜 로그인(구글/카카오 등) 인증 코드 처리 실패 시 보여주는 페이지
 */
export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">
            로그인에 실패했어요
          </h1>
          <p className="text-slate-600 mb-2">
            소셜 로그인 처리 중 문제가 발생했거나, 요청이 만료되었을 수 있어요.
          </p>
          <p className="text-slate-500 text-sm mb-10">
            다시 시도하거나 이메일 로그인을 이용해 주세요.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
            >
              <RefreshCw size={18} />
              다시 로그인하기
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Home size={18} />
              홈으로
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
