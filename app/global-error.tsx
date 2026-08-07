'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureClientException } from '@/app/utils/monitoring/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    captureClientException(error, { boundary: 'app/global-error' });
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="min-h-screen bg-white px-6 py-20 text-center text-slate-900">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="mb-5 rounded-full bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              오류가 발생했습니다
            </div>
            <h1 className="text-2xl font-bold">페이지를 불러오지 못했습니다.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              다시 시도하기
            </button>
            <Link
              href="/help"
              className="mt-4 text-sm font-semibold text-slate-600 underline underline-offset-4"
            >
              고객센터 문의
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
