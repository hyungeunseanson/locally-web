import Skeleton from '@/app/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Skeleton className="h-8 w-28 rounded-full" />
          <div className="hidden items-center gap-3 md:flex">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-16">
        <Skeleton className="mb-3 h-8 w-32 md:mb-12 md:h-11 md:w-44" />

        <div className="space-y-6 md:hidden">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-4">
                  <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Skeleton className="h-9 rounded-lg" />
                  <Skeleton className="h-9 rounded-lg" />
                  <Skeleton className="h-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-100" />
              <Skeleton className="h-4 w-16" />
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <Skeleton className="h-28 rounded-2xl" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>

        <div className="hidden md:grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <section className="lg:col-span-7">
            <div className="mb-6 flex items-center gap-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-6 w-8 rounded-full" />
            </div>

            <div className="flex flex-col gap-8">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex gap-6">
                    <Skeleton className="h-56 w-72 rounded-2xl shrink-0" />
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-8 w-3/4" />
                      </div>
                      <div className="flex gap-3">
                        <Skeleton className="h-9 w-28 rounded-xl" />
                        <Skeleton className="h-9 w-24 rounded-xl" />
                      </div>
                      <Skeleton className="h-16 rounded-2xl" />
                      <div className="grid grid-cols-3 gap-2 pt-4">
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="sticky top-24 space-y-4">
              <Skeleton className="h-7 w-32" />
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <Skeleton className="h-20 w-20 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
