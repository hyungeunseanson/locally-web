import { Star } from 'lucide-react';

export interface AdminGuestReview {
  id: number;
  host_name: string | null;
  guest_name: string | null;
  experience_title: string | null;
  booking_number: string | null;
  rating: number | null;
  content: string | null;
  created_at: string;
}

export default function GuestReviewCards({ reviews }: { reviews: AdminGuestReview[] }) {
  return (
    <div className="space-y-3" data-testid="admin-guest-review-list">
      {reviews.map((review) => (
        <article
          key={review.id}
          data-testid="admin-guest-review-card"
          className="min-w-0 rounded-xl border border-slate-100 bg-white p-4 hover:shadow-sm"
        >
          <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-xs text-slate-600 sm:grid-cols-2">
            <p className="min-w-0 break-words"><span className="font-semibold text-slate-500">호스트</span> <span className="font-bold text-slate-900">{review.host_name || '(삭제된 사용자)'}</span></p>
            <p className="min-w-0 break-words"><span className="font-semibold text-slate-500">게스트</span> <span className="font-bold text-slate-900">{review.guest_name || '(삭제된 사용자)'}</span></p>
            <p className="min-w-0 break-words"><span className="font-semibold text-slate-500">체험</span> {review.experience_title || '(삭제된 체험)'}</p>
            <p className="min-w-0 break-all"><span className="font-semibold text-slate-500">예약번호</span> {review.booking_number || '-'}</p>
          </div>

          <div className="mt-3 flex items-center gap-0.5" aria-label={`별점 ${review.rating ?? 0}점`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={12}
                fill={(review.rating ?? 0) >= star ? '#FBBF24' : 'none'}
                className={(review.rating ?? 0) >= star ? 'text-amber-400' : 'text-slate-300'}
              />
            ))}
            <span className="ml-1 text-xs text-slate-500">{review.rating ?? '-'}</span>
          </div>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{review.content || '(내용 없음)'}</p>
          <time className="mt-2 block text-[10px] text-slate-400" dateTime={review.created_at}>
            {new Date(review.created_at).toLocaleDateString('ko-KR')}
          </time>
        </article>
      ))}
    </div>
  );
}
