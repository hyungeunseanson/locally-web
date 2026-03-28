import Skeleton from '@/app/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* 탭 네비게이션 */}
      <div className="border-b border-slate-100 px-4 md:px-8 pt-4">
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
