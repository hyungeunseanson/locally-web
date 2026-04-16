import { NextResponse } from 'next/server';
import {
  ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
  detectChatPolicySignals,
} from '@/app/utils/chatPolicySignals';
import { clearAdminSupportUnreadBatch } from '@/app/utils/adminSupportUnreadAlerts';
import { getInquiryMessageDisplayContent, isAdminSupportInquiry } from '@/app/utils/inquiry';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { markInquiryMessagesRead } from '@/app/api/inquiries/thread/shared';
import { getHostPublicProfile } from '@/app/utils/profile';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name?: string | null;
  profile_photo?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

type InquiryTypeRow = {
  id: number | string;
  user_id?: string | null;
  host_id?: string | null;
  experience_id?: string | number | null;
  type?: string | null;
  status?: string | null;
  content?: string | null;
  updated_at?: string | null;
  experiences?: {
    id?: number | string | null;
    title?: string | null;
    photos?: string[] | null;
    image_url?: string | null;
    host_id?: string | null;
  } | {
    id?: number | string | null;
    title?: string | null;
    photos?: string[] | null;
    image_url?: string | null;
    host_id?: string | null;
  }[] | null;
};

function normalizeInquiryExperience(
  experience: InquiryTypeRow['experiences']
) {
  if (Array.isArray(experience)) {
    return experience[0] ?? null;
  }

  return experience ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { id: inquiryId } = await context.params;

    // 관리자 권한 확인
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: inquiryRow, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .select('id, user_id, host_id, experience_id, type, status, content, updated_at, experiences (id, title, photos, image_url, host_id)')
      .eq('id', inquiryId)
      .maybeSingle<InquiryTypeRow>();

    if (inquiryError) throw inquiryError;

    if (inquiryRow && isAdminSupportInquiry(inquiryRow.type)) {
      await markInquiryMessagesRead({
        actor: {
          id: user.id,
          email: user.email,
        },
        body: { inquiryId },
      });

      await clearAdminSupportUnreadBatch({
        supabaseAdmin,
        inquiryId,
      });
    }

    const secureUrl = (url: string | null | undefined) => {
      if (!url || url === '') return null;
      if (url.startsWith('http://')) return url.replace('http://', 'https://');
      return url;
    };

    const detailUserIds = Array.from(new Set([
      inquiryRow?.user_id,
      inquiryRow?.host_id,
    ].filter(Boolean))) as string[];

    const [detailProfilesRes, detailAppsRes] = await Promise.all([
      detailUserIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url, phone').in('id', detailUserIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      detailUserIds.length > 0
        ? supabaseAdmin.from('host_applications').select('user_id, name, profile_photo, email, phone, status').in('user_id', detailUserIds)
        : Promise.resolve({ data: [] as HostApplicationRow[], error: null }),
    ]);

    if (detailProfilesRes.error) throw detailProfilesRes.error;
    if (detailAppsRes.error) throw detailAppsRes.error;

    const detailProfileMap = new Map(
      ((detailProfilesRes.data || []) as ProfileRow[]).map((profile) => [profile.id, profile])
    );
    const detailAppMap = new Map(
      ((detailAppsRes.data || []) as HostApplicationRow[]).map((application) => [application.user_id, application])
    );

    const inquiryExperience = normalizeInquiryExperience(inquiryRow?.experiences);
    const inquiryGuestProfile = inquiryRow?.user_id ? detailProfileMap.get(inquiryRow.user_id) ?? null : null;
    const inquiryHostProfile = inquiryRow?.host_id ? detailProfileMap.get(inquiryRow.host_id) ?? null : null;
    const inquiryHostApplication = inquiryRow?.host_id ? detailAppMap.get(inquiryRow.host_id) ?? null : null;
    const inquiryHostPublicProfile = getHostPublicProfile(inquiryHostProfile, inquiryHostApplication, '호스트');
    const inquiryGuestName = inquiryGuestProfile?.full_name || inquiryGuestProfile?.email?.split('@')[0] || '게스트';

    const inquiryDetail = inquiryRow
      ? {
          ...inquiryRow,
          guest: {
            id: inquiryRow.user_id ?? null,
            name: inquiryGuestName,
            avatar_url: secureUrl(inquiryGuestProfile?.avatar_url ?? null),
            email: inquiryGuestProfile?.email ?? null,
            phone: inquiryGuestProfile?.phone ?? null,
          },
          host: {
            id: inquiryRow.host_id ?? null,
            name: inquiryHostPublicProfile.name,
            avatar_url: secureUrl(inquiryHostPublicProfile.avatarUrl ?? null),
            email: inquiryHostProfile?.email || inquiryHostApplication?.email || null,
            phone: inquiryHostProfile?.phone || inquiryHostApplication?.phone || null,
            status: inquiryHostApplication?.status || null,
          },
          experiences: inquiryExperience
            ? {
                ...inquiryExperience,
                image_url: secureUrl(inquiryExperience.image_url || inquiryExperience.photos?.[0] || null),
              }
            : null,
        }
      : null;

    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('inquiry_messages')
      .select('id, inquiry_id, sender_id, content, image_url, type, is_read, read_at, created_at')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    const rawMessages = messagesData || [];

    const senderIds = Array.from(
      new Set(rawMessages.map((message) => message.sender_id).filter(Boolean))
    ) as string[];

    const [proRes, appRes] = await Promise.all([
      senderIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url, phone').in('id', senderIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      senderIds.length > 0
        ? supabaseAdmin.from('host_applications').select('user_id, name, profile_photo').in('user_id', senderIds)
        : Promise.resolve({ data: [] as HostApplicationRow[], error: null }),
    ]);

    const profileRows = (proRes.data || []) as ProfileRow[];
    const appRows = (appRes.data || []) as HostApplicationRow[];
    const profileMap = new Map(profileRows.map((p) => [p.id, p]));
    const appMap = new Map(appRows.map((a) => [a.user_id, a]));

    const safeMessages = rawMessages.map((msg) => {
      const profile = profileMap.get(msg.sender_id);
      const app = appMap.get(msg.sender_id);
      const hostPublicProfile = getHostPublicProfile(profile, app, '알 수 없음');
      const name = hostPublicProfile.name;
      const avatar = hostPublicProfile.avatarUrl;
      const signal = detectChatPolicySignals(String(msg.content || ''), {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      });

      return {
        ...msg,
        content: getInquiryMessageDisplayContent({
          type: msg.type,
          content: msg.content,
        }),
        created_at: msg.created_at || new Date().toISOString(),
        has_policy_signal: signal.matched,
        policy_signal_categories: signal.categories,
        sender: {
          id: msg.sender_id,
          name,
          avatar_url: secureUrl(avatar ?? null)
        }
      };
    });

    return NextResponse.json({ success: true, data: safeMessages, inquiry: inquiryDetail });
  } catch (error: unknown) {
    console.error(`[inquiries/messages] error:`, error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
