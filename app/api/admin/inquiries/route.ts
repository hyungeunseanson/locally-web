import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getHostPublicProfile } from '@/app/utils/profile';

// `useChat`에서 사용하던 Profile/HostApp 인터페이스
type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name?: string | null;
  profile_photo?: string | null;
};

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // 1. 최근 문의 100건 조회
    const { data: inquiriesData, error: inquiriesError } = await supabaseAdmin
      .from('inquiries')
      .select('*, experiences (id, title, photos, image_url, host_id)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (inquiriesError) throw inquiriesError;

    const inquiryRows = inquiriesData || [];
    
    if (inquiryRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. 연관된 사용자 ID 수집 (호스트 & 게스트)
    const inquiryIds = inquiryRows.map((i) => i.id);
    const hostIds = Array.from(new Set(inquiryRows.map((item) => item.host_id).filter(Boolean))) as string[];
    const guestIds = Array.from(new Set(inquiryRows.map((item) => item.user_id).filter(Boolean))) as string[];

    // 3. 프로필, 애플리케이션, 그리고 안 읽은 메시지 수 조회
    const [profilesRes, appsRes, guestProfilesRes, unreadRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', hostIds),
      supabaseAdmin.from('host_applications').select('user_id, name, profile_photo').in('user_id', hostIds),
      supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', guestIds),
      supabaseAdmin.from('inquiry_messages')
        .select('inquiry_id')
        .in('inquiry_id', inquiryIds)
        .eq('is_read', false)
        .neq('sender_id', user.id)
    ]);

    const hostProfiles = (profilesRes.data || []) as ProfileRow[];
    const hostApps = (appsRes.data || []) as HostApplicationRow[];
    const guestProfiles = (guestProfilesRes.data || []) as ProfileRow[];
    const unreadRows = (unreadRes.data || []) as Array<{ inquiry_id: number | string }>;

    const profilesMap = new Map(hostProfiles.map((p) => [p.id, p]));
    const appsMap = new Map(hostApps.map((a) => [a.user_id, a]));
    const guestMap = new Map(guestProfiles.map((g) => [g.id, g]));

    const unreadCounts: Record<string, number> = {};
    unreadRows.forEach((msg) => {
      const key = String(msg.inquiry_id);
      unreadCounts[key] = (unreadCounts[key] || 0) + 1;
    });

    const secureUrl = (url: string | null | undefined) => {
      if (!url || url === '') return null;
      if (url.startsWith('http://')) return url.replace('http://', 'https://');
      return url;
    };

    // 4. 최종 JSON 데이터 조립
    const safeData = inquiryRows.map((item) => {
      const hostApp = appsMap.get(item.host_id || '');
      const hostProfile = profilesMap.get(item.host_id || '');
      const hostPublicProfile = getHostPublicProfile(hostProfile, hostApp, '호스트');

      const guestProfile = guestMap.get(item.user_id);
      const guestName = guestProfile?.full_name || guestProfile?.email?.split('@')[0] || '게스트';
      const guestAvatar = guestProfile?.avatar_url;

      return {
        ...item,
        experience_id: item.experience_id ?? '',
        unread_count: unreadCounts[String(item.id)] || 0,
        guest: {
          id: item.user_id,
          name: guestName,
          avatar_url: secureUrl(guestAvatar ?? null),
          email: guestProfile?.email
        },
        host: {
          id: item.host_id,
          name: hostPublicProfile.name,
          avatar_url: secureUrl(hostPublicProfile.avatarUrl ?? null)
        },
        experiences: item.experiences
          ? {
            ...item.experiences,
            image_url: secureUrl(item.experiences.image_url || item.experiences.photos?.[0] || null)
          }
          : null
      };
    });

    return NextResponse.json({ success: true, data: safeData });
  } catch (error: unknown) {
    console.error('[inquiries/list] error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
