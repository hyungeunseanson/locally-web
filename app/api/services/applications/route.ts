import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { isApprovedHostEligibleForServiceRequest } from '@/app/utils/serviceHostNotifications';

type ApplyBody = {
  request_id?: string;
  appeal_message?: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ApplyBody;
    const { request_id, appeal_message } = body;

    if (!request_id || !appeal_message?.trim()) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. 의뢰 존재 + open 상태 + 본인 의뢰 아님 검증
    const { data: serviceRequest, error: reqError } = await supabaseAdmin
      .from('service_requests')
      .select('id, status, user_id, title, city, country, duration_hours')
      .eq('id', request_id)
      .maybeSingle();

    if (reqError || !serviceRequest) {
      return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (serviceRequest.status !== 'open') {
      return NextResponse.json({ success: false, error: '이미 마감된 의뢰입니다.' }, { status: 409 });
    }

    if (serviceRequest.user_id === user.id) {
      return NextResponse.json({ success: false, error: '본인의 의뢰에는 지원할 수 없습니다.' }, { status: 403 });
    }

    // 2. 호스트 승인 여부 확인
    const { data: hostApp } = await supabaseAdmin
      .from('host_applications')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!hostApp || hostApp.status !== 'approved') {
      return NextResponse.json({ success: false, error: '승인된 호스트만 지원할 수 있습니다.' }, { status: 403 });
    }

    const isEligibleHost = await isApprovedHostEligibleForServiceRequest(supabaseAdmin, {
      hostId: user.id,
      requestCity: serviceRequest.city,
      requestCountry: serviceRequest.country,
    });

    if (!isEligibleHost) {
      return NextResponse.json({ success: false, error: '해당 국가/도시에 등록된 체험이 있는 호스트만 지원할 수 있습니다.' }, { status: 403 });
    }

    // 3. 중복 지원 방지 (DB UNIQUE 제약으로도 보호되나 메시지 개선용)
    const { data: existing } = await supabaseAdmin
      .from('service_applications')
      .select('id, status')
      .eq('request_id', request_id)
      .eq('host_id', user.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'withdrawn') {
        // 철회 후 재지원 허용: 기존 행 업데이트
        const { error: updateErr } = await supabaseAdmin
          .from('service_applications')
          .update({ appeal_message: appeal_message.trim(), status: 'pending' })
          .eq('id', existing.id);

        if (updateErr) {
          return NextResponse.json({ success: false, error: '지원 중 오류가 발생했습니다.' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ success: false, error: '이미 지원한 의뢰입니다.' }, { status: 409 });
      }
    } else {
      // 4. 지원서 삽입
      const { error: insertErr } = await supabaseAdmin
        .from('service_applications')
        .insert({
          request_id,
          host_id: user.id,
          appeal_message: appeal_message.trim(),
          status: 'pending',
        });

      if (insertErr) {
        console.error('Service Application Insert Error:', insertErr);
        return NextResponse.json({ success: false, error: '지원 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    // 5. 의뢰 소유자(고객)에게 알림 (비동기)
    supabaseAdmin.from('notifications').insert({
      user_id: serviceRequest.user_id,
      type: 'service_application_new',
      title: '📩 새로운 호스트 지원자가 있습니다!',
      message: `'${serviceRequest.title}'에 새로운 호스트가 지원했습니다.`,
      link: `/services/${request_id}`,
      is_read: false,
    }).then(({ error }) => {
      if (error) console.error('Service Application Notification Error:', error);
    });

    sendImmediateGenericEmail({
      recipientUserId: serviceRequest.user_id,
      subject: '[Locally] 새로운 호스트 지원자가 있습니다',
      title: '새로운 호스트 지원자가 있습니다',
      message: `'${serviceRequest.title}' 의뢰에 새로운 호스트가 지원했습니다. 빠르게 검토해보세요.`,
      link: `/services/${request_id}`,
      ctaLabel: '지원자 확인하기',
    }).catch((emailError) => {
      console.error('Service Application Email Error:', emailError);
    });

    insertAdminAlerts({
      title: '새 지원자가 등록되었습니다',
      message: `'${serviceRequest.title}' 의뢰에 새 호스트 지원이 접수되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('Service Application Admin Alert Error:', adminAlertError);
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('API Service Application Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// GET: 지원자 목록 조회 (service_role 클라이언트 사용 → RLS 우회)
// - 의뢰 소유자 → 전체 지원자 목록 + profiles 조인
// - 비소유자 → 본인 지원 내역만 반환
export async function GET(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 의뢰 소유자 확인
    const { data: serviceRequest } = await supabaseAdmin
      .from('service_requests')
      .select('user_id')
      .eq('id', requestId)
      .maybeSingle();

    if (!serviceRequest) {
      return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = serviceRequest.user_id === user.id;

    if (isOwner) {
      // 전체 지원자 목록 조회
      const { data: apps, error } = await supabaseAdmin
        .from('service_applications')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Applications fetch error:', error);
        return NextResponse.json({ success: false, error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
      }

      if (!apps || apps.length === 0) {
        return NextResponse.json({ success: true, data: [], isOwner: true });
      }

      // profiles & host_applications 별도 조회 (nested join RLS 우회)
      const hostIds = apps.map((a) => a.host_id);
      const [{ data: profiles }, { data: hostApps }] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, full_name, avatar_url, bio, languages, created_at, job, dream_destination, favorite_song').in('id', hostIds),
        supabaseAdmin.from('host_applications').select('user_id, name, profile_photo, self_intro, languages, language_levels, dream_destination, favorite_song').in('user_id', hostIds),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const hostAppMap = new Map((hostApps ?? []).map((h) => [h.user_id, h]));

      // reviews 조회 (체험 기반 후기수/평점)
      const { data: reviewRows } = await supabaseAdmin
        .from('reviews')
        .select('rating, experiences!inner(host_id)')
        .in('experiences.host_id', hostIds);

      const reviewMap: Record<string, { count: number; sum: number }> = {};
      type HostReviewRow = {
        rating: number | null;
        experiences?: { host_id?: string | null } | { host_id?: string | null }[] | null;
      };

      (reviewRows as HostReviewRow[] | null ?? []).forEach((r) => {
        const experiences = Array.isArray(r.experiences) ? r.experiences[0] : r.experiences;
        const hid = experiences?.host_id;
        if (!hid) return;
        if (!reviewMap[hid]) reviewMap[hid] = { count: 0, sum: 0 };
        reviewMap[hid].count++;
        reviewMap[hid].sum += Number(r.rating || 0);
      });

      const enriched = apps.map((app) => {
        const rev = reviewMap[app.host_id];
        return {
          ...app,
          profiles: profileMap.get(app.host_id) ?? null,
          host_applications: hostAppMap.get(app.host_id) ?? null,
          review_count: rev?.count ?? 0,
          review_avg: rev && rev.count > 0 ? rev.sum / rev.count : null,
        };
      });

      return NextResponse.json({ success: true, data: enriched, isOwner: true });
    } else {
      // 본인 지원 내역만 반환
      const { data: myApp } = await supabaseAdmin
        .from('service_applications')
        .select('*')
        .eq('request_id', requestId)
        .eq('host_id', user.id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        data: myApp ? [myApp] : [],
        isOwner: false,
        myApplication: myApp ?? null,
      });
    }

  } catch (error: unknown) {
    console.error('API Service Applications GET Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
