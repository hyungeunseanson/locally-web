'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { settleExperienceBookingPayouts } from '@/app/utils/adminPayouts';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { isLatestPublicHostApplication, pickLatestPublicHostApplication } from '@/app/utils/hostVisibility';

// 🔒 관리자 권한 확인
async function getAdminClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const authAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(authAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) throw new Error('Forbidden: Admin access required');

  return supabase;
}

function buildHostApplicationStatusNotification(status: string, comment?: string) {
  const trimmedComment = comment?.trim();

  if (status === 'approved') {
    return {
      type: 'host_application_approved',
      title: '🎉 호스트 승인이 완료되었습니다',
      message: '호스트 신청이 승인되었습니다. 이제 호스트 대시보드와 기능을 이용할 수 있습니다.',
      link: '/host/dashboard',
    };
  }

  if (status === 'revision') {
    return {
      type: 'application_status_changed',
      title: '🛠️ 호스트 지원서 보완이 필요합니다',
      message: trimmedComment
        ? `관리자 코멘트를 확인하고 지원서를 보완해 주세요.\n\n보완 사유: ${trimmedComment}`
        : '관리자 코멘트를 확인하고 지원서를 보완해 주세요.',
      link: '/host/dashboard',
    };
  }

  if (status === 'rejected') {
    return {
      type: 'application_status_changed',
      title: '📌 호스트 지원 결과를 확인해 주세요',
      message: trimmedComment
        ? `이번 호스트 신청은 승인되지 않았습니다.\n\n사유: ${trimmedComment}`
        : '이번 호스트 신청은 승인되지 않았습니다.',
      link: '/host/dashboard',
    };
  }

  return null;
}

function buildExperienceStatusNotification(status: string, id: string | number) {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'active' || normalizedStatus === 'approved') {
    return {
      type: 'experience_approved',
      link: `/host/experiences/${id}`,
      key: 'experience.approved' as const,
    };
  }

  if (normalizedStatus === 'revision') {
    return {
      type: 'experience_revision_requested',
      link: `/host/experiences/${id}/edit`,
      key: 'experience.revision' as const,
    };
  }

  return null;
}

function asNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function assertLatestHostApplicationForStatusChange(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  id: string | number
) {
  const { data: targetApplication, error: targetApplicationError } = await supabaseAdmin
    .from('host_applications')
    .select('id, user_id, created_at, status')
    .eq('id', id)
    .maybeSingle();

  if (targetApplicationError) {
    throw new Error(targetApplicationError.message);
  }

  if (!targetApplication?.user_id) {
    throw new Error('호스트 지원서를 찾을 수 없습니다.');
  }

  const { data: latestApplications, error: latestApplicationsError } = await supabaseAdmin
    .from('host_applications')
    .select('id, user_id, created_at, status')
    .eq('user_id', targetApplication.user_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(2);

  if (latestApplicationsError) {
    throw new Error(latestApplicationsError.message);
  }

  const latestApplication = pickLatestPublicHostApplication(latestApplications || []);
  if (!isLatestPublicHostApplication(targetApplication, latestApplication)) {
    throw new Error('최신 호스트 지원서에서만 상태를 변경할 수 있습니다.');
  }
}

// ✅ 상태 변경 (승인/거절)
export async function updateAdminStatus(
  table: 'host_applications' | 'experiences',
  id: string | number,
  status: string,
  comment?: string
) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();
  const trimmedComment = comment?.trim();
  const targetId = String(id);

  // 🟢 [추가] 기록 전 대상 이름(제목/호스트명) 가져오기
  let targetTitle = targetId;
  try {
    if (table === 'experiences') {
      const { data } = await supabaseAdmin.from('experiences').select('title').eq('id', id).maybeSingle();
      if (data) targetTitle = data.title;
    } else if (table === 'host_applications') {
      const { data } = await supabaseAdmin.from('host_applications').select('name').eq('id', id).maybeSingle();
      if (data) targetTitle = data.name;
    }
  } catch { }

  const updateData: { status: string; admin_comment?: string } = { status };
  if ((table === 'host_applications' || table === 'experiences') && trimmedComment) {
    updateData.admin_comment = trimmedComment;
  }

  if (table === 'host_applications') {
    await assertLatestHostApplicationForStatusChange(supabaseAdmin, id);
  }

  const { error } = await supabaseAdmin.from(table).update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  if (table === 'host_applications' && ['approved', 'revision', 'rejected'].includes(status)) {
    const { data: app } = await supabaseAdmin
      .from('host_applications')
      .select('user_id, email')
      .eq('id', id)
      .maybeSingle();

    if (app) {
      if (status === 'approved') {
        const { data: existingUserRole, error: existingUserRoleError } = await supabaseAdmin
          .from('users')
          .select('role, email')
          .eq('id', app.user_id)
          .maybeSingle();

        if (existingUserRoleError) {
          console.error('Host application users.role lookup failed:', existingUserRoleError);
        }

        let userRoleEmail = asNonEmptyString(app.email) || asNonEmptyString(existingUserRole?.email);

        if (!userRoleEmail && existingUserRole?.role !== 'admin') {
          const { data: profileForRole, error: profileForRoleError } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', app.user_id)
            .maybeSingle();

          if (profileForRoleError) {
            console.error('Host application users.role profile email lookup failed:', profileForRoleError);
          }

          userRoleEmail = asNonEmptyString(profileForRole?.email);
        }

        if (existingUserRole?.role !== 'admin') {
          const userRolePayload: { id: string; role: string; email?: string } = {
            id: app.user_id,
            role: 'host',
          };

          if (userRoleEmail) {
            userRolePayload.email = userRoleEmail;
          }

          const userRoleResult = await supabaseAdmin
            .from('users')
            .upsert(userRolePayload, { onConflict: 'id' });

          if (userRoleResult.error) {
            console.error('Host application users.role upsert failed:', userRoleResult.error);
          }
        }
      }

      const notification = buildHostApplicationStatusNotification(status, trimmedComment);
      if (notification) {
        const notificationKey = status === 'approved'
          ? 'host_application.approved'
          : status === 'revision'
            ? 'host_application.revision'
            : 'host_application.rejected';
        const notificationRow = await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: app.user_id,
          type: notification.type,
          link: notification.link,
          key: notificationKey,
          copyParams: {
            comment: trimmedComment,
          },
        });
        const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationRow);

        if (notificationError) {
          console.error('Host application status notification insert failed:', notificationError);
        }

        try {
          await sendImmediateGenericEmail({
            recipientUserId: app.user_id,
            subject: '',
            title: '',
            message: '',
            templatedEmail: {
              templateId: 'host_application.status',
              audience: 'host',
              payload: {
                status: status as 'approved' | 'revision' | 'rejected',
                note: trimmedComment,
                ctaUrl: notification.link,
              },
            },
          });
        } catch (emailError) {
          console.error('Host application status email failed:', emailError);
        }
      }
    }
  }

  if (table === 'experiences') {
    const notification = buildExperienceStatusNotification(status, id);

    if (notification) {
      const { data: experience } = await supabaseAdmin
        .from('experiences')
        .select('host_id, title')
        .eq('id', id)
        .maybeSingle();

      if (experience?.host_id) {
        const notificationRow = await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: experience.host_id,
          type: notification.type,
          link: notification.link,
          key: notification.key,
          copyParams: notification.key === 'experience.revision'
            ? {
              experienceTitle: experience.title,
              comment: trimmedComment,
            }
            : {
              experienceTitle: experience.title,
            },
        });

        const { error: notificationError } = await supabaseAdmin
          .from('notifications')
          .insert(notificationRow);

        if (notificationError) {
          console.error('Experience status notification insert failed:', notificationError);
        }
      }
    }
  }

  // 🟢 로그 기록 (상세 정보 보강)
  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: `UPDATE_${table.toUpperCase()}_STATUS`,
    target_type: table,
    target_id: targetId,
    details: {
      target_info: targetTitle,
      new_status: status,
      comment: trimmedComment
    }
  });

  return { success: true };
}

export async function updateAdminHostSuperhost(
  id: string | number,
  isSuperhost: boolean
) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();
  const targetId = String(id);

  await assertLatestHostApplicationForStatusChange(supabaseAdmin, id);

  const { data: hostApplication, error: hostApplicationError } = await supabaseAdmin
    .from('host_applications')
    .select('id, user_id, name, status')
    .eq('id', id)
    .maybeSingle();

  if (hostApplicationError) {
    throw new Error(hostApplicationError.message);
  }

  if (!hostApplication) {
    throw new Error('호스트 지원서를 찾을 수 없습니다.');
  }

  if (!['approved', 'active'].includes(String(hostApplication.status || '').toLowerCase())) {
    throw new Error('승인된 호스트에게만 슈퍼호스트 배지를 부여할 수 있습니다.');
  }

  const { error } = await supabaseAdmin
    .from('host_applications')
    .update({ is_superhost: isSuperhost })
    .eq('id', id);

  if (error) throw new Error(error.message);

  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'UPDATE_HOST_APPLICATION_SUPERHOST',
    target_type: 'host_applications',
    target_id: targetId,
    details: {
      target_info: hostApplication.name || targetId,
      is_superhost: isSuperhost,
    },
  });

  return { success: true };
}

// [Security] 삭제 가능한 테이블 허용 목록 — service-role 클라이언트로 임의 테이블 삭제 방지
const ADMIN_DELETABLE_TABLES = [
  'profiles', 'experiences', 'host_applications', 'bookings',
  'community_posts', 'community_comments', 'admin_tasks', 'reviews',
] as const;
type AdminDeletableTable = typeof ADMIN_DELETABLE_TABLES[number];

// 🗑️ 데이터 삭제 (Server Action 사용 시 대비 - 로직 일치화)
export async function deleteAdminItem(table: string, id: string) {
  if (!ADMIN_DELETABLE_TABLES.includes(table as AdminDeletableTable)) {
    throw new Error(`Forbidden: table "${table}" is not deletable via this action`);
  }
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  let targetInfo = id;
  try {
    if (table === 'profiles') {
      const { data } = await supabaseAdmin.from('profiles').select('email').eq('id', id).maybeSingle();
      if (data) targetInfo = data.email;
    } else if (table === 'experiences') {
      const { data } = await supabaseAdmin.from('experiences').select('title').eq('id', id).maybeSingle();
      if (data) targetInfo = data.title;
    }
  } catch { }

  if (table === 'profiles' || table === 'users') {
    await supabaseAdmin.auth.admin.deleteUser(id);
    await recordAuditLog({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action_type: 'DELETE_USER_FULL',
      target_type: table,
      target_id: id,
      details: { target_info: targetInfo }
    });
    return { success: true };
  }

  const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);

  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'DELETE_ITEM',
    target_type: table,
    target_id: id,
    details: { target_info: targetInfo }
  });

  return { success: true };
}

// 💰 정산 완료 처리 (다중 Bookings 업데이트)
export async function settleHostPayout(bookingIds: string[]) {
  // getAdminClient()는 내부에서 resolveAdminAccess를 통해 비관리자를 throw로 차단
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  if (!bookingIds || bookingIds.length === 0) return { success: false, error: 'No bookings provided' };

  const result = await settleExperienceBookingPayouts(supabaseAdmin, bookingIds);
  if (!result.success) return result;

  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'SETTLE_HOST_PAYOUT',
    target_type: 'bookings',
    target_id: result.updatedIds.length > 1 ? 'MULTIPLE' : result.updatedIds[0],
    details: { booking_ids: result.updatedIds, count: result.updatedIds.length }
  });

  return { success: true };
}
