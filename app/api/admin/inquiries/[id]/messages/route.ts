import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getHostPublicProfile } from '@/app/utils/profile';

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

    // 메시지 쿼리
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    const rawMessages = messagesData || [];
    
    if (rawMessages.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const senderIds = Array.from(new Set(rawMessages.map((m) => m.sender_id)));
    
    const [proRes, appRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', senderIds),
      supabaseAdmin.from('host_applications').select('user_id, name, profile_photo').in('user_id', senderIds)
    ]);

    const profileRows = (proRes.data || []) as ProfileRow[];
    const appRows = (appRes.data || []) as HostApplicationRow[];
    const profileMap = new Map(profileRows.map((p) => [p.id, p]));
    const appMap = new Map(appRows.map((a) => [a.user_id, a]));

    const secureUrl = (url: string | null | undefined) => {
      if (!url || url === '') return null;
      if (url.startsWith('http://')) return url.replace('http://', 'https://');
      return url;
    };

    const safeMessages = rawMessages.map((msg) => {
      const profile = profileMap.get(msg.sender_id);
      const app = appMap.get(msg.sender_id);
      const hostPublicProfile = getHostPublicProfile(profile, app, '알 수 없음');
      const name = hostPublicProfile.name;
      const avatar = hostPublicProfile.avatarUrl;

      return {
        ...msg,
        created_at: msg.created_at || new Date().toISOString(),
        sender: {
          id: msg.sender_id,
          name,
          avatar_url: secureUrl(avatar ?? null)
        }
      };
    });

    return NextResponse.json({ success: true, data: safeMessages });
  } catch (error: unknown) {
    console.error(`[inquiries/messages] error:`, error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
