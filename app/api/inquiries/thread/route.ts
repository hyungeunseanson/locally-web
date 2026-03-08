import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';

import {
  getInquiryThreadErrorResponse,
  type InquiryThreadRequestBody,
  upsertInquiryThread,
} from './shared';

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as InquiryThreadRequestBody;
    const result = await upsertInquiryThread({
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
