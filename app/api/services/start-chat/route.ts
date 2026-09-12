import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, code: 'SERVICE_MARKETPLACE_DISABLED', error: '결제 후 생성되는 현지 담당자 1:1 문의를 이용해 주세요.' }, { status: 410 });
}
