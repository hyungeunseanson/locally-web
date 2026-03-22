import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { upsertInquiryThread } from '@/app/api/inquiries/thread/shared';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { buildProxyInquiryInitialMessage, getProxyCategoryLabel, getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';

type ProxyRequestRow = {
    id: string;
    user_id: string;
    category: string;
    status: string;
    form_data: Record<string, unknown> | null;
    payment_channel: string;
    payment_status: string;
    naver_buyer_name: string | null;
    locally_order_id: string | null;
    agreed_to_terms: boolean;
    created_at: string;
    updated_at: string;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
};

function getAdminAlertRequesterName(params: {
    fallbackEmail?: string | null;
    intakeFormData: Record<string, unknown>;
    contactName?: string | null;
}) {
    const directContactName = typeof params.contactName === 'string' ? params.contactName.trim() : '';
    if (directContactName) return directContactName;

    const reservationName = typeof params.intakeFormData.reservation_name === 'string'
        ? params.intakeFormData.reservation_name.trim()
        : '';
    if (reservationName) return reservationName;

    const fallbackEmail = typeof params.fallbackEmail === 'string' ? params.fallbackEmail.trim() : '';
    if (fallbackEmail) return fallbackEmail.split('@')[0];

    return '고객';
}

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Validate with Zod
        const validationResult = ProxyRequestValidationSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid form data', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const data = validationResult.data;
        const isNaver = data.payment_channel === 'NAVER';
        const baseFormData = data.category_data.form_data;
        const finalAmount = getProxyRequestFeeKrw(data.category_data.category, baseFormData);
        const intakeFormData = isNaver
          ? {
              ...baseFormData,
              service_fee_krw: finalAmount,
            }
          : {
              ...baseFormData,
              service_fee_krw: finalAmount,
              payment_method: data.payment_method,
              contact_name: data.contact_name,
              contact_phone: data.contact_phone,
            };

        const inquiryMessage = buildProxyInquiryInitialMessage({
            category: data.category_data.category,
            formData: intakeFormData,
            paymentChannel: data.payment_channel,
            finalAmount,
            naverBuyerName: isNaver ? data.naver_buyer_name : null,
        });

        const inquiryResult = await upsertInquiryThread({
            actor: {
                id: user.id,
                email: user.email,
            },
            body: {
                contextType: 'admin_support',
                message: inquiryMessage,
            },
        });

        const formData = {
            ...intakeFormData,
            linked_inquiry_id: inquiryResult.inquiryId,
        };

        // Insert into proxy_requests
        const { data: newRequest, error: insertError } = await supabase
            .from('proxy_requests')
            .insert({
                user_id: user.id,
                category: data.category_data.category,
                form_data: formData,
                payment_channel: data.payment_channel,
                payment_status: 'WAITING', // Will be updated by PG or Manual Admin
                naver_buyer_name: isNaver ? data.naver_buyer_name : null,
                locally_order_id: !isNaver ? `LOCALLY-PROXY-${crypto.randomUUID()}` : null,
                agreed_to_terms: data.agreed_to_terms,
                status: 'PENDING',
            })
            .select('id, locally_order_id')
            .maybeSingle();

        if (insertError || !newRequest) {
            console.error('Proxy Request Create Error:', insertError);
            if (inquiryResult.inquiryId) {
                const supabaseAdmin = createAdminClient();
                await supabaseAdmin.from('inquiry_messages').delete().eq('inquiry_id', inquiryResult.inquiryId);
                await supabaseAdmin.from('inquiries').delete().eq('id', inquiryResult.inquiryId);
            }
            // [Fix] 23505 = unique_violation — 중복 order ID 시 500 대신 409 반환
            if (insertError?.code === '23505') {
                return NextResponse.json({ success: false, error: 'Duplicate request' }, { status: 409 });
            }
            return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
        }

        try {
            const requesterName = getAdminAlertRequesterName({
                fallbackEmail: user.email,
                intakeFormData,
                contactName: 'contact_name' in data ? data.contact_name : null,
            });
            const categoryLabel = getProxyCategoryLabel(data.category_data.category);
            const paymentLabel = isNaver
                ? 'NAVER'
                : `LOCALLY · ${data.payment_method === 'card' ? '카드' : '무통장'}`;
            const alertLink = `/admin/dashboard?tab=TEAM&teamTab=proxy&proxyRequestId=${newRequest.id}`;
            const alertMessage = `${categoryLabel} · ${requesterName} · ${paymentLabel} · ₩${finalAmount.toLocaleString()}`;

            await insertAdminAlerts({
                title: '새 전화 예약 요청이 접수되었습니다',
                message: alertMessage,
                link: alertLink,
            });

            void sendAdminAlertEmails({
                subject: '[Locally Admin] 새 전화 예약 요청이 접수되었습니다',
                title: '새 전화 예약 요청이 접수되었습니다',
                message: `${alertMessage}\n\nTEAM > 전화 예약 탭에서 요청을 확인해주세요.`,
                link: alertLink,
                ctaLabel: '전화 예약 열기',
            });
        } catch (adminAlertError) {
            console.error('[proxy-bookings] admin alert side effect failed:', adminAlertError);
        }

        return NextResponse.json({
            success: true,
            requestId: newRequest.id,
            inquiryId: inquiryResult.inquiryId,
            redirectUrl: inquiryResult.redirectUrl,
            locallyOrderId: newRequest.locally_order_id,
            finalAmount,
        });
    } catch (error: unknown) {
        console.error('API Proxy Request POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });

        let query = supabase
            .from('proxy_requests')
            .select('id, user_id, category, status, form_data, payment_channel, payment_status, naver_buyer_name, locally_order_id, agreed_to_terms, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!isAdmin) {
            // Regular user can only fetch their own requests
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Proxy Requests Fetch Error:', error);
            return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
        }

        const rows = (data ?? []) as ProxyRequestRow[];
        const profileIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
        const profilesById = new Map<string, ProfileRow>();

        if (profileIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, phone')
                .in('id', profileIds);

            if (profilesError) {
                console.error('Proxy Request Profiles Fetch Error:', profilesError);
                return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
            }

            for (const profile of (profiles ?? []) as ProfileRow[]) {
                profilesById.set(profile.id, profile);
            }
        }

        const mergedRows = rows.map((item) => ({
            ...item,
            profiles: profilesById.get(item.user_id)
                ? {
                    full_name: profilesById.get(item.user_id)?.full_name ?? null,
                    email: profilesById.get(item.user_id)?.email ?? null,
                    avatar_url: profilesById.get(item.user_id)?.avatar_url ?? null,
                    phone: profilesById.get(item.user_id)?.phone ?? null,
                }
                : undefined,
        }));

        return NextResponse.json({ success: true, data: mergedRows, viewerIsAdmin: isAdmin });
    } catch (error: unknown) {
        console.error('API Proxy Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
