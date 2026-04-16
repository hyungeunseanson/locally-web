import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

const ADMIN_DELETABLE_TABLES = ['profiles', 'host_applications', 'experiences'] as const;

type AdminDeletableTable = typeof ADMIN_DELETABLE_TABLES[number];
type InquiryId = string | number;
type ExperienceId = string | number;

function isAdminDeletableTable(value: string): value is AdminDeletableTable {
  return ADMIN_DELETABLE_TABLES.includes(value as AdminDeletableTable);
}

function uniqueValues<T>(values: Array<T | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is T => value != null)));
}

function isNotFoundAuthDeleteError(message: string | undefined) {
  if (!message) return false;
  return message.toLowerCase().includes('user not found');
}

async function throwOnSupabaseError(
  operation: PromiseLike<{ error: { message: string } | null }>
) {
  const result = await operation;
  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function deleteInquiriesByIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  inquiryIds: InquiryId[]
) {
  if (inquiryIds.length === 0) return;

  await throwOnSupabaseError(
    supabaseAdmin.from('inquiry_messages').delete().in('inquiry_id', inquiryIds)
  );
  await throwOnSupabaseError(
    supabaseAdmin.from('inquiries').delete().in('id', inquiryIds)
  );
}

async function deleteExperienceDependencies(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  experienceIds: ExperienceId[]
) {
  if (experienceIds.length === 0) return;

  const { data: experienceInquiryRows, error: experienceInquiryError } = await supabaseAdmin
    .from('inquiries')
    .select('id')
    .in('experience_id', experienceIds);

  if (experienceInquiryError) {
    throw new Error(experienceInquiryError.message);
  }

  const experienceInquiryIds = uniqueValues(
    (experienceInquiryRows || []).map((row) => row.id as InquiryId | null)
  );

  const { data: experienceBookingRows, error: experienceBookingError } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .in('experience_id', experienceIds);

  if (experienceBookingError) {
    throw new Error(experienceBookingError.message);
  }

  const experienceBookingIds = uniqueValues(
    (experienceBookingRows || []).map((row) => row.id as string | null)
  );

  await deleteInquiriesByIds(supabaseAdmin, experienceInquiryIds);

  if (experienceBookingIds.length > 0) {
    await throwOnSupabaseError(
      supabaseAdmin.from('guest_reviews').delete().in('booking_id', experienceBookingIds)
    );
  }

  await throwOnSupabaseError(
    supabaseAdmin.from('reviews').delete().in('experience_id', experienceIds)
  );
  await throwOnSupabaseError(
    supabaseAdmin.from('wishlists').delete().in('experience_id', experienceIds)
  );
  await throwOnSupabaseError(
    supabaseAdmin.from('experience_availability').delete().in('experience_id', experienceIds)
  );
  await throwOnSupabaseError(
    supabaseAdmin.from('bookings').delete().in('experience_id', experienceIds)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, id } = body;

    if (!table || !id) {
      return NextResponse.json({ error: 'Missing table or id' }, { status: 400 });
    }

    const supabaseAuth = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: adminUser.id,
      email: adminUser.email,
    });

    if (!isAdmin) {
      console.error(`🚨 [Security Warning] Unauthorized Delete Attempt by ${adminUser.email}`);
      return NextResponse.json({ error: 'Forbidden: Admin Access Required' }, { status: 403 });
    }

    if (!isAdminDeletableTable(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    if (table === 'profiles') {
      try {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', id)
          .maybeSingle();
        const targetInfo = targetProfile ? `${targetProfile.email} (${targetProfile.full_name})` : '알 수 없는 유저';

        const { data: hostedExperienceRows, error: hostedExperiencesError } = await supabaseAdmin
          .from('experiences')
          .select('id')
          .eq('host_id', id);

        if (hostedExperiencesError) {
          throw hostedExperiencesError;
        }

        const hostedExperienceIds = uniqueValues(
          (hostedExperienceRows || []).map((row) => row.id as ExperienceId | null)
        );

        const { data: ownedInquiryRows, error: ownedInquiriesError } = await supabaseAdmin
          .from('inquiries')
          .select('id')
          .or(`user_id.eq.${id},host_id.eq.${id}`);

        if (ownedInquiriesError) {
          throw ownedInquiriesError;
        }

        const ownedInquiryIds = uniqueValues(
          (ownedInquiryRows || []).map((row) => row.id as InquiryId | null)
        );

        const { data: ownedServiceRequestRows, error: serviceRequestsError } = await supabaseAdmin
          .from('service_requests')
          .select('id')
          .eq('user_id', id);

        if (serviceRequestsError) {
          throw serviceRequestsError;
        }

        const ownedServiceRequestIds = uniqueValues(
          (ownedServiceRequestRows || []).map((row) => row.id as string | null)
        );

        const { data: hostedServiceApplicationRows, error: hostedServiceApplicationsError } = await supabaseAdmin
          .from('service_applications')
          .select('id')
          .eq('host_id', id);

        if (hostedServiceApplicationsError) {
          throw hostedServiceApplicationsError;
        }

        const hostedServiceApplicationIds = uniqueValues(
          (hostedServiceApplicationRows || []).map((row) => row.id as string | null)
        );

        const requestServiceApplicationIds = ownedServiceRequestIds.length > 0
          ? await (async () => {
              const { data: requestApplicationRows, error: requestApplicationsError } = await supabaseAdmin
                .from('service_applications')
                .select('id')
                .in('request_id', ownedServiceRequestIds);

              if (requestApplicationsError) {
                throw requestApplicationsError;
              }

              return uniqueValues(
                (requestApplicationRows || []).map((row) => row.id as string | null)
              );
            })()
          : [];

        const serviceApplicationIds = uniqueValues([
          ...hostedServiceApplicationIds,
          ...requestServiceApplicationIds,
        ]);

        await deleteExperienceDependencies(supabaseAdmin, hostedExperienceIds);

        await deleteInquiriesByIds(supabaseAdmin, ownedInquiryIds);

        await throwOnSupabaseError(
          supabaseAdmin.from('inquiry_messages').delete().eq('sender_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('guest_reviews').delete().or(`guest_id.eq.${id},host_id.eq.${id}`)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('reviews').delete().eq('user_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('bookings').delete().eq('user_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('host_applications').delete().eq('user_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('wishlists').delete().eq('user_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('notifications').delete().eq('user_id', id)
        );

        if (ownedServiceRequestIds.length > 0) {
          await throwOnSupabaseError(
            supabaseAdmin.from('service_bookings').delete().in('request_id', ownedServiceRequestIds)
          );
        }

        if (serviceApplicationIds.length > 0) {
          await throwOnSupabaseError(
            supabaseAdmin.from('service_bookings').delete().in('application_id', serviceApplicationIds)
          );
        }

        await throwOnSupabaseError(
          supabaseAdmin.from('service_bookings').delete().eq('customer_id', id)
        );
        await throwOnSupabaseError(
          supabaseAdmin.from('service_bookings').delete().eq('host_id', id)
        );

        if (serviceApplicationIds.length > 0) {
          await throwOnSupabaseError(
            supabaseAdmin.from('service_applications').delete().in('id', serviceApplicationIds)
          );
        }

        if (ownedServiceRequestIds.length > 0) {
          await throwOnSupabaseError(
            supabaseAdmin.from('service_requests').delete().in('id', ownedServiceRequestIds)
          );
        }

        if (hostedExperienceIds.length > 0) {
          await throwOnSupabaseError(
            supabaseAdmin.from('experiences').delete().in('id', hostedExperienceIds)
          );
        }

        await throwOnSupabaseError(
          supabaseAdmin.from('profiles').delete().eq('id', id)
        );

        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (deleteAuthError && !isNotFoundAuthDeleteError(deleteAuthError.message)) {
          console.warn('Auth user deletion warning (Zombie account):', deleteAuthError.message);
        }

        await recordAuditLog({
          admin_id: adminUser?.id,
          admin_email: adminUser?.email,
          action_type: 'DELETE_USER_FULL',
          target_type: table,
          target_id: id,
          details: { target_info: targetInfo, cascade: true },
        });

        return NextResponse.json({ success: true });
      } catch (cascadeError: unknown) {
        console.error('Cascade delete error:', cascadeError);
        const message = cascadeError instanceof Error ? cascadeError.message : '알 수 없는 오류';
        return NextResponse.json({ error: `삭제 처리 중 오류: ${message}` }, { status: 500 });
      }
    }

    let targetName = id;

    if (table === 'experiences') {
      const { data: exp } = await supabaseAdmin
        .from('experiences')
        .select('title')
        .eq('id', id)
        .maybeSingle();

      if (exp?.title) {
        targetName = exp.title;
      }

      await deleteExperienceDependencies(supabaseAdmin, [id]);
    } else if (table === 'host_applications') {
      const { data: application } = await supabaseAdmin
        .from('host_applications')
        .select('name')
        .eq('id', id)
        .maybeSingle();

      if (application?.name) {
        targetName = application.name;
      }
    }

    const { error: dbError } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (dbError) {
      console.error('DB delete error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    await recordAuditLog({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action_type: 'DELETE_ITEM',
      target_type: table,
      target_id: id,
      details: { target_info: targetName },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('API Handler Error:', err);
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
