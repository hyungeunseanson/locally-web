'use client' // 클라이언트 컴포넌트 필수

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 에러 로깅 서비스(Sentry 등)가 있다면 여기서 호출
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        앗, 정보를 불러오는 데 실패했어요.
      </h2>
      <p className="text-gray-600 mb-8">
        일시적인 오류이거나 존재하지 않는 체험입니다.
      </p>
      <button
        onClick={
          // 다시 시도 버튼 (세그먼트 리렌더링)
          () => reset()
        }
        className="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors font-medium"
      >
        다시 시도하기
      </button>
      <a href="/" className="mt-4 text-sm text-gray-500 underline">
        홈으로 돌아가기
      </a>
    </div>
  )
}