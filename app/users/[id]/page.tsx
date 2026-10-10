import PublicUserProfileClient, { type PublicHostProfile } from './PublicUserProfileClient';
import { PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS } from '@/app/search/searchContract';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';
import { createAdminClient } from '@/app/utils/supabase/admin';

const publicExperienceSelect = [
  ...PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS,
  'status',
  'is_active',
].join(', ');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return <PublicUserProfileClient params={params} initialProfile={null} initialHostExperiences={[]} />;
  }
  const supabase = createAdminClient();
  const { data: hostApplications, error: hostError } = await supabase
    .from('public_host_applications')
    .select('id, status, name, profile_photo, self_intro, languages, is_superhost, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  if (hostError) throw hostError;

  const latestHost = pickLatestPublicHostApplication(hostApplications || []);
  if (!latestHost?.name || !isPublicHostApplicationStatus(latestHost.status)) {
    return <PublicUserProfileClient params={params} initialProfile={null} initialHostExperiences={[]} />;
  }

  // Use the same public projections and active-experience filters as the client page.
  const [{ data: publicAccountProfile, error: profileError }, { data: experiences, error: experienceError }] = await Promise.all([
    supabase.from('public_profiles').select('avatar_url').eq('id', id).maybeSingle(),
    supabase.from('experiences')
      .select(publicExperienceSelect)
      .eq('host_id', id)
      .eq('status', 'active')
      .or('is_active.is.true,is_active.is.null'),
  ]);
  if (profileError) throw profileError;
  if (experienceError) throw experienceError;

  const profile: PublicHostProfile = {
    full_name: latestHost.name,
    avatar_url: latestHost.profile_photo || publicAccountProfile?.avatar_url || null,
    bio: latestHost.self_intro,
    introduction: latestHost.self_intro,
    languages: Array.isArray(latestHost.languages)
      ? latestHost.languages.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    is_superhost: Boolean(latestHost.is_superhost),
    age_band: null,
    gender: null,
  };

  return <PublicUserProfileClient params={params} initialProfile={profile} initialHostExperiences={experiences || []} />;
}
