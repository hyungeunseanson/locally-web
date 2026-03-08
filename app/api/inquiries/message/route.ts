import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';

import {
  createInquiryMessage,
  getInquiryThreadErrorResponse,
  type InquiryMessageRequestBody,
} from '../thread/shared';

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as InquiryMessageRequestBody;
    const result = await createInquiryMessage({
      actor: {
        id: user.id,
        email: user.email,
      },
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = getInquiryThreadErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
