import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { upsertInquiryThread } from '@/app/api/inquiries/thread/shared';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import { notifyProxyRequestAdminIntake } from '@/app/utils/proxyBookingNotifications';
import {
    buildProxyInquiryInitialMessage,
    getProxyRequestFeeKrw,
    PROXY_CARD_ANCHOR_MARKER,
    PROXY_CARD_ANCHOR_VERSION,
    PROXY_OPERATIONAL_STATUS_ORDER,
} from '@/app/utils/proxyBooking';

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

const DEFAULT_PROXY_REQUEST_LIMIT = 50;
const MAX_PROXY_REQUEST_LIMIT = 50;

function clampPositiveInteger(value: string | null, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, Math.floor(parsed));
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
        const isCardAnchor = data.payment_channel === 'LOCALLY' && data.payment_method === 'card';
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

        if (isCardAnchor) {
            const proxyRequestId = crypto.randomUUID();
            const formData = {
                ...intakeFormData,
                [PROXY_CARD_ANCHOR_MARKER]: PROXY_CARD_ANCHOR_VERSION,
            };
            const locallyOrderId = `LOCALLY-PROXY-${proxyRequestId}`;
            const { data: newRequest, error: insertError } = await supabase
                .from('proxy_requests')
                .insert({
                    id: proxyRequestId,
                    user_id: user.id,
                    category: data.category_data.category,
                    form_data: formData,
                    payment_channel: 'LOCALLY',
                    payment_status: 'WAITING',
                    naver_buyer_name: null,
                    locally_order_id: locallyOrderId,
                    agreed_to_terms: data.agreed_to_terms,
                    status: 'PENDING',
                })
                .select('id, locally_order_id')
                .maybeSingle();

            if (insertError || !newRequest) {
                console.error('Proxy Card Anchor Create Error:', insertError);
                if (insertError?.code === '23505') {
                    return NextResponse.json({ success: false, error: 'Duplicate request' }, { status: 409 });
                }
                return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                requestId: newRequest.id,
                inquiryId: null,
                redirectUrl: null,
                locallyOrderId: newRequest.locally_order_id,
                finalAmount,
            });
        }

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

        await notifyProxyRequestAdminIntake({
            request: {
                id: newRequest.id,
                category: data.category_data.category,
                form_data: formData,
            },
            fallbackEmail: user.email,
            paymentLabel: isNaver
                ? 'NAVER'
                : 'LOCALLY · 무통장 · 입금 대기',
            finalAmount,
        });

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });

        const hasCustomPagination = searchParams.has('limit') || searchParams.has('offset');
        const requestedLimit = Math.min(
            Math.max(clampPositiveInteger(searchParams.get('limit'), DEFAULT_PROXY_REQUEST_LIMIT), 1),
            MAX_PROXY_REQUEST_LIMIT
        );
        const requestedOffset = clampPositiveInteger(searchParams.get('offset'), 0);

        const shouldUseOperationalSort = isAdmin && searchParams.get('sort') === 'operational';
        let rows: ProxyRequestRow[];
        let hasMore = false;

        if (shouldUseOperationalSort) {
            const statusCounts = await Promise.all(
                PROXY_OPERATIONAL_STATUS_ORDER.map(async (status) => {
                    const { count, error } = await supabase
                        .from('proxy_requests')
                        .select('id', { count: 'exact', head: true })
                        .eq('status', status)
                        .or(
                            `form_data->>${PROXY_CARD_ANCHOR_MARKER}.is.null,form_data->>${PROXY_CARD_ANCHOR_MARKER}.neq.${PROXY_CARD_ANCHOR_VERSION}`
                        );

                    if (error) {
                        throw error;
                    }

                    return count ?? 0;
                })
            );

            const totalCount = statusCounts.reduce((total, count) => total + count, 0);
            let remainingOffset = requestedOffset;
            let remainingLimit = requestedLimit;
            const operationalRows: ProxyRequestRow[] = [];

            for (const [index, status] of PROXY_OPERATIONAL_STATUS_ORDER.entries()) {
                const statusCount = statusCounts[index] ?? 0;

                if (remainingOffset >= statusCount) {
                    remainingOffset -= statusCount;
                    continue;
                }

                if (remainingLimit <= 0) {
                    break;
                }

                const rowsToFetch = Math.min(statusCount - remainingOffset, remainingLimit);
                const { data, error } = await supabase
                    .from('proxy_requests')
                    .select('id, user_id, category, status, form_data, payment_channel, payment_status, naver_buyer_name, locally_order_id, agreed_to_terms, created_at, updated_at')
                    .eq('status', status)
                    .or(
                        `form_data->>${PROXY_CARD_ANCHOR_MARKER}.is.null,form_data->>${PROXY_CARD_ANCHOR_MARKER}.neq.${PROXY_CARD_ANCHOR_VERSION}`
                    )
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .range(remainingOffset, remainingOffset + rowsToFetch - 1);

                if (error) {
                    console.error('Proxy Requests Operational Fetch Error:', error);
                    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
                }

                const fetchedRows = (data ?? []) as ProxyRequestRow[];
                operationalRows.push(...fetchedRows);
                remainingLimit -= fetchedRows.length;
                remainingOffset = 0;
            }

            rows = operationalRows;
            hasMore = hasCustomPagination && totalCount > requestedOffset + rows.length;
        } else {
            let query = supabase
                .from('proxy_requests')
                .select('id, user_id, category, status, form_data, payment_channel, payment_status, naver_buyer_name, locally_order_id, agreed_to_terms, created_at, updated_at')
                .or(
                    `form_data->>${PROXY_CARD_ANCHOR_MARKER}.is.null,form_data->>${PROXY_CARD_ANCHOR_MARKER}.neq.${PROXY_CARD_ANCHOR_VERSION}`
                )
                .order('created_at', { ascending: false });

            if (!isAdmin) {
                // Regular user can only fetch their own requests
                query = query.eq('user_id', user.id);
            }

            const fetchLimit = hasCustomPagination ? requestedLimit + 1 : DEFAULT_PROXY_REQUEST_LIMIT;
            const rangeStart = hasCustomPagination ? requestedOffset : 0;
            const rangeEnd = rangeStart + fetchLimit - 1;
            const { data, error } = await query.range(rangeStart, rangeEnd);

            if (error) {
                console.error('Proxy Requests Fetch Error:', error);
                return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
            }

            const fetchedRows = (data ?? []) as ProxyRequestRow[];
            hasMore = hasCustomPagination && fetchedRows.length > requestedLimit;
            rows = hasCustomPagination ? fetchedRows.slice(0, requestedLimit) : fetchedRows;
        }
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

        return NextResponse.json({
            success: true,
            data: mergedRows,
            viewerIsAdmin: isAdmin,
            ...(hasCustomPagination
                ? {
                    pagination: {
                        limit: requestedLimit,
                        offset: requestedOffset,
                        hasMore,
                    },
                }
                : {}),
        });
    } catch (error: unknown) {
        console.error('API Proxy Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
