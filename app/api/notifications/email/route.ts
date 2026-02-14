import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { recipient_id, title, message, link } = body;

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipient_id)
      .single();

    if (userError || !userProfile?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: userProfile.email,
      subject: `[Locally] ${title}`,
      html: `
        <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2>Locally 알림 🔔</h2>
          <p>${message}</p>
          <br/>
          ${link ? `<a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>` : ''}
        </div>
      `,
    });

    console.log(`📧 Email sent to ${userProfile.email}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Email API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}