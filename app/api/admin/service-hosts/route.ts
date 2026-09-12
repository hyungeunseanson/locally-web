import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function GET() {
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, { userId: user.id, email: user.email });
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { data: applications, error } = await supabaseAdmin
    .from('host_applications')
    .select('user_id, name, languages, language_levels, host_nationality, profile_photo, self_intro, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: '호스트 목록을 불러오지 못했습니다.' }, { status: 500 });

  const latestByHost = new Map<string, NonNullable<typeof applications>[number]>();
  for (const application of applications || []) {
    if (application.user_id && !latestByHost.has(application.user_id)) latestByHost.set(application.user_id, application);
  }
  const hostIds = [...latestByHost.keys()];
  const [{ data: profiles }, { data: experiences }] = await Promise.all([
    hostIds.length ? supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', hostIds) : Promise.resolve({ data: [] }),
    hostIds.length ? supabaseAdmin.from('experiences').select('host_id, city, country, title, is_active').in('host_id', hostIds).eq('is_active', true) : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    success: true,
    data: hostIds.map((hostId) => {
      const application = latestByHost.get(hostId)!;
      const profile = profileById.get(hostId);
      return {
        id: hostId,
        name: application.name || profile?.full_name || profile?.email || hostId.slice(-8),
        email: profile?.email || null,
        avatarUrl: application.profile_photo || profile?.avatar_url || null,
        languages: application.languages || [],
        languageLevels: application.language_levels || [],
        nationality: application.host_nationality || null,
        selfIntro: application.self_intro || null,
        activeExperiences: (experiences || []).filter((experience) => experience.host_id === hostId).map((experience) => ({ title: experience.title, city: experience.city, country: experience.country })),
      };
    }),
  });
}
