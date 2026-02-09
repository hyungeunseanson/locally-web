import Skeleton from "@/app/components/ui/Skeleton"; // 🟢 중괄호 제거
export function ExperienceDetailSkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto px-6 py-8 animate-pulse">
      {/* 타이틀 섹션 */}
      <div className="mb-6 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="flex justify-between items-end">
          <Skeleton className="h-5 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 사진 그리드 스켈레톤 (5개 배치 흉내) */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[480px] mb-12 rounded-2xl overflow-hidden bg-slate-100">
         <div className="col-span-2 row-span-2 relative bg-slate-200"></div>
         <div className="col-span-1 row-span-1 bg-slate-200"></div>
         <div className="col-span-1 row-span-1 bg-slate-200"></div>
         <div className="col-span-1 row-span-1 bg-slate-200"></div>
         <div className="col-span-1 row-span-1 bg-slate-200"></div>
      </div>

      {/* 하단 콘텐츠 */}
      <div className="flex flex-col md:flex-row gap-16">
        {/* 메인 콘텐츠 */}
        <div className="flex-1 space-y-8">
          <div className="flex justify-between items-center py-6 border-b border-slate-100">
             <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
             </div>
             <Skeleton className="w-14 h-14 rounded-full" />
          </div>
          <div className="space-y-3">
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* 사이드바 (예약 카드) */}
        <div className="w-full md:w-[380px]">
          <Skeleton className="h-[400px] w-full rounded-2xl border border-slate-200 shadow-sm" />
        </div>
      </div>
    </div>
  );
}