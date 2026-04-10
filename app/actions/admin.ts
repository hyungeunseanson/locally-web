'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { settleExperienceBookingPayouts } from '@/app/utils/adminPayouts';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';

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

  const { error } = await supabaseAdmin.from(table).update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  if (table === 'host_applications' && ['approved', 'revision', 'rejected'].includes(status)) {
    const { data: app } = await supabaseAdmin
      .from('host_applications')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (app) {
      if (status === 'approved') {
        const userRoleResult = await supabaseAdmin
          .from('users')
          .update({ role: 'host' })
          .eq('id', app.user_id);

        if (userRoleResult.error) {
          console.error('Host application users.role update failed:', userRoleResult.error);
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
