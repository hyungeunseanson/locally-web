import Skeleton from '@/app/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white px-4 pt-6 md:px-8">
      <Skeleton className="h-8 w-40 mb-6" />

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
            <Skeleton className="h-24 w-24 md:h-28 md:w-28 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
