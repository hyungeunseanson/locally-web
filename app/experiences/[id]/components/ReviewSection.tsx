'use client';

import PublicReviewSection from '@/app/components/reviews/PublicReviewSection';

interface ReviewSectionProps {
  experienceId: number | string;
  hostName: string;
}

export default function ReviewSection({ experienceId, hostName }: ReviewSectionProps) {
  return (
    <div className="border-b border-slate-200">
      <PublicReviewSection
        experienceId={experienceId}
        hostName={hostName}
        sectionId="reviews"
        testId="experience-public-reviews-section"
      />
    </div>
  );
}
