import { NextResponse } from 'next/server';

const disabled = () => NextResponse.json({ success: false, code: 'SERVICE_MARKETPLACE_DISABLED', error: '호스트 공개 지원 기능이 종료되었습니다.' }, { status: 410 });

export async function GET() { return disabled(); }
export async function POST() { return disabled(); }
export async function PATCH() { return disabled(); }
export async function DELETE() { return disabled(); }
