'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 발생 시 콘솔에 로그 (추후 센트리 등 연동 가능)
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-red-50 p-4 rounded-full mb-4">
        <AlertTriangle className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        문제가 발생했습니다.
      </h2>
      <p className="text-slate-500 mb-8 max-w-md">
        일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.<br/>
        문제가 지속되면 고객센터로 문의 바랍니다.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
      >
        <RefreshCcw size={18} />
        다시 시도하기
      </button>
    </div>
  );
}
