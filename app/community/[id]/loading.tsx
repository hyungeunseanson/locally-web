export default function CommunityDetailLoading() {
  return (
    <div className="min-h-screen bg-[#F7F7F9]">
      <div className="max-w-7xl mx-auto lg:px-4 lg:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">

          {/* 좌측 본문 */}
          <div className="lg:col-span-8">
            <div className="max-w-[768px] mx-auto lg:max-w-none min-h-screen bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-100 pb-8">

              {/* 헤더 바 skeleton */}
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <div className="h-8 w-20 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
              </div>

              {/* 본문 article skeleton */}
              <div className="px-5 py-6">
                {/* 카테고리 배지 */}
                <div className="mb-3 flex gap-2">
                  <div className="h-6 w-16 rounded-full bg-slate-200 animate-pulse" />
                </div>

                {/* 제목 */}
                <div className="mb-4 space-y-2">
                  <div className="h-6 w-full rounded-full bg-slate-200 animate-pulse" />
                  <div className="h-6 w-4/5 rounded-full bg-slate-200 animate-pulse" />
                </div>

                {/* 작성자 행 */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-slate-200 animate-pulse shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-24 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-slate-200 animate-pulse" />
                  </div>
                </div>

                {/* 본문 텍스트 */}
                <div className="space-y-3 mb-8">
                  {[100, 90, 95, 80, 70].map((w, i) => (
                    <div key={i} className={`h-4 w-[${w}%] rounded-full bg-slate-100 animate-pulse`} />
                  ))}
                  <div className="h-4 w-3/5 rounded-full bg-slate-100 animate-pulse" />
                </div>
              </div>

              {/* 통계(조회/좋아요) + 댓글 skeleton */}
              <div className="border-t border-slate-100 mx-5 py-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-4 w-16 rounded-full bg-slate-200 animate-pulse" />
                  <div className="h-8 w-24 rounded-full bg-slate-200 animate-pulse" />
                </div>
                <div className="space-y-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 w-20 rounded-full bg-slate-200 animate-pulse" />
                        <div className="h-4 w-full rounded-full bg-slate-100 animate-pulse" />
                        <div className="h-4 w-3/4 rounded-full bg-slate-100 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 이전글/목록/다음글 skeleton */}
              <div className="mx-5 border-t border-slate-100 pb-6 pt-5">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 rounded-xl bg-slate-200 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 우측 사이드바 skeleton (데스크탑만) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="h-4 w-24 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-3 w-full rounded-full bg-slate-100 animate-pulse" />
                <div className="h-3 w-4/5 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-3 w-3/4 rounded-full bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
