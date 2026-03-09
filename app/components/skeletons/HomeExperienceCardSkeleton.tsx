import Skeleton from '@/app/components/ui/Skeleton';

export function HomeExperienceCardSkeleton() {
  return (
    <div className="block">
      <div className="relative mb-2.5 md:mb-3">
        <Skeleton className="aspect-square w-full rounded-[22px] md:rounded-[24px]" />
        <Skeleton className="absolute left-3 top-3 h-7 w-16 rounded-full md:left-4 md:top-4 md:h-8 md:w-20" />
        <Skeleton className="absolute right-3 top-3 h-8 w-8 rounded-full md:right-4 md:top-4 md:h-9 md:w-9" />
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
