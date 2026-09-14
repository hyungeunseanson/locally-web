import type { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import type { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import type { schedulePublicExperienceMediaProducer } from '@/app/utils/publicExperienceMediaQueueProducer.server';
import type { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import type { PublicExperienceMediaRow } from '@/app/utils/publicExperienceMediaQueueMirror';

type AdminSessionClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id?: string; email?: string } | null };
    }>;
  };
};

export type UpdateExperienceAdminStatusDependencies = {
  getAdminClient: () => Promise<AdminSessionClient>;
  createAdminClient: typeof createAdminClient;
  scheduleMediaProducer: typeof schedulePublicExperienceMediaProducer;
  buildLocalizedNotificationInsert: typeof buildLocalizedNotificationInsert;
  sendImmediateGenericEmail: typeof sendImmediateGenericEmail;
  recordAuditLog: typeof recordAuditLog;
};

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

export async function executeUpdateExperienceAdminStatus(
  id: string | number,
  status: string,
  comment: string | undefined,
  dependencies: UpdateExperienceAdminStatusDependencies
) {
  const supabase = await dependencies.getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = dependencies.createAdminClient();
  const trimmedComment = comment?.trim();
  const targetId = String(id);

  let targetTitle = targetId;
  let mediaBefore: PublicExperienceMediaRow | null = null;
  try {
    const { data } = await supabaseAdmin
      .from('experiences')
      .select('id, title, status, is_active, photos, itinerary, image_url')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      targetTitle = data.title;
      mediaBefore = data;
    }
  } catch {
    // The existing status update remains authoritative even if display metadata cannot be loaded.
  }

  const updateData: { status: string; admin_comment?: string } = { status };
  if (trimmedComment) {
    updateData.admin_comment = trimmedComment;
  }

  const { data: updatedExperience, error } = await supabaseAdmin
    .from('experiences')
    .update(updateData)
    .eq('id', id)
    .select('id, status, is_active, photos, itinerary, image_url')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updatedExperience) throw new Error('Experience not found');

  dependencies.scheduleMediaProducer({
    before: mediaBefore,
    after: updatedExperience,
    writeKind: 'activation',
  });

  const notification = buildExperienceStatusNotification(status, id);
  if (notification) {
    const { data: experience } = await supabaseAdmin
      .from('experiences')
      .select('host_id, title')
      .eq('id', id)
      .maybeSingle();

    if (experience?.host_id) {
      const copyParams = notification.key === 'experience.revision'
        ? {
          experienceTitle: experience.title,
          comment: trimmedComment,
        }
        : {
          experienceTitle: experience.title,
        };

      const notificationRow = await dependencies.buildLocalizedNotificationInsert({
        supabaseAdmin,
        userId: experience.host_id,
        type: notification.type,
        link: notification.link,
        key: notification.key,
        copyParams,
      });

      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationRow);

      if (notificationError) {
        console.error('Experience status notification insert failed:', notificationError);
      }

      try {
        await dependencies.sendImmediateGenericEmail({
          recipientUserId: experience.host_id,
          subject: '',
          title: '',
          message: '',
          templatedEmail: {
            templateId: 'notice.copy',
            audience: 'host',
            payload: {
              copyKey: notification.key,
              copyParams,
              ctaUrl: notification.link,
            },
          },
        });
      } catch (emailError) {
        console.error('Experience status email failed:', emailError);
      }
    }
  }

  await dependencies.recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'UPDATE_EXPERIENCES_STATUS',
    target_type: 'experiences',
    target_id: targetId,
    details: {
      target_info: targetTitle,
      new_status: status,
      comment: trimmedComment,
    },
  });

  return { success: true };
}
