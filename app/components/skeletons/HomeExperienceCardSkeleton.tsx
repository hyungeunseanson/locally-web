import Skeleton from '@/app/components/ui/Skeleton';

export function HomeExperienceCardSkeleton() {
  return (
    <div className="block">
      <div className="relative mb-2.5 md:mb-3">
        <Skeleton className="aspect-square w-full rounded-[22px] md:rounded-[24px]" />
        <Skeleton className="absolute left-3 top-3 h-6 w-14 rounded-full md:left-4 md:top-4 md:h-7 md:w-[72px]" />
        <Skeleton className="absolute right-3 top-3 h-5 w-5 rounded-full md:right-4 md:top-4 md:h-6 md:w-6" />
      </div>
      <div className="space-y-1 px-0.5">
        <Skeleton className="h-3.5 w-[88%] rounded-md md:h-[18px]" />
        <Skeleton className="h-3.5 w-[74%] rounded-md md:h-4" />
        <Skeleton className="h-3 w-[52%] rounded-md md:h-4" />
        <Skeleton className="h-3 w-[68%] rounded-md md:h-4" />
      </div>
    </div>
  );
}
