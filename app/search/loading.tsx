import Skeleton from '@/app/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 영역 */}
      <div className="border-b border-slate-100 px-4 py-4">
        <Skeleton className="h-[56px] w-full max-w-md mx-auto rounded-full" />
        <div className="mt-3 flex items-center justify-center gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="px-4 pt-5">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
