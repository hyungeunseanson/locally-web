import { NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { getProxyPaymentMethod, getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import type { ProxyCategory, ProxyFormData } from '@/app/types/proxy';

type ProxyBankTransferRow = {
  id: string;
  category: ProxyCategory;
  form_data: ProxyFormData | null;
  payment_channel: string;
  payment_status: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inquiryId: string }> }
) {
  const { inquiryId: rawInquiryId } = await params;
  const inquiryId = rawInquiryId.trim();

  if (!inquiryId) {
    return NextResponse.json({ success: false, error: 'Invalid inquiry id' }, { status: 400 });
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('proxy_requests')
      .select('id, category, form_data, payment_channel, payment_status')
      .eq('user_id', user.id)
      .eq('payment_channel', 'LOCALLY')
      .eq('payment_status', 'WAITING')
      .filter('form_data->>linked_inquiry_id', 'eq', inquiryId)
      .maybeSingle<ProxyBankTransferRow>();

    if (error) {
      console.error('[proxy-bank-transfer] request lookup failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to load bank transfer guidance' }, { status: 500 });
    }

    if (!data || getProxyPaymentMethod(data.form_data) !== 'bank') {
      return NextResponse.json(
        { success: true, data: null },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId: data.id,
          serviceFeeKrw: getProxyRequestFeeKrw(data.category, data.form_data),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[proxy-bank-transfer] unexpected lookup error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load bank transfer guidance' }, { status: 500 });
  }
}
