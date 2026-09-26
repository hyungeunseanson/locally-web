import { HomeExperienceCardSkeleton } from '@/app/components/skeletons/HomeExperienceCardSkeleton';

export default function HomeStreamingFallback() {
  return (
    <div data-testid="home-streaming-skeleton" className="min-h-screen bg-white px-5 pt-24 md:px-12 md:pt-36">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((index) => <HomeExperienceCardSkeleton key={index} />)}
        </div>
      </div>
    </div>
  );
}
