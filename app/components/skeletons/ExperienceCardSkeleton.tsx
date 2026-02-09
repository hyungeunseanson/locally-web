import Skeleton from "@/app/components/ui/Skeleton"; // 🟢 중괄호 제거
export function ExperienceCardSkeleton() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[320px] w-full rounded-xl" />
      <div className="space-y-2">
        <div className="flex justify-between">
           <Skeleton className="h-4 w-2/3" />
           <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}