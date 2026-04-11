import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

function calculateAverageRating(ratings: Array<{ rating: number }>) {
  if (ratings.length === 0) return 0;

  const totalRating = ratings.reduce((sum, row) => sum + row.rating, 0);
  return Number((totalRating / ratings.length).toFixed(2));
}

function calculateNullableAverageRating(ratings: Array<{ rating: number }>) {
  if (ratings.length === 0) return null;

  const totalRating = ratings.reduce((sum, row) => sum + row.rating, 0);
  return Number((totalRating / ratings.length).toFixed(2));
}

export async function syncReviewAggregates(params: {
  experienceId: number;
  hostId?: string | null;
  supabaseAdmin?: AdminSupabaseClient;
}) {
  const supabaseAdmin = params.supabaseAdmin ?? createAdminClient();

  const { data: experienceReviews, error: experienceReviewsError } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .eq('experience_id', params.experienceId);

  if (experienceReviewsError) {
    throw experienceReviewsError;
  }

  const normalizedExperienceReviews = experienceReviews || [];
  const { error: experienceUpdateError } = await supabaseAdmin
    .from('experiences')
    .update({
      rating: calculateAverageRating(normalizedExperienceReviews),
      review_count: normalizedExperienceReviews.length,
    })
    .eq('id', params.experienceId);

  if (experienceUpdateError) {
    throw experienceUpdateError;
  }

  let hostId = params.hostId ?? null;
  if (!hostId) {
    const { data: experience, error: experienceError } = await supabaseAdmin
      .from('experiences')
      .select('host_id')
      .eq('id', params.experienceId)
      .maybeSingle();

    if (experienceError) {
      throw experienceError;
    }

    hostId = experience?.host_id ?? null;
  }

  if (!hostId) return;

  const { data: hostReviews, error: hostReviewsError } = await supabaseAdmin
    .from('reviews')
    .select('rating, experiences!inner(host_id)')
    .eq('experiences.host_id', hostId);

  if (hostReviewsError) {
    throw hostReviewsError;
  }

  const normalizedHostReviews = hostReviews || [];
  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({
      average_rating: calculateNullableAverageRating(normalizedHostReviews),
      total_review_count: normalizedHostReviews.length,
    })
    .eq('id', hostId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }
}
