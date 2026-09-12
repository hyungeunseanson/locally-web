import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, code: 'SERVICE_MARKETPLACE_DISABLED', error: '호스트는 현지 담당자가 직접 배정합니다.' }, { status: 410 });
}
