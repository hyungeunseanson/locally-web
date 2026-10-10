import type { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import type { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import type { schedulePublicExperienceMediaProducer } from '@/app/utils/publicExperienceMediaQueueProducer.server';
import type { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import type { PublicExperienceMediaRow } from '@/app/utils/publicExperienceMediaQueueMirror';
import { findMissingExperienceBodyFields } from '@/app/utils/experienceTranslation/integrity';
import {
  buildSourceTranslationContent,
  buildSourceTranslationContentFromExperience,
  normalizeExperienceLocaleArray,
  isExperienceLocale,
} from '@/app/utils/experienceTranslation';

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
  let checkedTranslationVersion: number | null = null;
  let checkedStatus: string | null = null;
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

  if (['active', 'approved'].includes(status.trim().toLowerCase())) {
    const { data: translationRow, error: translationError } = await supabaseAdmin
      .from('experiences')
      .select('status, translation_version, source_locale, manual_locales, title_ko, title_en, title_ja, title_zh, description_ko, description_en, description_ja, description_zh, category, meeting_point, meeting_point_i18n, supplies, supplies_i18n, inclusions, inclusions_i18n, exclusions, exclusions_i18n, itinerary, itinerary_i18n, rules, rules_i18n, translation_meta')
      .eq('id', id)
      .maybeSingle();
    if (translationError || !translationRow) {
      throw new Error('체험 번역 상태를 확인할 수 없습니다.');
    }
    const row = translationRow as Record<string, unknown>;
    checkedStatus = String(row.status ?? '');
    checkedTranslationVersion = Number(row.translation_version);
    if (!Number.isInteger(checkedTranslationVersion)) {
      throw new Error('체험 번역 버전을 확인할 수 없습니다.');
    }
    const sourceLocale = isExperienceLocale(row.source_locale) ? row.source_locale : 'ko';
    const sourceBody = buildSourceTranslationContentFromExperience(row, sourceLocale);
    for (const locale of normalizeExperienceLocaleArray(row.manual_locales)) {
      if (locale === sourceLocale) continue;
      const targetBody = buildSourceTranslationContent({
        category: row.category,
        meetingPoint: (row.meeting_point_i18n as Record<string, unknown> | null)?.[locale],
        supplies: (row.supplies_i18n as Record<string, unknown> | null)?.[locale],
        inclusions: (row.inclusions_i18n as Record<string, unknown> | null)?.[locale],
        exclusions: (row.exclusions_i18n as Record<string, unknown> | null)?.[locale],
        itinerary: (row.itinerary_i18n as Record<string, unknown> | null)?.[locale],
        rules: (row.rules_i18n as Record<string, unknown> | null)?.[locale],
      });
      const missing = findMissingExperienceBodyFields(sourceBody, targetBody);
      if (!String(row[`title_${locale}`] ?? '').trim()) missing.push('title');
      if (!String(row[`description_${locale}`] ?? '').trim()) missing.push('description');
      const meta = (row.translation_meta as Record<string, { status?: string }> | null)?.[locale];
      if (missing.length || meta?.status === 'failed') {
        throw new Error(`선택한 언어(${locale})의 번역을 보완한 뒤 승인해주세요.`);
      }
    }
  }

  const updateData: { status: string; admin_comment?: string } = { status };
  if (trimmedComment) {
    updateData.admin_comment = trimmedComment;
  }

  let updateQuery = supabaseAdmin
    .from('experiences')
    .update(updateData)
    .eq('id', id);
  if (checkedTranslationVersion !== null) {
    updateQuery = updateQuery.eq('translation_version', checkedTranslationVersion).eq('status', checkedStatus);
  }
  const { data: updatedExperience, error } = await updateQuery
    .select('id, status, is_active, photos, itinerary, image_url')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updatedExperience) throw new Error('체험이 변경되었습니다. 새로고침 후 다시 승인해주세요.');

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
